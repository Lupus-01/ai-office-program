// 묶음 보고·처리 이력·대기시간(2.0). 저장된 건 상태·사건 기록·호출 원장으로만 조립한다(AI 호출 0회, 상태를 바꾸지 않는다).
import { join } from 'node:path';
import { ITEM_STATUS as S } from './batches.mjs';

export const STATUS_LABEL = Object.freeze({ waiting: '대기', running: '진행 중', needs: '확인 필요', done: '완료', failed: '실패', stopped: '중지', canceled: '취소' });
const STATUS_ORDER = ['done', 'needs', 'running', 'waiting', 'failed', 'stopped', 'canceled'];

// 사건 → 그 뒤의 구간 종류. work: 실제 작업, human: 사람 답변·재개 대기, wait: 차례·선행 업무 대기, end: 끝
const AFTER = { accepted: 'wait', started: 'work', resumed: 'work', needs: 'human', stopped: 'human', paused: 'human', failed: 'end', done: 'end', canceled: 'end',
  'resume-queued': 'wait', unpaused: 'wait', requeued: 'wait', 'resume-failed': 'human' };

const lastDoneAt = (item) => { const ev = [...(item.events || [])].reverse().find((e) => e.type === S.done); return ev ? Date.parse(ev.at) : Infinity; };

// 건의 시간을 겹치지 않는 네 가지로 나눈다: 실행 자리 대기 / 선행 결과 대기 / 사람 답변 대기 / 실제 작업.
// 대기 구간은 선행 업무가 모두 끝난 시각을 경계로 "선행 결과 대기"와 "실행 자리 대기"로 가른다(원인이 바뀌면 구간이 끝난다).
// segments: 화면·알림용 구간 목록 [{ kind: 'slot'|'dependency'|'human'|'work', from, to, open }]
export function itemTimes(item, batch, now = Date.now()) {
  const out = { slotWaitMs: 0, depWaitMs: 0, humanWaitMs: 0, workMs: 0, acceptedAt: item.events?.[0]?.at || null, firstStartedAt: null, endedAt: null, segments: [] };
  const depsDone = Math.max(0, ...(item.dependsOn || []).map((no) => { const dep = batch.items.find((i) => i.no === no); return dep ? lastDoneAt(dep) : 0; }));
  const add = (kind, from, to, open) => {
    if (!(to > from)) return;
    out.segments.push({ kind, from: new Date(from).toISOString(), to: new Date(to).toISOString(), ...(open ? { open: true } : {}) });
    out[{ slot: 'slotWaitMs', dependency: 'depWaitMs', human: 'humanWaitMs', work: 'workMs' }[kind]] += to - from;
  };
  let state = null, since = null;
  const close = (until, open = false) => {
    if (state === 'work') add('work', since, until, open);
    else if (state === 'human') add('human', since, until, open);
    else if (state === 'wait') {
      const edge = Math.min(Math.max(depsDone, since), until);
      add('dependency', since, edge, open && edge === until);
      add('slot', edge, until, open);
    }
  };
  for (const ev of item.events || []) {
    const next = AFTER[ev.type];
    if (!next) continue; // 알림 같은 부가 사건은 구간을 바꾸지 않는다
    const at = Date.parse(ev.at);
    if (state) close(at);
    if (next === 'work' && !out.firstStartedAt) out.firstStartedAt = ev.at;
    out.endedAt = next === 'end' ? ev.at : null;
    state = next; since = at;
  }
  if (state && state !== 'end') close(Math.max(now, since), true);
  return out;
}

// 다음 행동 한 줄. waitingOn은 순번 실행기가 준 대기 사유다
function nextAction(item, waitingOn) {
  if (item.status === S.done) return '결과 확인';
  if (item.status === S.running) return '진행 중 — 기다리면 됩니다';
  if (item.status === S.needs) return `이 업무에 답변: ${item.reason || '확인이 필요합니다.'}`;
  if (item.status === S.failed) return '실패 — 다시 지시하거나 취소';
  if (item.status === S.stopped) return item.paused ? '일시정지 — "이어서 해줘"로 재개' : '중지 — 이어서 하려면 이 업무에 답장';
  if (item.status === S.canceled) return '취소됨';
  if (waitingOn?.kind === 'dependency') return `선행 업무 "${waitingOn.title}" 대기${['canceled', 'failed', 'stopped'].includes(waitingOn.status) ? `(${STATUS_LABEL[waitingOn.status]}) — 선행 업무를 다시 진행하거나 이 업무를 취소` : ''}`;
  if (waitingOn?.kind === 'budget') return '묶음 예산을 모두 씀 — 예산을 늘리면 시작';
  return waitingOn?.title ? `차례 대기 — 앞선 업무 "${waitingOn.title}"` : '차례 대기';
}

// 묶음 보고 카드. 상태별 건수의 합은 언제나 접수 건수와 같다.
// resultOf(item) → { summary, folder, files }: 건의 결과 한 줄과 산출물 위치(서버가 실행·업무 기록에서 읽는다)
// settled: 더 진행할 건이 없다(모두 끝났거나 사람의 결정·선행 업무·예산을 기다린다)
export function batchReport(batch, { waitingOn = () => null, usageOf = () => null, resultOf = () => ({}), now = Date.now() } = {}) {
  const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
  const rows = batch.items.map((item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    const waiting = item.status === S.waiting ? waitingOn(item.id) : null;
    const result = resultOf(item) || {};
    const { segments, ...times } = itemTimes(item, batch, now);
    return { id: item.id, no: item.no, title: item.title, status: item.status, label: STATUS_LABEL[item.status] || item.status,
      // 결과 한 줄: 완료는 결과 요약, 그 밖에는 미처리 사유
      result: item.status === S.done ? (result.summary || '완료') : (item.reason || (waiting?.kind === 'dependency' ? `선행 업무 "${waiting.title}" 대기` : STATUS_LABEL[item.status])),
      outputs: item.status === S.done ? { folder: result.folder || null, files: result.files || [] } : null,
      next: nextAction(item, waiting), waitingOn: waiting, task: item.task || null, run: item.run || null, attempts: item.attempt || 0,
      times, usage: usageOf([item]), via: item.via === 'terminal' ? 'terminal' : item.source === 'schedule' ? 'schedule' : item.source === 'monitor' ? 'monitor' : 'screen' };
  });
  const total = batch.items.length;
  const settled = counts.running === 0 && rows.every((row) => row.status !== S.waiting || (row.waitingOn && row.waitingOn.kind !== 'slot'));
  const summary = STATUS_ORDER.filter((status) => counts[status]).map((status) => `${STATUS_LABEL[status]} ${counts[status]}`).join(' / ');
  return { id: batch.id, seq: batch.seq, title: batch.title, createdAt: batch.createdAt, total, counts, summary: `${batch.title} · ${summary || '없음'}`, settled,
    complete: counts.done + counts.canceled === total, rows, usage: usageOf(batch.items) };
}

// ---- 처리 이력 CSV ----
const EVENT_LABEL = { accepted: '접수', started: '시작', resumed: '재개', needs: '보류(확인 필요)', stopped: '중지', paused: '일시정지', failed: '실패', done: '완료', canceled: '취소',
  'resume-queued': '재개 예약', unpaused: '일시정지 해제', requeued: '대기로 복귀', 'resume-failed': '재개 실패', 'wait-alert': '대기 알림' };
// 사유는 프로그램이 정한 문구만 내보낸다. 실행 요약·질문 본문처럼 원문이 섞일 수 있는 글은 넣지 않는다
const SAFE_REASONS = ['대표 답변이 필요합니다.', '업무가 끝나지 않고 멈췄습니다. 결과를 확인해 주세요.', '서버가 꺼지면서 실행이 끊겼습니다. 이어서 재개할 수 있습니다.', '일시정지했습니다.', '중지했습니다.',
  '대표가 취소했습니다.', '실행 기록을 찾을 수 없습니다.', '시작 전에 서버가 꺼졌습니다.'];
const kst = (iso) => (iso ? new Date(Date.parse(iso) + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) : '');
const minutes = (ms) => (Math.round(ms / 6000) / 10).toFixed(1);
// 쉼표·따옴표·줄바꿈을 감싸고, 수식으로 읽힐 수 있는 칸은 작은따옴표를 붙인다(엑셀에서 열 때 실행되지 않게)
const cell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
export const HISTORY_COLUMNS = ['묶음 번호', '업무 번호', '접수 순서', '시도 번호', '사건 번호', '사건', '시각(한국)', '사유',
  '실행 자리 대기(분)', '선행 결과 대기(분)', '사람 답변 대기(분)', '실제 작업(분)', 'AI 호출 수', '미보고 호출 수', '입력 토큰(확인)', '출력 토큰(확인)'];

// 묶음의 처리 이력. 사건마다 한 줄, 건마다 '요약' 한 줄(시간·사용량). 요청 원문·제목·첨부 경로·수신 주소·인증값은 내보내지 않는다.
// 건수는 업무 번호로, 호출은 원장의 호출 번호로 한 번씩 센 값이다
export function historyCsv(batch, { usageOf = () => null, now = Date.now() } = {}) {
  const lines = [HISTORY_COLUMNS.map(cell).join(',')];
  for (const item of batch.items) {
    let attempt = 0;
    for (const ev of item.events || []) {
      if (Number.isInteger(ev.attempt)) attempt = ev.attempt;
      const reason = SAFE_REASONS.includes(ev.reason) ? ev.reason : ev.type === 'failed' ? '실행 실패' : ev.recovered ? '결과 확인 후 완료 처리' : '';
      lines.push([batch.id, item.id, item.no, attempt || '', ev.no, EVENT_LABEL[ev.type] || ev.type, kst(ev.at), reason, '', '', '', '', '', '', '', ''].map(cell).join(','));
    }
    const times = itemTimes(item, batch, now), usage = usageOf([item]);
    lines.push([batch.id, item.id, item.no, item.attempt || '', '', `요약(${STATUS_LABEL[item.status] || item.status})`, kst(new Date(now).toISOString()), '',
      minutes(times.slotWaitMs), minutes(times.depWaitMs), minutes(times.humanWaitMs), minutes(times.workMs),
      usage?.calls ?? '', usage?.unreported ?? '', usage?.input ?? '', usage?.output ?? ''].map(cell).join(','));
  }
  // UTF-8 BOM: 엑셀이 한글을 바로 읽는다
  return `﻿${lines.join('\r\n')}\r\n`;
}

// ---- 대기시간 누적 알림 ----
// 지금 열려 있는 "실행 자리 대기" 구간이 기준 시간을 넘긴 건. 같은 구간(시작 시각)은 한 번만 알린다(건의 wait-alert 사건으로 가린다).
// 선행 결과 대기·사람 답변 대기·실제 작업 시간은 넣지 않는다
export function waitAlerts(batchList, thresholdMs, now = Date.now()) {
  const due = [];
  if (!(thresholdMs > 0)) return due;
  for (const batch of batchList) {
    for (const item of batch.items) {
      if (item.status !== S.waiting) continue;
      const open = itemTimes(item, batch, now).segments.find((s) => s.open && s.kind === 'slot');
      if (!open || now - Date.parse(open.from) < thresholdMs) continue;
      if ((item.events || []).some((e) => e.type === 'wait-alert' && e.since === open.from)) continue;
      due.push({ batch: batch.id, item: item.id, title: item.title, since: open.from, waitedMs: now - Date.parse(open.from) });
    }
  }
  return due.sort((a, b) => b.waitedMs - a.waitedMs);
}

// ---- 보고 카드 저장 ----
// 묶음이 처음 정리된(settled) 때와 그 뒤 건수가 바뀔 때마다 같은 카드에 확정 이력을 더한다.
// 저장은 최초 1회 + 재시도 2회. 그래도 실패하면 "보고 반영 실패"로 표시만 한다(업무를 다시 실행하지 않는다)
export function createReportCards({ root, write, read, now = Date.now }) {
  const file = (id) => join(root, '.office', 'batches', `${id}.report.json`);
  const cards = new Map(), failed = new Set();
  const load = (id) => { if (!cards.has(id)) { let card = null; try { card = read(file(id), null); } catch { card = null; } cards.set(id, card); } return cards.get(id); };
  // 반환: { card, first(처음 정리됨), changed, failed }
  function update(report) {
    const previous = load(report.id);
    const signature = JSON.stringify(report.counts);
    if (!report.settled || previous?.signature === signature) return { card: previous, first: false, changed: false, failed: failed.has(report.id) };
    const at = new Date(now()).toISOString();
    const card = { id: report.id, settledAt: previous?.settledAt || at, updatedAt: at, signature, summary: report.summary, complete: report.complete,
      revisions: [...(previous?.revisions || []), { at, counts: report.counts }].slice(-100) };
    let saved = false;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) { try { write(file(report.id), card); saved = true; } catch { /* 다시 시도 */ } }
    if (!saved) { failed.add(report.id); return { card: previous, first: false, changed: false, failed: true }; }
    failed.delete(report.id);
    cards.set(report.id, card);
    return { card, first: !previous, changed: true, failed: false };
  }
  return { update, get: load, failed: (id) => failed.has(id) };
}
