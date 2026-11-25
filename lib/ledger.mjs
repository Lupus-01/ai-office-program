// 호출 원장(2.0). 공급자(Claude·Codex·Aside) 호출 하나를 번호 하나로 한 번만 적는다.
// 직원·비서실장 실행뿐 아니라 업무 예산 밖에서 도는 판별 호출도 적는다. 상위 업무 실행(코드가 지휘만 한다)은 호출이 아니라서 적지 않는다
// — 부모 합계와 자식 호출을 함께 더하는 중복이 생기지 않는다.
// 보고되지 않은 사용량은 0으로 치지 않고 "미보고"로 남긴다(usage: null).
// 파일: .office/ledger/<YYYY-MM>.jsonl (한국 시각 기준 월별, 한 줄에 호출 하나 또는 귀속 정정 하나)
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { kstDate } from './paths.mjs';

const TOKENS = ['input', 'output', 'cachedInput', 'cacheCreation'];
const reported = (usage) => Boolean(usage) && (Number.isFinite(usage.input) || Number.isFinite(usage.output));

// 호출 묶음의 사용량 요약. 확인된 토큰은 보고한 호출만 더하고, 미보고 호출 수와 측정 가능 비율을 따로 준다
export function summarizeCalls(calls) {
  // totalInput: 모델이 실제로 읽은 입력 전체. Claude는 input에 캐시분을 넣지 않고 따로 보고하므로(캐시 읽기·캐시 만들기) 더하고,
  // Codex는 input에 캐시분이 이미 들어 있으므로 그대로 쓴다. input만 보면 Claude 업무는 몇 토큰으로 보인다
  const out = { calls: calls.length, reported: 0, unreported: 0, input: 0, output: 0, cachedInput: 0, cacheCreation: 0, totalInput: 0, costUsd: 0, measurable: null, byKind: {} };
  for (const call of calls) {
    out.byKind[call.kind] = (out.byKind[call.kind] || 0) + 1;
    if (!reported(call.usage)) { out.unreported++; continue; }
    out.reported++;
    for (const key of TOKENS) out[key] += Number.isFinite(call.usage[key]) ? call.usage[key] : 0;
    const part = (key) => (Number.isFinite(call.usage[key]) ? call.usage[key] : 0);
    out.totalInput += call.engine === 'codex' ? part('input') : part('input') + part('cachedInput') + part('cacheCreation');
    out.costUsd += Number.isFinite(call.usage.costUsd) ? call.usage.costUsd : 0;
  }
  out.measurable = out.calls ? out.reported / out.calls : null;
  return out;
}

export function createLedger({ root, now = Date.now, append = appendFileSync }) {
  const dir = join(root, '.office', 'ledger');
  const calls = []; // 메모리 사본(요약·예산 계산용)
  const byId = new Map();
  let seq = 0;

  const apply = (line) => {
    if (line.type === 'attach') { for (const id of line.calls || []) { const call = byId.get(id); if (call) call.item = line.item; } return; }
    if (typeof line.id !== 'string' || byId.has(line.id)) return; // 같은 호출 번호는 한 번만 센다
    calls.push(line); byId.set(line.id, line);
    const n = Number(line.id.split('-').at(-1));
    if (Number.isInteger(n)) seq = Math.max(seq, n);
  };
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort()) {
      for (const text of readFileSync(join(dir, name), 'utf8').split('\n')) {
        if (!text.trim()) continue;
        try { apply(JSON.parse(text)); } catch { /* 깨진 줄은 건너뛴다 */ }
      }
    }
  }
  const write = (line) => {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    append(join(dir, `${kstDate(new Date(now())).slice(0, 7)}.jsonl`), JSON.stringify(line) + '\n', { mode: 0o600 });
  };

  // 호출 하나를 적는다. kind: stage·plan·review·progress·meeting·reviewer·publish·watch(실행), judge(판별)
  // root: 대화(상위 업무 실행) id, item: 접수 건 번호(알 때), usage: 공급자가 보고한 값 또는 null
  function record({ kind, root = null, item = null, task = null, agent = null, engine = null, status = 'done', startedAt = null, usage = null }) {
    const at = new Date(now()).toISOString();
    const line = { id: `c-${kstDate(new Date(now())).replaceAll('-', '')}-${++seq}`, kind, root, item, task, agent, engine, status, startedAt: startedAt || at, endedAt: at, usage: reported(usage) ? usage : null };
    // 원장에 못 적어도 업무는 멈추지 않는다. 메모리에는 남겨 이번 실행의 예산 계산은 유지한다
    try { write(line); } catch { line.unsaved = true; }
    apply(line);
    return line.id;
  }

  // 접수 전에 한 판별 호출을 나중에 생긴 건에 귀속시킨다
  function attach(callIds, item) {
    const ids = (callIds || []).filter((id) => byId.has(id));
    if (!ids.length) return;
    const line = { type: 'attach', calls: ids, item, at: new Date(now()).toISOString() };
    try { write(line); } catch { /* 메모리에는 반영한다 */ }
    apply(line);
  }

  // 대화(root)들과 건 번호들에 속한 호출
  const callsFor = ({ roots = [], items = [] } = {}) => {
    const r = new Set(roots.filter(Boolean)), i = new Set(items.filter(Boolean));
    return calls.filter((call) => (call.root && r.has(call.root)) || (call.item && i.has(call.item)));
  };
  return { record, attach, callsFor, summarize: (query) => summarizeCalls(callsFor(query)), all: () => [...calls] };
}
