// 현황판 화면: /api/board 가 주는 판(panel)·카드·항목을 그대로 그린다. 판이 늘어도 화면은 고치지 않는다.
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

let board = null, managerTouched = false;
function notice(message, error = false) {
  $('bdNotice').textContent = message || '';
  $('bdNotice').hidden = !message;
  $('bdNotice').classList.toggle('is-error', !!error);
}

function itemRow(panel, card, item, done) {
  const key = `${panel.id}:${card.id}:${item.key}`;
  const tags = [...(item.isNew && !done ? ['<span class="bd-tag is-new">새로</span>'] : []), ...(item.tags || []).map((t) => `<span class="bd-tag">${esc(t)}</span>`)].join('');
  return `<li class="bd-item"><div class="bd-item-main"><div class="bd-item-name">${esc(item.name)}${tags}</div>
    <div class="bd-item-sub">${esc([item.sub, item.date].filter(Boolean).join(' · '))}</div></div>
    <button type="button" class="btn btn-sm${done ? ' btn-ghost' : ''}" data-ack="${esc(key)}" data-on="${done ? '0' : '1'}">${done ? '되돌리기' : '확인함'}</button></li>`;
}
function cardHtml(panel, card) {
  const open = card.items.filter((i) => !board.acks[`${panel.id}:${card.id}:${i.key}`]);
  const done = card.items.filter((i) => board.acks[`${panel.id}:${card.id}:${i.key}`]);
  const meta = [card.hint, card.note, card.checkedAt ? `마지막 확인 ${stamp(card.checkedAt)}` : '아직 확인 전', card.when ? `정기 확인 ${card.when}` : ''].filter(Boolean).join(' · ');
  return `<section class="bd-card" id="card-${esc(panel.id)}-${esc(card.id)}"><div class="bd-card-head"><h3>${esc(card.title)}</h3><span class="bd-count${open.length ? ' is-open' : ''}">${open.length}</span>
      ${card.link ? `<a class="btn btn-sm btn-ghost" href="${esc(card.link)}" target="_blank" rel="noopener noreferrer">${esc(panel.source || '원본')} 열기</a>` : ''}</div>
    <p class="bd-card-meta">${esc(meta)}</p>
    ${open.length ? `<ul class="bd-list">${open.map((i) => itemRow(panel, card, i, false)).join('')}</ul>` : `<p class="bd-empty">${card.checkedAt ? '챙길 항목이 없습니다.' : '아직 확인하지 않았습니다.'}</p>`}
    ${done.length ? `<details class="bd-done"><summary>확인한 항목 ${done.length}</summary><ul class="bd-list">${done.map((i) => itemRow(panel, card, i, true)).join('')}</ul></details>` : ''}</section>`;
}
function panelHtml(panel) {
  const tiles = panel.cards.map((card) => {
    const open = card.items.filter((i) => !board.acks[`${panel.id}:${card.id}:${i.key}`]).length;
    return `<a class="bd-tile ${open ? 'is-open' : 'is-zero'}" href="#card-${esc(panel.id)}-${esc(card.id)}"><strong>${open}</strong><span>${esc(card.title)}</span></a>`;
  }).join('');
  return `<section class="bd-panel"><div class="bd-panel-head"><h2>${esc(panel.title)}</h2>
      <span>${esc([panel.manager ? `담당자 ${panel.manager}` : '', panel.updatedAt ? `${stamp(panel.updatedAt)} 기준` : ''].filter(Boolean).join(' · '))}</span></div>
    <div class="bd-tiles">${tiles}</div><div class="bd-cards">${panel.cards.map((c) => cardHtml(panel, c)).join('')}</div></section>`;
}

function render() {
  if (!managerTouched && document.activeElement !== $('bdManager')) $('bdManager').value = board.manager || '';
  $('bdManagers').innerHTML = board.managers.map((m) => `<option value="${esc(m)}"></option>`).join('');
  const errors = board.panels.filter((p) => p.error).map((p) => `${p.title}: ${p.error.message}${p.error.at ? ` (${stamp(p.error.at)})` : ''}`);
  const stale = board.panels.find((p) => p.manager && board.manager && p.manager !== board.manager);
  if (errors.length) notice(errors.join('\n'), true);
  else if (!board.manager) notice('담당자 이름을 먼저 정해 주세요. 위 칸에 본인 이름을 적거나 고르고 저장하면, 그 이름으로 배정된 상담사만 모아 보여 줍니다.');
  else if (stale) notice(`아래 목록은 담당자 ${stale.manager} 기준입니다. "지금 확인"을 누르면 ${board.manager} 기준으로 다시 읽습니다.`);
  else notice('');
  $('bdMain').innerHTML = board.panels.length ? board.panels.map(panelHtml).join('')
    : '<div class="bd-blank">아직 올라온 현황이 없습니다.<br>담당자를 정한 뒤 "지금 확인"을 누르거나, 정기 확인 시각을 기다려 주세요.</div>';
}
async function load() {
  try { board = await api('GET', '/api/board'); render(); }
  catch (error) { if (!board) notice(error.message, true); }
}

$('bdManager').addEventListener('input', () => { managerTouched = true; });
$('bdManagerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try { await api('POST', '/api/board/manager', { name: $('bdManager').value.trim() }); managerTouched = false; await load(); }
  catch (error) { notice(error.message, true); }
});
$('bdMain').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-ack]');
  if (!button) return;
  button.disabled = true;
  try { const result = await api('POST', '/api/board/ack', { key: button.dataset.ack, on: button.dataset.on === '1' }); board.acks = result.acks; render(); }
  catch (error) { notice(error.message, true); button.disabled = false; }
});
$('bdRun').addEventListener('click', async () => {
  $('bdRun').disabled = true;
  try {
    await api('POST', '/api/runs', { prompt: '아테나 주요사항 확인해줘' });
    notice('확인을 시작했습니다. 30초쯤 뒤 이 화면에 반영됩니다.');
  } catch (error) { notice(error.message, true); }
  setTimeout(() => { $('bdRun').disabled = false; }, 15000);
});
load();
setInterval(() => { if (!document.hidden) load(); }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
