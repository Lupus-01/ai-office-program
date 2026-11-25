#!/usr/bin/env node
// 대화 화면(2.0) 브라우저 검사: 한 줄 보내기 → 완료 보고·파일 받기 → 여러 건 한 번에 → 답변 필요 답글 → 처리 이력 → 설정(직원 구성) → 태블릿·휴대폰 폭.
// 실제 회사 데이터·AI·외부 발송을 쓰지 않는다. CLI는 가짜이고, 가짜가 받은 호출 수로 "화면 조회만으로는 AI 호출 0회"를 확인한다.
//   node scripts/verify-inbox.mjs [--report <경로>] [--size 1440x900,720x450,768x1024,1024x768,360x800,390x844]
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
const sizes = arg('--size', '1440x900,720x450,768x1024,1024x768,360x800,390x844').split(',').map((s) => s.split('x').map(Number));
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
  result={question:'',needsMeeting:false,meetingAgents:[],meetingSummary:'',rerunStages:[],plan:{version:1,task,goal:'자료 정리',stages:[{id:'a',title:'a',dept:'research',agent:'research-1',inputs:[],output:'outputs/'+task+'/research/research-1-a.txt',done:'내용 확인',dependsOn:[]}],review:{by:'chief',criteria:'자료 확인'},deliverables:['a'],gaps:[]}};
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
// 업무 예시(가이드) 가상 자료: 예시가 있는 것 하나, 예시가 없어 "준비 중"이고 없는 절차를 가리키는 것 하나
const EXAMPLE_NEW = '[기간]에 해당하는 [대상]의 안내 메일 초안을 준비해 줘. 대상별 문안과 미리보기를 보여 줘.';
const EXAMPLE_REPLY = '대상 명단을 첨부했어. 이 명단을 기준으로 이어서 준비해 줘.';
writeFileSync(join(root, 'org/guides.json'), JSON.stringify({ version: 1, guides: [
  { id: 'mail-prepare', title: '안내 메일 문안 준비', summary: '대상별 안내 메일 문안과 미리보기를 만듭니다. 보내지는 않습니다.', keywords: ['상담사 메일'], output: '대상별 문안과 미리보기', agent: 'research-1', reviewed: '2026-11-25',
    prepare: ['필수: 대상 명단', '선택: 조회 기간'], steps: ['대상과 기간 확인', '문안과 미리보기 작성'], done: '대화에서 문안과 미리보기를 확인합니다. 준비 완료와 실제 발송은 다릅니다.',
    examples: [{ label: '새 업무 맡기기', text: EXAMPLE_NEW }, { label: '자료를 보완할 때', kind: 'reply', text: EXAMPLE_REPLY }] },
  { id: 'weekly-count', title: '주간 회신 집계', summary: '금~목 회신 현황을 표로 정리합니다.', recipe: 'gone-recipe' }] }));
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
  const context = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.consoleErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !message.location().url?.endsWith('/favicon.ico')) report.consoleErrors.push(message.text()); });
  const shot = async (name) => { await page.screenshot({ path: join(dirname(reportPath), name) }); report.screenshots.push(name); };
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

  await page.goto(server.url);
  await page.locator('#work').waitFor();
  const conv = (text) => page.locator('#sidebar .sb-conv', { hasText: text }).first();
  const waitMark = async (text, label) => { await conv(text).locator('.mark').filter({ hasText: label }).waitFor({ timeout: 30000 }); };
  const visible = (sel) => page.locator(sel).isVisible();
  const sidebarText = await page.locator('#sidebar').textContent();
  check('처음 열면 새 대화 화면이고 예전 화면(#app)은 보이지 않는다', (await page.locator('#chTitle').textContent()) === '새 대화' && !(await visible('#app')) && await visible('#composerText'));
  check('왼쪽에는 새 대화·대화 목록·설정만 있고 사무실 구조(봇·부서·관제·사무실·조직·산출물)는 없다',
    sidebarText.includes('새 대화') && sidebarText.includes('설정') && !/봇|시험조사부|관제|사무실|조직|산출물|비서실장/.test(sidebarText));
  check('본문이 화면 폭 안에 든다', await fits());
  await shot('01-empty.png');

  // ── 한 줄 적고 Enter: 바로 내 말이 보이고, 접수되면 대화가 하나 생겨 그 안에서 완료 보고와 파일을 받는다 ──
  await page.locator('#composerText').fill('배너 이월대기 현황을 정리해 줘.');
  await page.keyboard.press('Enter');
  await page.locator('#chBody article.wm-me', { hasText: '배너 이월대기 현황을 정리해 줘.' }).first().waitFor({ timeout: 1500 });
  check('보내자마자(1.5초 안) 내 말이 대화에 보인다');
  check('보낸 뒤 입력창이 비워진다', await page.locator('#composerText').inputValue() === '');
  await conv('배너 이월대기').waitFor({ timeout: 20000 });
  await waitMark('배너 이월대기', '완료');
  await page.locator('#chBody .tone-done').waitFor({ timeout: 10000 });
  check('접수되면 대화 목록에 대화가 생기고 그 대화가 열린다', (await page.locator('#chTitle').textContent()).includes('배너 이월대기') && await conv('배너 이월대기').getAttribute('aria-current') === 'page');
  const chat1 = await page.locator('#chBody').textContent();
  check('대화에는 내 지시와 AI 비서의 완료 보고만 남는다(직원 이름·중간 과정 없음)', await page.locator('#chBody article.wm').count() === 2 && chat1.includes('AI 비서') && !/가나대리|시험조사부|비서실장|계획을 세웠/.test(chat1));
  report.deliveredFiles = await page.locator('#chBody .fc').count();
  if (report.deliveredFiles) {
    const [file] = await Promise.all([page.waitForEvent('download'), page.locator('#chBody .fc button[data-dl]').first().click()]);
    check('완료 보고 아래 파일 카드의 "받기"로 파일을 바로 내려받는다', Boolean(file.suggestedFilename()));
  } else {
    await page.locator('#chBody .fc-more').waitFor({ timeout: 10000 });
    check('최종 파일이 없는 업무는 완료 보고와 "자세히 보기"만 보인다');
  }
  check('끝난 대화에서도 이어서 말할 수 있다(입력창이 켜져 있다)', await page.locator('#composerText').isEnabled() && (await page.locator('#composerText').getAttribute('placeholder')).includes('이어서'));
  await shot('02-chat-done.png');

  // ── 여러 건: 새 대화에서 ＋ 업무 추가로 담아 한 번에 보낸다 ──
  await page.locator('#sidebar [data-new]').click();
  const text = page.locator('#composerText');
  await text.fill('명단이 필요한 일: 프로필 검수 목록을 정리해 줘.\n담당자별로 나눠서.');
  await page.locator('#composerAdd').click();
  await text.fill('1번 결과를 반영해 주간보고 초안을 써 줘.');
  await page.locator('#composerAdd').click();
  await page.locator('#composerQueue input[data-dep="1"]').check();
  await text.fill('금~목 회신 현황을 집계해 줘.');
  check('담은 업무가 순서대로 보이고 보내기 버튼이 건수를 알려 준다', await page.locator('#composerQueue li').count() === 2 && (await page.locator('#composerSend').textContent()) === '3건 보내기');
  await page.reload();
  await page.locator('#sidebar [data-new]').click();
  await page.locator('#composerQueue li').nth(1).waitFor();
  check('새로고침해도 담아 둔 업무·"앞 업무 결과" 지정·쓰던 글이 남는다', await page.locator('#composerQueue input[data-dep="1"]').isChecked() && await text.inputValue() === '금~목 회신 현황을 집계해 줘.');
  await shot('03-queue.png');
  await page.locator('#composerSend').dblclick();
  await waitMark('명단이 필요한 일', '답변 필요'); await waitMark('금~목 회신', '완료');
  check('더블클릭해도 한 번만 접수된다(대화 4개: 앞의 1건 + 3건)', await page.locator('#sidebar .sb-conv[data-open-entry]').count() === 4);
  check('1번은 답변 필요, 1번 결과가 필요한 2번은 대기, 독립인 3번은 완료', (await conv('주간보고 초안').locator('.mark').textContent()) === '대기');
  check('"답변 필요" 거르기에 1건, 발송 결과 확인이 따로 1건 표시된다', (await page.locator('#sidebar [data-filter="needs"] .sb-badge').textContent()) === '1' && (await page.locator('#sidebar [data-page="reconcile"]').textContent()).includes('확인 필요 1건'));
  check('다른 대화를 보는 동안 끝난 대화에 "새 소식"이 붙는다', await conv('금~목 회신').locator('.sb-new-dot').count() === 1);
  await shot('04-list.png');

  // ── 화면 조회만으로는 AI 호출이 생기지 않는다 ──
  const before = calls();
  await page.locator('#sidebar [data-page="settings"]').click();
  await page.locator('#chBody [data-page="reports"]').click();
  await page.locator('#chBody button[data-report]').first().click();
  await page.locator('#chBody table.rep-table').waitFor();
  check('처리 이력의 보고에 3건이 접수 순서대로 보이고 합계가 접수 건수와 같다', await page.locator('#chBody table.rep-table tbody tr').count() === 3 && (await page.locator('.rep-sum').textContent()).includes('완료 1 / 답변 필요 1 / 대기 1'));
  await page.reload();
  await conv('금~목 회신').click();
  await page.locator('#chBody .tone-done').waitFor();
  check('대화를 열면 "새 소식" 표시가 사라진다', await conv('금~목 회신').locator('.sb-new-dot').count() === 0);
  await page.locator('#sidebar [data-filter="needs"]').click();
  check('"답변 필요"로 거르면 그 대화만 남는다', await page.locator('#sidebar .sb-conv[data-open-entry]').count() === 1);
  await page.locator('#sidebar [data-filter="all"]').click();
  await page.waitForTimeout(600);
  check('목록·대화·보고 조회와 새로고침으로 생긴 AI 호출 0회', calls() === before);

  // ── 발송 결과 확인: 열어 보는 것만으로는 아무 일도 없고, 근거 없이는 결정할 수 없다 ──
  await page.locator('#sidebar [data-page="reconcile"]').click();
  const rec = page.locator('#chBody article.rec');
  await rec.waitFor();
  check('발송 결과 확인에 불확실한 발송 1건이 대상·문안 버전·시도와 함께 보인다', (await rec.textContent()).includes('https://cafe.example.com/board/2') && (await rec.textContent()).includes('버전 ffffffffffff') && (await rec.textContent()).includes('1번째'));
  await rec.locator('button[data-decision="resend"]').click();
  await page.locator('.toast').filter({ hasText: '근거를 적어 주세요' }).waitFor();
  await rec.locator('input[type="text"]').fill('게시판에 글 없음');
  await rec.locator('button[data-decision="resend"]').click();
  await page.locator('.toast').filter({ hasText: '직접 확인했는지 체크' }).waitFor();
  check('새 발송 승인은 근거와 "직접 확인" 체크가 모두 있어야 한다(없으면 결정되지 않는다)', await rec.locator('button[data-decision="resend"]').isVisible());
  await rec.locator('input[type="text"]').fill('게시판에서 글 확인(10:02)');
  await rec.locator('button[data-decision="confirm"]').click();
  await rec.filter({ hasText: '업무가 다시 진행되면 반영됩니다' }).waitFor();
  await page.locator('#sidebar [data-page="reconcile"]').waitFor({ state: 'detached' });
  check('발송 확인으로 결정하면 결정이 표시되고 목록의 확인 항목이 사라진다', await rec.locator('button[data-decision]').count() === 0);
  await shot('05-reconcile.png');

  // ── 답변 필요 대화에 답하기(키보드) ──
  await conv('명단이 필요한 일').focus();
  await page.keyboard.press('Enter');
  await page.locator('#chBody .tone-question').waitFor();
  check('대화를 열면 제목으로 초점이 간다', await page.evaluate(() => document.activeElement?.id === 'chTitle'));
  check('요청 원문이 줄바꿈 그대로 보이고, 질문이 "답변 필요"로 올라와 있다', (await page.locator('#chBody .wm-me .wm-text').first().textContent()).includes('정리해 줘.\n담당자별로')
    && (await page.locator('#chBody .tone-question').textContent()).includes('담당자 명단을 첨부해 주세요') && (await text.getAttribute('placeholder')) === '답변을 적어 보내세요');
  await text.fill('명단 보');
  await conv('금~목 회신').click();
  check('다른 대화로 가면 입력창은 그 대화의 것으로 바뀐다', await text.inputValue() === '');
  await conv('명단이 필요한 일').click();
  check('돌아오면 쓰던 답글이 남아 있다', await text.inputValue() === '명단 보');
  await conv('주간보고 초안').click();
  check('아직 시작 전인 대화는 입력창이 꺼져 있고 사유를 알려 준다', await text.isDisabled() && (await text.getAttribute('placeholder')).includes('차례를 기다리고'));
  await conv('명단이 필요한 일').click();
  await text.fill('명단 보냈어');
  await shot('06-question.png');
  await page.keyboard.press('Enter');
  await page.locator('#chBody .wm-me', { hasText: '명단 보냈어' }).first().waitFor({ timeout: 1500 });
  check('답글도 보내자마자 대화에 보인다');
  await waitMark('명단이 필요한 일', '완료'); await waitMark('주간보고 초안', '완료');
  check('답하면 같은 대화로 이어지고, 그 결과를 기다리던 2번까지 끝난다', await page.locator('#sidebar .sb-conv[data-open-entry]').count() === 4);
  check('답변할 대화가 없어지면 "답변 필요" 숫자가 사라진다', await page.locator('#sidebar [data-filter="needs"] .sb-badge').count() === 0);

  // ── 전체 결과와 처리 이력 ──
  await page.locator('#chBody [data-report]').click();
  await page.locator('.rep-sum').filter({ hasText: '완료 3' }).waitFor({ timeout: 10000 });
  check('한 번에 맡긴 3건의 보고가 완료 3/3으로 바뀐다', (await page.locator('#chBody .th-meta .chip').textContent()) === '모두 끝남');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#chBody [data-csv]').click()]);
  const csvPath = join(dirname(reportPath), 'history.csv');
  await download.saveAs(csvPath);
  const csv = readFileSync(csvPath, 'utf8');
  check('처리 이력 CSV를 내려받고, 요청 원문이 없다', csv.includes('업무 번호') && csv.split('\r\n').length > 9 && !csv.includes('명단이 필요한 일') && !csv.includes('주간보고'));
  await shot('07-report.png');
  await page.locator('#chBody table.rep-table tbody tr').nth(2).locator('button[data-open-entry]').click();
  await page.locator('#chBody .tone-done').waitFor();
  check('보고에서 업무 이름을 누르면 그 대화로 간다', (await page.locator('#chTitle').textContent()).includes('금~목 회신'));

  // ── 업무 예시(가이드): 찾기 → 상세 → 입력창에 넣기. 보내기 전에는 업무가 생기지 않고 AI 호출도 없다 ──
  const callsBeforeGuide = calls(), convsBeforeGuide = await page.locator('#sidebar .sb-conv[data-open-entry]').count();
  await page.locator('#sidebar [data-new]').click();
  await page.locator('#chBody .gd-card').first().waitFor();
  check('새 대화에 "어떤 일을 맡기시겠어요?"와 업무 예시 카드가 보이고, 예시가 없는 것은 준비 중으로 표시된다', (await page.locator('#chBody .ch-empty-title').textContent()) === '어떤 일을 맡기시겠어요?' && await page.locator('#chBody .gd-card').count() === 2 && (await page.locator('#chBody .gd-card', { hasText: '주간 회신 집계' }).textContent()).includes('준비 중'));
  check('예시 카드에는 직원·부서 이름이 나오지 않는다', !/가나대리|시험조사부|research/.test(await page.locator('#chBody .gd').textContent()));
  await page.locator('#chBody [data-guide-q]').fill('상담사 메일');
  check('업무 이름(다른 이름 포함)으로 찾으면 맞는 예시만 남고 검색창 초점이 유지된다', await page.locator('#chBody .gd-card').count() === 1 && await page.evaluate(() => document.activeElement?.dataset.guideQ !== undefined));
  await shot('08a-guides.png');
  await page.locator('#chBody .gd-card').click();
  await page.locator('#chBody .gd-ex').first().waitFor();
  const detail = await page.locator('#chBody').textContent();
  check('상세에 받는 것·준비할 것·진행 순서·완료 확인·예시가 있고, 준비와 실제 발송을 구분해 알려 준다', (await page.locator('#chTitle').textContent()) === '안내 메일 문안 준비' && ['받는 것', '시작 전에 준비할 것', '필수: 대상 명단', '이렇게 진행됩니다', '완료 확인과 다음 행동', '실제 발송은 다릅니다', '새 업무 맡기기'].every((t) => detail.includes(t)));
  check('새 대화에서 연 예시에는 "새 대화에 넣기"만 있고 답글용 예시는 복사만 된다', await page.locator('#chBody [data-use][data-to="new"]').count() === 1 && await page.locator('#chBody [data-use][data-to="chat"]').count() === 0 && await page.locator('#chBody [data-copy]').count() === 2);
  await shot('08b-guide-detail.png');
  await page.locator('#chBody [data-copy]').first().click();
  await page.locator('.toast').filter({ hasText: '예시를 복사했어요' }).waitFor();
  check('예시 복사는 글만 복사한다', await page.evaluate(() => navigator.clipboard.readText()) === EXAMPLE_NEW);
  await page.goBack();
  await page.locator('#chBody [data-guide-q]').waitFor();
  check('뒤로 가면 찾던 검색어와 목록으로 돌아온다', await page.locator('#chBody [data-guide-q]').inputValue() === '상담사 메일' && await page.locator('#chBody .gd-card').count() === 1);
  await page.locator('#chBody .gd-card').click();
  await page.locator('#chBody [data-use][data-to="new"]').click();
  check('"새 대화에 넣기"는 입력창에 예시를 채우고 첫 [바꿀 자리]를 골라 둔다(보내지는 않는다)', (await page.locator('#chTitle').textContent()) === '새 대화' && await text.inputValue() === EXAMPLE_NEW
    && await page.evaluate(() => { const t = document.getElementById('composerText'); return document.activeElement === t && t.value.slice(t.selectionStart, t.selectionEnd) === '[기간]'; }));
  await text.fill('');
  // 진행하던 대화에서 예시를 열면 답글로 넣을 수 있고, 새 업무는 생기지 않는다
  await conv('명단이 필요한 일').click();
  await page.locator('#composerGuide').click();
  await page.locator('#chBody .gd-card').click();
  await page.locator('#chBody [data-use][data-to="chat"]').click();
  check('대화에서 연 예시는 "이 대화에 답글로 넣기"로 그 대화의 입력창에 들어간다', (await page.locator('#chTitle').textContent()).includes('명단이 필요한 일') && await text.inputValue() === EXAMPLE_REPLY);
  await text.fill('');
  await page.waitForTimeout(400);
  check('예시 열람·검색·복사·입력창 채우기로 생긴 업무 0건, AI 호출 0회', calls() === callsBeforeGuide && await page.locator('#sidebar .sb-conv[data-open-entry]').count() === convsBeforeGuide);
  await page.locator('#sidebar [data-page="settings"]').click();
  await page.locator('#chBody [data-page="guidecheck"]').click();
  await page.locator('#chBody .gd-detail').waitFor();
  const audit = await page.locator('#chBody').textContent();
  check('업무 예시 점검이 빠진 것·끊긴 연결·준비 중·검토일 없음을 알려 준다', audit.includes('예시가 없는 직원 0건') && audit.includes('연결이 끊긴 예시 1건') && audit.includes('연결한 고정 절차가 없습니다') && audit.includes('준비 중인 예시 1건') && audit.includes('검토일이 없는 예시 1건') && audit.includes('예시(examples)가 없어'));

  // ── 설정: 직원 구성은 여기서만 연다 ──
  await page.locator('#sidebar [data-page="settings"]').click();
  check('설정에 예약·처리 이력·업무 예시 점검·계정 연결·직원 구성·회사 설정·알림·테마가 있다', (await page.locator('#chBody .set-row strong').allTextContents()).join(',').startsWith('예약 업무,처리 이력,업무 예시 점검,계정 연결,직원 구성,회사 설정,알림'));
  await shot('08-settings.png');
  await page.locator('#chBody [data-view="team"]').click();
  await page.locator('#orgView').waitFor();
  check('직원 구성은 예전 틀(지표·지시창·탭·양옆 패널) 없이 편집 화면만 열린다', await visible('#shellBar') && !(await visible('.topbar')) && !(await visible('.commandbar')) && !(await visible('#orgTree')) && !(await visible('#feed')) && (await page.locator('#orgView').textContent()).includes('시험조사부'));
  check('직원 구성 화면도 폭 안에 든다', await fits());
  await shot('09-team.png');
  await page.locator('#shellBar [data-back]').click();
  check('‹ 설정으로 돌아온다', (await page.locator('#chTitle').textContent()) === '설정');
  await page.locator('#chBody [data-open="schedules"]').click();
  check('설정의 예약 업무를 누르면 예약 창이 열린다', await visible('#schedulesDialog'));
  await page.keyboard.press('Escape');

  // ── 다른 크기: 768px 이상은 2열, 767px 이하는 목록 → 대화를 한 화면씩 ──
  const small = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((el) => el.offsetParent && (el.getBoundingClientRect().height < 43.5 || el.getBoundingClientRect().width < 43.5)).map((el) => `${el.className || el.id}:${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`), sel);
  const TOUCH = '#sidebar button, #chBack, #chActions button, .composer-bar button, #chBody .fc button, #chBody .set-row, #chBody .row-actions button, #chBody summary';
  for (const [width, height] of sizes.slice(1)) {
    const tag = `${width}x${height}`;
    await page.setViewportSize({ width, height });
    await page.goto(server.url);
    await page.locator('#sidebar .sb-conv').first().waitFor();
    if (width >= 768) {
      check(`${tag}: 대화 목록과 대화가 나란히 보인다(2열)`, await visible('#sidebar') && await visible('#work'));
      await conv('명단이 필요한 일').click();
      await page.locator('#chBody .tone-done').waitFor();
    } else {
      check(`${tag}: 처음에는 대화 목록만 보인다`, await visible('#sidebar') && !(await visible('#work')));
      check(`${tag}: 목록 화면 가로 넘침 없음`, await fits());
      await shot(`10-list-${tag}.png`);
      await page.locator('#sidebar [data-filter="needs"]').click();
      await page.locator('#sidebar [data-filter="all"]').click();
      await conv('명단이 필요한 일').click();
      await page.locator('#chBody .tone-done').waitFor();
      check(`${tag}: 대화를 고르면 대화만 보인다`, !(await visible('#sidebar')) && await visible('#work') && await visible('#chBack'));
      await page.locator('#composerText').fill('고칠 점 메모');
      await page.goBack();
      await page.locator('#sidebar').waitFor();
      check(`${tag}: 브라우저 뒤로 가기로 목록에 돌아오고 거르기·고른 대화 표시가 그대로다`, !(await visible('#work')) && await page.locator('#sidebar [data-filter="all"]').getAttribute('aria-pressed') === 'true' && await conv('명단이 필요한 일').getAttribute('aria-current') === 'page');
      await conv('명단이 필요한 일').click();
      check(`${tag}: 다시 열면 쓰던 글이 남아 있다`, await page.locator('#composerText').inputValue() === '고칠 점 메모');
      await page.setViewportSize({ width: height, height: width });
      check(`${tag}: 화면을 돌려도 고른 대화와 쓰던 글이 그대로다`, (await page.locator('#chTitle').textContent()).includes('명단이 필요한 일') && await page.locator('#composerText').inputValue() === '고칠 점 메모' && await fits());
      await page.setViewportSize({ width, height });
      await page.locator('#composerText').fill('');
      await page.locator('#chBack').click();
      await page.locator('#sidebar').waitFor();
      check(`${tag}: ‹ 버튼으로도 목록에 돌아온다`, await visible('#sidebar') && !(await visible('#work')));
      await page.locator('#sidebar [data-new]').click();
      await page.locator('#chBody [data-guide-q]').fill('메일');
      await page.locator('#chBody .gd-card').click();
      await page.locator('#chBody .gd-ex').first().waitFor();
      check(`${tag}: 예시 상세 가로 넘침 없음`, await fits());
      const tinyGuide = await small('#chBody .gd-ex button, #chActions button, #chBack');
      check(`${tag}: 예시 상세의 누르는 곳이 모두 44px 이상 (${tinyGuide.join(', ') || '없음'})`, tinyGuide.length === 0);
      await shot(`10b-guide-${tag}.png`);
      await page.goBack();
      await page.locator('#chBody [data-guide-q]').waitFor();
      check(`${tag}: 예시에서 뒤로 가면 검색어가 남은 목록으로 돌아온다`, await page.locator('#chBody [data-guide-q]').inputValue() === '메일');
      await page.locator('#chBody .gd-card').click();
      await page.locator('#chBody [data-use][data-to="new"]').click();
      check(`${tag}: 휴대폰에서도 예시로 새 대화 초안까지 채운다`, await page.locator('#composerText').inputValue() === EXAMPLE_NEW && await visible('#composerSend'));
      await page.locator('#composerText').fill('');
      await page.locator('#chBody [data-guide-q]').fill('');
      await page.locator('#chBack').click();
      await page.locator('#sidebar').waitFor();
      const tinyList = await small(TOUCH);
      check(`${tag}: 목록 화면의 누르는 곳이 모두 44px 이상 (${tinyList.join(', ') || '없음'})`, tinyList.length === 0);
      await conv('명단이 필요한 일').click();
    }
    check(`${tag}: 대화 화면 가로 넘침 없음`, await fits());
    check(`${tag}: 입력창과 보내기 버튼을 쓸 수 있다`, await visible('#composerText') && await visible('#composerSend'));
    const tiny = await small(TOUCH);
    check(`${tag}: 대화 화면의 누르는 곳이 모두 44px 이상 (${tiny.join(', ') || '없음'})`, tiny.length === 0);
    await shot(`11-chat-${tag}.png`);
    await page.locator(width >= 768 ? '#sidebar [data-page="settings"]' : '#chBack').click();
    if (width < 768) await page.locator('#sidebar [data-page="settings"]').click();
    await page.locator('#chBody .set-row').first().waitFor();
    check(`${tag}: 설정 화면 가로 넘침 없음`, await fits());
    await page.locator('#chBody [data-view="team"]').click();
    await page.locator('#orgView').waitFor();
    check(`${tag}: 직원 구성 화면 가로 넘침 없음`, await fits());
    await shot(`12-team-${tag}.png`);
    await page.locator('#shellBar [data-back]').click();
  }
  check('콘솔 오류 없음', report.consoleErrors.length === 0);
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
console.log(report.passed ? `대화 화면 검사 통과: ${report.checks.length}개 확인 (${report.sizes.join(', ')}) → ${reportPath}` : `대화 화면 검사 실패 (통과 ${report.checks.length}개)\n${report.error}\n콘솔 오류: ${report.consoleErrors.join(' | ') || '없음'}`);
process.exit(report.passed ? 0 : 1);
