// 대화 화면(2.0). 메신저처럼 왼쪽에 대화 목록, 오른쪽에 고른 대화 하나만 둔다.
// 맡길 일을 적어 보내면 대화가 하나 생기고, 그 안에서 진행 한 줄 → 질문 → 완료 보고와 파일을 받는다.
// 부서·직원·관제 같은 사무실 구조는 화면에 내보이지 않는다(직원 구성 편집은 설정 안에만 있다).
// 순수 함수는 export 해서 Node 테스트에서 쓰고, DOM 코드는 createInbox 안에서만 돈다.
// 조회·새로고침은 저장된 정보만 읽는다(AI 호출 0회). 상태를 바꾸는 것은 보내기·답글·중지·취소·예산·대조 결정뿐이다.

export const ITEM_LABEL = Object.freeze({ waiting: '대기', running: '진행 중', needs: '답변 필요', done: '완료', failed: '실패', stopped: '중지', canceled: '취소' });
export const COMPOSE_LIMITS = Object.freeze({ items: 20, prompt: 20000, attachments: 10 });
export const AI_NAME = 'AI 비서';
const DEAD = ['canceled', 'failed', 'stopped'];
const ATTENTION = ['needs', 'failed', 'stopped'];
const BUSY = ['running', 'queued'];
const SETTLED = ['done', 'needs', 'failed', 'stopped'];

// 대기 중인 건이 무엇을 기다리는지 한 줄로
export function waitingText(item) {
  const w = item.waitingOn;
  if (item.resumeQueued) return '답글을 접수했습니다. 진행 중인 업무가 끝나면 이어서 진행합니다.';
  if (!w) return '차례 대기';
  if (w.kind === 'dependency') return `앞 업무 "${w.title}"의 결과 대기${DEAD.includes(w.status) ? ` — 그 업무가 ${ITEM_LABEL[w.status]} 상태라 스스로 시작하지 못합니다` : ''}`;
  if (w.kind === 'budget') return '묶음 예산을 모두 썼습니다. 예산을 늘리면 시작합니다.';
  return w.title ? `차례 대기 — 앞선 업무 "${w.title}"` : '차례 대기';
}
export function itemNote(item) {
  if (item.status === 'waiting') return waitingText(item);
  if (item.status === 'running') return '진행 중';
  if (item.status === 'done') return '완료했습니다';
  return item.reason || ITEM_LABEL[item.status] || item.status;
}
export function countsText(batch) {
  const order = ['done', 'needs', 'running', 'waiting', 'failed', 'stopped', 'canceled'];
  return order.filter((s) => batch.counts?.[s]).map((s) => `${ITEM_LABEL[s]} ${batch.counts[s]}`).join(' / ') || '없음';
}
export function usageText(usage) {
  if (!usage || !usage.calls) return 'AI 호출 0회';
  const n = (v) => Number(v || 0).toLocaleString('ko-KR');
  return `AI 호출 ${usage.calls}회 · 확인된 입력 ${n(usage.input)} · 출력 ${n(usage.output)} 토큰${usage.unreported ? ` · 미보고 ${usage.unreported}회(토큰 미포함)` : ''}`;
}
// 제출 키: 여러 건을 한 번에 보낼 때 한 번 만들고, 같은 제출을 다시 보낼 때 그대로 쓴다
export function newSubmitKey(random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  return [...random(24)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// 올린 파일 경로를 지시문에 붙인다
export const withUploads = (prompt, paths) => (paths.length ? `${prompt}\n\n[업로드한 파일]\n- ${paths.join('\n- ')}` : prompt);
export function sizeText(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n}B`;
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`;
}

// 실행 하나(그 대화의 마지막 실행)를 건 상태 이름으로
export function runStatus(run) {
  if (!run) return 'waiting';
  if (BUSY.includes(run.status)) return 'running';
  if (run.status === 'done') return run.needsReply ? 'needs' : 'done';
  return run.status === 'stopped' ? 'stopped' : 'failed';
}
const rootOf = (run) => run.rootId || run.id;

// 대화 목록의 재료: 접수한 건 하나가 대화 하나다. 묶음을 거치지 않은 지시(빠른 조회·상시 감시·예전 업무)도 대화 하나로 센다.
// entry: { id, kind: 'item'|'run', at, title, status, note, run(대화 뿌리), task, batch?, item? } — 접수 순서(오래된 것 먼저)
export function streamEntries(state) {
  const out = [], seen = new Set();
  for (const batch of state.batches || []) {
    for (const item of batch.items || []) {
      if (item.run) seen.add(item.run);
      out.push({ id: item.id, kind: 'item', at: batch.createdAt, order: batch.seq * 100 + item.no, title: item.title, status: item.status, note: itemNote(item), run: item.run || null, task: item.task || null, batch, item });
    }
  }
  const runs = (state.runs || []).filter((r) => !r.phase && r.target !== 'review');
  for (const run of runs) {
    if (run.parentId || rootOf(run) !== run.id || seen.has(run.id) || run.monitorId) continue;
    const latest = runs.filter((r) => rootOf(r) === run.id).at(-1) || run;
    const status = runStatus(latest);
    out.push({ id: `run:${run.id}`, kind: 'run', at: run.createdAt, order: 0, title: run.request || '(지시)', status, run: run.id, task: latest.task || run.task || null,
      note: run.continuous && status === 'running' ? '지속 감시 중' : status === 'needs' ? '답변이 필요합니다.' : status === 'running' ? '진행 중' : status === 'done' ? '완료했습니다' : latest.summary || ITEM_LABEL[status] });
  }
  return out.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')) || a.order - b.order);
}
// 내가 봐야 할 것: 답변 필요·실패·중지, 그리고 스스로 시작하지 못하는 대기 건
export function attentionEntries(entries) {
  return entries.filter((e) => ATTENTION.includes(e.status)
    || (e.item?.status === 'waiting' && (e.item.waitingOn?.kind === 'budget' || (e.item.waitingOn?.kind === 'dependency' && DEAD.includes(e.item.waitingOn.status)))));
}
// 읽음 표시에 쓰는 서명: 상태나 마지막 실행이 바뀌면 새 소식이다
export const entrySig = (entry, latestRunId = '') => `${entry.status}:${latestRunId || ''}`;
export const isUnread = (entry, sig, seen) => SETTLED.includes(entry.status) && seen?.[entry.id] !== sig;

// 진행 중에는 지금 하는 일을 한 줄로만 보여 준다. 누가 맡았는지 같은 내부 과정은 내보이지 않는다
export const PROGRESS_TEXT = Object.freeze({ 'plan.set': '어떻게 진행할지 정리하고 있습니다…', 'meeting.start': '일을 나누고 있습니다…', 'meeting.end': '작업을 준비하고 있습니다…',
  'flow.assign': '작업하고 있습니다…', 'agent.start': '작업하고 있습니다…', 'flow.cooperate': '다음 작업으로 넘어갔습니다…', 'agent.stop': '작업한 내용을 정리하고 있습니다…',
  'flow.review_request': '결과를 검토하고 있습니다…', 'flow.review': '검토한 내용을 반영하고 있습니다…', 'flow.deliver': '결과를 전달하고 있습니다…' });
export function progressText(run, feed = [], task = null) {
  if (run?.continuous) return '계속 지켜보고 있습니다. 새 자료가 생기면 알려 드립니다.';
  let last = null;
  for (const ev of feed) {
    if (!ev || !task || ev.task !== task || !PROGRESS_TEXT[ev.kind] || String(ev.ts) < String(run?.createdAt || '')) continue;
    if (!last || String(ev.ts) >= String(last.ts)) last = ev;
  }
  return last ? PROGRESS_TEXT[last.kind] : '접수했습니다. 바로 시작합니다…';
}

// 대화: 내 지시 → (진행 한 줄) → 질문 → 내 답글 → 완료 보고. 끝난 실행은 답변만 남고 중간 과정은 남기지 않는다.
// message: { who, role: 'me'|'ai', at, text, tone?: 'live'|'question'|'past'|'done'|'failed', run?, deliver?: 파일을 붙일 완료 보고 }
export function threadMessages({ entry, prompt = null, runs = [], feed = [], results = {} }) {
  const out = [{ who: '나', role: 'me', at: entry.at, text: prompt || entry.title }];
  const conv = entry.run ? runs.filter((r) => !r.phase && r.target !== 'review' && rootOf(r) === entry.run).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))) : [];
  if (!conv.length) {
    out.push({ who: AI_NAME, role: 'ai', at: entry.at, text: entry.status === 'canceled' ? '이 업무는 취소됐습니다.' : entry.status === 'failed' ? `시작하지 못했습니다. ${entry.note}` : `접수했습니다. ${entry.note}`, tone: entry.status === 'waiting' ? 'live' : undefined });
    return out;
  }
  conv.forEach((run, i) => {
    if (i > 0) out.push({ who: '나', role: 'me', at: run.createdAt, text: run.request || '(답글)' });
    if (BUSY.includes(run.status)) { out.push({ who: AI_NAME, role: 'ai', at: null, text: progressText(run, feed, run.task || entry.task), tone: 'live', run: run.id }); return; }
    const status = runStatus(run);
    out.push({ who: AI_NAME, role: 'ai', at: run.endedAt || run.createdAt, text: results[run.id] || run.summary || ITEM_LABEL[status], run: run.id,
      // 내가 이미 답한 앞선 말(질문·중간 보고)은 완료 표시 없이 그대로 둔다. 완료 보고는 마지막 말 하나다
      tone: status === 'needs' ? 'question' : status === 'done' ? (i === conv.length - 1 ? 'done' : 'past') : 'failed', ...(status === 'done' && i === conv.length - 1 && (run.task || entry.task) ? { deliver: true } : {}) });
  });
  return out;
}

// 이 대화에서 지금 입력창으로 할 수 있는 일
// reply: 같은 업무로 이어서 답한다 / note: 진행 중인 업무에 덧붙인다 / follow: 끝난 업무의 결과를 이어받는 새 업무로 보낸다 / off: 보낼 수 없다(사유를 보여 준다)
// 끝난 업무에는 답글을 보낼 수 없다(서버가 "이미 완료된 업무는 새 작업으로 지시해 주세요"로 거부한다). 그래서 새 업무로 보내되 앞 업무의 산출물을 입력으로 알려 준다
export function composeMode(entry, latest) {
  if (!entry) return { mode: 'new', hint: 'Enter로 보내기 · Shift+Enter로 줄바꿈', placeholder: '맡길 일을 적어 보내세요 — 예: 이번 주 회신 현황을 표로 정리해 줘' };
  if (entry.status === 'canceled') return { mode: 'off', hint: '취소한 업무입니다. 새 대화로 다시 맡겨 주세요.' };
  if (!latest) return { mode: 'off', hint: entry.status === 'waiting' ? '차례를 기다리고 있습니다. 시작되면 이어서 말할 수 있어요.' : '이 대화는 이어서 보낼 수 없습니다. 새 대화로 맡겨 주세요.' };
  if (BUSY.includes(latest.status)) return { mode: 'note', hint: '진행 중입니다. 덧붙일 말이 있으면 보내세요.', placeholder: '덧붙일 말…' };
  if (entry.status === 'done') return { mode: 'follow', hint: '끝난 업무입니다. 보내면 이 결과를 이어받는 새 대화로 진행합니다', placeholder: '이 결과를 이어서 고치거나 더 맡길 일을 적어 보내세요' };
  if (latest.canReply === false) return { mode: 'off', hint: '이 대화는 이어서 보낼 수 없습니다. 새 대화로 맡겨 주세요.' };
  return { mode: 'reply', hint: entry.status === 'needs' ? '답하면 같은 업무로 이어서 진행합니다' : 'Enter로 보내기 · Shift+Enter로 줄바꿈',
    placeholder: entry.status === 'needs' ? '답변을 적어 보내세요' : '이어서 진행하려면 답글을 보내세요(예: 이어서 진행)' };
}


// 사이드바에 세울 팀장: 근무 중인 직원이 있는 부서(검토 전용 부서 제외). 팀장이 없으면 부서 이름만으로 방을 만든다
// lead: { id(부서 id), name(부서 이름), label('○○부 팀장'), boss(팀장 이름), summary }
export function leadList(state) {
  const agents = state.agents || {};
  return (state.departments || []).filter((d) => d.active !== false && d.codexRole !== 'review')
    .map((dept) => { const staff = (dept.members || []).map((m) => (typeof m === 'string' ? agents[m] : m)).filter((a) => a && a.active !== false && a.status !== 'off-duty'); return { dept, staff }; })
    .filter(({ staff }) => staff.length)
    .map(({ dept, staff }) => ({ id: dept.id, name: dept.name, label: `${dept.name} 팀장`, boss: staff.find((a) => a.lead)?.name || '', summary: dept.summary || '' }));
}
// 팀장 방에서 입력창이 하는 일: 마지막 업무가 답을 기다리면 그 업무에 답하고, 아니면 그 팀에 새 업무를 맡긴다
export const leadReplyTarget = (mine) => (mine.at(-1)?.status === 'needs' ? mine.at(-1) : null);

// 업무 예시 찾기: 띄어 쓴 낱말이 모두 들어 있는 가이드만(업무 이름·설명·다른 이름·산출물·예시 이름에서 찾는다). 빈 검색어는 전부
export function searchGuides(guides, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...guides];
  return guides.filter((g) => { const hay = [g.title, g.summary, ...(g.keywords || []), g.output, ...(g.examples || []).map((e) => e.label)].join(' ').toLowerCase(); return words.every((w) => hay.includes(w)); });
}
// 예시를 입력창에 넣을 때: 쓰던 글이 없으면 그대로, 있으면 한 줄 띄고 뒤에 붙인다(답글용)
export const appendDraft = (draft, text) => (String(draft || '').trim() ? `${String(draft).trimEnd()}\n\n${text}` : text);

// 보고서 글을 읽기 좋게: 제목 줄(# …)은 굵게, 나머지 줄은 그대로. 받은 글은 먼저 esc로 안전하게 바꾼 뒤에만 꾸민다
export function richText(text, esc) {
  return String(text || '').split('\n').map((line) => { const m = line.match(/^#{1,6}\s+(.*)$/); return m ? `<strong class="wm-h">${esc(m[1])}</strong>` : esc(line); }).join('\n').replace(/\n{3,}/g, '\n\n').replace(/<\/strong>\n+/g, '</strong>');
}

// ───── 화면 ─────
// deps: { api, authedGet, toast, esc, state(), refresh(), view(), setView(v), openThread(runId), openCompletion(taskId), download(file), upload(file) → 경로, store(key, value),
//         resultMessage(result), open: { schedules, company, connections, notify, theme }, themeLabel(), notifyOn(), connState() }
export function createInbox(deps) {
  const { api, authedGet, toast, esc, state, refresh, view, setView, openThread, openCompletion, download, upload, store, resultMessage, open } = deps;
  const $ = (id) => document.getElementById(id);
  // page: chat(대화 또는 새 대화) | guides(업무 예시 목록) | guide(예시 상세) | lead(팀장 방) | settings | reports | report | reconcile | guidecheck.  pane: 좁은 화면에서 지금 보이는 쪽(list | main)
  // guideCtx: 예시를 어디에 쓸지 — 'new'(새 대화), 예시를 연 대화의 id, 또는 'lead:<부서 id>'(팀장 방)
  const ui = { page: 'chat', open: store('ai-office-open') || null, report: null, lead: null, guide: null, guideCtx: 'new', guideQ: store('ai-office-guide-q') || '', guides: { list: [], teams: [], coverage: null, problems: [], exists: false, loaded: false, at: 0 }, teamGuide: null,
    pane: 'list', filter: store('ai-office-filter') === 'needs' ? 'needs' : 'all',
    details: new Map(), results: new Map(), reports: new Map(), files: new Map(), reconcile: { items: [], loaded: false, count: -1 },
    queue: [], attached: [], submitKey: newSubmitKey(), pending: [], notices: [], sending: false, stick: true, ctx: undefined, seen: null, listTop: 0 };
  try { const saved = JSON.parse(store('ai-office-composer') || 'null'); if (saved && Array.isArray(saved.queue)) { ui.queue = saved.queue; ui.submitKey = saved.submitKey || ui.submitKey; } } catch { /* 새로 시작 */ }
  ui.leadsFolded = store('ai-office-leads-folded') === '1';
  try { const seen = JSON.parse(store('ai-office-seen') || 'null'); if (seen && typeof seen === 'object') ui.seen = seen; } catch { /* 새로 시작 */ }
  const saveComposer = () => store('ai-office-composer', JSON.stringify({ queue: ui.queue, submitKey: ui.submitKey }));

  // 다시 그려도 읽는 위치·초점·입력 중인 글을 빼앗지 않는다
  function setHTML(el, html) {
    if (!el || el._html === html) return false;
    const active = document.activeElement;
    const key = active && el.contains(active) ? active.dataset.key : null;
    const typed = [...el.querySelectorAll('[data-keep]')].map((i) => [i.dataset.keep, i.type === 'checkbox' ? i.checked : i.value]);
    const opened = [...el.querySelectorAll('details[open][data-keep-open]')].map((d) => d.dataset.keepOpen);
    const scrolls = [...el.querySelectorAll('[data-scroll]')].map((s) => [s.dataset.scroll, s.scrollTop]);
    const top = el.scrollTop;
    el.innerHTML = html; el._html = html;
    for (const [k, v] of typed) { const i = el.querySelector(`[data-keep="${CSS.escape(k)}"]`); if (i) { if (i.type === 'checkbox') i.checked = v; else i.value = v; } }
    for (const k of opened) { const d = el.querySelector(`details[data-keep-open="${CSS.escape(k)}"]`); if (d) d.open = true; }
    for (const [k, v] of scrolls) { const s = el.querySelector(`[data-scroll="${CSS.escape(k)}"]`); if (s) s.scrollTop = v; }
    el.scrollTop = top;
    if (key) el.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
    return true;
  }
  const time = (iso) => { if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const today = new Date().toDateString() === d.toDateString();
    return d.toLocaleString('ko-KR', today ? { hour: '2-digit', minute: '2-digit', hour12: false } : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); };
  const mins = (ms) => (ms >= 60000 ? `${Math.round(ms / 60000)}분` : ms > 0 ? '1분 미만' : '0분');
  const chip = (status, label) => `<span class="chip chip-${esc(status)}">${esc(label || ITEM_LABEL[status] || status)}</span>`;
  const avatar = (role, mark) => `<span class="av av-${role}${mark ? ' av-lead' : ''}" aria-hidden="true">${role === 'me' ? '나' : esc(mark || 'AI')}</span>`;
  const leads = () => leadList(state());
  const findLead = (id) => leads().find((l) => l.id === id) || null;
  const leadOf = (entry) => (entry?.item?.to ? findLead(entry.item.to) : null);
  const leadEntries = (id) => entries().filter((e) => e.item?.to === id);
  const initial = (lead) => [...lead.name][0] || '팀';
  const entries = () => streamEntries(state());
  const findEntry = (id) => entries().find((e) => e.id === id) || null;
  const convRuns = (entry) => (entry?.run ? state().runs.filter((r) => !r.phase && r.target !== 'review' && rootOf(r) === entry.run) : []);
  const current = () => (ui.page === 'chat' && ui.open ? findEntry(ui.open) : null);
  const narrow = () => window.matchMedia('(max-width: 767px)').matches;
  const sigOf = (entry) => entrySig(entry, convRuns(entry).at(-1)?.id);

  // ── 읽음 표시 ──
  function markSeen(entry) {
    if (!ui.seen || !entry) return;
    const sig = sigOf(entry);
    if (ui.seen[entry.id] === sig) return;
    ui.seen[entry.id] = sig; store('ai-office-seen', JSON.stringify(ui.seen));
  }
  function syncSeen(all) {
    // 처음 쓰는 브라우저에서는 이미 있던 대화를 모두 읽은 것으로 둔다
    if (!ui.seen) { if (!state().runs) return; ui.seen = Object.fromEntries(all.map((e) => [e.id, sigOf(e)])); store('ai-office-seen', JSON.stringify(ui.seen)); return; }
    const ids = new Set(all.map((e) => e.id));
    let dropped = false;
    for (const id of Object.keys(ui.seen)) if (all.length && !ids.has(id)) { delete ui.seen[id]; dropped = true; }
    if (dropped) store('ai-office-seen', JSON.stringify(ui.seen));
  }

  // ── 왼쪽: 대화 목록 ──
  function renderSidebar() {
    const s = state(), all = entries(), v = view();
    syncSeen(all);
    const attention = attentionEntries(all);
    // 팀장에게 맡긴 업무는 그 팀장 방에 모이고, 나머지가 "대화" 목록에 선다
    const team = leads(), teamIds = new Set(team.map((l) => l.id));
    const general = (list) => list.filter((e) => !teamIds.has(e.item?.to));
    const shown = general(ui.filter === 'needs' ? attention : all).slice().reverse();
    const hereLead = v === 'inbox' && ui.page === 'lead' ? ui.lead : null;
    const leadRow = (l) => {
      const mine = all.filter((e) => e.item?.to === l.id), needs = mine.filter((e) => ATTENTION.includes(e.status)).length, busy = mine.some((e) => e.status === 'running' || e.status === 'waiting');
      const unread = l.id !== hereLead && mine.some((e) => isUnread(e, sigOf(e), ui.seen));
      if (ui.filter === 'needs' && !needs) return '';
      return `<button type="button" class="sb-conv sb-lead${unread ? ' is-unread' : ''}" data-lead="${esc(l.id)}" data-key="lead-${esc(l.id)}" aria-current="${l.id === hereLead ? 'page' : 'false'}"><span class="sb-lead-av" aria-hidden="true">${esc(initial(l))}</span>
        <span class="sb-lead-main"><span class="sb-conv-title">${esc(l.label)}</span><span class="sb-conv-sub">${needs ? `<span class="mark mark-needs">답변 필요 ${needs}</span>` : busy ? '<span class="mark mark-running">진행 중</span>' : `<span class="sb-lead-sum">${esc(l.summary || '말을 걸어 일을 맡기세요')}</span>`}${unread ? '<span class="sb-new-dot">새 소식</span>' : ''}</span></span></button>`;
    };
    const folded = ui.leadsFolded === true;
    const leadRows = team.map((l) => (folded && !all.some((e) => e.item?.to === l.id && (ATTENTION.includes(e.status) || e.status === 'running' || e.status === 'waiting')) && l.id !== hereLead ? '' : leadRow(l))).join('');
    const conn = deps.connState?.() || 'connecting';
    const here = v === 'inbox' && ui.page === 'chat' ? ui.open : null;
    const rec = s.reconcilePending || 0;
    const row = (e) => {
      const unread = e.id !== here && isUnread(e, sigOf(e), ui.seen);
      return `<button type="button" class="sb-conv${unread ? ' is-unread' : ''}" data-open-entry="${esc(e.id)}" data-key="conv-${esc(e.id)}" aria-current="${e.id === here ? 'page' : 'false'}">
        <span class="sb-conv-title">${esc(e.title)}</span>
        <span class="sb-conv-sub"><span class="mark mark-${esc(e.status)}">${esc(ITEM_LABEL[e.status] || e.status)}</span><time>${esc(time(e.at))}</time>${e.item?.via === 'terminal' ? '<span class="sb-via" title="터미널의 Claude·Codex에게 말해서 맡긴 업무">터미널에서 맡김</span>' : ''}${unread ? '<span class="sb-new-dot">새 소식</span>' : ''}</span></button>`;
    };
    setHTML($('sidebar'), `<div class="sb-head"><strong class="sb-name">AI Office</strong><span class="sb-conn" data-state="${esc(conn)}" title="${{ live: '실시간 연결', connecting: '연결 중', retry: '연결 끊김 · 재연결 중' }[conn] || ''}"><i aria-hidden="true"></i>${conn === 'live' ? '연결됨' : conn === 'retry' ? '연결 끊김' : '연결 중'}</span></div>
      <div class="sb-top"><button type="button" class="btn sb-newbtn" data-new data-key="sb-new">＋ 새 대화</button>
        <div class="sb-filter" role="group" aria-label="대화 거르기">
          <button type="button" data-filter="all" data-key="sb-f-all" aria-pressed="${ui.filter === 'all'}">전체</button>
          <button type="button" data-filter="needs" data-key="sb-f-needs" aria-pressed="${ui.filter === 'needs'}">답변 필요${attention.length ? ` <span class="sb-badge sb-badge-alert">${attention.length}</span>` : ''}</button></div></div>
      <nav class="sb-scroll" data-scroll="list" aria-label="대화 목록">
        ${rec ? `<button type="button" class="sb-conv sb-conv-alert" data-page="reconcile" data-key="sb-rec" aria-current="${v === 'inbox' && ui.page === 'reconcile' ? 'page' : 'false'}"><span class="sb-conv-title">발송 결과 확인</span><span class="sb-conv-sub"><span class="mark mark-needs">확인 필요 ${rec}건</span></span></button>` : ''}
        ${team.length ? `<h2 class="sb-title"><button type="button" class="sb-fold" data-fold-leads data-key="sb-fold" aria-expanded="${!folded}">팀장 ${team.length}<span aria-hidden="true">${folded ? '▸' : '▾'}</span></button></h2>${leadRows}<h2 class="sb-title">대화</h2>` : ''}
        ${shown.map(row).join('') || `<p class="sb-empty">${ui.filter === 'needs' ? '답변을 기다리는 대화가 없습니다.' : '아직 대화가 없습니다. 맡길 일을 적어 보내면 여기에 쌓입니다.'}</p>`}
      </nav>
      <div class="sb-foot"><button type="button" class="sb-item" data-page="guides" data-key="sb-guides" aria-current="${v === 'inbox' && ['guides', 'guide', 'teamguide'].includes(ui.page) ? 'page' : 'false'}"><span class="sb-ic" aria-hidden="true">?</span><span class="sb-label">가이드</span></button>
        <button type="button" class="sb-item" data-page="settings" data-key="sb-settings" aria-current="${(v === 'inbox' && ['settings', 'reports', 'report', 'guidecheck'].includes(ui.page)) || v === 'team' ? 'page' : 'false'}"><span class="sb-ic" aria-hidden="true">⚙</span><span class="sb-label">설정</span></button></div>`);
  }

  // ── 오른쪽 머리말 ──
  function renderHead(entry) {
    const batch = ui.page === 'report' ? (state().batches || []).find((b) => b.id === ui.report) : null;
    const guide = ui.page === 'guide' ? ui.guides.list.find((g) => g.id === ui.guide) : null;
    const room = ui.page === 'lead' ? findLead(ui.lead) : null;
    const [title, sub] = ui.page === 'settings' ? ['설정', '']
      : ui.page === 'lead' ? [room?.label || '팀장', '']
      : ui.page === 'guides' ? ['가이드', '어떻게 맡기고 어떻게 말하면 되는지, 업무별로 볼 수 있습니다']
        : ui.page === 'guide' ? [guide?.title || '가이드', '']
        : ui.page === 'teamguide' ? [`${findLead(ui.teamGuide)?.name || '팀'} 사용법`, '']
          : ui.page === 'guidecheck' ? ['업무 예시 점검', '예시가 빠진 업무와 다시 볼 예시를 모았습니다. 여기서는 아무것도 실행하지 않습니다.']
      : ui.page === 'reports' ? ['처리 이력', '맡긴 업무의 건별 결과와 처리 이력']
        : ui.page === 'report' ? [`보고 · ${batch?.title || ''}`, '']
          : ui.page === 'reconcile' ? ['발송 결과 확인', '보낸 직후 끊겨 결과를 알 수 없는 발송입니다. 여기서 여는 것만으로는 아무것도 보내지 않습니다.']
            : entry ? [entry.title, ''] : ['새 대화', ''];
    $('chTitle').textContent = title; $('chSub').textContent = sub; $('chSub').hidden = !sub;
    let actions = '';
    if (entry) {
      const latest = convRuns(entry).at(-1);
      actions = chip(entry.status)
        + (latest && BUSY.includes(latest.status) ? `<button type="button" class="btn btn-sm" data-stop="${esc(latest.id)}" data-key="ch-stop">중지</button>` : '')
        + (entry.kind === 'item' && ['waiting', 'needs', 'failed', 'stopped'].includes(entry.status) ? `<button type="button" class="btn btn-sm btn-ghost" data-cancel="${esc(entry.id)}" data-key="ch-cancel">업무 취소</button>` : '');
    } else if (['reports', 'report', 'guidecheck'].includes(ui.page)) actions = `<button type="button" class="btn btn-sm btn-ghost" data-page="${ui.page === 'report' ? 'reports' : 'settings'}" data-key="ch-up">‹ ${ui.page === 'report' ? '처리 이력' : '설정'}</button>`;
    else if (ui.page === 'teamguide') actions = `<button type="button" class="btn btn-sm btn-ghost" data-guides-back data-key="ch-up">‹ 가이드</button>`;
    else if (ui.page === 'guide') actions = `<button type="button" class="btn btn-sm btn-ghost" data-guides-back data-key="ch-up">‹ 목록</button>`;
    else if (ui.page === 'guides' && ui.guideCtx !== 'new' && !ui.guideCtx.startsWith('lead:')) actions = `<button type="button" class="btn btn-sm btn-ghost" data-open-entry="${esc(ui.guideCtx)}" data-key="ch-up">‹ 대화로</button>`;
    setHTML($('chActions'), actions);
    const s = state();
    const ready = s.tools?.claude?.loggedIn === true || s.tools?.codex?.loggedIn === true;
    const probing = !s.tools || s.tools?.claude?.installed === null || s.tools?.codex?.installed === null;
    const noTeam = Array.isArray(s.departments) && s.departments.length === 0 && !s.demo;
    const notice = !['chat', 'lead'].includes(ui.page) || s.demo || probing ? '' : !ready ? '로그인된 AI 도구가 없어 업무를 시작할 수 없습니다. 터미널에서 Claude 또는 Codex에 로그인한 뒤 서버를 다시 켜 주세요.'
      : noTeam ? '일을 맡을 직원 구성이 아직 없습니다. <button type="button" class="link" data-view="team" data-key="notice-team">설정 › 직원 구성</button>에서 먼저 추가해 주세요.' : '';
    $('chNotice').hidden = !notice;
    setHTML($('chNotice'), notice);
  }

  // ── 대화 ──
  async function loadDetail(entry) {
    if (entry.kind !== 'item') return null;
    const sig = JSON.stringify(entry.batch), cached = ui.details.get(entry.batch.id);
    if (cached?.sig === sig) return cached.data;
    try { const data = await api('GET', `/api/batches/${encodeURIComponent(entry.batch.id)}`); ui.details.set(entry.batch.id, { sig, data }); return data; }
    catch { ui.details.set(entry.batch.id, { sig, data: null }); return null; }
  }
  // 끝난 실행의 답변 전문을 한 번씩만 가져온다
  async function loadResults(entry) {
    let loaded = false;
    for (const run of convRuns(entry)) {
      if (BUSY.includes(run.status)) continue;
      const key = `${run.id}:${run.status}:${run.endedAt || ''}`;
      if (ui.results.get(run.id)?.key === key) continue;
      try { const res = await authedGet(`/api/runs/${encodeURIComponent(run.id)}/result`); ui.results.set(run.id, { key, text: res.ok ? (await res.text()).trim() : '' }); loaded = true; }
      catch { ui.results.set(run.id, { key, text: '' }); }
    }
    return loaded;
  }
  // 완료한 업무의 최종 파일 목록(보고서 글은 대화에 이미 있으므로 뺀다)
  async function loadFiles(entry) {
    const latest = convRuns(entry).at(-1), task = latest?.task || entry.task;
    if (entry.status !== 'done' || !task) return false;
    const key = `${latest?.id || ''}:${latest?.endedAt || ''}`;
    if (ui.files.get(task)?.key === key) return false;
    try {
      const res = await authedGet(`/api/outputs/${encodeURIComponent(task)}/files`, 'application/json');
      const data = res.ok ? await res.json() : null;
      ui.files.set(task, { key, list: (data?.final?.files || []).filter((f) => !(f.name.startsWith('비서실장-보고') && f.name.endsWith('.md'))) });
    } catch { ui.files.set(task, { key, list: [] }); }
    return true;
  }
  const fileCards = (task) => {
    const list = ui.files.get(task)?.list;
    if (!list) return '<p class="fc-note">파일을 확인하고 있습니다…</p>';
    return `${list.length ? `<ul class="fc-list" aria-label="받은 파일">${list.map((f, i) => `<li class="fc"><span class="fc-ic" aria-hidden="true">📄</span><span class="fc-name" title="${esc(f.rel || f.name)}">${esc(f.name)}</span><span class="fc-size">${esc(sizeText(f.size))}</span>
      <button type="button" class="btn btn-sm btn-primary" data-dl="${i}" data-task="${esc(task)}" data-key="dl-${i}" aria-label="${esc(f.name)} 받기">받기</button></li>`).join('')}</ul>` : ''}
      <button type="button" class="link fc-more" data-completion="${esc(task)}" data-key="fc-open">${list.length ? '미리 보기 · 저장 폴더 열기' : '완료 보고 자세히 보기'}</button>`;
  };
  const bubble = (m, entry, lead = leadOf(entry)) => `<article class="wm wm-${m.role}${m.tone ? ` tone-${m.tone}` : ''}">${avatar(m.role, lead && m.role === 'ai' ? initial(lead) : '')}<div class="wm-main"><header class="wm-head"><strong>${esc(lead && m.role === 'ai' ? lead.label : m.who)}</strong><time>${esc(time(m.at))}</time>${m.tone === 'question' ? '<span class="wm-tag tag-warn">답변 필요</span>' : m.tone === 'done' ? '<span class="wm-tag tag-ok">완료</span>' : ''}</header>
      <div class="wm-text"${m.tone === 'live' ? ' role="status"' : ''}>${m.tone === 'live' ? '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span> ' : ''}${m.role === 'ai' && m.tone && m.tone !== 'live' ? richText(m.text, esc) : esc(m.text)}</div>
      ${m.deliver ? fileCards(convRuns(entry).at(-1)?.task || entry.task) : ''}</div></article>`;
  const pendingHTML = (ctx) => ui.pending.filter((p) => p.ctx === ctx).map((p) => `<article class="wm wm-me is-pending">${avatar('me')}<div class="wm-main"><header class="wm-head"><strong>나</strong><time>${esc(time(p.at))}</time></header><div class="wm-text">${esc(p.text)}</div>
      <p class="wm-sending${p.error ? ' is-error' : ''}" role="status">${p.error ? esc(p.error) : `<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span> ${ctx === 'new' ? 'AI 비서가 확인하고 있습니다…' : ctx.startsWith('lead:') ? '전달하고 있습니다…' : '보내는 중…'}`}</p></div></article>`).join('');
  const noticeHTML = (ctx) => ui.notices.filter((n) => n.ctx === ctx).map((n) => `<article class="wm wm-ai">${avatar('ai')}<div class="wm-main"><header class="wm-head"><strong>${AI_NAME}</strong><time>${esc(time(n.at))}</time></header><div class="wm-text">${esc(n.text)}</div></div></article>`).join('');
  const EVENT_LABEL = { accepted: '접수', started: '시작', resumed: '재개', needs: '답변 필요로 보류', stopped: '중지', paused: '일시정지', failed: '실패', done: '완료', canceled: '취소', 'resume-queued': '답글 접수(재개 예약)', unpaused: '일시정지 해제', requeued: '대기로 복귀', 'wait-alert': '대기 알림' };
  function chatHTML(entry, detail) {
    const full = detail?.items?.find((i) => i.id === entry.id) || null;
    const latest = convRuns(entry).at(-1) || null;
    const results = Object.fromEntries([...ui.results].map(([id, r]) => [id, r.text]));
    const messages = threadMessages({ entry, prompt: full?.prompt || null, runs: state().runs, feed: state().feed, results });
    const before = entry.kind === 'item' ? (entry.item.dependsOn || []).map((no) => entry.batch.items.find((i) => i.no === no)).filter(Boolean) : [];
    const multi = entry.kind === 'item' && entry.batch.total > 1;
    return `<div class="cv">
      ${entry.item?.via === 'terminal' ? '<p class="cv-line">터미널의 Claude·Codex에게 말해서 맡긴 업무입니다. 여기서 이어서 답해도 됩니다.</p>' : ''}
      ${multi ? `<p class="cv-line">한 번에 맡긴 ${entry.batch.total}건 중 ${entry.item.no}번째 · <button type="button" class="link" data-report="${esc(entry.batch.id)}" data-key="cv-report">전체 결과 보기</button></p>` : ''}
      ${before.length ? `<p class="cv-line">앞 업무: ${before.map((d) => `<button type="button" class="link" data-open-entry="${esc(d.id)}" data-key="dep-${esc(d.id)}">${esc(d.title)}</button> (${esc(ITEM_LABEL[d.status])})`).join(', ')}</p>` : ''}
      ${messages.map((m, i) => bubble(m, entry) + (i === 0 && full?.attachments?.length ? `<p class="cv-attach">${full.attachments.map((p) => `<span title="${esc(p)}">📎 ${esc(p.split('/').at(-1))}</span>`).join(' ')}</p>` : '')).join('')}
      ${noticeHTML(entry.id)}${pendingHTML(entry.id)}
      ${full || latest ? `<details class="cv-details" data-keep-open="info"><summary data-key="cv-sum">자세히</summary>
        ${full ? `<p class="cv-line">접수 번호 ${esc(entry.id)} · ${esc(usageText(full.usage))}</p><ol class="th-events">${(full.events || []).map((e) => `<li><time>${esc(time(e.at))}</time> ${esc(EVENT_LABEL[e.type] || e.type)}</li>`).join('')}</ol>` : ''}
        ${latest ? `<button type="button" class="btn btn-sm btn-ghost" data-thread="${esc(latest.id)}" data-key="cv-log">실행 기록 보기</button>` : ''}</details>` : ''}
    </div>`;
  }
  const newChatHTML = () => (ui.pending.some((p) => p.ctx === 'new') || ui.notices.some((n) => n.ctx === 'new')
    ? `<div class="cv">${noticeHTML('new')}${pendingHTML('new')}</div>`
    : `<div class="cv"><div class="ch-empty"><p class="ch-empty-title">어떤 일을 맡기시겠어요?</p><p>아래에 맡길 일을 적어 보내면 대화가 하나 생깁니다. 진행 상황과 완료 보고, 만든 파일을 그 대화에서 바로 받습니다.</p>
        <p class="ch-empty-sub">여러 건은 <em>＋ 업무 추가</em>로 담아 한 번에 보내면 순서대로 한 건씩 처리합니다.</p></div>${ui.guides.list.length ? guideListHTML() : ''}</div>`);

  // ── 업무 예시(가이드) ── 열람·검색·복사·입력창 채우기는 저장된 파일만 읽는다(AI 호출·외부 전송 0회). 보내기 전에는 업무가 생기지 않는다
  async function loadGuides(force = false) {
    if (ui.guidesBusy || (!force && ui.guides.loaded && Date.now() - ui.guides.at < 30000)) return;
    ui.guidesBusy = true;
    try { const data = await api('GET', '/api/guides'); ui.guides = { list: data.guides || [], teams: data.teams || [], coverage: data.coverage || null, problems: data.problems || [], exists: data.exists === true, loaded: true, at: Date.now() }; }
    catch (error) { ui.guides = { ...ui.guides, loaded: true, at: Date.now(), error: error.message }; }
    ui.guidesBusy = false;
    if (view() === 'inbox' && (['guides', 'guide', 'guidecheck', 'teamguide', 'lead'].includes(ui.page) || (ui.page === 'chat' && !current()))) renderMain();
  }
  const guideCard = (g) => `<button type="button" class="gd-card" data-guide="${esc(g.id)}" data-key="guide-${esc(g.id)}"><strong>${esc(g.title)}</strong>${g.ready ? '' : '<span class="wm-tag">준비 중</span>'}${g.paused ? '<span class="wm-tag tag-warn">지금은 맡길 수 없음</span>' : ''}
        <span class="gd-sum">${esc(g.summary)}</span>${g.output ? `<span class="gd-out">받는 것: ${esc(g.output)}</span>` : ''}</button>`;
  // 검색 결과: 검색어가 없으면 팀별로 묶어 보여 준다
  function guideResultsHTML() {
    const q = ui.guideQ.trim(), found = searchGuides(ui.guides.list, q);
    const count = `<p class="gd-count" role="status">${q ? `"${esc(q)}" ${found.length}건` : `이런 일을 맡길 수 있어요 · ${found.length}건`}</p>`;
    if (!found.length) return `${count}<p class="cv-line">맞는 가이드가 없습니다. 가이드가 없어도 맡길 일을 그대로 적어 보내면 됩니다.</p>`;
    if (q) return `${count}<div class="gd-grid">${found.map(guideCard).join('')}</div>`;
    const groups = new Map();
    for (const g of found) { const name = g.dept?.name || '공통'; if (!groups.has(name)) groups.set(name, []); groups.get(name).push(g); }
    return count + [...groups].map(([name, list]) => `${groups.size > 1 ? `<h3 class="gd-group">${esc(name)}</h3>` : ''}<div class="gd-grid">${list.map(guideCard).join('')}</div>`).join('');
  }
  function guideListHTML() {
    return `<section class="gd" aria-label="업무 가이드">
      <label class="gd-search"><span class="sr-only">업무 이름으로 가이드 찾기</span><input type="search" data-guide-q data-keep="guide-q" data-key="guide-q" value="${esc(ui.guideQ)}" placeholder="업무 이름으로 찾기 — 예: 메일, 보고서, 집계" autocomplete="off"></label>
      <div id="gdResults">${guideResultsHTML()}</div></section>`;
  }
  // 가이드 페이지: 기본 사용법(프로그램 설명) + 업무별 가이드(회사 파일)
  const USAGE = [['일 맡기기', '새 대화에 맡길 일을 적어 보내거나, 왼쪽의 팀장을 골라 그 팀에 말합니다. 어느 팀 일인지 모르면 새 대화에 적으면 알아서 나눠 맡깁니다.'],
    ['진행 보기', '보내면 대화가 생기고 지금 하는 일이 한 줄로 보입니다. 끝나면 완료 보고가 올라옵니다.'],
    ['질문에 답하기', '확인할 것이 있으면 "답변 필요"로 멈춥니다. 그 대화에 답을 적어 보내면 같은 업무로 이어집니다.'],
    ['파일 받기', '완료 보고 아래 파일 카드의 "받기"를 누릅니다. 고칠 점은 같은 대화에 이어서 적어 보냅니다.'],
    ['여러 건 한 번에', '새 대화에서 "＋ 업무 추가"로 담아 한 번에 보내면 순서대로 한 건씩 처리합니다.'],
    ['메일·글 보내기', '보내기 직전에 받는 대상과 문안을 한 번 확인받습니다. 준비가 끝난 것과 실제로 보낸 것은 다릅니다.'],
    ['터미널에서 맡기기', '프로그램 폴더의 Claude·Codex에게 말해서 맡긴 업무도 이 목록에 "터미널에서 맡김"으로 생깁니다.']];
  // 팀별 사용법: 회사 파일에 적어 둔 것이 있으면 그것을, 없으면 팀 소개만으로 기본 안내를 보여 준다
  const teamOf = (id) => ui.guides.teams.find((t) => t.dept === id) || null;
  const BASIC_HOW = ['아래 입력창에 맡길 일을 평소 말하듯 적어 보냅니다.', '확인할 것이 있으면 팀장이 여기서 물어봅니다. 그대로 답하면 같은 업무로 이어집니다.', '끝나면 완료 보고와 파일이 이 방에 올라옵니다. 고칠 점은 이어서 말하면 됩니다.'];
  const teamCardsHTML = () => { const team = leads(); return team.length ? `<section class="gd gd-teams" aria-label="팀별 사용법"><p class="gd-count">팀별 사용법 · ${team.length}팀</p><div class="gd-grid">${team.map((l) => { const t = teamOf(l.id);
      return `<button type="button" class="gd-card" data-team-guide="${esc(l.id)}" data-key="team-${esc(l.id)}"><strong>${esc(l.name)}</strong><span class="gd-sum">${esc(t?.intro || l.summary || '이 팀에 맡길 일을 팀장에게 말하면 됩니다.')}</span>${t?.can?.length ? `<span class="gd-out">맡길 수 있는 일 ${t.can.length}가지</span>` : ''}</button>`; }).join('')}</div></section>` : ''; };
  function teamGuideHTML() {
    const lead = findLead(ui.teamGuide), t = teamOf(ui.teamGuide);
    if (!lead) return `<div class="cv"><p class="cv-line">${state().departments ? '이 팀을 찾지 못했습니다.' : '불러오는 중…'}</p></div>`;
    const section = (title, items) => (items?.length ? `<h2 class="gd-h">${title}</h2><ul class="gd-list">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
    const cards = ui.guides.list.filter((g) => g.dept?.id === lead.id);
    return `<div class="cv gd-detail">
      <p class="gd-lead">${esc(t?.intro || lead.summary || '이 팀에 맡길 일을 팀장에게 말하면 됩니다.')}</p>
      <div class="row-actions"><button type="button" class="btn btn-primary" data-lead="${esc(lead.id)}" data-key="tg-open">${esc(lead.label)}에게 말하기</button></div>
      ${section('맡길 수 있는 일', t?.can)}${section('이렇게 맡기면 됩니다', t?.how?.length ? t.how : BASIC_HOW)}${section('미리 준비할 것', t?.prepare)}
      ${t?.examples?.length ? `<h2 class="gd-h">이렇게 말하면 됩니다</h2>${t.examples.map((ex, i) => `<article class="gd-ex"><header><strong>${esc(ex.label)}</strong></header><p class="gd-text">${esc(ex.text)}</p>
        <div class="row-actions"><button type="button" class="btn btn-primary" data-team-use="${i}" data-key="tg-use-${i}">${esc(lead.label)}에게 맡기기</button><button type="button" class="btn" data-team-copy="${i}" data-key="tg-copy-${i}">예시 복사</button></div></article>`).join('')}` : ''}
      ${section('알아 둘 것', t?.notes)}
      ${cards.length ? `<h2 class="gd-h">이 팀의 업무별 가이드</h2><div class="gd-grid">${cards.map(guideCard).join('')}</div>` : ''}
      <p class="cv-line gd-foot">예시의 [대괄호] 부분만 바꿔 쓰면 됩니다. 넣은 뒤 보내기를 눌러야 접수됩니다.${t?.reviewed ? ` · 마지막 검토 ${esc(t.reviewed)}` : ''}</p></div>`;
  }
  // 팀장 방 맨 위의 기본 가이드: 맡길 수 있는 일, 맡기는 방법, 바로 눌러 쓸 말 예시
  function basicGuideHTML(lead, open) {
    const t = teamOf(lead.id);
    return `<details class="ld-basic" data-keep-open="basic-${esc(lead.id)}"${open ? ' open' : ''}><summary data-key="ld-basic">기본 가이드</summary>
      ${t?.can?.length ? `<h3 class="ld-h">맡길 수 있는 일</h3><ul class="gd-list">${t.can.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <h3 class="ld-h">이렇게 맡기면 됩니다</h3><ul class="gd-list">${(t?.how?.length ? t.how : BASIC_HOW).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${t?.examples?.length ? `<h3 class="ld-h">눌러서 입력창에 넣기</h3><div class="ld-chips">${t.examples.map((ex, i) => `<button type="button" class="ld-chip" data-team-use="${i}" data-team-id="${esc(lead.id)}" data-key="ld-ex-${i}" title="${esc(ex.text)}">${esc(ex.label)}</button>`).join('')}</div>` : ''}
      ${t?.notes?.length ? `<h3 class="ld-h">알아 둘 것</h3><ul class="gd-list">${t.notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <button type="button" class="link ld-more" data-team-guide="${esc(lead.id)}" data-key="ld-more">이 팀 사용법 자세히 보기</button></details>`;
  }
  function useTeamExample(deptId, index, copy = false) {
    const lead = findLead(deptId), ex = teamOf(deptId)?.examples?.[index];
    if (!lead || !ex) return undefined;
    if (copy) return navigator.clipboard.writeText(ex.text).then(() => toast('예시를 복사했어요.'), () => toast('복사하지 못했어요. 예시 글을 직접 골라 복사해 주세요.', { type: 'error' }));
    if (ui.ctx !== undefined) store(`ai-office-draft-${ui.ctx}`, $('composerText').value);
    store(`ai-office-draft-lead:${lead.id}`, appendDraft(store(`ai-office-draft-lead:${lead.id}`), ex.text));
    ui.ctx = undefined;
    if (ui.page === 'lead' && ui.lead === lead.id) render(); else go({ page: 'lead', lead: lead.id }, { replace: true });
    const text = $('composerText');
    autoGrow(text); text.focus();
    const m = /\[[^\]\n]+\]/.exec(text.value);
    if (m) text.setSelectionRange(m.index, m.index + m[0].length);
    return undefined;
  }
  const guidesPageHTML = () => `<div class="cv"><details class="gd-usage" data-keep-open="usage"${ui.guides.list.length || ui.guides.teams.length ? '' : ' open'}><summary data-key="gd-usage">기본 사용법</summary><dl class="gd-dl">${USAGE.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl></details>
      ${teamCardsHTML()}
      ${ui.guides.list.length ? guideListHTML() : `<p class="cv-line">${ui.guides.loaded ? '아직 등록한 업무 가이드가 없습니다. 업무별 가이드는 작업 공간의 org/guides.json 파일에 둡니다.' : '불러오는 중…'}</p>`}</div>`;
  function guideHTML() {
    const g = ui.guides.list.find((x) => x.id === ui.guide);
    if (!g) return `<div class="cv"><p class="cv-line">${ui.guides.loaded ? '이 예시를 찾지 못했습니다.' : '불러오는 중…'}</p></div>`;
    const inChat = ui.guideCtx !== 'new' && !ui.guideCtx.startsWith('lead:') ? findEntry(ui.guideCtx) : null;
    const boss = findLead(ui.guideCtx.startsWith('lead:') ? ui.guideCtx.slice(5) : g.dept?.id);
    const section = (title, items) => (items.length ? `<h2 class="gd-h">${title}</h2><ul class="gd-list">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');
    return `<div class="cv gd-detail">
      ${g.summary ? `<p class="gd-lead">${esc(g.summary)}</p>` : ''}
      ${g.paused ? '<p class="ch-notice gd-note">이 업무를 맡는 쪽이 지금 쉬고 있어 바로 진행되지 않을 수 있습니다.</p>' : ''}
      ${g.output ? `<h2 class="gd-h">받는 것</h2><p class="gd-p">${esc(g.output)}</p>` : ''}
      ${section('시작 전에 준비할 것', g.prepare)}${section('이렇게 진행됩니다', g.steps)}
      ${g.done ? `<h2 class="gd-h">완료 확인과 다음 행동</h2><p class="gd-p">${esc(g.done)}</p>` : ''}
      <h2 class="gd-h">이렇게 말하면 됩니다</h2>
      ${g.ready ? g.examples.map((ex, i) => `<article class="gd-ex"><header><strong>${esc(ex.label)}</strong>${ex.kind === 'reply' ? '<span class="wm-tag">진행 중인 대화에 보내는 답글</span>' : ''}</header><p class="gd-text">${esc(ex.text)}</p>
        <div class="row-actions">${ex.kind === 'reply'
          ? (inChat ? `<button type="button" class="btn btn-primary" data-use="${i}" data-to="chat" data-key="use-${i}">이 대화에 답글로 넣기</button>` : '')
          : `${boss ? `<button type="button" class="btn btn-primary" data-use="${i}" data-to="lead" data-lead-id="${esc(boss.id)}" data-key="lead-use-${i}">${esc(boss.label)}에게 맡기기</button>` : ''}<button type="button" class="btn${boss ? '' : ' btn-primary'}" data-use="${i}" data-to="new" data-key="use-${i}">새 대화에 넣기</button>`}
          <button type="button" class="btn" data-copy="${i}" data-key="copy-${i}">예시 복사</button></div></article>`).join('') : '<p class="cv-line">예시를 준비하고 있습니다. 맡길 일을 그대로 적어 보내도 됩니다.</p>'}
      <p class="cv-line gd-foot">예시의 [대괄호] 부분만 바꿔 쓰면 됩니다. 넣은 뒤 보내기를 눌러야 접수됩니다.${g.reviewed ? ` · 마지막 검토 ${esc(g.reviewed)}` : ''}</p></div>`;
  }
  function guideCheckHTML() {
    const c = ui.guides.coverage;
    const block = (title, rows) => `<h2 class="gd-h">${title} ${rows.length}건</h2><p class="gd-p">${rows.length ? rows.map((r) => esc(r.title || r.name || r)).join(', ') : '없음'}</p>`;
    if (!ui.guides.loaded || !c) return `<div class="cv"><p class="${ui.guides.error ? 'ch-error' : 'cv-line'}">${esc(ui.guides.error || '불러오는 중…')}</p></div>`;
    return `<div class="cv gd-detail">
      <p class="gd-lead">예시 ${ui.guides.list.length}건${ui.guides.exists ? '' : ' — 아직 예시 파일이 없습니다'}</p>
      <p class="cv-line">예시 문구는 작업 공간의 <code>org/guides.json</code> 파일에 둡니다(회사 자료라 프로그램에 넣지 않습니다). 파일을 고치면 다음에 열 때 반영됩니다.</p>
      ${ui.guides.problems.length ? `<h2 class="gd-h">파일에서 고칠 곳 ${ui.guides.problems.length}건</h2><ul class="gd-list">${ui.guides.problems.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${block('사용법이 없는 팀', c.teamsWithout || [])}
      ${block('예시가 없는 직원', c.agentsWithout)}
      ${block('예시가 없는 고정 절차', c.recipesWithout)}
      <h2 class="gd-h">연결이 끊긴 예시 ${c.broken.length}건</h2>${c.broken.length ? `<ul class="gd-list">${c.broken.map((r) => `<li>${esc(r.title)} — ${esc(r.reason)}</li>`).join('')}</ul>` : '<p class="gd-p">없음</p>'}
      ${block('준비 중인 예시', c.notReady)}
      ${block('검토일이 없는 예시', c.unreviewed)}</div>`;
  }
  // 예시를 입력창에 넣는다(보내지는 않는다). 새 대화에 쓰던 글이 있으면 그 글은 "한 번에 보낼 업무"로 담아 두고 예시를 새로 쓴다
  function useExample(index, to, leadId) {
    const g = ui.guides.list.find((x) => x.id === ui.guide), ex = g?.examples?.[index];
    if (!ex) return;
    if (ui.ctx !== undefined) store(`ai-office-draft-${ui.ctx}`, $('composerText').value);
    if (to === 'lead') {
      const lead = findLead(leadId);
      if (!lead) { toast('그 팀을 찾지 못했어요. 새 대화에 넣어 주세요.', { type: 'warn' }); return; }
      store(`ai-office-draft-lead:${lead.id}`, appendDraft(store(`ai-office-draft-lead:${lead.id}`), ex.text));
      ui.ctx = undefined; go({ page: 'lead', lead: lead.id }, { replace: true });
    } else if (to === 'chat') {
      const entry = findEntry(ui.guideCtx);
      if (!entry || composeMode(entry, convRuns(entry).at(-1)).mode === 'off') { toast('이 대화에는 지금 보낼 수 없어요. 예시를 복사해 두었다가 쓰세요.', { type: 'warn' }); return; }
      store(`ai-office-draft-${entry.id}`, appendDraft(store(`ai-office-draft-${entry.id}`), ex.text));
      ui.ctx = undefined; go({ page: 'chat', open: entry.id }, { replace: true });
    } else {
      const draft = (store('ai-office-draft-new') || '').trim();
      if (draft && ui.queue.length < COMPOSE_LIMITS.items) { ui.queue.push({ text: draft, files: ui.attached, dep: false }); ui.attached = []; saveComposer(); toast('쓰던 업무는 "한 번에 보낼 업무"로 담아 두었어요.'); }
      store('ai-office-draft-new', ex.text);
      ui.ctx = undefined; go({ page: 'chat', open: null }, { replace: true });
    }
    const text = $('composerText');
    autoGrow(text); text.focus();
    // 바꿀 자리([…])가 있으면 첫 자리를 골라 둔다
    const m = /\[[^\]\n]+\]/.exec(text.value);
    if (m) text.setSelectionRange(m.index, m.index + m[0].length);
  }
  async function copyExample(index) {
    const ex = ui.guides.list.find((x) => x.id === ui.guide)?.examples?.[index];
    if (!ex) return;
    try { await navigator.clipboard.writeText(ex.text); toast('예시를 복사했어요.'); }
    catch { toast('복사하지 못했어요. 예시 글을 직접 골라 복사해 주세요.', { type: 'error' }); }
  }

  // ── 팀장 방: 그 팀에 맡긴 업무가 한 대화로 이어진다 ──
  function leadHTML(lead) {
    const mine = leadEntries(lead.id).slice(-15), ctx = `lead:${lead.id}`;
    const results = Object.fromEntries([...ui.results].map(([id, r]) => [id, r.text]));
    const cards = ui.guides.list.filter((g) => g.dept?.id === lead.id);
    return `<div class="cv">
      <div class="ld-intro"><span class="ld-av" aria-hidden="true">${esc(initial(lead))}</span><div><strong>${esc(lead.label)}</strong>${lead.boss ? `<span class="ld-boss">${esc(lead.boss)}</span>` : ''}
        <p>${esc(lead.summary || '이 팀에 맡길 일을 말해 주세요.')}</p><p class="ld-hint">오늘 할 일을 아래에 적어 보내면 이 팀이 맡아 진행하고, 여기로 보고합니다.</p></div></div>
      ${basicGuideHTML(lead, !mine.length)}
      ${cards.length ? `<section class="gd ld-guides" aria-label="업무별 가이드"><p class="gd-count">업무별 가이드 · ${cards.length}건</p><div class="gd-grid">${cards.map(guideCard).join('')}</div></section>` : ''}
      ${mine.map((e) => { const full = ui.details.get(e.batch?.id)?.data?.items?.find((i) => i.id === e.id) || null;
        return `<section class="ld-task" aria-label="${esc(e.title)}"><p class="ld-line">${chip(e.status)}<time>${esc(time(e.at))}</time><button type="button" class="link" data-open-entry="${esc(e.id)}" data-key="ld-open-${esc(e.id)}">이 업무만 보기</button></p>
          ${threadMessages({ entry: e, prompt: full?.prompt || null, runs: state().runs, feed: state().feed, results }).map((m) => bubble(m, e, lead)).join('')}</section>`; }).join('')}
      ${noticeHTML(ctx)}${pendingHTML(ctx)}</div>`;
  }

  // ── 설정 ──
  function settingsHTML() {
    const row = (attr, title, desc) => `<button type="button" class="set-row" ${attr}><span class="set-main"><strong>${esc(title)}</strong><span>${esc(desc)}</span></span><span class="set-go" aria-hidden="true">›</span></button>`;
    return `<div class="cv set">
      <h2 class="set-title">업무</h2>
      ${row('data-open="schedules" data-key="set-schedules"', '예약 업무', '정한 시각에 시작할 업무를 등록하고 고칩니다')}
      ${row('data-page="reports" data-key="set-reports"', '처리 이력', '맡긴 업무의 건별 결과, 걸린 시간, 처리 이력 내려받기')}
      ${row('data-page="guidecheck" data-key="set-guides"', '업무 예시 점검', '새 대화에 보이는 업무 예시 가운데 빠졌거나 다시 볼 것')}
      <h2 class="set-title">연결</h2>
      ${row('data-open="connections" data-key="set-connections"', '계정 연결', '메일·카페·블로그·웹사이트 로그인을 연결합니다')}
      <h2 class="set-title">AI 구성</h2>
      ${row('data-view="team" data-key="set-team"', '직원 구성', '일을 나눠 맡는 AI 직원과 지침을 고칩니다. 평소에는 열 일이 없습니다')}
      ${row('data-open="company" data-key="set-company"', '회사 설정', '공통 규칙, 결과 저장 위치, 업무 예산')}
      <h2 class="set-title">화면</h2>
      ${row('data-open="notify" data-key="set-notify"', deps.notifyOn?.() ? '알림 끄기' : '알림 켜기', '답변이 필요하거나 업무가 끝나면 브라우저 알림으로 알려 줍니다')}
      ${row('data-open="theme" data-key="set-theme"', `화면 테마: ${deps.themeLabel?.() || ''}`, '누를 때마다 다음 테마로 바뀝니다')}
    </div>`;
  }
  const reportsHTML = () => {
    const list = [...(state().batches || [])].reverse();
    return `<div class="cv">${list.length ? list.map((b) => `<button type="button" class="set-row" data-report="${esc(b.id)}" data-key="report-${esc(b.id)}"><span class="set-main"><strong>${esc(b.title)}</strong><span>${esc(time(b.createdAt))} · ${b.total}건 · ${esc(countsText(b))}</span></span><span class="set-go" aria-hidden="true">›</span></button>`).join('') : '<p class="cv-line">아직 처리한 업무가 없습니다.</p>'}</div>`;
  };

  // ── 발송 결과 확인 ──
  async function loadReconcile(force = false) {
    const pending = state().reconcilePending || 0;
    if (!force && ui.reconcile.loaded && ui.reconcile.count === pending) return;
    try { const data = await api('GET', '/api/reconcile'); ui.reconcile = { items: data.items || [], loaded: true, count: pending }; }
    catch (error) { ui.reconcile = { items: [], loaded: true, count: pending, error: error.message }; }
    if (ui.page === 'reconcile') renderMain();
  }
  function reconcileHTML() {
    if (!ui.reconcile.loaded || ui.reconcile.count !== (state().reconcilePending || 0)) loadReconcile();
    const items = ui.reconcile.items;
    return `<div class="cv">${items.length ? items.map((it) => `<article class="rec" aria-label="발송 확인 ${esc(it.target || '')}">
        <dl class="rec-dl"><dt>대상</dt><dd>${esc({ mail: '메일', post: '글', comment: '댓글', web: '웹사이트 작업' }[it.action] || it.action || '')} · ${esc(it.target || '')}</dd>
          <dt>승인된 문안</dt><dd>버전 ${esc(it.version || '-')}${it.run ? ` · <button type="button" class="link" data-thread="${esc(it.run)}" data-key="rec-thread-${esc(it.id)}">이 업무의 문안·대화 보기</button>` : ''}</dd>
          <dt>시도</dt><dd>${it.attempt}번째 · ${esc(time(it.attemptAt))}</dd>
          <dt>관측된 결과</dt><dd>${esc(it.evidence?.resultUrl || it.evidence?.readbackError || it.evidence?.summary || '확인된 증표 없음')}</dd>
          ${it.decision ? `<dt>결정</dt><dd>${esc(it.decision.decision === 'resend' ? '새 발송 승인' : '발송 확인')} — 업무가 다시 진행되면 반영됩니다</dd>` : ''}</dl>
        ${it.decision ? '' : `<label class="rec-field">근거(확인한 증표 또는 미발송 근거)<input type="text" maxlength="500" data-keep="rec-basis-${esc(it.id)}" data-key="rec-basis-${esc(it.id)}" placeholder="예: 보낸메일함에 10:02 발송 확인 / 게시판에 글 없음"></label>
        <div class="row-actions"><button type="button" class="btn" data-rec="${esc(it.id)}" data-decision="confirm" data-attempt="${it.attempt}" data-key="rec-confirm-${esc(it.id)}">발송 확인(이미 보내짐)</button>
          <button type="button" class="btn" data-rec="${esc(it.id)}" data-decision="hold" data-attempt="${it.attempt}" data-key="rec-hold-${esc(it.id)}">확인 보류</button>
          <label class="inline rec-check"><input type="checkbox" data-keep="rec-sure-${esc(it.id)}" data-key="rec-sure-${esc(it.id)}"> 보내지지 않은 것을 직접 확인했습니다</label>
          <button type="button" class="btn btn-danger" data-rec="${esc(it.id)}" data-decision="resend" data-attempt="${it.attempt}" data-key="rec-resend-${esc(it.id)}">새 발송 승인(다시 보냄)</button></div>`}
      </article>`).join('') : `<p class="${ui.reconcile.error ? 'ch-error' : 'cv-line'}">${esc(ui.reconcile.error || (ui.reconcile.loaded ? '지금 확인할 발송이 없습니다.' : '불러오는 중…'))}</p>`}</div>`;
  }
  async function decideReconcile(button) {
    const id = button.dataset.rec, decision = button.dataset.decision, box = $('chBody');
    const basis = box.querySelector(`[data-keep="rec-basis-${CSS.escape(id)}"]`)?.value.trim() || '';
    if (decision !== 'hold' && !basis) { toast('근거를 적어 주세요.', { type: 'error' }); return; }
    if (decision === 'resend' && !box.querySelector(`[data-keep="rec-sure-${CSS.escape(id)}"]`)?.checked) { toast('보내지지 않은 것을 직접 확인했는지 체크해 주세요. 새 발송은 실제로 다시 보냅니다.', { type: 'error' }); return; }
    button.disabled = true;
    try {
      const out = await api('POST', `/api/reconcile/${encodeURIComponent(id)}`, { decision, basis, attempt: Number(button.dataset.attempt) });
      toast(out.note || { confirm: '발송 확인으로 기록했어요. 업무를 이어서 진행합니다.', hold: '확인 보류로 남겼어요.', resend: '새 발송을 승인했어요. 이 업무가 이어서 진행되며 한 번 다시 보냅니다.' }[decision]);
    } catch (error) { toast(error.message, { type: 'error' }); }
    finally { button.disabled = false; await loadReconcile(true); await refresh(); }
  }

  // ── 묶음 보고 ──
  function reportHTML(batch) {
    const sig = JSON.stringify(batch), cached = ui.reports.get(batch.id);
    if (cached?.sig !== sig && !cached?.loading) {
      ui.reports.set(batch.id, { ...cached, loading: true });
      api('GET', `/api/batches/${encodeURIComponent(batch.id)}/report`).then((report) => ui.reports.set(batch.id, { sig, report }), (error) => ui.reports.set(batch.id, { sig, report: cached?.report || null, error: error.message }))
        .then(() => { if (ui.page === 'report' && ui.report === batch.id) renderMain(); });
    }
    const report = cached?.report;
    if (!report) return `<div class="cv cv-wide"><p class="${cached?.error ? 'ch-error' : 'cv-line'}">${esc(cached?.error || '보고를 불러오는 중…')}</p></div>`;
    return `<div class="cv cv-wide">
      <div class="th-meta">${chip(report.complete ? 'done' : report.settled ? 'needs' : 'running', report.complete ? '모두 끝남' : report.settled ? '확인 필요' : '진행 중')}<span class="th-id">${esc(report.id)} · ${esc(time(report.createdAt))} 접수 · 전체 ${report.total}건</span></div>
      <p class="rep-sum" role="status">${esc(countsText(report))}${report.saveFailed ? ' · <strong class="ch-error">보고 반영 실패(업무 결과는 그대로입니다)</strong>' : ''}</p>
      <div class="rep-wrap"><table class="rep-table"><thead><tr><th scope="col">번호</th><th scope="col">업무</th><th scope="col">상태</th><th scope="col">결과 또는 사유</th><th scope="col">다음 행동</th></tr></thead><tbody>
        ${report.rows.map((row) => `<tr><td>${row.no}</td><th scope="row"><button type="button" class="link" data-open-entry="${esc(row.id)}" data-key="row-${esc(row.id)}">${esc(row.title)}</button></th><td>${chip(row.status)}</td>
          <td>${esc(row.result)}${row.outputs?.folder ? `<br><button type="button" class="link" data-completion="${esc(row.task)}" data-key="out-${esc(row.id)}">파일 열기</button>` : ''}</td><td>${esc(row.next)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="cv-line">${esc(usageText(report.usage))}${batch.budget ? ` · 묶음 예산 ${batch.budget.usedCalls}/${batch.budget.limitCalls}회` : ''}</p>
      <div class="row-actions"><button type="button" class="btn" data-csv="${esc(report.id)}" data-key="csv">처리 이력 내려받기(CSV)</button>
        ${batch.budget ? `<label class="rep-inline">예산 늘리기 <input type="number" min="1" max="500" value="${batch.budget.limitCalls}" data-keep="budget-add" data-key="budget-add" aria-label="늘릴 AI 호출 수">회</label><button type="button" class="btn" data-budget="${esc(report.id)}" data-key="budget-btn">늘리기</button>` : ''}</div>
      <details class="cv-details" data-keep-open="times"><summary data-key="sum-times">대기·작업 시간</summary><ul class="th-events">${report.rows.map((row) => `<li>${row.no}. ${esc(row.title)} — 차례 대기 ${mins(row.times.slotWaitMs)} · 앞 업무 결과 대기 ${mins(row.times.depWaitMs)} · 내 답변 대기 ${mins(row.times.humanWaitMs)} · 실제 작업 ${mins(row.times.workMs)}</li>`).join('')}</ul></details>
      ${report.card?.revisions?.length > 1 ? `<details class="cv-details" data-keep-open="rev"><summary data-key="sum-rev">확정 이력 ${report.card.revisions.length}건</summary><ol class="th-events">${report.card.revisions.map((r) => `<li><time>${esc(time(r.at))}</time> ${esc(countsText({ counts: r.counts }))}</li>`).join('')}</ol></details>` : ''}</div>`;
  }
  async function downloadCsv(id) {
    try {
      const res = await authedGet(`/api/batches/${encodeURIComponent(id)}/history.csv`, 'text/csv');
      if (!res.ok) throw new Error('처리 이력을 내려받지 못했어요.');
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: `${id}-처리이력.csv` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (error) { toast(error.message, { type: 'error' }); }
  }

  // ── 오른쪽 본문 ──
  async function renderMain() {
    const body = $('chBody'), entry = current();
    renderHead(entry);
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 120;
    const paint = (html, follow) => { if (setHTML(body, html) && follow && (ui.stick || nearBottom)) body.scrollTop = body.scrollHeight; };
    syncComposer();
    if (['guides', 'guide', 'guidecheck', 'teamguide'].includes(ui.page) || (ui.page === 'chat' && !entry)) loadGuides();
    if (ui.page === 'guides') return paint(guidesPageHTML());
    if (ui.page === 'lead') {
      const lead = findLead(ui.lead);
      if (!lead) return paint('<div class="cv"><p class="cv-line">이 팀을 찾지 못했습니다. 설정 › 직원 구성에서 확인해 주세요.</p></div>');
      loadGuides();
      paint(leadHTML(lead), true);
      const mine = leadEntries(lead.id).slice(-15);
      if (view() === 'inbox' && (!narrow() || ui.pane === 'main') && !document.hidden) mine.forEach(markSeen);
      const loaded = (await Promise.all(mine.flatMap((e) => [loadDetail(e), loadResults(e), loadFiles(e)]))).some(Boolean);
      if (loaded && ui.page === 'lead' && ui.lead === lead.id) paint(leadHTML(lead), true);
      ui.stick = false;
      return undefined;
    }
    if (ui.page === 'guide') return paint(guideHTML());
    if (ui.page === 'teamguide') return paint(teamGuideHTML());
    if (ui.page === 'guidecheck') return paint(guideCheckHTML());
    if (ui.page === 'settings') return paint(settingsHTML());
    if (ui.page === 'reports') return paint(reportsHTML());
    if (ui.page === 'reconcile') return paint(reconcileHTML());
    if (ui.page === 'report') { const batch = (state().batches || []).find((b) => b.id === ui.report); return paint(batch ? reportHTML(batch) : '<div class="cv"><p class="cv-line">보고를 찾지 못했습니다.</p></div>'); }
    if (!entry) { paint(newChatHTML(), true); ui.stick = false; return undefined; }
    paint(chatHTML(entry, ui.details.get(entry.batch?.id)?.data), true);
    if (view() === 'inbox' && (!narrow() || ui.pane === 'main') && !document.hidden) markSeen(entry);
    const loaded = await Promise.all([loadDetail(entry), loadResults(entry), loadFiles(entry)]);
    const again = current();
    if (again && again.id === entry.id && loaded.some(Boolean)) paint(chatHTML(again, ui.details.get(again.batch?.id)?.data), true);
    ui.stick = false;
    return undefined;
  }

  // ── 입력창 ──
  function autoGrow(el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 220)}px`; }
  // 입력란은 다시 그리지 않는다. 대화를 옮기면 그 대화에서 쓰던 글을 되살린다
  function where() {
    if (ui.page === 'lead') {
      const lead = findLead(ui.lead);
      if (lead) {
        const ask = leadReplyTarget(leadEntries(lead.id)), latest = ask ? convRuns(ask).at(-1) : null;
        if (ask && latest && latest.canReply !== false) return { ctx: `lead:${lead.id}`, lead, entry: ask, latest, mode: 'reply', hint: '답하면 방금 그 업무로 이어서 진행합니다', placeholder: '답변을 적어 보내세요' };
        return { ctx: `lead:${lead.id}`, lead, entry: null, latest: null, mode: 'lead', hint: 'Enter로 보내기 · Shift+Enter로 줄바꿈', placeholder: `${lead.label}에게 맡길 일을 적어 보내세요 — 예: 오늘은 이 일부터 진행해 줘` };
      }
    }
    const entry = current(), latest = convRuns(entry).at(-1);
    return { ctx: entry?.id || 'new', lead: null, entry, latest, ...composeMode(entry, latest) };
  }
  function syncComposer() {
    const form = $('composer'), text = $('composerText');
    form.hidden = !['chat', 'lead'].includes(ui.page) || state().demo === true;
    if (form.hidden) return;
    const mode = where(), ctx = mode.ctx, fresh = ['new', 'lead'].includes(mode.mode);
    if (ui.ctx !== ctx) {
      if (ui.ctx !== undefined) store(`ai-office-draft-${ui.ctx}`, text.value);
      ui.ctx = ctx; text.value = store(`ai-office-draft-${ctx}`) || ''; autoGrow(text);
    }
    form.dataset.mode = mode.mode;
    text.disabled = mode.mode === 'off'; text.placeholder = mode.mode === 'off' ? mode.hint : mode.placeholder || '';
    $('composerSend').disabled = mode.mode === 'off' || ui.sending;
    $('composerAdd').hidden = mode.mode !== 'new';
    $('composerAttach').hidden = !fresh;
    // 대화 안에서는 "예시"로 보완 답글 예시를 찾아 넣을 수 있다(새 대화에서는 예시가 화면에 이미 보인다)
    $('composerGuide').hidden = fresh || mode.mode === 'off' || mode.lead || !ui.guides.list.length;
    const q = mode.mode === 'new' ? ui.queue : [];
    setHTML($('composerQueue'), q.map((item, i) => `<li class="cq-item"><span class="cq-no">${i + 1}</span><span class="cq-text">${esc(item.text.split('\n')[0])}${item.files.length ? ` <span class="wm-tag">첨부 ${item.files.length}</span>` : ''}</span>
      ${i > 0 ? `<label class="inline cq-dep"><input type="checkbox" data-dep="${i}" data-key="cq-dep-${i}"${item.dep ? ' checked' : ''}> ${i}번 결과를 받아서</label>` : ''}
      <button type="button" class="icon-btn" data-unqueue="${i}" data-key="cq-rm-${i}" aria-label="${i + 1}번 업무 빼기">✕</button></li>`).join(''));
    $('composerQueue').hidden = !q.length;
    const files = fresh ? ui.attached : [];
    setHTML($('composerFiles'), files.map((f, i) => `<li class="chief-file"><span class="chief-file-name" title="${esc(f.path)}">📄 ${esc(f.name)}</span><button type="button" class="chief-file-remove" data-unfile="${i}" data-key="cf-rm-${i}" aria-label="${esc(f.name)} 빼기">✕</button></li>`).join(''));
    $('composerFiles').hidden = !files.length;
    $('composerHint').textContent = q.length ? `${q.length}건을 담았습니다. 보내면 순서대로 한 건씩 처리합니다.` : mode.hint;
    $('composerSend').textContent = q.length ? `${q.length + (text.value.trim() ? 1 : 0)}건 보내기` : '보내기';
    $('composerAdd').disabled = q.length >= COMPOSE_LIMITS.items;
  }
  function queueCurrent() {
    const text = $('composerText').value.trim();
    if (!text) { $('composerText').focus(); toast('담을 업무를 먼저 적어 주세요.'); return; }
    ui.queue.push({ text, files: ui.attached, dep: false }); ui.attached = [];
    $('composerText').value = ''; store('ai-office-draft-new', ''); autoGrow($('composerText')); saveComposer(); syncComposer(); $('composerText').focus();
  }
  async function attach(files) {
    for (const file of files) {
      if (ui.attached.length >= COMPOSE_LIMITS.attachments) { toast(`첨부는 ${COMPOSE_LIMITS.attachments}개까지 붙일 수 있어요.`, { type: 'error' }); break; }
      try { ui.attached.push({ name: file.name, path: await upload(file) }); syncComposer(); }
      catch (error) { toast(`${file.name}: ${error.message} (이 파일만 다시 붙이면 됩니다)`, { type: 'error' }); }
    }
  }
  // 한 건 보내기의 결과: 새 대화가 생겼으면 그 대화를 열고, 업무가 아닌 지시(예약·일시정지 등)는 안내 말로 보여 준다
  function landRun(result, ctx) {
    if (result?.followUp) { ui.notices.push({ ctx, at: new Date().toISOString(), text: '진행 중인 업무에 전달했습니다.' }); return; }
    const made = result?.id ? entries().find((e) => e.run === (result.rootId || result.id)) : result?.queued ? findEntry(result.item) : null;
    if (made) { go({ page: 'chat', open: made.id }, { replace: true }); return; }
    ui.notices.push({ ctx, at: new Date().toISOString(), text: resultMessage(result) });
  }
  async function send(ev) {
    ev?.preventDefault();
    if (ui.sending) return;
    const { ctx, lead, entry, latest, mode } = where(), fresh = ['new', 'lead'].includes(mode);
    const text = $('composerText').value.trim();
    if (mode === 'off') return;
    if (!text && !(mode === 'new' && ui.queue.length)) { $('composerText').focus(); return; }
    ui.sending = true; $('composerSend').disabled = true;
    const many = mode === 'new' && ui.queue.length > 0;
    const items = many ? [...ui.queue, ...(text ? [{ text, files: ui.attached, dep: false }] : [])] : [{ text, files: fresh ? ui.attached : [] }];
    const pending = { id: Math.random().toString(36).slice(2), ctx, text: many ? `${items.length}건: ${items.map((i) => i.text.split('\n')[0]).join(' / ')}` : text, at: new Date().toISOString() };
    // 보내는 즉시 내 말을 보여 준다(접수 확인은 뒤따라온다)
    ui.pending.push(pending); ui.stick = true;
    $('composerText').value = ''; store(`ai-office-draft-${ctx}`, ''); autoGrow($('composerText'));
    const sentFiles = ui.attached; if (fresh) ui.attached = [];
    render();
    try {
      if (many) {
        const body = { submitKey: ui.submitKey, items: items.map((item, i) => ({ prompt: item.text, ...(item.files.length ? { attachments: item.files.map((f) => f.path) } : {}), ...(item.dep && i > 0 ? { dependsOn: [i] } : {}) })) };
        let result;
        try { result = await api('POST', '/api/batches', body); }
        catch (error) {
          // 응답을 받지 못했으면 같은 제출 키로 접수 여부부터 확인한다(다시 보내도 같은 번호가 돌아온다)
          if (error.status) throw error;
          const check = await api('GET', `/api/batches?key=${encodeURIComponent(ui.submitKey)}`).catch(() => null);
          if (!check?.batches?.length) throw new Error('접수 응답을 받지 못했어요. 연결을 확인한 뒤 다시 보내 주세요. 같은 내용이 두 번 접수되지는 않습니다.');
          result = { batch: check.batches[0] };
        }
        ui.queue = []; ui.submitKey = newSubmitKey(); saveComposer();
        ui.pending = ui.pending.filter((p) => p !== pending);
        await refresh();
        if (result.batch.items[0]) go({ page: 'chat', open: result.batch.items[0].id }, { replace: true });
      } else if (mode === 'reply') {
        const out = await api('POST', `/api/runs/${encodeURIComponent(latest.id)}/reply`, { prompt: text });
        ui.pending = ui.pending.filter((p) => p !== pending);
        if (out?.resumeQueued) toast(`답글을 접수했어요. ${out.ahead ? `진행 중인 업무 "${out.ahead.title}"` : '진행 중인 업무'}가 끝나면 이어서 진행합니다.`);
        else if (out?.taskClosed || out?.historyCleared) toast(resultMessage(out));
        await refresh();
      } else {
        // to: 팀장 방에서 보낸 업무는 그 팀에 맡긴다(서버가 팀을 확인하고 건에 남긴다)
        // 끝난 업무에서 보낸 말은 그 결과를 이어받는 새 업무다. 팀장에게 맡겼던 업무면 같은 팀에 맡긴다
        // after: 이어받을 앞 업무. 서버가 건에 남기고 실행 지시문 뒤에 그 산출물 위치를 덧붙인다(대화에는 대표가 적은 말만 보인다)
        const body = mode === 'follow' ? { prompt: text, ...(latest?.task || entry?.task ? { after: latest?.task || entry.task } : {}), ...(leadOf(entry) ? { to: entry.item.to } : {}) }
          : { prompt: withUploads(text, fresh ? sentFiles.map((f) => f.path) : []), ...(lead ? { to: lead.id } : {}) };
        const result = await api('POST', '/api/runs', body);
        ui.pending = ui.pending.filter((p) => p !== pending);
        await refresh();
        if (!lead) landRun(result, ctx);
        else if (!result?.id && !result?.queued) ui.notices.push({ ctx, at: new Date().toISOString(), text: resultMessage(result) });
      }
    } catch (error) {
      pending.error = `보내지 못했어요: ${error.message}`;
      if (!many && ui.ctx === ctx) { $('composerText').value = text; if (fresh) ui.attached = sentFiles; autoGrow($('composerText')); }
      setTimeout(() => { ui.pending = ui.pending.filter((p) => p !== pending); render(); }, 8000);
    } finally { ui.sending = false; ui.stick = true; render(); if (!narrow()) $('composerText').focus(); }
  }

  // ── 이동 ──
  // 좁은 화면에서는 목록 → 대화를 한 화면씩 보여 주고, 브라우저 뒤로 가기로 목록에 돌아온다
  const snapshot = () => ({ aiOffice: true, page: ui.page, open: ui.open, report: ui.report, lead: ui.lead, guide: ui.guide, guideCtx: ui.guideCtx, teamGuide: ui.teamGuide, pane: ui.pane, depth: ui.depth || 0 });
  function go(next, { replace = false, focus = false, push = false } = {}) {
    if (ui.pane === 'list') ui.listTop = $('sidebar').querySelector('[data-scroll="list"]')?.scrollTop || 0;
    const wasMain = ui.pane === 'main' && history.state?.pane === 'main';
    Object.assign(ui, { report: null }, next, { pane: 'main' });
    if (ui.page === 'chat') store('ai-office-open', ui.open || '');
    ui.stick = true;
    // depth: 목록 위에 쌓인 화면 수. ‹ 버튼은 이만큼 한 번에 되돌아가 목록에 닿는다
    const pushing = push || !(replace || wasMain);
    ui.depth = wasMain ? (ui.depth || 1) + (pushing ? 1 : 0) : 1;
    try { if (pushing) history.pushState(snapshot(), ''); else history.replaceState(snapshot(), ''); } catch { /* 기록을 쓸 수 없는 환경 */ }
    if (view() !== 'inbox') setView('inbox'); else render();
    // 대화가 아닌 화면(가이드·설정 등)은 맨 위부터 보여 준다(앞 화면의 스크롤 위치를 물려받지 않는다)
    if (!['chat', 'lead'].includes(ui.page)) $('chBody').scrollTop = 0;
    if (ui.page === 'reconcile') loadReconcile(true);
    if (focus) { if (((ui.page === 'chat' && !ui.open) || ui.page === 'lead') && !narrow()) $('composerText').focus(); else $('chTitle').focus({ preventScroll: true }); }
  }
  function backToList() {
    if (history.state?.pane === 'main' && history.length > 1) { history.go(-(history.state.depth || 1)); return; }
    ui.pane = 'list'; render(); restoreList();
  }
  function restoreList() {
    const list = $('sidebar').querySelector('[data-scroll="list"]');
    if (list) list.scrollTop = ui.listTop;
    (ui.open && $('sidebar').querySelector(`[data-key="conv-${CSS.escape(ui.open)}"]`))?.focus({ preventScroll: true });
  }
  function onPop(ev) {
    // 목록으로 돌아갈 때는 고른 대화를 그대로 둔다(목록에서 어디를 보고 있었는지 알 수 있게)
    const st = ev.state?.aiOffice && ev.state.pane === 'main' ? ev.state : { page: ui.page, open: ui.open, report: ui.report, lead: ui.lead, guide: ui.guide, guideCtx: ui.guideCtx, teamGuide: ui.teamGuide, pane: 'list' };
    Object.assign(ui, { page: st.page, open: st.open, report: st.report, lead: st.lead || null, teamGuide: st.teamGuide || null, guide: st.guide || null, guideCtx: st.guideCtx || 'new', pane: st.pane, depth: st.pane === 'main' ? st.depth || 1 : 0 });
    if (view() !== 'inbox') setView('inbox'); else render();
    if (ui.pane === 'list') restoreList();
  }

  async function cancelItem(button) {
    const id = button.dataset.cancel;
    if (button.dataset.armed !== '1') { button.dataset.armed = '1'; button.textContent = '한 번 더 누르면 취소합니다'; setTimeout(() => { button.dataset.armed = ''; button.textContent = '업무 취소'; }, 4000); return; }
    button.disabled = true;
    try { await api('POST', `/api/batches/${encodeURIComponent(id.replace(/-\d+$/, ''))}/items/${encodeURIComponent(id.split('-').at(-1))}/cancel`); toast('업무를 취소했어요. 다시 깨우지 않습니다.'); await refresh(); }
    catch (error) { toast(error.message, { type: 'error' }); button.disabled = false; }
  }
  async function raiseBudget(button) {
    const calls = Number($('chBody').querySelector('[data-keep="budget-add"]')?.value);
    if (!Number.isInteger(calls) || calls < 1) { toast('늘릴 호출 수를 1 이상으로 적어 주세요.', { type: 'error' }); return; }
    button.disabled = true;
    try { await api('POST', `/api/batches/${encodeURIComponent(button.dataset.budget)}/budget`, { calls, reason: '대화 화면에서 확대' }); toast(`묶음 예산을 ${calls}회 늘렸어요. 기다리던 업무는 스스로 시작하고, 예산 때문에 멈췄던 업무는 그 대화에 "이어서 진행"이라고 답해 주세요.`); ui.reports.delete(button.dataset.budget); await refresh(); }
    catch (error) { toast(error.message, { type: 'error' }); }
    finally { button.disabled = false; }
  }
  function onClick(ev) {
    const t = ev.target.closest('button');
    if (!t) return undefined;
    if (t.dataset.back !== undefined) return view() === 'inbox' ? backToList() : go({ page: 'settings' }, { replace: true, focus: true });
    if (t.dataset.new !== undefined) return go({ page: 'chat', open: null }, { focus: true });
    if (t.dataset.filter) { ui.filter = t.dataset.filter; store('ai-office-filter', ui.filter); return renderSidebar(); }
    if (t.dataset.page) return go({ page: t.dataset.page, ...(t.dataset.page === 'guides' ? { guideCtx: 'new' } : {}) }, { focus: true });
    if (t.dataset.lead) return go({ page: 'lead', lead: t.dataset.lead }, { focus: true });
    if (t.dataset.teamGuide) return go({ page: 'teamguide', teamGuide: t.dataset.teamGuide }, { focus: true, push: true });
    if (t.dataset.teamUse !== undefined) return useTeamExample(t.dataset.teamId || ui.teamGuide, Number(t.dataset.teamUse));
    if (t.dataset.teamCopy !== undefined) return useTeamExample(ui.teamGuide, Number(t.dataset.teamCopy), true);
    if (t.dataset.foldLeads !== undefined) { ui.leadsFolded = !ui.leadsFolded; store('ai-office-leads-folded', ui.leadsFolded ? '1' : ''); return renderSidebar(); }
    if (t.dataset.guidesBack !== undefined) return (history.state?.depth || 0) > 1 ? history.back() : go({ page: 'guides' }, { focus: true });
    // 예시 상세는 기록에 한 칸 더 쌓는다(뒤로 가면 찾던 목록·검색어로 돌아온다)
    if (t.dataset.guide) return go({ page: 'guide', guide: t.dataset.guide, guideCtx: ui.page === 'chat' ? 'new' : ui.page === 'lead' ? `lead:${ui.lead}` : ui.page === 'teamguide' ? `lead:${ui.teamGuide}` : ui.guideCtx }, { focus: true, push: true });
    if (t.dataset.guides !== undefined) return go({ page: 'guides', guideCtx: current()?.id || 'new' }, { focus: true });
    if (t.dataset.use !== undefined) return useExample(Number(t.dataset.use), t.dataset.to, t.dataset.leadId);
    if (t.dataset.copy !== undefined) return copyExample(Number(t.dataset.copy));
    if (t.dataset.view) { ui.pane = 'main'; return setView(t.dataset.view); }
    if (t.dataset.open) { const out = open[t.dataset.open]?.(); render(); return out; }
    if (t.dataset.openEntry) return go({ page: 'chat', open: t.dataset.openEntry }, { focus: true });
    if (t.dataset.report) return go({ page: 'report', report: t.dataset.report }, { focus: true });
    if (t.dataset.thread) return openThread(t.dataset.thread);
    if (t.dataset.completion) return openCompletion(t.dataset.completion);
    if (t.dataset.dl !== undefined) { const file = ui.files.get(t.dataset.task)?.list?.[Number(t.dataset.dl)]; return file ? download(file) : undefined; }
    if (t.dataset.csv) return downloadCsv(t.dataset.csv);
    if (t.dataset.rec) return decideReconcile(t);
    if (t.dataset.cancel) return cancelItem(t);
    if (t.dataset.budget) return raiseBudget(t);
    if (t.dataset.stop) return api('POST', `/api/runs/${encodeURIComponent(t.dataset.stop)}/stop`).then(() => { toast('중지 요청을 보냈어요.'); return refresh(); }).catch((error) => toast(error.message, { type: 'error' }));
    if (t.dataset.unqueue !== undefined) { ui.queue.splice(Number(t.dataset.unqueue), 1); if (ui.queue[0]) ui.queue[0].dep = false; saveComposer(); return syncComposer(); }
    if (t.dataset.unfile !== undefined) { ui.attached.splice(Number(t.dataset.unfile), 1); return syncComposer(); }
    return undefined;
  }

  function render() {
    const v = view();
    // 좁은 화면: 목록과 본문 중 하나만 보인다(직원 구성 화면은 본문 쪽이다)
    $('shell').classList.toggle('show-main', ui.pane === 'main' || v !== 'inbox');
    renderSidebar();
    if (v !== 'inbox') return;
    renderMain();
  }

  function init() {
    $('shell').addEventListener('click', onClick);
    try { history.replaceState({ aiOffice: true, page: 'chat', open: ui.open, report: null, pane: 'list' }, ''); } catch { /* 기록을 쓸 수 없는 환경 */ }
    window.addEventListener('popstate', onPop);
    const text = $('composerText');
    $('composer').addEventListener('submit', send);
    // Enter로 보내고 Shift+Enter로 줄바꿈(한글 조합 중에는 보내지 않는다). 휴대폰 자판의 Enter는 줄바꿈으로 둔다
    text.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && ev.keyCode !== 229 && !window.matchMedia('(pointer: coarse)').matches) { ev.preventDefault(); send(); } });
    text.addEventListener('input', () => { autoGrow(text); if (ui.ctx !== undefined) store(`ai-office-draft-${ui.ctx}`, text.value); if (ui.queue.length) syncComposer(); });
    $('composerAdd').addEventListener('click', queueCurrent);
    $('composerAttach').addEventListener('click', () => { $('composerFile').value = ''; $('composerFile').click(); });
    $('composerFile').addEventListener('change', (ev) => attach([...ev.target.files]));
    // 예시 찾기: 적는 대로 목록만 다시 거른다(서버에 묻지 않는다)
    // 입력란을 갈아 끼우면 한글 조합이 끊겨 글자가 두 번 들어가므로, 입력란은 그대로 두고 결과 칸만 바꾼다
    $('chBody').addEventListener('input', (ev) => {
      if (ev.target.dataset.guideQ === undefined) return;
      ui.guideQ = ev.target.value; store('ai-office-guide-q', ui.guideQ);
      const box = document.getElementById('gdResults');
      if (box) box.innerHTML = guideResultsHTML();
      // 다음 갱신이 같은 내용으로 보고 건드리지 않게, 지금 화면에 해당하는 글을 기억해 둔다
      $('chBody')._html = ui.page === 'guides' ? guidesPageHTML() : newChatHTML();
    });
    loadGuides();
    $('composerQueue').addEventListener('change', (ev) => { const i = Number(ev.target.dataset.dep); if (ui.queue[i]) { ui.queue[i].dep = ev.target.checked; saveComposer(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  }
  init();
  return { render, openEntry: (id) => go({ page: 'chat', open: id }, { focus: true }), sidebar: renderSidebar };
}
