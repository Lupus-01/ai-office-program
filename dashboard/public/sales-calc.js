// 매출 비교 계산(화면과 테스트가 함께 쓴다). 입력은 도구가 올린 일·월 기록 그대로다. AI를 쓰지 않는다.
//   기록 한 줄: {d, calls, ok, fail, short, rate, tAll, tCoin, t060, tChat, sold[5], coinCall[1~3], s060[1~3], coinChat[1~3], charge, product, total, usd}
//   매출합계 = 코인충전매출 + 060매출 + 판매상품매출 (아테나 표의 계산식)

// 비교 항목. mix: 매출합계를 이루는 항목(증감의 합이 매출합계 증감과 같다)
export const METRICS = [
  { key: 'total', label: '매출합계', group: '매출', unit: '원', get: (r) => r.total },
  { key: 'charge', label: '코인충전매출', group: '매출', unit: '원', mix: true, get: (r) => r.charge },
  { key: 's060', label: '060매출', group: '매출', unit: '원', mix: true, get: (r) => r.s060?.[0] ?? 0 },
  { key: 'product', label: '판매상품매출', group: '매출', unit: '원', mix: true, get: (r) => r.product },
  { key: 'usd', label: '달러 결제', group: '매출', unit: '달러', get: (r) => r.usd },
  { key: 'coinCall', label: '코인통화 사용', group: '코인 사용', unit: '원', get: (r) => r.coinCall?.[0] ?? 0 },
  { key: 'coinChat', label: '코인채팅 사용', group: '코인 사용', unit: '원', get: (r) => r.coinChat?.[0] ?? 0 },
  { key: 'calls', label: '전체통화', group: '통화', unit: '건', get: (r) => r.calls },
  { key: 'ok', label: '성공통화', group: '통화', unit: '건', get: (r) => r.ok },
  { key: 'fail', label: '실패통화', group: '통화', unit: '건', get: (r) => r.fail },
  { key: 'short', label: '30초 미만', group: '통화', unit: '건', get: (r) => r.short },
  { key: 'rate', label: '통화성공률', group: '통화', unit: '%', mean: true, get: (r) => r.rate },
  { key: 'tCoin', label: '코인통화시간', group: '이용 시간', unit: '시간', get: (r) => r.tCoin },
  { key: 't060', label: '060통화시간', group: '이용 시간', unit: '시간', get: (r) => r.t060 },
  { key: 'tChat', label: '코인채팅시간', group: '이용 시간', unit: '시간', get: (r) => r.tChat },
  { key: 'sold', label: '판매건수(전체)', group: '판매', unit: '건', get: (r) => r.sold?.[0] ?? 0 },
  { key: 'sold1', label: '상품', group: '판매', unit: '건', sub: true, get: (r) => r.sold?.[1] ?? 0 },
  { key: 'sold2', label: '클래스', group: '판매', unit: '건', sub: true, get: (r) => r.sold?.[2] ?? 0 },
  { key: 'sold3', label: '대면상품', group: '판매', unit: '건', sub: true, get: (r) => r.sold?.[3] ?? 0 },
  { key: 'sold4', label: '홍대점', group: '판매', unit: '건', sub: true, get: (r) => r.sold?.[4] ?? 0 },
];

// 여러 날을 한 값으로: sum(합계) 또는 avg(하루 평균). 성공률은 통화 건수로 가중 평균한다(아테나의 계산식이 화면에 없어 근삿값)
export function fold(rows, how = 'sum') {
  const out = {};
  for (const m of METRICS) {
    if (!rows.length) { out[m.key] = null; continue; }
    if (m.mean) { const w = rows.reduce((s, r) => s + (r.calls || 0), 0); out[m.key] = w ? rows.reduce((s, r) => s + m.get(r) * (r.calls || 0), 0) / w : 0; continue; }
    const sum = rows.reduce((s, r) => s + (Number(m.get(r)) || 0), 0);
    out[m.key] = how === 'avg' ? sum / rows.length : sum;
  }
  return out;
}

// 두 값 묶음을 항목별로 비교한다. share: 매출합계 증감 중 이 항목이 차지하는 몫(같은 방향이면 양수)
export function compare(cur, base) {
  const totalDiff = cur.total != null && base.total != null ? cur.total - base.total : null;
  return METRICS.map((m) => {
    const a = cur[m.key], b = base[m.key];
    const has = a != null && b != null;
    const diff = has ? a - b : null;
    return { key: m.key, label: m.label, group: m.group, unit: m.unit, sub: !!m.sub, mix: !!m.mix, cur: a, base: b, diff,
      pct: has && m.unit !== '%' && b ? diff / b * 100 : null,
      share: m.mix && has && totalDiff ? diff / totalDiff * 100 : null };
  });
}

const won = (v) => `${Math.round(Math.abs(v)).toLocaleString('ko-KR')}원`;
// "어디서 빠졌고 어디서 올랐는지"를 한두 문장으로. 숫자는 비교 결과에서만 가져온다
export function explain(rows, baseName) {
  const total = rows.find((r) => r.key === 'total');
  if (!total || total.diff == null) return '비교할 기록이 없습니다.';
  if (total.diff === 0) return `매출합계가 ${baseName}와 같습니다.`;
  const down = total.diff < 0, word = down ? '줄었습니다' : '늘었습니다';
  const pct = total.pct == null ? '' : ` (${total.pct > 0 ? '+' : '−'}${Math.abs(total.pct).toFixed(1)}%)`;
  const mix = rows.filter((r) => r.mix && r.diff);
  const same = mix.filter((r) => r.diff < 0 === down).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const against = mix.filter((r) => r.diff < 0 !== down).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const parts = [`매출합계가 ${baseName}보다 ${won(total.diff)}${pct} ${word}.`];
  if (same.length) parts.push(`${down ? '빠진' : '오른'} 곳은 ${same.map((r) => `${r.label}(${down ? '−' : '+'}${won(r.diff)})`).join(', ')}입니다.`);
  if (against.length) parts.push(`반대로 ${against.map((r) => `${r.label}은 ${down ? '+' : '−'}${won(r.diff)}`).join(', ')}${down ? ' 올랐습니다' : ' 빠졌습니다'}.`);
  const calls = rows.find((r) => r.key === 'calls'), coin = rows.find((r) => r.key === 'coinCall');
  const side = [calls, coin].filter((r) => r && r.pct != null && Math.abs(r.pct) >= 0.05).map((r) => `${r.label} ${r.pct > 0 ? '+' : '−'}${Math.abs(r.pct).toFixed(1)}%`);
  if (side.length) parts.push(`같은 기간 ${side.join(', ')}.`);
  return parts.join(' ');
}

const shift = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
export const DAY_BASES = [
  { id: 'prev', label: '전날' },
  { id: 'week', label: '지난주 같은 요일' },
  { id: 'avg7', label: '직전 7일 평균' },
  { id: 'dow4', label: '직전 4주 같은 요일 평균' },
];
// 하루 비교: 선택한 날과 기준(전날·지난주 같은 요일·평균)의 값 묶음
export function dayPair(days, date, baseId) {
  const by = new Map(days.map((r) => [r.d, r]));
  const pick = (list) => list.map((d) => by.get(d)).filter(Boolean);
  const cur = pick([date]);
  const want = baseId === 'week' ? [shift(date, -7)] : baseId === 'avg7' ? [1, 2, 3, 4, 5, 6, 7].map((n) => shift(date, -n)) : baseId === 'dow4' ? [7, 14, 21, 28].map((n) => shift(date, -n)) : [shift(date, -1)];
  const base = pick(want);
  return { cur: fold(cur), base: fold(base, 'avg'), baseDays: base.map((r) => r.d), missing: want.length - base.length };
}

const monthShift = (month, n) => { const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
// 한 달 비교(기준은 전월). 진행 중인 달(today가 속한 달)은 어제까지의 누계를 전월의 같은 날짜까지와 비교한다
export function monthPair(months, days, month, today) {
  const baseMonth = monthShift(month, -1);
  const by = new Map(months.map((r) => [r.d, r]));
  if (today && today.slice(0, 7) === month) {
    const upto = Number(shift(today, -1).slice(8, 10));
    if (shift(today, -1).slice(0, 7) !== month) return { cur: fold([]), base: fold([]), baseMonth, partial: true, upto: 0, note: '이번 달은 아직 끝난 날이 없습니다.' };
    const range = (m) => days.filter((r) => r.d.slice(0, 7) === m && Number(r.d.slice(8, 10)) <= upto);
    const cur = range(month), base = range(baseMonth);
    // 기준 달에 그 날짜가 없으면(예: 30일 대 28일) 있는 날까지만 비교한다
    const lastOfBase = new Date(Date.UTC(Number(baseMonth.slice(0, 4)), Number(baseMonth.slice(5, 7)), 0)).getUTCDate();
    const need = Math.min(upto, lastOfBase);
    if (base.length < need) return { cur: fold(cur), base: fold([]), baseMonth, partial: true, upto, curDays: cur.length, baseDays: base.length, note: `${baseMonth}의 일간 기록이 부족해 같은 기간 비교를 할 수 없습니다.` };
    return { cur: fold(cur), base: fold(base), baseMonth, partial: true, upto, curDays: cur.length, baseDays: base.length };
  }
  const cur = by.get(month), base = by.get(baseMonth);
  const lastDay = (m) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
  return { cur: fold(cur ? [cur] : []), base: fold(base ? [base] : []), baseMonth, partial: false, curDays: lastDay(month), baseDays: lastDay(baseMonth) };
}
