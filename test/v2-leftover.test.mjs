// 2차 교차검증에서 "알고도 남긴 것"을 다시 고친 뒤의 재현 테스트(2026-11-25). 가짜 실행기·가짜 CLI만 쓴다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { batchSummary, createBatches } from '../lib/batches.mjs';
import { createSequencer } from '../dashboard/sequencer.mjs';
import { summarizeCalls } from '../lib/ledger.mjs';
import { waitingItems } from '../lib/updates.mjs';
import { threadMessages, usageText } from '../dashboard/public/inbox.js';
import { startServer } from '../dashboard/server.mjs';

const KEY = (n) => String(n).repeat(48).slice(0, 48);
const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup(t, { startRun = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'office-left-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const batches = createBatches({ root });
  const runs = [], started = [];
  let n = 0;
  const addRun = (extra = {}) => { const run = { id: `run-${++n}`, status: 'running', needsReply: false, ...extra }; run.rootId = run.rootId || run.id; runs.push(run); return run; };
  const sequencer = createSequencer({ batches,
    startRun: startRun ? (item, batch, control) => startRun(item, batch, control, addRun) : async (item) => { started.push(item.id); return { run: addRun({ task: `2026-11-25/${item.id.toLowerCase()}` }), intent: { actions: [] } }; },
    replyRun: (runId) => addRun({ rootId: runs.find((r) => r.id === runId).rootId }),
    latestRun: (rootId) => runs.filter((r) => r.rootId === rootId).at(-1) || null, taskStatus: () => 'active' });
  const item = (id) => batches.items().find((x) => x.item.id === id).item;
  return { batches, sequencer, runs, started, item };
}

test('접수표 상태: 시작에 실패한 건은 다시 시도할 수 있게 알리고, 취소한 건만 "사용자가 멈춤"이며, 시작 전에 일시정지된 건은 아직 기다리는 중이다', async (t) => {
  let fail = true;
  const s = setup(t, { startRun: async (item, batch, control, addRun) => { if (fail) throw new Error('로그인된 도구가 없습니다.'); return { run: addRun(), intent: { actions: [] } }; } });
  const first = s.sequencer.enqueue({ prompt: '새 자료 보고', monitorId: 'm1', deliveryKey: 'k1' }, { source: 'monitor', title: '새 자료', origin: { monitorId: 'm1', deliveryKey: 'k1' } });
  await tick(); await tick();
  assert.equal(s.item(first.item).status, 'failed');
  assert.deepEqual(s.sequencer.ticket(first.item), { status: 'failed', userStopped: false, summary: '로그인된 도구가 없습니다.' }, '감시가 다음 확인 때 다시 전달할 수 있다');
  assert.equal(s.sequencer.findOrigin((o) => o.monitorId === 'm1' && o.deliveryKey === 'k1'), null, '실패한 접수표는 "이미 접수됨"으로 막지 않는다');
  // 취소한 건은 다시 시도하지 않는다
  fail = false;
  const a = s.sequencer.enqueue({ prompt: '가' }, { source: 'schedule' }); await tick(); await tick();
  const b = s.sequencer.enqueue({ prompt: '나' }, { source: 'schedule' }); await tick();
  assert.equal(s.item(a.item).status, 'running');
  assert.equal(s.item(b.item).status, 'waiting');
  // 시작 전에 일시정지된 건은 기다리는 중으로 본다(예약·감시가 같은 일을 새로 만들지 않는다)
  s.sequencer.pauseWaiting();
  assert.equal(s.item(b.item).status, 'stopped');
  assert.deepEqual(s.sequencer.ticket(b.item), { status: 'queued' });
  s.sequencer.cancel(b.item);
  assert.deepEqual(s.sequencer.ticket(b.item), { status: 'stopped', userStopped: true, summary: '대표가 취소했습니다.' });
  assert.equal(s.sequencer.ticket('B000000-999-1'), null);
});

test('시작을 준비하는 동안(의도 판별 중) 일시정지가 들어오면 실행을 만들지 않고, "이어서 해줘"로 다시 차례를 받는다', async (t) => {
  let release, created = 0;
  const gate = () => new Promise((resolve) => { release = resolve; });
  const s = setup(t, { startRun: async (item, batch, control, addRun) => {
    await gate(); // 의도 판별을 기다리는 자리
    if (control?.aborted?.()) throw Object.assign(new Error('일시정지 요청으로 시작하지 않았습니다.'), { paused: true });
    created++; return { run: addRun(), intent: { actions: [] } };
  } });
  const { batch } = s.batches.submit({ submitKey: KEY('a'), items: [{ prompt: '첫째' }, { prompt: '둘째' }] });
  s.sequencer.pump(); await tick();
  const [one, two] = batch.items.map((i) => i.id);
  assert.equal(s.item(one).status, 'running');
  assert.equal(s.item(one).run, undefined, '아직 실행이 없다(판별 중)');
  const paused = s.sequencer.pauseWaiting();
  assert.deepEqual(paused.map((p) => p.item).sort(), [one, two], '준비 중인 건과 기다리던 건이 모두 멈춘다');
  release(); await tick(); await tick(); await tick();
  assert.equal(created, 0, '일시정지 뒤에 실행이 만들어지지 않는다');
  assert.deepEqual([s.item(one).status, s.item(one).paused, s.item(two).status], ['stopped', true, 'stopped']);
  // 재개하면 원래 순서대로 다시 시작한다
  const resumed = s.sequencer.resumePaused();
  assert.deepEqual(resumed.map((r) => r.item).sort(), [one, two]);
  await tick();
  assert.equal(s.item(one).status, 'running');
  release(); await tick(); await tick(); await tick();
  assert.equal(created, 1);
  assert.ok(s.item(one).run, '재개한 뒤에는 실행이 생긴다');
  assert.equal(s.item(two).status, 'waiting');
});

test('업데이트의 대기 건: 감시 후속 접수표와 대표 답을 기다리는 선행 업무에 걸린 건은 세지 않는다', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-left-up-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const batches = createBatches({ root });
  const mon = batches.submit({ submitKey: KEY('m'), items: [{ prompt: '감시 후속' }] }, { source: 'monitor' }).batch;
  assert.equal(batchSummary(mon).items[0].source, 'monitor');
  assert.equal(waitingItems([batchSummary(mon)]), 0, '감시는 업데이트를 막지 않는다');
  const sch = batches.submit({ submitKey: KEY('s'), items: [{ prompt: '예약 회차' }] }, { source: 'schedule' }).batch;
  assert.equal(waitingItems([batchSummary(sch)]), 1, '예약 회차는 센다');
  const cmd = batches.submit({ submitKey: KEY('c'), items: [{ prompt: '하나' }, { prompt: '둘', dependsOn: [1] }, { prompt: '셋' }] }, null).batch;
  assert.equal('source' in batchSummary(cmd).items[0], false);
  assert.equal(waitingItems([batchSummary(cmd)]), 3);
  batches.patch(cmd.items[0].id, (i) => { i.status = 'needs'; });
  assert.equal(waitingItems([batchSummary(batches.get(cmd.id))]), 1, '답을 기다리는 1번과 거기에 걸린 2번은 세지 않고, 독립인 3번만 센다');
});

test('사용량: 입력은 캐시로 읽은 분량까지 더한 전체로 보여 준다(Claude는 캐시분을 따로 보고하고, Codex는 input에 이미 들어 있다)', () => {
  const sum = summarizeCalls([
    { kind: 'plan', engine: 'claude', usage: { input: 4, output: 1257, cachedInput: 16601, cacheCreation: 216823 } },
    { kind: 'stage', engine: 'claude', usage: { input: 8, output: 3948, cachedInput: 129574, cacheCreation: 50254 } },
    { kind: 'stage', engine: 'codex', usage: { input: 5000, output: 300, cachedInput: 4000, cacheCreation: null } },
    { kind: 'judge', engine: 'claude', usage: null }]);
  assert.equal(sum.input, 5012, '엔진이 보고한 input은 그대로 둔다');
  assert.equal(sum.totalInput, 4 + 16601 + 216823 + 8 + 129574 + 50254 + 5000, 'Claude는 캐시분을 더하고 Codex는 더하지 않는다');
  assert.deepEqual([sum.calls, sum.reported, sum.unreported], [4, 3, 1]);
  const text = usageText(sum);
  assert.match(text, /확인된 입력 418,264\(캐시 150,175 포함\) · 출력 5,505 토큰 · 미보고 1회/);
  assert.match(usageText({ calls: 2, input: 1200, output: 300 }), /확인된 입력 1,200 · 출력 300 토큰/, '예전 기록(totalInput 없음)은 input을 쓴다');
});

test('차례를 기다리는 내 답글은 대화에 보이고, 그 질문은 더 이상 "답변 필요"로 표시되지 않는다', () => {
  const entry = { id: 'B1-1', kind: 'item', at: '2026-11-25T01:00:00Z', title: '검수 목록', status: 'waiting', note: '', run: 'r1', task: 't1', item: { resumeQueued: true } };
  const runs = [{ id: 'r1', rootId: 'r1', createdAt: '2026-11-25T01:00:00Z', endedAt: '2026-11-25T01:01:00Z', status: 'done', needsReply: true, request: '검수 목록', summary: '명단을 첨부해 주세요.', task: 't1' }];
  const messages = threadMessages({ entry, runs, queuedReply: '명단 보냈어' });
  assert.deepEqual(messages.map((m) => [m.role, m.tone || '', m.text]), [['me', '', '검수 목록'], ['ai', 'past', '명단을 첨부해 주세요.'], ['me', '', '명단 보냈어'], ['ai', 'live', '답글을 받았습니다. 진행 중인 업무가 끝나면 이어서 진행합니다.']]);
  assert.equal(threadMessages({ entry: { ...entry, item: {} }, runs }).at(-1).tone, 'question', '답하지 않았으면 질문 그대로');
});

const FAKE = String.raw`
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
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
 if(kind.plan)result={question:'',needsMeeting:false,meetingAgents:[],meetingSummary:'',rerunStages:[],plan:{version:1,task,goal:'자료 정리',stages:[{id:'a',title:'a',dept:'research',agent:'research-1',inputs:[],output:'outputs/'+task+'/research/research-1-a.txt',done:'내용 확인',dependsOn:[]}],review:{by:'chief',criteria:'자료 확인'},gaps:[]}};
 else if(kind.status){const output=[...input.matchAll(/\n출력: ([^\n]+)/g)].at(-1)[1],path=join(process.cwd(),output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,'자료 정리 결과');result={status:'done',summary:'작성 완료'};}
 else if(kind.revisedPlan&&!kind.verdict)result={action:'continue',reason:'계획대로 진행',question:'',revisedPlan:null};
 else if(kind.verdict)result={verdict:'pass',stage:'',reason:'내용 확인',report:'# 완료\n\n산출물을 확인했습니다.',question:''};
 else process.exit(1);
 console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(result)}}));
 console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}}));
});
`;

test('HTTP: 한 건 보내기를 같은 제출 키로 다시 보내면(응답을 잃은 경우) 업무가 하나만 생기고 같은 결과가 돌아온다', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-left-api-'));
  mkdirSync(join(root, 'org'));
  writeFileSync(join(root, 'org/departments.json'), JSON.stringify([{ id: 'research', name: '시험조사부', engine: 'codex', codexRole: 'exec' }]));
  writeFileSync(join(root, 'org/roster.json'), JSON.stringify([{ id: 'research-1', name: '가나대리', department: 'research' }]));
  const bin = join(root, 'fake.mjs'); writeFileSync(bin, FAKE);
  const previous = { codex: process.env.CODEX_BIN, claude: process.env.CLAUDE_BIN };
  process.env.CODEX_BIN = join(root, 'must-not-run-global.mjs'); process.env.CLAUDE_BIN = process.env.CODEX_BIN;
  let server;
  t.after(async () => {
    await server?.close();
    for (const [name, key] of [['CODEX_BIN', 'codex'], ['CLAUDE_BIN', 'claude']]) { if (previous[key] === undefined) delete process.env[name]; else process.env[name] = previous[key]; }
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  server = await startServer({ root, port: 0, quiet: true, env: { ...process.env, CLAUDE_BIN: join(root, 'no-claude.mjs'), CODEX_BIN: bin } });
  const base = `http://127.0.0.1:${server.port}`;
  const headers = { 'X-Office-Token': server.token, Origin: base, 'Content-Type': 'application/json' };
  const post = async (body) => { const res = await fetch(`${base}/api/runs`, { method: 'POST', headers, body: JSON.stringify(body) }); return { status: res.status, json: await res.json() }; };
  const batchCount = async () => (await (await fetch(`${base}/api/state`, { headers })).json()).batches.length;
  const first = await post({ prompt: '방문 수를 집계해 줘.', submitKey: KEY('a') });
  assert.equal(first.status, 202, first.json.error);
  const again = await post({ prompt: '방문 수를 집계해 줘.', submitKey: KEY('a') });
  assert.equal(again.status, 202);
  assert.equal(again.json.id, first.json.id, '같은 실행이 돌아온다');
  assert.equal(await batchCount(), 1, '업무는 하나만 생긴다');
  // 키가 다르면(대표가 같은 말을 일부러 다시 보냄) 새 업무다. 형식이 틀린 키는 없는 것으로 본다
  const other = await post({ prompt: '방문 수를 집계해 줘.', submitKey: KEY('b') });
  assert.equal(other.status, 202, other.json.error);
  assert.equal(await batchCount(), 2);
  // 거부된 제출은 기억하지 않는다: 같은 키로 고쳐 다시 보낼 수 있다
  const bad = await post({ prompt: '시험', to: 'no-team', submitKey: KEY('c') });
  assert.equal(bad.status, 400);
  const fixed = await post({ prompt: '시험 삼아 표로 정리해 줘.', submitKey: KEY('c') });
  assert.equal(fixed.status, 202, fixed.json.error);
  assert.equal(await batchCount(), 3);
});
