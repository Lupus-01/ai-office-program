// 호출 원장(lib/ledger.mjs) 테스트: 호출당 한 번, 미보고는 0이 아니라 미보고, 귀속 정정, 재시작 뒤 이어 읽기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger, summarizeCalls } from '../lib/ledger.mjs';

const NOW = Date.parse('2026-11-25T01:00:00Z');

test('호출마다 번호 하나로 한 번 적고, 보고된 토큰과 미보고 호출 수를 따로 요약한다', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-ledger-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ledger = createLedger({ root, now: () => NOW });
  const a = ledger.record({ kind: 'plan', root: 'run-1', task: 't1', agent: 'chief', engine: 'claude', usage: { input: 100, output: 20, cachedInput: 5, cacheCreation: null, costUsd: 0.01 } });
  const b = ledger.record({ kind: 'stage', root: 'run-1', task: 't1', agent: 'research-1', engine: 'aside', usage: null });
  const c = ledger.record({ kind: 'judge', item: 'B261125-001-1', engine: 'claude' });
  ledger.record({ kind: 'stage', root: 'run-2', usage: { input: 7, output: 1 } });
  assert.equal(new Set([a, b, c]).size, 3);
  assert.match(a, /^c-20261125-\d+$/);
  const mine = ledger.summarize({ roots: ['run-1'], items: ['B261125-001-1'] });
  assert.deepEqual({ calls: mine.calls, reported: mine.reported, unreported: mine.unreported, input: mine.input, output: mine.output, cachedInput: mine.cachedInput }, { calls: 3, reported: 1, unreported: 2, input: 100, output: 20, cachedInput: 5 });
  assert.equal(mine.measurable, 1 / 3);
  assert.deepEqual(mine.byKind, { plan: 1, stage: 1, judge: 1 });
  // 같은 대화와 건이 겹쳐도 호출은 한 번만 센다
  ledger.attach([a], 'B261125-001-1');
  assert.equal(ledger.summarize({ roots: ['run-1'], items: ['B261125-001-1'] }).calls, 3);
  assert.equal(summarizeCalls([]).measurable, null, '호출이 없으면 비율을 0으로 적지 않는다');
  assert.deepEqual(readdirSync(join(root, '.office', 'ledger')), ['2026-11.jsonl']);
});

test('접수 전 판별 호출을 나중에 건에 귀속하고, 재시작(다시 읽기) 뒤에도 수와 귀속이 그대로다', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-ledger-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ledger = createLedger({ root, now: () => NOW });
  const judge = ledger.record({ kind: 'judge', engine: 'claude' });
  assert.equal(ledger.summarize({ items: ['B261125-002-1'] }).calls, 0);
  ledger.attach([judge, 'c-없는번호'], 'B261125-002-1');
  ledger.record({ kind: 'review', root: 'run-9', usage: { input: 1, output: 1 } });
  // 깨진 줄과 같은 번호의 중복 줄이 있어도 한 번만 센다
  const file = join(root, '.office', 'ledger', '2026-11.jsonl');
  appendFileSync(file, '{ 깨진 줄\n' + readFileSync(file, 'utf8').split('\n')[0] + '\n');
  const reopened = createLedger({ root, now: () => NOW });
  assert.equal(reopened.all().length, 2);
  assert.equal(reopened.summarize({ items: ['B261125-002-1'] }).calls, 1);
  // 번호는 이어서 매긴다(겹치지 않는다)
  const next = reopened.record({ kind: 'stage', root: 'run-9' });
  assert.ok(!reopened.all().slice(0, 2).some((call) => call.id === next));
  assert.equal(reopened.summarize({ roots: ['run-9'] }).calls, 2);
});

test('원장 파일에 쓰지 못해도 호출은 메모리에 남아 이번 실행의 예산 계산이 유지된다', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'office-ledger-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ledger = createLedger({ root, now: () => NOW, append: () => { throw new Error('disk full'); } });
  ledger.record({ kind: 'stage', root: 'run-1' });
  assert.equal(ledger.summarize({ roots: ['run-1'] }).calls, 1);
  assert.equal(ledger.all()[0].unsaved, true);
});