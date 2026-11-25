// 2.0 전체 교차검증(2026-11-25)에서 찾은 문제의 재현 테스트. 가짜 실행기·가짜 CLI만 쓴다(실제 AI·발송 없음)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBatches, itemPrompt } from '../lib/batches.mjs';
import { createSequencer } from '../dashboard/sequencer.mjs';
import { startServer } from '../dashboard/server.mjs';

const KEY = (n) => String(n).repeat(48).slice(0, 48);
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('묶음 값(예산 늘리기·80% 알림 표시)은 그 묶음 파일에 저장돼 재시작 뒤에도 남는다', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-fix-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const batches = createBatches({ root, budget: () => 40 });
  const { batch } = batches.submit({ submitKey: KEY('a'), items: [{ prompt: '하나' }, { prompt: '둘' }] });
  batches.patchBatch(batch.id, (b) => { b.budget.limitCalls = 55; b.budget.warned = true; });
  const dir = join(root, '.office', 'batches');
  assert.deepEqual(readdirSync(dir), [`${batch.id}.json`], '엉뚱한 파일(.json)을 만들지 않는다');
  assert.equal(JSON.parse(readFileSync(join(dir, `${batch.id}.json`), 'utf8')).budget.limitCalls, 55);
  const again = createBatches({ root, budget: () => 40 }).get(batch.id);
  assert.deepEqual([again.budget.limitCalls, again.budget.warned], [55, true]);
  // 지우면 파일과 제출 키가 함께 없어지고, 번호는 다시 쓰지 않는다
  assert.equal(batches.remove(batch.id), true);
  assert.equal(batches.get(batch.id), null);
  assert.equal(batches.findByKey(KEY('a')), null);
  assert.deepEqual(readdirSync(dir), []);
  assert.notEqual(batches.submit({ submitKey: KEY('b'), items: [{ prompt: '셋' }] }).batch.id, batch.id);
  assert.equal(batches.remove('B000000-999'), false);
});

function sequencerSetup(t) {
  const root = mkdtempSync(join(tmpdir(), 'office-fix-seq-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const batches = createBatches({ root });
  const runs = [], tasks = new Map(), replies = [];
  let n = 0;
  const addRun = (extra) => { const run = { id: `run-${++n}`, status: 'running', needsReply: false, ...extra }; run.rootId = run.rootId || run.id; runs.push(run); return run; };
  const sequencer = createSequencer({ batches,
    startRun: async (item, batch) => ({ run: addRun({ task: `2026-11-25/${item.id.toLowerCase()}`, prompt: itemPrompt(item, batch) }), intent: { actions: [], delegated: false } }),
    replyRun: (runId, body) => { replies.push({ runId, prompt: body.prompt }); const parent = runs.find((r) => r.id === runId); return addRun({ rootId: parent.rootId, task: parent.task }); },
    latestRun: (rootId) => runs.filter((r) => r.rootId === rootId).at(-1) || null, taskStatus: (id) => tasks.get(id) || 'active' });
  const item = (id) => batches.items().find((x) => x.item.id === id).item;
  const current = (id) => runs.filter((r) => r.rootId === item(id).run).at(-1);
  const end = async (id, how) => { const run = current(id); run.status = 'done'; if (how === 'ask') { run.needsReply = true; tasks.set(run.task, 'blocked'); } else tasks.set(run.task, 'done'); sequencer.pump(); await tick(); };
  const submit = async (key, items) => { const { batch } = batches.submit({ submitKey: KEY(key), items }); sequencer.pump(); await tick(); return batch.id; };
  return { batches, sequencer, runs, replies, item, current, end, submit };
}

test('취소한 건은 답장으로 되살아나지 않는다(순번 밖에서 다시 돌지 않는다)', async (t) => {
  const s = sequencerSetup(t);
  const id = await s.submit('a', [{ prompt: 'A 해줘' }, { prompt: 'B 해줘' }]);
  await s.end(`${id}-1`, 'ask');
  assert.equal(s.item(`${id}-1`).status, 'needs');
  s.sequencer.cancel(`${id}-1`);
  assert.equal(s.item(`${id}-1`).status, 'canceled');
  const run = s.current(`${id}-1`);
  assert.throws(() => s.sequencer.reply(run.rootId, run.id, { prompt: '이어서 재개' }), (error) => error.status === 409 && /취소한 업무/.test(error.message));
  assert.equal(s.replies.length, 0, '실행기에 답장이 넘어가지 않는다');
  assert.equal(s.item(`${id}-1`).status, 'canceled');
});

test('차례를 기다리는 동안 보낸 답장 여러 개는 덮어쓰지 않고 이어 붙여 한 번에 전달한다', async (t) => {
  const s = sequencerSetup(t);
  const id = await s.submit('a', [{ prompt: 'A 해줘' }, { prompt: 'B 해줘' }]);
  await s.end(`${id}-1`, 'ask'); // A는 질문으로 멈추고 B가 시작한다
  assert.equal(s.item(`${id}-2`).status, 'running');
  const run = s.current(`${id}-1`);
  assert.equal(s.sequencer.reply(run.rootId, run.id, { prompt: 'A안으로' }).queued, true);
  assert.equal(s.sequencer.reply(run.rootId, run.id, { prompt: '그리고 수신자는 B' }).queued, true);
  assert.equal(s.sequencer.reply(run.rootId, run.id, { prompt: '그리고 수신자는 B' }).queued, true, '같은 답장을 다시 보내도 한 번만');
  assert.equal(s.item(`${id}-1`).pendingReply.body.prompt, 'A안으로\n\n그리고 수신자는 B');
  await s.end(`${id}-2`, 'done'); // B가 끝나면 A가 답장을 받아 이어 간다
  assert.deepEqual(s.replies, [{ runId: run.id, prompt: 'A안으로\n\n그리고 수신자는 B' }]);
  assert.equal(s.item(`${id}-1`).status, 'running');
});

const FAKE = String.raw`
import {readFileSync,writeFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
const args=process.argv.slice(2);
if(args.includes('--version')){console.log('Fixture 1.0');process.exit(0)}
if(args.includes('auth')){console.log(JSON.stringify({loggedIn:true}));process.exit(0)}
if(args.includes('login')){console.log('Logged in');process.exit(0)}
let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{
 let kind;
 try{kind=JSON.parse(readFileSync(args[args.indexOf('--output-schema')+1],'utf8')).properties}catch{process.exit(1)}
 const task=(input.match(/업무 id: ([\d-]+\/run-[\w-]+)/)||[])[1]||'';
 let result;
 if(kind.plan){
  appendFileSync(process.env.FIXTURE_LOG,JSON.stringify({kind:'plan',task,to:input.includes('[담당 지정]'),after:input.includes('[이전 업무 결과]')})+'\n');
  result={question:'',needsMeeting:false,meetingAgents:[],meetingSummary:'',rerunStages:[],plan:{version:1,task,goal:'자료 정리',stages:[{id:'a',title:'a',dept:'research',agent:'research-1',inputs:[],output:'outputs/'+task+'/research/research-1-a.txt',done:'내용 확인',dependsOn:[]}],review:{by:'chief',criteria:'자료 확인'},gaps:[]}};
 }else if(kind.status){
  if(input.includes('명단이 필요한 일'))result={status:'needs_decision',question:'담당자 명단을 첨부해 주세요.'};
  else{const output=[...input.matchAll(/\n출력: ([^\n]+)/g)].at(-1)[1],path=join(process.cwd(),output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,'자료 정리 결과');result={status:'done',summary:'작성 완료'};}
 }else if(kind.revisedPlan&&!kind.verdict){result={action:'continue',reason:'계획대로 진행',question:'',revisedPlan:null}
 }else if(kind.verdict){result={verdict:'pass',stage:'',reason:'내용 확인',report:'# 완료\n\n산출물을 확인했습니다.',question:''}
 }else process.exit(1);
 console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(result)}}));
 console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}}));
});
`;

test('HTTP: 팀 지정·앞 업무 이어받기·덧붙이기의 검사, 취소한 업무에 답장 거부, 내역 초기화가 끝난 접수 묶음까지 지운다', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-fix-api-'));
  mkdirSync(join(root, 'org'));
  writeFileSync(join(root, 'org/departments.json'), JSON.stringify([{ id: 'research', name: '시험조사부', engine: 'codex', codexRole: 'exec' }, { id: 'check', name: '검증실', engine: 'codex', codexRole: 'review' }]));
  writeFileSync(join(root, 'org/roster.json'), JSON.stringify([{ id: 'research-1', name: '가나대리', department: 'research', lead: true }, { id: 'check-1', name: '다라', department: 'check' }]));
  const bin = join(root, 'fake.mjs'); writeFileSync(bin, FAKE);
  const logFile = join(root, 'calls.jsonl');
  const previous = { codex: process.env.CODEX_BIN, claude: process.env.CLAUDE_BIN };
  process.env.CODEX_BIN = join(root, 'must-not-run-global.mjs'); process.env.CLAUDE_BIN = process.env.CODEX_BIN;
  let server;
  t.after(async () => {
    await server?.close();
    for (const [name, key] of [['CODEX_BIN', 'codex'], ['CLAUDE_BIN', 'claude']]) { if (previous[key] === undefined) delete process.env[name]; else process.env[name] = previous[key]; }
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  server = await startServer({ root, port: 0, quiet: true, env: { ...process.env, CLAUDE_BIN: join(root, 'no-claude.mjs'), CODEX_BIN: bin, FIXTURE_LOG: logFile } });
  const base = `http://127.0.0.1:${server.port}`;
  const headers = { 'X-Office-Token': server.token, Origin: base, 'Content-Type': 'application/json' };
  const call = async (method, path, body) => { const res = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: res.status, json: await res.json().catch(() => ({})) }; };
  const state = async () => (await call('GET', '/api/state')).json;
  const waitItem = async (id, expected) => { const until = Date.now() + 30000; let last; while (Date.now() < until) { last = (await state()).batches.flatMap((b) => b.items).find((i) => i.id === id); if (last?.status === expected) return last; await new Promise((d) => setTimeout(d, 60)); } assert.fail(`${id}: ${last?.status} (기대 ${expected})`); return null; };
  const itemOf = async (ack) => (ack.json.item || (await state()).batches.flatMap((b) => b.items).find((i) => i.run === (ack.json.rootId || ack.json.id))?.id);
  const plans = () => (existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []);

  // 팀 지정: 없는 팀·검토 전용 팀은 거부하고, 있는 팀은 건에 남기며 지시문에 [담당 지정]이 붙는다
  assert.equal((await call('POST', '/api/runs', { prompt: '시험', to: 'nope' })).status, 400);
  assert.equal((await call('POST', '/api/runs', { prompt: '시험', to: 'check' })).status, 400, '검토 전용 팀에는 맡길 수 없다');
  const led = await call('POST', '/api/runs', { prompt: '방문 수를 집계해 줘.', to: 'research' });
  assert.equal(led.status, 202, led.json.error);
  const ledItem = await waitItem(await itemOf(led), 'done');
  assert.equal(ledItem.to, 'research');
  assert.equal(ledItem.title, '방문 수를 집계해 줘.', '제목은 대표가 적은 말 그대로');
  assert.equal(plans().at(-1).to, true, '실행 지시문에 담당 지정이 들어간다');
  assert.equal((await state()).runs.find((r) => r.id === ledItem.run).request, '방문 수를 집계해 줘.', '실행 목록에는 안내문이 붙지 않는다');

  // 앞 업무 이어받기: 없는 업무는 거부, 있는 업무는 새 업무로 접수되고 지시문에 [이전 업무 결과]가 붙는다
  assert.equal((await call('POST', '/api/runs', { prompt: '시험', after: '2026-01-01/none' })).status, 400);
  assert.equal((await call('POST', '/api/runs', { prompt: '시험', after: '../../x' })).status, 400);
  assert.equal((await call('POST', `/api/runs/${ledItem.run}/reply`, { prompt: '고쳐 줘' })).status, 409, '끝난 업무에는 답장을 넣을 수 없다');
  const next = await call('POST', '/api/runs', { prompt: '평균도 넣어 줘.', after: ledItem.task });
  assert.equal(next.status, 202, next.json.error);
  const nextItem = await waitItem(await itemOf(next), 'done');
  assert.notEqual(nextItem.task, ledItem.task);
  assert.equal(plans().at(-1).after, true);

  // 덧붙이기: 진행 중이 아닌 실행에는 붙일 수 없다(다른 업무로 새지 않는다)
  const note = await call('POST', '/api/runs', { prompt: '단위도 넣어 줘', noteFor: ledItem.run });
  assert.equal(note.status, 409);
  assert.match(note.json.error, /진행 중이 아니라/);
  assert.equal((await state()).batches.length, 2, '거부된 덧붙이기는 새 업무를 만들지 않는다');

  // 취소한 업무: 답장으로 되살릴 수 없다
  const ask = await call('POST', '/api/batches', { submitKey: KEY('f'), items: [{ prompt: '명단이 필요한 일: 검수 목록' }] });
  const askId = ask.json.batch.items[0].id;
  const asking = await waitItem(askId, 'needs');
  assert.equal((await call('POST', `/api/batches/${ask.json.batch.id}/items/1/cancel`)).status, 200);
  const runOfAsk = (await state()).runs.filter((r) => !r.phase && (r.rootId || r.id) === asking.run).at(-1);
  const revived = await call('POST', `/api/runs/${runOfAsk.id}/reply`, { prompt: '이어서 재개' });
  assert.equal(revived.status, 409, JSON.stringify(revived.json));
  assert.match(revived.json.error, /취소한 업무/);
  await new Promise((d) => setTimeout(d, 200));
  assert.equal((await state()).batches.flatMap((b) => b.items).find((i) => i.id === askId).status, 'canceled');

  // 내역 초기화: 끝난 묶음은 함께 지워진다(대화 목록에 빈 대화가 남지 않는다)
  const before = (await state()).batches.length;
  assert.equal(before, 3);
  const cleared = await call('DELETE', '/api/history');
  assert.equal(cleared.status, 200, cleared.json.error);
  assert.ok(cleared.json.removedBatches >= 2, `끝난 묶음을 지웠다: ${JSON.stringify(cleared.json)}`);
  const after = await state();
  assert.ok(after.batches.every((b) => !b.items.every((i) => i.status === 'done')), '끝난 묶음이 남지 않는다');
  assert.equal(after.tasks.filter((x) => x.status === 'done').length, 0);
});
