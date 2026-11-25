// 묶음 보고·처리 이력 CSV·대기시간(lib/batch-report.mjs) 테스트. 리허설 9, 11
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchReport, createReportCards, historyCsv, itemTimes, waitAlerts, HISTORY_COLUMNS } from '../lib/batch-report.mjs';

const T0 = Date.parse('2026-11-25T00:00:00Z'); // 한국 시각 09:00
const at = (min) => new Date(T0 + min * 60000).toISOString();
const ev = (list) => list.map(([type, min, extra], i) => ({ no: i + 1, type, at: at(min), ...(extra || {}) }));
// A: 완료(재시도 1회: 질문 → 답장 → 완료), B: A 의존 완료, C: 확인 필요(명단), D: 완료
const batch = () => ({ id: 'B261125-001', seq: 1, title: '운영 업무 4건', createdAt: at(0), items: [
  { id: 'B261125-001-1', no: 1, title: '회신 집계', prompt: '비밀 원문 A 수신자 someone@example.com', attachments: ['보관함/업로드/2026-11-25/명단.xlsx'], done: '', dependsOn: [], status: 'done', attempt: 2, run: 'run-1', task: '2026-11-25/a',
    events: ev([['accepted', 0], ['started', 0, { attempt: 1 }], ['needs', 10, { reason: '대표 답변이 필요합니다.' }], ['resume-queued', 25], ['resumed', 30, { attempt: 2 }], ['done', 40]]) },
  { id: 'B261125-001-2', no: 2, title: '주간보고', prompt: '비밀 원문 B', attachments: [], done: '', dependsOn: [1], status: 'done', attempt: 1, run: 'run-2', task: '2026-11-25/b',
    events: ev([['accepted', 0], ['started', 45, { attempt: 1 }], ['done', 60]]) },
  { id: 'B261125-001-3', no: 3, title: '검수 목록', prompt: '비밀 원문 C', attachments: [], done: '', dependsOn: [], status: 'needs', reason: '대표 답변이 필요합니다.', attempt: 1, run: 'run-3', task: '2026-11-25/c',
    events: ev([['accepted', 0], ['started', 10, { attempt: 1 }], ['needs', 15, { reason: '대표 답변이 필요합니다.' }]]) },
  { id: 'B261125-001-4', no: 4, title: '=배너 이월', prompt: '비밀 원문 D', attachments: [], done: '', dependsOn: [], status: 'done', attempt: 1, run: 'run-4', task: '2026-11-25/d',
    events: ev([['accepted', 0], ['started', 15, { attempt: 1 }], ['failed', 20, { reason: '고객 홍길동 연락처 누락' }], ['resumed', 22, { attempt: 2 }], ['done', 25]]) },
] });
const usage = { 'B261125-001-1': { calls: 7, reported: 6, unreported: 1, input: 600, output: 60 }, 'B261125-001-2': { calls: 3, reported: 3, unreported: 0, input: 300, output: 30 },
  'B261125-001-3': { calls: 2, reported: 2, unreported: 0, input: 200, output: 20 }, 'B261125-001-4': { calls: 4, reported: 3, unreported: 1, input: 300, output: 30 } };
const usageOf = (items) => items.reduce((sum, i) => Object.fromEntries(Object.keys(sum).map((k) => [k, sum[k] + usage[i.id][k]])), { calls: 0, reported: 0, unreported: 0, input: 0, output: 0 });
const NOW = T0 + 70 * 60000;

test('대기시간: 실행 자리 대기·선행 결과 대기·사람 답변 대기·실제 작업이 겹치지 않고, 원인이 바뀌면 구간이 끝난다', () => {
  const b = batch();
  const a = itemTimes(b.items[0], b, NOW);
  assert.deepEqual([a.slotWaitMs, a.depWaitMs, a.humanWaitMs, a.workMs].map((ms) => ms / 60000), [5, 0, 15, 20], 'A: 작업 10+10, 사람 15(질문→답장), 답장 뒤 자리 대기 5');
  // B는 접수 0분 ~ A 완료 40분은 선행 결과 대기, 40~45분은 실행 자리 대기
  const second = itemTimes(b.items[1], b, NOW);
  assert.deepEqual([second.slotWaitMs, second.depWaitMs, second.humanWaitMs, second.workMs].map((ms) => ms / 60000), [5, 40, 0, 15]);
  assert.deepEqual(second.segments.map((s) => s.kind), ['dependency', 'slot', 'work']);
  assert.equal(second.firstStartedAt, at(45), '접수 시각과 실제 시작 시각을 구분한다');
  // C는 아직 답을 기다린다: 열린 구간은 지금까지
  const third = itemTimes(b.items[2], b, NOW);
  assert.deepEqual([third.slotWaitMs, third.humanWaitMs, third.workMs].map((ms) => ms / 60000), [10, 55, 5]);
  assert.equal(third.segments.at(-1).open, true);
  // 구간의 합 = 접수부터 끝(또는 지금)까지. 겹치거나 빠진 시간이 없다
  for (const item of b.items) {
    const t = itemTimes(item, b, NOW);
    const end = t.endedAt ? Date.parse(t.endedAt) : NOW;
    const idle = item.no === 4 ? 2 * 60000 : 0; // 실패(20분)~재개(22분)는 어느 대기에도 넣지 않는다
    assert.equal(t.slotWaitMs + t.depWaitMs + t.humanWaitMs + t.workMs + idle, end - Date.parse(t.acceptedAt), item.id);
  }
});

test('리허설 9: 완료 3·확인 필요 1 묶음의 보고와 처리 이력 CSV — 건수·재시도·호출 수가 맞고 원문·주소가 없다', () => {
  const b = batch();
  const report = batchReport(b, { usageOf, resultOf: (item) => ({ summary: `${item.title} 완료`, folder: `outputs/${item.task}/`, files: [`outputs/${item.task}/report.md`] }), now: NOW });
  assert.equal(report.total, 4);
  assert.equal(Object.values(report.counts).reduce((a, n) => a + n, 0), 4, '상태별 건수의 합 = 접수 건수');
  assert.deepEqual({ done: report.counts.done, needs: report.counts.needs }, { done: 3, needs: 1 });
  assert.equal(report.summary, '운영 업무 4건 · 완료 3 / 확인 필요 1');
  assert.equal(report.settled, true, '더 진행할 건이 없으면 집계를 확정한다');
  assert.equal(report.complete, false);
  assert.deepEqual(report.rows.map((r) => r.no), [1, 2, 3, 4], '원래 접수 순서대로');
  assert.equal(report.rows[0].outputs.folder, 'outputs/2026-11-25/a/');
  assert.equal(report.rows[2].outputs, null);
  assert.equal(report.rows[2].result, '대표 답변이 필요합니다.');
  assert.match(report.rows[2].next, /이 업무에 답변/);
  assert.equal(report.usage.calls, 16);
  assert.equal(report.usage.unreported, 2);
  assert.ok(!JSON.stringify(report).includes('비밀 원문'), '보고에는 요청 원문이 없다');

  const csv = historyCsv(b, { usageOf, now: NOW });
  assert.ok(csv.startsWith('\ufeff'), 'UTF-8 BOM');
  const rows = csv.slice(1).trimEnd().split('\r\n').map((line) => line.split(','));
  assert.deepEqual(rows[0], HISTORY_COLUMNS);
  const body = rows.slice(1);
  assert.deepEqual([...new Set(body.map((r) => r[1]))], b.items.map((i) => i.id), '고유 업무 4개');
  assert.equal(body.filter((r) => r[5].startsWith('요약')).length, 4);
  // 재시도 이력: 1번 건의 재개 사건이 시도 2로 이어진다
  const retry = body.find((r) => r[1] === 'B261125-001-1' && r[5] === '재개');
  assert.equal(retry[3], '2');
  assert.equal(retry[6], '2026-11-25 09:30:00', '한국 시각');
  // 호출·미보고 건수가 화면(보고)과 같다
  const summaryRows = body.filter((r) => r[5].startsWith('요약'));
  assert.equal(summaryRows.reduce((sum, r) => sum + Number(r[12]), 0), report.usage.calls);
  assert.equal(summaryRows.reduce((sum, r) => sum + Number(r[13]), 0), report.usage.unreported);
  assert.deepEqual(summaryRows[1].slice(8, 12), ['5.0', '40.0', '0.0', '15.0']);
  // 금지된 원문·제목·첨부·주소·임의 사유가 없다
  for (const banned of ['비밀 원문', 'someone@example.com', '명단.xlsx', '회신 집계', '배너 이월', '홍길동']) assert.ok(!csv.includes(banned), banned);
  assert.ok(csv.includes('실행 실패'), '실패 사유는 분류만 내보낸다');
});

test('보고의 다음 행동: 선행 업무 대기·예산·차례 대기를 구분하고, 진행할 건이 남아 있으면 확정하지 않는다', () => {
  const b = batch();
  b.items[1] = { ...b.items[1], status: 'waiting', events: ev([['accepted', 0]]) };
  b.items[0] = { ...b.items[0], status: 'canceled', events: ev([['accepted', 0], ['canceled', 5]]) };
  const waitingOn = (id) => (id === 'B261125-001-2' ? { kind: 'dependency', item: 'B261125-001-1', title: '회신 집계', status: 'canceled' } : null);
  const report = batchReport(b, { waitingOn, usageOf, now: NOW });
  assert.match(report.rows[1].next, /선행 업무 "회신 집계" 대기\(취소\)/);
  assert.equal(report.settled, true, '스스로 시작할 수 없는 대기 건만 남으면 확정');
  assert.equal(batchReport(b, { waitingOn: () => ({ kind: 'slot', title: '앞 업무' }), usageOf, now: NOW }).settled, false);
  assert.match(batchReport(b, { waitingOn: () => ({ kind: 'budget' }), usageOf, now: NOW }).rows[1].next, /묶음 예산/);
});

test('리허설 11: 대기 → 사람 답변 대기 → 재개. 임계값을 넘긴 같은 구간의 알림은 1개이고, 기준이 없으면 시간만 기록한다', () => {
  const item = (events, status) => ({ id: 'B261125-002-1', no: 1, title: '배너 이월 정리', dependsOn: [], status, events: ev(events) });
  const list = (it) => [{ id: 'B261125-002', title: 't', items: [it] }];
  const threshold = 20 * 60000;
  // 접수 뒤 28분째 실행 자리 대기
  let it = item([['accepted', 0]], 'waiting');
  assert.deepEqual(waitAlerts(list(it), null, T0 + 28 * 60000), [], '기준이 없으면 알리지 않는다(시간은 itemTimes가 준다)');
  assert.equal(itemTimes(it, list(it)[0], T0 + 28 * 60000).slotWaitMs, 28 * 60000);
  assert.deepEqual(waitAlerts(list(it), threshold, T0 + 10 * 60000), [], '기준 전');
  const due = waitAlerts(list(it), threshold, T0 + 28 * 60000);
  assert.equal(due.length, 1);
  assert.deepEqual({ item: due[0].item, since: due[0].since, waited: due[0].waitedMs / 60000 }, { item: 'B261125-002-1', since: at(0), waited: 28 });
  // 알림을 사건으로 남기면 같은 구간은 다시 알리지 않는다(모든 기기 공통)
  it = item([['accepted', 0], ['wait-alert', 28, { since: at(0) }]], 'waiting');
  assert.deepEqual(waitAlerts(list(it), threshold, T0 + 40 * 60000), []);
  // 시작 → 질문 → 사람 답변 대기: 실행 자리 대기 알림 대상이 아니다
  it = item([['accepted', 0], ['wait-alert', 28, { since: at(0) }], ['started', 30], ['needs', 35]], 'needs');
  assert.deepEqual(waitAlerts(list(it), threshold, T0 + 120 * 60000), []);
  // 답장 뒤 다시 자리 대기: 새 구간이므로 기준을 넘기면 한 번 더 알린다
  it = item([['accepted', 0], ['wait-alert', 28, { since: at(0) }], ['started', 30], ['needs', 35], ['resume-queued', 60]], 'waiting');
  assert.deepEqual(waitAlerts(list(it), threshold, T0 + 70 * 60000), []);
  const again = waitAlerts(list(it), threshold, T0 + 85 * 60000);
  assert.equal(again.length, 1);
  assert.equal(again[0].since, at(60));
  const t = itemTimes(it, list(it)[0], T0 + 85 * 60000);
  assert.deepEqual([t.slotWaitMs, t.humanWaitMs, t.workMs].map((ms) => ms / 60000), [55, 25, 5], '구간별 시간이 겹치지 않는다');
});

test('보고 카드 저장: 정리됐을 때 한 번, 건수가 바뀌면 같은 카드에 이력을 더하고, 저장 실패는 3번 시도 뒤 표시만 한다', () => {
  const store = new Map();
  let failures = 0, writes = 0;
  const cards = createReportCards({ root: 'x', now: () => NOW,
    write: (file, value) => { writes++; if (failures > 0) { failures--; throw new Error('disk full'); } store.set(file, structuredClone(value)); },
    read: (file, fallback) => store.get(file) ?? fallback });
  const b = batch();
  const report = (mutate) => { const copy = batch(); mutate?.(copy); return batchReport(copy, { usageOf, now: NOW }); };
  assert.equal(cards.update({ ...report(), settled: false }).changed, false, '정리되기 전에는 저장하지 않는다');
  const first = cards.update(report());
  assert.deepEqual([first.first, first.changed, first.failed], [true, true, false]);
  assert.equal(cards.update(report()).changed, false, '같은 집계는 다시 저장하지 않는다(알림도 한 번)');
  // 명단을 보완해 C가 완료 → 같은 카드에 이력 추가, 알림 대상(first)은 아니다
  const second = cards.update(report((x) => { x.items[2].status = 'done'; x.items[2].reason = ''; }));
  assert.deepEqual([second.first, second.changed], [false, true]);
  assert.equal(second.card.revisions.length, 2);
  assert.equal(second.card.complete, true);
  assert.equal(second.card.settledAt, first.card.settledAt);
  // 저장 실패: 최초 1회 + 재시도 2회 = 3번 시도, 그 뒤 실패 표시(업무 재실행과 무관)
  writes = 0; failures = 3;
  const failed = cards.update(report((x) => { x.items[2].status = 'canceled'; }));
  assert.equal(writes, 3);
  assert.equal(failed.failed, true);
  assert.equal(cards.failed(b.id), true);
  assert.equal(cards.get(b.id).revisions.length, 2, '저장된 카드는 그대로');
  // 한두 번 실패는 재시도로 넘어간다
  writes = 0; failures = 2;
  assert.equal(cards.update(report((x) => { x.items[2].status = 'canceled'; })).changed, true);
  assert.equal(writes, 3);
  assert.equal(cards.failed(b.id), false);
});