#!/usr/bin/env node
// 실측 표: 켜져 있는 대시보드에 접수된 업무의 걸린 시간과 AI 사용량을 접수 경로별로 보여 준다.
// 접수 경로는 두 가지다 — 화면(대화 화면에서 직접 보냄) / 터미널(프로그램 폴더의 Claude·Codex에게 말해서 office-ask로 넣음).
// 저장된 기록만 읽는다(AI 호출 0회, 업무를 시작하거나 바꾸지 않는다).
//   node scripts/measure.mjs [--workspace <작업 공간 경로>] [--json]
import { readDashboardAccess } from '../lib/dashboard-access.mjs';
import { resolveWorkspace } from '../lib/paths.mjs';
import { createClient } from './office-ask.mjs';

export const VIA_LABEL = Object.freeze({ screen: '화면', terminal: '터미널', schedule: '예약', monitor: '감시 후속' });
const sec = (ms) => (ms ? `${Math.round(ms / 1000)}초` : '0초');

// 보고의 건별 줄을 실측 줄로. 시간은 겹치지 않는 네 구간(차례 대기·앞 업무 대기·내 답변 대기·실제 작업)이다
export function measureRows(reports) {
  return reports.flatMap((report) => report.rows.map((row) => ({ id: row.id, title: row.title, via: row.via || 'screen', status: row.label, attempts: row.attempts,
    workMs: row.times?.workMs || 0, slotWaitMs: row.times?.slotWaitMs || 0, depWaitMs: row.times?.depWaitMs || 0, humanWaitMs: row.times?.humanWaitMs || 0,
    calls: row.usage?.calls || 0, unreported: row.usage?.unreported || 0, input: row.usage?.totalInput ?? row.usage?.input ?? 0, cached: row.usage?.cachedInput || 0, output: row.usage?.output || 0 })));
}
// 경로별 요약: 끝난 건만 평균을 낸다(진행 중·대기 건은 건수만 센다)
export function measureSummary(rows) {
  const out = {};
  for (const row of rows) {
    const g = out[row.via] ||= { via: row.via, total: 0, done: 0, calls: 0, unreported: 0, input: 0, output: 0, workMs: 0 };
    g.total++;
    if (row.status !== '완료') continue;
    g.done++; g.calls += row.calls; g.unreported += row.unreported; g.input += row.input; g.output += row.output; g.workMs += row.workMs;
  }
  return Object.values(out).map((g) => ({ ...g, avgCalls: g.done ? +(g.calls / g.done).toFixed(1) : null, avgWorkMs: g.done ? Math.round(g.workMs / g.done) : null,
    avgInput: g.done ? Math.round(g.input / g.done) : null, avgOutput: g.done ? Math.round(g.output / g.done) : null }));
}

async function main(argv) {
  const at = argv.indexOf('--workspace');
  const root = resolveWorkspace({ workspace: at >= 0 ? argv[at + 1] : null }).path;
  const access = readDashboardAccess(root);
  if (!access) throw new Error(`대시보드 서버가 꺼져 있거나 이 작업 공간(${root})의 서버가 아닙니다. 먼저 서버를 켜 주세요.`);
  const client = createClient(access);
  const list = (await client.batches()).batches || [];
  const reports = [];
  for (const batch of list) reports.push(await client.report(batch.id));
  const rows = measureRows(reports), summary = measureSummary(rows);
  if (argv.includes('--json')) return console.log(JSON.stringify({ at: new Date().toISOString(), workspace: root, rows, summary }, null, 2));
  if (!rows.length) return console.log('접수된 업무가 없습니다. 대화 화면에서 보내거나 터미널의 AI에게 맡긴 뒤 다시 실행하세요.');
  console.log('| 접수 번호 | 경로 | 상태 | 실제 작업 | 차례 대기 | 내 답변 대기 | AI 호출 | 미보고 | 입력 토큰 | 출력 토큰 |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) console.log(`| ${r.id} | ${VIA_LABEL[r.via] || r.via} | ${r.status} | ${sec(r.workMs)} | ${sec(r.slotWaitMs)} | ${sec(r.humanWaitMs)} | ${r.calls} | ${r.unreported} | ${r.input.toLocaleString('ko-KR')} | ${r.output.toLocaleString('ko-KR')} |`);
  console.log('\n| 경로 | 접수 | 완료 | 완료 건 평균 작업 시간 | 평균 AI 호출 | 평균 입력 토큰 | 평균 출력 토큰 | 미보고 호출 |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const g of summary) console.log(`| ${VIA_LABEL[g.via] || g.via} | ${g.total} | ${g.done} | ${g.done ? sec(g.avgWorkMs) : '-'} | ${g.avgCalls ?? '-'} | ${g.avgInput?.toLocaleString('ko-KR') ?? '-'} | ${g.avgOutput?.toLocaleString('ko-KR') ?? '-'} | ${g.unreported} |`);
  console.log('\n입력 토큰은 캐시로 읽은 분량까지 더한 전체다.');
  console.log('토큰은 엔진이 보고한 값만 더한 것이다. 미보고 호출의 토큰은 들어 있지 않다. 제목(요청 요약)은 표에 싣지 않았다.');
  return undefined;
}

if (process.argv[1]?.endsWith('measure.mjs')) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exit(1); });
}
