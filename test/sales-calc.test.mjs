import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compare, dayPair, explain, fold, monthPair } from '../dashboard/public/sales-calc.js';
import { boardDir, loadBoard, loadSales } from '../lib/board.mjs';

// 가상의 숫자만 쓴다
const row = (d, charge, s060, product, extra = {}) => ({ d, calls: 100, ok: 80, fail: 30, short: 5, rate: 80, tAll: 7200, tCoin: 3600, t060: 1800, tChat: 1800, sold: [2, 1, 1, 0, 0], coinCall: [900, 100, 800], s060: [s060, 0, s060], coinChat: [50, 0, 50], charge, product, total: charge + s060 + product, usd: 0, ...extra });

test('일 비교: 매출합계 증감이 구성 항목 증감의 합과 같고, 빠진 곳과 오른 곳을 문장으로 알린다', () => {
  const days = [row('2026-03-10', 700, 250, 20), row('2026-03-09', 1000, 200, 0), row('2026-03-03', 900, 100, 0)];
  const pair = dayPair(days, '2026-03-10', 'prev');
  const rows = compare(pair.cur, pair.base);
  const get = (key) => rows.find((r) => r.key === key);
  assert.equal(get('total').diff, -230);
  assert.equal(get('charge').diff + get('s060').diff + get('product').diff, get('total').diff);
  assert.equal(Math.round(get('charge').share), 130); // 빠진 금액보다 더 빠졌고 다른 항목이 메웠다
  const text = explain(rows, '전날');
  assert.match(text, /매출합계가 전날보다 230원 \(−19\.2%\) 줄었습니다/);
  assert.match(text, /빠진 곳은 코인충전매출\(−300원\)/);
  assert.match(text, /060매출은 \+50원, 판매상품매출은 \+20원 올랐습니다/);
  // 지난주 같은 요일
  assert.equal(compare(...Object.values(dayPair(days, '2026-03-10', 'week')).slice(0, 2)).find((r) => r.key === 'total').diff, -30);
  // 평균 기준은 있는 날만으로 계산하고 빠진 날 수를 알린다
  const avg = dayPair(days, '2026-03-10', 'avg7');
  assert.equal(avg.missing, 5); assert.equal(avg.base.total, (1200 + 1000) / 2);
  assert.equal(dayPair(days, '2026-03-03', 'prev').base.total, null);
  assert.equal(explain(compare(fold([]), fold([])), '전날'), '비교할 기록이 없습니다.');
});

test('월 비교: 끝난 달은 월간 표끼리, 진행 중인 달은 어제까지 누계를 기준 달의 같은 날짜까지와 비교한다', () => {
  const months = [row('2026-03', 5000, 0, 0), row('2026-02', 30000, 0, 0), row('2026-01', 20000, 0, 0), row('2025-02', 15000, 0, 0)];
  const days = [row('2026-03-03', 9999, 0, 0), row('2026-03-02', 600, 0, 0), row('2026-03-01', 500, 0, 0), row('2026-02-03', 7000, 0, 0), row('2026-02-02', 400, 0, 0), row('2026-02-01', 300, 0, 0)];
  const done = monthPair(months, days, '2026-02', '2026-03-03');
  assert.equal(done.partial, false); assert.equal(done.cur.total - done.base.total, 10000); assert.deepEqual([done.curDays, done.baseDays], [28, 31]);
  assert.equal(monthPair(months, days, '2026-01', '2026-03-03').base.total, null); // 전월 기록이 없으면 비교하지 않는다
  const live = monthPair(months, days, '2026-03', '2026-03-03'); // 오늘(3일)은 집계 중이라 뺀다
  assert.equal(live.partial, true); assert.equal(live.upto, 2); assert.equal(live.cur.total, 1100); assert.equal(live.base.total, 700);
  const noBase = monthPair(months, days.filter((r) => r.d !== '2026-02-02'), '2026-03', '2026-03-03');
  assert.equal(noBase.base.total, null); assert.match(noBase.note, /일간 기록이 부족/);
});

test('매출 기록은 현황판 판 목록과 따로 읽고, 형식이 아닌 줄은 버린다', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'sales-')); t.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(loadSales(root).days, []);
  mkdirSync(join(boardDir(root), '매출'), { recursive: true });
  writeFileSync(join(boardDir(root), '매출', '매출.json'), JSON.stringify({ version: 1, updatedAt: '2026-03-03T01:00:00.000Z', today: '2026-03-03', notes: ['메모'], days: [row('2026-03-01', 1, 2, 3), row('2026-03-02', 1, 2, 3), { d: '<script>' }, { d: '2026-03-04', total: 'x' }], months: [row('2026-03', 1, 2, 3), row('2026-03-01', 1, 2, 3)] }));
  const sales = loadSales(root);
  assert.deepEqual(sales.days.map((r) => r.d), ['2026-03-04', '2026-03-02', '2026-03-01']);
  assert.equal(sales.days[0].total, 0); assert.deepEqual(sales.months.map((r) => r.d), ['2026-03']);
  assert.deepEqual(loadBoard(root).problems, []); // 매출 폴더는 판 파일로 읽지 않는다
});
