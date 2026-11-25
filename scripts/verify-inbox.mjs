#!/usr/bin/env node
// 업무 화면(2.0, 슬랙형) 브라우저 검사: 한 줄 보내기 → 여러 건 한 번에 → 확인 필요 답글 → 최종 보고 → 처리 이력 내려받기.
// 실제 회사 데이터·AI·외부 발송을 쓰지 않는다. CLI는 가짜이고, 가짜가 받은 호출 수로 "화면 조회만으로는 AI 호출 0회"를 확인한다.
//   node scripts/verify-inbox.mjs [--report <경로>] [--size 1440x900,720x450]
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { startServer } from '../dashboard/server.mjs';
import { writePrivate } from '../lib/private-state.mjs';
import { scopeKey } from '../lib/reconcile.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const reportPath = resolve(arg('--report', 'ai-input/ui-validation/inbox/report.json'));
const sizes = arg('--size', '1440x900,720x450').split(',').map((s) => s.split('x').map(Number));
mkdirSync(dirname(reportPath), { recursive: true, mode: 0o700 });

const FAKE = String.raw`
import {readFileSync,writeFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
const args=process.argv.slice(2);
if(args.includes('--version')){console.log('Fixture 1.0');process.exit(0)}
if(args.includes('auth')){console.log(JSON.stringify({loggedIn:true}));process.exit(0)}
if(args.includes('login')){console.log('Logged in');process.exit(0)}
let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{
 const log=(kind,task)=>appendFileSync(process.env.FIXTURE_LOG,JSON.stringify({kind,task})+'\n');
 let kind;
 try{kind=JSON.parse(readFileSync(args[args.indexOf('--output-schema')+1],'utf8')).properties}catch{log('other','');process.exit(1)}
 const task=(input.match(/업무 id: ([\d-]+\/run-[\w-]+)/)||[])[1]||'';
 let result;
 if(kind.plan){
  log('plan',task);
  result={question:'',needsMeeting:false,meetingAgents:[],meetingSummary:'',rerunStages:[],plan:{version:1,task,goal:'자료 정리',stages:[{id:'a',title:'a',dept:'research',agent:'research-1',inputs:[],output:'outputs/'+task+'/research/research-1-a.txt',done:'내용 확인',dependsOn:[]}],review:{by:'chief',criteria:'자료 확인'},gaps:[]}};
 }else if(kind.status){
  log('stage',task);
  if(input.includes('명단이 필요한 일')&&!input.includes('명단 보냈어')&&!input.includes('[선행 업무 결과]'))result={status:'needs_decision',question:'담당자 명단을 첨부해 주세요.'};
  else{
   const output=[...input.matchAll(/\n출력: ([^\n]+)/g)].at(-1)[1],path=join(process.cwd(),output);
   mkdirSync(dirname(path),{recursive:true});writeFileSync(path,'가상 자료 정리 결과');
   result={status:'done',summary:'작성 완료'};
  }
 }else if(kind.revisedPlan&&!kind.verdict){log('progress',task);result={action:'continue',reason:'계획대로 진행',question:'',revisedPlan:null}
 }else if(kind.verdict){log('review',task);result={verdict:'pass',stage:'',reason:'내용 확인',report:'# 완료\n\n가상 산출물을 확인했습니다.\n\n확인 필요: 없음',question:''}
 }else{log('other',task);process.exit(1)}
 console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(result)}}));
 console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}}));
});
`;

const root = mkdtempSync(join(tmpdir(), 'office-inbox-ui-'));
mkdirSync(join(root, 'org'));
writeFileSync(join(root, 'org/departments.json'), JSON.stringify([{ id: 'research', name: '시험조사부', engine: 'codex', codexRole: 'exec', color: '#38bdf8' }]));
writeFileSync(join(root, 'org/roster.json'), JSON.stringify([{ id: 'research-1', name: '가나대리', department: 'research' }]));
const bin = join(root, 'fake.mjs'); writeFileSync(bin, FAKE);
// 결과가 불확실한 가상 발송 기록 하나(발송 결과 대조 화면용). 모의 기록일 뿐 아무것도 보내지 않는다
writePrivate(join(root, '.office', 'publications', `${scopeKey('run-gone')}-${'a'.repeat(24)}.json`), { status: 'uncertain', method: 'api', action: 'post', service: 'naver_cafe', connection: 'c1', contentHash: 'f'.repeat(64), target: 'https://cafe.example.com/board/2' });
const logFile = join(root, 'calls.jsonl');
const calls = () => (existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).length : 0);
// env 주입이 빠지는 회귀가 생겨도 실제 계정의 CLI로 빠지지 않게 한다
const original = { CLAUDE_BIN: process.env.CLAUDE_BIN, CODEX_BIN: process.env.CODEX_BIN };
process.env.CLAUDE_BIN = join(root, 'unconfigured-claude.mjs'); process.env.CODEX_BIN = join(root, 'unconfigured-codex.mjs');

const report = { framework: 'playwright', passed: false, checks: [], screenshots: [], consoleErrors: [], sizes: sizes.map((s) => s.join('x')) };
const check = (name, ok = true) => { assert.ok(ok, name); report.checks.push(name); };
let server, browser;
try {
  server = await startServer({ root, port: 0, quiet: true, env: { ...process.env, CLAUDE_BIN: join(root, 'no-claude.mjs'), CODEX_BIN: bin, FIXTURE_LOG: logFile } });
  browser = await chromium.launch();
  const [w, h] = sizes[0];
  const context = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.consoleErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !message.location().url?.endsWith('/favicon.ico')) report.consoleErrors.push(message.text()); });
  const shot = async (name) => { await page.screenshot({ path: join(dirname(reportPath), name) }); report.screenshots.push(name); };
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

  await page.goto(server.url);
  await page.locator('#work').waitFor();
  const entry = (text) => page.locator('#chBody article.wm', { hasText: text }).first();
  const waitChip = async (text, label) => { await entry(text).locator('.chip').filter({ hasText: label }).waitFor({ timeout: 30000 }); };
  check('처음 열면 슬랙형 업무 화면이고 사이드바에서 업무함이 선택돼 있다', await page.locator('#sidebar [data-nav="all"]').getAttribute('aria-current') === 'page' && !(await page.locator('#app').isVisible()));
  check('사이드바에 업무·봇·보조 화면·관리 메뉴가 있다', (await page.locator('#sidebar .sb-title').allTextContents()).join(',') === '업무,봇,보조 화면,관리' && (await page.locator('#sidebar').textContent()).includes('시험조사부'));
  check('본문이 화면 폭 안에 든다', await fits());
  await shot('01-empty.png');

  // ── 한 줄 적고 Enter: 바로 내 메시지가 보이고, 접수되면 스레드가 열려 진행 상황이 올라온다 ──
  await page.locator('#composerText').fill('배너 이월대기 현황을 정리해 줘.');
  await page.keyboard.press('Enter');
  await page.locator('#chBody article.wm', { hasText: '배너 이월대기 현황을 정리해 줘.' }).first().waitFor({ timeout: 1500 });
  check('보내자마자(1.5초 안) 내 메시지가 업무 흐름에 보인다');
  check('보낸 뒤 입력창이 비워진다', await page.locator('#composerText').inputValue() === '');
  await page.locator('#threadPane').waitFor({ timeout: 20000 });
  check('접수되면 그 업무의 스레드가 열린다', (await page.locator('#thTitle').textContent()).includes('배너 이월대기'));
  await waitChip('배너 이월대기', '완료');
  await page.locator('#thBody .wm-agent').first().waitFor({ timeout: 10000 });
  const thread1 = await page.locator('#thBody').textContent();
  check('스레드에 접수 → 직원 진행 → 결과가 대화처럼 올라온다', thread1.includes('접수했습니다') && thread1.includes('가나대리') && await page.locator('#thBody .tone-done').count() === 1);
  await shot('02-single-thread.png');
  await page.locator('#thClose').click();

  // ── 여러 건: ＋ 업무 추가로 담아 한 번에 보낸다 ──
  const text = page.locator('#composerText');
  await text.fill('명단이 필요한 일: 프로필 검수 목록을 정리해 줘.\n담당자별로 나눠서.');
  await page.locator('#composerAdd').click();
  await text.fill('1번 결과를 반영해 주간보고 초안을 써 줘.');
  await page.locator('#composerAdd').click();
  await page.locator('#composerQueue input[data-dep="1"]').check();
  await text.fill('금~목 회신 현황을 집계해 줘.');
  check('담은 업무가 순서대로 보이고 보내기 버튼이 건수를 알려 준다', await page.locator('#composerQueue li').count() === 2 && (await page.locator('#composerSend').textContent()) === '3건 보내기');
  // 새로고침해도 담아 둔 업무가 남는다
  await page.reload();
  await page.locator('#composerQueue li').nth(1).waitFor();
  check('새로고침해도 담아 둔 업무와 "앞 업무 결과" 지정이 남는다', await page.locator('#composerQueue input[data-dep="1"]').isChecked());
  await page.locator('#composerText').fill('금~목 회신 현황을 집계해 줘.');
  await shot('03-queue.png');
  await page.locator('#composerSend').dblclick();
  await waitChip('명단이 필요한 일', '확인 필요'); await waitChip('금~목 회신', '완료');
  check('묶음은 하나만 접수된다(더블클릭)', await page.locator('#chBody .wm-divider').count() === 1);
  check('1번은 확인 필요, 1번 결과가 필요한 2번은 대기, 독립인 3번은 완료', (await entry('주간보고 초안').locator('.chip').textContent()) === '대기' && (await entry('주간보고 초안').locator('.wm-note').textContent()).includes('결과 대기'));
  check('사이드바 "내 확인 필요"에 2건(답변 1 + 발송 대조 1)이 표시된다', (await page.locator('#sidebar [data-nav="needs"] .sb-badge').textContent()) === '2');
  await shot('04-channel.png');

  // ── 화면 조회만으로는 AI 호출이 생기지 않는다 ──
  const before = calls();
  await page.locator('#sidebar [data-nav="reports"]').click();
  await page.locator('#chBody button[data-report]').last().click();
  await page.locator('#thBody table.rep-table').waitFor();
  check('최종 보고에 3건이 접수 순서대로 보이고 합계가 접수 건수와 같다', await page.locator('#thBody table.rep-table tbody tr').count() === 3 && (await page.locator('.rep-sum').textContent()).includes('완료 1 / 확인 필요 1 / 대기 1'));
  await page.reload();
  await page.locator('#sidebar [data-nav="needs"]').click();
  await page.waitForTimeout(600);
  check('목록·보고 조회와 새로고침으로 생긴 AI 호출 0회', calls() === before);

  // ── 발송 결과 대조: 열어 보는 것만으로는 아무 일도 없고, 근거 없이는 결정할 수 없다 ──
  const rec = page.locator('#reconcileBox article.rec');
  await rec.waitFor();
  check('발송 결과 대조에 불확실한 발송 1건이 대상·문안 버전·시도와 함께 보인다', (await rec.textContent()).includes('https://cafe.example.com/board/2') && (await rec.textContent()).includes('버전 ffffffffffff') && (await rec.textContent()).includes('1번째'));
  await rec.locator('button[data-decision="resend"]').click();
  await page.locator('.toast').filter({ hasText: '근거를 적어 주세요' }).waitFor();
  await rec.locator('input[type="text"]').fill('게시판에 글 없음');
  await rec.locator('button[data-decision="resend"]').click();
  await page.locator('.toast').filter({ hasText: '직접 확인했는지 체크' }).waitFor();
  check('새 발송 승인은 근거와 "직접 확인" 체크가 모두 있어야 한다(없으면 결정되지 않는다)', await rec.locator('button[data-decision="resend"]').isVisible());
  await rec.locator('input[type="text"]').fill('게시판에서 글 확인(10:02)');
  await rec.locator('button[data-decision="confirm"]').click();
  await rec.filter({ hasText: '업무가 다시 진행되면 반영됩니다' }).waitFor();
  check('발송 확인으로 결정하면 결정이 표시되고 확인할 일 수가 줄어든다', (await page.locator('#sidebar [data-nav="needs"] .sb-badge').textContent()) === '1' && await rec.locator('button[data-decision]').count() === 0);
  await shot('05-needs.png');

  // ── 확인 필요 건에 답글(키보드) ──
  const open = entry('명단이 필요한 일').locator('button.wm-thread');
  await open.focus();
  await page.keyboard.press('Enter');
  await page.locator('#thBody .tone-question').waitFor();
  check('메시지를 열면 스레드 제목으로 초점이 간다', await page.evaluate(() => document.activeElement?.id === 'thTitle'));
  check('스레드에 요청 원문이 줄바꿈 그대로 보이고, 질문이 "답변 필요"로 올라와 있다', (await page.locator('#thBody .wm-me .wm-text').first().textContent()).includes('정리해 줘.\n담당자별로')
    && (await page.locator('#thBody .tone-question').textContent()).includes('담당자 명단을 첨부해 주세요') && await page.locator('#thReply').isVisible());
  await page.locator('#thReplyText').fill('명단 보');
  await page.locator('#sidebar [data-nav="all"]').click();
  await entry('금~목 회신').locator('button.wm-thread').click();
  await entry('명단이 필요한 일').locator('button.wm-thread').click();
  check('다른 업무를 다녀와도 쓰던 답글이 남는다', await page.locator('#thReplyText').inputValue() === '명단 보');
  await page.keyboard.press('Escape');
  check('스레드를 닫으면 골랐던 메시지로 초점이 돌아온다', await page.evaluate(() => document.activeElement?.classList.contains('wm-thread')));
  await entry('명단이 필요한 일').locator('button.wm-thread').click();
  await page.locator('#thReplyText').fill('명단 보냈어');
  await shot('06-question.png');
  await page.keyboard.press('Enter');
  await page.locator('#thBody .wm-me', { hasText: '명단 보냈어' }).first().waitFor({ timeout: 1500 });
  check('답글도 보내자마자 스레드에 보인다');
  await waitChip('명단이 필요한 일', '완료'); await waitChip('주간보고 초안', '완료');
  check('답변하면 같은 업무로 이어지고, 그 결과를 기다리던 2번까지 끝난다', await page.locator('#chBody .wm-divider').count() === 1);
  check('확인할 일이 없어지면 사이드바 숫자가 사라진다', await page.locator('#sidebar [data-nav="needs"] .sb-badge').count() === 0);

  // ── 최종 보고와 처리 이력 ──
  await page.locator('#chBody .wm-divider button[data-report]').click();
  await page.locator('.rep-sum').filter({ hasText: '완료 3' }).waitFor({ timeout: 10000 });
  check('보고가 완료 3/3으로 바뀐다', (await page.locator('#thBody .th-meta .chip').textContent()) === '모두 끝남');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#thBody [data-csv]').click()]);
  const csvPath = join(dirname(reportPath), 'history.csv');
  await download.saveAs(csvPath);
  const csv = readFileSync(csvPath, 'utf8');
  check('처리 이력 CSV를 내려받고, 요청 원문이 없다', csv.includes('업무 번호') && csv.split('\r\n').length > 9 && !csv.includes('명단이 필요한 일') && !csv.includes('주간보고'));
  await shot('07-report.png');
  await page.locator('#thBody table.rep-table tbody tr').nth(2).locator('button[data-open-entry]').click();
  await page.locator('#thBody .tone-done').waitFor();
  check('보고에서 업무 이름을 누르면 그 업무 스레드로 간다', (await page.locator('#thTitle').textContent()).includes('금~목 회신'));

  // ── 보조 화면(예전 관제 등)은 사이드바에서 그대로 열 수 있다 ──
  await page.locator('#sidebar [data-view="control"]').click();
  check('사이드바의 관제를 누르면 예전 화면이 열리고 사이드바는 그대로다', await page.locator('#orgTree').isVisible() && await page.locator('#feed').isVisible() && !(await page.locator('#work').isVisible()) && await page.locator('#sidebar').isVisible());
  await shot('08-legacy-control.png');
  await page.locator('#sidebar [data-open="schedules"]').click();
  check('사이드바의 예약을 누르면 예약 창이 열린다', await page.locator('#schedulesDialog').isVisible());
  await page.keyboard.press('Escape');
  await page.locator('#sidebar [data-nav="all"]').click();
  check('업무함으로 돌아오면 열어 둔 스레드가 그대로다', (await page.locator('#thTitle').textContent()).includes('금~목 회신'));

  // ── 다른 크기(확대 200% 등)에서도 본문이 넘치지 않고 보내기를 쓸 수 있다 ──
  for (const [width, height] of sizes.slice(1)) {
    await page.setViewportSize({ width, height });
    check(`${width}x${height}: 본문 가로 넘침 없음(스레드)`, await fits());
    await page.locator('#thClose').click();
    check(`${width}x${height}: 본문 가로 넘침 없음(업무 흐름)`, await fits());
    check(`${width}x${height}: 입력창과 보내기 버튼을 쓸 수 있다`, await page.locator('#composerText').isVisible() && await page.locator('#composerSend').isVisible());
    if (width < 1200) {
      await page.locator('#sbToggle').click();
      check(`${width}x${height}: ☰로 사이드바를 열 수 있다`, await page.locator('#sidebar [data-nav="needs"]').isVisible());
      await page.locator('#sidebar [data-nav="all"]').click();
    }
    await shot(`09-channel-${width}x${height}.png`);
    await entry('금~목 회신').locator('button.wm-thread').click();
    await page.locator('#thBody .tone-done').waitFor();
    await shot(`10-thread-${width}x${height}.png`);
  }  check('콘솔 오류 없음', report.consoleErrors.length === 0);
  report.aiCalls = calls();
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
} finally {
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  for (const [name, value] of Object.entries(original)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }).catch(() => {});
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
}
console.log(report.passed ? `업무함 화면 검사 통과: ${report.checks.length}개 확인 (${report.sizes.join(', ')}) → ${reportPath}` : `업무함 화면 검사 실패 (통과 ${report.checks.length}개)\n${report.error}\n콘솔 오류: ${report.consoleErrors.join(' | ') || '없음'}`);
process.exit(report.passed ? 0 : 1);
