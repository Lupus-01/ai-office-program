// 업무함 화면 로직(dashboard/public/inbox.js의 순수 함수) 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attentionItems, composePayload, composePreview, countsText, emptyDraft, emptyItem, itemNote, moveItem, newSubmitKey, usageText, waitingText } from '../dashboard/public/inbox.js';
import { SUBMIT_KEY, normalizeSubmission } from '../lib/batches.mjs';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard', 'public');
const item = (no, status, extra = {}) => ({ id: `B261125-001-${no}`, no, title: `업무 ${no}`, status, dependsOn: [], ...extra });

test('제출 키는 서버 형식에 맞고 매번 다르다', () => {
  const a = newSubmitKey(), b = newSubmitKey();
  assert.match(a, SUBMIT_KEY);
  assert.notEqual(a, b);
  assert.equal(newSubmitKey(() => new Uint8Array(24)).length, 48);
});

test('작성 내용 → 제출 본문: 선행 업무는 고유 키로 따라가고, 서버 검사를 그대로 통과한다', () => {
  const draft = emptyDraft('k'.repeat(24));
  const [a] = draft.items;
  Object.assign(a, { title: ' 집계 ', prompt: '집계해 줘\n표로', done: ' 표가 있다 ' });
  const b = { ...emptyItem(), prompt: '보고서 써 줘', dependsOn: [a.key], attachments: [{ name: '명단.xlsx', path: '보관함/업로드/2026-11-25/명단.xlsx' }] };
  const c = { ...emptyItem(), prompt: '정리해 줘', dependsOn: ['지운-항목'] };
  draft.items.push(b, c);
  const { errors, body } = composePayload(draft);
  assert.deepEqual(errors, []);
  assert.deepEqual(body, { submitKey: 'k'.repeat(24), items: [{ title: '집계', prompt: '집계해 줘\n표로', done: '표가 있다' },
    { prompt: '보고서 써 줘', attachments: ['보관함/업로드/2026-11-25/명단.xlsx'], dependsOn: [1] }, { prompt: '정리해 줘' }] });
  // 화면이 만든 본문은 서버의 제출 검사(첨부 파일 존재 확인 제외)를 통과한다
  assert.equal(normalizeSubmission('.', body, { checkFiles: false }).items.length, 3);
  assert.deepEqual(composePreview(draft).map((p) => [p.no, p.title, p.attachments, p.dependsOn]), [[1, '집계', 0, []], [2, '보고서 써 줘', 1, [1]], [3, '정리해 줘', 0, []]]);

  // 순서를 바꿔 선행 업무가 뒤로 가면 보내기 전에 알려 준다
  draft.items = moveItem(draft.items, 1, -1);
  assert.deepEqual(draft.items.map((i) => i.prompt), ['보고서 써 줘', '집계해 줘\n표로', '정리해 줘']);
  assert.match(composePayload(draft).errors.join(' '), /1번 업무: 선행 업무는 앞선 항목만/);
  assert.deepEqual(moveItem(draft.items, 0, -1), draft.items, '맨 위에서 위로는 그대로');
  assert.deepEqual(moveItem(draft.items, 2, 1), draft.items);
  // 빈 요청은 항목 번호와 함께 알려 준다
  assert.match(composePayload({ submitKey: 'x', items: [emptyItem()] }).errors[0], /1번 업무: 요청 내용/);
  assert.match(composePayload({ submitKey: 'x', items: [] }).errors.join(' '), /한 건 이상/);
});

test('목록 문구: 대기 사유를 구분하고, 확인이 필요한 건을 모은다', () => {
  assert.equal(waitingText(item(2, 'waiting')), '차례 대기');
  assert.equal(waitingText(item(2, 'waiting', { waitingOn: { kind: 'slot', title: '집계' } })), '차례 대기 — 앞선 업무 "집계"');
  assert.equal(waitingText(item(2, 'waiting', { waitingOn: { kind: 'dependency', title: '집계', status: 'needs' } })), '선행 업무 "집계" 대기');
  assert.match(waitingText(item(2, 'waiting', { waitingOn: { kind: 'dependency', title: '집계', status: 'canceled' } })), /취소 상태라 스스로 시작하지 못합니다/);
  assert.match(waitingText(item(2, 'waiting', { waitingOn: { kind: 'budget' } })), /묶음 예산/);
  assert.match(waitingText(item(2, 'waiting', { resumeQueued: true })), /답장을 접수했습니다/);
  assert.equal(itemNote(item(1, 'needs', { reason: '대표 답변이 필요합니다.' })), '대표 답변이 필요합니다.');
  assert.equal(itemNote(item(1, 'done')), '완료했습니다.');

  const batches = [{ id: 'B261125-001', title: '운영 4건', total: 5, counts: { done: 1, needs: 1, waiting: 3 }, items: [
    item(1, 'done'), item(2, 'needs'), item(3, 'waiting', { waitingOn: { kind: 'slot' } }),
    item(4, 'waiting', { waitingOn: { kind: 'dependency', title: 'x', status: 'failed' } }), item(5, 'waiting', { waitingOn: { kind: 'dependency', title: 'y', status: 'running' } })] }];
  assert.deepEqual(attentionItems(batches).map((x) => x.item.no), [2, 4], '확인 필요 건과, 선행 업무가 죽어 스스로 시작하지 못하는 건');
  assert.equal(countsText(batches[0]), '완료 1 / 확인 필요 1 / 대기 3');
  assert.equal(countsText({ counts: {} }), '없음');
  assert.deepEqual(attentionItems(undefined), []);
});

test('사용량 문구: 미보고 호출을 0으로 치지 않고 따로 적는다', () => {
  assert.equal(usageText(null), 'AI 호출 0회');
  assert.equal(usageText({ calls: 7, input: 1200, output: 300, unreported: 0 }), 'AI 호출 7회 · 확인된 입력 1,200 · 출력 300 토큰');
  assert.match(usageText({ calls: 7, input: 1200, output: 300, unreported: 2 }), /미보고 2회\(토큰 미포함\)/);
});

test('화면 파일: 업무함 영역·작성창이 있고, 화면 코드는 원문을 그대로 innerHTML에 넣지 않는다', async () => {
  const html = await readFile(path.join(PUBLIC, 'index.html'), 'utf8');
  for (const id of ['viewInbox', 'inboxNav', 'inboxList', 'inboxThread', 'inboxReply', 'inboxReplyText', 'composeDialog', 'composeItems', 'composePreview', 'composeSubmit', 'composeFile']) assert.match(html, new RegExp(`id="${id}"`), id);
  const src = await readFile(path.join(PUBLIC, 'inbox.js'), 'utf8');
  // 서버에서 온 글·사용자가 쓴 글은 esc()를 거쳐서만 들어간다(제목·원문·사유·주소)
  for (const field of ['item.title', 'full.prompt', 'full.done', 'batch.title', 'row.result', 'row.next', 'it.target', 'run.summary']) assert.match(src, new RegExp(`esc\\(${field.replace('.', '\\.')}`), field);
  assert.doesNotMatch(src, /\$\{(?:item|full|batch|row|it|run)\.(?:title|prompt|done|reason|result|next|target|summary)\}/, 'esc 없이 넣은 곳이 없어야 한다');
  // 조회는 GET만, 상태를 바꾸는 요청은 정해진 다섯 곳뿐이다
  assert.deepEqual([...src.matchAll(/api\('POST', [`']([^`'$]+)/g)].map((m) => m[1]).sort(), ['/api/batches', '/api/batches/', '/api/batches/', '/api/reconcile/', '/api/runs/']);
  const css = await readFile(path.join(PUBLIC, 'styles.css'), 'utf8');
  assert.match(css, /\.layout\.is-inbox/);
  assert.match(css, /\.ibx-new \{[^}]*min-height: 44px/, '주요 버튼은 44px 이상');
});