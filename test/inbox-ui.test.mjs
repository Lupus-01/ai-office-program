// 대화 화면(dashboard/public/inbox.js의 순수 함수) 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attentionEntries, composeMode, countsText, entrySig, isUnread, itemNote, newSubmitKey, progressText, richText, runStatus, sizeText, streamEntries, threadMessages, usageText, waitingText, withUploads } from '../dashboard/public/inbox.js';
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
  assert.deepEqual([sizeText(27), sizeText(2048), sizeText(3 * 1024 * 1024), sizeText(undefined)], ['27B', '2KB', '3.0MB', '']);
});

test('대화 목록: 접수한 건 하나가 대화 하나다. 묶음을 거치지 않은 지시(빠른 조회·감시)도 대화 하나로 센다', () => {
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
  // 새 소식: 끝났거나 답변이 필요한 대화가 마지막으로 본 뒤 바뀌었을 때만
  const sig = entrySig(entries[3], 'r3');
  assert.equal(isUnread(entries[3], sig, {}), true);
  assert.equal(isUnread(entries[3], sig, { [entries[3].id]: sig }), false);
  assert.equal(isUnread(entries[4], entrySig(entries[4], 'm1'), {}), false, '진행 중인 대화는 새 소식이 아니다');
});

test('대화: 내 지시 → 질문 → 내 답글 → 완료 보고만 남고, 직원 이름과 중간 과정은 내보이지 않는다', () => {
  const entry = { id: 'B261125-001-1', kind: 'item', at: at(0), title: '검수 목록', status: 'done', note: '완료했습니다', run: 'r1', task: 't1' };
  const runs = [
    { id: 'r1', rootId: 'r1', createdAt: at(0), endedAt: at(3), status: 'done', request: '검수 목록', summary: '대표 결정이 필요합니다. 명단을 첨부해 주세요.', task: 't1' },
    { id: 'r1-s', rootId: 'r1', parentId: 'r1', phase: 'stage', createdAt: at(1), status: 'done' },
    { id: 'r2', rootId: 'r1', parentId: 'r1', createdAt: at(10), endedAt: at(14), status: 'done', request: '명단 보냈어', summary: '요약', task: 't1' }];
  const feed = [
    { ts: at(12), kind: 'agent.stop', agent: 'research-1', task: 't1', summary: '작성 완료' },
    { ts: at(1), kind: 'plan.set', agent: 'chief', task: 't1' },
    { ts: at(2), kind: 'agent.start', agent: 'research-1', task: 't1' },
    { ts: at(2), kind: 'tool.start', agent: 'research-1', task: 't1', summary: 'Read' },
    { ts: at(2), kind: 'agent.start', agent: 'x', task: '다른 업무' },
    { ts: at(13), kind: 'flow.review_request', agent: 'chief', task: 't1', summary: '단계 산출물 검토를 요청했습니다.' }];
  const messages = threadMessages({ entry, prompt: '검수 목록을 정리해 줘.\n담당자별로.', runs, feed, results: { r2: '# 완료\n\n산출물을 확인했습니다.' } });
  assert.deepEqual(messages.map((m) => [m.who, m.role, m.tone || '', m.text.split('\n')[0], Boolean(m.deliver)]), [
    ['나', 'me', '', '검수 목록을 정리해 줘.', false], ['AI 비서', 'ai', 'past', '대표 결정이 필요합니다. 명단을 첨부해 주세요.', false],
    ['나', 'me', '', '명단 보냈어', false], ['AI 비서', 'ai', 'done', '# 완료', true]]);
  // 진행 중이면 지금 하는 일 한 줄만 보인다(가장 최근 사건 기준, 누가 했는지는 없다)
  const running = [{ id: 'r1', rootId: 'r1', createdAt: at(0), status: 'running', request: '검수 목록', task: 't1' }];
  const live = threadMessages({ entry: { ...entry, status: 'running' }, runs: running, feed });
  assert.equal(live.length, 2);
  assert.deepEqual([live[1].tone, live[1].text], ['live', '결과를 검토하고 있습니다…']);
  assert.equal(progressText(running[0], [], 't1'), '접수했습니다. 바로 시작합니다…');
  assert.match(progressText({ ...running[0], continuous: true }, feed, 't1'), /계속 지켜보고/);
  assert.equal(progressText({ ...running[0], createdAt: at(20) }, feed, 't1'), '접수했습니다. 바로 시작합니다…', '앞선 실행의 사건은 쓰지 않는다');
  // 아직 시작 전이면 접수와 대기 사유만 보인다
  const waiting = threadMessages({ entry: { ...entry, run: null, status: 'waiting', note: '차례 대기 — 앞선 업무 "집계"' } });
  assert.deepEqual(waiting.map((m) => m.text), ['검수 목록', '접수했습니다. 차례 대기 — 앞선 업무 "집계"']);
  // 답을 기다리는 질문
  const asking = threadMessages({ entry: { ...entry, status: 'needs' }, runs: [{ ...runs[0], needsReply: true }] });
  assert.deepEqual([asking[1].tone, Boolean(asking[1].deliver)], ['question', false]);
});

test('입력창: 새 대화·답글·진행 중 덧붙이기·보낼 수 없음을 대화 상태로 정한다', () => {
  const entry = (status) => ({ id: 'x', status });
  assert.equal(composeMode(null).mode, 'new');
  assert.equal(composeMode(entry('needs'), { status: 'done', needsReply: true, canReply: true }).mode, 'reply');
  assert.equal(composeMode(entry('needs'), { status: 'done', canReply: true }).placeholder, '답변을 적어 보내세요');
  assert.equal(composeMode(entry('done'), { status: 'done', canReply: true }).mode, 'reply', '끝난 대화에도 이어서 말할 수 있다');
  assert.equal(composeMode(entry('running'), { status: 'running' }).mode, 'note');
  assert.equal(composeMode(entry('done'), { status: 'done', canReply: false }).mode, 'off');
  assert.match(composeMode(entry('waiting'), undefined).hint, /차례를 기다리고/);
  assert.equal(composeMode(entry('canceled'), { status: 'done', canReply: true }).mode, 'off');
});

test('문구: 대기 사유·건수·사용량, 그리고 결과 글의 제목 줄은 안전하게 굵게만 바꾼다', () => {
  assert.equal(waitingText(item(2, 'waiting')), '차례 대기');
  assert.equal(waitingText(item(2, 'waiting', { waitingOn: { kind: 'slot', title: '집계' } })), '차례 대기 — 앞선 업무 "집계"');
  assert.match(waitingText(item(2, 'waiting', { waitingOn: { kind: 'dependency', title: '집계', status: 'canceled' } })), /취소 상태라 스스로 시작하지 못합니다/);
  assert.match(waitingText(item(2, 'waiting', { waitingOn: { kind: 'budget' } })), /묶음 예산/);
  assert.match(waitingText(item(2, 'waiting', { resumeQueued: true })), /답글을 접수했습니다/);
  assert.equal(itemNote(item(1, 'needs', { reason: '대표 답변이 필요합니다.' })), '대표 답변이 필요합니다.');
  assert.equal(countsText({ counts: { done: 1, needs: 1, waiting: 3 } }), '완료 1 / 답변 필요 1 / 대기 3');
  assert.equal(usageText(null), 'AI 호출 0회');
  assert.match(usageText({ calls: 7, input: 1200, output: 300, unreported: 2 }), /확인된 입력 1,200 · 출력 300 토큰 · 미보고 2회\(토큰 미포함\)/);
  assert.equal(richText('# 완료\n\n<b>본문</b>\n\n\n\n## 걸린 시간\n- 1분', esc), '<strong class="wm-h">완료</strong>&lt;b&gt;본문&lt;/b&gt;\n\n<strong class="wm-h">걸린 시간</strong>- 1분');
});

test('화면 파일: 대화형 뼈대(대화 목록·대화·입력창)만 있고 사무실 메뉴는 없다. 받은 글은 esc를 거쳐서만 들어간다', async () => {
  const html = await readFile(path.join(PUBLIC, 'index.html'), 'utf8');
  for (const id of ['shell', 'sidebar', 'work', 'chBack', 'chTitle', 'chActions', 'chBody', 'composer', 'composerText', 'composerAdd', 'composerQueue', 'composerSend', 'shellBar', 'app']) assert.match(html, new RegExp(`id="${id}"`), id);
  for (const id of ['threadPane', 'thReply', 'sbToggle']) assert.doesNotMatch(html, new RegExp(`id="${id}"`), `${id}는 없앴다`);
  assert.match(html, /<html lang="ko" data-theme="calm">/, '기본은 차분한 테마');
  assert.ok(html.indexOf('id="sidebar"') < html.indexOf('id="work"') && html.indexOf('id="work"') < html.indexOf('id="app"'), '대화 목록 → 대화 → 설정용 화면 순서');
  assert.deepEqual(THEMES, ['calm', 'neon', 'pastel']);
  assert.deepEqual(VIEWS.slice(0, 2), ['inbox', 'team']);
  const src = await readFile(path.join(PUBLIC, 'inbox.js'), 'utf8');
  for (const field of ['e.title', 'm.text', 'm.who', 'b.title', 'row.result', 'row.next', 'it.target', 'item.text.split', 'f.name', 'p.text', 'n.text']) assert.match(src, new RegExp(`esc\\(${field.replaceAll('.', '\\.')}`), field);
  // (threadMessages는 화면에 넣기 전의 일반 글을 만들고, 그 글은 bubble에서 esc를 거친다 — entry.*는 거기서만 쓴다)
  assert.ok(!/\$\{(?:e|m|b|f|p|n|d|row|it|item|full)\.(?:title|text|note|prompt|reason|result|next|target|summary|name|rel|error)\}/.test(src), 'esc 없이 넣은 곳이 없어야 한다');
  // 화면에서 사무실 구조로 가는 길은 설정의 직원 구성 하나뿐이다
  assert.deepEqual([...new Set([...src.matchAll(/data-view="([a-z]+)"/g)].map((m) => m[1]))], ['team']);
  assert.doesNotMatch(src, /departments\.(?:map|filter)|agents\[|'control'|'office'|'outputs'/, '부서·직원 목록과 예전 화면을 그리지 않는다');
  // 상태를 바꾸는 요청은 정해진 곳뿐이다: 보내기(단건·묶음)·답글·중지·취소·예산·대조 결정
  assert.deepEqual([...new Set([...src.matchAll(/api\('POST', [`']([^`'$]+)/g)].map((m) => m[1]))].sort(), ['/api/batches', '/api/batches/', '/api/reconcile/', '/api/runs', '/api/runs/']);
  assert.match(src, /ev\.isComposing/, '한글 조합 중 Enter는 보내지 않는다');
  const css = await readFile(path.join(PUBLIC, 'styles.css'), 'utf8');
  assert.match(css, /:root\[data-theme="calm"\]/);
  assert.match(css, /\.shell \{[^}]*grid-template-columns: 320px/);
  assert.match(css, /@media \(max-width: 767px\)[^]*\.shell\.show-main \.sb/, '휴대폰에서는 목록과 대화를 한 화면씩');
});
