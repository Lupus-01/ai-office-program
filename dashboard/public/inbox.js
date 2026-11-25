// 업무 화면(2.0). 슬랙처럼 왼쪽 사이드바 / 가운데 업무 흐름 / 오른쪽 스레드로 일한다.
// 아래 입력창에 한 줄 적어 보내면 바로 접수되고, 접수·배정·진행·질문·결과가 그 업무의 스레드에 대화처럼 올라온다.
// 순수 함수는 export 해서 Node 테스트에서 쓰고, DOM 코드는 createInbox 안에서만 돈다.
// 조회·새로고침은 저장된 정보만 읽는다(AI 호출 0회). 상태를 바꾸는 것은 보내기·답글·중지·취소·예산·대조 결정뿐이다.

export const ITEM_LABEL = Object.freeze({ waiting: '대기', running: '진행 중', needs: '확인 필요', done: '완료', failed: '실패', stopped: '중지', canceled: '취소' });
export const COMPOSE_LIMITS = Object.freeze({ items: 20, prompt: 20000, attachments: 10 });
const DEAD = ['canceled', 'failed', 'stopped'];
const ATTENTION = ['needs', 'failed', 'stopped'];
const BUSY = ['running', 'queued'];

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
// 지시창과 같은 표기로 올린 파일 경로를 지시문에 붙인다
export const withUploads = (prompt, paths) => (paths.length ? `${prompt}\n\n[업로드한 파일]\n- ${paths.join('\n- ')}` : prompt);

// 실행 하나(그 대화의 마지막 실행)를 건 상태 이름으로
export function runStatus(run) {
  if (!run) return 'waiting';
  if (BUSY.includes(run.status)) return 'running';
  if (run.status === 'done') return run.needsReply ? 'needs' : 'done';
  return run.status === 'stopped' ? 'stopped' : 'failed';
}
const rootOf = (run) => run.rootId || run.id;

// 가운데 업무 흐름: 접수한 건(묶음의 건)과, 묶음을 거치지 않은 대화(빠른 조회·상시 감시·예전 업무)를 시간순으로.
// entry: { id, kind: 'item'|'run', at, title, status, note, run(대화 뿌리), task, batch?, item? }
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
      note: run.continuous && status === 'running' ? '지속 감시 중' : status === 'needs' ? '대표 답변이 필요합니다.' : status === 'running' ? '진행 중' : status === 'done' ? '완료했습니다' : latest.summary || ITEM_LABEL[status] });
  }
  return out.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')) || a.order - b.order);
}
// 대표가 봐야 할 것: 확인 필요·실패·중지, 그리고 스스로 시작하지 못하는 대기 건
export function attentionEntries(entries) {
  return entries.filter((e) => ATTENTION.includes(e.status)
    || (e.item?.status === 'waiting' && (e.item.waitingOn?.kind === 'budget' || (e.item.waitingOn?.kind === 'dependency' && DEAD.includes(e.item.waitingOn.status)))));
}

const EVENT_TEXT = { 'plan.set': '계획을 세웠습니다.', 'agent.start': '작업을 시작했습니다.', 'agent.stop': '작업을 마쳤습니다.', 'agent.pause': '확인이 필요해 멈췄습니다.',
  'meeting.start': '분담 회의를 시작했습니다.', 'meeting.end': '회의를 마쳤습니다.', 'flow.review_request': '산출물 검토를 요청했습니다.', 'flow.review': '검토했습니다.', 'flow.deliver': '결과를 전달했습니다.',
  'flow.assign': '업무를 배정했습니다.', 'flow.cooperate': '다음 담당에게 넘겼습니다.', 'flow.notice': '' };
const PREFIXED = ['agent.stop'];

// 스레드: 한 업무의 진행을 대화처럼. 내 지시 → 접수 → 직원들의 진행 → 질문 → 내 답글 → 결과.
// message: { who, role: 'me'|'chief'|'agent'|'system', at, text, tone?: 'question'|'done'|'failed'|'live', run? }
export function threadMessages({ entry, prompt = null, runs = [], feed = [], results = {}, agents = {} }) {
  const out = [];
  const name = (id) => (!id || id === 'chief' ? '비서실장' : agents[id]?.name || id);
  out.push({ who: '나', role: 'me', at: entry.at, text: prompt || entry.title });
  const conv = entry.run ? runs.filter((r) => !r.phase && r.target !== 'review' && rootOf(r) === entry.run).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))) : [];
  if (!conv.length) {
    out.push({ who: '비서실장', role: 'chief', at: entry.at, text: entry.status === 'canceled' ? '이 업무는 취소됐습니다.' : entry.status === 'failed' ? `시작하지 못했습니다. ${entry.note}` : `접수했습니다. ${entry.note}`, tone: entry.status === 'waiting' ? 'live' : undefined });
    return out;
  }
  const events = [...feed].filter((ev) => ev && entry.task && ev.task === entry.task && (EVENT_TEXT[ev.kind] !== undefined)).sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
  conv.forEach((run, i) => {
    if (i > 0) out.push({ who: '나', role: 'me', at: run.createdAt, text: run.request || '(답글)' });
    else out.push({ who: '비서실장', role: 'chief', at: run.createdAt, text: '접수했습니다. 바로 시작합니다.' });
    const until = conv[i + 1]?.createdAt || '9999';
    for (const ev of events) {
      if (String(ev.ts) < String(run.createdAt) || String(ev.ts) >= String(until)) continue;
      const text = (PREFIXED.includes(ev.kind) ? [EVENT_TEXT[ev.kind], ev.summary].filter(Boolean).join(' ') : ev.summary || EVENT_TEXT[ev.kind] || '').trim();
      if (text && out.at(-1)?.text !== text) out.push({ who: name(ev.agent), role: !ev.agent || ev.agent === 'chief' ? 'chief' : 'agent', at: ev.ts, text });
    }
    if (BUSY.includes(run.status)) out.push({ who: '비서실장', role: 'chief', at: null, text: run.continuous ? '지속 감시 중입니다. 새 자료가 생기면 알려 드립니다.' : '진행 중입니다…', tone: 'live', run: run.id });
    else {
      const status = runStatus(run);
      out.push({ who: '비서실장', role: 'chief', at: run.endedAt || run.createdAt, text: results[run.id] || run.summary || ITEM_LABEL[status], tone: status === 'needs' ? 'question' : status === 'done' ? 'done' : 'failed', run: run.id });
    }
  });
  return out;
}

// 보고서 글을 읽기 좋게: 제목 줄(# …)은 굵게, 나머지 줄은 그대로. 받은 글은 먼저 esc로 안전하게 바꾼 뒤에만 꾸민다
export function richText(text, esc) {
  return String(text || '').split('\n').map((line) => { const m = line.match(/^#{1,6}\s+(.*)$/); return m ? `<strong class="wm-h">${esc(m[1])}</strong>` : esc(line); }).join('\n').replace(/\n{3,}/g, '\n\n');
}

// ───── 화면 ─────
// deps: { api, authedGet, toast, esc, state(), refresh(), view(), setView(v), openThread(runId), openCompletion(taskId), upload(file) → 경로, store(key, value),
//         resultMessage(result), open: { schedules, company, connections, notify, theme }, themeLabel(), notifyOn(), connState() }
export function createInbox(deps) {
  const { api, authedGet, toast, esc, state, refresh, view, setView, openThread, openCompletion, upload, store, resultMessage, open } = deps;
  const $ = (id) => document.getElementById(id);
  const ui = { nav: 'all', open: null, report: null, details: new Map(), results: new Map(), reports: new Map(), reconcile: { items: [], loaded: false, count: -1 },
    queue: [], files: [], submitKey: newSubmitKey(), pending: [], notices: [], sending: false, stick: true };
  try { const saved = JSON.parse(store('ai-office-composer') || 'null'); if (saved && Array.isArray(saved.queue)) { ui.queue = saved.queue; ui.submitKey = saved.submitKey || ui.submitKey; } } catch { /* 새로 시작 */ }
  const saveComposer = () => store('ai-office-composer', JSON.stringify({ queue: ui.queue, submitKey: ui.submitKey }));

  // 다시 그려도 읽는 위치·초점·입력 중인 글을 빼앗지 않는다
  function setHTML(el, html) {
    if (!el || el._html === html) return false;
    const active = document.activeElement;
    const key = active && el.contains(active) ? active.dataset.key : null;
    const typed = [...el.querySelectorAll('[data-keep]')].map((i) => [i.dataset.keep, i.type === 'checkbox' ? i.checked : i.value]);
    const top = el.scrollTop;
    el.innerHTML = html; el._html = html;
    for (const [k, v] of typed) { const i = el.querySelector(`[data-keep="${CSS.escape(k)}"]`); if (i) { if (i.type === 'checkbox') i.checked = v; else i.value = v; } }
    el.scrollTop = top;
    if (key) el.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
    return true;
  }
  const time = (iso) => { if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const today = new Date().toDateString() === d.toDateString();
    return d.toLocaleString('ko-KR', today ? { hour: '2-digit', minute: '2-digit', hour12: false } : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); };
  const mins = (ms) => (ms >= 60000 ? `${Math.round(ms / 60000)}분` : ms > 0 ? '1분 미만' : '0분');
  const chip = (status, label) => `<span class="chip chip-${esc(status)}">${esc(label || ITEM_LABEL[status] || status)}</span>`;
  const avatar = (who, role) => `<span class="av av-${role}" aria-hidden="true">${esc(role === 'me' ? '나' : role === 'chief' ? '비' : role === 'system' ? 'i' : [...who][0] || '?')}</span>`;
  const entries = () => streamEntries(state());
  const findEntry = (id) => entries().find((e) => e.id === id) || null;
  const convRuns = (entry) => (entry.run ? state().runs.filter((r) => !r.phase && rootOf(r) === entry.run) : []);

  // ── 사이드바 ──
  function renderSidebar() {
    const s = state(), all = entries(), v = view();
    const needs = attentionEntries(all).length + (s.reconcilePending || 0);
    const live = all.filter((e) => e.status === 'running' || e.status === 'waiting').length;
    const navBtn = (id, icon, label, count) => `<button type="button" class="sb-item" data-nav="${id}" data-key="sb-nav-${id}" aria-current="${v === 'inbox' && ui.nav === id ? 'page' : 'false'}"><span class="sb-ic" aria-hidden="true">${icon}</span><span class="sb-label">${esc(label)}</span>${count ? `<span class="sb-badge${id === 'needs' ? ' sb-badge-alert' : ''}">${count}</span>` : ''}</button>`;
    const viewBtn = (id, label) => `<button type="button" class="sb-item" data-view="${id}" data-key="sb-view-${id}" aria-current="${v === id ? 'page' : 'false'}"><span class="sb-ic" aria-hidden="true">▸</span><span class="sb-label">${esc(label)}</span></button>`;
    const act = (id, label) => `<button type="button" class="sb-item" data-open="${id}" data-key="sb-open-${id}"><span class="sb-ic" aria-hidden="true">·</span><span class="sb-label">${esc(label)}</span></button>`;
    const chiefBusy = s.runs.some((r) => !r.phase && BUSY.includes(r.status));
    const conn = deps.connState?.() || 'connecting';
    setHTML($('sidebar'), `<div class="sb-head"><strong class="sb-name">AI Office</strong><span class="sb-conn" data-state="${esc(conn)}" title="${{ live: '실시간 연결', connecting: '연결 중', retry: '연결 끊김 · 재연결 중' }[conn] || ''}"><i aria-hidden="true"></i>${conn === 'live' ? '연결됨' : conn === 'retry' ? '연결 끊김' : '연결 중'}</span></div>
      <nav class="sb-scroll" aria-label="메뉴">
        <h2 class="sb-title">업무</h2>
        ${navBtn('all', '#', '업무함', live)}${navBtn('needs', '@', '내 확인 필요', needs)}${navBtn('reports', '▤', '최종 보고', 0)}
        <h2 class="sb-title">봇</h2>
        <button type="button" class="sb-item sb-bot" data-view="org" data-key="sb-bot-chief"><span class="sb-dot${chiefBusy ? ' is-on' : ''}" aria-hidden="true"></span><span class="sb-label">비서실장</span><span class="sb-meta">${chiefBusy ? '일하는 중' : ''}</span></button>
        ${s.departments.filter((d) => d.active !== false).map((d) => `<button type="button" class="sb-item sb-bot" data-view="org" data-key="sb-bot-${esc(d.id)}" title="${esc(d.summary || d.name)}"><span class="sb-dot${d.activeCount ? ' is-on' : ''}" aria-hidden="true"></span><span class="sb-label">${esc(d.name)}</span><span class="sb-meta">${d.activeCount ? `${d.activeCount}명 작업 중` : `${d.memberCount}명`}</span></button>`).join('') || '<p class="sb-empty">아직 부서가 없습니다. 조직에서 부서와 직원을 추가해 주세요.</p>'}
        <h2 class="sb-title">보조 화면</h2>
        ${viewBtn('control', '관제')}${viewBtn('office', '사무실')}${viewBtn('org', '조직')}${viewBtn('outputs', '산출물')}
        <h2 class="sb-title">관리</h2>
        ${act('schedules', '예약')}${act('connections', '계정 연결')}${act('company', '회사 설정')}${act('notify', deps.notifyOn?.() ? '알림 끄기' : '알림 켜기')}${act('theme', `화면 테마: ${deps.themeLabel?.() || ''}`)}
      </nav>`);
  }

  // ── 가운데 업무 흐름 ──
  const entryHTML = (e) => `<article class="wm${ui.open === e.id ? ' is-open' : ''}" data-entry="${esc(e.id)}">${avatar('나', 'me')}<div class="wm-main">
      <header class="wm-head"><strong>나</strong><time>${esc(time(e.at))}</time>${e.kind === 'item' && e.batch.total > 1 ? `<span class="wm-tag">${e.item.no}/${e.batch.total}</span>` : ''}</header>
      <p class="wm-text">${esc(e.title)}</p>
      <button type="button" class="wm-thread" data-open-entry="${esc(e.id)}" data-key="entry-${esc(e.id)}" aria-label="${esc(e.title)} 스레드 열기 — ${esc(ITEM_LABEL[e.status])}">${chip(e.status)}<span class="wm-note">${esc(e.note)}</span><span class="wm-go" aria-hidden="true">스레드 보기 ›</span></button></div></article>`;
  function renderChannel() {
    const s = state(), all = entries();
    const titles = { all: ['# 업무함', '맡긴 업무가 접수 순서대로 한 건씩 진행됩니다'], needs: ['@ 내 확인 필요', '답변·결정이 필요한 업무만 모았습니다'], reports: ['▤ 최종 보고', '묶음별 건수와 건별 결과'] }[ui.nav];
    $('chTitle').textContent = titles[0]; $('chSub').textContent = titles[1];
    const ready = s.tools?.claude?.loggedIn === true || s.tools?.codex?.loggedIn === true;
    const probing = s.tools?.claude?.installed === null || s.tools?.codex?.installed === null;
    $('chNotice').hidden = ready || probing || s.demo;
    $('chNotice').textContent = ready || probing ? '' : '로그인된 AI 도구가 없어 업무를 시작할 수 없습니다. 터미널에서 Claude 또는 Codex에 로그인한 뒤 서버를 다시 켜 주세요.';
    let html;
    if (ui.nav === 'reports') {
      const list = [...(s.batches || [])].filter((b) => b.total > 1 || b.counts?.done !== 1 || true);
      html = list.length ? list.map((b) => `<article class="wm wm-card${ui.report === b.id ? ' is-open' : ''}">${avatar('비서실장', 'chief')}<div class="wm-main"><header class="wm-head"><strong>비서실장</strong><time>${esc(time(b.createdAt))}</time><span class="wm-tag">${esc(b.id)}</span></header>
        <p class="wm-text">${esc(b.title)} — ${esc(countsText(b))}</p>
        <button type="button" class="wm-thread" data-report="${esc(b.id)}" data-key="report-${esc(b.id)}">${chip(b.counts?.done + (b.counts?.canceled || 0) === b.total ? 'done' : (b.counts?.running || 0) ? 'running' : 'needs', `${b.counts?.done || 0}/${b.total} 완료`)}<span class="wm-note">건별 결과·다음 행동·처리 이력</span><span class="wm-go" aria-hidden="true">보고 보기 ›</span></button></div></article>`).join('') : '<p class="ch-empty">아직 보고할 업무가 없습니다.</p>';
    } else {
      const list = ui.nav === 'needs' ? attentionEntries(all) : all;
      let lastBatch = null;
      html = (ui.nav === 'needs' ? '<div id="reconcileBox"></div>' : '') + list.map((e) => {
        let head = '';
        if (ui.nav === 'all' && e.kind === 'item' && e.batch.total > 1 && e.batch.id !== lastBatch) {
          head = `<div class="wm-divider"><span>묶음 ${esc(e.batch.id)} · ${e.batch.total}건 · ${esc(countsText(e.batch))}${e.batch.budget ? ` · 예산 ${e.batch.budget.usedCalls}/${e.batch.budget.limitCalls}회` : ''}</span><button type="button" class="link" data-report="${esc(e.batch.id)}" data-key="div-report-${esc(e.batch.id)}">보고 보기</button></div>`;
        }
        lastBatch = e.kind === 'item' ? e.batch.id : null;
        return head + entryHTML(e);
      }).join('');
      if (ui.nav === 'all') {
        html += ui.notices.map((n) => `<article class="wm wm-system">${avatar('비서실장', 'chief')}<div class="wm-main"><header class="wm-head"><strong>비서실장</strong><time>${esc(time(n.at))}</time></header><p class="wm-text">${esc(n.text)}</p></div></article>`).join('');
        html += ui.pending.map((p) => `<article class="wm is-pending">${avatar('나', 'me')}<div class="wm-main"><header class="wm-head"><strong>나</strong><time>${esc(time(p.at))}</time></header><p class="wm-text">${esc(p.text)}</p>
          <p class="wm-sending${p.error ? ' is-error' : ''}" role="status">${p.error ? esc(p.error) : '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span> 비서실장이 지시를 확인하고 있습니다…'}</p></div></article>`).join('');
      }
      if (!list.length && !ui.pending.length && !ui.notices.length) html += ui.nav === 'needs' ? `<p class="ch-empty">${s.reconcilePending ? '' : '지금 확인할 일이 없습니다.'}</p>`
        : '<div class="ch-empty"><p><strong>아래 입력창에 맡길 일을 적어 보내세요.</strong></p><p>보내는 즉시 접수되고, 진행 상황과 결과가 그 업무의 스레드에 올라옵니다. 여러 건은 <em>＋ 업무 추가</em>로 묶어 한 번에 맡기면 접수 순서대로 한 건씩 처리합니다.</p></div>';
    }
    const body = $('chBody');
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
    const changed = setHTML(body, html);
    if (changed && (ui.stick || nearBottom) && ui.nav === 'all') body.scrollTop = body.scrollHeight;
    ui.stick = false;
    if (ui.nav === 'needs') renderReconcile();
    $('composer').hidden = ui.nav !== 'all' || s.demo;
  }

  // ── 발송 결과 대조(내 확인 필요 맨 위) ──
  async function loadReconcile(force = false) {
    const pending = state().reconcilePending || 0;
    if (!force && ui.reconcile.loaded && ui.reconcile.count === pending) return;
    try { const data = await api('GET', '/api/reconcile'); ui.reconcile = { items: data.items || [], loaded: true, count: pending }; }
    catch (error) { ui.reconcile = { items: [], loaded: true, count: pending, error: error.message }; }
    if (ui.nav === 'needs') renderReconcile();
  }
  function renderReconcile() {
    const box = $('reconcileBox');
    if (!box) return;
    if (!ui.reconcile.loaded || ui.reconcile.count !== (state().reconcilePending || 0)) loadReconcile();
    const items = ui.reconcile.items;
    setHTML(box, items.length ? `<div class="wm-divider"><span>발송 결과 대조 ${items.length}건 — 보낸 직후 끊겨 결과를 알 수 없는 발송입니다. 여기서 여는 것만으로는 아무것도 보내지 않습니다.</span></div>
      ${items.map((it) => `<article class="wm wm-card rec" aria-label="발송 대조 ${esc(it.target || '')}">${avatar('비서실장', 'chief')}<div class="wm-main">
        <header class="wm-head"><strong>비서실장</strong><time>${esc(time(it.attemptAt))}</time><span class="wm-tag">발송 결과 확인 필요</span></header>
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
      </div></article>`).join('')}` : ui.reconcile.error ? `<p class="ch-error">${esc(ui.reconcile.error)}</p>` : '');
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

  // ── 오른쪽 스레드 ──
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
  const bubble = (m) => `<article class="wm wm-${m.role}${m.tone ? ` tone-${m.tone}` : ''}">${avatar(m.who, m.role)}<div class="wm-main"><header class="wm-head"><strong>${esc(m.who)}</strong><time>${esc(time(m.at))}</time>${m.tone === 'question' ? '<span class="wm-tag tag-warn">답변 필요</span>' : ''}</header>
      <div class="wm-text">${m.tone === 'live' ? '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span> ' : ''}${m.role === 'chief' && m.tone && m.tone !== 'live' ? richText(m.text, esc) : esc(m.text)}</div></div></article>`;
  function threadHTML(entry, detail) {
    const full = detail?.items?.find((i) => i.id === entry.id) || null;
    const runs = convRuns(entry), latest = runs.at(-1) || null;
    const results = Object.fromEntries([...ui.results].map(([id, r]) => [id, r.text]));
    const messages = threadMessages({ entry, prompt: full?.prompt || null, runs: state().runs, feed: state().feed, results, agents: state().agents });
    const local = ui.pending.filter((p) => p.thread === entry.id).map((p) => ({ who: '나', role: 'me', at: p.at, text: p.text, tone: undefined, sending: true, error: p.error }));
    const deps2 = entry.kind === 'item' ? (entry.item.dependsOn || []).map((no) => entry.batch.items.find((i) => i.no === no)).filter(Boolean) : [];
    const canCancel = entry.kind === 'item' && ['waiting', 'needs', 'failed', 'stopped'].includes(entry.status);
    const running = latest && BUSY.includes(latest.status);
    return `<div class="th-meta">${chip(entry.status)}<span class="th-id">${esc(entry.kind === 'item' ? entry.id : '빠른 지시')}${entry.kind === 'item' && entry.batch.total > 1 ? ` · ${esc(entry.batch.title)} ${entry.item.no}/${entry.batch.total}` : ''}</span></div>
      ${deps2.length ? `<p class="th-line">앞 업무: ${deps2.map((d) => `<button type="button" class="link" data-open-entry="${esc(d.id)}" data-key="dep-${esc(d.id)}">${d.no}. ${esc(d.title)}</button> (${esc(ITEM_LABEL[d.status])})`).join(', ')}</p>` : ''}
      ${full?.attachments?.length ? `<p class="th-line">첨부: ${full.attachments.map((p) => `<span title="${esc(p)}">📄 ${esc(p.split('/').at(-1))}</span>`).join(' ')}</p>` : ''}
      <div class="th-msgs">${messages.map(bubble).join('')}${local.map((m) => `<article class="wm wm-me is-pending">${avatar('나', 'me')}<div class="wm-main"><header class="wm-head"><strong>나</strong><time>${esc(time(m.at))}</time></header><div class="wm-text">${esc(m.text)}</div><p class="wm-sending${m.error ? ' is-error' : ''}">${esc(m.error || '보내는 중…')}</p></div></article>`).join('')}</div>
      <div class="row-actions th-actions">
        ${entry.status === 'done' && entry.task ? `<button type="button" class="btn btn-primary" data-completion="${esc(entry.task)}" data-key="th-result">결과·산출물 보기</button>` : ''}
        ${running ? `<button type="button" class="btn" data-stop="${esc(latest.id)}" data-key="th-stop">중지</button>` : ''}
        ${canCancel ? `<button type="button" class="btn btn-danger" data-cancel="${esc(entry.id)}" data-key="th-cancel">이 업무 취소</button>` : ''}
        ${latest ? `<button type="button" class="btn btn-ghost" data-thread="${esc(latest.id)}" data-key="th-log">실행 기록</button>` : ''}
      </div>
      ${full ? `<details class="th-details"><summary data-key="th-sum">사용량·처리 이력</summary><p class="th-line">${esc(usageText(full.usage))}</p>
        <ol class="th-events">${(full.events || []).map((e) => `<li><time>${esc(time(e.at))}</time> ${esc({ accepted: '접수', started: '시작', resumed: '재개', needs: '확인 필요로 보류', stopped: '중지', paused: '일시정지', failed: '실패', done: '완료', canceled: '취소', 'resume-queued': '답글 접수(재개 예약)', unpaused: '일시정지 해제', requeued: '대기로 복귀', 'wait-alert': '대기 알림' }[e.type] || e.type)}</li>`).join('')}</ol></details>` : ''}`;
  }
  async function renderThread() {
    const pane = $('threadPane'), body = $('thBody');
    if (ui.report) return renderReport();
    const entry = ui.open ? findEntry(ui.open) : null;
    pane.hidden = !entry;
    $('work').classList.toggle('has-thread', Boolean(entry));
    pane.classList.remove('th-wide');
    if (!entry) { $('thReply').hidden = true; return; }
    $('thTitle').textContent = entry.title;
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
    const draw = (detail) => { if (setHTML(body, threadHTML(entry, detail)) && (nearBottom || ui.stickThread)) body.scrollTop = body.scrollHeight; };
    draw(ui.details.get(entry.batch?.id)?.data);
    syncReply(entry);
    const [detail, loaded] = await Promise.all([loadDetail(entry), loadResults(entry)]);
    const again = ui.open ? findEntry(ui.open) : null;
    if (again && again.id === entry.id && !ui.report && (detail || loaded)) { if (setHTML(body, threadHTML(again, detail)) && (nearBottom || ui.stickThread)) body.scrollTop = body.scrollHeight; }
    ui.stickThread = false;
  }
  // 답글 입력란은 다시 그리지 않는다. 업무가 바뀌면 그 업무에서 쓰던 글을 되살린다
  function syncReply(entry) {
    const form = $('thReply'), latest = convRuns(entry).at(-1);
    const can = Boolean(latest) && !BUSY.includes(latest.status) && latest.canReply !== false && ['needs', 'failed', 'stopped'].includes(entry.status);
    form.hidden = !can;
    if (form.dataset.entry !== entry.id) {
      if (form.dataset.entry) store(`ai-office-reply-${form.dataset.entry}`, $('thReplyText').value);
      form.dataset.entry = entry.id;
      $('thReplyText').value = store(`ai-office-reply-${entry.id}`) || '';
      autoGrow($('thReplyText'));
    }
    if (can) { form.dataset.run = latest.id; $('thReplyText').placeholder = entry.status === 'needs' ? '답변을 적어 보내세요 — Enter로 보내기' : '이어서 진행하려면 답글(예: 이어서 재개)'; }
  }
  async function sendReply(ev) {
    ev?.preventDefault();
    const form = $('thReply'), text = $('thReplyText').value.trim();
    if (!text || form.dataset.sending === '1') return;
    form.dataset.sending = '1';
    const pending = { id: Math.random().toString(36).slice(2), thread: form.dataset.entry, text, at: new Date().toISOString() };
    ui.pending.push(pending); $('thReplyText').value = ''; autoGrow($('thReplyText')); store(`ai-office-reply-${form.dataset.entry}`, '');
    ui.stickThread = true; renderThread();
    try {
      const out = await api('POST', `/api/runs/${encodeURIComponent(form.dataset.run)}/reply`, { prompt: text });
      ui.pending = ui.pending.filter((p) => p !== pending);
      if (out?.resumeQueued) toast(`답글을 접수했어요. ${out.ahead ? `진행 중인 업무 "${out.ahead.title}"` : '진행 중인 업무'}가 끝나면 이어서 진행합니다.`);
      else if (out?.taskClosed || out?.historyCleared) toast(resultMessage(out));
      await refresh();
    } catch (error) { pending.error = `보내지 못했어요: ${error.message}`; $('thReplyText').value = text; setTimeout(() => { ui.pending = ui.pending.filter((p) => p !== pending); render(); }, 6000); }
    finally { form.dataset.sending = ''; ui.stickThread = true; render(); }
  }

  // ── 최종 보고(스레드 자리에 넓게) ──
  async function renderReport() {
    const pane = $('threadPane'), body = $('thBody');
    const batch = (state().batches || []).find((b) => b.id === ui.report);
    pane.hidden = !batch; $('work').classList.toggle('has-thread', Boolean(batch)); pane.classList.toggle('th-wide', Boolean(batch)); $('thReply').hidden = true;
    if (!batch) return;
    $('thTitle').textContent = `보고 · ${batch.title}`;
    const sig = JSON.stringify(batch), cached = ui.reports.get(batch.id);
    const draw = (report, error) => setHTML(body, !report ? `<p class="${error ? 'ch-error' : 'th-line'}">${esc(error || '보고를 불러오는 중…')}</p>` : `
      <div class="th-meta">${chip(report.complete ? 'done' : report.settled ? 'needs' : 'running', report.complete ? '모두 끝남' : report.settled ? '확인 필요' : '진행 중')}<span class="th-id">${esc(report.id)} · ${esc(time(report.createdAt))} 접수 · 전체 ${report.total}건</span></div>
      <p class="rep-sum" role="status">${esc(countsText(report))}${report.saveFailed ? ' · <strong class="ch-error">보고 반영 실패(업무 결과는 그대로입니다)</strong>' : ''}</p>
      <div class="rep-wrap"><table class="rep-table"><thead><tr><th scope="col">번호</th><th scope="col">업무</th><th scope="col">상태</th><th scope="col">결과 또는 사유</th><th scope="col">다음 행동</th></tr></thead><tbody>
        ${report.rows.map((row) => `<tr><td>${row.no}</td><th scope="row"><button type="button" class="link" data-open-entry="${esc(row.id)}" data-key="row-${esc(row.id)}">${esc(row.title)}</button></th><td>${chip(row.status)}</td>
          <td>${esc(row.result)}${row.outputs?.folder ? `<br><button type="button" class="link" data-completion="${esc(row.task)}" data-key="out-${esc(row.id)}">산출물 열기</button>` : ''}</td><td>${esc(row.next)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="th-line">${esc(usageText(report.usage))}${batch.budget ? ` · 묶음 예산 ${batch.budget.usedCalls}/${batch.budget.limitCalls}회` : ''}</p>
      <div class="row-actions"><button type="button" class="btn" data-csv="${esc(report.id)}" data-key="csv">처리 이력 내려받기(CSV)</button>
        ${batch.budget ? `<label class="rep-inline">예산 늘리기 <input type="number" min="1" max="500" value="${batch.budget.limitCalls}" data-keep="budget-add" data-key="budget-add" aria-label="늘릴 AI 호출 수">회</label><button type="button" class="btn" data-budget="${esc(report.id)}" data-key="budget-btn">늘리기</button>` : ''}</div>
      <details class="th-details"><summary data-key="sum-times">대기·작업 시간</summary><ul class="th-events">${report.rows.map((row) => `<li>${row.no}. ${esc(row.title)} — 실행 자리 대기 ${mins(row.times.slotWaitMs)} · 앞 업무 결과 대기 ${mins(row.times.depWaitMs)} · 사람 답변 대기 ${mins(row.times.humanWaitMs)} · 실제 작업 ${mins(row.times.workMs)}</li>`).join('')}</ul></details>
      ${report.card?.revisions?.length > 1 ? `<details class="th-details"><summary data-key="sum-rev">확정 이력 ${report.card.revisions.length}건</summary><ol class="th-events">${report.card.revisions.map((r) => `<li><time>${esc(time(r.at))}</time> ${esc(countsText({ counts: r.counts }))}</li>`).join('')}</ol></details>` : ''}`);
    draw(cached?.report || null);
    if (cached?.sig === sig) return;
    try { const report = await api('GET', `/api/batches/${encodeURIComponent(batch.id)}/report`); ui.reports.set(batch.id, { sig, report }); if (ui.report === batch.id) draw(report); }
    catch (error) { if (ui.report === batch.id) draw(null, error.message); }
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

  // ── 입력창 ──
  function autoGrow(el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 220)}px`; }
  function renderComposer() {
    const q = ui.queue;
    setHTML($('composerQueue'), q.map((item, i) => `<li class="cq-item"><span class="cq-no">${i + 1}</span><span class="cq-text">${esc(item.text.split('\n')[0])}${item.files.length ? ` <span class="wm-tag">첨부 ${item.files.length}</span>` : ''}</span>
      ${i > 0 ? `<label class="inline cq-dep"><input type="checkbox" data-dep="${i}" data-key="cq-dep-${i}"${item.dep ? ' checked' : ''}> ${i}번 결과를 받아서</label>` : ''}
      <button type="button" class="icon-btn" data-unqueue="${i}" data-key="cq-rm-${i}" aria-label="${i + 1}번 업무 빼기">✕</button></li>`).join(''));
    $('composerQueue').hidden = !q.length;
    setHTML($('composerFiles'), ui.files.map((f, i) => `<li class="chief-file"><span class="chief-file-name" title="${esc(f.path)}">📄 ${esc(f.name)}</span><button type="button" class="chief-file-remove" data-unfile="${i}" data-key="cf-rm-${i}" aria-label="${esc(f.name)} 빼기">✕</button></li>`).join(''));
    $('composerFiles').hidden = !ui.files.length;
    $('composerHint').textContent = q.length ? `${q.length}건을 담았습니다. 보내면 접수 순서대로 한 건씩 처리합니다.` : 'Enter로 보내기 · Shift+Enter로 줄바꿈';
    $('composerSend').textContent = q.length ? `${q.length + ($('composerText').value.trim() ? 1 : 0)}건 보내기` : '보내기';
    $('composerAdd').disabled = q.length >= COMPOSE_LIMITS.items;
  }
  function queueCurrent() {
    const text = $('composerText').value.trim();
    if (!text) { $('composerText').focus(); toast('담을 업무를 먼저 적어 주세요.'); return false; }
    ui.queue.push({ text, files: ui.files, dep: false }); ui.files = [];
    $('composerText').value = ''; autoGrow($('composerText')); saveComposer(); renderComposer(); $('composerText').focus();
    return true;
  }
  async function attach(files) {
    for (const file of files) {
      if (ui.files.length >= COMPOSE_LIMITS.attachments) { toast(`첨부는 ${COMPOSE_LIMITS.attachments}개까지 붙일 수 있어요.`, { type: 'error' }); break; }
      try { ui.files.push({ name: file.name, path: await upload(file) }); renderComposer(); }
      catch (error) { toast(`${file.name}: ${error.message} (이 파일만 다시 붙이면 됩니다)`, { type: 'error' }); }
    }
  }
  async function send(ev) {
    ev?.preventDefault();
    if (ui.sending) return;
    const text = $('composerText').value.trim();
    if (!text && !ui.queue.length) { $('composerText').focus(); return; }
    ui.sending = true; $('composerSend').disabled = true;
    const batchMode = ui.queue.length > 0;
    const items = batchMode ? [...ui.queue, ...(text ? [{ text, files: ui.files, dep: false }] : [])] : [{ text, files: ui.files }];
    const pending = { id: Math.random().toString(36).slice(2), text: batchMode ? `${items.length}건: ${items.map((i) => i.text.split('\n')[0]).join(' / ')}` : text, at: new Date().toISOString() };
    // 보내는 즉시 내 메시지를 보여 준다(접수 확인은 뒤따라온다)
    ui.pending.push(pending); ui.stick = true; ui.nav = 'all';
    $('composerText').value = ''; autoGrow($('composerText')); const sentFiles = ui.files; ui.files = [];
    render();
    try {
      if (batchMode) {
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
        ui.open = result.batch.items[0]?.id || null; ui.report = null; ui.stickThread = true;
      } else {
        const result = await api('POST', '/api/runs', { prompt: withUploads(text, sentFiles.map((f) => f.path)) });
        ui.pending = ui.pending.filter((p) => p !== pending);
        await refresh();
        if (result?.id) { const entry = entries().find((e) => e.run === (result.rootId || result.id)); ui.open = entry?.id || null; ui.report = null; ui.stickThread = true; }
        else if (result?.queued) { ui.open = result.item; ui.report = null; }
        else ui.notices.push({ at: new Date().toISOString(), text: resultMessage(result) });
      }
    } catch (error) {
      pending.error = `보내지 못했어요: ${error.message}`;
      if (!batchMode) { $('composerText').value = text; ui.files = sentFiles; autoGrow($('composerText')); }
      setTimeout(() => { ui.pending = ui.pending.filter((p) => p !== pending); render(); }, 8000);
    } finally { ui.sending = false; $('composerSend').disabled = false; ui.stick = true; render(); $('composerText').focus(); }
  }

  // ── 조작 ──
  function openEntry(id, { focus = true } = {}) {
    ui.open = id; ui.report = null; ui.stickThread = true;
    renderChannel(); renderThread().then(() => { if (focus) $('thTitle')?.focus({ preventScroll: true }); });
  }
  function closeThread() {
    const back = ui.report ? `report-${ui.report}` : ui.open ? `entry-${ui.open}` : null;
    ui.open = null; ui.report = null;
    renderChannel(); renderThread();
    // 닫으면 골랐던 메시지로 초점을 돌려준다
    const target = back && $('chBody').querySelector(`[data-key="${CSS.escape(back)}"]`);
    if (target) target.focus(); else $('composerText')?.focus();
  }
  async function cancelItem(button) {
    const id = button.dataset.cancel;
    if (button.dataset.armed !== '1') { button.dataset.armed = '1'; button.textContent = '한 번 더 누르면 취소합니다'; setTimeout(() => { button.dataset.armed = ''; button.textContent = '이 업무 취소'; }, 4000); return; }
    button.disabled = true;
    try { await api('POST', `/api/batches/${encodeURIComponent(id.replace(/-\d+$/, ''))}/items/${encodeURIComponent(id.split('-').at(-1))}/cancel`); toast('업무를 취소했어요. 다시 깨우지 않습니다.'); await refresh(); }
    catch (error) { toast(error.message, { type: 'error' }); button.disabled = false; }
  }
  async function raiseBudget(button) {
    const calls = Number($('thBody').querySelector('[data-keep="budget-add"]')?.value);
    if (!Number.isInteger(calls) || calls < 1) { toast('늘릴 호출 수를 1 이상으로 적어 주세요.', { type: 'error' }); return; }
    button.disabled = true;
    try { await api('POST', `/api/batches/${encodeURIComponent(button.dataset.budget)}/budget`, { calls, reason: '업무 화면에서 확대' }); toast(`묶음 예산을 ${calls}회 늘렸어요. 기다리던 업무는 스스로 시작하고, 예산 때문에 멈췄던 업무는 그 스레드에 "이어서 재개"라고 답해 주세요.`); ui.reports.delete(button.dataset.budget); await refresh(); }
    catch (error) { toast(error.message, { type: 'error' }); }
    finally { button.disabled = false; }
  }
  function onClick(ev) {
    const t = ev.target.closest('button');
    if (!t) return undefined;
    if (t.id === 'thClose') return closeThread();
    if (t.dataset.sbToggle !== undefined) return $('shell').classList.toggle('sb-open');
    if (t.dataset.nav) { $('shell').classList.remove('sb-open'); ui.nav = t.dataset.nav; ui.report = null; ui.stick = true; if (view() !== 'inbox') setView('inbox'); else render(); if (ui.nav === 'needs') loadReconcile(true); return undefined; }
    if (t.dataset.view) { $('shell').classList.remove('sb-open'); return setView(t.dataset.view); }
    if (t.dataset.open) return open[t.dataset.open]?.();
    if (t.dataset.openEntry) return openEntry(t.dataset.openEntry);
    if (t.dataset.report) { ui.report = t.dataset.report; ui.open = null; renderChannel(); return renderReport().then(() => $('thTitle')?.focus({ preventScroll: true })); }
    if (t.dataset.thread) return openThread(t.dataset.thread);
    if (t.dataset.completion) return openCompletion(t.dataset.completion);
    if (t.dataset.csv) return downloadCsv(t.dataset.csv);
    if (t.dataset.rec) return decideReconcile(t);
    if (t.dataset.cancel) return cancelItem(t);
    if (t.dataset.budget) return raiseBudget(t);
    if (t.dataset.stop) return api('POST', `/api/runs/${encodeURIComponent(t.dataset.stop)}/stop`).then(() => { toast('중지 요청을 보냈어요.'); return refresh(); }).catch((error) => toast(error.message, { type: 'error' }));
    if (t.dataset.unqueue !== undefined) { ui.queue.splice(Number(t.dataset.unqueue), 1); if (ui.queue[0]) ui.queue[0].dep = false; saveComposer(); return renderComposer(); }
    if (t.dataset.unfile !== undefined) { ui.files.splice(Number(t.dataset.unfile), 1); return renderComposer(); }
    return undefined;
  }

  function render() {
    renderSidebar();
    if (view() !== 'inbox') return;
    renderChannel(); renderComposer(); renderThread();
  }

  function init() {
    $('shell').addEventListener('click', onClick);
    // 접힌 메뉴가 열려 있을 때 바깥(본문)을 누르면 닫는다
    document.querySelector('.shell-main').addEventListener('click', (ev) => { if ($('shell').classList.contains('sb-open') && !ev.target.closest('[data-sb-toggle]')) $('shell').classList.remove('sb-open'); }, true);
    const text = $('composerText'), reply = $('thReplyText');
    $('composer').addEventListener('submit', send);
    $('thReply').addEventListener('submit', sendReply);
    // Enter로 보내고 Shift+Enter로 줄바꿈(한글 조합 중에는 보내지 않는다)
    const enterSends = (fn) => (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && ev.keyCode !== 229) { ev.preventDefault(); fn(); } };
    text.addEventListener('keydown', enterSends(send));
    reply.addEventListener('keydown', enterSends(sendReply));
    text.addEventListener('input', () => { autoGrow(text); if (ui.queue.length) renderComposer(); });
    reply.addEventListener('input', () => { autoGrow(reply); const id = $('thReply').dataset.entry; if (id) store(`ai-office-reply-${id}`, reply.value); });
    $('composerAdd').addEventListener('click', queueCurrent);
    $('composerAttach').addEventListener('click', () => { $('composerFile').value = ''; $('composerFile').click(); });
    $('composerFile').addEventListener('change', (ev) => attach([...ev.target.files]));
    $('composerQueue').addEventListener('change', (ev) => { const i = Number(ev.target.dataset.dep); if (ui.queue[i]) { ui.queue[i].dep = ev.target.checked; saveComposer(); } });
    $('work').addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && (ui.open || ui.report) && !ev.target.closest('dialog')) { ev.preventDefault(); closeThread(); } });
  }
  init();
  return { render, openEntry, sidebar: renderSidebar };
}
