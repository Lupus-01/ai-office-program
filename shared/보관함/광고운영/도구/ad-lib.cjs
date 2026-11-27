// 광고 선정 계산(홍카페 광고 자동 소팅 v2.1 Apps Script의 규칙·비교 순서를 그대로 옮긴 것).
// 시트·파일 입출력은 여기 두지 않는다. 정리된 자료(상담사·규칙·희망·이력·이월·예외)를 받아 초안 행을 돌려준다.
// 날짜는 모두 'YYYY-MM-DD'(한국 달력 날짜)로 주고받는다. 시간대 계산을 하지 않으려고 안에서는 UTC 자정으로만 다룬다.
'use strict';
const crypto = require('crypto');

const VERSION = '2.1.0';
const GROUPS = ['그린', '퍼플'];
const CHANNELS = ['전화', '채팅'];
const BANNERS = ['메인', '타로', '사주', '신점'];
const DAY = 86400000;

const clean = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
const pickWord = (words) => (value) => { const text = clean(value); return words.find((w) => text.includes(w)) || text; };
const normGroup = pickWord(GROUPS);
const normChannel = pickWord(CHANNELS);
const normBanner = pickWord(BANNERS);
const asNumber = (value, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const n = Number(String(value == null ? '' : value).replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};
const asBoolean = (value) => value === true || ['true', 'y', 'yes', '1', '사용', 'on'].includes(clean(value).toLowerCase());
// 활동단계: 글자 속 첫 0~6. 못 읽으면 -1
const parseStage = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const m = String(value == null ? '' : value).match(/([0-6])/);
  return m ? Number(m[1]) : -1;
};

// 날짜 → UTC 자정(ms). 못 읽으면 null
function toDay(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.floor(value / DAY) * DAY : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  const m = String(value).match(/^\s*(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}
const formatDay = (ms) => (ms == null ? '' : new Date(ms).toISOString().slice(0, 10));
function mondayOf(value) {
  const ms = toDay(value);
  if (ms == null) return null;
  const day = new Date(ms).getUTCDay();
  return ms + (day === 0 ? -6 : 1 - day) * DAY;
}
const addDays = (value, days) => { const ms = toDay(value); return ms == null ? null : ms + Number(days || 0) * DAY; };
function weeksBetween(older, newer) {
  const a = mondayOf(older), b = mondayOf(newer);
  if (a == null || b == null) return Number.POSITIVE_INFINITY;
  return Math.floor((b - a) / (7 * DAY));
}
// 오늘(한국 날짜) 기준 다음 월요일
const nextMonday = (today) => formatDay(mondayOf(today) + 7 * DAY);

const bannerKey = (group, channel, banner) => [normGroup(group), normChannel(channel), normBanner(banner)].join('|');
const candidateKey = (nickname, group, channel, banner) => [clean(nickname), normGroup(group), normChannel(channel), normBanner(banner)].join('|');
const trackingId = (nickname, group, channel, banner) =>
  `ADV-${crypto.createHash('md5').update(candidateKey(nickname, group, channel, banner), 'utf8').digest('hex').slice(0, 12).toUpperCase()}`;

// 16종 기본 규칙(v2.1 기본값에서 정원만 모든 배너 15명으로: 2026-11-27 대표 결정). 실제 운영값은 규칙 파일에서 바꿀 수 있다
function defaultRules() {
  const rows = [];
  const add = (group, channel, banner, capacity, minWeeks, priorityWeeks, partner, mainStage, mainSeconds, note) =>
    rows.push({ enabled: true, order: rows.length + 1, group, channel, banner, capacity, minWeeks, priorityWeeks, partner, mainStage, mainSeconds, note });
  add('그린', '전화', '메인', 15, 4, 0, '전체', 3, 108000, '3단계 이상 우선, 이후 30시간 충족자');
  add('그린', '전화', '타로', 15, 4, 0, '파트너', 0, 0, '');
  add('그린', '전화', '사주', 15, 0, 0, '전체', 0, 0, '전화·채팅 사주 동시 가능');
  add('그린', '전화', '신점', 15, 4, 0, '파트너', 0, 0, '');
  add('그린', '채팅', '메인', 15, 2, 0, '전체', 0, 0, '일반·파트너 모두 가능');
  add('그린', '채팅', '타로', 15, 2, 0, '파트너', 0, 0, '');
  add('그린', '채팅', '사주', 15, 0, 0, '전체', 0, 0, '전화·채팅 사주 동시 가능');
  add('그린', '채팅', '신점', 15, 0, 0, '전체', 0, 0, '');
  add('퍼플', '전화', '메인', 15, 6, 8, '전체', 3, 180000, '8주 이상 우선, 6주부터 후보; 3단계 이상 우선');
  add('퍼플', '전화', '타로', 15, 6, 0, '파트너', 0, 0, '');
  add('퍼플', '전화', '사주', 15, 0, 0, '파트너', 0, 0, '전화·채팅 사주 동시 가능');
  add('퍼플', '전화', '신점', 15, 5, 6, '파트너', 0, 0, '6주 이상 우선, 5주부터 후보');
  add('퍼플', '채팅', '메인', 15, 2, 0, '파트너', 0, 0, '');
  add('퍼플', '채팅', '타로', 15, 2, 0, '파트너', 0, 0, '');
  add('퍼플', '채팅', '사주', 15, 0, 0, '전체', 0, 0, '전화·채팅 사주 동시 가능');
  add('퍼플', '채팅', '신점', 15, 0, 0, '파트너', 0, 0, '');
  return rows;
}

// 바꿀 수 있는 선정 기준. 규칙 파일(JSON)에 같은 키로 적으면 그 값이 기본값을 덮는다(적지 않은 키는 기본값)
//   rules            배너별 정원·주기·대상(위 16종)
//   sortOrder        후보 정렬 순서. 앞에 있을수록 먼저 본다. 마지막은 언제나 닉네임 가나다순
//                    fixed 수동고정 / carry 이월(오래된 순) / wish 희망(등록 빠른 순) / longWait 장기 대기 구간 / mainStage 메인 단계 구간·단계 / elapsed 최근 광고가 오래된 순
//   oncePerBatch     한 번의 생성(4주)에서 같은 닉네임·배너를 한 번만 배정할지(v2.1 방식). 기본은 false: 최소 주기가 지나면 같은 생성 안에서도 다시 배정한다(2026-11-27 대표 결정)
//   sameWeekTogether 같은 주에 한 사람이 함께 받을 수 있는 배너(같은 배너의 전화·채팅끼리만 겹칠 수 있다)
//   carryoverScope   마지막 주까지 못 들어간 후보 중 이월예정으로 남길 대상(carry, wish, fixed, all)
//   partnerStages    파트너로 보는 활동단계 범위 [최소, 최대]
//   serviceTokens    채널별로 제공서비스에 있어야 하는 글자
//   excludeCategoryWords / excludeRowWords  카테고리·정산 행에 이 글자가 있으면 후보에서 뺀다
//   dropIneligiblePreassigned  시트에 미리 적힌 이름이 자격·주기에 맞지 않으면 빼고 알린다(false면 그대로 두고 알리기만). 운영자가 '지정'으로 넣은 자리는 빼지 않는다
//   requireActive    아테나 아이템 상태가 '승인완료'인 상담사만 후보로 둔다(이용중지는 뺀다)
const SORT_KEYS = ['fixed', 'carry', 'wish', 'longWait', 'mainStage', 'elapsed'];
function defaultPolicy() {
  return {
    rules: defaultRules(),
    sortOrder: [...SORT_KEYS],
    oncePerBatch: false,
    sameWeekTogether: ['사주'],
    carryoverScope: ['carry', 'wish', 'fixed'],
    partnerStages: [1, 6],
    serviceTokens: { 전화: '전화상담(1)', 채팅: '채팅상담(1)' },
    excludeCategoryWords: ['심리'],
    excludeRowWords: ['타사이동'],
    dropIneligiblePreassigned: true,
    requireActive: true,
  };
}
// 규칙 파일 내용 검사 + 기본값과 합치기. 잘못된 값은 조용히 넘기지 않고 알린다
function resolvePolicy(custom) {
  const base = defaultPolicy();
  if (custom == null) return base;
  if (typeof custom !== 'object' || Array.isArray(custom)) throw new Error('규칙 파일은 { … } 꼴이어야 합니다.');
  const unknown = Object.keys(custom).filter((k) => !(k in base) && !['version', 'note', '설명'].includes(k));
  if (unknown.length) throw new Error(`규칙 파일에 모르는 항목이 있습니다: ${unknown.join(', ')}`);
  const policy = { ...base, ...Object.fromEntries(Object.entries(custom).filter(([k]) => k in base)) };
  policy.serviceTokens = { ...base.serviceTokens, ...(custom.serviceTokens && typeof custom.serviceTokens === 'object' ? custom.serviceTokens : {}) };
  if (Array.isArray(policy.rules)) policy.rules = policy.rules.map((r, i) => ({ ...r, enabled: r.enabled === undefined ? true : r.enabled, order: r.order === undefined ? i + 1 : r.order }));
  if (!Array.isArray(policy.rules) || !policy.rules.length) throw new Error('규칙 파일의 rules가 비어 있습니다.');
  const seen = new Set();
  for (const r of policy.rules) {
    const key = bannerKey(r.group, r.channel, r.banner);
    if (!GROUPS.includes(normGroup(r.group)) || !CHANNELS.includes(normChannel(r.channel)) || !BANNERS.includes(normBanner(r.banner))) throw new Error(`규칙의 그룹·채널·배너를 읽을 수 없습니다: ${key}`);
    if (seen.has(key)) throw new Error(`같은 배너 규칙이 두 번 있습니다: ${key}`);
    seen.add(key);
    for (const field of ['capacity', 'minWeeks']) if (r[field] === undefined || r[field] === '' || !(asNumber(r[field], -1) >= 0)) throw new Error(`규칙 ${key}의 ${field} 값이 올바르지 않습니다.`);
    if (!['전체', '파트너'].includes(clean(r.partner))) throw new Error(`규칙 ${key}의 partner는 "전체" 또는 "파트너"여야 합니다.`);
  }
  if (!Array.isArray(policy.sortOrder) || policy.sortOrder.some((k) => !SORT_KEYS.includes(k)) || new Set(policy.sortOrder).size !== policy.sortOrder.length) throw new Error(`sortOrder에는 ${SORT_KEYS.join(', ')}만 한 번씩 쓸 수 있습니다.`);
  if (!Array.isArray(policy.carryoverScope) || policy.carryoverScope.some((k) => !['carry', 'wish', 'fixed', 'all'].includes(k))) throw new Error('carryoverScope에는 carry, wish, fixed, all만 쓸 수 있습니다.');
  if (!Array.isArray(policy.sameWeekTogether) || policy.sameWeekTogether.some((b) => !BANNERS.includes(b))) throw new Error('sameWeekTogether에는 메인, 타로, 사주, 신점만 쓸 수 있습니다.');
  if (!Array.isArray(policy.partnerStages) || policy.partnerStages.length !== 2) throw new Error('partnerStages는 [최소, 최대]여야 합니다.');
  policy.oncePerBatch = policy.oncePerBatch === true;
  return policy;
}

// 정산 원본 행 → 후보 상담사. 제외한 행은 사유와 함께 돌려준다(원본의 두 '단계' 열: 첫째가 광고그룹, 둘째가 활동단계)
function normalizeSettlement(rawRows, customPolicy) {
  const policy = resolvePolicy(customPolicy);
  const valid = [], excluded = [];
  for (const row of Array.isArray(rawRows) ? rawRows : []) {
    const item = {
      sourceRow: asNumber(row.sourceRow, 0), service: clean(row.service), category: clean(row.category), group: normGroup(row.group),
      stage: parseStage(row.stage), manager: clean(row.manager), nickname: clean(row.nickname), seconds: asNumber(row.seconds, 0), memo: clean(row.memo),
    };
    const combined = [row.service, row.category, row.group, row.stage, row.manager, row.nickname, row.seconds, row.memo].map(clean).join(' ');
    const reason = !item.nickname ? '닉네임 없음' : !item.category ? '카테고리 없음' : !GROUPS.includes(item.group) ? '그린·퍼플이 아닌 그룹' : (policy.excludeRowWords.find((w) => combined.includes(w)) || '');
    if (reason) excluded.push({ sourceRow: item.sourceRow, nickname: item.nickname, reason });
    else valid.push(item);
  }
  const count = {};
  for (const c of valid) count[c.nickname] = (count[c.nickname] || 0) + 1;
  const duplicates = Object.keys(count).filter((name) => count[name] > 1);
  return { counselors: valid, excluded, duplicates };
}

// 아테나 아이템 상태 반영: 승인완료 아이템이 있는 상담사만 남기고, 같은 닉네임이 여러 줄이면 활동 중인 줄을 고른다.
// activeItems: [{ nickname, stage: '그린 2단계' }] (승인완료 아이템). 같은 닉네임 줄이 여럿일 때는 ①활동 아이템과 그룹·단계가 같은 줄 ②그중 전월 상담시간이 있는 줄 하나.
function applyActiveStatus(counselors, activeItems) {
  const active = {};
  for (const item of activeItems || []) (active[clean(item.nickname)] ||= []).push({ group: normGroup(item.stage), stage: parseStage(String(item.stage || '').replace(/^.*?(\d)\s*단계.*$/, '$1')) });
  const groups = {};
  for (const c of counselors) (groups[c.nickname] ||= []).push(c);
  const kept = [], inactive = [], resolved = [], unresolved = [];
  for (const [nickname, rows] of Object.entries(groups)) {
    const items = active[nickname] || [];
    if (!items.length) { inactive.push(...rows.map((r) => ({ nickname, sourceRow: r.sourceRow, group: r.group, stage: r.stage }))); continue; }
    if (rows.length === 1) { kept.push(rows[0]); continue; }
    let pool = rows.filter((r) => items.some((i) => i.group === r.group && i.stage === r.stage));
    if (!pool.length) pool = rows.filter((r) => items.some((i) => i.group === r.group));
    if (!pool.length) pool = rows;
    if (pool.length > 1) { const worked = pool.filter((r) => r.seconds > 0); if (worked.length === 1) pool = worked; }
    if (pool.length === 1) { kept.push(pool[0]); resolved.push({ nickname, keptRow: pool[0].sourceRow, droppedRows: rows.filter((r) => r !== pool[0]).map((r) => r.sourceRow) }); }
    else { kept.push(...rows); unresolved.push(nickname); }
  }
  return { counselors: kept, inactive, resolved, unresolved };
}

// ---- 광고 기록 시트(「메인상담사 배너 리스트」) 읽기 ----
// 탭 하나(그린/퍼플 × 전화/채팅)는 배너 구역이 위아래로 쌓여 있다. 구역 바로 윗줄이 주차 머리말("11.30 ~ 12.06", "12.07 예정"),
// B열이 구역 이름("그린 전화 메인", 병합), C열부터 한 열이 한 주다. grid는 [행][열] 글자 배열(0부터, 병합 칸은 같은 값이 채워져 있어도 되고 첫 칸만 있어도 된다).
const HISTORY_MEMO = ['사주,신점 없음', '사주 신점 없음', '붉은 표시', '두분 다 퍼플', '두 분 다 퍼플'].map((p) => p.replace(/\s/g, ''));
// 칸의 글자에서 닉네임만 남긴다("가 > 나"는 바뀐 뒤의 나, 끝의 (그린)·(퍼플) 표시는 뗀다). 운영 메모면 빈 값
function historyNickname(value) {
  let text = clean(value);
  if (!text) return '';
  const squeezed = text.replace(/\s/g, '');
  if (HISTORY_MEMO.some((p) => squeezed.includes(p))) return '';
  if (text.includes('>')) text = clean(text.split('>').pop());
  text = text.replace(/\s*\((그린|퍼플)\)\s*$/g, '').trim();
  return !text || /없음$/.test(text) ? '' : text;
}
// 주차 머리말 → { month, day, planned }. 주차가 아니면 null
function weekLabel(value) {
  const text = clean(value);
  if (text.length > 40) return null;
  const isPlanned = text.includes('예정');
  const range = text.match(/(?:^|[^\d.])(\d{1,2})\s*[./-]\s*(\d{1,2})\s*~/);
  if (range) return { month: Number(range[1]), day: Number(range[2]), planned: isPlanned };
  const planned = isPlanned ? text.match(/(?:^|[^\d.])(\d{1,2})\s*[./-]\s*(\d{1,2})(?!\s*[./-]?\d)/) : null;
  return planned ? { month: Number(planned[1]), day: Number(planned[2]), planned: true } : null;
}
const columnLetter = (n) => { let out = ''; for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) out = String.fromCharCode(65 + ((c - 1) % 26)) + out; return out; };
// 머리말에는 연도가 없다. 왼쪽부터 달이 크게 줄어들면 해가 넘어간 것으로 보고, 마지막 주가 today에 가장 가깝게 되는 연도를 고른다
function weekStarts(labels, today) {
  let offset = 0, prev = null;
  const marks = labels.map((l) => { if (!l) return null; if (prev != null && l.month < prev - 6) offset++; prev = l.month; return offset; });
  const last = labels.reduce((at, l, i) => (l ? i : at), -1);
  if (last < 0) return labels.map(() => null);
  const now = toDay(today) ?? toDay(new Date());
  const year = new Date(now).getUTCFullYear();
  let best = year, gap = Infinity;
  for (const y of [year - 1, year, year + 1]) {
    const d = Math.abs(Date.UTC(y, labels[last].month - 1, labels[last].day) - now);
    if (d < gap) { gap = d; best = y; }
  }
  const base = best - marks[last];
  return labels.map((l, i) => (l ? mondayOf(Date.UTC(base + marks[i], l.month - 1, l.day)) : null));
}
function parseHistoryTab(tabName, grid, { today } = {}) {
  const group = normGroup(tabName), channel = normChannel(tabName);
  const records = [], skipped = [], blocks = [];
  if (!GROUPS.includes(group) || !CHANNELS.includes(channel)) return { records, skipped, blocks };
  const cell = (r, c) => clean(grid[r]?.[c]);
  const bannerOf = (r) => { const b = normBanner(cell(r, 1)); return BANNERS.includes(b) ? b : ''; };
  // 주차 열은 탭 전체가 같다. 새 주를 맨 위 머리말에만 적어 둔 경우(아래 구역 머리말은 아직 빈칸)에는 탭의 다른 머리말 줄에서 그 열의 주차를 가져온다
  const fullWidth = Math.max(...grid.map((row) => (row || []).length), 0);
  const tabLabels = Array.from({ length: fullWidth }, () => null);
  for (let r = 0; r < grid.length; r++) {
    if (bannerOf(r) || !(grid[r] || []).some((v, c) => c >= 2 && weekLabel(v))) continue;
    for (let c = 2; c < fullWidth; c++) if (!tabLabels[c]) tabLabels[c] = weekLabel(cell(r, c));
  }
  for (let r = 1; r < grid.length; r++) {
    const banner = bannerOf(r);
    if (!banner) continue;
    const head = r - 1;
    const width = fullWidth;
    const labels = Array.from({ length: width }, (_, c) => (c >= 2 ? weekLabel(cell(head, c)) || tabLabels[c] : null));
    let end = r;
    // 구역 끝: 다음 주차 머리말 줄이나 다른 구역 이름이 나오기 전까지
    // (B열이 빈 줄은 주차 칸에 값이 있을 때만 구역에 넣는다)
    const hasValue = (row) => (grid[row] || []).some((v, c) => c >= 2 && clean(v));
    const isHeader = (row) => !bannerOf(row) && (grid[row] || []).some((v, c) => c >= 2 && weekLabel(v));
    while (end + 1 < grid.length && !isHeader(end + 1) && (bannerOf(end + 1) === banner || (!cell(end + 1, 1) && hasValue(end + 1)))) end++;
    const starts = weekStarts(labels, today);
    blocks.push({ banner, firstRow: r + 1, lastRow: end + 1, headerRow: head + 1, columns: labels.map((l, c) => (l ? { column: columnLetter(c + 1), start: formatDay(starts[c]), planned: l.planned } : null)).filter(Boolean) });
    for (let c = 2; c < width; c++) {
      if (!labels[c]) continue;
      for (let row = r; row <= end; row++) {
        const original = cell(row, c);
        if (!original) continue;
        const position = `${tabName}!${columnLetter(c + 1)}${row + 1}`;
        const nickname = historyNickname(original);
        if (!nickname) { skipped.push({ position, original }); continue; }
        records.push({ start: formatDay(starts[c]), end: formatDay(starts[c] + 6 * DAY), group, channel, banner, nickname, status: labels[c].planned ? '예정' : '확정', original, position });
      }
    }
    r = end;
  }
  return { records, skipped, blocks };
}

// 대표 지시문에서 시작 주차·범위(1주/4주)·초안 ID를 읽는다(AI 없이). 못 읽은 값은 null이고 도구가 기본값을 쓴다.
// 고정 절차는 단계 설명에 [[지시]]…[[/지시]]로 지시 원문을 싣는다. 그 표시가 있으면 그 안만 본다
function parseRequest(text, { today } = {}) {
  const whole = String(text || '');
  const marked = whole.match(/\[\[지시\]\]([\s\S]*?)\[\[\/지시\]\]/);
  const body = marked ? marked[1] : whole;
  const now = toDay(today) ?? toDay(new Date(Date.now() + 9 * 3600 * 1000));
  const id = body.match(/AD-\d{8}-[14]W-[0-9A-F]{6}/i);
  let weekCount = null;
  const span = body.replace(/주기[^,.\n]{0,8}?\d+\s*주/g, ' ').replace(/\d+\s*주\s*(뒤|후|전|마다|동안은)/g, ' ').replace(/\d{1,2}\s*[./-]\s*\d{1,2}\s*주/g, ' ');
  const counts = [...span.matchAll(/(^|[^0-9])(\d{1,2})\s*주(?!\s*차|기)/g)].map((m) => Number(m[2]));
  if (counts.includes(4) || /네\s*주|한\s*달/.test(span)) weekCount = 4;
  else if (counts.includes(1) || /한\s*주|일주일|주만/.test(span)) weekCount = 1;
  const unsupported = counts.find((n) => n !== 1 && n !== 4) ?? null;
  let start = null;
  const full = body.match(/(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  const short = body.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || body.match(/(^|[^0-9.A-Za-z-])(\d{1,2})[./-](\d{1,2})(?=\s*(주|부터|시작|일))/);
  if (full) start = Date.UTC(Number(full[1]), Number(full[2]) - 1, Number(full[3]));
  else if (short) {
    const [m, d] = short.length === 3 ? [Number(short[1]), Number(short[2])] : [Number(short[2]), Number(short[3])];
    const year = new Date(now).getUTCFullYear();
    // 연도가 없으면 오늘에서 두 달 전 ~ 열 달 뒤 사이의 그 날짜
    start = [year - 1, year, year + 1].map((y) => Date.UTC(y, m - 1, d)).find((ms) => ms >= now - 60 * DAY && ms <= now + 305 * DAY) ?? null;
  }
  const ordinals = [];
  for (const m of body.matchAll(/(?<![0-9])((?:[1-4]\s*(?:[,·~-]|와|과|및)\s*)*[1-4])\s*주차/g)) {
    const parts = m[1].split(/(?=[,·~-]|와|과|및)|(?<=[,·~-]|와|과|및)/).map((p) => p.trim()).filter(Boolean);
    let prev = null, range = false;
    for (const p of parts) {
      if (/^[1-4]$/.test(p)) { const n = Number(p); if (range && prev != null) for (let i = Math.min(prev, n); i <= Math.max(prev, n); i++) ordinals.push(i); else ordinals.push(n); prev = n; range = false; }
      else range = p === '~' || p === '-';
    }
  }
  return { startDate: start != null ? formatDay(mondayOf(start)) : null, weekCount, draftId: id ? id[0].toUpperCase() : null, weekOrdinals: [...new Set(ordinals)].sort(), unsupportedWeeks: unsupported, text: body.trim() };
}

// 입력을 계산용으로 정리한다(v2.1의 hc21LoadSortingData_)
function prepare(input) {
  const counselors = (input.counselors || []).map((c) => ({
    nickname: clean(c.nickname), service: clean(c.service), category: clean(c.category), group: normGroup(c.group),
    stage: parseStage(c.stage), manager: clean(c.manager), seconds: asNumber(c.seconds, 0),
  })).filter((c) => c.nickname);
  const counselorMap = {};
  for (const c of counselors) (counselorMap[c.nickname] ||= []).push(c);
  const duplicateCounselors = {};
  for (const name of Object.keys(counselorMap)) if (counselorMap[name].length > 1) duplicateCounselors[name] = true;

  const policy = resolvePolicy(input.policy);
  const rules = (input.rules || policy.rules).filter((r) => asBoolean(r.enabled)).map((r) => ({
    order: asNumber(r.order, 999), group: normGroup(r.group), channel: normChannel(r.channel), banner: normBanner(r.banner),
    capacity: Math.max(0, asNumber(r.capacity, 0)), minWeeks: Math.max(0, asNumber(r.minWeeks, 0)), priorityWeeks: Math.max(0, asNumber(r.priorityWeeks, 0)),
    partner: clean(r.partner), mainStage: asNumber(r.mainStage, 0), mainSeconds: asNumber(r.mainSeconds, 0),
  })).filter((r) => r.capacity > 0 && GROUPS.includes(r.group) && CHANNELS.includes(r.channel) && BANNERS.includes(r.banner))
    .sort((a, b) => a.order - b.order);

  const wishes = (input.wishes || []).map((w, index) => ({
    index, id: clean(w.id), registeredAt: toDay(w.registeredAt), nickname: clean(w.nickname), channel: normChannel(w.channel), banner: normBanner(w.banner),
    group: normGroup(w.group), status: clean(w.status),
  })).filter((w) => w.nickname && w.status === '대기');
  const wishMap = {};
  for (const w of wishes) {
    const key = candidateKey(w.nickname, w.group, w.channel, w.banner);
    if (!wishMap[key] || (w.registeredAt != null && (wishMap[key].registeredAt == null || w.registeredAt < wishMap[key].registeredAt))) wishMap[key] = w;
  }

  // 주기 계산에는 확정·완료된 광고만 쓴다(미확정 초안은 과거 실적이 아니다)
  const history = (input.history || []).map((h) => ({
    start: mondayOf(h.start), group: normGroup(h.group), channel: normChannel(h.channel), banner: normBanner(h.banner), nickname: clean(h.nickname),
    confirmed: ['확정', '완료'].includes(clean(h.status)),
  })).filter((h) => h.start != null && h.nickname && h.confirmed);

  const carryoverMap = {};
  for (const c of input.carryovers || []) {
    if (clean(c.status || '대기') !== '대기') continue;
    carryoverMap[candidateKey(c.nickname, c.group, c.channel, c.banner)] = { id: clean(c.id), start: toDay(c.start), count: asNumber(c.count, 0) };
  }
  const exceptions = (input.exceptions || []).filter((e) => e.enabled === undefined || asBoolean(e.enabled));
  return { policy, counselors, counselorMap, duplicateCounselors, rules, wishes, wishMap, history, carryoverMap, exceptions };
}

// 조정(예외) 유형: 제외·연기(후보에서 뺌) / 고정(맨 앞 순위) / 주기(이 사람만 최소 주기를 weeks로) / 지정(그 주 자리에 바로 넣음 — 초안 도구가 미리 정해진 자리로 바꾼다)
function findException(exceptions, context, week, types) {
  for (const row of exceptions) {
    if (clean(row.nickname) !== context.nickname) continue;
    if (types && !types.includes(clean(row.type))) continue;
    const start = toDay(row.start), end = toDay(row.end);
    if (start != null && week + 6 * DAY < start) continue;
    if (end != null && week > end) continue;
    if (clean(row.group) && normGroup(row.group) !== context.group) continue;
    if (clean(row.channel) && normChannel(row.channel) !== context.channel) continue;
    if (clean(row.banner) && normBanner(row.banner) !== context.banner) continue;
    return { type: clean(row.type), reason: clean(row.reason), weeks: row.weeks };
  }
  return null;
}

// 한 상담사가 한 배너의 그 주 후보인지와 정렬 점수(v2.1의 hc21EvaluateCandidate_)
function evaluateCandidate(counselor, rule, week, history, carryoverMap, wishMap, exceptions, policy = defaultPolicy()) {
  if (counselor.group !== rule.group) return { ok: false, reason: '정산 그룹 불일치' };
  const blocked = policy.excludeCategoryWords.find((w) => counselor.category.includes(w));
  if (blocked) return { ok: false, reason: `${blocked} 카테고리 제외` };
  const serviceToken = policy.serviceTokens[rule.channel];
  if (!counselor.service.includes(serviceToken)) return { ok: false, reason: `${serviceToken} 미제공` };
  if (rule.banner !== '메인' && !counselor.category.includes(rule.banner)) return { ok: false, reason: '상담 카테고리 불일치' };

  const isPartner = counselor.stage >= policy.partnerStages[0] && counselor.stage <= policy.partnerStages[1];
  if (rule.partner === '파트너' && !isPartner) return { ok: false, reason: '파트너 전용 배너' };
  if (rule.banner === '메인' && !(counselor.stage >= rule.mainStage || counselor.seconds >= rule.mainSeconds)) {
    return { ok: false, reason: `${rule.mainStage}단계 또는 상담시간 기준 미충족` };
  }

  const context = { nickname: counselor.nickname, group: rule.group, channel: rule.channel, banner: rule.banner };
  const blockedBy = findException(exceptions, context, week, ['제외', '연기']);
  if (blockedBy) return { ok: false, reason: `예외설정 ${blockedBy.type}: ${blockedBy.reason}` };
  const exception = findException(exceptions, context, week, ['고정']);
  const cycle = findException(exceptions, context, week, ['주기']);
  const minWeeks = cycle && cycle.weeks !== undefined && cycle.weeks !== '' ? Math.max(0, asNumber(cycle.weeks, rule.minWeeks)) : rule.minWeeks;

  let last = null;
  for (const item of history) {
    if (item.nickname !== counselor.nickname || item.group !== rule.group || item.channel !== rule.channel || item.banner !== rule.banner || item.start >= week) continue;
    if (last == null || item.start > last) last = item.start;
  }
  const elapsedWeeks = last != null ? weeksBetween(last, week) : 9999;
  if (elapsedWeeks < minWeeks) return { ok: false, reason: `광고 주기 미충족(${elapsedWeeks}/${minWeeks}주)` };

  const key = candidateKey(counselor.nickname, rule.group, rule.channel, rule.banner);
  const carry = carryoverMap[key] || null;
  const wish = wishMap[key] || null;
  const isMainStagePriority = rule.banner === '메인' && counselor.stage >= rule.mainStage;
  const score = {
    fixed: exception && exception.type === '고정' ? 1 : 0,
    carry: carry ? 1 : 0,
    carryAge: carry && carry.start != null ? Math.max(0, weeksBetween(carry.start, week)) : 0,
    wish: wish ? 1 : 0,
    wishTime: wish && wish.registeredAt != null ? wish.registeredAt : Number.MAX_SAFE_INTEGER,
    specialBand: rule.priorityWeeks > 0 ? (elapsedWeeks >= rule.priorityWeeks ? 2 : 1) : 1,
    mainBand: rule.banner === '메인' ? (isMainStagePriority ? 2 : 1) : 1,
    stage: rule.banner === '메인' && isMainStagePriority ? counselor.stage : 0,
    elapsedWeeks,
  };
  const description = [
    score.fixed ? '수동고정' : '',
    minWeeks !== rule.minWeeks ? `개별 주기 ${minWeeks}주` : '',
    score.carry ? `이월 ${score.carryAge}주` : '',
    score.wish ? `광고희망 ${formatDay(wish.registeredAt)}` : '',
    rule.priorityWeeks ? `${elapsedWeeks}주 경과` : '',
    rule.banner === '메인' ? (isMainStagePriority ? `${counselor.stage}단계 우선` : `${Math.floor(counselor.seconds / 3600)}시간 충족`) : '',
    last != null ? `최근광고 ${formatDay(last)}` : '광고이력 없음',
  ].filter(Boolean).join(' · ');
  return { ok: true, score, description, wish, last, elapsedWeeks, minWeeks };
}

// 정렬: 수동고정 → 이월(오래된 순) → 희망(등록 빠른 순) → 장기 대기 구간 → 메인 단계 구간·단계 → 최근 광고가 오래된 순 → 닉네임
const SORTERS = {
  fixed: (x, y) => y.fixed - x.fixed,
  carry: (x, y) => (y.carry - x.carry) || (y.carryAge - x.carryAge),
  wish: (x, y) => (y.wish - x.wish) || (x.wishTime - y.wishTime),
  longWait: (x, y) => y.specialBand - x.specialBand,
  mainStage: (x, y) => (y.mainBand - x.mainBand) || (y.stage - x.stage),
  elapsed: (x, y) => y.elapsedWeeks - x.elapsedWeeks,
};
function compareCandidates(a, b, sortOrder = SORT_KEYS) {
  for (const key of sortOrder) { const diff = SORTERS[key](a.score, b.score); if (diff) return diff; }
  return a.counselor.nickname.localeCompare(b.counselor.nickname, 'ko');
}

// 같은 주에는 한 사람 한 배너. 예외는 전화 사주 + 채팅 사주뿐이다
function canAssignThisWeek(assigned, nickname, banner, together = ['사주']) {
  const prior = assigned[nickname] || [];
  if (!prior.length) return true;
  return together.includes(banner) && prior.every((item) => item === banner);
}

function draftRow(week, rule, seq, candidate, result) {
  const wish = candidate.wish;
  return {
    week: formatDay(week), end: formatDay(week + 6 * DAY), group: rule.group, channel: rule.channel, banner: rule.banner, seq,
    nickname: candidate.counselor.nickname, manager: candidate.counselor.manager, trackingId: candidate.trackingId,
    wishId: wish ? wish.id : '', wishDate: wish ? formatDay(wish.registeredAt) : '', stage: candidate.counselor.stage, seconds: candidate.counselor.seconds,
    description: result === '이월예정' ? `${candidate.description} · 정원 초과로 차주 이월` : candidate.description, result,
  };
}

// 1주 또는 4주 선정 초안(v2.1의 hc21GenerateDraft). 기본은 최소 주기가 지나면 같은 생성 안에서도 다시 배정하고, 규칙의 oncePerBatch가 true면 v2.1처럼 한 번만 배정한다
function generateDraft(input) {
  const first = generateDraftOnce(input);
  if (!first.dropped.length) return first;
  const gone = new Set(first.dropped.map((d) => `${d.week}|${d.nickname}|${bannerKey(d.group, d.channel, d.banner)}`));
  const rest = (input.preassigned || []).filter((p) => !gone.has(`${formatDay(mondayOf(p.week ?? p.start))}|${clean(p.nickname)}|${bannerKey(p.group, p.channel, p.banner)}`));
  const second = generateDraftOnce({ ...input, preassigned: rest });
  return { ...second, dropped: [...first.dropped, ...second.dropped], warnings: [...first.warnings.filter((w) => w.includes('뺐습니다')), ...second.warnings] };
}
function generateDraftOnce(input) {
  const start = mondayOf(input.startDate);
  const weekCount = Number(input.weekCount);
  if (start == null) throw new Error('시작 주차를 정해 주세요.');
  if (![1, 4].includes(weekCount)) throw new Error('생성 범위는 1주 또는 4주만 가능합니다.');
  const data = prepare(input);
  if (!data.counselors.length) throw new Error('정산 자료에 상담사가 없습니다.');
  if (!data.rules.length) throw new Error('사용 중인 광고 규칙이 없습니다.');

  const policy = data.policy;
  const sort = (a, b) => compareCandidates(a, b, policy.sortOrder);
  const minWeeksFor = (nickname, rule, week) => { const c = findException(data.exceptions, { nickname, group: rule.group, channel: rule.channel, banner: rule.banner }, week, ['주기']); return c && c.weeks !== undefined && c.weeks !== '' ? Math.max(0, asNumber(c.weeks, rule.minWeeks)) : rule.minWeeks; };
  const rows = [];
  const plannedHistory = data.history.slice();
  const selectedCombination = {};
  const finalEligible = {};
  const slots = [];
  const warnings = [];
  const dropped = [];
  const preassigned = (input.preassigned || []).map((p) => ({ week: mondayOf(p.week ?? p.start), group: normGroup(p.group), channel: normChannel(p.channel), banner: normBanner(p.banner), nickname: clean(p.nickname), source: clean(p.source), force: p.force === true }))
    .filter((p) => p.nickname && p.week != null);
  let selected = 0;

  for (let offset = 0; offset < weekCount; offset++) {
    const week = start + offset * 7 * DAY;
    const assignedThisWeek = {};
    // 미리 정해진 자리(시트의 "예정" 열, 운영자의 '지정'): 그 주 자리를 먼저 차지하고, 같은 주 다른 배너 후보에서 빠진다.
    // 시트에 미리 적힌 이름이 자격·주기에 맞지 않으면 빼고 알린다. 운영자가 '지정'한 자리(force)는 그대로 넣고 알리기만 한다
    const preOfRule = {};
    for (const pre of preassigned.filter((p) => p.week === week)) {
      const rule = data.rules.find((r) => r.group === pre.group && r.channel === pre.channel && r.banner === pre.banner);
      const where = `${formatDay(week)} ${pre.group} ${pre.channel} ${pre.banner}`;
      if (!rule) { warnings.push(`미리 적힌 ${pre.nickname}(${where}): 사용 중인 규칙에 없는 배너라 뺐습니다`); continue; }
      const list = data.counselorMap[pre.nickname] || [];
      const checked = list.length === 1 ? evaluateCandidate(list[0], rule, week, plannedHistory, data.carryoverMap, data.wishMap, data.exceptions, policy) : null;
      const note = list.length !== 1 ? (list.length > 1 ? '정산 자료에 닉네임 중복' : '정산 자료에 없는 닉네임(활동 중이 아니거나 닉네임이 다름)') : checked.ok ? '' : checked.reason;
      const taken = assignedThisWeek[pre.nickname] || [];
      const clash = taken.length && !canAssignThisWeek(assignedThisWeek, pre.nickname, rule.banner, policy.sameWeekTogether) ? `같은 주 ${taken.join('·')} 배너와 겹침` : '';
      const problem = [note, clash].filter(Boolean).join(', ');
      if (problem && !pre.force && policy.dropIneligiblePreassigned) { warnings.push(`미리 적힌 ${pre.nickname}(${where}): ${problem} — 명단에서 뺐습니다`); dropped.push({ ...pre, week: formatDay(week), reason: problem }); continue; }
      if (problem) warnings.push(`미리 정한 ${pre.nickname}(${where}): 확인 필요 — ${problem}`);
      (preOfRule[bannerKey(rule.group, rule.channel, rule.banner)] ||= []).push({ ...pre, note: problem });
      (assignedThisWeek[pre.nickname] ||= []).push(rule.banner);
    }
    for (const rule of data.rules) {
      const preList = preOfRule[bannerKey(rule.group, rule.channel, rule.banner)] || [];
      let placed = 0;
      for (const pre of preList) {
        const key = candidateKey(pre.nickname, rule.group, rule.channel, rule.banner);
        const counselor = (data.counselorMap[pre.nickname] || [])[0] || { nickname: pre.nickname, manager: '', stage: '', seconds: '' };
        const wish = data.wishMap[key] || null;
        placed++; selected++;
        selectedCombination[key] = true;
        rows.push(draftRow(week, rule, placed, { counselor: { nickname: pre.nickname, manager: counselor.manager, stage: counselor.stage, seconds: counselor.seconds }, wish, trackingId: trackingId(pre.nickname, rule.group, rule.channel, rule.banner), description: ['미리 정해짐', pre.source, pre.note ? `확인 필요: ${pre.note}` : ''].filter(Boolean).join(' · ') }, '선정'));
        plannedHistory.push({ start: week, group: rule.group, channel: rule.channel, banner: rule.banner, nickname: pre.nickname, confirmed: true });
      }
      if (preList.length > rule.capacity) warnings.push(`미리 적힌 자리가 정원보다 많습니다: ${formatDay(week)} ${rule.group} ${rule.channel} ${rule.banner} ${preList.length}/${rule.capacity}`);
      const preNames = new Set(preList.map((p) => p.nickname));
      const candidates = [];
      for (const counselor of data.counselors) {
        if (data.duplicateCounselors[counselor.nickname] || counselor.group !== rule.group || preNames.has(counselor.nickname)) continue;
        const key = candidateKey(counselor.nickname, rule.group, rule.channel, rule.banner);
        if (policy.oncePerBatch && selectedCombination[key]) continue;
        const ahead = preassigned.find((p) => p.nickname === counselor.nickname && p.week > week && p.group === rule.group && p.channel === rule.channel && p.banner === rule.banner
          && (policy.oncePerBatch || weeksBetween(week, p.week) < minWeeksFor(counselor.nickname, rule, p.week)));
        if (ahead) continue;
        const used = selectedCombination[key];
        const result = evaluateCandidate(counselor, rule, week, plannedHistory, used ? {} : data.carryoverMap, used ? {} : data.wishMap, data.exceptions, policy);
        if (!result.ok) continue;
        const candidate = { counselor, rule, score: result.score, description: result.description, wish: result.wish, trackingId: trackingId(counselor.nickname, rule.group, rule.channel, rule.banner) };
        candidates.push(candidate);
        if (offset === weekCount - 1) finalEligible[key] = candidate;
      }
      candidates.sort(sort);
      for (const candidate of candidates) {
        if (placed >= rule.capacity) break;
        const name = candidate.counselor.nickname;
        if (!canAssignThisWeek(assignedThisWeek, name, rule.banner, policy.sameWeekTogether)) continue;
        const key = candidateKey(name, rule.group, rule.channel, rule.banner);
        placed++; selected++;
        selectedCombination[key] = true;
        delete finalEligible[key];
        (assignedThisWeek[name] ||= []).push(rule.banner);
        rows.push(draftRow(week, rule, placed, candidate, '선정'));
        plannedHistory.push({ start: week, group: rule.group, channel: rule.channel, banner: rule.banner, nickname: name, confirmed: true });
      }
      slots.push({ week: formatDay(week), group: rule.group, channel: rule.channel, banner: rule.banner, capacity: rule.capacity, placed, empty: Math.max(0, rule.capacity - placed), candidates: candidates.length });
    }
  }

  const finalWeek = start + (weekCount - 1) * 7 * DAY;
  // 일반 미선정자 전원을 이월로 만들면 다음 실행부터 이월이 희망보다 과하게 앞선다. 기존 이월·희망·수동고정 미선정자만 이월한다
  const scope = policy.carryoverScope;
  const carryCandidates = Object.keys(finalEligible).filter((key) => !selectedCombination[key]).map((key) => finalEligible[key])
    .filter((c) => scope.includes('all') || scope.some((k) => c.score[k]))
    .sort((a, b) => (a.rule.order - b.rule.order) || sort(a, b));
  for (const candidate of carryCandidates) rows.push(draftRow(finalWeek, candidate.rule, '', candidate, '이월예정'));

  // 선정도 이월도 안 된 희망: 사유를 붙여 '제외'로 보여 준다
  const excluded = [];
  const seen = {};
  for (const wish of data.wishes) {
    const key = candidateKey(wish.nickname, wish.group, wish.channel, wish.banner);
    if (seen[key] || selectedCombination[key] || finalEligible[key]) continue;
    seen[key] = true;
    const list = data.counselorMap[wish.nickname] || [];
    let reason;
    if (data.duplicateCounselors[wish.nickname]) reason = '정산 자료에 동일 닉네임 중복';
    else if (!list.length) reason = '정산 자료에서 닉네임을 찾지 못함';
    else {
      const rule = data.rules.find((r) => r.group === wish.group && r.channel === wish.channel && r.banner === wish.banner);
      if (!rule) reason = '사용 중인 광고 규칙을 찾지 못함';
      else {
        const checked = evaluateCandidate(list[0], rule, finalWeek, data.history, data.carryoverMap, data.wishMap, data.exceptions, policy);
        reason = checked.ok ? '같은 주 다른 배너 선정으로 이번 범위 미배정' : checked.reason;
      }
    }
    const counselor = list[0] || { manager: '', stage: '', seconds: '' };
    const row = {
      week: formatDay(finalWeek), end: formatDay(finalWeek + 6 * DAY), group: wish.group, channel: wish.channel, banner: wish.banner, seq: '',
      nickname: wish.nickname, manager: counselor.manager, trackingId: trackingId(wish.nickname, wish.group, wish.channel, wish.banner),
      wishId: wish.id, wishDate: formatDay(wish.registeredAt), stage: counselor.stage, seconds: counselor.seconds, description: reason, result: '제외',
    };
    rows.push(row); excluded.push(row);
  }

  return {
    version: VERSION, startDate: formatDay(start), weekCount, rows, slots,
    summary: { selected, carryover: carryCandidates.length, excluded: excluded.length, emptySlots: slots.reduce((sum, s) => sum + s.empty, 0) },
    duplicates: Object.keys(data.duplicateCounselors), warnings, dropped,
  };
}

// 검수본 검증(v2.1의 hc21ValidateDraft_): 정원, 같은 광고 중복, 같은 주 중복. 문제를 모두 모아 돌려준다(빈 배열이면 통과)
function validateDraft(rows, customPolicy) {
  const ruleMap = {};
  const policy = resolvePolicy(customPolicy);
  for (const rule of prepare({ policy }).rules) ruleMap[bannerKey(rule.group, rule.channel, rule.banner)] = rule;
  const problems = [];
  const capacityCount = {}, nicknameWeek = {}, duplicateSelection = {};
  for (const row of (rows || []).filter((r) => clean(r.result) === '선정')) {
    const week = formatDay(toDay(row.week));
    const nickname = clean(row.nickname);
    if (!week || !nickname) { problems.push('선정 행에 진행주차 또는 닉네임이 없습니다.'); continue; }
    const banner = bannerKey(row.group, row.channel, row.banner);
    const key = `${week}|${banner}`;
    const rule = ruleMap[banner];
    if (!rule) { problems.push(`설정에서 찾을 수 없는 배너: ${key}`); continue; }
    capacityCount[key] = (capacityCount[key] || 0) + 1;
    if (capacityCount[key] === rule.capacity + 1) problems.push(`정원 초과: ${key} (정원 ${rule.capacity})`);
    const combination = `${week}|${candidateKey(nickname, row.group, row.channel, row.banner)}`;
    if (duplicateSelection[combination]) problems.push(`같은 광고 중복 배정: ${combination}`);
    duplicateSelection[combination] = true;
    const nameKey = `${week}|${nickname}`;
    const current = normBanner(row.banner);
    const prior = nicknameWeek[nameKey] || [];
    if (prior.length && !(policy.sameWeekTogether.includes(current) && prior.every((b) => b === current))) problems.push(`같은 주 중복 배정: ${nameKey}`);
    (nicknameWeek[nameKey] ||= []).push(current);
  }
  return problems;
}

module.exports = {
  VERSION, GROUPS, CHANNELS, BANNERS,
  clean, normGroup, normChannel, normBanner, asNumber, asBoolean, parseStage,
  toDay, formatDay, mondayOf, addDays, weeksBetween, nextMonday,
  bannerKey, candidateKey, trackingId, defaultRules, defaultPolicy, resolvePolicy, SORT_KEYS, normalizeSettlement,
  historyNickname, weekLabel, weekStarts, parseHistoryTab, columnLetter, parseRequest, applyActiveStatus, findException,
  prepare, evaluateCandidate, compareCandidates, canAssignThisWeek, generateDraft, validateDraft,
};
