// 접수 경로(화면 / 터미널 AI) 기록과 실측 표 테스트. 자료는 모두 가상이다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { batchSummary, createBatches, itemPrompt } from '../lib/batches.mjs';
import { batchReport } from '../lib/batch-report.mjs';
import { createClient } from '../scripts/office-ask.mjs';
import { measureRows, measureSummary } from '../scripts/measure.mjs';

const key = (n) => String(n).repeat(48).slice(0, 48);

test('접수 경로: 터미널 AI가 넣은 건은 terminal로 남고, 화면에서 보낸 건과 여러 건 묶음은 화면으로 본다', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-via-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const batches = createBatches({ root });
  const terminal = batches.submit({ submitKey: key('a'), items: [{ prompt: '집계해 줘' }] }, { source: 'command', via: 'terminal' }).batch;
  const screen = batches.submit({ submitKey: key('b'), items: [{ prompt: '초안 써 줘' }] }, { source: 'command', via: 'screen' }).batch;
  const many = batches.submit({ submitKey: key('c'), items: [{ prompt: '하나' }, { prompt: '둘' }] }).batch;
  assert.equal(batchSummary(terminal).items[0].via, 'terminal');
  assert.equal('via' in batchSummary(screen).items[0], false, '화면이 기본이라 따로 싣지 않는다');
  assert.deepEqual([batchReport(terminal).rows[0].via, batchReport(screen).rows[0].via, batchReport(many).rows[1].via], ['terminal', 'screen', 'screen']);
  assert.equal(batchReport({ ...many, items: many.items.map((i) => ({ ...i, source: 'schedule' })) }).rows[0].via, 'schedule');
  // 팀장 방에서 맡긴 업무: 요청 원문과 제목은 그대로 두고, 실행 지시문 뒤에 담당 팀만 덧붙인다
  const led = batches.submit({ submitKey: key('d'), items: [{ prompt: '오늘은 문의 건수부터 정리해 줘' }] }, { source: 'command', via: 'screen', to: 'research', toName: '시험조사부', toLead: '가나팀장' }).batch;
  assert.equal(batchSummary(led).items[0].to, 'research');
  assert.equal(led.items[0].title, '오늘은 문의 건수부터 정리해 줘');
  assert.match(itemPrompt(led.items[0], led), /^오늘은 문의 건수부터 정리해 줘\n\n\[담당 지정\]\n이 업무는 시험조사부에 맡긴다\. 팀장 가나팀장/);
  assert.doesNotMatch(itemPrompt(terminal.items[0], terminal), /담당 지정/);
  // 다시 읽어도 경로가 남는다
  assert.equal(batchSummary(createBatches({ root }).get(terminal.id)).items[0].via, 'terminal');
});

test('office-ask의 지시는 via: terminal을 붙여 지시창과 같은 API로 들어간다', async () => {
  const sent = [];
  const client = createClient({ url: 'http://127.0.0.1:1/', token: 't', fetchImpl: async (url, init) => { sent.push([String(url), JSON.parse(init.body)]); return new Response('{"id":"r1"}', { headers: { 'content-type': 'application/json' } }); } });
  await client.ask('현황을 정리해 줘');
  assert.deepEqual(sent, [['http://127.0.0.1:1/api/runs', { prompt: '현황을 정리해 줘', via: 'terminal' }]]);
});

test('실측 표: 경로별로 끝난 건만 평균을 내고, 진행 중인 건은 건수만 센다', () => {
  const row = (id, via, label, workMs, calls, input, output, unreported = 0) => ({ id, title: '제목', via, label, attempts: 1, times: { workMs, slotWaitMs: 0, depWaitMs: 0, humanWaitMs: 0 }, usage: { calls, unreported, input, output } });
  const rows = measureRows([{ rows: [row('B1-1', 'screen', '완료', 60000, 6, 1000, 200), row('B1-2', 'screen', '완료', 120000, 10, 3000, 400, 1)] }, { rows: [row('B2-1', 'terminal', '완료', 90000, 7, 2000, 300), row('B3-1', 'terminal', '진행 중', 5000, 2, 100, 10)] }]);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => !JSON.stringify(Object.values(r)).includes('"제목"') || r.title === '제목'));
  const summary = Object.fromEntries(measureSummary(rows).map((g) => [g.via, g]));
  assert.deepEqual([summary.screen.total, summary.screen.done, summary.screen.avgCalls, summary.screen.avgWorkMs, summary.screen.avgInput, summary.screen.unreported], [2, 2, 8, 90000, 2000, 1]);
  assert.deepEqual([summary.terminal.total, summary.terminal.done, summary.terminal.avgCalls, summary.terminal.avgWorkMs], [2, 1, 7, 90000]);
  assert.equal(measureSummary([row('x', 'screen', '대기', 0, 0, 0, 0)].map((r) => ({ ...r, status: r.label })))[0].avgCalls, null);
});
