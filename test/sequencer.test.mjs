// 순번 실행기(dashboard/sequencer.mjs) 테스트. 리허설 1(A~D 제출 후 E 추가), 3(보류와 재개)
// 실행기는 가짜다: 시작·답장 호출을 기록하고, 테스트가 실행의 끝(완료·질문·실패·중지)을 정한다. AI 호출은 없다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBatches, itemPrompt } from '../lib/batches.mjs';
import { createSequencer } from '../dashboard/sequencer.mjs';

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
      if (!item.intent) calls.judge++;
      if (startFails(item)) throw new Error('로그인된 도구가 없습니다.');
      const run = addRun({ task: `2026-11-25/${item.id.toLowerCase()}`, prompt: itemPrompt(item, batch) });
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
