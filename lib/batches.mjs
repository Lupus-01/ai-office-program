// 묶음 접수 저장소(2.0). 대표가 한 번에 맡긴 업무 여러 건을 접수 순서와 함께 보관한다.
// 여기서는 저장과 조회만 한다. 실행·상태 전이는 순번 실행기가 맡고, 접수에는 AI 호출이 없다.
// 한 묶음은 파일 하나(.office/batches/<묶음 번호>.json)라서 "전부 저장" 아니면 "0건"이다.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, normalize, sep } from 'node:path';
import { kstDate } from './paths.mjs';
import { writePrivate } from './private-state.mjs';
import { UPLOAD_DIR } from './uploads.mjs';

export const BATCH_VERSION = 1;
export const BATCH_LIMITS = Object.freeze({ items: 20, prompt: 20_000, totalPrompt: 100_000, title: 80, done: 2000, attachments: 10 });
// 제출 키: 작성창이 한 번 만들고 같은 제출을 다시 보낼 때 그대로 쓴다(응답 유실·더블클릭·재접속)
export const SUBMIT_KEY = /^[A-Za-z0-9_-]{16,128}$/;
export const BATCH_ID = /^B\d{6}-\d{3,}$/;
// 건 상태. waiting: 차례·선행 업무·재개 대기 / running: 업무 자리 사용 중 / needs: 답변·자료·승인·예산 확인 필요(자리 반납)
// done·failed·stopped·canceled: 자리 반납. 전이는 순번 실행기(dashboard/sequencer.mjs)만 한다
export const ITEM_STATUS = Object.freeze({ waiting: 'waiting', running: 'running', needs: 'needs', done: 'done', failed: 'failed', stopped: 'stopped', canceled: 'canceled' });

const fail = (status, message) => Object.assign(new Error(message), { status });
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
// 줄바꿈은 그대로 두고(요청 원문 보존) 줄바꿈 표기만 맞춘다
const text = (value) => (typeof value === 'string' ? value.replace(/\r\n?/g, '\n').normalize('NFC') : '');
const oneLine = (value, max) => [...text(value).replace(/\s+/g, ' ').trim()].slice(0, max).join('');

// 첨부는 지시창 업로드(POST /api/uploads)가 돌려준 경로만 받는다: 보관함/업로드/ 아래의 실제 파일
function attachmentPath(root, raw, where, checkFiles) {
  if (typeof raw !== 'string' || !raw.trim()) throw fail(400, `${where}: 첨부 경로가 비어 있습니다.`);
  const rel = normalize(raw.trim()).split(sep).join('/');
  const prefix = `${UPLOAD_DIR.join('/')}/`;
  if (isAbsolute(raw.trim()) || rel.split('/').includes('..') || !rel.startsWith(prefix)) throw fail(400, `${where}: 첨부는 올린 파일(${prefix})만 붙일 수 있습니다.`);
  const file = join(root, ...rel.split('/'));
  if (checkFiles && (!existsSync(file) || !statSync(file).isFile())) throw fail(400, `${where}: 첨부 파일을 찾을 수 없습니다. 다시 올려 주세요.`);
  return rel;
}

// 제출 본문 검사. 통과하면 저장할 모양으로 정리한 { title, items }를 돌려준다
// checkFiles: 첨부 파일이 실제로 있는지도 본다(재전송 대조에서는 보지 않는다)
export function normalizeSubmission(root, body, { checkFiles = true } = {}) {
  if (!isObject(body)) throw fail(400, '제출 형식이 올바르지 않습니다.');
  if (!Array.isArray(body.items) || !body.items.length) throw fail(400, '업무를 한 건 이상 넣어 주세요.');
  if (body.items.length > BATCH_LIMITS.items) throw fail(400, `한 번에 ${BATCH_LIMITS.items}건까지 접수할 수 있습니다.`);
  let total = 0;
  const items = body.items.map((raw, index) => {
    const no = index + 1, where = `${no}번 업무`;
    if (!isObject(raw)) throw fail(400, `${where}: 형식이 올바르지 않습니다.`);
    const prompt = text(raw.prompt).trim();
    if (!prompt) throw fail(400, `${where}: 요청 내용이 비어 있습니다.`);
    if (prompt.length > BATCH_LIMITS.prompt) throw fail(400, `${where}: 요청 내용은 ${BATCH_LIMITS.prompt}자 이하여야 합니다.`);
    total += prompt.length;
    const done = text(raw.done).trim();
    if (done.length > BATCH_LIMITS.done) throw fail(400, `${where}: 완료 기준은 ${BATCH_LIMITS.done}자 이하여야 합니다.`);
    const attachments = raw.attachments ?? [];
    if (!Array.isArray(attachments)) throw fail(400, `${where}: 첨부 형식이 올바르지 않습니다.`);
    if (attachments.length > BATCH_LIMITS.attachments) throw fail(400, `${where}: 첨부는 ${BATCH_LIMITS.attachments}개까지 붙일 수 있습니다.`);
    // 선행 업무는 같은 묶음의 앞선 항목만 고를 수 있다(번호가 자기보다 작다 → 순환이 생길 수 없다)
    const dependsOn = raw.dependsOn ?? [];
    if (!Array.isArray(dependsOn)) throw fail(400, `${where}: 선행 업무 형식이 올바르지 않습니다.`);
    for (const dep of dependsOn) {
      if (!Number.isInteger(dep) || dep < 1 || dep > body.items.length) throw fail(400, `${where}: 선행 업무 번호가 올바르지 않습니다.`);
      if (dep >= no) throw fail(400, `${where}: 선행 업무는 앞선 항목만 고를 수 있습니다.`);
    }
    return {
      no,
      title: oneLine(raw.title, BATCH_LIMITS.title) || oneLine(prompt.split('\n')[0], BATCH_LIMITS.title),
      prompt,
      attachments: [...new Set(attachments.map((a) => attachmentPath(root, a, where, checkFiles)))],
      done,
      dependsOn: [...new Set(dependsOn)].sort((a, b) => a - b),
    };
  });
  if (total > BATCH_LIMITS.totalPrompt) throw fail(400, `요청 내용을 모두 합쳐 ${BATCH_LIMITS.totalPrompt}자 이하여야 합니다. 묶음을 나눠 접수해 주세요.`);
  return { title: oneLine(body.title, BATCH_LIMITS.title) || (items.length === 1 ? items[0].title : `업무 ${items.length}건`), items };
}

// 실행 차례가 온 건의 지시문. 요청 원문은 그대로 두고 완료 기준·첨부·선행 업무 결과 위치만 덧붙인다.
// 같은 묶음의 다른 건 원문이나 대화는 넣지 않는다(건마다 문맥이 독립이다)
export function itemPrompt(item, batch) {
  const parts = [item.prompt];
  if (item.done) parts.push(`[완료 기준]\n${item.done}`);
  if (item.attachments?.length) parts.push(`[업로드한 파일]\n${item.attachments.map((p) => `- ${p}`).join('\n')}`);
  const deps = (item.dependsOn || []).map((no) => batch.items.find((i) => i.no === no)).filter((dep) => dep?.task);
  if (deps.length) {
    parts.push(`[선행 업무 결과]\n아래 업무의 확정 산출물을 입력으로 쓰세요. 같은 내용을 새로 조사하거나 대표에게 다시 묻지 않습니다.\n${deps.map((dep) => `- ${dep.title} (업무 id: ${dep.task}, 폴더: outputs/${dep.task}/)`).join('\n')}`);
  }
  return parts.join('\n\n');
}

const digestOf = (submission) => createHash('sha256').update(JSON.stringify(submission)).digest('hex');

// 목록·카드용 요약. 요청 원문·첨부 경로·완료 기준은 넣지 않는다
export function batchSummary(batch) {
  const counts = {};
  for (const item of batch.items) counts[item.status] = (counts[item.status] || 0) + 1;
  return { id: batch.id, seq: batch.seq, title: batch.title, createdAt: batch.createdAt, total: batch.items.length, counts,
    items: batch.items.map((item) => ({ id: item.id, no: item.no, title: item.title, status: item.status, dependsOn: item.dependsOn, attachments: item.attachments.length,
      ...(item.run ? { run: item.run } : {}), ...(item.task ? { task: item.task } : {}), ...(item.reason ? { reason: item.reason } : {}), ...(item.pendingReply ? { resumeQueued: true } : {}) })) };
}

// 저장소. 서버 하나가 유일한 기록자다(같은 작업 공간에 서버는 하나만 뜬다).
// write: 저장 함수(테스트에서 실패를 재현하려고 바꿔 넣는다)
// budget(): 화면에서 접수한 묶음에 줄 묶음 예산(AI 호출 수). null이면 묶음 예산을 두지 않는다
export function createBatches({ root, now = Date.now, write = writePrivate, budget = () => null }) {
  const dir = join(root, '.office', 'batches');
  const batches = new Map(); // 묶음 번호 → 묶음
  const byKey = new Map(); // 제출 키 → 묶음 번호
  const reserved = new Set(); // 읽지 못한 파일의 번호도 다시 쓰지 않는다
  let lastSeq = 0;

  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      const id = name.endsWith('.json') ? name.slice(0, -5) : '';
      if (!BATCH_ID.test(id)) continue;
      reserved.add(id);
      try {
        const batch = JSON.parse(readFileSync(join(dir, name), 'utf8'));
        if (batch?.id !== id || !Array.isArray(batch.items) || !Number.isInteger(batch.seq)) continue;
        batches.set(id, batch);
        if (batch.submitKey) byKey.set(batch.submitKey, id);
        lastSeq = Math.max(lastSeq, batch.seq);
      } catch { /* 깨진 파일은 건너뛴다(번호는 예약해 둔다) */ }
    }
  }

  function nextId(ms) {
    const day = kstDate(new Date(ms)).slice(2).replaceAll('-', '');
    for (let n = 1; ; n++) {
      const id = `B${day}-${String(n).padStart(3, '0')}`;
      if (!reserved.has(id)) return id;
    }
  }

  // 반환: { batch, duplicate }. 같은 제출 키로 다시 오면 저장된 묶음을 그대로 돌려준다(새로 만들지 않는다)
  // extra: 서버가 건에 붙이는 값(지시창에서 온 단건의 판별 결과·모델 설정). 화면 제출 본문으로는 넣을 수 없다
  function submit(body, extra = null) {
    const submitKey = isObject(body) ? body.submitKey : null;
    if (typeof submitKey !== 'string' || !SUBMIT_KEY.test(submitKey)) throw fail(400, '제출 키(submitKey)가 올바르지 않습니다. 화면을 새로고침한 뒤 다시 보내 주세요.');
    const known = byKey.get(submitKey);
    // 재전송은 첨부 파일이 그새 없어졌어도 원래 번호를 돌려줘야 하므로 파일 확인 없이 내용만 대조한다
    if (known) {
      const batch = batches.get(known);
      let same = false;
      try { same = digestOf(normalizeSubmission(root, body, { checkFiles: false })) === batch.digest; } catch { same = false; }
      if (!same) throw fail(409, `이미 접수된 제출입니다(${batch.id}). 내용을 바꿨으면 새 업무로 다시 작성해 주세요.`);
      return { batch, duplicate: true };
    }
    const submission = normalizeSubmission(root, body);
    const ms = now();
    const id = nextId(ms);
    const at = new Date(ms).toISOString();
    const batch = {
      version: BATCH_VERSION, id, seq: lastSeq + 1, submitKey, digest: digestOf(submission), title: submission.title, createdAt: at,
      // 묶음 예산: 대표가 작성창에서 여러 건을 한 번에 맡긴 묶음에만 둔다. 지시창 단건·예약·감시 후속 업무는 업무 예산만 따른다
      ...(!extra && Number.isInteger(budget()) ? { budget: { limitCalls: budget(), warned: false, log: [] } } : {}),
      items: submission.items.map((item) => ({ id: `${id}-${item.no}`, ...item, ...(extra || {}), status: ITEM_STATUS.waiting, events: [{ no: 1, type: 'accepted', at }] })),
    };
    // 저장이 끝난 뒤에만 번호를 내준다. 실패하면 메모리에도 남기지 않는다
    try { write(join(dir, `${id}.json`), batch); }
    catch (error) { throw fail(500, `접수 내용을 저장하지 못했습니다. 접수되지 않았으니 다시 보내 주세요. (${error.code || error.message})`); }
    reserved.add(id);
    batches.set(id, batch);
    byKey.set(submitKey, id);
    lastSeq = batch.seq;
    return { batch, duplicate: false };
  }

  // 건 하나를 고친다(순번 실행기 전용). fn(item)이 값을 바꾸고, event가 있으면 사건 기록에 번호를 붙여 더한다.
  // 복사본을 고쳐 저장한 뒤에만 메모리를 바꾼다(저장 실패가 상태를 반쯤 바꾸지 않게)
  function patch(itemId, fn, event = null) {
    const batchId = String(itemId).replace(/-\d+$/, '');
    const current = batches.get(batchId);
    if (!current) return null;
    const next = structuredClone(current);
    const item = next.items.find((i) => i.id === itemId);
    if (!item) return null;
    fn(item);
    if (event) item.events.push({ no: item.events.length + 1, at: new Date(now()).toISOString(), ...event });
    write(join(dir, `${batchId}.json`), next);
    batches.set(batchId, next);
    return item;
  }

  // 묶음 자체의 값(예산 등)을 고친다. patch와 같이 저장한 뒤에만 메모리를 바꾼다
  function patchBatch(batchId, fn) {
    const current = batches.get(batchId);
    if (!current) return null;
    const next = structuredClone(current);
    fn(next);
    write(join(dir, `.json`), next);
    batches.set(batchId, next);
    return next;
  }

  const get = (id) => batches.get(id) || null;
  // 모든 건을 접수 순서(제출 순번 → 항목 번호)대로
  const items = () => list().flatMap((batch) => batch.items.map((item) => ({ batch, item })));
  const findByKey = (key) => batches.get(byKey.get(key)) || null;
  // 접수 순서대로
  const list = () => [...batches.values()].sort((a, b) => a.seq - b.seq);
  return { submit, get, findByKey, list, items, patch, patchBatch };
}
