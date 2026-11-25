// 발송 결과 대조함(lib/reconcile.mjs) 테스트. 리허설 10, 리허설 4의 "외부 반영 직후 중단".
// 실제 발송은 없다. 발송기는 가짜(공식 API 자리의 모의 발송기)이고 보낸 횟수를 센다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnectionStore } from '../lib/connections.mjs';
import { createBrowserWork } from '../lib/browser-work.mjs';
import { createReconcile, scopeKey } from '../lib/reconcile.mjs';

function setup(t) {
  const temp = mkdtempSync(join(tmpdir(), 'office-reconcile-')), root = join(temp, 'workspace');
  mkdirSync(join(root, '보관함'), { recursive: true });
  t.after(() => rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const store = createConnectionStore({ root, base: join(temp, 'private') });
  const conn = store.create({ provider: 'naver', label: '업무' });
  store.update(conn.id, { status: 'connected', manualLoginAt: 'x' });
  // 모의 발송기: 보낸 것을 기록한다. cut이 켜져 있으면 "보낸 직후 응답이 끊긴" 상황을 만든다(실제로는 올라갔는지 알 수 없음)
  const sent = [];
  const mock = { cut: false };
  const cafeApi = { connected: () => true, status: () => ({ configured: true, connected: true }),
    post: async (id, input) => { sent.push(input); if (mock.cut) throw Object.assign(new Error('응답 없음'), { code: 'NAVER_API', kind: 'uncertain' }); return { articleId: sent.length, articleUrl: `https://cafe.naver.com/fixture/${sent.length}` }; } };
  const sessions = { withSession: async () => { throw new Error('브라우저 경로는 쓰지 않는다'); }, close: async () => {} };
  const reconcile = createReconcile({ root });
  const work = createBrowserWork({ root, store, sessions, cafeApi, reconcile });
  const deliver = (scope, body = '승인된 본문') => work.deliver({ allowedActions: ['post'], instructionKey: 'k', signal: new AbortController().signal, execute: async () => 'x', scope,
    publication: { id: 'p1', action: 'post', service: 'naver_cafe', target: 'https://cafe.naver.com/f-e/cafes/1/menus/2', subject: '공지', connection: conn.id }, body });
  return { root, reconcile, deliver, sent, mock };
}

test('리허설 10: 발송 직후 끊긴 건이 대조함에 뜨고, 조회·새로고침·다른 기기에서 열기는 전송 0회다', async (t) => {
  const s = setup(t);
  s.mock.cut = true;
  await assert.rejects(s.deliver('run-root-1'), /미게시 확인/);
  assert.equal(s.sent.length, 1);
  // PC와 휴대폰이 각자 목록·상세를 여러 번 연다
  const pc = createReconcile({ root: s.root }), phone = createReconcile({ root: s.root });
  for (let i = 0; i < 5; i++) { pc.list(); phone.list(); pc.get(pc.list()[0].id); }
  assert.equal(s.sent.length, 1, '대조하는 동안 전송 0회');
  const [item] = pc.list();
  assert.deepEqual({ status: item.status, pending: item.pending, action: item.action, service: item.service, target: item.target, attempt: item.attempt, method: item.method },
    { status: 'uncertain', pending: true, action: 'post', service: 'naver_cafe', target: 'https://cafe.naver.com/f-e/cafes/1/menus/2', attempt: 1, method: 'api' });
  assert.equal(item.scope, scopeKey('run-root-1'), '어느 업무의 발송인지 대화 id로 찾을 수 있다');
  assert.match(item.version, /^[0-9a-f]{12}$/);
  assert.ok(item.attemptAt);
  assert.ok(!JSON.stringify(item).includes('승인된 본문'), '문안 원문은 넣지 않는다');
  // 결정 없이 업무를 다시 돌려도 보내지 않는다
  await assert.rejects(s.deliver('run-root-1'), /불확실/);
  assert.equal(s.sent.length, 1);
});

test('발송 확인: 근거를 적어야 하고, 같은 문안이면 다시 보내지 않고 확인 처리한다. 두 기기가 동시에 결정해도 한 번만 반영된다', async (t) => {
  const s = setup(t);
  s.mock.cut = true;
  await assert.rejects(s.deliver('run-root-2'), /미게시 확인/);
  s.mock.cut = false;
  const pc = createReconcile({ root: s.root }), phone = createReconcile({ root: s.root });
  const id = pc.list()[0].id;
  assert.throws(() => pc.decide(id, { decision: 'confirm' }), (e) => e.status === 400 && /증표/.test(e.message));
  assert.throws(() => pc.decide(id, { decision: 'send-now', basis: 'x' }), (e) => e.status === 400);
  assert.throws(() => pc.decide('0'.repeat(24) + '-' + '1'.repeat(24), { decision: 'hold' }), (e) => e.status === 404);
  // 확인 보류는 기록만 남고 다른 결정을 막지 않는다
  assert.equal(pc.decide(id, { decision: 'hold' }).decision, null);
  // PC와 휴대폰이 동시에 결정한다: 먼저 온 하나만 반영, 나머지는 409와 최신 상태
  const first = pc.decide(id, { decision: 'confirm', basis: '카페 게시판에서 글 확인(11/25 10:02)', by: '대표' });
  assert.equal(first.decision.decision, 'confirm');
  assert.throws(() => phone.decide(id, { decision: 'resend', basis: '안 올라감' }), (e) => e.status === 409 && e.current.decision.decision === 'confirm');
  assert.throws(() => phone.decide(id, { decision: 'confirm', basis: '확인' }), (e) => e.status === 409);
  assert.equal(s.sent.length, 1, '결정을 기록하는 동안 전송 0회');
  // 업무가 다시 진행되면 발송 문이 결정을 한 번 반영한다: 다시 보내지 않고 확인 처리
  const done = await s.deliver('run-root-2');
  assert.equal(done.status, 'confirmed');
  assert.equal(done.confirmedBy, 'user');
  assert.equal(s.sent.length, 1, '발송 확인은 외부 발송 0회');
  assert.deepEqual(pc.list(), [], '처리된 건은 대조함에서 빠진다');
  // 결정자·시각·근거가 남는다
  const history = pc.list({ all: true })[0];
  assert.deepEqual(history.decisions.map((d) => d.decision), ['hold', 'confirm', 'applied']);
  assert.deepEqual({ by: history.decisions[1].by, basis: history.decisions[1].basis }, { by: '대표', basis: '카페 게시판에서 글 확인(11/25 10:02)' });
  assert.ok(history.decisions[1].at);
  assert.equal(history.evidence.confirmedBy, 'user');
  // 이미 처리된 건에는 최신 상태를 알려 준다
  assert.throws(() => phone.decide(id, { decision: 'confirm', basis: '확인' }), (e) => e.status === 409 && e.current.status === 'confirmed');
});

test('새 발송 승인: 미발송 근거와 별도 승인이 있을 때만 새 시도 번호를 주고, 새 발송은 한 번만 일어난다', async (t) => {
  const s = setup(t);
  s.mock.cut = true;
  await assert.rejects(s.deliver('run-root-3'), /미게시 확인/);
  s.mock.cut = false;
  const pc = createReconcile({ root: s.root }), phone = createReconcile({ root: s.root });
  const id = pc.list()[0].id;
  assert.throws(() => pc.decide(id, { decision: 'resend', basis: '  ' }), (e) => e.status === 400 && /미발송을 확인한 근거/.test(e.message));
  assert.equal(pc.get(id).attempt, 1, '승인 전에는 새 시도 번호가 없다');
  // 두 기기가 동시에 새 발송을 승인한다
  const approved = pc.decide(id, { decision: 'resend', basis: '게시판에 글 없음 확인', attempt: 1 });
  assert.equal(approved.attempt, 2);
  assert.throws(() => phone.decide(id, { decision: 'resend', basis: '게시판에 글 없음 확인', attempt: 1 }), (e) => e.status === 409);
  assert.equal(phone.get(id).attempt, 2, '새 시도 번호는 한 번만 올라간다');
  assert.equal(s.sent.length, 1, '승인만으로는 보내지 않는다(업무가 다시 진행될 때 보낸다)');
  // 업무가 다시 진행되면 한 번 보낸다. 그 뒤 같은 업무를 또 돌려도 다시 보내지 않는다
  const done = await s.deliver('run-root-3');
  assert.equal(done.status, 'confirmed');
  assert.equal(s.sent.length, 2);
  assert.equal((await s.deliver('run-root-3')).status, 'confirmed');
  assert.equal(s.sent.length, 2, '새 발송은 한 번');
  assert.deepEqual(pc.list({ all: true })[0].decisions.map((d) => d.decision), ['resend', 'applied']);
});

test('문안이 바뀌었으면 발송 확인 결정으로 넘어가지 않는다(승인된 문안 버전이 같을 때만)', async (t) => {
  const s = setup(t);
  s.mock.cut = true;
  await assert.rejects(s.deliver('run-root-4', '승인된 본문'), /미게시 확인/);
  s.mock.cut = false;
  const id = s.reconcile.list()[0].id;
  s.reconcile.decide(id, { decision: 'confirm', basis: '게시 확인' });
  await assert.rejects(s.deliver('run-root-4', '고친 본문'), /불확실/);
  assert.equal(s.sent.length, 1, '다른 문안을 확인 처리하거나 보내지 않는다');
  // 결정 기록 파일은 실행 기록과 다른 폴더에 둔다(실행 기록 형식을 건드리지 않는다)
  assert.deepEqual(readdirSync(join(s.root, '.office', 'reconcile')), [`${id}.json`]);
});
