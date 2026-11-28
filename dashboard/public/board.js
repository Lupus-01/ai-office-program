// 현황판 화면: /api/board 가 주는 판(panel)·카드·항목을 그대로 그린다. 판이 늘어도 화면은 고치지 않는다.
// 보는 순서: 맨 위 합계 → 확인 주기(when)별 묶음 → 챙길 것이 있는 카드 먼저, 없는 카드는 한 줄로 접는다.
const $ = (id) => document.getElementById(id);
const token = document.querySelector('meta[name="office-token"]')?.content || '';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
try { const theme = localStorage.getItem('ai-office-theme-v2'); if (theme) document.documentElement.dataset.theme = theme; } catch { /* 저장 불가 환경은 기본 테마 */ }

async function api(method, path, body) {
  const init = { method, headers: { 'X-Office-Token': token, 'Content-Type': 'application/json', Accept: 'application/json' } };
  if (method !== 'GET') init.body = JSON.stringify(body ?? {});
  let res;
  try { res = await fetch(path, init); } catch { throw new Error('서버에 연결할 수 없어요. 대시보드 서버가 켜져 있는지 확인해 주세요.'); }
  let data = null;
  try { data = await res.json(); } catch { /* 본문 없음 */ }
  if (!res.ok) throw new Error(data?.error || `요청이 실패했어요 (HTTP ${res.status})`);
  return data;
}

// "11월 28일 10:30" (한국 시각)
export function stamp(value) {
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return '';
  const k = new Date(at + 9 * 3600e3);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}
// 원본마다 다른 날짜 표기(2026.11.27 / 2026-11-27 10:00)를 "11월 27일"로 맞춘다. 올해가 아니면 연도를 붙인다
export function dayLabel(value, now = Date.now()) {
  const m = String(value || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (!m) return String(value || '');
  const year = new Date(now + 9 * 3600e3).getUTCFullYear();
  return `${Number(m[1]) !== year ? `${m[1]}년 ` : ''}${Number(m[2])}월 ${Number(m[3])}일`;
}
const dayKey = (value) => { const m = String(value || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/); return m ? `${m[1]}${m[2].padStart(2, '0')}${m[3].padStart(2, '0')}` : ''; };
// 걸린 표현 "[카톡]"은 눈에 띄게 표시한다
const marked = (text) => esc(text).replace(/\[([^\[\]]{1,24})\]/g, '<mark>$1</mark>');

const FOLD = 5; // 카드 하나에 먼저 보여 주는 항목 수
let board = null, managerTouched = false;
const expanded = new Set(); // 전체를 펼친 카드
function notice(message, error = false) {
  $('bdNotice').textContent = message || '';
  $('bdNotice').hidden = !message;
  $('bdNotice').classList.toggle('is-error', !!error);
}
const ackKey = (panel, card, item) => `${panel.id}:${card.id}:${item.key}`;
const split = (panel, card) => {
  const open = [], done = [];
  for (const item of card.items) (board.acks[ackKey(panel, card, item)] ? done : open).push(item);
  // 새로 생긴 것 먼저, 그다음 최근 날짜 순
  open.sort((a, b) => Number(b.isNew) - Number(a.isNew) || dayKey(b.date).localeCompare(dayKey(a.date)));
  return { open, done };
};

function itemRow(panel, card, item, done) {
  const tags = [...(item.isNew && !done ? ['<span class="bd-tag is-new">새로</span>'] : []), ...(item.tags || []).map((t) => `<span class="bd-tag">${esc(t)}</span>`)].join('');
  return `<li class="bd-item"><div class="bd-item-main"><div class="bd-item-head"><span class="bd-item-name">${esc(item.name)}</span>${tags}${item.date ? `<time class="bd-item-date">${esc(dayLabel(item.date))}</time>` : ''}</div>
    ${item.sub ? `<div class="bd-item-sub">${marked(item.sub)}</div>` : ''}</div>
    <button type="button" class="btn btn-sm${done ? ' btn-ghost' : ''}" data-ack="${esc(ackKey(panel, card, item))}" data-on="${done ? '0' : '1'}" aria-label="${esc(item.name)} ${done ? '다시 챙길 것으로' : '확인함으로 접기'}">${done ? '되돌리기' : '확인함'}</button></li>`;
}
function cardHtml(panel, card) {
  const { open, done } = split(panel, card);
  const id = `${panel.id}-${card.id}`;
  const link = card.link ? `<a class="bd-link" href="${esc(card.link)}" target="_blank" rel="noopener noreferrer">${esc(panel.source || '원본')}에서 보기 ↗</a>` : '';
  const doneBox = done.length ? `<details class="bd-done"><summary>확인한 항목 ${done.length}</summary><ul class="bd-list">${done.map((i) => itemRow(panel, card, i, true)).join('')}</ul></details>` : '';
  // 챙길 것이 없는 카드는 한 줄로
  if (!open.length) {
    return `<section class="bd-card is-clear" id="card-${esc(id)}"><div class="bd-card-head"><h3>${esc(card.title)}</h3><span class="bd-clear">${card.checkedAt ? '챙길 것 없음' : '아직 확인 전'}</span>${link}</div>${doneBox}</section>`;
  }
  const all = expanded.has(id) || open.length <= FOLD + 1;
  const shown = all ? open : open.slice(0, FOLD);
  return `<section class="bd-card" id="card-${esc(id)}"><div class="bd-card-head"><h3>${esc(card.title)}</h3><span class="bd-count">${open.length}</span>${link}</div>
    <p class="bd-card-meta">${esc([card.hint, card.note].filter(Boolean).join(' · '))}</p>
    <ul class="bd-list">${shown.map((i) => itemRow(panel, card, i, false)).join('')}</ul>
    <div class="bd-card-foot">${all ? '' : `<button type="button" class="btn btn-sm btn-ghost" data-more="${esc(id)}">${open.length - FOLD}건 더 보기</button>`}
      ${open.length >= 3 ? `<button type="button" class="btn btn-sm btn-ghost" data-ack-all="${esc(id)}">모두 확인함</button>` : ''}</div>
    ${doneBox}</section>`;
}
function panelHtml(panel) {
  // 확인 주기(when)가 같은 카드끼리 묶는다. 판 파일의 카드 순서를 따른다
  const groups = [];
  for (const card of panel.cards) {
    let group = groups.find((g) => g.when === (card.when || ''));
    if (!group) groups.push(group = { when: card.when || '', cards: [] });
    group.cards.push(card);
  }
  const sections = groups.map((group) => {
    const withOpen = group.cards.filter((c) => split(panel, c).open.length), clear = group.cards.filter((c) => !split(panel, c).open.length);
    const checked = group.cards.map((c) => c.checkedAt).filter(Boolean).sort().at(-1);
    const count = group.cards.reduce((n, c) => n + split(panel, c).open.length, 0);
    return `<section class="bd-group"><div class="bd-group-head"><h3>${esc(group.when || '확인')}</h3>${checked ? `<span class="bd-group-count${count ? ' is-open' : ''}">${count ? `챙길 것 ${count}건` : '챙길 것 없음'}</span>` : ''}
        <span class="bd-group-time">${checked ? `마지막 확인 ${esc(stamp(checked))}` : '아직 확인 전'}</span></div>
      ${withOpen.length ? `<div class="bd-cards">${withOpen.map((c) => cardHtml(panel, c)).join('')}</div>` : ''}
      ${clear.length ? `<div class="bd-clears">${clear.map((c) => cardHtml(panel, c)).join('')}</div>` : ''}</section>`;
  }).join('');
  const total = panel.cards.reduce((n, c) => n + split(panel, c).open.length, 0);
  const tiles = panel.cards.map((card) => {
    const open = split(panel, card).open.length;
    return `<a class="bd-tile ${open ? 'is-open' : 'is-zero'}" href="#card-${esc(panel.id)}-${esc(card.id)}"><strong>${open}</strong><span>${esc(card.title)}</span></a>`;
  }).join('');
  return `<section class="bd-panel"><div class="bd-panel-head"><h2>${esc(panel.title)}</h2><span class="bd-total${total ? ' is-open' : ''}">${total ? `챙길 것 ${total}건` : '챙길 것이 없습니다'}</span>
      <span class="bd-panel-sub">${esc([panel.manager ? `담당자 ${panel.manager}` : '', panel.updatedAt ? `${stamp(panel.updatedAt)} 기준` : ''].filter(Boolean).join(' · '))}</span></div>
    <nav class="bd-tiles" aria-label="${esc(panel.title)} 요약">${tiles}</nav>${sections}</section>`;
}

function render() {
  if (!managerTouched && document.activeElement !== $('bdManager')) $('bdManager').value = board.manager || '';
  $('bdManagers').innerHTML = board.managers.map((m) => `<option value="${esc(m)}"></option>`).join('');
  $('bdManagerSave').hidden = !managerTouched && !!board.manager;
  const errors = board.panels.filter((p) => p.error).map((p) => `${p.title}: ${p.error.message}${p.error.at ? ` (${stamp(p.error.at)})` : ''}`);
  const stale = board.panels.find((p) => p.manager && board.manager && p.manager !== board.manager);
  if (errors.length) notice(errors.join('\n'), true);
  else if (!board.manager) notice('담당자 이름을 먼저 정해 주세요. 위 칸에 본인 이름을 적거나 고르고 저장하면, 그 이름으로 배정된 상담사만 모아 보여 줍니다.');
  else if (stale) notice(`아래 목록은 담당자 ${stale.manager} 기준입니다. "지금 확인"을 누르면 ${board.manager} 기준으로 다시 읽습니다.`);
  else if (!runNotice) notice('');
  // 펼쳐 둔 "확인한 항목"은 다시 그려도 그대로 둔다
  const openDetails = new Set([...document.querySelectorAll('.bd-card')].filter((c) => c.querySelector('details[open]')).map((c) => c.id));
  $('bdMain').innerHTML = board.panels.length ? board.panels.map(panelHtml).join('')
    : '<div class="bd-blank"><strong>아직 올라온 현황이 없습니다</strong><br>담당자를 정한 뒤 "지금 확인"을 누르거나, 정기 확인 시각을 기다려 주세요.</div>';
  for (const id of openDetails) document.getElementById(id)?.querySelector('details')?.setAttribute('open', '');
  const total = board.panels.reduce((n, p) => n + p.cards.reduce((m, c) => m + split(p, c).open.length, 0), 0);
  document.title = `${total ? `(${total}) ` : ''}현황판 · AI Office`;
}
let runNotice = false;
async function load() {
  try { board = await api('GET', '/api/board'); render(); }
  catch (error) { if (!board) notice(error.message, true); }
}
async function ack(keys, on) {
  const result = await api('POST', '/api/board/ack', keys.length === 1 ? { key: keys[0], on } : { keys, on });
  board.acks = result.acks; render();
}

$('bdManager').addEventListener('input', () => { managerTouched = true; $('bdManagerSave').hidden = false; });
$('bdManagerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try { await api('POST', '/api/board/manager', { name: $('bdManager').value.trim() }); managerTouched = false; await load(); }
  catch (error) { notice(error.message, true); }
});
$('bdMain').addEventListener('click', async (event) => {
  const more = event.target.closest('[data-more]');
  if (more) { expanded.add(more.dataset.more); render(); return; }
  const all = event.target.closest('[data-ack-all]');
  const button = all || event.target.closest('[data-ack]');
  if (!button) return;
  button.disabled = true;
  try {
    if (all) {
      const keys = [];
      for (const panel of board.panels) for (const card of panel.cards) if (`${panel.id}-${card.id}` === all.dataset.ackAll) keys.push(...split(panel, card).open.map((i) => ackKey(panel, card, i)));
      if (keys.length) await ack(keys, true);
    } else await ack([button.dataset.ack], button.dataset.on === '1');
  } catch (error) { notice(error.message, true); button.disabled = false; }
});
$('bdRun').addEventListener('click', async () => {
  $('bdRun').disabled = true; $('bdRun').textContent = '확인하는 중…';
  try {
    // 주요사항(배정·계약·포스팅·멘토/멘티)과 규정 점검을 차례로 접수한다. 인센티브는 매달 15일 예약으로만 돈다
    await api('POST', '/api/runs', { prompt: '아테나 주요사항 확인해줘' });
    await api('POST', '/api/runs', { prompt: '아테나 1:1 문의·후기 규정 점검해줘' });
    runNotice = true; notice('확인을 시작했습니다. 1~2분 뒤 이 화면에 반영됩니다.');
  } catch (error) { notice(error.message, true); }
  setTimeout(() => { $('bdRun').disabled = false; $('bdRun').textContent = '지금 확인'; runNotice = false; }, 90000);
});
load();
setInterval(() => { if (!document.hidden) load(); }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
