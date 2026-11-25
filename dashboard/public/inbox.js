// 업무함(2.0). 접수한 업무의 목록·스레드·최종 보고·확인 필요를 한 화면에서 본다.
// 순수 함수는 export 해서 Node 테스트에서 쓰고, DOM 코드는 createInbox 안에서만 돈다.
// 이 화면의 조회·새로고침은 저장된 정보만 읽는다(AI 호출 0회). 상태를 바꾸는 것은 접수·답장·취소·예산·대조 결정 버튼뿐이다.

export const ITEM_LABEL = Object.freeze({ waiting: '대기', running: '진행 중', needs: '확인 필요', done: '완료', failed: '실패', stopped: '중지', canceled: '취소' });
export const COMPOSE_LIMITS = Object.freeze({ items: 20, prompt: 20000, title: 80, done: 2000, attachments: 10 });
const DEAD = ['canceled', 'failed', 'stopped'];
const ATTENTION = ['needs', 'failed', 'stopped'];

// 대기 중인 건이 무엇을 기다리는지 한 줄로
export function waitingText(item) {
  const w = item.waitingOn;
  if (item.resumeQueued) return '답장을 접수했습니다. 진행 중인 업무가 끝나면 이어서 진행합니다.';
  if (!w) return '차례 대기';
  if (w.kind === 'dependency') return `선행 업무 "${w.title}" 대기${DEAD.includes(w.status) ? ` — 선행 업무가 ${ITEM_LABEL[w.status]} 상태라 스스로 시작하지 못합니다` : ''}`;
  if (w.kind === 'budget') return '묶음 예산을 모두 썼습니다. 예산을 늘리면 시작합니다.';
  return w.title ? `차례 대기 — 앞선 업무 "${w.title}"` : '차례 대기';
}

// 건의 보조 설명 한 줄(목록·스레드 공통)
export function itemNote(item) {
  if (item.status === 'waiting') return waitingText(item);
  if (item.status === 'running') return '진행 중입니다. 끝나면 다음 업무가 자동으로 시작합니다.';
  if (item.status === 'done') return '완료했습니다.';
  return item.reason || ITEM_LABEL[item.status] || item.status;
}

// 대표의 확인이 필요한 건: 확인 필요·실패·중지, 그리고 선행 업무가 죽어 스스로 시작하지 못하는 대기 건
export function attentionItems(batches) {
  const out = [];
  for (const batch of batches || []) {
    for (const item of batch.items || []) {
      const stuck = item.status === 'waiting' && item.waitingOn?.kind === 'dependency' && DEAD.includes(item.waitingOn.status);
      const budget = item.status === 'waiting' && item.waitingOn?.kind === 'budget';
      if (ATTENTION.includes(item.status) || stuck || budget) out.push({ batch, item });
    }
  }
  return out;
}

// 묶음 한 줄 요약: "완료 3 / 확인 필요 1"처럼 상태별 건수(합은 언제나 접수 건수)
export function countsText(batch) {
  const order = ['done', 'needs', 'running', 'waiting', 'failed', 'stopped', 'canceled'];
  return order.filter((s) => batch.counts?.[s]).map((s) => `${ITEM_LABEL[s]} ${batch.counts[s]}`).join(' / ') || '없음';
}

// 제출 키: 작성창을 열 때 한 번 만들고, 같은 제출을 다시 보낼 때 그대로 쓴다
export function newSubmitKey(random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  return [...random(24)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const uid = () => Math.random().toString(36).slice(2, 10);
export const emptyItem = () => ({ key: uid(), title: '', prompt: '', done: '', attachments: [], dependsOn: [] });
export const emptyDraft = (key = newSubmitKey()) => ({ submitKey: key, items: [emptyItem()] });

// 항목을 위·아래로 옮긴다(선행 업무는 항목의 고유 키로 가리키므로 순서를 바꿔도 따라간다)
export function moveItem(items, index, delta) {
  const to = index + delta;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

// 작성 내용을 제출 본문으로. 오류가 있으면 errors에 항목 번호와 함께 담는다(서버 검사와 같은 규칙)
export function composePayload(draft) {
  const errors = [];
  const order = new Map(draft.items.map((item, i) => [item.key, i + 1]));
  const items = draft.items.map((item, i) => {
    const no = i + 1, prompt = String(item.prompt || '').trim();
    if (!prompt) errors.push(`${no}번 업무: 요청 내용을 적어 주세요.`);
    if (prompt.length > COMPOSE_LIMITS.prompt) errors.push(`${no}번 업무: 요청 내용은 ${COMPOSE_LIMITS.prompt.toLocaleString('ko-KR')}자 이하여야 합니다.`);
    const dependsOn = [];
    for (const key of item.dependsOn || []) {
      const dep = order.get(key);
      if (!dep) continue; // 지운 항목을 가리키던 선행 업무는 버린다
      if (dep >= no) errors.push(`${no}번 업무: 선행 업무는 앞선 항목만 고를 수 있습니다(지금 ${dep}번이 뒤에 있습니다).`);
      else dependsOn.push(dep);
    }
    return { ...(String(item.title || '').trim() ? { title: String(item.title).trim().slice(0, COMPOSE_LIMITS.title) } : {}), prompt,
      ...(String(item.done || '').trim() ? { done: String(item.done).trim() } : {}),
      ...(item.attachments?.length ? { attachments: item.attachments.map((a) => a.path) } : {}), ...(dependsOn.length ? { dependsOn: dependsOn.sort((a, b) => a - b) } : {}) };
  });
  if (!items.length) errors.push('업무를 한 건 이상 넣어 주세요.');
  if (items.length > COMPOSE_LIMITS.items) errors.push(`한 번에 ${COMPOSE_LIMITS.items}건까지 접수할 수 있습니다.`);
  return { errors, body: { submitKey: draft.submitKey, items } };
}

// 전송 전 확인 목록: 번호·제목(없으면 요청 첫 줄)·첨부 수·선행 업무
export function composePreview(draft) {
  const order = new Map(draft.items.map((item, i) => [item.key, i + 1]));
  return draft.items.map((item, i) => ({ no: i + 1, title: String(item.title || '').trim() || String(item.prompt || '').trim().split('\n')[0].slice(0, COMPOSE_LIMITS.title) || '(내용 없음)',
    attachments: item.attachments?.length || 0, dependsOn: (item.dependsOn || []).map((key) => order.get(key)).filter(Boolean) }));
}

const kst = (iso) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); };
const mins = (ms) => (ms >= 60000 ? `${Math.round(ms / 60000)}분` : ms > 0 ? '1분 미만' : '0분');
export function usageText(usage) {
  if (!usage || !usage.calls) return 'AI 호출 0회';
  const n = (v) => Number(v || 0).toLocaleString('ko-KR');
  return `AI 호출 ${usage.calls}회 · 확인된 입력 ${n(usage.input)} · 출력 ${n(usage.output)} 토큰${usage.unreported ? ` · 미보고 ${usage.unreported}회(토큰 미포함)` : ''}`;
}

// ───── 화면 ─────
// deps: { api, authedGet, toast, esc, state(), refresh(), openThread(runId), openCompletion(taskId), upload(file) → 경로, store(key, value) }
export function createInbox(deps) {
  const { api, authedGet, toast, esc, state, refresh, openThread, openCompletion, upload, store } = deps;
  const $ = (id) => document.getElementById(id);
  const ui = { nav: 'all', batch: null, item: null, report: null, details: new Map(), reports: new Map(), reconcile: { sig: '', items: [], loaded: false }, sending: false };
  let draft = loadDraft();

  function loadDraft() {
    try { const saved = JSON.parse(store('ai-office-compose') || 'null'); if (saved?.submitKey && Array.isArray(saved.items) && saved.items.length) return saved; } catch { /* 새로 시작 */ }
    return emptyDraft();
  }
  const saveDraft = () => store('ai-office-compose', JSON.stringify(draft));

  // 다시 그려도 읽는 위치·초점·입력 중인 글을 빼앗지 않는다: 내용이 같으면 건드리지 않고, 바뀌면 초점과 입력값을 되돌린다
  function setHTML(el, html) {
    if (!el || el._html === html) return;
    const active = document.activeElement;
    const key = active && el.contains(active) ? active.dataset.key : null;
    const typed = [...el.querySelectorAll('[data-keep]')].map((i) => [i.dataset.keep, i.type === 'checkbox' ? i.checked : i.value]);
    const top = el.scrollTop;
    el.innerHTML = html; el._html = html;
    for (const [k, v] of typed) { const i = el.querySelector(`[data-keep="${CSS.escape(k)}"]`); if (i) { if (i.type === 'checkbox') i.checked = v; else i.value = v; } }
    el.scrollTop = top;
    if (key) el.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  }
  const chip = (status) => `<span class="ibx-chip ibx-${esc(status)}">${esc(ITEM_LABEL[status] || status)}</span>`;
  const batches = () => state().batches || [];
  const findItem = (id) => { for (const batch of batches()) { const item = batch.items.find((i) => i.id === id); if (item) return { batch, item }; } return null; };
  const latestRun = (item) => (item.run ? state().runs.filter((r) => !r.phase && (r.rootId || r.id) === item.run).at(-1) : null) || null;

  // ── 왼쪽 메뉴 ──
  function renderNav() {
    const needs = attentionItems(batches()).length + (state().reconcilePending || 0);
    const entry = (id, label, count) => `<button type="button" class="ibx-nav-btn" data-nav="${id}" data-key="nav-${id}" aria-current="${ui.nav === id ? 'page' : 'false'}">${esc(label)}${count ? ` <span class="ibx-count">${count}</span>` : ''}</button>`;
    setHTML($('inboxNav'), `<button type="button" class="btn btn-primary ibx-new" id="inboxNew" data-key="nav-new"${state().demo ? ' disabled' : ''}>＋ 새 업무</button>
      ${entry('all', '업무함', batches().reduce((n, b) => n + (b.counts?.running || 0) + (b.counts?.waiting || 0), 0))}
      ${entry('needs', '내 확인 필요', needs)}
      ${entry('reports', '최종 보고', 0)}
      <button type="button" class="ibx-nav-btn" disabled title="업무 봇 사용 가이드는 준비 중입니다">업무 봇 가이드 <span class="ibx-soon">준비 중</span></button>
      <p class="ibx-nav-help">관제·사무실·조직·산출물은 위쪽 탭에, 예약·계정 연결·회사 설정은 위쪽 버튼에 있습니다.</p>`);
  }

  // ── 가운데 목록 ──
  const itemRow = (batch, item) => `<li><button type="button" class="ibx-row" data-item="${esc(item.id)}" data-key="item-${esc(item.id)}" aria-current="${ui.item === item.id ? 'true' : 'false'}">
      <span class="ibx-no">${item.no}</span><span class="ibx-row-main"><span class="ibx-row-title">${esc(item.title)}</span><span class="ibx-row-note">${esc(itemNote(item))}</span></span>${chip(item.status)}</button></li>`;
  function renderList() {
    const list = batches();
    let html;
    if (ui.nav === 'needs') {
      const rows = attentionItems(list);
      html = `<div id="inboxReconcile"></div>` + (rows.length ? `<ul class="ibx-rows">${rows.map(({ batch, item }) => itemRow(batch, item)).join('')}</ul>`
        : `<p class="ibx-empty">${state().reconcilePending ? '답변이 필요한 업무는 없습니다.' : '지금 확인할 일이 없습니다.'}</p>`);
    } else if (ui.nav === 'reports') {
      html = list.length ? `<ul class="ibx-rows">${[...list].reverse().map((batch) => `<li><button type="button" class="ibx-row" data-report="${esc(batch.id)}" data-key="report-${esc(batch.id)}" aria-current="${ui.report === batch.id ? 'true' : 'false'}">
        <span class="ibx-row-main"><span class="ibx-row-title">${esc(batch.title)}</span><span class="ibx-row-note">${esc(batch.id)} · ${esc(kst(batch.createdAt))} 접수 · ${esc(countsText(batch))}</span></span>
        <span class="ibx-chip ${batch.counts?.done + (batch.counts?.canceled || 0) === batch.total ? 'ibx-done' : 'ibx-waiting'}">${batch.counts?.done || 0}/${batch.total}</span></button></li>`).join('')}</ul>` : '<p class="ibx-empty">아직 접수한 업무가 없습니다.</p>';
    } else {
      html = list.length ? [...list].reverse().map((batch) => `<section class="ibx-batch" aria-label="${esc(batch.title)}">
        <header class="ibx-batch-head"><h3>${esc(batch.title)}</h3><span class="ibx-batch-meta">${esc(batch.id)} · ${esc(kst(batch.createdAt))} 접수 · ${esc(countsText(batch))}${batch.budget ? ` · 묶음 예산 ${batch.budget.usedCalls}/${batch.budget.limitCalls}회` : ''}</span>
          <button type="button" class="link ibx-batch-report" data-report-open="${esc(batch.id)}" data-key="open-report-${esc(batch.id)}">보고 보기</button></header>
        <ul class="ibx-rows">${batch.items.map((item) => itemRow(batch, item)).join('')}</ul></section>`).join('')
        : '<p class="ibx-empty">아직 접수한 업무가 없습니다. <strong>＋ 새 업무</strong>로 여러 건을 한 번에 맡기면 접수 순서대로 한 건씩 처리합니다.</p>';
    }
    $('inboxListTitle').textContent = { all: '업무함', needs: '내 확인 필요', reports: '최종 보고' }[ui.nav];
    setHTML($('inboxList'), html);
    if (ui.nav === 'needs') renderReconcile();
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
    const box = $('inboxReconcile');
    if (!box) return;
    if (!ui.reconcile.loaded || ui.reconcile.count !== (state().reconcilePending || 0)) loadReconcile();
    const items = ui.reconcile.items;
    setHTML(box, items.length ? `<h3 class="ibx-sub">발송 결과 대조 ${items.length}건</h3><p class="ibx-help">보낸 직후 끊겨 결과를 알 수 없는 발송입니다. 여기서 여는 것만으로는 아무것도 보내지 않습니다. 보낸메일함·게시판에서 직접 확인한 뒤 결정해 주세요.</p>
      ${items.map((it) => `<article class="ibx-rec" aria-label="발송 대조 ${esc(it.target || '')}">
        <dl class="ibx-dl"><dt>대상</dt><dd>${esc({ mail: '메일', post: '글', comment: '댓글', web: '웹사이트 작업' }[it.action] || it.action || '')} · ${esc(it.target || '')}</dd>
          <dt>승인된 문안</dt><dd>버전 ${esc(it.version || '-')}${it.run ? ` · <button type="button" class="link" data-thread="${esc(it.run)}" data-key="rec-thread-${esc(it.id)}">이 업무의 문안·대화 보기</button>` : ''}</dd>
          <dt>시도</dt><dd>${it.attempt}번째 · ${esc(kst(it.attemptAt))}</dd>
          <dt>관측된 결과</dt><dd>${esc(it.evidence?.resultUrl || it.evidence?.readbackError || it.evidence?.summary || '확인된 증표 없음')}</dd>
          ${it.decision ? `<dt>결정</dt><dd>${esc(it.decision.decision === 'resend' ? '새 발송 승인' : '발송 확인')} — 업무가 다시 진행되면 반영됩니다</dd>` : ''}</dl>
        ${it.decision ? '' : `<label class="ibx-field">근거(확인한 증표 또는 미발송 근거)<input type="text" maxlength="500" data-keep="rec-basis-${esc(it.id)}" data-key="rec-basis-${esc(it.id)}" placeholder="예: 보낸메일함에 10:02 발송 확인 / 게시판에 글 없음"></label>
        <div class="ibx-actions"><button type="button" class="btn" data-rec="${esc(it.id)}" data-decision="confirm" data-attempt="${it.attempt}" data-key="rec-confirm-${esc(it.id)}">발송 확인(이미 보내짐)</button>
          <button type="button" class="btn" data-rec="${esc(it.id)}" data-decision="hold" data-attempt="${it.attempt}" data-key="rec-hold-${esc(it.id)}">확인 보류</button>
          <span class="ibx-gap"></span>
          <label class="inline ibx-check"><input type="checkbox" data-keep="rec-sure-${esc(it.id)}" data-key="rec-sure-${esc(it.id)}"> 보내지지 않은 것을 직접 확인했습니다</label>
          <button type="button" class="btn btn-danger" data-rec="${esc(it.id)}" data-decision="resend" data-attempt="${it.attempt}" data-key="rec-resend-${esc(it.id)}">새 발송 승인(다시 보냄)</button></div>`}
      </article>`).join('')}` : ui.reconcile.error ? `<p class="ibx-error">${esc(ui.reconcile.error)}</p>` : '');
  }
  async function decideReconcile(button) {
    const id = button.dataset.rec, decision = button.dataset.decision;
    const basis = $('inboxList').querySelector(`[data-keep="rec-basis-${CSS.escape(id)}"]`)?.value.trim() || '';
    if (decision !== 'hold' && !basis) { toast('근거를 적어 주세요.', { type: 'error' }); return; }
    if (decision === 'resend' && !$('inboxList').querySelector(`[data-keep="rec-sure-${CSS.escape(id)}"]`)?.checked) { toast('보내지지 않은 것을 직접 확인했는지 체크해 주세요. 새 발송은 실제로 다시 보냅니다.', { type: 'error' }); return; }
    button.disabled = true;
    try {
      const out = await api('POST', `/api/reconcile/${encodeURIComponent(id)}`, { decision, basis, attempt: Number(button.dataset.attempt) });
      toast(out.note || { confirm: '발송 확인으로 기록했어요. 업무를 이어서 진행합니다.', hold: '확인 보류로 남겼어요.', resend: '새 발송을 승인했어요. 이 업무가 이어서 진행되며 한 번 다시 보냅니다.' }[decision]);
    } catch (error) {
      // 다른 기기에서 먼저 처리했으면 최신 상태를 보여 준다
      toast(error.status === 409 ? `${error.message}` : error.message, { type: 'error' });
    } finally { button.disabled = false; await loadReconcile(true); await refresh(); }
  }

  // ── 오른쪽 스레드 ──
  async function loadDetail(batchId, force = false) {
    const batch = batches().find((b) => b.id === batchId);
    const sig = JSON.stringify(batch || null);
    const cached = ui.details.get(batchId);
    if (!force && cached?.sig === sig) return cached.data;
    try { const data = await api('GET', `/api/batches/${encodeURIComponent(batchId)}`); ui.details.set(batchId, { sig, data }); return data; }
    catch (error) { ui.details.set(batchId, { sig, data: null, error: error.message }); return null; }
  }
  function threadHTML(found, detail) {
    const { batch, item } = found;
    const full = detail?.items?.find((i) => i.id === item.id);
    const run = latestRun(item);
    const deps = (item.dependsOn || []).map((no) => batch.items.find((i) => i.no === no)).filter(Boolean);
    const canReply = run && ['needs', 'failed', 'stopped'].includes(item.status);
    const canCancel = ['waiting', 'needs', 'failed', 'stopped'].includes(item.status);
    return `<header class="ibx-thread-head"><div><h3 id="inboxThreadTitle" tabindex="-1">${esc(item.title)}</h3><p class="ibx-batch-meta">${esc(item.id)} · ${esc(batch.title)} ${item.no}/${batch.total}번째</p></div>${chip(item.status)}
        <button type="button" class="icon-btn" id="inboxThreadClose" data-key="thread-close" aria-label="업무 닫고 목록으로">✕</button></header>
      <div class="ibx-state ibx-state-${esc(item.status)}" role="status"><strong>${esc(ITEM_LABEL[item.status] || item.status)}</strong> ${esc(itemNote(item))}</div>
      ${deps.length ? `<p class="ibx-meta-line">선행 업무: ${deps.map((d) => `<button type="button" class="link" data-item="${esc(d.id)}" data-key="dep-${esc(d.id)}">${d.no}. ${esc(d.title)}</button> (${esc(ITEM_LABEL[d.status])})`).join(', ')}</p>` : ''}
      <section class="ibx-sec"><h4>요청 원문</h4>${full ? `<pre class="ibx-pre">${esc(full.prompt)}</pre>` : `<p class="ibx-help">${detail === null ? '원문을 불러오지 못했습니다.' : '불러오는 중…'}</p>`}
        ${full?.done ? `<h4>완료 기준</h4><pre class="ibx-pre">${esc(full.done)}</pre>` : ''}
        ${full?.attachments?.length ? `<h4>첨부</h4><ul class="ibx-files">${full.attachments.map((p) => `<li title="${esc(p)}">📄 ${esc(p.split('/').at(-1))}</li>`).join('')}</ul>` : ''}</section>
      <section class="ibx-sec"><h4>결과</h4>
        ${run ? `<p class="ibx-result">${esc(run.summary || '아직 결과가 없습니다.')}</p>` : '<p class="ibx-help">아직 시작하지 않았습니다.</p>'}
        <div class="ibx-actions">
          ${item.status === 'done' && item.task ? `<button type="button" class="btn btn-primary" data-completion="${esc(item.task)}" data-key="open-result">결과·산출물 보기</button>` : ''}
          ${run ? `<button type="button" class="btn" data-thread="${esc(run.id)}" data-key="open-thread">대화·진행 기록 전체</button>` : ''}
          ${canCancel ? `<button type="button" class="btn btn-danger" data-cancel="${esc(item.id)}" data-key="cancel-item">이 업무 취소</button>` : ''}
        </div></section>
      <details class="ibx-details"><summary data-key="sum-usage">사용량·시간</summary><p class="ibx-meta-line">${esc(usageText(full?.usage))}</p>
        <p class="ibx-meta-line">접수 ${esc(kst(full?.events?.[0]?.at))}${full?.events?.find((e) => e.type === 'started') ? ` · 실제 시작 ${esc(kst(full.events.find((e) => e.type === 'started').at))}` : ' · 아직 시작 전'} · 시도 ${full?.attempt || 0}회</p></details>
      <details class="ibx-details"><summary data-key="sum-events">처리 이력 ${full?.events?.length || 0}건</summary><ol class="ibx-events">${(full?.events || []).map((e) => `<li><time>${esc(kst(e.at))}</time> ${esc({ accepted: '접수', started: '시작', resumed: '재개', needs: '확인 필요로 보류', stopped: '중지', paused: '일시정지', failed: '실패', done: '완료', canceled: '취소', 'resume-queued': '답장 접수(재개 예약)', unpaused: '일시정지 해제', requeued: '대기로 복귀', 'wait-alert': '대기 알림' }[e.type] || e.type)}</li>`).join('')}</ol></details>
      <div id="inboxReplySlot" data-can="${canReply ? run.id : ''}"></div>`;
  }
  async function renderThread() {
    const box = $('inboxThread');
    if (ui.report || (ui.nav === 'reports' && !ui.item)) return renderReport();
    const found = ui.item ? findItem(ui.item) : null;
    $('viewInbox').classList.toggle('has-thread', Boolean(found));
    if (!found) { setHTML(box, '<p class="ibx-empty">목록에서 업무를 고르면 요청 원문, 필요한 답변, 결과가 여기에 보입니다.</p>'); $('inboxReply').hidden = true; return; }
    const cached = ui.details.get(found.batch.id);
    setHTML(box, threadHTML(found, cached ? cached.data : undefined));
    syncReply(found);
    const detail = await loadDetail(found.batch.id);
    const again = ui.item ? findItem(ui.item) : null;
    if (again && again.item.id === found.item.id && !ui.report) { setHTML(box, threadHTML(again, detail)); syncReply(again); }
  }
  // 답글 입력란은 다시 그리지 않는다(입력 중인 글과 초점을 지킨다). 업무가 바뀌면 그 업무의 작성 중 글을 되살린다
  function syncReply(found) {
    const form = $('inboxReply'), run = latestRun(found.item);
    const can = Boolean(run) && ['needs', 'failed', 'stopped'].includes(found.item.status);
    form.hidden = !can;
    if (!can) return;
    if (form.dataset.item !== found.item.id) {
      if (form.dataset.item) store(`ai-office-reply-${form.dataset.item}`, $('inboxReplyText').value);
      form.dataset.item = found.item.id;
      $('inboxReplyText').value = store(`ai-office-reply-${found.item.id}`) || '';
    }
    form.dataset.run = run.id;
    $('inboxReplyLabel').textContent = found.item.status === 'needs' ? '이 업무에 답변' : '이어서 진행하려면 답장(예: 이어서 재개)';
  }
  async function sendReply(ev) {
    ev.preventDefault();
    const form = $('inboxReply'), text = $('inboxReplyText').value.trim();
    if (!text || ui.sending) return;
    ui.sending = true; $('inboxReplySend').disabled = true;
    try {
      const out = await api('POST', `/api/runs/${encodeURIComponent(form.dataset.run)}/reply`, { prompt: text });
      $('inboxReplyText').value = ''; store(`ai-office-reply-${form.dataset.item}`, '');
      toast(out?.resumeQueued ? `답장을 접수했어요. ${out.ahead ? `진행 중인 업무 "${out.ahead.title}"` : '진행 중인 업무'}가 끝나면 이어서 진행합니다.` : '답장을 보냈어요. 이 업무를 이어서 진행합니다.');
      await refresh();
    } catch (error) { toast(error.message, { type: 'error' }); }
    finally { ui.sending = false; $('inboxReplySend').disabled = false; }
  }

  // ── 최종 보고 ──
  async function renderReport() {
    const box = $('inboxThread');
    $('inboxReply').hidden = true;
    const batch = batches().find((b) => b.id === ui.report);
    $('viewInbox').classList.toggle('has-thread', Boolean(batch));
    if (!batch) { setHTML(box, '<p class="ibx-empty">왼쪽에서 묶음을 고르면 접수한 순서대로 건별 결과와 다음 행동이 보입니다.</p>'); return; }
    const sig = JSON.stringify(batch), cached = ui.reports.get(batch.id);
    const draw = (report, error) => setHTML(box, !report ? `<p class="${error ? 'ibx-error' : 'ibx-help'}">${esc(error || '보고를 불러오는 중…')}</p>` : `
      <header class="ibx-thread-head"><div><h3 id="inboxThreadTitle" tabindex="-1">${esc(batch.title)}</h3><p class="ibx-batch-meta">${esc(report.id)} · ${esc(kst(report.createdAt))} 접수 · 전체 ${report.total}건</p></div>
        <span class="ibx-chip ${report.complete ? 'ibx-done' : report.settled ? 'ibx-needs' : 'ibx-running'}">${report.complete ? '모두 끝남' : report.settled ? '확인 필요' : '진행 중'}</span>
        <button type="button" class="icon-btn" id="inboxThreadClose" data-key="thread-close" aria-label="보고 닫고 목록으로">✕</button></header>
      <p class="ibx-report-sum" role="status">${esc(countsText(report))}${report.saveFailed ? ' · <strong class="ibx-error">보고 반영 실패(업무 결과는 그대로입니다)</strong>' : ''}</p>
      <div class="ibx-table-wrap"><table class="ibx-table"><thead><tr><th scope="col">번호</th><th scope="col">업무</th><th scope="col">상태</th><th scope="col">결과 또는 사유</th><th scope="col">다음 행동</th></tr></thead><tbody>
        ${report.rows.map((row) => `<tr><td>${row.no}</td><th scope="row"><button type="button" class="link" data-item="${esc(row.id)}" data-key="row-${esc(row.id)}">${esc(row.title)}</button></th><td>${chip(row.status)}</td>
          <td>${esc(row.result)}${row.outputs?.folder ? `<br><button type="button" class="link" data-completion="${esc(row.task)}" data-key="out-${esc(row.id)}">산출물 열기</button>` : ''}</td><td>${esc(row.next)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="ibx-meta-line">${esc(usageText(report.usage))}${batch.budget ? ` · 묶음 예산 ${batch.budget.usedCalls}/${batch.budget.limitCalls}회` : ''}</p>
      <div class="ibx-actions"><button type="button" class="btn" data-csv="${esc(report.id)}" data-key="csv">처리 이력 내려받기(CSV)</button>
        ${batch.budget ? `<label class="ibx-inline">예산 늘리기 <input type="number" min="1" max="500" value="${batch.budget.limitCalls}" data-keep="budget-add" data-key="budget-add" aria-label="늘릴 AI 호출 수">회</label><button type="button" class="btn" data-budget="${esc(report.id)}" data-key="budget-btn">늘리기</button>` : ''}</div>
      <details class="ibx-details"><summary data-key="sum-times">대기·작업 시간</summary><ul class="ibx-events">${report.rows.map((row) => `<li>${row.no}. ${esc(row.title)} — 실행 자리 대기 ${mins(row.times.slotWaitMs)} · 선행 결과 대기 ${mins(row.times.depWaitMs)} · 사람 답변 대기 ${mins(row.times.humanWaitMs)} · 실제 작업 ${mins(row.times.workMs)}</li>`).join('')}</ul></details>
      ${report.card?.revisions?.length > 1 ? `<details class="ibx-details"><summary data-key="sum-rev">확정 이력 ${report.card.revisions.length}건</summary><ol class="ibx-events">${report.card.revisions.map((r) => `<li><time>${esc(kst(r.at))}</time> ${esc(countsText({ counts: r.counts }))}</li>`).join('')}</ol></details>` : ''}`);
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

  // ── 새 업무 작성 ──
  function renderCompose() {
    const items = draft.items;
    const options = (item, index) => items.slice(0, index).map((other, j) => `<label class="inline"><input type="checkbox" data-dep="${esc(other.key)}" data-of="${esc(item.key)}"${item.dependsOn.includes(other.key) ? ' checked' : ''}> ${j + 1}번 결과를 받아서 진행</label>`).join('');
    setHTML($('composeItems'), items.map((item, i) => `<fieldset class="cmp-item" data-item-key="${esc(item.key)}"><legend>${i + 1}번 업무</legend>
      <div class="cmp-tools"><button type="button" class="btn btn-sm" data-move="-1" data-of="${esc(item.key)}" data-key="up-${esc(item.key)}"${i === 0 ? ' disabled' : ''} aria-label="${i + 1}번 업무를 위로">위로</button>
        <button type="button" class="btn btn-sm" data-move="1" data-of="${esc(item.key)}" data-key="down-${esc(item.key)}"${i === items.length - 1 ? ' disabled' : ''} aria-label="${i + 1}번 업무를 아래로">아래로</button>
        <button type="button" class="btn btn-sm btn-danger" data-remove="${esc(item.key)}" data-key="rm-${esc(item.key)}"${items.length === 1 ? ' disabled' : ''} aria-label="${i + 1}번 업무 빼기">빼기</button></div>
      <label><span class="cmp-lbl">제목 <span class="help-inline">비우면 요청 첫 줄을 씁니다</span></span><input type="text" maxlength="${COMPOSE_LIMITS.title}" data-field="title" data-of="${esc(item.key)}" data-key="title-${esc(item.key)}" data-keep="title-${esc(item.key)}" value="${esc(item.title)}"></label>
      <label><span class="cmp-lbl">요청 내용 <span class="req" aria-hidden="true">*</span></span><textarea rows="4" maxlength="${COMPOSE_LIMITS.prompt}" data-field="prompt" data-of="${esc(item.key)}" data-key="prompt-${esc(item.key)}" data-keep="prompt-${esc(item.key)}" placeholder="이 업무 하나에 대한 지시를 그대로 적어 주세요. 줄바꿈은 그대로 전달됩니다.">${esc(item.prompt)}</textarea></label>
      <label><span class="cmp-lbl">완료 기준 <span class="help-inline">선택</span></span><input type="text" maxlength="${COMPOSE_LIMITS.done}" data-field="done" data-of="${esc(item.key)}" data-key="done-${esc(item.key)}" data-keep="done-${esc(item.key)}" value="${esc(item.done)}" placeholder="예: 금~목 회신 건수가 표로 정리돼 있다"></label>
      <div class="cmp-files"><button type="button" class="btn btn-sm" data-attach="${esc(item.key)}" data-key="attach-${esc(item.key)}">📎 파일 붙이기</button>
        ${item.attachments.map((a, k) => `<span class="chief-file"><span class="chief-file-name" title="${esc(a.path)}">📄 ${esc(a.name)}</span><button type="button" class="chief-file-remove" data-unattach="${k}" data-of="${esc(item.key)}" data-key="unattach-${esc(item.key)}-${k}" aria-label="${esc(a.name)} 빼기">✕</button></span>`).join('')}
        ${item.uploadError ? `<span class="ibx-error">${esc(item.uploadError)}</span>` : ''}</div>
      ${i > 0 ? `<div class="cmp-deps"><span class="field-label">선행 업무</span>${options(item, i)}</div>` : ''}</fieldset>`).join(''));
    const preview = composePreview(draft);
    setHTML($('composePreview'), `<h3>전송 전 확인 — ${preview.length}건, 이 순서로 한 건씩 처리합니다</h3><ol class="cmp-preview">${preview.map((p) => `<li>${esc(p.title)}${p.attachments ? ` <span class="ibx-soon">첨부 ${p.attachments}</span>` : ''}${p.dependsOn.length ? ` <span class="ibx-soon">${p.dependsOn.join('·')}번 결과 필요</span>` : ''}</li>`).join('')}</ol>`);
    $('composeAdd').disabled = items.length >= COMPOSE_LIMITS.items;
  }
  const itemOf = (key) => draft.items.find((i) => i.key === key);
  function openCompose() {
    $('composeError').hidden = true;
    renderCompose();
    $('composeDialog').showModal();
    $('composeItems').querySelector('textarea')?.focus();
  }
  async function attachTo(key, files) {
    const item = itemOf(key);
    if (!item) return;
    item.uploadError = '';
    for (const file of files) {
      if (item.attachments.length >= COMPOSE_LIMITS.attachments) { item.uploadError = `첨부는 ${COMPOSE_LIMITS.attachments}개까지 붙일 수 있어요.`; break; }
      try { item.attachments.push({ name: file.name, path: await upload(file) }); }
      catch (error) { item.uploadError = `${file.name}: ${error.message} (이 파일만 다시 붙이면 됩니다)`; }
    }
    saveDraft(); renderCompose();
  }
  async function submitCompose(ev) {
    ev.preventDefault();
    if (ui.sending) return;
    const { errors, body } = composePayload(draft);
    const box = $('composeError');
    if (errors.length) { box.textContent = errors.join(' '); box.hidden = false; return; }
    box.hidden = true; ui.sending = true; $('composeSubmit').disabled = true; $('composeSubmit').textContent = '접수하는 중…';
    try {
      let result;
      try { result = await api('POST', '/api/batches', body); }
      catch (error) {
        // 응답을 받지 못했으면 같은 제출 키로 접수 여부부터 확인한다(다시 보내도 같은 번호가 돌아온다)
        if (error.status) throw error;
        const check = await api('GET', `/api/batches?key=${encodeURIComponent(draft.submitKey)}`).catch(() => null);
        if (!check?.batches?.length) throw new Error('접수 응답을 받지 못했어요. 연결을 확인한 뒤 다시 "접수하기"를 눌러 주세요. 같은 내용이 두 번 접수되지는 않습니다.');
        result = { batch: check.batches[0], duplicate: true };
      }
      toast(`${result.batch.total}건을 접수했어요(${result.batch.id}). 접수 순서대로 한 건씩 처리합니다.`);
      draft = emptyDraft(); saveDraft();
      $('composeDialog').close();
      ui.nav = 'all'; ui.report = null; ui.item = result.batch.items[0]?.id || null;
      await refresh(); render();
    } catch (error) { box.textContent = error.message; box.hidden = false; }
    finally { ui.sending = false; $('composeSubmit').disabled = false; $('composeSubmit').textContent = '접수하기'; }
  }

  // ── 조작 ──
  function select(itemId, { focus = true } = {}) {
    ui.item = itemId; ui.report = null;
    renderList(); renderThread().then(() => { if (focus) $('inboxThreadTitle')?.focus({ preventScroll: false }); });
  }
  function closeThread() {
    const back = ui.report ? `report-${ui.report}` : ui.item ? `item-${ui.item}` : null;
    ui.item = null; ui.report = null;
    renderList(); renderThread();
    // 닫으면 골랐던 행으로 초점을 돌려준다
    if (back) $('inboxList').querySelector(`[data-key="${CSS.escape(back)}"]`)?.focus();
  }
  function onClick(ev) {
    const t = ev.target.closest('button, summary');
    if (!t) return;
    if (t.id === 'inboxNew') return openCompose();
    if (t.id === 'inboxThreadClose') return closeThread();
    if (t.dataset.nav) { ui.nav = t.dataset.nav; ui.report = null; if (ui.nav === 'reports') ui.item = null; render(); if (ui.nav === 'needs') loadReconcile(true); return undefined; }
    if (t.dataset.item) return select(t.dataset.item);
    if (t.dataset.report || t.dataset.reportOpen) { ui.report = t.dataset.report || t.dataset.reportOpen; ui.item = null; renderList(); return renderReport().then(() => $('inboxThreadTitle')?.focus()); }
    if (t.dataset.thread) return openThread(t.dataset.thread);
    if (t.dataset.completion) return openCompletion(t.dataset.completion);
    if (t.dataset.csv) return downloadCsv(t.dataset.csv);
    if (t.dataset.rec) return decideReconcile(t);
    if (t.dataset.cancel) return cancelItem(t);
    if (t.dataset.budget) return raiseBudget(t);
    return undefined;
  }
  async function cancelItem(button) {
    const [batchId, no] = [button.dataset.cancel.replace(/-\d+$/, ''), button.dataset.cancel.split('-').at(-1)];
    if (button.dataset.armed !== '1') { button.dataset.armed = '1'; button.textContent = '한 번 더 누르면 취소합니다'; setTimeout(() => { button.dataset.armed = ''; button.textContent = '이 업무 취소'; }, 4000); return; }
    button.disabled = true;
    try { await api('POST', `/api/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(no)}/cancel`); toast('업무를 취소했어요. 다시 깨우지 않습니다.'); await refresh(); }
    catch (error) { toast(error.message, { type: 'error' }); button.disabled = false; }
  }
  async function raiseBudget(button) {
    const calls = Number($('inboxThread').querySelector('[data-keep="budget-add"]')?.value);
    if (!Number.isInteger(calls) || calls < 1) { toast('늘릴 호출 수를 1 이상으로 적어 주세요.', { type: 'error' }); return; }
    button.disabled = true;
    try { await api('POST', `/api/batches/${encodeURIComponent(button.dataset.budget)}/budget`, { calls, reason: '업무함에서 확대' }); toast(`묶음 예산을 ${calls}회 늘렸어요. 기다리던 업무는 스스로 시작하고, 예산 때문에 멈췄던 업무는 그 업무에 "이어서 재개"라고 답해 주세요.`); ui.reports.delete(button.dataset.budget); await refresh(); }
    catch (error) { toast(error.message, { type: 'error' }); }
    finally { button.disabled = false; }
  }

  function render() {
    renderNav(); renderList(); renderThread();
  }

  function init() {
    const view = $('viewInbox');
    view.addEventListener('click', onClick);
    $('inboxReply').addEventListener('submit', sendReply);
    // 작성 중인 답글은 업무별로 기억한다(다른 업무·메뉴를 다녀와도 남는다)
    $('inboxReplyText').addEventListener('input', () => { const id = $('inboxReply').dataset.item; if (id) store(`ai-office-reply-${id}`, $('inboxReplyText').value); });
    view.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && (ui.item || ui.report) && !ev.target.closest('dialog')) { ev.preventDefault(); closeThread(); } });
    const dialog = $('composeDialog');
    $('composeForm').addEventListener('submit', submitCompose);
    $('composeCancel').addEventListener('click', () => dialog.close());
    $('composeAdd').addEventListener('click', () => { draft.items.push(emptyItem()); saveDraft(); renderCompose(); $('composeItems').querySelector('fieldset:last-of-type textarea')?.focus(); });
    $('composeReset').addEventListener('click', () => { draft = emptyDraft(); saveDraft(); renderCompose(); });
    $('composeItems').addEventListener('input', (ev) => {
      const el = ev.target, item = itemOf(el.dataset.of);
      if (!item) return;
      if (el.dataset.field) item[el.dataset.field] = el.value;
      else if (el.dataset.dep) item.dependsOn = el.checked ? [...new Set([...item.dependsOn, el.dataset.dep])] : item.dependsOn.filter((k) => k !== el.dataset.dep);
      saveDraft();
      // 제목·순서 확인 목록만 갱신한다(입력 중인 칸은 다시 그리지 않는다)
      const preview = composePreview(draft);
      setHTML($('composePreview'), `<h3>전송 전 확인 — ${preview.length}건, 이 순서로 한 건씩 처리합니다</h3><ol class="cmp-preview">${preview.map((p) => `<li>${esc(p.title)}${p.attachments ? ` <span class="ibx-soon">첨부 ${p.attachments}</span>` : ''}${p.dependsOn.length ? ` <span class="ibx-soon">${p.dependsOn.join('·')}번 결과 필요</span>` : ''}</li>`).join('')}</ol>`);
    });
    $('composeItems').addEventListener('click', (ev) => {
      const t = ev.target.closest('button');
      if (!t) return;
      if (t.dataset.move) { const i = draft.items.findIndex((x) => x.key === t.dataset.of); draft.items = moveItem(draft.items, i, Number(t.dataset.move)); }
      else if (t.dataset.remove) draft.items = draft.items.filter((x) => x.key !== t.dataset.remove);
      else if (t.dataset.unattach !== undefined) itemOf(t.dataset.of)?.attachments.splice(Number(t.dataset.unattach), 1);
      else if (t.dataset.attach) { const input = $('composeFile'); input.dataset.of = t.dataset.attach; input.value = ''; input.click(); return; }
      else return;
      saveDraft(); renderCompose();
    });
    $('composeFile').addEventListener('change', (ev) => attachTo(ev.target.dataset.of, [...ev.target.files]));
  }
  init();
  return { render, openCompose, select };
}
