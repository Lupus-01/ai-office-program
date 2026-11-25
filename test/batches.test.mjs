// 묶음 접수 저장소(lib/batches.mjs)와 접수 API(POST·GET /api/batches) 테스트. 리허설 2: 누락·중복
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BATCH_LIMITS, batchSummary, createBatches } from '../lib/batches.mjs';
import { writePrivate } from '../lib/private-state.mjs';
import { scopeKey } from '../lib/reconcile.mjs';

const KEY = (n) => `submit-key-${String(n).padStart(8, '0')}`;
const NOW = Date.parse('2026-11-25T01:00:00Z'); // 한국 시각 11월 25일 10시
const four = () => [
  { title: '회신 현황 집계', prompt: '금~목 회신 현황을 집계해 줘.\n표로 정리.' },
  { title: '주간보고 초안', prompt: '1번 집계를 반영해 주간보고 초안을 써 줘.', dependsOn: [1] },
  { prompt: '프로필 검수 목록을 정리해 줘.', done: '검수 대상이 빠짐없이 들어 있다' },
  { title: '배너 이월대기', prompt: '배너 이월대기 현황을 정리해 줘.' },
];
const tempRoot = () => mkdtempSync(join(tmpdir(), 'office-batches-'));
const batchFiles = (root) => (existsSync(join(root, '.office', 'batches')) ? readdirSync(join(root, '.office', 'batches')) : []);

test('4건 제출: 묶음 번호·건별 번호·제출 순번을 주고 파일 하나에 저장한다', () => {
  const root = tempRoot();
  try {
    const store = createBatches({ root, now: () => NOW });
    const { batch, duplicate } = store.submit({ submitKey: KEY(1), items: four() });
    assert.equal(duplicate, false);
    assert.equal(batch.id, 'B261125-001');
    assert.equal(batch.seq, 1);
    assert.equal(batch.title, '업무 4건');
    assert.deepEqual(batch.items.map((i) => i.id), ['B261125-001-1', 'B261125-001-2', 'B261125-001-3', 'B261125-001-4']);
    assert.deepEqual(batch.items.map((i) => i.status), ['waiting', 'waiting', 'waiting', 'waiting']);
    assert.deepEqual(batch.items[1].dependsOn, [1]);
    // 줄바꿈은 그대로 보존하고, 제목이 없으면 요청 첫 줄로 만든다
    assert.equal(batch.items[0].prompt, '금~목 회신 현황을 집계해 줘.\n표로 정리.');
    assert.equal(batch.items[2].title, '프로필 검수 목록을 정리해 줘.');
    assert.equal(batch.items[2].done, '검수 대상이 빠짐없이 들어 있다');
    assert.deepEqual(batch.items[0].events.map((e) => e.type), ['accepted']);
    assert.deepEqual(batchFiles(root), ['B261125-001.json']);
    assert.deepEqual(JSON.parse(readFileSync(join(root, '.office', 'batches', 'B261125-001.json'), 'utf8')), batch);

    // 다음 제출은 다음 번호·다음 순번(제목이 같아도 별도 묶음)
    const next = store.submit({ submitKey: KEY(2), items: four() }).batch;
    assert.equal(next.id, 'B261125-002');
    assert.equal(next.seq, 2);
    assert.deepEqual(store.list().map((b) => b.id), ['B261125-001', 'B261125-002']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('같은 제출 키 재전송(응답 유실·더블클릭)은 원래 번호를 돌려주고 새로 만들지 않는다', () => {
  const root = tempRoot();
  try {
    const store = createBatches({ root, now: () => NOW });
    const first = store.submit({ submitKey: KEY(1), items: four() });
    const again = store.submit({ submitKey: KEY(1), items: four() });
    const third = store.submit({ submitKey: KEY(1), items: four() });
    assert.equal(again.duplicate, true);
    assert.equal(third.duplicate, true);
    assert.equal(again.batch.id, first.batch.id);
    assert.deepEqual(again.batch.items.map((i) => i.id), first.batch.items.map((i) => i.id));
    assert.equal(batchFiles(root).length, 1);
    assert.equal(store.list().length, 1);
    // 같은 키인데 내용이 다르면 조용히 덮지 않고 거부한다
    assert.throws(() => store.submit({ submitKey: KEY(1), items: four().slice(0, 2) }), (e) => e.status === 409 && /B261125-001/.test(e.message));
    assert.equal(store.get(first.batch.id).items.length, 4);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('저장 실패면 접수된 것이 0건이고, 다시 보내면 정상 접수된다', () => {
  const root = tempRoot();
  try {
    let broken = true;
    const store = createBatches({ root, now: () => NOW, write: (file, value) => { if (broken) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); writePrivate(file, value); } });
    assert.throws(() => store.submit({ submitKey: KEY(1), items: four() }), (e) => e.status === 500 && /접수되지 않았으니/.test(e.message));
    assert.equal(store.list().length, 0);
    assert.equal(store.findByKey(KEY(1)), null);
    assert.deepEqual(batchFiles(root), []);
    broken = false;
    const retry = store.submit({ submitKey: KEY(1), items: four() });
    assert.equal(retry.duplicate, false);
    assert.equal(retry.batch.id, 'B261125-001');
    assert.equal(retry.batch.seq, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('서버 재시작(저장소를 다시 열기) 뒤에도 번호·순번·제출 키가 이어진다', () => {
  const root = tempRoot();
  try {
    const first = createBatches({ root, now: () => NOW }).submit({ submitKey: KEY(1), items: four() }).batch;
    // 깨진 파일이 있어도 나머지를 읽고, 그 번호는 다시 쓰지 않는다
    writeFileSync(join(root, '.office', 'batches', 'B261125-002.json'), '{ 깨진 파일');
    const reopened = createBatches({ root, now: () => NOW });
    assert.deepEqual(reopened.get(first.id), first);
    const again = reopened.submit({ submitKey: KEY(1), items: four() });
    assert.equal(again.duplicate, true);
    assert.equal(again.batch.id, first.id);
    const next = reopened.submit({ submitKey: KEY(3), items: [{ prompt: '한 건만' }] }).batch;
    assert.equal(next.id, 'B261125-003');
    assert.equal(next.seq, 2);
    assert.equal(next.title, '한 건만');
    // 날짜가 바뀌면 번호는 새 날짜로 시작하고 순번은 계속 늘어난다
    const tomorrow = createBatches({ root, now: () => NOW + 86400e3 }).submit({ submitKey: KEY(4), items: [{ prompt: '다음 날' }] }).batch;
    assert.equal(tomorrow.id, 'B261126-001');
    assert.equal(tomorrow.seq, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('검사: 제출 키·빈 항목·선행 업무(앞선 항목만)·첨부(올린 파일만)·개수', () => {
  const root = tempRoot();
  try {
    const store = createBatches({ root, now: () => NOW });
    const bad = (body, pattern, status = 400) => assert.throws(() => store.submit(body), (e) => e.status === status && pattern.test(e.message), JSON.stringify(body).slice(0, 80));
    bad({ items: four() }, /제출 키/);
    bad({ submitKey: 'short', items: four() }, /제출 키/);
    bad({ submitKey: KEY(1), items: [] }, /한 건 이상/);
    bad({ submitKey: KEY(1), items: [{ prompt: '  ' }] }, /1번 업무: 요청 내용이 비어/);
    bad({ submitKey: KEY(1), items: [{ prompt: 'x'.repeat(BATCH_LIMITS.prompt + 1) }] }, /자 이하/);
    bad({ submitKey: KEY(1), items: Array.from({ length: BATCH_LIMITS.items + 1 }, () => ({ prompt: 'a' })) }, /건까지/);
    // 자기 자신·뒤 항목·없는 번호는 선행 업무가 될 수 없다(순환 차단)
    bad({ submitKey: KEY(1), items: [{ prompt: 'a', dependsOn: [1] }] }, /앞선 항목만/);
    bad({ submitKey: KEY(1), items: [{ prompt: 'a', dependsOn: [2] }, { prompt: 'b' }] }, /앞선 항목만/);
    bad({ submitKey: KEY(1), items: [{ prompt: 'a' }, { prompt: 'b', dependsOn: [5] }] }, /번호가 올바르지/);
    bad({ submitKey: KEY(1), items: [{ prompt: 'a' }, { prompt: 'b', dependsOn: ['1'] }] }, /번호가 올바르지/);
    // 첨부: 업로드 폴더 밖·상위 경로·없는 파일은 거부
    bad({ submitKey: KEY(1), items: [{ prompt: 'a', attachments: ['org/company.md'] }] }, /올린 파일/);
    bad({ submitKey: KEY(1), items: [{ prompt: 'a', attachments: ['보관함/업로드/../바깥.txt'] }] }, /올린 파일/);
    bad({ submitKey: KEY(1), items: [{ prompt: 'a', attachments: ['보관함/업로드/2026-11-25/없음.xlsx'] }] }, /찾을 수 없습니다/);
    assert.equal(store.list().length, 0);
    assert.deepEqual(batchFiles(root), []);

    mkdirSync(join(root, '보관함', '업로드', '2026-11-25'), { recursive: true });
    writeFileSync(join(root, '보관함', '업로드', '2026-11-25', '명단.xlsx'), 'x');
    const body = { submitKey: KEY(2), title: '첨부 시험', items: [{ prompt: 'a', attachments: ['보관함/업로드/2026-11-25/명단.xlsx', '보관함\\업로드\\2026-11-25\\명단.xlsx'] }] };
    const { batch } = store.submit(body);
    assert.deepEqual(batch.items[0].attachments, ['보관함/업로드/2026-11-25/명단.xlsx']);
    // 재전송 때 첨부 파일이 그새 없어졌어도 원래 번호를 돌려준다
    rmSync(join(root, '보관함', '업로드', '2026-11-25', '명단.xlsx'));
    assert.equal(store.submit(body).batch.id, batch.id);
    // 요약에는 요청 원문·첨부 경로·제출 키가 없다
    const summary = JSON.stringify(batchSummary(batch));
    assert.ok(!summary.includes('명단.xlsx') && !summary.includes(KEY(2)) && !summary.includes('"prompt"'));
    assert.deepEqual(batchSummary(batch).counts, { waiting: 1 });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---- 접수 API ----
let root, handle, base, token, failWrites = false;
function request(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${base}${path}`, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* JSON 아님 */ }
        resolve({ status: res.statusCode, json, text });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}
const post = (path, body) => request('POST', path, { body, headers: { 'X-Office-Token': token, Origin: base, 'Content-Type': 'application/json' } });
const get = (path) => request('GET', path, { headers: { 'X-Office-Token': token } });

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'office-batches-api-'));
  mkdirSync(join(root, 'org'), { recursive: true });
  writeFileSync(join(root, 'org', 'departments.json'), '[]\n');
  writeFileSync(join(root, 'org', 'roster.json'), '[]\n');
  const publicDir = join(root, 'public');
  mkdirSync(publicDir);
  writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>t</title>');
  const { startServer } = await import('../dashboard/server.mjs');
  // 접수하면 순번 실행기가 첫 건을 시작하려 한다. 실제 Claude·Codex를 부르지 않도록 없는 실행 파일을 가리킨다
  // (시작은 실패로 기록되고, 이 파일은 접수·조회 계약만 본다. 순번 실행은 sequencer 테스트가 본다)
  const none = join(root, 'no-such-cli.mjs');
  handle = await startServer({ root, port: 0, publicDir, quiet: true, scheduleNow: () => NOW, env: { ...process.env, CLAUDE_BIN: none, CODEX_BIN: none },
    batchWrite: (file, value) => { if (failWrites) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); writePrivate(file, value); } });
  base = `http://127.0.0.1:${handle.port}`;
  token = handle.token;
});
after(async () => {
  if (handle) await handle.close();
  if (root) await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
});

test('API: 저장 실패는 성공 표시 0건, 접수는 201, 재전송·동시 더블클릭은 같은 번호', async () => {
  failWrites = true;
  const failed = await post('/api/batches', { submitKey: KEY(10), items: four() });
  assert.equal(failed.status, 500);
  assert.match(failed.json.error, /접수되지 않았으니/);
  assert.equal(failed.json.batch, undefined);
  assert.deepEqual((await get('/api/batches')).json, { batches: [] });
  assert.deepEqual((await get(`/api/batches?key=${KEY(10)}`)).json, { batches: [] });
  failWrites = false;

  // 더블클릭: 같은 제출 키 두 건이 동시에 와도 묶음은 하나
  const [a, b] = await Promise.all([post('/api/batches', { submitKey: KEY(10), items: four() }), post('/api/batches', { submitKey: KEY(10), items: four() })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 201]);
  assert.equal(a.json.batch.id, b.json.batch.id);
  assert.equal(a.json.batch.total, 4);
  assert.deepEqual(a.json.batch.counts, { waiting: 4 });
  // 응답 유실 뒤 재전송: 원래 번호
  const resent = await post('/api/batches', { submitKey: KEY(10), items: four() });
  assert.equal(resent.status, 200);
  assert.equal(resent.json.duplicate, true);
  assert.equal(resent.json.batch.id, a.json.batch.id);
  // 재접속: 제출 키로 접수 여부를 조회한다
  const byKey = await get(`/api/batches?key=${KEY(10)}`);
  assert.deepEqual(byKey.json.batches.map((x) => x.id), [a.json.batch.id]);
  const list = await get('/api/batches');
  assert.equal(list.json.batches.length, 1);
  assert.ok(!list.text.includes('회신 현황을 집계해'), '목록에는 요청 원문이 없다');

  const detail = await get(`/api/batches/${a.json.batch.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.items[0].prompt, '금~목 회신 현황을 집계해 줘.\n표로 정리.');
  assert.equal(detail.json.submitKey, undefined);
  assert.equal(detail.json.digest, undefined);
  assert.equal((await get('/api/batches/B999999-001')).status, 404);
  assert.equal((await get('/api/batches/..%2Fruns')).status, 404);
});

test('API: 토큰 없이는 접수·조회할 수 없고, 거부된 제출은 접수되지 않는다', async () => {
  assert.equal((await request('GET', '/api/batches')).status, 403);
  assert.equal((await request('POST', '/api/batches', { body: { submitKey: KEY(11), items: four() }, headers: { Origin: base, 'Content-Type': 'application/json' } })).status, 403);
  assert.equal((await post('/api/batches', { submitKey: KEY(12), items: [{ prompt: '' }] })).status, 400);
  // 거부된 요청은 아무것도 남기지 않는다(재전송·조회가 AI를 부르지 않는 것은 sequencer-api 테스트가 호출 수로 확인한다)
  assert.deepEqual((await get(`/api/batches?key=${KEY(11)}`)).json, { batches: [] });
  assert.deepEqual((await get(`/api/batches?key=${KEY(12)}`)).json, { batches: [] });
});

test('API: 발송 결과 대조함 — 조회는 기록만 읽고, 결정은 근거와 함께 한 번만 반영된다(동시 결정은 409와 최신 상태)', async () => {
  // 결과가 불확실한 발송 기록 하나(어느 실행에도 속하지 않는 옛 기록)
  const id = `${scopeKey('run-gone')}-${'a'.repeat(24)}`;
  writePrivate(join(root, '.office', 'publications', `${id}.json`), { status: 'uncertain', method: 'api', action: 'post', service: 'naver_cafe', connection: 'c1', contentHash: 'f'.repeat(64), target: 'https://cafe.naver.com/f-e/cafes/1/menus/2' });
  assert.equal((await request('GET', '/api/reconcile')).status, 403);
  const list = await get('/api/reconcile');
  assert.equal(list.json.items.length, 1);
  assert.deepEqual({ id: list.json.items[0].id, pending: list.json.items[0].pending, run: list.json.items[0].run, attempt: list.json.items[0].attempt }, { id, pending: true, run: null, attempt: 1 });
  assert.equal((await post(`/api/reconcile/${id}`, { decision: 'confirm' })).status, 400);
  assert.equal((await post('/api/reconcile/not-a-record', { decision: 'hold' })).status, 404);
  assert.equal((await post(`/api/reconcile/${id}`, { decision: 'hold' })).status, 200);
  // 두 요청이 동시에 온다: 하나만 반영되고 다른 하나는 409와 최신 상태를 받는다
  const [a, b] = await Promise.all([post(`/api/reconcile/${id}`, { decision: 'resend', basis: '게시판에 없음', attempt: 1 }), post(`/api/reconcile/${id}`, { decision: 'resend', basis: '게시판에 없음', attempt: 1 })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const ok = a.status === 200 ? a : b, refused = a.status === 200 ? b : a;
  assert.equal(ok.json.item.attempt, 2);
  assert.match(ok.json.note, /업무 실행을 찾지 못했습니다/);
  assert.equal(refused.json.current.attempt, 2);
  assert.equal((await get('/api/reconcile')).json.items[0].decision.decision, 'resend');
});
