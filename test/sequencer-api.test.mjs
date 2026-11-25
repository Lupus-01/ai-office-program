// 묶음 접수 → 순번 실행 → 보류·답장 → 선행 업무 전달을 실제 HTTP·실행기·오케스트레이터로 확인한다.
// CLI는 가짜이며 유료 AI를 부르지 않는다. 가짜 CLI는 받은 호출을 calls.jsonl에 적어 호출 순서와 횟수를 셀 수 있게 한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../dashboard/server.mjs';

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
  if(input.includes('명단이 필요한 일')&&!input.includes('명단 보냈어'))result={status:'needs_decision',question:'담당자 명단을 첨부해 주세요.'};
  else{
   const output=[...input.matchAll(/\n출력: ([^\n]+)/g)].at(-1)[1],path=join(process.cwd(),output);
   mkdirSync(dirname(path),{recursive:true});
   writeFileSync(path,input.includes('[선행 업무 결과]')?'선행 결과를 받아 작성':'자료 정리 결과');
   result={status:'done',summary:'작성 완료'};
  }
 }else if(kind.revisedPlan&&!kind.verdict){log('progress',task);result={action:'continue',reason:'계획대로 진행',question:'',revisedPlan:null}
 }else if(kind.verdict){log('review',task);result={verdict:'pass',stage:'',reason:'내용 확인',report:'# 완료\n\n산출물을 확인했습니다.\n\n확인 필요: 없음',question:''}
 }else{log('other',task);process.exit(1)}
 console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(result)}}));
 console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}}));
});
`;

test('HTTP: 3건 접수 → 1번 질문으로 보류 → 독립인 3번 진행 → 답장으로 1번 재개 → 1번에 의존한 2번이 결과를 받아 진행', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-seq-api-'));
  mkdirSync(join(root, 'org'));
  writeFileSync(join(root, 'org/departments.json'), JSON.stringify([{ id: 'research', name: '리서치부', engine: 'codex', codexRole: 'exec' }]));
  writeFileSync(join(root, 'org/roster.json'), JSON.stringify([{ id: 'research-1', name: '김대리', department: 'research' }]));
  const bin = join(root, 'fake.mjs'); writeFileSync(bin, FAKE);
  const logFile = join(root, 'calls.jsonl');
  // 실행기에 env 전달이 빠져도 실제 CLI를 호출하지 않고 즉시 실패하는 전역 대체 경로
  const previous = { codex: process.env.CODEX_BIN, claude: process.env.CLAUDE_BIN };
  process.env.CODEX_BIN = join(root, 'must-not-run-global.mjs'); process.env.CLAUDE_BIN = process.env.CODEX_BIN;
  let server;
  t.after(async () => {
    await server?.close();
    for (const [name, key] of [['CODEX_BIN', 'codex'], ['CLAUDE_BIN', 'claude']]) { if (previous[key] === undefined) delete process.env[name]; else process.env[name] = previous[key]; }
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  // Claude는 없는 것으로 두고(없는 실행 파일) Codex 가짜만 쓴다: 판별·계획·검토가 모두 같은 가짜를 지난다
  server = await startServer({ root, port: 0, quiet: true, env: { ...process.env, CLAUDE_BIN: join(root, 'no-claude.mjs'), CODEX_BIN: bin, FIXTURE_LOG: logFile } });
  const base = `http://127.0.0.1:${server.port}`;
  const headers = { 'X-Office-Token': server.token, Origin: base, 'Content-Type': 'application/json' };
  const post = async (path, body, status) => {
    const response = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await response.json(); assert.equal(response.status, status, json.error); return json;
  };
  const get = async (path) => (await fetch(base + path, { headers })).json();
  const calls = () => (existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []);
  const statuses = async (id) => (await get(`/api/batches/${id}`)).items.map((i) => i.status);
  const waitFor = async (id, expected) => {
    const deadline = Date.now() + 30000;
    let last;
    while (Date.now() < deadline) {
      last = await statuses(id);
      if (JSON.stringify(last) === JSON.stringify(expected)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.deepEqual(last, expected);
  };

  const submitted = await post('/api/batches', { submitKey: 'seq-api-submit-key-0001', items: [
    { title: '검수 목록', prompt: '명단이 필요한 일: 프로필 검수 목록을 정리해 줘.' },
    { title: '주간보고', prompt: '1번 결과를 반영해 주간보고 초안을 써 줘.', dependsOn: [1] },
    { title: '배너 현황', prompt: '배너 이월대기 현황을 정리해 줘.' },
  ] }, 201);
  const id = submitted.batch.id;
  assert.deepEqual(submitted.batch.counts, { waiting: 3 });

  // 1번은 질문으로 멈추고, 1번에 의존한 2번은 기다리며, 독립인 3번이 끝난다
  await waitFor(id, ['needs', 'waiting', 'done']);
  const first = await get(`/api/batches/${id}`);
  const task = (n) => first.items[n - 1].task;
  assert.ok(task(1) && task(3) && !first.items[1].task, '2번은 아직 업무를 만들지 않았다');
  assert.equal(calls().filter((c) => c.task && c.task !== task(1) && c.task !== task(3)).length, 0, '2번을 위한 AI 호출은 0회');
  // 3번의 호출은 모두 1번이 멈춘 뒤에 시작됐다(한 번에 한 건)
  const order = calls().filter((c) => c.task).map((c) => c.task);
  assert.ok(order.lastIndexOf(task(1)) < order.indexOf(task(3)), `1번이 끝난 뒤 3번 시작: ${order.join(' ')}`);

  // 같은 제출을 다시 보내도(응답 유실) 아무것도 새로 시작하지 않는다
  const before = calls().length;
  const again = await post('/api/batches', { submitKey: 'seq-api-submit-key-0001', items: [
    { title: '검수 목록', prompt: '명단이 필요한 일: 프로필 검수 목록을 정리해 줘.' },
    { title: '주간보고', prompt: '1번 결과를 반영해 주간보고 초안을 써 줘.', dependsOn: [1] },
    { title: '배너 현황', prompt: '배너 이월대기 현황을 정리해 줘.' },
  ] }, 200);
  assert.equal(again.batch.id, id);
  await get('/api/batches'); await get(`/api/batches/${id}`); await get('/api/state');
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(calls().length, before, '재전송·조회로 생긴 AI 호출 0회');
  assert.deepEqual(await statuses(id), ['needs', 'waiting', 'done']);

  // 1번에 답하면 같은 번호·같은 업무로 이어지고, 끝나면 2번이 1번의 결과 위치를 받아 진행한다
  const state = await get('/api/state');
  const asking = state.runs.filter((r) => !r.phase && r.task === task(1)).at(-1);
  assert.equal(asking.needsReply, true);
  await post(`/api/runs/${asking.id}/reply`, { prompt: '명단 보냈어' }, 202);
  await waitFor(id, ['done', 'done', 'done']);
  const done = await get(`/api/batches/${id}`);
  assert.equal(done.items[0].task, task(1), '보완한 건은 새 업무가 아니라 같은 업무다');
  assert.equal(readFileSync(join(root, 'outputs', ...done.items[1].task.split('/'), 'research', 'research-1-a.txt'), 'utf8'), '선행 결과를 받아 작성');
  assert.deepEqual(done.items[0].events.map((e) => e.type), ['accepted', 'started', 'needs', 'resumed', 'done']);
  // 업무는 정확히 3개(누락·중복 0)
  assert.equal((await get('/api/state')).tasks.length, 3);
});

test('HTTP: 지시창 단건도 순번을 따른다 — 첫 지시는 바로 시작, 진행 중에 온 둘째 지시는 접수만 되고 앞 업무가 끝나면 스스로 시작', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-seq-cmd-'));
  mkdirSync(join(root, 'org'));
  writeFileSync(join(root, 'org/departments.json'), JSON.stringify([{ id: 'research', name: '리서치부', engine: 'codex', codexRole: 'exec' }]));
  writeFileSync(join(root, 'org/roster.json'), JSON.stringify([{ id: 'research-1', name: '김대리', department: 'research' }]));
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
  const post = async (path, body) => {
    const response = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await response.json(); assert.equal(response.status, 202, json.error); return json;
  };
  const get = async (path) => (await fetch(base + path, { headers })).json();

  const first = await post('/api/runs', { prompt: '배너 이월대기 현황을 정리해 줘.' });
  assert.ok(first.id, '앞에 진행 중인 건이 없으면 예전처럼 실행을 돌려준다');
  assert.equal(first.request, '배너 이월대기 현황을 정리해 줘.');
  const second = await post('/api/runs', { prompt: '회신 현황 집계표를 만들어 줘.' });
  assert.equal(second.queued, true);
  assert.equal(second.id, undefined);
  assert.equal(second.ahead.title, '배너 이월대기 현황을 정리해 줘.');
  assert.equal((await get('/api/state')).tasks.length, 1, '둘째 지시는 아직 업무를 만들지 않았다');

  const deadline = Date.now() + 30000;
  let batches;
  while (Date.now() < deadline) {
    batches = (await get('/api/batches')).batches;
    if (batches.length === 2 && batches.every((b) => b.counts.done === 1)) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.deepEqual(batches.map((b) => b.counts), [{ done: 1 }, { done: 1 }]);
  assert.equal(batches[1].items[0].id, second.item);
  const state = await get('/api/state');
  assert.equal(state.tasks.length, 2);
  // 둘째 업무의 AI 호출은 첫 업무의 마지막 호출 뒤에 시작됐다
  const order = readFileSync(logFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line).task).filter(Boolean);
  const [a, b] = batches.map((x) => x.items[0].task);
  assert.ok(order.lastIndexOf(a) < order.indexOf(b), order.join(' '));
});
