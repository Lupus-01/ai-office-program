// 순번 실행기(dashboard/sequencer.mjs) 테스트. 리허설 1(A~D 제출 후 E 추가), 3(보류와 재개)
// 실행기는 가짜다: 시작·답장 호출을 기록하고, 테스트가 실행의 끝(완료·질문·실패·중지)을 정한다. AI 호출은 없다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBatches, itemPrompt } from '../lib/batches.mjs';
import { createSequencer } from '../dashboard/sequencer.mjs';
import { createSchedules } from '../lib/schedules.mjs';
import { waitingItems } from '../lib/updates.mjs';
import { batchSummary } from '../lib/batches.mjs';

const KEY = (n) => `submit-key-${String(n).padStart(8, '0')}`;
const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup(t, { startFails = () => false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'office-seq-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const batches = createBatches({ root });
  const runs = [], tasks = new Map(), calls = { start: [], reply: [], judge: 0 };
  let n = 0;
  const addRun = (extra) => { const run = { id: `run-${++n}`, status: 'running', needsReply: false, ...extra }; run.rootId = run.rootId || run.id; runs.push(run); return run; };
  const sequencer = createSequencer({ batches,
    startRun: async (item, batch) => {
      calls.start.push(item.id);
      if (!item.intent && !item.start) calls.judge++; // 서버와 같게: 예약·감시 후속 업무는 판별하지 않는다
      if (startFails(item)) throw new Error('로그인된 도구가 없습니다.');
      const run = addRun({ task: `2026-11-25/${item.id.toLowerCase()}`, prompt: itemPrompt(item, batch), start: item.start || null });
      calls.maxBusy = Math.max(calls.maxBusy || 0, runs.filter((r) => r.status === 'running').length);
      return { run, intent: item.intent || { actions: [], delegated: false } };
    },
    replyRun: (runId, body) => {
      calls.reply.push({ runId, prompt: body.prompt });
      const parent = runs.find((r) => r.id === runId);
      return addRun({ rootId: parent.rootId, task: parent.task });
    },
    latestRun: (rootId) => runs.filter((r) => r.rootId === rootId).at(-1) || null,
    taskStatus: (id) => tasks.get(id) || 'active' });
  const item = (id) => batches.items().find((x) => x.item.id === id).item;
  const status = (batch) => batches.get(batch).items.map((i) => i.status);
  const current = (id) => runs.filter((r) => r.rootId === item(id).run).at(-1);
  // 실행의 끝을 정한다
  const finish = async (id, how = 'done') => {
    const run = current(id);
    if (how === 'done') { run.status = 'done'; tasks.set(run.task, 'done'); }
    else if (how === 'ask') { run.status = 'done'; run.needsReply = true; tasks.set(run.task, 'blocked'); }
    else if (how === 'blocked') { run.status = 'done'; tasks.set(run.task, 'blocked'); }
    else if (how === 'failed') run.status = 'failed';
    else if (how === 'stopped') { run.status = 'stopped'; run.userStopped = true; }
    sequencer.pump();
    await tick();
  };
  const submit = async (key, items) => { const { batch } = batches.submit({ submitKey: KEY(key), items }); sequencer.pump(); await tick(); return batch.id; };
  return { batches, sequencer, calls, runs, item, status, current, finish, submit };
}

const AD = () => [{ title: 'A', prompt: 'A 해줘' }, { title: 'B', prompt: 'B 해줘' }, { title: 'C', prompt: 'C 해줘' }, { title: 'D', prompt: 'D 해줘' }];

test('리허설 1: A~D를 함께 제출하고 실행 중 E를 추가하면 한 번씩 접수 순서대로 시작한다', async (t) => {
  const s = setup(t);
  const b1 = await s.submit(1, AD());
  // 접수만으로는 첫 건 하나만 시작한다. 나머지 건의 판별(AI) 호출은 0회
  assert.deepEqual(s.status(b1), ['running', 'waiting', 'waiting', 'waiting']);
  assert.deepEqual(s.calls.start, [`${b1}-1`]);
  assert.equal(s.calls.judge, 1);
  assert.deepEqual(s.sequencer.waitingOn(`${b1}-2`), { kind: 'slot', item: `${b1}-1`, title: 'A' });
  // 화면 갱신·중복 이벤트처럼 pump가 여러 번 불려도 새로 시작하지 않는다
  for (let i = 0; i < 5; i++) s.sequencer.pump();
  await tick();
  assert.equal(s.calls.start.length, 1);

  const b2 = await s.submit(2, [{ title: 'E', prompt: 'E 해줘' }]);
  assert.deepEqual(s.status(b2), ['waiting']);
  await s.finish(`${b1}-1`);
  assert.deepEqual(s.status(b1), ['done', 'running', 'waiting', 'waiting']);
  await s.finish(`${b1}-2`);
  await s.finish(`${b1}-3`);
  assert.deepEqual(s.status(b2), ['waiting'], 'E는 D가 끝나기 전에 시작하지 않는다');
  await s.finish(`${b1}-4`);
  assert.deepEqual(s.status(b1), ['done', 'done', 'done', 'done']);
  assert.deepEqual(s.status(b2), ['running']);
  await s.finish(`${b2}-1`);
  assert.deepEqual(s.calls.start, [`${b1}-1`, `${b1}-2`, `${b1}-3`, `${b1}-4`, `${b2}-1`]);
  assert.equal(s.calls.judge, 5, '건마다 판별은 실행 차례에 한 번');
  // 사건 기록: 접수 → 시작 → 완료
  assert.deepEqual(s.item(`${b1}-4`).events.map((e) => e.type), ['accepted', 'started', 'done']);
  assert.deepEqual(s.item(`${b1}-4`).events.map((e) => e.no), [1, 2, 3]);
});

test('리허설 3: A는 자료 누락, B는 A 의존, C·D는 독립 → C·D는 끝나고 A·B는 다시 묻지 않는다. 보완하면 같은 번호로 이어진다', async (t) => {
  const s = setup(t);
  const items = AD(); items[1].dependsOn = [1];
  const b = await s.submit(1, items);
  await s.finish(`${b}-1`, 'ask'); // A가 자료를 요청하며 멈춘다 → 자리 반납
  assert.deepEqual(s.status(b), ['needs', 'waiting', 'running', 'waiting'], 'B는 A 대기, 독립인 C가 시작한다');
  assert.deepEqual(s.sequencer.waitingOn(`${b}-2`), { kind: 'dependency', item: `${b}-1`, title: 'A', status: 'needs' });
  await s.finish(`${b}-3`);
  assert.deepEqual(s.status(b), ['needs', 'waiting', 'done', 'running']);

  // D가 진행 중일 때 A에 자료를 보완한다: 끼어들지 않고 재개를 예약한다. 같은 답장을 반복해도 한 번이다
  const aRun = s.current(`${b}-1`).id;
  const q1 = s.sequencer.reply(s.item(`${b}-1`).run, aRun, { prompt: '명단 첨부했어' });
  const q2 = s.sequencer.reply(s.item(`${b}-1`).run, aRun, { prompt: '명단 첨부했어' });
  const q3 = s.sequencer.reply(s.item(`${b}-1`).run, aRun, { prompt: '명단 첨부했어' });
  assert.equal(q1.queued, true);
  assert.equal(q1.ahead.id, `${b}-4`);
  assert.equal(q2.queued, true);
  assert.equal(q3.queued, true);
  assert.deepEqual(s.calls.reply, [], 'D가 끝나기 전에는 재개하지 않는다');
  assert.deepEqual(s.status(b), ['waiting', 'waiting', 'done', 'running']);

  await s.finish(`${b}-4`);
  // 빈 자리가 생기면 A가 최초 순번으로 재개된다(B보다 먼저). 새 업무가 아니라 같은 대화의 답장이다
  assert.deepEqual(s.status(b), ['running', 'waiting', 'done', 'done']);
  assert.deepEqual(s.calls.reply, [{ runId: aRun, prompt: '명단 첨부했어' }]);
  assert.deepEqual(s.calls.start, [`${b}-1`, `${b}-3`, `${b}-4`], 'A를 새로 시작하지 않고, B는 아직 시작하지 않았다');
  await s.finish(`${b}-1`);
  assert.deepEqual(s.status(b), ['done', 'running', 'done', 'done']);
  // B의 지시문에는 A의 확정 산출물 위치가 들어간다
  assert.match(s.current(`${b}-2`).prompt, /\[선행 업무 결과\][\s\S]*A \(업무 id: 2026-11-25\//);
  await s.finish(`${b}-2`);
  assert.deepEqual(s.status(b), ['done', 'done', 'done', 'done']);
  assert.equal(s.calls.reply.length, 1);
  assert.deepEqual(s.item(`${b}-1`).events.map((e) => e.type), ['accepted', 'started', 'needs', 'resume-queued', 'resumed', 'done']);
});

test('자리가 비어 있을 때의 답장은 바로 재개하고, 실패하면 원래 상태로 되돌린다', async (t) => {
  const s = setup(t);
  const b = await s.submit(1, [{ title: 'A', prompt: 'A' }]);
  await s.finish(`${b}-1`, 'ask');
  const run = s.current(`${b}-1`).id, root = s.item(`${b}-1`).run;
  const result = s.sequencer.reply(root, run, { prompt: '서울로 해줘' });
  assert.ok(result.run.id);
  assert.deepEqual(s.status(b), ['running']);
  assert.equal(s.item(`${b}-1`).attempt, 2);
  // 진행 중인 건에 온 답장은 순번 실행기가 가로채지 않는다(실행기가 409로 거부하는 예전 길)
  assert.equal(s.sequencer.reply(root, run, { prompt: '또' }), null);
  // 접수된 건이 아닌 대화는 관여하지 않는다
  assert.equal(s.sequencer.reply('run-999', 'run-999', { prompt: 'x' }), null);
  await s.finish(`${b}-1`);
  assert.equal(s.sequencer.reply(root, run, { prompt: '추가로' }), null, '완료된 건의 후속 대화도 예전 길');
});

test('실패·중지·시작 실패는 자리를 반납하고 다음 독립 건이 진행한다. 중지한 건은 스스로 다시 움직이지 않는다', async (t) => {
  const s = setup(t, { startFails: (item) => item.title === 'C' });
  const b = await s.submit(1, AD());
  await s.finish(`${b}-1`, 'failed');
  assert.deepEqual(s.status(b), ['failed', 'running', 'waiting', 'waiting']);
  await s.finish(`${b}-2`, 'stopped');
  // C는 시작 자체가 실패 → 실패로 적고 D로 넘어간다
  await tick();
  assert.deepEqual(s.status(b), ['failed', 'stopped', 'failed', 'running']);
  assert.match(s.item(`${b}-3`).reason, /로그인된 도구/);
  await s.finish(`${b}-4`, 'blocked');
  assert.deepEqual(s.status(b), ['failed', 'stopped', 'failed', 'needs'], '끝났지만 전달되지 않은 업무는 완료로 세지 않는다');
  for (let i = 0; i < 3; i++) { s.sequencer.pump(); await tick(); }
  assert.deepEqual(s.calls.start, [`${b}-1`, `${b}-2`, `${b}-3`, `${b}-4`], '실패·중지한 건을 자동으로 다시 시작하지 않는다');
  assert.equal(s.calls.reply.length, 0);
});

test('취소: 대기·확인 필요 건을 취소하면 다시 깨우지 않고, 그 건에 의존한 건은 대기로 남는다', async (t) => {
  const s = setup(t);
  const items = AD(); items[3].dependsOn = [3];
  const b = await s.submit(1, items);
  assert.throws(() => s.sequencer.cancel(`${b}-1`), (e) => e.status === 409);
  assert.equal(s.sequencer.cancel(`${b}-3`).status, 'canceled');
  assert.equal(s.sequencer.cancel(`${b}-3`).status, 'canceled');
  assert.throws(() => s.sequencer.cancel(`${b}-9`), (e) => e.status === 404);
  await s.finish(`${b}-1`);
  await s.finish(`${b}-2`);
  assert.deepEqual(s.status(b), ['done', 'done', 'canceled', 'waiting']);
  assert.deepEqual(s.sequencer.waitingOn(`${b}-4`), { kind: 'dependency', item: `${b}-3`, title: 'C', status: 'canceled' });
  assert.deepEqual(s.calls.start, [`${b}-1`, `${b}-2`]);
  // 상태별 건수의 합은 언제나 접수 건수와 같다
  assert.equal(s.status(b).length, 4);
});

test('서버 재시작: 시작 전에 꺼진 건은 대기로 되돌리고, 끊긴 실행은 확인 필요로 두고 다음 건을 이어 간다', async (t) => {
  const s = setup(t);
  const b = await s.submit(1, AD());
  // 1번은 실행 중 끊김, 2번은 시작 요청만 하고 실행 정보를 받지 못한 상태로 꺼졌다고 본다
  Object.assign(s.current(`${b}-1`), { status: 'failed', interrupted: true });
  s.batches.patch(`${b}-2`, (i) => { i.status = 'running'; });
  s.sequencer.recover();
  await tick();
  assert.deepEqual(s.status(b), ['needs', 'running', 'waiting', 'waiting']);
  assert.match(s.item(`${b}-1`).reason, /끊겼습니다/);
  assert.deepEqual(s.calls.start, [`${b}-1`, `${b}-2`]);
});

// ---- S3: 복구와 중복 방지 ----

test('리허설 4(결과 확정 직후 중단): 실행은 끊겼지만 업무가 이미 전달까지 끝났으면 완료로 적고 다시 실행하지 않는다', async (t) => {
  const s = setup(t);
  const b = await s.submit(1, AD());
  // 1번: 결과 확정 직후 서버가 꺼졌다(실행 기록은 끊김, 업무는 완료) / 재시작 뒤 복구
  const run = s.current(`${b}-1`);
  Object.assign(run, { status: 'failed', interrupted: true });
  await s.finish(`${b}-1`, 'done'); // 업무 상태를 완료로 둔다
  Object.assign(run, { status: 'failed', interrupted: true });
  s.sequencer.recover();
  await tick();
  assert.equal(s.item(`${b}-1`).status, 'done');
  assert.equal(s.calls.reply.length, 0, '완료된 업무를 재개하지 않는다');
  assert.deepEqual(s.calls.start.filter((id) => id === `${b}-1`).length, 1, '완료된 업무를 다시 시작하지 않는다');

  // 2번: 실행 중 중단(결과 없음) → 확인 필요로 두고 3번이 이어 간다. 자동 재실행은 없다
  Object.assign(s.current(`${b}-2`), { status: 'failed', interrupted: true });
  s.sequencer.recover();
  await tick();
  assert.deepEqual(s.status(b), ['done', 'needs', 'running', 'waiting']);
  assert.equal(s.item(`${b}-2`).events.at(-1).type, 'needs');
  // 끊긴 실행의 늦은 변화(옛 실행 기록이 뒤늦게 바뀜)가 새 상태를 덮지 않는다: 건은 그 대화의 마지막 실행만 본다
  const old = s.current(`${b}-2`).id, root = s.item(`${b}-2`).run;
  await s.finish(`${b}-3`); await s.finish(`${b}-4`);
  s.sequencer.reply(root, old, { prompt: '이어서 재개' });
  assert.equal(s.item(`${b}-2`).status, 'running');
  s.runs.find((r) => r.id === old).status = 'done';
  s.sequencer.pump(); await tick();
  assert.equal(s.item(`${b}-2`).status, 'running', '옛 실행의 변화로 진행 중인 새 시도를 끝내지 않는다');
});

test('일시정지·재개: 차례를 기다리던 건도 함께 멈추고, 재개하면 원래 순서대로 이어 간다. 그 사이의 새 접수는 평소대로 진행한다', async (t) => {
  const s = setup(t);
  const b = await s.submit(1, AD().slice(0, 3));
  assert.deepEqual(s.sequencer.pauseWaiting().map((x) => x.item), [`${b}-2`, `${b}-3`]);
  const run = s.current(`${b}-1`);
  Object.assign(run, { status: 'stopped', paused: true });
  s.sequencer.pump(); await tick();
  assert.deepEqual(s.status(b), ['stopped', 'stopped', 'stopped'], '진행 중인 건이 멈춘 자리에 다음 건이 시작되지 않는다');
  assert.deepEqual(s.calls.start, [`${b}-1`]);
  // 일시정지 뒤 새로 접수한 건은 바로 진행한다
  const b2 = await s.submit(2, [{ title: 'N', prompt: 'N' }]);
  assert.deepEqual(s.status(b2), ['running']);
  // "이어서 해줘": 실행하다 멈춘 1번은 답장으로(다른 건이 진행 중이라 재개 예약), 시작 전이던 2·3번은 대기로
  assert.equal(s.sequencer.reply(s.item(`${b}-1`).run, run.id, { prompt: '이어서 재개' }).queued, true);
  assert.deepEqual(s.sequencer.resumePaused().map((x) => x.item), [`${b}-2`, `${b}-3`]);
  assert.deepEqual(s.status(b), ['waiting', 'waiting', 'waiting']);
  await s.finish(`${b2}-1`);
  assert.deepEqual(s.status(b), ['running', 'waiting', 'waiting'], '원래 접수 순서의 맨 앞부터');
  assert.deepEqual(s.calls.reply, [{ runId: run.id, prompt: '이어서 재개' }]);
  await s.finish(`${b}-1`); await s.finish(`${b}-2`); await s.finish(`${b}-3`);
  assert.deepEqual(s.status(b), ['done', 'done', 'done']);
  assert.equal(s.calls.maxBusy, 1);
});

test('리허설 7: 수동 4건에 예약 회차·감시 후속 업무가 겹쳐도 한 번에 한 건이고, 같은 자료 키의 후속 업무는 한 건이다', async (t) => {
  const s = setup(t);
  const b = await s.submit(1, AD());
  // 감시 부모는 순번 밖이라 업무 자리를 차지하지 않는다. 감시가 새 자료 키 하나로 후속 업무를 세 번 요청한다(중복 도착)
  const match = (o) => o.monitorId === 'run-monitor' && o.deliveryKey === 'key-1';
  const dispatch = () => s.sequencer.findOrigin(match) || s.sequencer.enqueue({ prompt: '새 자료 보고', continuous: false, monitorId: 'run-monitor', deliveryKey: 'key-1' },
    { source: 'monitor', title: '지속 감시 새 자료 보고: a.json', origin: { monitorId: 'run-monitor', deliveryKey: 'key-1' } }).item;
  const follow = dispatch();
  assert.equal(dispatch(), follow);
  assert.equal(dispatch(), follow);
  // 예약 회차 하나
  const sched = s.sequencer.enqueue({ prompt: '아침 브리핑', continuous: false, schedule: { id: 'abc', slot: '2026-11-25' } }, { source: 'schedule' }).item;
  await tick();
  assert.equal(s.batches.list().length, 3, '묶음은 수동 1 + 감시 후속 1 + 예약 1');
  assert.deepEqual(s.sequencer.ticket(follow), { status: 'queued' });
  for (const n of [1, 2, 3, 4]) await s.finish(`${b}-${n}`);
  // 수동 4건 뒤에 접수 순서대로: 감시 후속 → 예약
  assert.equal(s.item(follow).status, 'running');
  assert.equal(s.item(sched).status, 'waiting');
  assert.deepEqual(s.current(follow).start, { continuous: false, monitorId: 'run-monitor', deliveryKey: 'key-1' }, '접수할 때 정한 인자 그대로 시작한다');
  assert.equal(s.sequencer.ticket(follow).runId, s.item(follow).run);
  assert.equal(s.sequencer.findOrigin(match), null, '실행이 생긴 뒤에는 실행 기록으로 중복을 막는다');
  await s.finish(follow);
  await s.finish(sched);
  assert.equal(s.calls.start.length, 6);
  assert.equal(s.calls.judge, 4, '예약·감시 후속 업무는 판별 호출이 없다');
  assert.equal(s.calls.maxBusy, 1);
  // 실행 없이 끝난 접수표는 자동으로 다시 시작시키지 않도록 "사용자가 멈춤"으로 알린다
  await s.submit(9, [{ prompt: '자리 차지' }]);
  const extra = s.sequencer.enqueue({ prompt: 'x', continuous: false }, { source: 'monitor', origin: { monitorId: 'm', deliveryKey: 'k2' } }).item;
  await tick();
  assert.equal(s.item(extra).status, 'waiting');
  s.sequencer.cancel(extra);
  assert.deepEqual(s.sequencer.ticket(extra), { status: 'stopped', userStopped: true, summary: '대표가 취소했습니다.' });
  assert.equal(s.sequencer.ticket('B999999-001-1'), null);
});
test('예약: 회차는 한 번만 접수되고, 접수표가 실행으로 이어지며, 앞 회차가 아직 차례를 기다리면 다음 회차를 건너뛴다', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-seq-sched-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  let now = Date.parse('2026-11-24T23:59:30Z'); // 한국 시각 25일 08:59:30
  const started = [], runs = [];
  let state = { status: 'queued' };
  const schedules = createSchedules({ root, now: () => now, runs: () => runs, ticket: () => state,
    start: (request) => { started.push(request); return { queued: true, item: `B261125-00${started.length}-1` }; } });
  schedules.add({ prompt: '아침 브리핑 만들어 줘', time: '09:00' });
  now += 40_000; // 09:00:10
  schedules.tick(); schedules.tick(); schedules.tick();
  assert.equal(started.length, 1, '같은 회차는 한 번만 접수한다');
  assert.equal(started[0].continuous, false);
  assert.equal(schedules.list()[0].lastRun.status, 'queued');
  assert.equal(schedules.list()[0].lastRun.item, 'B261125-001-1');
  // 다음 날 회차: 앞 회차가 아직 차례를 기다린다 → 건너뛴다
  now += 86400e3;
  schedules.tick();
  assert.equal(started.length, 1);
  assert.match(schedules.list()[0].lastSkipped.reason, /차례를 기다리고/);
  // 차례가 와서 실행이 생기면 그 실행으로 잇는다
  runs.push({ id: 'run-7', rootId: 'run-7', status: 'done', needsReply: false, task: '2026-11-26/x', schedule: { id: schedules.list()[0].id }, summary: '끝' });
  state = { runId: 'run-7', task: '2026-11-26/x' };
  const item = schedules.list()[0];
  assert.equal(item.lastRun.id, 'run-7');
  assert.equal(item.lastRun.status, 'done');
  now += 86400e3;
  schedules.tick();
  assert.equal(started.length, 2, '앞 회차가 끝났으면 다음 회차를 접수한다');
});

test('업데이트의 진행 중 업무 확인: 차례를 기다리는 건을 세고, 선행 업무가 취소·실패해 스스로 시작할 수 없는 건은 세지 않는다', async (t) => {
  const s = setup(t);
  const items = AD(); items[3].dependsOn = [3];
  const b = await s.submit(1, items);
  const count = () => waitingItems(s.batches.list().map(batchSummary));
  assert.equal(count(), 3);
  s.sequencer.cancel(`${b}-3`);
  assert.equal(count(), 1, '2번만 센다(3번은 취소, 4번은 취소된 3번에 의존)');
  await s.finish(`${b}-1`); await s.finish(`${b}-2`);
  assert.equal(count(), 0);
  assert.equal(waitingItems(undefined), 0);
});
