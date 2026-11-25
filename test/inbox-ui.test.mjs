// 업무 화면(dashboard/public/inbox.js의 순수 함수) 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attentionEntries, countsText, itemNote, newSubmitKey, richText, runStatus, streamEntries, threadMessages, usageText, waitingText, withUploads } from '../dashboard/public/inbox.js';
import { SUBMIT_KEY } from '../lib/batches.mjs';
import { THEMES, VIEWS, esc } from '../dashboard/public/app.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard', 'public');
const item = (no, status, extra = {}) => ({ id: `B261125-001-${no}`, no, title: `업무 ${no}`, status, dependsOn: [], ...extra });
const at = (min) => new Date(Date.parse('2026-11-25T01:00:00Z') + min * 60000).toISOString();

test('제출 키는 서버 형식에 맞고 매번 다르다. 올린 파일은 지시창과 같은 표기로 붙는다', () => {
  const a = newSubmitKey(), b = newSubmitKey();
  assert.match(a, SUBMIT_KEY);
  assert.notEqual(a, b);
  assert.equal(withUploads('정리해 줘', []), '정리해 줘');
  assert.equal(withUploads('정리해 줘', ['보관함/업로드/a.xlsx', '보관함/업로드/b.pdf']), '정리해 줘\n\n[업로드한 파일]\n- 보관함/업로드/a.xlsx\n- 보관함/업로드/b.pdf');
});

test('업무 흐름: 접수한 건과 묶음을 거치지 않은 지시(빠른 조회·감시)를 시간순으로 한 줄씩 보여 준다', () => {
  const state = {
    batches: [{ id: 'B261125-001', seq: 1, title: '운영 3건', total: 3, createdAt: at(5), counts: { done: 1, needs: 1, waiting: 1 }, items: [
      item(1, 'needs', { run: 'r1', task: 't1', reason: '대표 답변이 필요합니다.' }), item(2, 'waiting', { dependsOn: [1], waitingOn: { kind: 'dependency', title: '업무 1', status: 'needs' } }), item(3, 'done', { run: 'r3', task: 't3' })] }],
    runs: [
      { id: 'q1', rootId: 'q1', createdAt: at(0), status: 'done', request: '오늘 환율 알려 줘', task: 'tq' },
      { id: 'r1', rootId: 'r1', createdAt: at(5), status: 'done', needsReply: true, request: '업무 1' },
      { id: 'r1-plan', rootId: 'r1', parentId: 'r1', phase: 'plan', createdAt: at(5), status: 'done' },
      { id: 'r3', rootId: 'r3', createdAt: at(6), status: 'done', request: '업무 3' },
      { id: 'm1', rootId: 'm1', createdAt: at(8), status: 'running', continuous: true, request: '새 글 올라오면 알려 줘' },
      { id: 'm1-f', rootId: 'm1-f', createdAt: at(9), status: 'running', monitorId: 'm1', request: '감시 후속' },
      { id: 'rev', rootId: 'rev', createdAt: at(9), status: 'done', target: 'review', request: '검증' }],
  };
  const entries = streamEntries(state);
  assert.deepEqual(entries.map((e) => [e.id, e.kind, e.status]), [['run:q1', 'run', 'done'], ['B261125-001-1', 'item', 'needs'], ['B261125-001-2', 'item', 'waiting'], ['B261125-001-3', 'item', 'done'], ['run:m1', 'run', 'running']],
    '건의 실행은 건으로만, 단계 실행·감시 후속·검증 실행은 따로 세우지 않는다');
  assert.equal(entries[4].note, '지속 감시 중');
  assert.match(entries[2].note, /앞 업무 "업무 1"의 결과 대기/);
  assert.deepEqual(attentionEntries(entries).map((e) => e.id), ['B261125-001-1']);
  assert.deepEqual(streamEntries({}), []);
  assert.equal(runStatus({ status: 'queued' }), 'running');
  assert.equal(runStatus({ status: 'done', needsReply: true }), 'needs');
  assert.equal(runStatus({ status: 'failed' }), 'failed');
});

test('스레드: 내 지시 → 접수 → 직원 진행 → 질문 → 내 답글 → 결과가 대화 순서로 이어진다', () => {
  const entry = { id: 'B261125-001-1', kind: 'item', at: at(0), title: '검수 목록', status: 'done', note: '완료했습니다', run: 'r1', task: 't1' };
  const runs = [
    { id: 'r1', rootId: 'r1', createdAt: at(0), endedAt: at(3), status: 'done', needsReply: true, request: '검수 목록', summary: '대표 결정이 필요합니다. 명단을 첨부해 주세요.', task: 't1' },
    { id: 'r1-s', rootId: 'r1', parentId: 'r1', phase: 'stage', createdAt: at(1), status: 'done' },
    { id: 'r2', rootId: 'r1', parentId: 'r1', createdAt: at(10), endedAt: at(14), status: 'done', request: '명단 보냈어', summary: '요약', task: 't1' }];
  const feed = [
    { ts: at(12), kind: 'agent.stop', agent: 'research-1', task: 't1', summary: '작성 완료' },
    { ts: at(1), kind: 'plan.set', agent: 'chief', task: 't1' },
    { ts: at(2), kind: 'agent.start', agent: 'research-1', task: 't1' },
    { ts: at(2), kind: 'tool.start', agent: 'research-1', task: 't1', summary: 'Read' },
    { ts: at(2), kind: 'agent.start', agent: 'x', task: '다른 업무' },
    { ts: at(13), kind: 'flow.review_request', agent: 'chief', task: 't1', summary: '단계 산출물 검토를 요청했습니다.' }];
  const messages = threadMessages({ entry, prompt: '검수 목록을 정리해 줘.\n담당자별로.', runs, feed, results: { r2: '# 완료\n\n산출물을 확인했습니다.' }, agents: { 'research-1': { name: '가나대리' } } });
  assert.deepEqual(messages.map((m) => [m.who, m.role, m.tone || '', m.text.split('\n')[0]]), [
    ['나', 'me', '', '검수 목록을 정리해 줘.'], ['비서실장', 'chief', '', '접수했습니다. 바로 시작합니다.'], ['비서실장', 'chief', '', '계획을 세웠습니다.'], ['가나대리', 'agent', '', '작업을 시작했습니다.'],
    ['비서실장', 'chief', 'question', '대표 결정이 필요합니다. 명단을 첨부해 주세요.'], ['나', 'me', '', '명단 보냈어'], ['가나대리', 'agent', '', '작업을 마쳤습니다. 작성 완료'],
    ['비서실장', 'chief', '', '단계 산출물 검토를 요청했습니다.'], ['비서실장', 'chief', 'done', '# 완료']]);
  // 진행 중이면 마지막에 "진행 중" 표시가 붙고, 아직 시작 전이면 접수와 대기 사유만 보인다
  const live = threadMessages({ entry: { ...entry, status: 'running' }, runs: [{ id: 'r1', rootId: 'r1', createdAt: at(0), status: 'running', request: '검수 목록' }] });
  assert.deepEqual([live.at(-1).tone, live.at(-1).text], ['live', '진행 중입니다…']);
  const waiting = threadMessages({ entry: { ...entry, run: null, status: 'waiting', note: '차례 대기 — 앞선 업무 "집계"' } });
  assert.deepEqual(waiting.map((m) => m.text), ['검수 목록', '접수했습니다. 차례 대기 — 앞선 업무 "집계"']);
});

test('문구: 대기 사유·건수·사용량, 그리고 결과 글의 제목 줄은 안전하게 굵게만 바꾼다', () => {
  assert.equal(waitingText(item(2, 'waiting')), '차례 대기');
  assert.equal(waitingText(item(2, 'waiting', { waitingOn: { kind: 'slot', title: '집계' } })), '차례 대기 — 앞선 업무 "집계"');
  assert.match(waitingText(item(2, 'waiting', { waitingOn: { kind: 'dependency', title: '집계', status: 'canceled' } })), /취소 상태라 스스로 시작하지 못합니다/);
  assert.match(waitingText(item(2, 'waiting', { waitingOn: { kind: 'budget' } })), /묶음 예산/);
  assert.match(waitingText(item(2, 'waiting', { resumeQueued: true })), /답글을 접수했습니다/);
  assert.equal(itemNote(item(1, 'needs', { reason: '대표 답변이 필요합니다.' })), '대표 답변이 필요합니다.');
  assert.equal(countsText({ counts: { done: 1, needs: 1, waiting: 3 } }), '완료 1 / 확인 필요 1 / 대기 3');
  assert.equal(usageText(null), 'AI 호출 0회');
  assert.match(usageText({ calls: 7, input: 1200, output: 300, unreported: 2 }), /확인된 입력 1,200 · 출력 300 토큰 · 미보고 2회\(토큰 미포함\)/);
  assert.equal(richText('# 완료\n\n<b>본문</b>\n\n\n\n## 걸린 시간', esc), '<strong class="wm-h">완료</strong>\n\n&lt;b&gt;본문&lt;/b&gt;\n\n<strong class="wm-h">걸린 시간</strong>');
});

test('화면 파일: 슬랙형 뼈대(사이드바·업무 흐름·스레드·입력창)가 있고, 받은 글은 esc를 거쳐서만 들어간다', async () => {
  const html = await readFile(path.join(PUBLIC, 'index.html'), 'utf8');
  for (const id of ['shell', 'sidebar', 'work', 'chTitle', 'chBody', 'composer', 'composerText', 'composerAdd', 'composerQueue', 'composerSend', 'threadPane', 'thTitle', 'thBody', 'thReply', 'thReplyText', 'app']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /<html lang="ko" data-theme="calm">/, '기본은 차분한 테마');
  assert.ok(html.indexOf('id="sidebar"') < html.indexOf('id="work"') && html.indexOf('id="work"') < html.indexOf('id="app"'), '사이드바 → 업무 화면 → 보조 화면 순서');
  assert.deepEqual(THEMES, ['calm', 'neon', 'pastel']);
  assert.equal(VIEWS[0], 'inbox');
  const src = await readFile(path.join(PUBLIC, 'inbox.js'), 'utf8');
  for (const field of ['e.title', 'e.note', 'm.text', 'm.who', 'b.title', 'row.result', 'row.next', 'it.target', 'item.text.split']) assert.match(src, new RegExp(`esc\\(${field.replaceAll('.', '\\.')}`), field);
  // (threadMessages는 화면에 넣기 전의 일반 글을 만들고, 그 글은 bubble에서 esc를 거친다 — entry.*는 거기서만 쓴다)
  assert.doesNotMatch(src, /\$\{(?:e|m|b|row|it|item|full)\.(?:title|text|note|prompt|reason|result|next|target|summary)\}/, 'esc 없이 넣은 곳이 없어야 한다');
  // 상태를 바꾸는 요청은 정해진 곳뿐이다: 보내기(단건·묶음)·답글·중지·취소·예산·대조 결정
  assert.deepEqual([...new Set([...src.matchAll(/api\('POST', [`']([^`'$]+)/g)].map((m) => m[1]))].sort(), ['/api/batches', '/api/batches/', '/api/reconcile/', '/api/runs', '/api/runs/']);
  assert.match(src, /ev\.isComposing/, '한글 조합 중 Enter는 보내지 않는다');
  const css = await readFile(path.join(PUBLIC, 'styles.css'), 'utf8');
  assert.match(css, /:root\[data-theme="calm"\]/);
  assert.match(css, /\.shell \{[^}]*grid-template-columns: 248px/);
});