// 묶음 접수 → 순번 실행 → 보류·답장 → 선행 업무 전달을 실제 HTTP·실행기·오케스트레이터로 확인한다.
// CLI는 가짜이며 유료 AI를 부르지 않는다. 가짜 CLI는 받은 호출을 calls.jsonl에 적어 호출 순서와 횟수를 셀 수 있게 한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../dashboard/server.mjs';
import { saveSettings } from '../lib/settings.mjs';

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

test('HTTP: 묶음 예산 — 다 쓰면 그 묶음의 새 AI 호출이 0이고, 늘리면 이어 간다. 호출은 원장에 한 번씩 적힌다', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-seq-budget-'));
  mkdirSync(join(root, 'org'));
  writeFileSync(join(root, 'org/departments.json'), JSON.stringify([{ id: 'research', name: '리서치부', engine: 'codex', codexRole: 'exec' }]));
  writeFileSync(join(root, 'org/roster.json'), JSON.stringify([{ id: 'research-1', name: '김대리', department: 'research' }]));
  // 업무 1건 예산 5회 = 묶음 전체 상한 5회(대표 결정 D3). 한 건은 계획·단계·검토 3회를 쓴다
  saveSettings(root, { budget: { calls: 5, minutes: 60 } });
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
  const post = async (path, body, status) => {
    const response = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await response.json(); assert.equal(response.status, status, json.error); return json;
  };
  const get = async (path) => (await fetch(base + path, { headers })).json();
  const calls = () => (existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)).filter((c) => c.task) : []);
  const waitFor = async (id, expected) => {
    const deadline = Date.now() + 30000;
    let last;
    while (Date.now() < deadline) {
      last = (await get(`/api/batches/${id}`)).items.map((i) => i.status);
      if (JSON.stringify(last) === JSON.stringify(expected)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.deepEqual(last, expected);
  };

  const { batch } = await post('/api/batches', { submitKey: 'seq-budget-submit-key-01', items: [{ title: '하나', prompt: '첫째 일을 정리해 줘.' }, { title: '둘', prompt: '둘째 일을 정리해 줘.' }, { title: '셋', prompt: '셋째 일을 정리해 줘.' }] }, 201);
  // 1번 3회 + 2번 2회 = 5회에서 2번의 검토 호출이 막힌다. 3번은 시작하지 않는다
  await waitFor(batch.id, ['done', 'needs', 'waiting']);
  let detail = await get(`/api/batches/${batch.id}`);
  assert.equal(detail.budget.limitCalls, 5);
  assert.equal(detail.budget.usedCalls, 5);
  assert.equal(calls().length, 5, '한도를 넘는 AI 호출은 시작하지 않는다');
  assert.deepEqual(detail.items[2].waitingOn, { kind: 'budget' });
  assert.equal(detail.items[2].usage.calls, 0, '차례가 오지 않은 건의 AI 호출 0');
  // 사용량: 확인된 토큰과 미보고 호출 수를 따로 준다(가짜 CLI는 호출마다 입력 10·출력 5를 보고한다)
  assert.deepEqual({ calls: detail.usage.calls, reported: detail.usage.reported, unreported: detail.usage.unreported, input: detail.usage.input, output: detail.usage.output }, { calls: 5, reported: 5, unreported: 0, input: 50, output: 25 });
  assert.equal(detail.items[0].usage.calls, 3);
  assert.match(readFileSync(join(root, '.office', 'events.jsonl'), 'utf8'), /예산의 80%를 썼습니다/);
  // 조회·대기만으로는 호출이 늘지 않는다
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(calls().length, 5);

  // 지시창 단건(묶음 예산 없음)은 묶음 예산과 별개로 진행할 수 있다
  await post(`/api/batches/${batch.id}/budget`, { calls: 0 }, 400);
  const raised = await post(`/api/batches/${batch.id}/budget`, { calls: 5, reason: '정상 3건에 부족' }, 200);
  assert.equal(raised.budget.limitCalls, 10);
  // 늘리면 기다리던 3번이 스스로 시작한다. 막혔던 2번은 대표가 재개해야 움직인다
  await waitFor(batch.id, ['done', 'needs', 'done']);
  const state = await get('/api/state');
  const blocked = state.runs.filter((r) => !r.phase && r.task === detail.items[1].task).at(-1);
  await post(`/api/runs/${blocked.id}/reply`, { prompt: '이어서 재개' }, 202);
  await waitFor(batch.id, ['done', 'done', 'done']);
  detail = await get(`/api/batches/${batch.id}`);
  assert.equal(detail.usage.calls, calls().length, '원장의 호출 수 = 실제 호출 수(호출당 한 번)');
  assert.ok(detail.usage.calls <= 10 && detail.budget.usedCalls === detail.usage.calls);
  assert.equal(detail.budget.log.length, 1);
  assert.equal(detail.budget.log[0].add, 5);
  // 원장 파일이 남는다(재시작 뒤 예산을 이어서 센다)
  assert.ok(existsSync(join(root, '.office', 'ledger')));
});
