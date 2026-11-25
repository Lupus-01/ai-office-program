// 발송 결과 대조함(2.0). 발송·게시 직후 끊겨 결과가 불확실한 건을 모아 보고, 대표의 결정을 기록한다.
// 여기서는 아무것도 보내지 않는다. 목록·상세 조회는 기록 파일만 읽는다.
// 결정은 "발송 확인"(이미 반영됨) / "확인 보류" / "새 발송 승인"(미발송 근거 확인 후 다시 보냄) 세 가지다.
// 결정은 곁 파일에 남기고, 실제 반영은 기존 발송 문(lib/browser-work.mjs의 deliver)이 그 업무를 다시 진행할 때 한 번만 가져다 쓴다:
//   발송 확인 → 같은 문안 버전이면 다시 보내지 않고 확인 처리 / 새 발송 승인 → 불확실 기록을 넘어 한 번 다시 보낸다.
// 실행 기록: .office/publications/<대화 해시 24자>-<대상 해시>.json, 결정 기록: .office/reconcile/<같은 이름>.json
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readPrivate, writePrivate } from './private-state.mjs';

export const PENDING_STATUS = Object.freeze(['committing', 'uncertain']);
export const DECISIONS = Object.freeze(['confirm', 'hold', 'resend']);
const ID = /^[0-9a-f]{24}-[0-9a-f]{8,64}$/;
const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });
// 실행 기록 파일 이름 앞부분은 대화(상위 업무 실행) id의 해시다. 어느 업무의 발송인지 이것으로 찾는다
export const scopeKey = (rootId) => createHash('sha256').update(String(rootId)).digest('hex').slice(0, 24);
const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

export function createReconcile({ root, now = Date.now, read = readPrivate, write = writePrivate }) {
  const dir = join(root, '.office', 'publications');
  const sideDir = join(root, '.office', 'reconcile');
  const recordFile = (id) => join(dir, `${id}.json`);
  const sideFile = (id) => join(sideDir, `${id}.json`);
  const side = (id) => { try { return read(sideFile(id), null) || { attempt: 1, decisions: [], pending: null }; } catch { return { attempt: 1, decisions: [], pending: null }; } };
  const iso = () => new Date(now()).toISOString();

  // 한 건의 대조 정보. 문안 원문·수신 주소는 넣지 않는다(문안 버전은 내용 해시 앞 12자로만 보여 준다)
  function entry(id) {
    if (!ID.test(id) || !existsSync(recordFile(id))) return null;
    let record;
    try { record = read(recordFile(id), null); } catch { return null; }
    if (!record || typeof record !== 'object') return null;
    const s = side(id);
    let attemptAt = record.updatedAt || null;
    if (!attemptAt) { try { attemptAt = statSync(recordFile(id)).mtime.toISOString(); } catch { attemptAt = null; } }
    return { id, scope: id.slice(0, 24), status: record.status, pending: PENDING_STATUS.includes(record.status),
      action: record.action || null, service: record.service || null, connection: record.connection || null, method: record.method || 'browser', target: record.target || null,
      version: clip(record.contentHash, 12) || null, attempt: s.attempt, attemptAt,
      // 관측된 증표: 결과 주소, 확인 시각, 결과 화면을 읽지 못한 이유, 직원 보고 요약
      evidence: { resultUrl: record.resultUrl || null, confirmedAt: record.confirmedAt || null, confirmedBy: record.confirmedBy || null,
        readbackError: clip(record.readbackError, 300) || null, failure: record.failure || null, summary: clip(record.summary, 300) || null },
      decision: s.pending, decisions: s.decisions };
  }

  // 대조가 필요한 건(결과 불확실)과, 결정은 했지만 아직 업무에 반영되지 않은 건. all: 결정 이력이 있는 지난 건도 함께
  function list({ all = false } = {}) {
    if (!existsSync(dir)) return [];
    const out = [];
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const item = entry(name.slice(0, -5));
      if (item && (item.pending || (all && item.decisions.length))) out.push(item);
    }
    return out.sort((a, b) => String(a.attemptAt).localeCompare(String(b.attemptAt)));
  }

  // 결정을 기록한다. 같은 건에 결정이 이미 있거나 그새 처리됐으면 409와 지금 상태를 돌려준다(두 기기가 동시에 승인해도 한 번만 반영).
  // by: 결정자 표시(로그인 구분이 생기기 전에는 'local'), basis: 근거(발송 확인은 확인한 증표, 새 발송 승인은 미발송 근거 — 필수)
  function decide(id, { decision, basis = '', by = 'local', attempt = null } = {}) {
    const current = entry(id);
    if (!current) throw fail(404, '대조할 발송 기록을 찾을 수 없습니다.');
    if (!DECISIONS.includes(decision)) throw fail(400, '결정은 발송 확인(confirm)·확인 보류(hold)·새 발송 승인(resend) 중 하나여야 합니다.');
    const reason = clip(String(basis || '').trim(), 500);
    if (decision !== 'hold' && !reason) throw fail(400, decision === 'resend' ? '새 발송 승인에는 미발송을 확인한 근거를 적어 주세요.' : '발송 확인에는 확인한 증표(보낸메일함·게시 주소 등)를 적어 주세요.');
    if (!current.pending) throw fail(409, '이미 처리된 건입니다. 최신 상태를 확인해 주세요.', { current });
    if (current.decision && decision !== 'hold') throw fail(409, `이미 ${current.decision.decision === 'resend' ? '새 발송을 승인' : '발송 확인으로 결정'}한 건입니다. 업무가 다시 진행되면 반영됩니다.`, { current });
    if (attempt !== null && attempt !== current.attempt) throw fail(409, '그새 다른 시도가 진행됐습니다. 최신 상태를 확인해 주세요.', { current });
    const s = side(id);
    const logged = { at: iso(), decision, basis: reason, by: clip(String(by), 60), attempt: s.attempt, version: current.version };
    const next = { ...s, decisions: [...s.decisions, logged].slice(-50) };
    // 새 발송 승인은 새 시도 번호를 준다. 보류는 기록만 하고 아무것도 예약하지 않는다
    if (decision === 'resend') { next.attempt = s.attempt + 1; next.pending = { ...logged, attempt: next.attempt }; }
    else if (decision === 'confirm') next.pending = logged;
    write(sideFile(id), next);
    return entry(id);
  }

  // 발송 문이 부른다: 이 실행 기록에 예약된 결정을 한 번 꺼내 발송 조건에 반영한다(꺼낸 뒤에는 지운다).
  // 발송 확인 → confirmExisting, 새 발송 승인 → allowResend + retryUncertain. 결정이 없으면 받은 값을 그대로 돌려준다
  function apply(file, flags) {
    const id = basename(String(file), '.json');
    if (!ID.test(id) || !existsSync(sideFile(id))) return flags;
    const s = side(id);
    if (!s.pending) return flags;
    const decision = s.pending;
    write(sideFile(id), { ...s, pending: null, decisions: [...s.decisions, { at: iso(), decision: 'applied', applied: decision.decision, attempt: decision.attempt }].slice(-50) });
    return decision.decision === 'confirm' ? { ...flags, confirmExisting: true } : { ...flags, allowResend: true, retryUncertain: true };
  }

  return { list, get: entry, decide, apply };
}
