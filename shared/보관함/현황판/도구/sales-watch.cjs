#!/usr/bin/env node
// 아테나 매출 확인: 매출관리의 일간통계·월간통계 표를 읽어 현황판 매출 화면(보관함/현황판/매출/매출.json)에 올린다.
// Aside 브라우저의 아테나 로그인을 쓴다(읽기 전용: 조회만 한다). AI를 쓰지 않는다. 비교·증감 계산은 화면이 한다.
//
//   node 보관함/현황판/도구/sales-watch.cjs [--out <결과.json>] [--days <처음 읽을 일수>]
//        --days 400 처럼 길게 주면 더 앞의 날까지 채운다(20일에 약 10초)
//   node 보관함/현황판/도구/sales-watch.cjs --check      아테나 로그인만 확인(시작 전 점검용)
//
// 아테나 주소: 같은 폴더의 설정.json {"athena":"https://…"} (없으면 보관함/광고운영/도구/설정.json의 athena)
// 처음에는 최근 130일과 20개월을 읽고, 그 뒤에는 최근 40일만 다시 읽어 기존 기록에 합친다(지난 날의 정정도 반영된다).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? String(args[i + 1] ?? '') : ''; };
const board = opt('vault') || path.join(__dirname, '..');
const dataFile = path.join(board, '매출', '매출.json');
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return fallback; } };
const writeJson = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(data)}\n`); fs.renameSync(tmp, file); };
const nowIso = () => new Date().toISOString();
const checkOnly = args.includes('--check');
const KEEP_DAYS = 800, KEEP_MONTHS = 60;

const empty = () => ({ version: 1, source: '아테나 매출관리', updatedAt: '', error: null, notes: [], days: [], months: [] });
// 실패해도 화면에 사유가 보이게 남긴다(지난 기록은 그대로 둔다)
function fail(message) {
  if (!checkOnly) {
    const data = readJson(dataFile, null) || empty();
    data.error = { at: nowIso(), message };
    try { writeJson(dataFile, data); } catch { /* 기록하지 못해도 사유는 출력한다 */ }
  }
  console.error(message); process.exit(1);
}

const toolConfig = readJson(path.join(__dirname, '설정.json'), {});
const adConfig = readJson(path.join(board, '..', '광고운영', '도구', '설정.json'), {});
const athena = String(opt('athena') || toolConfig.athena || adConfig.athena || '').replace(/\/+$/, '');
if (!/^https:\/\/[^/]+$/.test(athena)) fail('아테나 주소가 없습니다. 보관함/현황판/도구/설정.json에 {"athena":"https://…"}를 적어 주세요.');

// 한국 시각 기준 날짜
const kstDay = (back = 0) => new Date(Date.now() + 9 * 3600e3 - back * 86400e3).toISOString().slice(0, 10);
const old = readJson(dataFile, null);
const had = old && old.version === 1 && Array.isArray(old.days) && old.days.length >= 60;
const span = Math.min(800, Math.max(7, Number(opt('days')) || (had ? 40 : 130)));
const monthSpan = had && (old.months || []).length >= 13 ? 3 : 20;

function asideBin() {
  const local = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Aside', 'CLI', 'current', 'aside.exe') : '';
  const home = path.join(process.env.HOME || process.env.USERPROFILE || '', '.aside', 'bin', 'aside');
  for (const p of [local, home]) if (p && fs.existsSync(p)) return p;
  return 'aside';
}
function repl(code, what) {
  const r = spawnSync(asideBin(), ['repl', '--json', '--file', '-'], { input: code, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 240000 });
  if (r.error) fail(`Aside를 실행하지 못했습니다(${r.error.message}). Aside 앱과 CLI가 설치돼 있는지 확인해 주세요.`);
  const line = String(r.stdout || '').trim().split('\n').pop();
  let parsed; try { parsed = JSON.parse(line); } catch { fail(`Aside 응답을 읽지 못했습니다(${what}).`); }
  const text = (parsed.run?.content || []).map((c) => c.text || '').join('\n');
  const at = text.indexOf('AIO_RESULT');
  if (at < 0) fail(`${what}을(를) 읽지 못했습니다: ${String(parsed.run?.error || '').slice(-200) || '응답 없음'}`);
  const end = text.indexOf('AIO_END', at);
  return JSON.parse(text.slice(at + 10, end < 0 ? undefined : end));
}

// ── 브라우저(아테나 탭) 안에서 도는 수집 코드 ──
async function collect(AIO) {
  const get = async (u) => {
    const r = await fetch(u, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u.split('?')[0]);
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    if (doc.querySelector('input[type=password]')) { const e = new Error('login'); e.login = true; throw e; }
    return doc;
  };
  const num = (t) => { const v = Number(String(t).replace(/[^\d.-]/g, '')); return Number.isFinite(v) ? v : 0; };
  const sec = (t) => { const m = (re) => { const x = String(t).match(re); return x ? Number(x[1]) : 0; }; return m(/(\d+)\s*시간/) * 3600 + m(/(\d+)\s*분/) * 60 + m(/(\d+)\s*초/); };
  // 한 칸에 여러 값이 줄(<br>·<p>)로 들어 있다
  const parts = (td) => td.innerHTML.replace(/<!--[\s\S]*?-->/g, '').split(/<br\s*\/?>|<\/p>/i).map((x) => x.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  const WANT = { day: '통계일', calls: '전체통화', split: '성공통화', rate: '통화성공률', tAll: '전체통화시간', tCoin: '코인통화시간', t060: '060통화시간', tChat: '코인채팅시간', sold: '판매건수', coinCall: '코인통화매출', s060: '060매출', coinChat: '코인채팅매출', charge: '코인충전매출', product: '판매상품매출', total: '매출합계', usd: '$' };
  const read = (doc, keyRe) => {
    const table = doc.querySelector('table');
    if (!table) return null;
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.innerHTML.split(/<br/i)[0].replace(/<[^>]+>/g, '').replace(/\s+/g, ''));
    const at = {};
    for (const [key, word] of Object.entries(WANT)) { at[key] = heads.findIndex((h) => key === 'usd' ? h.startsWith('$') : key === 'calls' || key === 'tAll' ? h === word : h.includes(word)); if (at[key] < 0 && key !== 'usd') return null; }
    const rows = [];
    for (const tr of table.querySelectorAll('tbody tr')) {
      const c = [...tr.children];
      const key = (c[at.day]?.textContent || '').trim();
      if (!keyRe.test(key)) continue; // 합계 줄은 건너뛴다
      const sp = parts(c[at.split]).map(num);
      rows.push({ d: key, calls: num(c[at.calls].textContent), ok: sp[0] || 0, fail: sp[1] || 0, short: sp[2] || 0, rate: num(c[at.rate].textContent),
        tAll: sec(c[at.tAll].textContent), tCoin: sec(c[at.tCoin].textContent), t060: sec(c[at.t060].textContent), tChat: sec(c[at.tChat].textContent),
        sold: parts(c[at.sold]).map(num).slice(0, 5), coinCall: parts(c[at.coinCall]).map(num).slice(0, 3), s060: parts(c[at.s060]).map(num).slice(0, 3), coinChat: parts(c[at.coinChat]).map(num).slice(0, 3),
        charge: num(c[at.charge].textContent), product: num(c[at.product].textContent), total: num(c[at.total].textContent), usd: at.usd >= 0 ? num(c[at.usd].textContent) : 0 });
    }
    return rows;
  };
  try {
    await get('/items/posting?pt_status=1'); // 로그인 확인은 빨리 뜨는 화면으로 한다
    if (AIO.onlyCheck) return { ok: true };
    const days = [], months = [];
    // 아테나는 한 로그인의 요청을 차례로 처리한다(동시에 불러도 빨라지지 않는다). 하나씩 읽는다
    for (const job of AIO.jobs) {
      const rows = read(await get(job.url), job.kind === 'day' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/);
      if (!rows) return { error: 'columns', where: job.kind === 'day' ? '일간통계' : '월간통계' };
      (job.kind === 'day' ? days : months).push(...rows);
    }
    return { days, months };
  } catch (e) { return { error: e.login ? 'login' : String(e.message || e) }; }
}

// 아테나 표는 한 쪽에 20줄이다. 20일·20개월 단위로 끊어 요청하면 쪽 넘김 없이 한 번에 한 묶음씩 읽는다
const jobs = [];
for (let back = 0; back < span; back += 20) jobs.push({ kind: 'day', url: `/sales/daily?start_date=${kstDay(Math.min(span, back + 20) - 1)}&end_date=${kstDay(back)}` });
{
  const d = new Date(Date.now() + 9 * 3600e3); d.setUTCDate(1);
  const ym = (n) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() - n); return x; };
  const last = (x) => new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  for (let back = 0; back < monthSpan; back += 20) jobs.push({ kind: 'month', url: `/sales/monthly?start_date=${ym(Math.min(monthSpan, back + 20) - 1).toISOString().slice(0, 10)}&end_date=${back ? last(ym(back)) : kstDay(0)}` });
}
// 요청 하나에 7~10초가 걸려, 한 번의 Aside 실행(제한 약 2분)에 6개씩 나눠 맡긴다
const code = (onlyCheck, batch) => `
const AIO = ${JSON.stringify({ origin: athena, onlyCheck, jobs: batch })};
const aioTab = await openTab(AIO.origin + '/assets/js/AppCsrfAjax.js');
// 한 번의 호출 제한(30초)을 넘으므로, 수집을 시작해 두고 끝났는지 짧게 물어본다
await aioTab.evaluate((AIO) => { window.__aioDone = null; (${collect.toString()})(AIO).then((r) => { window.__aioDone = r; }, (e) => { window.__aioDone = { error: String(e && e.message || e) }; }); }, AIO);
let aioData = null;
for (let i = 0; i < 66 && !aioData; i++) { await new Promise((r) => setTimeout(r, 1500)); aioData = await aioTab.evaluate(() => window.__aioDone); }
if (!aioData) aioData = { error: '아테나 응답이 100초 안에 끝나지 않았습니다' };
console.log('AIO_RESULT' + JSON.stringify(aioData) + 'AIO_END');
await closeTab(aioTab);
`;

const got = { days: [], months: [] };
for (let i = 0; i < (checkOnly ? 1 : jobs.length); i += 6) {
  const part = repl(code(checkOnly, jobs.slice(i, i + 6)), '아테나 매출');
  if (part.error) { got.error = part.error; got.where = part.where; break; }
  if (checkOnly) break;
  got.days.push(...part.days); got.months.push(...part.months);
}
if (got.error === 'login') fail('아테나 로그인이 필요합니다. Aside 브라우저에서 아테나(관리 프로그램)에 로그인한 뒤 "로그인했어"라고 답해 주세요.');
if (got.error === 'columns') fail(`아테나 매출관리 ${got.where} 화면에서 필요한 열을 찾지 못했습니다. 화면 구성이 바뀌었는지 확인해 주세요.`);
if (got.error) fail(`아테나를 읽지 못했습니다: ${got.error}`);
if (checkOnly) { console.log('점검 통과: 아테나 로그인 확인'); process.exit(0); }
if (!got.days.length) fail('일간통계에서 읽은 날짜가 없습니다. 아테나 매출관리 화면을 확인해 주세요.');

// 기존 기록에 합친다(새로 읽은 날·달이 이긴다)
const merge = (before, fresh, keep) => { const map = new Map(); for (const row of [...(Array.isArray(before) ? before : []), ...fresh]) if (row && typeof row.d === 'string') map.set(row.d, row); return [...map.values()].sort((a, b) => b.d.localeCompare(a.d)).slice(0, keep); };
const days = merge(old?.days, got.days, KEEP_DAYS), months = merge(old?.months, got.months, KEEP_MONTHS);
const notes = [];
// 매출합계 = 코인충전매출 + 060매출 + 판매상품매출 (아테나 표의 계산식). 어긋난 날이 있으면 알린다
const off = got.days.filter((r) => r.total !== r.charge + (r.s060[0] || 0) + r.product).length;
if (off) notes.push(`매출합계가 구성 항목의 합과 다른 날이 ${off}일 있습니다(아테나 표 그대로 실었습니다)`);
const data = { version: 1, source: '아테나 매출관리', updatedAt: nowIso(), today: kstDay(0), error: null, notes, days, months };
writeJson(dataFile, data);

// 금액은 결과 요약에 싣지 않는다(화면에서 본다)
const summary = { ok: true, checkedAtKST: `${kstDay(0)} ${new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16)}`, readDays: got.days.length, readMonths: got.months.length, keptDays: days.length, keptMonths: months.length, latestDay: days[0]?.d || '', notes, view: '대시보드 → 현황판 → 매출' };
if (opt('out')) writeJson(opt('out'), summary);
console.log(`매출 확인 완료: 일간 ${got.days.length}일·월간 ${got.months.length}개월을 읽어 현황판 매출 화면에 올렸습니다(보관 ${days.length}일·${months.length}개월).`);
