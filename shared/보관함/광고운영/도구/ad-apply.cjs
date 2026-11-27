#!/usr/bin/env node
// 광고 선정 확정: 운영자가 확정한 초안의 명단을 확정 기록으로 남긴다. AI를 쓰지 않는다.
// 기본은 AI 오피스 안의 파일에만 남긴다(보관함/광고운영/확정기록.json). 구글 시트는 건드리지 않는다. 다음 초안은 이 기록을 광고 이력에 합쳐 계산한다.
// 설정.json에 "applyTarget":"sheet"를 적은 PC에서만 광고 기록 시트(「메인상담사 배너 리스트」)의 해당 주 열에 넣고 다시 읽어 대조한다(Aside 브라우저의 구글 로그인).
// 지시에 "다시 확정"·"덮어"가 있거나 --replace 를 주면, 같은 주에 이미 확정된 다른 초안의 기록을 이 초안으로 바꾼다(파일 방식만).
//
//   node 보관함/광고운영/도구/ad-apply.cjs --draft <광고선정초안.json> --confirm <초안 ID> [--weeks 2026-12-07,2026-12-14] [--out <폴더>] [--prefix <앞가지>] [--dry-run]
//   node 보관함/광고운영/도구/ad-apply.cjs --brief <업무 brief.md> --find outputs --out <폴더>     고정 절차용: 대표 지시([[지시]]…[[/지시]])에 적힌 초안 ID로 초안을 찾아 반영한다.
//                                                                                              지시에 "2주차"처럼 적혀 있으면 그 주만 넣는다. 지시에 초안 ID가 없으면 쓰지 않는다.
//
// --confirm 의 초안 ID가 파일의 ID와 같아야 쓴다(다른 초안을 잘못 반영하지 않게). --dry-run 은 쓸 내용만 보여 준다.
// 쓰기 전에 확인하는 것: 검증 문제 0건, 탭·구역이 예상한 자리인지, 구역 칸 수가 명단보다 적지 않은지,
//   넣을 열에 이미 다른 이름이 적혀 있지 않은지(초안에 든 이름만 있으면 그대로 진행).
// 주소는 같은 폴더의 설정.json: {"sheet":"https://docs.google.com/spreadsheets/d/…","googleUser":1}
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ad = require('./ad-lib.cjs');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const fail = (message) => { console.error(message); process.exit(1); };
const dryRun = args.includes('--dry-run');

const configPath = path.join(__dirname, '설정.json');
let config = {};
try { if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { fail('설정.json을 읽지 못했습니다(JSON 형식 확인).'); }
const sheetId = (String(opt('sheet') || config.sheet || '').match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,})/) || [])[1] || '';
if (!sheetId && String(config.applyTarget || 'file') === 'sheet') fail('광고 기록 시트 주소가 없습니다. 보관함/광고운영/도구/설정.json에 "sheet":"https://docs.google.com/spreadsheets/d/…"를 적어 주세요.');
const user = Number.isInteger(Number(config.googleUser)) ? Number(config.googleUser) : 0;
const sheetUrl = `https://docs.google.com/spreadsheets/u/${user}/d/${sheetId}/edit`;

// 고정 절차: 지시문에서 초안 ID를 읽고 업무 폴더들에서 그 초안을 찾는다
let draftPath = opt('draft'), confirmId = opt('confirm'), ordinals = [], asked = { text: '' };
if (opt('brief')) {
  if (!fs.existsSync(opt('brief'))) fail(`업무 설명 파일이 없습니다(${opt('brief')}).`);
  asked = ad.parseRequest(fs.readFileSync(opt('brief'), 'utf8'));
  if (!asked.draftId) fail('지시에 초안 ID가 없어 반영하지 않았습니다. 확정할 초안의 ID(예: AD-20261207-4W-XXXXXX)를 적어 다시 지시해 주세요. 초안 ID는 초안 요약 첫 줄에 있습니다.');
  confirmId = asked.draftId; ordinals = asked.weekOrdinals;
  const found = [];
  const walk = (dir, depth) => {
    let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth < 5 && !e.name.startsWith('.')) walk(p, depth + 1); }
      else if (e.name.endsWith('광고선정초안.json')) { try { if (JSON.parse(fs.readFileSync(p, 'utf8')).draftId === confirmId) found.push({ p, t: fs.statSync(p).mtimeMs }); } catch { /* 다른 파일 */ } }
    }
  };
  walk(opt('find') || 'outputs', 0);
  if (!found.length) fail(`초안 ${confirmId}를 찾지 못했습니다. 초안을 만든 업무가 이 PC에 있는지, ID를 맞게 적었는지 확인해 주세요.`);
  draftPath = found.sort((a, b) => b.t - a.t)[0].p;
}
if (!draftPath) fail('--draft <광고선정초안.json> 이 필요합니다.');
let draft;
try { draft = JSON.parse(fs.readFileSync(draftPath, 'utf8')); } catch (e) { fail(`초안 파일을 읽지 못했습니다: ${e.message}`); }
if (!dryRun && confirmId !== draft.draftId) fail(`확정할 초안 ID가 맞지 않습니다. 이 파일의 초안은 ${draft.draftId} (v${draft.version})입니다. 확정하려면 --confirm ${draft.draftId} 로 지정해 주세요.`);
const weeks = opt('weeks') ? opt('weeks').split(',').map((w) => ad.formatDay(ad.mondayOf(w.trim()))).filter(Boolean)
  : ordinals.length ? ordinals.sort().map((n) => draft.weeks[n - 1]).filter(Boolean) : draft.weeks;
const outside = weeks.filter((w) => !draft.weeks.includes(w));
if (outside.length || !weeks.length) fail(`초안에 없는 주차입니다: ${outside.join(', ') || '(없음)'}. 이 초안의 주차: ${draft.weeks.join(', ')}`);
// 초안 파일이 만든 뒤 손으로 바뀌었으면 확정하지 않는다(명단은 조정 도구로 바꾸고 초안을 다시 만든다)
if (draft.rowsHash && require('crypto').createHash('sha256').update(JSON.stringify([draft.rows, draft.policy])).digest('hex').slice(0, 16) !== draft.rowsHash) fail('초안 파일이 만든 뒤 바뀌어 확정하지 않았습니다. 명단을 바꾸려면 조정(넣기·빼기)을 등록하고 초안을 다시 만들어 주세요.');
const problems = ad.validateDraft(draft.rows.filter((r) => weeks.includes(r.week)), draft.policy);
if (problems.length) fail(`검증 문제가 있어 반영하지 않았습니다:\n${problems.slice(0, 10).join('\n')}`);

// ---- 파일 방식(기본): AI 오피스 안의 확정 기록에만 남긴다
if (String(config.applyTarget || 'file') !== 'sheet') {
  const ledgerFile = path.join(__dirname, '..', '확정기록.json');
  let ledger = [];
  try { if (fs.existsSync(ledgerFile)) ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8').replace(/^\uFEFF/, '')); if (!Array.isArray(ledger)) throw new Error('목록이 아님'); } catch { fail('확정기록.json을 읽지 못했습니다(JSON 형식 확인). 고치기 전에는 확정하지 않습니다.'); }
  const rows = draft.rows.filter((r) => r.result === '선정' && weeks.includes(r.week));
  const others = ledger.filter((r) => weeks.includes(r.start) && r.draftId !== draft.draftId);
  const mine = ledger.filter((r) => weeks.includes(r.start) && r.draftId === draft.draftId);
  const sig = (list) => list.map((r) => [r.start ?? r.week, r.group, r.channel, r.banner, r.nickname].join('|')).sort().join('\n');
  const replace = args.includes('--replace') || /다시\s*확정|덮어/.test(asked.text || '');
  console.log(`확정 대상 ${draft.draftId} v${draft.version}: ${weeks.join(', ')} (${weeks.length}주), 이름 ${rows.length}칸 — AI 오피스 안의 확정 기록에만 남깁니다(구글 시트는 건드리지 않음)`);
  const outDirFile = opt('out') || path.dirname(draftPath);
  fs.mkdirSync(outDirFile, { recursive: true });
  const writeResult = (extra) => fs.writeFileSync(path.join(outDirFile, `${opt('prefix')}확정결과.json`), JSON.stringify({ draftId: draft.draftId, version: draft.version, weeks, target: '확정기록.json(AI 오피스 안)', expected: rows.length, ...extra }, null, 1));
  if (mine.length && sig(mine) === sig(rows) && !others.length) { if (!dryRun) writeResult({ alreadyApplied: true, matched: rows.length, ok: true, checkedAt: new Date().toISOString() }); console.log(`이미 확정돼 있습니다: 확정 기록의 ${weeks.length}주 명단 ${rows.length}칸이 초안과 같습니다. 다시 쓰지 않았습니다.`); process.exit(0); }
  if (others.length && !replace) fail(`같은 주에 이미 확정된 다른 초안이 있어 확정하지 않았습니다: ${[...new Set(others.map((r) => `${r.draftId}(${r.start})`))].join(', ')}. 이 초안으로 바꾸려면 "초안 ${draft.draftId} 다시 확정해줘"라고 지시해 주세요.`);
  if (dryRun) { console.log('미리 보기만 했습니다(--dry-run). 확정 기록에는 쓰지 않았습니다.'); process.exit(0); }
  const appliedAt = new Date().toISOString();
  const next = [...ledger.filter((r) => !weeks.includes(r.start)), ...rows.map((r) => ({ start: r.week, end: r.end, group: r.group, channel: r.channel, banner: r.banner, seq: r.seq, nickname: r.nickname, status: '확정', draftId: draft.draftId, appliedAt }))];
  if (fs.existsSync(ledgerFile)) fs.copyFileSync(ledgerFile, `${ledgerFile}.bak`);
  fs.writeFileSync(ledgerFile, JSON.stringify(next, null, 1));
  // 다시 읽어 대조한다
  const saved = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).filter((r) => weeks.includes(r.start));
  const ok = sig(saved) === sig(rows);
  writeResult({ appliedAt, matched: ok ? rows.length : 0, replaced: [...new Set(others.map((r) => r.draftId))], ok });
  if (!ok) fail('확정 기록을 다시 읽은 내용이 초안과 다릅니다. 확정기록.json을 확인해 주세요(바꾸기 전 파일은 확정기록.json.bak).');
  console.log(`확정 완료: 확정 기록의 ${weeks.length}주 명단 ${rows.length}칸이 초안과 같습니다${others.length ? ` (바꾼 초안: ${[...new Set(others.map((r) => r.draftId))].join(', ')})` : ''}. 다음 초안부터 이 명단이 광고 이력으로 계산됩니다.`);
  console.log('구글 시트에는 넣지 않았습니다. 시트에 옮길 때는 초안 엑셀의 탭별 명단(시트와 같은 모양)을 쓰면 됩니다.');
  process.exit(0);
}

function asideBin() {
  const local = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Aside', 'CLI', 'current', 'aside.exe') : '';
  const home = path.join(process.env.HOME || process.env.USERPROFILE || '', '.aside', 'bin', 'aside');
  for (const p of [local, home]) if (p && fs.existsSync(p)) return p;
  return 'aside';
}
// 지금 시트 상태: 수집 도구로 읽는다(읽기만)
function readSheet() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-apply-'));
  const r = spawnSync(process.execPath, [path.join(__dirname, 'ad-collect.cjs'), '--skip-athena', '--sheet', `https://docs.google.com/spreadsheets/d/${sheetId}/edit`, '--out', dir], { encoding: 'utf8', timeout: 200000 });
  if (r.status !== 0) fail(String(r.stderr || r.stdout).trim().split('\n').filter(Boolean).at(-1) || '광고 기록 시트를 읽지 못했습니다.');
  const data = JSON.parse(fs.readFileSync(path.join(dir, '이력.json'), 'utf8'));
  fs.rmSync(dir, { recursive: true, force: true });
  return data;
}
const colNo = (letters) => letters.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const label = (w) => `${w.slice(5).replace('-', '.')} ~ ${ad.formatDay(ad.addDays(w, 6)).slice(5).replace('-', '.')}`;
const namesOf = (week, group, channel, banner) => draft.rows.filter((r) => r.result === '선정' && r.week === week && r.group === group && r.channel === channel && r.banner === banner)
  .sort((a, b) => Number(a.seq) - Number(b.seq)).map((r) => r.nickname);

// 탭마다 넣을 자리와 내용을 정한다. 문제가 있으면 한 칸도 쓰지 않는다
function plan(sheet) {
  const jobs = [], blockers = [];
  for (const tab of sheet.tabs) {
    const group = ad.normGroup(tab.name), channel = ad.normChannel(tab.name);
    const top = Math.min(...tab.blocks.map((b) => b.headerRow)), bottom = Math.max(...tab.blocks.map((b) => b.lastRow));
    const known = {};
    let lastCol = 2;
    for (const b of tab.blocks) for (const c of b.columns) { known[c.start] = colNo(c.column); lastCol = Math.max(lastCol, colNo(c.column)); }
    const cols = [];
    for (const w of weeks) { if (!known[w]) known[w] = ++lastCol; cols.push(known[w]); }
    if (cols.some((c, i) => i && c !== cols[i - 1] + 1)) { blockers.push(`${tab.name}: 넣을 주차 열이 이어져 있지 않습니다(${weeks.join(', ')}).`); continue; }
    const matrix = Array.from({ length: bottom - top + 1 }, () => weeks.map(() => ''));
    for (const b of tab.blocks) {
      weeks.forEach((w, wi) => {
        matrix[b.headerRow - top][wi] = label(w);
        const names = namesOf(w, group, channel, b.banner);
        const rows = b.lastRow - b.firstRow + 1;
        if (names.length > rows) { blockers.push(`${tab.name} ${b.banner}: 시트의 칸이 ${rows}줄인데 ${w} 주 명단이 ${names.length}명입니다. 시트에서 이 구역에 줄을 ${names.length - rows}개 더 넣어 주세요.`); return; }
        const existing = sheet.history.filter((h) => h.start === w && h.group === group && h.channel === channel && h.banner === b.banner).map((h) => h.nickname);
        const strangers = existing.filter((n) => !names.includes(n));
        if (strangers.length) blockers.push(`${tab.name} ${b.banner} ${w} 주: 시트에 초안과 다른 이름이 이미 적혀 있습니다(${strangers.length}명). 시트를 확인하거나 초안을 다시 만들어 주세요.`);
        names.forEach((n, i) => { matrix[b.firstRow - top + i][wi] = n; });
      });
    }
    const first = tab.blocks.slice().sort((a, b) => a.firstRow - b.firstRow)[0];
    jobs.push({ name: tab.name, order: tab.order, anchor: `${ad.columnLetter(cols[0])}${top}`, matrix, expectCell: `B${first.firstRow}`, expect: [group, channel], count: matrix.flat().filter((v) => v && !/~/.test(v)).length });
  }
  for (const key of ['그린|전화', '그린|채팅', '퍼플|전화', '퍼플|채팅']) if (!sheet.tabs.some((t) => `${ad.normGroup(t.name)}|${ad.normChannel(t.name)}` === key)) blockers.push(`시트에서 ${key.replace('|', ' ')}상담 탭을 찾지 못했습니다.`);
  return { jobs, blockers };
}
// 반영 뒤 대조: 시트의 그 주 명단이 초안과 같은지(순서 포함)
function compare(sheet) {
  const diffs = [];
  let matched = 0;
  for (const tab of sheet.tabs) for (const b of tab.blocks) for (const w of weeks) {
    const group = ad.normGroup(tab.name), channel = ad.normChannel(tab.name);
    const want = namesOf(w, group, channel, b.banner);
    const got = sheet.history.filter((h) => h.start === w && h.status === '확정' && h.group === group && h.channel === channel && h.banner === b.banner).map((h) => h.nickname);
    if (want.join('\n') === got.join('\n')) matched += want.length;
    else diffs.push(`${tab.name} ${b.banner} ${w}: 초안 ${want.length}명, 시트 ${got.length}명`);
  }
  return { matched, diffs };
}

const before = readSheet();
const { jobs, blockers } = plan(before);
const total = jobs.reduce((n, j) => n + j.count, 0);
console.log(`반영 대상 ${draft.draftId} v${draft.version}: ${weeks.join(', ')} (${weeks.length}주), 이름 ${total}칸`);
for (const j of jobs) console.log(`  ${j.name}: ${j.anchor}부터 ${j.matrix.length}줄 × ${weeks.length}열, 이름 ${j.count}칸`);
if (blockers.length) fail(`반영하지 않았습니다(시트는 그대로입니다):\n${blockers.map((b) => `  - ${b}`).join('\n')}`);
const already = compare(before);
if (!already.diffs.length && total > 0) {
  const dirDone = opt('out') || path.dirname(draftPath); fs.mkdirSync(dirDone, { recursive: true });
  if (!dryRun) fs.writeFileSync(path.join(dirDone, `${opt('prefix')}확정결과.json`), JSON.stringify({ draftId: draft.draftId, version: draft.version, weeks, alreadyApplied: true, matched: already.matched, expected: total, diffs: [], ok: true, checkedAt: new Date().toISOString() }, null, 1));
  console.log(`이미 반영돼 있습니다: 시트의 ${weeks.length}주 명단 ${already.matched}칸이 초안과 같습니다. 다시 쓰지 않았습니다.`); process.exit(0); }
if (dryRun) { console.log('미리 보기만 했습니다(--dry-run). 시트에는 쓰지 않았습니다.'); process.exit(0); }

const code = `
const AIO = ${JSON.stringify({ url: sheetUrl, jobs })};
const aioOut = { written: [], error: '' };
try {
  const aioInfo = await googleSheets.getSpreadsheetInfo(AIO.url);
  for (const job of AIO.jobs) {
    const sheet = aioInfo.sheets[job.order];
    if (!sheet) throw new Error(job.name + ' 탭을 찾지 못했습니다');
    const data = await googleSheets.readSheet(AIO.url, sheet.gid);
    const cell = data.cells.find((c) => c.cell === job.expectCell);
    const text = String(cell && cell.value || '');
    if (!job.expect.every((word) => text.includes(word))) throw new Error(job.name + ' 탭의 ' + job.expectCell + ' 칸이 예상과 다릅니다(' + text.replace(/\\s+/g, ' ').slice(0, 20) + ')');
    job.gid = sheet.gid;
  }
  for (const job of AIO.jobs) {
    await googleSheets.connect(AIO.url + '#gid=' + job.gid);
    // 열린 탭이 맞는지 쓰기 직전에 한 번 더 본다(구역 이름 칸을 골라 읽는다)
    await googleSheets.navigateToCell(job.expectCell);
    const picked = JSON.stringify(await googleSheets.readSelection());
    if (!job.expect.every((word) => picked.includes(word))) throw new Error(job.name + ' 탭이 열리지 않았습니다(다른 탭이 열려 있어 쓰지 않았습니다)');
    await googleSheets.writeMatrix(job.anchor, job.matrix);
    await sleep(1500);
    await googleSheets.dispose();
    aioOut.written.push(job.name);
  }
} catch (e) { aioOut.error = String(e.message || e); try { await googleSheets.dispose(); } catch {} }
console.log('AIO_RESULT' + JSON.stringify(aioOut) + 'AIO_END');
`;
const started = Date.now();
const r = spawnSync(asideBin(), ['repl', '--json', '--file', '-'], { input: code, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 280000 });
if (r.error) fail(`Aside를 실행하지 못했습니다(${r.error.message}).`);
let wrote = { written: [], error: 'Aside 응답을 읽지 못했습니다' };
try {
  const text = (JSON.parse(String(r.stdout || '').trim().split('\n').pop()).run?.content || []).map((c) => c.text || '').join('\n');
  const at = text.indexOf('AIO_RESULT'); if (at >= 0) wrote = JSON.parse(text.slice(at + 10, text.indexOf('AIO_END', at)));
} catch { /* 아래에서 다시 읽어 실제 상태로 판단한다 */ }

// 쓰기 결과가 불확실해도 다시 쓰지 않는다. 시트를 다시 읽어 실제로 들어간 것을 보고한다
const after = readSheet();
const result = compare(after);
const record = { draftId: draft.draftId, version: draft.version, weeks, sheet: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`, appliedAt: new Date().toISOString(), writtenTabs: wrote.written, writeError: wrote.error || '', matched: result.matched, expected: total, diffs: result.diffs, ok: !result.diffs.length };
const outDir = opt('out') || path.dirname(draftPath);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${opt('prefix')}확정결과.json`), JSON.stringify(record, null, 1));
const ledger = path.join(__dirname, '..', '반영기록.json');
let log = []; try { log = JSON.parse(fs.readFileSync(ledger, 'utf8')); } catch { log = []; }
log.push(record); fs.writeFileSync(ledger, JSON.stringify(log, null, 1));
console.log(`쓴 탭 ${wrote.written.length}/${jobs.length}${wrote.error ? ` (오류: ${wrote.error})` : ''} · 걸린 시간 ${Math.round((Date.now() - started) / 1000)}초`);
if (record.ok) console.log(`반영 완료: 다시 읽은 시트의 ${weeks.length}주 명단 ${result.matched}칸이 초안과 같습니다.`);
else fail(`반영이 끝나지 않았습니다. 시트와 초안이 다른 곳 ${result.diffs.length}군데:\n${result.diffs.slice(0, 12).map((d) => `  - ${d}`).join('\n')}\n다시 반영하기 전에 시트를 확인해 주세요.`);
