// 순번 실행기(2.0). 접수된 건 가운데 "실행 가능한 가장 먼저 접수된 건" 하나만 기존 단건 실행에 넘긴다.
// 상위 업무 자리는 1개다. 업무 안의 직원 실행(직원 자리, runner의 maxConcurrent)은 여기서 세지 않는다.
// 건의 상태 전이는 이 파일에서만 일어난다. 화면 조회·재접속은 이 파일을 부르지 않는다.
//
// 넣어 주는 것(서버가 실제 실행기를 연결하고, 테스트는 가짜를 넣는다)
//   startRun(item, batch) → { run, intent? } | Promise  새 실행을 시작한다(의도 판별 1회 포함). run.id가 대화의 뿌리다
//   replyRun(runId, body) → run                         멈춘 대화를 이어서 재개한다
//   latestRun(rootId) → run | null                      그 대화의 마지막 실행(단계 실행 제외)
//   taskStatus(taskId) → 'done' | 'blocked' | …         업무 상태
import { ITEM_STATUS as S } from '../lib/batches.mjs';

const BUSY = new Set(['running', 'queued']);
const RESUMABLE = new Set([S.needs, S.stopped, S.failed]);
const fail = (status, message) => Object.assign(new Error(message), { status });

export function createSequencer({ batches, startRun, replyRun, latestRun, taskStatus = () => null, onChange = () => {}, warn = () => {} }) {
  const starting = new Set(); // 시작 요청을 보내고 실행 정보를 아직 받지 못한 건
  const startResults = new Map(); // 건 번호 → 시작 결과(실행 또는 오류)를 주는 Promise
  let pumping = false, again = false;

  const all = () => batches.items();
  const find = (itemId) => all().find(({ item }) => item.id === itemId) || null;
  const byRun = (rootId) => all().find(({ item }) => item.run === rootId) || null;
  const save = (itemId, fn, event) => {
    try { return batches.patch(itemId, fn, event); }
    catch (error) { warn(`건 상태를 저장하지 못했습니다(${itemId})`, error); return null; }
  };

  // 선행 업무가 모두 완료돼야 실행할 수 있다. 막고 있는 선행 건을 돌려준다(없으면 null)
  function blockedBy(batch, item) {
    for (const no of item.dependsOn || []) {
      const dep = batch.items.find((i) => i.no === no);
      if (dep && dep.status !== S.done) return dep;
    }
    return null;
  }

  // 끝난 실행을 건 상태로 옮긴다. 완료는 업무가 실제로 전달까지 끝났을 때만 센다
  function settle(item, run) {
    let status, reason = '';
    // 결과 증거를 먼저 본다: 실행이 끊기거나 실패로 남았어도 업무가 이미 전달까지 끝났으면 완료다(다시 실행하지 않는다)
    if (run.status !== 'done' && run.task && taskStatus(run.task) === 'done') {
      save(item.id, (i) => { i.status = S.done; i.reason = ''; i.task = run.task; }, { type: S.done, run: run.id, recovered: true });
      return;
    }
    if (run.status === 'done') {
      if (run.needsReply) { status = S.needs; reason = '대표 답변이 필요합니다.'; }
      else if (!run.task || taskStatus(run.task) === 'done') status = S.done;
      else { status = S.needs; reason = '업무가 끝나지 않고 멈췄습니다. 결과를 확인해 주세요.'; }
    } else if (run.interrupted && !run.userStopped && !run.paused) { status = S.needs; reason = '서버가 꺼지면서 실행이 끊겼습니다. 이어서 재개할 수 있습니다.'; }
    else if (run.status === 'stopped') { status = S.stopped; reason = run.paused ? '일시정지했습니다.' : '중지했습니다.'; }
    else { status = S.failed; reason = String(run.summary || '실행에 실패했습니다.').slice(0, 300); }
    save(item.id, (i) => { i.status = status; i.reason = reason; if (run.task) i.task = run.task; }, { type: status, run: run.id, ...(reason ? { reason } : {}) });
  }

  // 실행기의 실제 상태를 건에 반영한다
  function sync() {
    for (const { item } of all()) {
      if (starting.has(item.id) || !item.run || item.status === S.done || item.status === S.canceled) continue;
      const run = latestRun(item.run);
      if (item.status === S.running) {
        if (!run) save(item.id, (i) => { i.status = S.failed; i.reason = '실행 기록을 찾을 수 없습니다.'; }, { type: S.failed, reason: '실행 기록을 찾을 수 없습니다.' });
        else if (!BUSY.has(run.status)) settle(item, run);
      } else if (run && BUSY.has(run.status)) {
        // 순번 실행기를 거치지 않고 다시 움직인 건("이어서 해줘" 일괄 재개 등)은 있는 그대로 진행 중으로 적는다
        save(item.id, (i) => { i.status = S.running; i.reason = ''; delete i.pendingReply; }, { type: 'resumed', run: run.id, external: true });
      }
    }
  }

  const running = () => all().filter(({ item }) => item.status === S.running);
  const pick = () => all().find(({ batch, item }) => item.status === S.waiting && !blockedBy(batch, item)) || null;

  function begin({ batch, item }) {
    const resume = item.pendingReply || null;
    const started = save(item.id, (i) => { i.status = S.running; i.reason = ''; i.attempt = (i.attempt || 0) + 1; delete i.pendingReply; delete i.paused; },
      { type: resume ? 'resumed' : 'started', attempt: (item.attempt || 0) + 1 });
    if (!started) return false; // 저장하지 못하면 시작하지 않는다(다음 변화 때 다시 본다)
    starting.add(item.id);
    const work = Promise.resolve().then(() => (resume ? { run: replyRun(resume.runId, resume.body) } : startRun(started, batch))).then((result) => {
      const run = result?.run;
      if (!run?.id) throw new Error('실행을 시작하지 못했습니다.');
      save(item.id, (i) => { i.run = run.rootId || run.id; if (run.task) i.task = run.task; if (result.intent) i.intent = result.intent; });
      return { run };
    }).catch((error) => {
      const reason = String(error?.message || '실행을 시작하지 못했습니다.').slice(0, 300);
      save(item.id, (i) => { i.status = S.failed; i.reason = reason; }, { type: S.failed, reason });
      throw error;
    });
    startResults.set(item.id, work);
    work.catch(() => {}).finally(() => { starting.delete(item.id); startResults.delete(item.id); onChange(); pump(); });
    return true;
  }

  // 방금 접수한 건이 바로 시작됐으면 그 실행을, 앞에 진행 중인 건이 있으면 대기 정보를 돌려준다(지시창 단건용).
  // 시작이 실패하면 그 오류를 그대로 던진다
  async function started(itemId) {
    pump();
    const work = startResults.get(itemId);
    if (work) return work;
    const found = find(itemId);
    const ahead = running()[0];
    return { queued: true, item: itemId, batch: found?.batch.id || null, ahead: ahead ? { id: ahead.item.id, title: ahead.item.title } : null };
  }

  // 자리가 비어 있으면 다음 건을 시작한다. 여러 번 불려도 건마다 시작은 한 번이다
  function pump() {
    if (pumping) { again = true; return; }
    pumping = true;
    try {
      do {
        again = false;
        sync();
        if (running().length) break;
        const next = pick();
        if (!next || !begin(next)) break;
      } while (again);
    } finally { pumping = false; }
    onChange();
  }

  // 답장·재개. 이 대화가 접수된 건이 아니면 null(서버가 예전 길로 처리한다).
  // 다른 건이 진행 중이면 지금 끼어들지 않고 원래 접수 순번으로 재개를 예약한다. 같은 답장을 여러 번 보내도 재개는 한 번이다
  function reply(rootId, runId, body) {
    const found = byRun(rootId);
    if (!found) return null;
    sync();
    const item = find(found.item.id).item;
    if (item.status === S.waiting && item.pendingReply) {
      if (item.pendingReply.body?.prompt !== body.prompt) save(item.id, (i) => { i.pendingReply = { runId, body }; }, { type: 'resume-queued', updated: true });
      return { queued: true, item: item.id };
    }
    if (!RESUMABLE.has(item.status)) return null; // 진행 중(실행기가 409로 거부)·완료(완료된 업무의 후속 대화)는 예전 길
    const others = running().filter((r) => r.item.id !== item.id);
    if (others.length) {
      save(item.id, (i) => { i.status = S.waiting; i.reason = ''; i.pendingReply = { runId, body }; delete i.paused; }, { type: 'resume-queued', ahead: others[0].item.id });
      onChange();
      return { queued: true, item: item.id, ahead: { id: others[0].item.id, title: others[0].item.title } };
    }
    const previous = { status: item.status, reason: item.reason || '' };
    save(item.id, (i) => { i.status = S.running; i.reason = ''; i.attempt = (i.attempt || 0) + 1; delete i.paused; }, { type: 'resumed', attempt: (item.attempt || 0) + 1 });
    // 새 실행이 등록되기 전에는 이 대화의 마지막 실행이 아직 "끝난 실행"이라, 그 사이의 반영(sync)을 막는다
    starting.add(item.id);
    try {
      const run = replyRun(runId, body);
      onChange();
      return { run };
    } catch (error) {
      save(item.id, (i) => { i.status = previous.status; i.reason = previous.reason; }, { type: 'resume-failed', reason: String(error.message || '').slice(0, 300) });
      throw error;
    } finally { starting.delete(item.id); }
  }

  // 취소: 진행 중인 건은 먼저 중지해야 한다. 취소한 건은 다시 깨우지 않는다
  function cancel(itemId) {
    const found = find(itemId);
    if (!found) throw fail(404, '접수된 업무를 찾을 수 없습니다.');
    sync();
    const item = find(itemId).item;
    if (item.status === S.canceled) return item;
    if (item.status === S.running) throw fail(409, '진행 중인 업무는 먼저 중지한 뒤 취소해 주세요.');
    if (item.status === S.done) throw fail(409, '이미 완료된 업무는 취소할 수 없습니다.');
    const saved = batches.patch(itemId, (i) => { i.status = S.canceled; i.reason = '대표가 취소했습니다.'; delete i.pendingReply; }, { type: S.canceled });
    pump();
    return saved;
  }

  // 서버 시작 때: 시작 요청만 하고 실행 정보를 받지 못한 건은 대기로 되돌린다(실행된 적이 없다)
  function recover() {
    for (const { item } of all()) {
      if (item.status === S.running && !item.run) save(item.id, (i) => { i.status = S.waiting; }, { type: 'requeued', reason: '시작 전에 서버가 꺼졌습니다.' });
    }
    pump();
  }

  // "하던 작업 멈추고 정리해 둬": 차례를 기다리던 건도 함께 일시정지한다(진행 중인 건이 멈춘 자리에 다음 건이 시작되지 않게).
  // 실행기의 일시정지보다 먼저 부른다. 일시정지 뒤에 새로 접수한 건은 평소대로 진행한다
  function pauseWaiting() {
    const paused = [];
    for (const { item } of all()) {
      if (item.status !== S.waiting) continue;
      if (save(item.id, (i) => { i.status = S.stopped; i.paused = true; i.reason = '일시정지했습니다.'; }, { type: 'paused' })) paused.push({ item: item.id, title: item.title });
    }
    onChange();
    return paused;
  }

  // "이어서 해줘": 시작 전에 일시정지된 건(또는 재개가 예약돼 있던 건)을 원래 순번의 대기로 되돌린다.
  // 실행하다 멈춘 건은 실행기의 일괄 재개가 답장(reply)으로 이어 간다
  function resumePaused() {
    const resumed = [];
    for (const { item } of all()) {
      if (item.status !== S.stopped || !item.paused || (item.run && !item.pendingReply)) continue;
      if (save(item.id, (i) => { i.status = S.waiting; i.reason = ''; delete i.paused; }, { type: 'unpaused' })) resumed.push({ item: item.id, title: item.title });
    }
    pump();
    return resumed;
  }

  // 예약 회차·감시 후속 업무처럼 시스템이 만든 유한 업무를 한 건짜리 묶음으로 접수한다(판별 없이 start 인자 그대로 시작한다).
  // 접수하지 못하면 null(부른 쪽이 예전처럼 바로 시작한다). origin: 같은 사건이 다시 와도 한 번만 접수하려는 식별값
  function enqueue({ prompt, ...start }, { source, title = '', origin = null }) {
    try {
      const key = `${source}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`.padEnd(16, '0');
      const { batch } = batches.submit({ submitKey: key, ...(title ? { title } : {}), items: [{ ...(title ? { title } : {}), prompt }] }, { source, start, ...(origin ? { origin } : {}) });
      Promise.resolve().then(pump);
      return { queued: true, item: batch.items[0].id };
    } catch (error) { warn(`${source} 업무를 접수하지 못해 바로 시작합니다`, error); return null; }
  }

  // 같은 사건(origin)으로 이미 접수돼 아직 실행 전인 건
  function findOrigin(match) {
    const found = all().find(({ item }) => item.origin && !item.run && (item.status === S.waiting || item.status === S.running) && match(item.origin));
    return found ? found.item.id : null;
  }

  // 접수표(건 번호)의 지금 상태. 실행이 생겼으면 { runId, task }, 아직이면 { status: 'queued' }.
  // 실행 없이 끝난 건(시작 실패·취소)은 자동으로 다시 시작시키지 않도록 사용자가 멈춘 것으로 알린다
  function ticket(itemId) {
    const item = find(itemId)?.item;
    if (!item) return null;
    if (item.run) return { runId: item.run, task: item.task || null };
    if (item.status === S.waiting || item.status === S.running) return { status: 'queued' };
    return { status: item.status === S.canceled ? 'stopped' : 'failed', userStopped: true, summary: item.reason || '' };
  }

  // 화면용: 대기 중인 건이 무엇을 기다리는지(조회만, 상태를 바꾸지 않는다)
  function waitingOn(itemId) {
    const found = find(itemId);
    if (!found || found.item.status !== S.waiting) return null;
    const dep = blockedBy(found.batch, found.item);
    if (dep) return { kind: 'dependency', item: dep.id, title: dep.title, status: dep.status };
    const ahead = running()[0];
    return ahead ? { kind: 'slot', item: ahead.item.id, title: ahead.item.title } : { kind: 'slot' };
  }

  return { pump, started, reply, cancel, recover, waitingOn, pauseWaiting, resumePaused, enqueue, findOrigin, ticket, itemOfRun: (rootId) => byRun(rootId)?.item.id || null };
}
