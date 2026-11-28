// 현황판 매출 화면: /api/board/sales 가 주는 일·월 기록으로 일 비교·월 비교를 그린다. 계산은 sales-calc.js가 한다(AI 없음).
import { DAY_BASES, compare, dayPair, explain, monthPair } from './sales-calc.js';

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
function notice(message, error = false) {
  $('slNotice').textContent = message || '';
  $('slNotice').hidden = !message;
  $('slNotice').classList.toggle('is-error', !!error);
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const dayName = (d) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일(${DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;
const monthName = (m) => `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;
const stamp = (value) => { const at = Date.parse(value); if (!Number.isFinite(at)) return ''; const k = new Date(at + 9 * 3600e3); return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`; };

// 값 표기: 금액·건수는 쉼표, 시간은 시간 단위 소수 1자리, 성공률은 %
function show(value, unit) {
  if (value == null) return '–';
  if (unit === '시간') return `${(value / 3600).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}시간`;
  if (unit === '%') return `${value.toFixed(2)}%`;
  const whole = Math.abs(value - Math.round(value)) < 0.05;
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: whole || unit === '원' ? 0 : 1 })}${unit}`;
}
function showDiff(value, unit) {
  if (value == null) return '–';
  const zero = unit === '시간' ? Math.abs(value) < 180 : unit === '%' ? Math.abs(value) < 0.005 : Math.abs(value) < 0.05;
  if (zero) return '변동 없음';
  return `${value > 0 ? '+' : '−'}${show(Math.abs(value), unit)}${unit === '%' ? 'p' : ''}`;
}
const dir = (v) => v == null || Math.abs(v) < 1e-9 ? '' : v > 0 ? ' is-up' : ' is-down';
const pctText = (v) => v == null || Math.abs(v) < 0.05 ? '' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;

// 아테나에 통화·충전 통계가 쌓이기 전 기간(판매상품매출만 있음)은 비교해도 뜻이 없다
const thin = (v) => v.total != null && !v.calls && !v.charge;
const THIN = '아테나에 통화·코인충전 통계가 쌓이기 전 기간이 섞여 있어 이 비교는 맞지 않습니다. 다른 날짜나 달을 골라 주세요.';
let data = null;
const state = { day: '', dayBase: 'prev', month: '' };

function hero(rows, curName, baseName) {
  const t = rows.find((r) => r.key === 'total');
  return `<div class="sl-hero"><div class="sl-hero-main"><span class="sl-hero-label">${esc(curName)} 매출합계</span><strong>${esc(show(t.cur, '원'))}</strong></div>
    <div class="sl-hero-delta${dir(t.diff)}"><span>${esc(baseName)} ${esc(show(t.base, '원'))}</span><strong>${t.diff == null ? '비교 기록 없음' : `${t.diff > 0 ? '▲' : t.diff < 0 ? '▼' : ''} ${esc(showDiff(t.diff, '원'))}${t.pct == null ? '' : ` (${esc(pctText(t.pct))})`}`}</strong></div></div>`;
}
// 매출합계를 이루는 세 항목의 증감을 막대로: 어디서 빠졌고 어디서 올랐는지 한눈에
function mixBars(rows) {
  const mix = rows.filter((r) => r.mix && r.diff != null);
  const max = Math.max(1, ...mix.map((r) => Math.abs(r.diff)));
  if (!mix.length) return '';
  return `<div class="sl-mix" role="list" aria-label="매출합계 증감의 구성">${mix.map((r) => `<div class="sl-mix-row${dir(r.diff)}" role="listitem"><span class="sl-mix-name">${esc(r.label)}</span>
    <span class="sl-mix-track"><i style="width:${(Math.abs(r.diff) / max * 50).toFixed(1)}%"></i></span>
    <span class="sl-mix-val">${esc(showDiff(r.diff, '원'))}${r.pct == null ? '' : ` <small>${esc(pctText(r.pct))}</small>`}</span></div>`).join('')}</div>`;
}
function table(rows, curName, baseName) {
  let group = '';
  const body = rows.map((r) => {
    const head = r.group !== group ? `<tr class="sl-group"><th colspan="5" scope="colgroup">${esc(group = r.group)}</th></tr>` : '';
    return `${head}<tr class="${r.key === 'total' ? 'is-total' : ''}${r.sub ? ' is-sub' : ''}"><th scope="row">${esc(r.label)}</th><td>${esc(show(r.base, r.unit))}</td><td>${esc(show(r.cur, r.unit))}</td>
      <td class="sl-diff${dir(r.diff)}">${esc(showDiff(r.diff, r.unit))}</td><td class="sl-diff${dir(r.diff)}">${esc(pctText(r.pct))}</td></tr>`;
  }).join('');
  return `<div class="sl-table-wrap"><table class="sl-table"><thead><tr><th scope="col">항목</th><th scope="col">${esc(baseName)}</th><th scope="col">${esc(curName)}</th><th scope="col">증감</th><th scope="col">증감률</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
// 추이 막대: 누르면 그 날·달을 고른다
function trend(list, selected, marked, kind, live) {
  const max = Math.max(1, ...list.map((r) => r.total));
  return `<div class="sl-trend" role="group" aria-label="매출합계 추이">${list.map((r) => {
    const label = kind === 'day' ? dayName(r.d) : monthName(r.d);
    return `<button type="button" class="sl-bar${r.d === selected ? ' is-on' : ''}${marked.includes(r.d) ? ' is-base' : ''}${r.d === live ? ' is-live' : ''}" data-${kind}="${esc(r.d)}" title="${esc(`${label} ${show(r.total, '원')}${r.d === live ? ' (집계 중)' : ''}`)}" aria-label="${esc(`${label} ${show(r.total, '원')}`)}" aria-pressed="${r.d === selected}">
      <i style="height:${Math.max(2, r.total / max * 100).toFixed(1)}%"></i><span>${esc(kind === 'day' ? String(Number(r.d.slice(8, 10))) : `${Number(r.d.slice(5, 7))}월`)}</span></button>`;
  }).join('')}</div>`;
}
const seg = (name, list, on) => `<div class="sl-seg" role="group">${list.map((b) => `<button type="button" class="${b.id === on ? 'is-on' : ''}" data-${name}="${b.id}" aria-pressed="${b.id === on}">${esc(b.label)}</button>`).join('')}</div>`;

function daySection() {
  const days = data.days, today = data.today;
  const pair = dayPair(days, state.day, state.dayBase);
  const rows = compare(pair.cur, pair.base);
  const baseName = DAY_BASES.find((b) => b.id === state.dayBase).label;
  const curName = dayName(state.day);
  const window = days.filter((r) => r.d <= days[0].d).slice(0, 35).reverse();
  const notes = [state.day === today ? '오늘은 아직 집계 중인 값입니다.' : '', pair.missing ? `기준 ${pair.missing}일의 기록이 없어 있는 날만으로 비교했습니다.` : '', /^(avg7|dow4)$/.test(state.dayBase) ? '기준 값은 하루 평균입니다.' : ''].filter(Boolean);
  return `<section class="sl-sec" aria-labelledby="slDayTitle"><div class="sl-head"><h2 id="slDayTitle">일 비교</h2>
      <label class="sl-pick">날짜 <input type="date" id="slDay" value="${esc(state.day)}" min="${esc(days.at(-1).d)}" max="${esc(days[0].d)}"></label>${seg('daybase', DAY_BASES, state.dayBase)}</div>
    ${hero(rows, curName, baseName)}<p class="sl-explain">${esc(thin(pair.base) || thin(pair.cur) ? THIN : explain(rows, baseName))}</p>${notes.length ? `<p class="sl-note">${esc(notes.join(' '))}</p>` : ''}
    ${mixBars(rows)}${trend(window, state.day, pair.baseDays, 'day', today)}${table(rows, curName, baseName)}</section>`;
}
function monthSection() {
  const months = data.months;
  const pair = monthPair(months, data.days, state.month, data.today);
  const rows = compare(pair.cur, pair.base);
  const baseLabel = '전월';
  const curName = pair.partial ? `${monthName(state.month)} 1~${pair.upto}일` : monthName(state.month);
  const baseName = pair.partial ? `${monthName(pair.baseMonth)} 같은 기간` : monthName(pair.baseMonth);
  const avg = (v, n) => v == null || !n ? '' : show(v / n, '원');
  const perDay = pair.curDays && pair.baseDays && pair.cur.total != null && pair.base.total != null ? `하루 평균 ${avg(pair.cur.total, pair.curDays)} · 기준 ${avg(pair.base.total, pair.baseDays)} (${pair.curDays}일 대 ${pair.baseDays}일)` : '';
  const notes = [pair.note || '', pair.partial && !pair.note ? '진행 중인 달이라 어제까지의 누계를 기준 달의 같은 날짜까지와 비교했습니다.' : '', perDay].filter(Boolean);
  const list = months.slice(0, 14).reverse();
  return `<section class="sl-sec" aria-labelledby="slMonthTitle"><div class="sl-head"><h2 id="slMonthTitle">월 비교</h2>
      <label class="sl-pick">달 <select id="slMonth">${months.map((r) => `<option value="${esc(r.d)}"${r.d === state.month ? ' selected' : ''}>${esc(monthName(r.d))}${r.d === data.today.slice(0, 7) ? ' (진행 중)' : ''}</option>`).join('')}</select></label><span class="sl-note">전월과 비교</span></div>
    ${hero(rows, curName, baseName)}<p class="sl-explain">${esc(thin(pair.base) || thin(pair.cur) ? THIN : explain(rows, pair.partial ? `${baseLabel} 같은 기간` : baseLabel))}</p>${notes.length ? `<p class="sl-note">${esc(notes.join(' '))}</p>` : ''}
    ${mixBars(rows)}${trend(list, state.month, [pair.baseMonth], 'month', data.today.slice(0, 7))}${table(rows, curName, baseName)}</section>`;
}

function render() {
  const main = $('slMain');
  if (!data.days.length || !data.months.length) {
    main.innerHTML = `<div class="bd-blank"><strong>아직 읽어 온 매출 기록이 없습니다</strong><br>위의 "지금 확인"을 누르면 아테나 매출관리의 일간·월간 통계를 읽어 옵니다. Aside 브라우저에 아테나 로그인이 필요합니다.</div>`;
    return;
  }
  if (!data.days.some((r) => r.d === state.day)) state.day = (data.days.find((r) => r.d < data.today) || data.days[0]).d;
  if (!data.months.some((r) => r.d === state.month)) state.month = data.months[0].d;
  const keep = document.activeElement?.id;
  main.innerHTML = `${daySection()}${monthSection()}<p class="sl-foot">매출합계 = 코인충전매출 + 060매출 + 판매상품매출(아테나 표의 계산식, VAT 제외 표기 그대로). 코인 사용은 충전한 코인이 통화·채팅에 쓰인 금액이라 매출합계에 더하지 않습니다. 성공률의 평균은 통화 건수로 가중한 근삿값입니다.${data.notes.length ? ` ${esc(data.notes.join(' '))}` : ''}</p>`;
  if (keep && $(keep)) $(keep).focus();
}

let runNotice = false;
async function load() {
  try {
    const next = await api('GET', '/api/board/sales');
    const changed = !data || next.updatedAt !== data.updatedAt || next.error?.at !== data.error?.at;
    data = next;
    $('slSub').textContent = data.updatedAt ? `아테나 매출관리 기준 · 마지막 확인 ${stamp(data.updatedAt)}` : '아테나 매출관리의 일간·월간 통계를 비교합니다.';
    if (data.error) notice(`마지막 확인이 실패했습니다(${stamp(data.error.at)}): ${data.error.message}`, true);
    else if (!runNotice) notice('');
    if (changed) { if (runNotice && data.updatedAt) { runNotice = false; notice(''); } render(); }
  } catch (error) { notice(error.message, true); }
}

$('slMain').addEventListener('click', (event) => {
  const el = event.target.closest('button');
  if (!el) return;
  const d = el.dataset;
  if (d.day) state.day = d.day; else if (d.month) state.month = d.month; else if (d.daybase) state.dayBase = d.daybase; else return;
  render();
});
$('slMain').addEventListener('change', (event) => {
  if (event.target.id === 'slDay' && data.days.some((r) => r.d === event.target.value)) { state.day = event.target.value; render(); }
  if (event.target.id === 'slMonth') { state.month = event.target.value; render(); }
});
$('slRun').addEventListener('click', async () => {
  $('slRun').disabled = true; $('slRun').textContent = '확인하는 중…';
  try { await api('POST', '/api/runs', { prompt: '아테나 매출 확인해줘' }); runNotice = true; notice('확인을 시작했습니다. 1분쯤 뒤 이 화면에 반영됩니다.'); }
  catch (error) { notice(error.message, true); }
  setTimeout(() => { $('slRun').disabled = false; $('slRun').textContent = '지금 확인'; runNotice = false; }, 90000);
});
load();
setInterval(() => { if (!document.hidden) load(); }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
