#!/usr/bin/env node
// 광고 선정 초안: ad-collect.cjs가 모은 정산·이력과 보관함의 규칙·희망·예외·이월로 1주 또는 4주 명단을 계산해 JSON과 엑셀로 쓴다.
// 계산만 한다(AI 없음, 시트·원장에 쓰지 않음).
//
//   node 보관함/광고운영/도구/ad-draft.cjs --in <수집 폴더> --out <폴더> [--prefix <앞가지>] [--start 2026-12-07] [--weeks 1|4] [--brief <업무 brief.md>] [--force]
// --brief: 업무 폴더의 brief.md(대표 지시가 [[지시]]…[[/지시]]로 들어 있다)에서 시작 주차와 1주/4주를 읽는다.
//
// 기본은 1주 초안이다: 시작 주차를 주지 않으면 광고 기록(시트 + 확정 기록)의 마지막 주 다음 월요일부터 1주. 4주는 지시에 "4주"라고 적었을 때만 만든다.
// 보관함/광고운영/ 의 선택 파일: 규칙.json(선정 기준), 희망.json, 예외.json, 이월.json — 없으면 기본 규칙·빈 목록으로 계산한다.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
const readJson = (file, label, required) => {
  if (!fs.existsSync(file)) { if (required) fail(`${label} 파일이 없습니다(${file}). 먼저 자료 수집(ad-collect.cjs)을 실행해 주세요.`); return null; }
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { fail(`${label} 파일을 읽지 못했습니다(JSON 형식 확인): ${e.message}`); }
};
const listOf = (data, key) => (Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : []);

const inDir = opt('in'), outDir = opt('out'), prefix = opt('prefix');
if (!inDir || !outDir) fail('--in <수집 폴더> 와 --out <폴더> 가 필요합니다.');
const settlement = readJson(path.join(inDir, `${prefix}정산.json`), '정산 자료', true);
const collected = readJson(path.join(inDir, `${prefix}이력.json`), '광고 기록', true);
const vault = opt('vault') || path.join(__dirname, '..');
const policyFile = readJson(path.join(vault, '규칙.json'), '규칙');
const wishesRaw = listOf(readJson(path.join(vault, '희망.json'), '광고 희망'), 'wishes');
const exceptions = listOf(readJson(path.join(vault, '예외.json'), '예외 설정'), 'exceptions');
const carryovers = listOf(readJson(path.join(vault, '이월.json'), '이월 대기'), 'carryovers');
const request = opt('brief') && fs.existsSync(opt('brief')) ? ad.parseRequest(fs.readFileSync(opt('brief'), 'utf8')) : {};

let policy;
try { policy = ad.resolvePolicy(policyFile); } catch (e) { fail(`규칙.json 오류: ${e.message}`); }

const history = collected.history || [];
const lastWeek = collected.lastWeek || '';
const startAsked = opt('start') || request.startDate || '';
const start = ad.formatDay(ad.mondayOf(startAsked || (lastWeek ? ad.addDays(lastWeek, 7) : ad.nextMonday(new Date(Date.now() + 9 * 3600 * 1000)))));
const weekCount = Number(opt('weeks') || request.weekCount || 1);
if (!start) fail(`시작 주차를 읽지 못했습니다(${startAsked}). YYYY-MM-DD로 적어 주세요.`);
if (![1, 4].includes(weekCount)) fail('생성 범위는 1주 또는 4주만 가능합니다.');
const weeks = Array.from({ length: weekCount }, (_, i) => ad.formatDay(ad.addDays(start, i * 7)));
const filled = weeks.filter((w) => history.some((h) => h.status === '확정' && h.start === w));
if (filled.length && !args.includes('--force')) fail(`이미 광고 기록 시트에 명단이 있는 주가 들어 있습니다: ${filled.join(', ')}. 시트에 확정된 마지막 주는 ${lastWeek}입니다. 그다음 주(${ad.formatDay(ad.addDays(lastWeek, 7))})부터 지정해 주세요.`);

// 희망의 그룹은 정산 자료에서 찾는다(닉네임이 하나일 때만)
const byName = {};
for (const c of settlement.counselors) (byName[c.nickname] ||= []).push(c);
const wishes = wishesRaw.map((w, i) => {
  const nickname = ad.clean(w.nickname);
  const found = byName[nickname] || [];
  return { id: w.id || `WISH-${String(i + 1).padStart(3, '0')}`, registeredAt: w.registeredAt || '', nickname, channel: w.channel, banner: w.banner, group: w.group || (found.length === 1 ? found[0].group : ''), status: w.status || '대기' };
});
// 시트의 "예정" 열에 미리 적힌 이름은 그 주의 정해진 자리로 본다
for (const h of history) if (h.status === '예정' && h.start < weeks[0]) h.status = '확정';
const placedByHand = [];
for (const e of exceptions) {
  if (ad.clean(e.type) !== '지정' || !(e.enabled === undefined || ad.asBoolean(e.enabled))) continue;
  const nickname = ad.clean(e.nickname);
  const found = byName[nickname] || [];
  const group = e.group || (found.length === 1 ? found[0].group : '');
  const from = ad.formatDay(ad.mondayOf(e.start)), until = e.end ? ad.formatDay(ad.mondayOf(e.end)) : from;
  for (const w of weeks) if (from && w >= from && w <= until) placedByHand.push({ week: w, group, channel: e.channel, banner: e.banner, nickname, source: `지정 ${e.id || ''}`.trim(), force: true });
}
const handKeys = new Set(placedByHand.map((p) => `${p.week}|${p.nickname}|${ad.bannerKey(p.group, p.channel, p.banner)}`));
const preassigned = [...placedByHand, ...history.filter((h) => h.status === '예정' && weeks.includes(h.start) && !handKeys.has(`${h.start}|${h.nickname}|${ad.bannerKey(h.group, h.channel, h.banner)}`)).map((h) => ({ week: h.start, group: h.group, channel: h.channel, banner: h.banner, nickname: h.nickname, source: `시트 ${h.position}` }))];

let draft;
try { draft = ad.generateDraft({ startDate: start, weekCount, policy, counselors: settlement.counselors, wishes, history, carryovers, exceptions, preassigned }); } catch (e) { fail(e.message); }

const policyHash = crypto.createHash('sha256').update(JSON.stringify(policy)).digest('hex').slice(0, 8);
const inputHash = crypto.createHash('sha256').update(JSON.stringify([settlement.month, settlement.counselors, history.map((h) => [h.start, h.group, h.channel, h.banner, h.nickname, h.status]), wishes, exceptions, carryovers, policy])).digest('hex').slice(0, 6);
const draftId = `AD-${start.replace(/-/g, '')}-${weekCount}W-${inputHash.toUpperCase()}`;
const picked = draft.rows.filter((r) => r.result === '선정');
const problems = ad.validateDraft(draft.rows, policy);
const emptySlots = draft.slots.filter((s) => s.empty > 0);
const meta = {
  draftId, version: 1, createdAt: new Date().toISOString(), startDate: start, weekCount, weeks, settlementMonth: settlement.month, settlementCollectedAt: settlement.collectedAt,
  historySource: collected.source, historyLastWeek: lastWeek, policy: policyFile ? `규칙.json(${policyHash})` : `기본 규칙(${policyHash})`, engine: ad.VERSION,
  counts: { counselors: settlement.counselors.length, wishes: wishes.filter((w) => w.status === '대기').length, exceptions: exceptions.length, carryovers: carryovers.length, preassigned: preassigned.length },
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${prefix}광고선정초안.json`), JSON.stringify({ ...meta, summary: draft.summary, slots: draft.slots, rows: draft.rows, warnings: draft.warnings, duplicates: draft.duplicates, problems, policy }, null, 1));

async function writeXlsx() {
  const ExcelJS = require(path.join(programRoot(), 'node_modules', 'exceljs'));
  const wb = new ExcelJS.Workbook();
  const head = (ws, row) => { const r = ws.getRow(row); r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6335B4' } }; c.alignment = { horizontal: 'center', vertical: 'middle' }; }); };
  const label = (w) => `${w.slice(5).replace('-', '.')} ~ ${ad.formatDay(ad.addDays(w, 6)).slice(5).replace('-', '.')}`;

  const sum = wb.addWorksheet('요약');
  sum.columns = [{ width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  for (const [k, v] of [['초안 ID', draftId], ['버전', meta.version], ['광고 기간', `${weeks[0]} ~ ${ad.formatDay(ad.addDays(weeks.at(-1), 6))} (${weekCount}주)`], ['정산 기준월', settlement.month], ['광고 기록 마지막 확정 주', lastWeek],
    ['선정 기준', meta.policy], ['후보 상담사', settlement.counselors.length], ['선정', draft.summary.selected], ['빈 자리', draft.summary.emptySlots], ['이월예정', draft.summary.carryover], ['제외(희망)', draft.summary.excluded], ['미리 정해진 자리', preassigned.length], ['검증 문제', problems.length]]) sum.addRow([k, v]);
  sum.getColumn(1).font = { bold: true };
  sum.addRow([]);
  sum.addRow(['배너', ...weeks.map(label)]); head(sum, sum.rowCount);
  const banners = [...new Set(draft.slots.map((s) => `${s.group} ${s.channel} ${s.banner}`))];
  for (const b of banners) sum.addRow([b, ...weeks.map((w) => { const s = draft.slots.find((x) => x.week === w && `${x.group} ${x.channel} ${x.banner}` === b); return s ? `${s.placed}/${s.capacity}${s.empty > 0 ? ` (빈 ${s.empty})` : ''}` : ''; })]);

  // 광고 기록 시트와 같은 모양(탭별, 배너 구역, 한 열이 한 주)
  for (const group of ad.GROUPS) for (const channel of ad.CHANNELS) {
    const ws = wb.addWorksheet(`${group} ${channel}상담`);
    ws.columns = [{ width: 3 }, { width: 10 }, ...weeks.map(() => ({ width: 18 }))];
    ws.addRow([]);
    for (const banner of ad.BANNERS) {
      const rule = policy.rules.find((r) => ad.bannerKey(r.group, r.channel, r.banner) === ad.bannerKey(group, channel, banner));
      if (!rule || !ad.asBoolean(rule.enabled)) continue;
      ws.addRow(['', '', ...weeks.map(label)]); head(ws, ws.rowCount);
      const names = weeks.map((w) => picked.filter((r) => r.week === w && r.group === group && r.channel === channel && r.banner === banner).map((r) => r.nickname));
      const height = Math.max(Number(rule.capacity) || 0, ...names.map((n) => n.length));
      const first = ws.rowCount + 1;
      for (let i = 0; i < height; i++) ws.addRow(['', `${group}\n${channel}\n${banner}`, ...names.map((n) => n[i] || '')]);
      ws.mergeCells(first, 2, first + height - 1, 2);
      ws.getCell(first, 2).alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
      ws.getCell(first, 2).font = { bold: true };
    }
  }

  const detail = wb.addWorksheet('선정초안');
  detail.columns = [12, 12, 7, 7, 7, 6, 16, 10, 18, 12, 12, 8, 12, 46, 9, 20].map((width) => ({ width }));
  detail.addRow(['진행주차', '종료일', '그룹', '채널', '배너', '순번', '닉네임', '담당자', '추적ID', '희망ID', '희망등록일', '활동단계', '전체정산초', '우선순위설명', '결과', '검수메모']); head(detail, 1);
  for (const r of draft.rows) detail.addRow([r.week, r.end, r.group, r.channel, r.banner, r.seq, r.nickname, r.manager, r.trackingId, r.wishId, r.wishDate, r.stage, r.seconds, r.description, r.result, '']);
  detail.views = [{ state: 'frozen', ySplit: 1 }];
  detail.autoFilter = { from: 'A1', to: 'P1' };

  const check = wb.addWorksheet('확인 필요');
  check.columns = [{ width: 18 }, { width: 100 }];
  check.addRow(['구분', '내용']); head(check, 1);
  for (const p of problems) check.addRow(['검증 문제', p]);
  for (const w of draft.warnings) check.addRow(['미리 정해진 자리', w]);
  for (const d of draft.duplicates) check.addRow(['닉네임 중복', `${d}: 정산 자료에 같은 닉네임이 둘 이상이라 자동 선정에서 뺐습니다.`]);
  for (const s of emptySlots) check.addRow(['빈 자리', `${s.week} ${s.group} ${s.channel} ${s.banner}: ${s.placed}/${s.capacity} (자격·주기를 채운 후보 ${s.candidates}명)`]);
  for (const r of draft.rows.filter((x) => x.result !== '선정')) check.addRow([r.result, `${r.group} ${r.channel} ${r.banner} ${r.nickname}: ${r.description}`]);
  if (check.rowCount === 1) check.addRow(['없음', '확인할 항목이 없습니다.']);
  await wb.xlsx.writeFile(path.join(outDir, `${prefix}광고선정초안.xlsx`));
}

// 사람이 읽는 요약(검토·보고용). 숫자는 모두 위 계산 결과에서 그대로 옮긴다
function writeSummary() {
  const lines = [`# 광고 선정 초안 ${draftId} (v${meta.version})`, '',
    `- 광고 기간: ${weeks[0]} ~ ${ad.formatDay(ad.addDays(weeks.at(-1), 6))} (${weekCount}주)${startAsked ? '' : ' — 시작 주차 지정이 없어 시트의 마지막 확정 주 다음 주부터 잡았습니다'}`,
    `- 정산 기준월: ${settlement.month} (아테나 아이템별정산현황, 후보 상담사 ${settlement.counselors.length}명)`,
    `- 광고 기록: 시트의 ${lastWeek} 주까지 확정분 반영, 미리 적힌 "예정" 자리 ${preassigned.length}칸`,
    `- 선정 기준: ${meta.policy} · 희망 ${meta.counts.wishes}건 · 조정(넣기·빼기·우선·주기) ${meta.counts.exceptions}건 · 이월 ${meta.counts.carryovers}건`,
    `- 결과: 선정 ${draft.summary.selected}명 · 빈 자리 ${draft.summary.emptySlots} · 이월예정 ${draft.summary.carryover} · 제외(희망) ${draft.summary.excluded}`,
    `- 이 초안은 계산 결과이고 아직 확정되지 않았습니다. 확정하려면 "초안 ${draftId} 최종 확정해줘"라고 지시합니다. 확정 명단은 AI 오피스 안의 확정 기록에 남고(다음 초안의 광고 이력이 됩니다) 구글 시트는 건드리지 않습니다.`, '',
    '## 주차별 선정 / 정원', '', `| 배너 | ${weeks.join(' | ')} |`, `| --- | ${weeks.map(() => '---').join(' | ')} |`];
  for (const b of [...new Set(draft.slots.map((s) => `${s.group} ${s.channel} ${s.banner}`))]) lines.push(`| ${b} | ${weeks.map((w) => { const s = draft.slots.find((x) => x.week === w && `${x.group} ${x.channel} ${x.banner}` === b); return `${s.placed}/${s.capacity}`; }).join(' | ')} |`);
  lines.push('', '## 확인 필요', '');
  const inactive = settlement.active && settlement.active.checked ? settlement.active.inactive : [];
  const notes = [...problems.map((p) => `검증 문제: ${p}`), ...draft.warnings,
    ...(settlement.active && !settlement.active.checked ? ['아테나 활동 상태를 읽지 못해 이용중지 상담사가 후보에 섞여 있을 수 있습니다'] : []),
    ...(inactive.length ? [`아테나에 승인완료 아이템이 없어 후보에서 뺀 닉네임 ${inactive.length}건(닉네임을 바꾼 활동 상담사면 '넣기'로 지정): ${[...new Set(inactive.map((i) => i.nickname))].join(', ')}`] : []), ...draft.duplicates.map((d) => `닉네임 중복으로 자동 선정에서 뺌: ${d}`),
    ...emptySlots.map((s) => `빈 자리: ${s.week} ${s.group} ${s.channel} ${s.banner} ${s.placed}/${s.capacity} (자격·주기를 채운 후보가 더 없음)`),
    ...draft.rows.filter((r) => r.result !== '선정').map((r) => `${r.result}: ${r.group} ${r.channel} ${r.banner} ${r.nickname} — ${r.description}`)];
  lines.push(...(notes.length ? notes.map((n) => `- ${n}`) : ['- 없음']));
  fs.writeFileSync(path.join(outDir, `${prefix}초안요약.md`), `${lines.join('\n')}\n`);
}

writeXlsx().then(() => {
  writeSummary();
  console.log(`초안 ${draftId} v1: ${weeks[0]} 주부터 ${weekCount}주 (정산 ${settlement.month}, 광고 기록 ${lastWeek} 주까지 반영)`);
  console.log(`선정 ${draft.summary.selected}명 · 빈 자리 ${draft.summary.emptySlots} · 이월예정 ${draft.summary.carryover} · 제외 ${draft.summary.excluded} · 미리 정해진 자리 ${preassigned.length}`);
  for (const w of weeks) { const slots = draft.slots.filter((s) => s.week === w); console.log(`  ${w}: 선정 ${slots.reduce((n, s) => n + s.placed, 0)} / 정원 ${slots.reduce((n, s) => n + s.capacity, 0)}`); }
  console.log(`확인 필요: 검증 문제 ${problems.length}, 미리 정해진 자리 확인 ${draft.warnings.length}, 닉네임 중복 ${draft.duplicates.length}`);
}).catch((e) => fail(`엑셀을 쓰지 못했습니다: ${e.message}`));
