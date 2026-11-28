#!/usr/bin/env node
// 광고 선정 자료 수집: 아테나 「아이템별정산현황」(전체 상담사)과 광고 기록 시트(「메인상담사 배너 리스트」)를 한 번에 읽는다.
// Aside 브라우저의 로그인을 쓴다(읽기 전용: 저장·수정·입력 없음). AI를 쓰지 않는다.
// AI 오피스 안의 확정 기록(보관함/광고운영/확정기록.json)이 있으면 광고 이력에 합친다.
//
//   node 보관함/광고운영/도구/ad-collect.cjs --out <폴더> [--prefix <파일 이름 앞가지>] [--month 2026-10] [--skip-sheet] [--skip-athena]
//   node 보관함/광고운영/도구/ad-collect.cjs --check      아테나 로그인과 시트 열람만 확인(시작 전 점검용)
//
// 주소는 같은 폴더의 설정.json에서 읽는다: {"athena":"https://…","sheet":"https://docs.google.com/spreadsheets/d/…"}
// 정산 자료에서 이름·전화번호·주소·금액은 브라우저에서 읽은 자리에서 버리고, 선정에 쓰는 8개 값만 남긴다.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ad = require('./ad-lib.cjs');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const fail = (message) => { console.error(message); process.exit(1); };

function programRoot() {
  if (process.env.AI_OFFICE_PROGRAM) return process.env.AI_OFFICE_PROGRAM;
  for (let dir = __dirname, i = 0; i < 12; i++) {
    const marker = path.join(dir, '.ai-office-workspace');
    if (fs.existsSync(marker)) { const m = fs.readFileSync(marker, 'utf8').match(/^program:\s*(.+)$/m); if (m) return m[1].trim(); }
    if (fs.existsSync(path.join(dir, 'node_modules', 'exceljs'))) return dir;
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  fail('프로그램 폴더를 찾지 못했습니다. 작업 공간의 .ai-office-workspace 파일을 확인하세요.');
}

const configPath = path.join(__dirname, '설정.json');
let config = {};
try { if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { fail('설정.json을 읽지 못했습니다(JSON 형식 확인).'); }
const athena = String(opt('athena') || config.athena || '').replace(/\/+$/, '');
const sheetId = (String(opt('sheet') || config.sheet || '').match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,})/) || [])[1] || '';
const skipSheet = args.includes('--skip-sheet'), skipAthena = args.includes('--skip-athena');
const checkOnly = args.includes('--check');
if (!skipAthena && !/^https:\/\/[^/]+$/.test(athena)) fail('아테나 주소가 없습니다. 보관함/광고운영/도구/설정.json에 {"athena":"https://…"}를 적어 주세요.');
if (!skipSheet && !sheetId) fail('광고 기록 시트 주소가 없습니다. 보관함/광고운영/도구/설정.json에 "sheet":"https://docs.google.com/spreadsheets/d/…"를 적어 주세요.');

function asideBin() {
  const local = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Aside', 'CLI', 'current', 'aside.exe') : '';
  const home = path.join(process.env.HOME || process.env.USERPROFILE || '', '.aside', 'bin', 'aside');
  for (const p of [local, home]) if (p && fs.existsSync(p)) return p;
  return 'aside';
}
function run(code) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '', done = false;
    const finish = (value) => { if (!done) { done = true; clearTimeout(timer); resolve(value); } };
    let child;
    try { child = spawn(asideBin(), ['repl', '--json', '--file', '-'], { windowsHide: true }); } catch (error) { finish({ error }); return; }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* 이미 끝남 */ } finish({ error: new Error('제한 시간 170초 초과') }); }, 170000);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => { stdout += d; }); child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (error) => finish({ error }));
    child.on('close', () => finish({ stdout, stderr }));
    child.stdin.on('error', () => { /* 실행 실패는 close·error에서 알린다 */ });
    child.stdin.end(code);
  });
}
async function repl(code, what) {
  const r = await run(code);
  if (r.error) fail(`Aside를 실행하지 못했습니다(${r.error.message}). Aside 앱과 CLI가 설치돼 있는지 확인해 주세요.`);
  const line = String(r.stdout || '').trim().split('\n').pop();
  let parsed; try { parsed = JSON.parse(line); } catch { fail(`Aside 응답을 읽지 못했습니다(${what}): ${String(r.stdout || r.stderr).slice(-300)}`); }
  const text = (parsed.run?.content || []).map((c) => c.text || '').join('\n');
  const at = text.indexOf('AIO_RESULT');
  if (at < 0) fail(`${what}을(를) 읽지 못했습니다: ${String(parsed.run?.error || text).slice(-300)}`);
  const end = text.indexOf('AIO_END', at);
  return JSON.parse(text.slice(at + 10, end < 0 ? undefined : end));
}

// 정산 기준월: 지정이 없으면 지난달(한국 날짜)
const kst = new Date(Date.now() + 9 * 3600 * 1000);
const defaultMonth = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
const month = opt('month') || defaultMonth;
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail('--month는 YYYY-MM 형식입니다(예: 2026-10).');
const [my, mm] = month.split('-').map(Number);
const monthEnd = `${month}-${String(new Date(Date.UTC(my, mm, 0)).getUTCDate()).padStart(2, '0')}`;

// 아테나: 화면의 「엑셀다운로드(기본)」과 같은 자료를 받아 필요한 열만 남긴다
const athenaCode = (onlyCheck) => `
const AIO = ${JSON.stringify({ origin: athena, start: `${month}-01`, end: monthEnd, onlyCheck })};
// 정산 화면은 띄우는 데만 몇 초가 걸려, 같은 사이트의 가벼운 파일로 탭을 연다(자료는 아래에서 직접 받는다)
const aioTab = await openTab(AIO.origin + '/assets/js/AppCsrfAjax.js');
if (AIO.onlyCheck) {
  const aioLogin = await aioTab.evaluate(async () => { try { const r = await fetch('/items/posting?pt_status=1', { credentials: 'same-origin' }); if (!r.ok) return 'HTTP ' + r.status; return /<input[^>]+type=["']?password/i.test(await r.text()) ? 'login' : ''; } catch (e) { return String(e.message || e); } });
  console.log('AIO_RESULT' + JSON.stringify(aioLogin ? { error: aioLogin } : { ok: true }) + 'AIO_END');
}
else {
  const aioData = await aioTab.evaluate(async (AIO) => {
    try {
      const r = await fetch('/finance/items/excel?start_date=' + AIO.start + '&end_date=' + AIO.end);
      if (!r.ok) return { error: 'HTTP ' + r.status };
      const html = new TextDecoder('utf-8').decode(await r.arrayBuffer());
      if (!/<table[\\s>]/i.test(html)) return { error: 'login' };
      const table = new DOMParser().parseFromString(html, 'text/html').querySelector('table');
      const norm = (v) => String(v || '').replace(/\\s+/g, '');
      const trs = [...table.querySelectorAll('tr')];
      const headRow = trs.find((tr) => tr.querySelector('th')) || trs[0];
      const heads = [...headRow.children].map((c) => norm(c.textContent));
      const find = (name, nth) => { let seen = 0; for (let i = 0; i < heads.length; i++) if (heads[i] === name) { if (seen === (nth || 0)) return i; seen++; } return -1; };
      const idx = { service: find('제공서비스'), category: find('카테고리'), group: find('단계', 0), stage: find('단계', 1), manager: find('담당자'), nickname: find('닉네임'), seconds: find('전체정산초단위'), memo: find('메모') };
      const missing = Object.keys(idx).filter((k) => idx[k] < 0);
      if (missing.length) return { error: 'columns', missing, heads: heads.slice(0, 45) };
      const rows = [];
      trs.forEach((tr, at) => {
        if (tr === headRow) return;
        const cells = [...tr.querySelectorAll('td')].map((c) => c.textContent.replace(/\\s+/g, ' ').trim());
        if (cells.length < heads.length - 2) return;
        rows.push([at + 1, cells[idx.service], cells[idx.category], cells[idx.group], cells[idx.stage], cells[idx.manager], cells[idx.nickname], cells[idx.seconds], cells[idx.memo]]);
      });
      // 활동 상태: 실시간 상담아이템관리의 '승인완료' 목록(닉네임과 단계만 읽는다). 이용중지 아이템의 옛 줄을 가려내는 데 쓴다
      const active = [];
      let activeOk = true, pages = 1;
      try {
        const pageOf = async (n) => { const r2 = await fetch('/items/list/call/?page=' + n + '&it_status=3'); if (!r2.ok) throw new Error('HTTP ' + r2.status); return new DOMParser().parseFromString(await r2.text(), 'text/html'); };
        const read = (doc) => {
          const hs = [...doc.querySelectorAll('table thead th')].map((th) => norm(th.textContent));
          const ci = hs.indexOf('상담사'), si = hs.indexOf('단계'), ti = hs.indexOf('아이템상태');
          if (ci < 0 || si < 0 || ti < 0) return false;
          for (const tr of doc.querySelectorAll('table tbody tr')) {
            const td = [...tr.children].map((c) => c.textContent.replace(/\\s+/g, ' ').trim());
            const m = (td[ci] || '').match(/\\(([^()]*)\\)\\s*$/);
            if (m && td[ti] === '승인완료') active.push([m[1].trim(), td[si]]);
          }
          return true;
        };
        const first = await pageOf(1);
        pages = Math.max(1, ...[...first.querySelectorAll('.pagination a')].map((a) => Number(((a.getAttribute('href') || '').match(/page=(\\d+)/) || [])[1] || 0)));
        activeOk = read(first);
        const queue = []; for (let n = 2; n <= pages; n++) queue.push(n);
        await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) { if (!read(await pageOf(queue.shift()))) activeOk = false; } }));
      } catch (e) { activeOk = false; }
      return { rows, active, activeOk, activePages: pages };
    } catch (e) { return { error: String(e.message || e) }; }
  }, AIO);
  console.log('AIO_RESULT' + JSON.stringify(aioData) + 'AIO_END');
}
await closeTab(aioTab);
`;
// 광고 기록 시트: 전체를 엑셀로 내려받는다(시트는 고치지 않는다)
const sheetCode = (onlyCheck) => `
const aioRes = await fetch(${JSON.stringify(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`)});
const aioType = aioRes.headers.get('content-type') || '';
if (!aioRes.ok || !/spreadsheetml/.test(aioType)) console.log('AIO_RESULT' + JSON.stringify({ error: 'sheet', status: aioRes.status }) + 'AIO_END');
else if (${onlyCheck ? 'true' : 'false'}) console.log('AIO_RESULT' + JSON.stringify({ ok: true }) + 'AIO_END');
else console.log('AIO_RESULT' + JSON.stringify({ base64: Buffer.from(await aioRes.arrayBuffer()).toString('base64') }) + 'AIO_END');
`;
const LOGIN = '아테나 로그인이 필요합니다. Aside 브라우저에서 아테나(관리 프로그램)에 로그인한 뒤 "로그인했어"라고 답해 주세요.';
const SHEET = '광고 기록 시트를 열지 못했습니다. Aside 브라우저의 구글 계정이 그 시트를 볼 수 있는지 확인한 뒤 "확인했어"라고 답해 주세요.';

async function main() {
  if (checkOnly) {
    const [a, b] = await Promise.all([skipAthena ? {} : repl(athenaCode(true), '아테나'), skipSheet ? {} : repl(sheetCode(true), '광고 기록 시트')]);
    if (a.error) fail(LOGIN);
    if (b.error) fail(SHEET);
    console.log('아테나 로그인·광고 기록 시트 열람 확인됨');
    return;
  }
  const out = opt('out');
  if (!out) fail('--out <폴더> 가 필요합니다.');
  fs.mkdirSync(out, { recursive: true });
  const started = Date.now();
  const lines = [];
  const [athenaGot, sheetGot] = await Promise.all([skipAthena ? null : repl(athenaCode(false), '아테나 정산 자료'), skipSheet ? null : repl(sheetCode(false), '광고 기록 시트')]);

  if (!skipAthena) {
    const got = athenaGot;
    if (got.error === 'login') fail(LOGIN);
    if (got.error === 'columns') fail(`아테나 정산 자료에서 필요한 열을 찾지 못했습니다: ${got.missing.join(', ')}. 화면의 열 이름이 바뀌었는지 확인해 주세요.`);
    if (got.error) fail(`아테나 정산 자료를 읽지 못했습니다: ${got.error}`);
    const raw = got.rows.map(([sourceRow, service, category, group, stage, manager, nickname, seconds, memo]) => ({ sourceRow, service, category, group, stage, manager, nickname, seconds, memo }));
    // 제외 글자(타사이동 등)는 규칙 파일을 따른다. 메모는 제외 판정에만 쓰고 저장할 때는 줄인다
    const policyPath = path.join(__dirname, '..', '규칙.json');
    let policyFile = null;
    try { if (fs.existsSync(policyPath)) policyFile = JSON.parse(fs.readFileSync(policyPath, 'utf8').replace(/^\uFEFF/, '')); } catch { fail('규칙.json을 읽지 못했습니다(JSON 형식 확인).'); }
    let normalized;
    try { normalized = ad.normalizeSettlement(raw, policyFile); } catch (e) { fail(`규칙.json 오류: ${e.message}`); }
    const { excluded } = normalized;
    let { duplicates } = normalized;
    let counselors = normalized.counselors.map((c) => ({ ...c, memo: c.memo.slice(0, 80) }));
    // 활동 상태 반영: 승인완료 아이템이 없는 상담사는 빼고, 같은 닉네임의 옛(이용중지) 줄은 가려낸다
    const policy = ad.resolvePolicy(policyFile);
    let activeNote = '';
    let activeInfo = { checked: false };
    if (policy.requireActive) {
      if (!got.activeOk || !(got.active || []).length) activeNote = ' · 활동 상태를 읽지 못해 이용중지 여부는 반영하지 않았습니다';
      else {
        const applied = ad.applyActiveStatus(counselors, got.active.map(([nickname, stage]) => ({ nickname, stage })));
        counselors = applied.counselors; duplicates = applied.unresolved;
        activeInfo = { checked: true, activeItems: got.active.length, inactive: applied.inactive, resolved: applied.resolved };
        activeNote = ` · 아테나 승인완료 ${got.active.length}건과 대조: 이용중지로 뺌 ${applied.inactive.length}줄, 닉네임 중복 정리 ${applied.resolved.length}건`;
      }
    }
    const reasons = {};
    for (const e of excluded) reasons[e.reason] = (reasons[e.reason] || 0) + 1;
    fs.writeFileSync(path.join(out, `${opt('prefix')}정산.json`), JSON.stringify({ source: '아테나 아이템별정산현황', month, period: [`${month}-01`, monthEnd], collectedAt: new Date().toISOString(), total: raw.length, counselors, excludedCount: reasons, excluded: excluded.filter((e) => e.nickname).slice(0, 2000), duplicates, active: activeInfo }, null, 1));
    lines.push(`정산 ${month}: 전체 ${raw.length}행 → 후보 상담사 ${counselors.length}명 (제외 ${excluded.length}행: ${Object.entries(reasons).map(([k, n]) => `${k} ${n}`).join(', ') || '없음'})${duplicates.length ? `, 같은 닉네임 중복 ${duplicates.length}건` : ''}${activeNote}`);
  }

  if (!skipSheet) {
    const got = sheetGot;
    if (got.error) fail(SHEET);
    const ExcelJS = require(path.join(programRoot(), 'node_modules', 'exceljs'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(got.base64, 'base64'));
    const text = (cell) => { const v = cell.value; if (v == null) return ''; if (v instanceof Date) return v.toISOString().slice(0, 10); if (typeof v === 'object') return v.richText ? v.richText.map((r) => r.text).join('') : String(v.result ?? v.text ?? ''); return String(v); };
    const history = [], skipped = [], tabs = [];
    for (const ws of wb.worksheets) {
      let last = 0;
      ws.eachRow({ includeEmpty: false }, (row, n) => { if (row.values.some((v, c) => c >= 2 && v != null && String(v).trim())) last = n; });
      const grid = [];
      for (let r = 1; r <= Math.min(last, 400); r++) { const row = []; for (let c = 1; c <= ws.columnCount; c++) row.push(text(ws.getCell(r, c))); grid.push(row); }
      const parsed = ad.parseHistoryTab(ws.name, grid, {});
      if (!parsed.blocks.length) continue;
      history.push(...parsed.records); skipped.push(...parsed.skipped);
      tabs.push({ name: ws.name, order: wb.worksheets.indexOf(ws), blocks: parsed.blocks });
    }
    // AI 오피스 안의 확정 기록(시트에 넣지 않고 확정한 명단)을 이력에 합친다. 그 주·배너에 시트의 "예정" 이름이 있으면 확정 기록이 대신한다
    const ledgerFile = path.join(__dirname, '..', '확정기록.json');
    let localCount = 0;
    if (fs.existsSync(ledgerFile)) {
      let ledger = [];
      try { ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8').replace(/^\uFEFF/, '')); if (!Array.isArray(ledger)) throw new Error('목록이 아님'); } catch { fail('확정기록.json을 읽지 못했습니다(JSON 형식 확인).'); }
      const slot = (r) => `${r.start}|${r.group}|${r.channel}|${r.banner}`;
      const confirmedWeeks = new Set(ledger.map((r) => r.start));
      for (let i = history.length - 1; i >= 0; i--) if (history[i].status === '예정' && confirmedWeeks.has(history[i].start)) history.splice(i, 1);
      const have = new Set(history.map((h) => `${slot(h)}|${h.nickname}`));
      for (const r of ledger) {
        if (have.has(`${slot(r)}|${r.nickname}`)) continue;
        history.push({ start: r.start, end: r.end, group: r.group, channel: r.channel, banner: r.banner, nickname: r.nickname, status: '확정', original: r.nickname, position: `확정기록 ${r.draftId}` });
        localCount++;
      }
    }
    if (!tabs.length) fail('광고 기록 시트에서 그린/퍼플 전화·채팅 탭을 찾지 못했습니다. 탭 이름을 확인해 주세요.');
    const weeks = [...new Set(history.filter((h) => h.status === '확정').map((h) => h.start))].sort();
    const planned = history.filter((h) => h.status === '예정');
    fs.writeFileSync(path.join(out, `${opt('prefix')}이력.json`), JSON.stringify({ source: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`, collectedAt: new Date().toISOString(), firstWeek: weeks[0] || '', lastWeek: weeks.at(-1) || '', tabs, history, skipped }, null, 1));
    lines.push(`광고 기록: ${tabs.length}개 탭 ${history.length}건 (${weeks[0] || '-'} 주 ~ ${weeks.at(-1) || '-'} 주, 예정 ${planned.length}건, 메모로 뺀 칸 ${skipped.length}${localCount ? `, AI 오피스 확정 기록 ${localCount}건 포함` : ''})`);
  }
  for (const line of lines) console.log(line);
  console.log(`걸린 시간 ${Math.round((Date.now() - started) / 1000)}초`);
}
main().catch((error) => fail(String(error.message || error)));
