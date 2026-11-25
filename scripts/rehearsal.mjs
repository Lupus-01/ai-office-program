#!/usr/bin/env node
// 2.0 운영 리허설 1~13(docs/v2/PLAN.md 6장)을 한 번에 돌리고 결과표를 낸다.
// 모두 가짜 실행기·가짜 CLI·모의 발송기로 돈다. 실제 AI 호출과 외부 발송은 없다.
//   node scripts/rehearsal.mjs [--no-browser] [--report <경로>]
// 리허설 12(기기별 업무 완주)·13(가이드로 첫 업무 맡기기)은 브라우저 검사(scripts/verify-inbox.mjs)가 본다. --no-browser면 건너뛴다.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const reportPath = resolve(arg('--report', 'ai-input/rehearsal/report.json'));
const browser = !process.argv.includes('--no-browser');
const env = { ...process.env };
delete env.AI_OFFICE_WORKSPACE;
delete env.AI_OFFICE_ROOT;

// 리허설 → 그 조건을 보는 테스트(파일과 이름 무늬). 무늬가 없으면 파일 전체.
export const REHEARSALS = [
  { no: 1, title: '정상 접수(A~D 제출, 실행 중 E 추가)', tests: [['sequencer.test.mjs', '리허설 1'], ['sequencer-api.test.mjs', '지시창 단건도 순번']] },
  { no: 2, title: '누락·중복(저장 실패, 응답 유실, 더블클릭, 재접속)', tests: [['batches.test.mjs', '같은 제출 키|저장 실패|서버 재시작|API: 저장 실패']] },
  { no: 3, title: '보류와 재개(A 자료 누락, B는 A 의존, C·D 독립)', tests: [['sequencer.test.mjs', '리허설 3'], ['sequencer-api.test.mjs', '3건 접수']] },
  { no: 4, title: '복구와 전송(실행 중·외부 반영 직후·결과 확정 직후 중단)', tests: [['sequencer.test.mjs', '서버 재시작|리허설 4'], ['reconcile.test.mjs', '리허설 10']] },
  { no: 5, title: '예산 경합(잔여 1회에 직원 둘)', tests: [['orchestrator.test.mjs', '리허설 5'], ['sequencer-api.test.mjs', '묶음 예산'], ['ledger.test.mjs', '']] },
  { no: 6, title: '반복 반려(같은 형식 오류 반복)', tests: [['orchestrator.test.mjs', '리허설 6']] },
  { no: 7, title: '예약·감시와 겹침', tests: [['sequencer.test.mjs', '리허설 7|예약: 회차']] },
  { no: 8, title: '기존 기능·전환(업데이트가 대기 업무를 끊지 않음)', tests: [['sequencer.test.mjs', '업데이트의 진행 중 업무 확인|일시정지·재개']], note: '기존 기능 전체는 npm run check가 본다' },
  { no: 9, title: '업무 처리 이력 내보내기', tests: [['batch-report.test.mjs', '리허설 9']] },
  { no: 10, title: '발송 결과 대조함', tests: [['reconcile.test.mjs', ''], ['batches.test.mjs', '발송 결과 대조함']] },
  { no: 11, title: '대기시간 누적 알림', tests: [['batch-report.test.mjs', '리허설 11|대기시간']] },
  { no: 12, title: '기기별 업무 완주(모의 폭 6가지)', browser: true, note: '실제 기기·네트워크 행은 S10(다른 기기 접속) 뒤에 본다' },
  { no: 13, title: '가이드로 첫 업무 맡기기', tests: [['guides.test.mjs', '']], browser: true },
];

function runTests(file, pattern) {
  const args = ['--test', '--test-reporter=tap', ...(pattern ? [`--test-name-pattern=${pattern}`] : []), join(root, 'test', file)];
  const out = spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8' });
  const text = `${out.stdout || ''}${out.stderr || ''}`;
  const num = (name) => Number((text.match(new RegExp(`^# ${name} (\\d+)`, 'm')) || [])[1] || 0);
  // 이름 무늬에 걸리지 않은 테스트는 건너뜀으로 세어진다. 실제로 돈 것만 센다
  return { file, pattern, pass: num('pass'), fail: num('fail'), ok: out.status === 0 && num('pass') > 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(reportPath), { recursive: true, mode: 0o700 });
  let ui = null;
  if (browser) {
    const uiReport = join(dirname(reportPath), 'inbox', 'report.json');
    mkdirSync(dirname(uiReport), { recursive: true, mode: 0o700 });
    const out = spawnSync(process.execPath, [join(root, 'scripts', 'verify-inbox.mjs'), '--report', uiReport], { cwd: root, env, encoding: 'utf8' });
    try { ui = JSON.parse(readFileSync(uiReport, 'utf8')); } catch { ui = { passed: false, checks: [], error: (out.stdout || out.stderr || '').slice(-400) }; }
  }
  const rows = REHEARSALS.map((r) => {
    const runs = (r.tests || []).map(([file, pattern]) => runTests(file, pattern));
    const uiOk = !r.browser ? true : browser ? ui.passed === true : null;
    const ok = runs.every((x) => x.ok) && uiOk !== false;
    return { no: r.no, title: r.title, result: !ok ? '실패' : uiOk === null ? (runs.length ? '부분 통과(화면 검사 건너뜀)' : '건너뜀') : '통과',
      tests: runs.reduce((n, x) => n + x.pass, 0), failed: runs.reduce((n, x) => n + x.fail, 0), ...(r.browser && browser ? { screenChecks: ui.checks.length, sizes: ui.sizes } : {}), note: r.note || '', runs };
  });
  const report = { at: new Date().toISOString(), mode: '가짜 실행기·가짜 CLI·모의 발송기(실제 AI 호출·외부 발송 없음)', passed: rows.every((r) => r.result === '통과'), rows };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log('| 번호 | 리허설 | 결과 | 확인한 테스트 | 화면 확인 | 비고 |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const r of rows) console.log(`| ${r.no} | ${r.title} | ${r.result} | ${r.tests}개${r.failed ? `(실패 ${r.failed})` : ''} | ${r.screenChecks ? `${r.screenChecks}개 · ${r.sizes.join(', ')}` : '-'} | ${r.note} |`);
  console.log(`\n${report.passed ? '리허설 1~13 통과' : '통과하지 못한 리허설이 있습니다'} (${report.mode}) → ${reportPath}`);
  process.exit(rows.some((r) => r.result === '실패') ? 1 : 0);
}
