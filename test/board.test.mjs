import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boardDir, loadBoard, normalizePanel, setBoardAck, setBoardManager } from '../lib/board.mjs';

const panel = (items) => ({ version: 1, id: 'athena', title: '관리 필요 상담사', source: '아테나', manager: '가담당', updatedAt: '2026-11-28T01:30:00.000Z', error: null,
  cards: [{ id: 'assign', title: '이번 주 배정 상담사', hint: '설명', when: '월·수·금 10:30', link: 'https://example.com/callee', checkedAt: '2026-11-28T01:30:00.000Z', note: '', items }] });

test('현황판은 보관함/현황판의 판 파일만 읽고, 형식이 아닌 파일과 위험한 링크는 버린다', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'board-')); t.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(loadBoard(root), { manager: '', managers: [], panels: [], acks: {}, problems: [] });
  mkdirSync(boardDir(root), { recursive: true });
  writeFileSync(join(boardDir(root), 'athena.json'), JSON.stringify(panel([{ key: 'CE-1', name: '가상담사', sub: '타로', tags: ['검토중'], date: '2026-11-27', isNew: true }, { name: '키 없음' }])));
  writeFileSync(join(boardDir(root), 'broken.json'), '{');
  writeFileSync(join(boardDir(root), '설정.json'), JSON.stringify({ manager: '가담당', managers: ['가담당', '나담당'] }));
  const board = loadBoard(root);
  assert.equal(board.manager, '가담당'); assert.deepEqual(board.managers, ['가담당', '나담당']);
  assert.equal(board.panels.length, 1); assert.equal(board.panels[0].cards[0].items.length, 1);
  assert.equal(board.panels[0].cards[0].items[0].isNew, true);
  assert.match(board.problems[0], /broken\.json/);
  assert.equal(normalizePanel({ ...panel([]), cards: [{ id: 'a', title: '가', link: 'javascript:alert(1)', items: [] }] }).cards[0].link, '');
  assert.equal(normalizePanel({ ...panel([]), version: 2 }), null);
});

test('담당자 이름과 확인 표시는 작업 공간 파일에 남고, 목록에서 사라진 항목의 확인 표시는 버린다', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'board-')); t.after(() => rm(root, { recursive: true, force: true }));
  mkdirSync(boardDir(root), { recursive: true });
  writeFileSync(join(boardDir(root), '설정.json'), JSON.stringify({ managers: ['가담당'] }));
  assert.deepEqual(setBoardManager(root, ' 가담당 '), { manager: '가담당' });
  assert.deepEqual(JSON.parse(readFileSync(join(boardDir(root), '설정.json'), 'utf8')), { managers: ['가담당'], manager: '가담당' });
  assert.throws(() => setBoardManager(root, ''), /담당자/);
  assert.throws(() => setBoardManager(root, '../x'), /담당자/);
  writeFileSync(join(boardDir(root), 'athena.json'), JSON.stringify(panel([{ key: 'CE-1', name: '가상담사' }, { key: 'CE-2', name: '나상담사' }])));
  setBoardAck(root, 'athena:assign:CE-1', true); setBoardAck(root, 'athena:assign:CE-2', true);
  assert.deepEqual(Object.keys(loadBoard(root).acks).sort(), ['athena:assign:CE-1', 'athena:assign:CE-2']);
  setBoardAck(root, 'athena:assign:CE-2', false);
  assert.deepEqual(Object.keys(loadBoard(root).acks), ['athena:assign:CE-1']);
  assert.throws(() => setBoardAck(root, 'bad key', true), /항목/);
  // 한 카드를 한꺼번에 접고 되돌린다
  setBoardAck(root, ['athena:assign:CE-1', 'athena:assign:CE-2'], true);
  assert.equal(Object.keys(loadBoard(root).acks).length, 2);
  setBoardAck(root, ['athena:assign:CE-2'], false);
  assert.throws(() => setBoardAck(root, [], true), /항목/);
  assert.throws(() => setBoardAck(root, ['athena:assign:CE-1', 'x'], true), /항목/);
  // 아테나에서 처리돼 목록에서 빠지면 확인 표시도 없어진다(다시 생기면 다시 보인다)
  writeFileSync(join(boardDir(root), 'athena.json'), JSON.stringify(panel([{ key: 'CE-2', name: '나상담사' }])));
  assert.deepEqual(loadBoard(root).acks, {});
});
