// 광고 선정 계산(shared/보관함/광고운영/도구/ad-lib.cjs): 개발요청서의 "광고 계산 인수표"를 가상 상담사로 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ad = require('../shared/보관함/광고운영/도구/ad-lib.cjs');

const BOTH = '전화상담(1), 채팅상담(1)';
const person = (nickname, over = {}) => ({ nickname, service: BOTH, category: '타로', group: '그린', stage: 3, manager: '가상담당', seconds: 0, ...over });
const rule = (group, channel, banner) => ad.prepare({}).rules.find((r) => r.group === group && r.channel === channel && r.banner === banner);
const check = (counselor, r, week, history = []) => {
  const data = ad.prepare({ counselors: [counselor], history });
  return ad.evaluateCandidate(data.counselors[0], r, ad.toDay(week), data.history, {}, {}, []);
};
const picked = (draft, filter = () => true) => draft.rows.filter((r) => r.result === '선정' && filter(r));
const WEEK = '2026-11-30';

test('주차: 금요일(2026-11-27)의 다음 월요일은 11-30이고 4주는 12-21 주까지다', () => {
  assert.equal(ad.nextMonday('2026-11-27'), '2026-11-30');
  assert.equal(ad.formatDay(ad.mondayOf('2026-12-06')), '2026-11-30', '일요일은 그 주 월요일로');
  const draft = ad.generateDraft({ startDate: '2026-12-02', weekCount: 4, counselors: [person('가온')] });
  assert.equal(draft.startDate, '2026-11-30', '시작일은 월요일로 맞춘다');
  assert.deepEqual([...new Set(draft.slots.map((s) => s.week))], ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21']);
  assert.equal(ad.weeksBetween('2026-10-05', '2026-11-30'), 8);
});

test('기본 규칙은 16종이고 요청서 표의 주기와 같고 정원은 모두 15명이다', () => {
  const rules = ad.prepare({}).rules;
  assert.equal(rules.length, 16);
  assert.deepEqual(rules.map((r) => `${r.group}${r.channel}${r.banner}:${r.capacity}/${r.minWeeks}/${r.priorityWeeks}`), [
    '그린전화메인:15/4/0', '그린전화타로:15/4/0', '그린전화사주:15/0/0', '그린전화신점:15/4/0',
    '그린채팅메인:15/2/0', '그린채팅타로:15/2/0', '그린채팅사주:15/0/0', '그린채팅신점:15/0/0',
    '퍼플전화메인:15/6/8', '퍼플전화타로:15/6/0', '퍼플전화사주:15/0/0', '퍼플전화신점:15/5/6',
    '퍼플채팅메인:15/2/0', '퍼플채팅타로:15/2/0', '퍼플채팅사주:15/0/0', '퍼플채팅신점:15/0/0']);
});

test('전화 메인: 0~2단계는 그린 30시간·퍼플 50시간부터(경계 포함), 3단계는 시간과 무관', () => {
  const green = rule('그린', '전화', '메인'), purple = rule('퍼플', '전화', '메인');
  assert.equal(check(person('가', { stage: 2, seconds: 107999 }), green, WEEK).ok, false);
  assert.equal(check(person('가', { stage: 2, seconds: 108000 }), green, WEEK).ok, true);
  assert.equal(check(person('가', { stage: 3, seconds: 10 }), green, WEEK).ok, true);
  assert.equal(check(person('나', { group: '퍼플', stage: 2, seconds: 179999 }), purple, WEEK).ok, false);
  assert.equal(check(person('나', { group: '퍼플', stage: 2, seconds: 180000 }), purple, WEEK).ok, true);
});

test('파트너 조건과 분야·서비스: 0단계 신점·사주 상담사', () => {
  const sinjeom = { stage: 0, category: '신점' };
  assert.equal(check(person('다', sinjeom), rule('그린', '채팅', '신점'), WEEK).ok, true, '그린 채팅 신점은 일반도 가능');
  assert.equal(check(person('다', { ...sinjeom, group: '퍼플' }), rule('퍼플', '채팅', '신점'), WEEK).reason, '파트너 전용 배너');
  const saju = { stage: 0, category: '사주', group: '퍼플' };
  assert.equal(check(person('라', saju), rule('퍼플', '전화', '사주'), WEEK).reason, '파트너 전용 배너');
  assert.equal(check(person('라', saju), rule('퍼플', '채팅', '사주'), WEEK).ok, true);
  assert.equal(check(person('라', { ...saju, service: '전화상담(1)' }), rule('퍼플', '채팅', '사주'), WEEK).reason, '채팅상담(1) 미제공');
  assert.equal(check(person('마', { category: '심리' }), rule('그린', '채팅', '메인'), WEEK).reason, '심리 카테고리 제외');
  assert.equal(check(person('바', { category: '타로' }), rule('그린', '전화', '신점'), WEEK).reason, '상담 카테고리 불일치');
});

test('주기: 퍼플 전화 메인 6주 후보·8주 우선, 퍼플 전화 신점 5주 후보·6주 우선', () => {
  const main = rule('퍼플', '전화', '메인'), sin = rule('퍼플', '전화', '신점');
  const last = (banner) => [{ start: '2026-10-05', group: '퍼플', channel: '전화', banner, nickname: '사', status: '확정' }];
  const who = person('사', { group: '퍼플', category: '신점' });
  assert.equal(check(who, main, '2026-11-09', last('메인')).reason, '광고 주기 미충족(5/6주)');
  assert.equal(check(who, main, '2026-11-16', last('메인')).score.specialBand, 1);
  assert.equal(check(who, main, '2026-11-23', last('메인')).score.specialBand, 1);
  assert.equal(check(who, main, '2026-11-30', last('메인')).score.specialBand, 2);
  assert.equal(check(who, sin, '2026-11-02', last('신점')).ok, false);
  assert.equal(check(who, sin, '2026-11-09', last('신점')).score.specialBand, 1);
  assert.equal(check(who, sin, '2026-11-16', last('신점')).score.specialBand, 2);
  assert.equal(check(who, main, WEEK, [{ ...last('메인')[0], status: '초안' }]).elapsedWeeks, 9999, '미확정 이력은 주기에 넣지 않는다');
});

test('같은 주 중복: 전화 사주 + 채팅 사주만 함께 되고, 사주 + 채팅 메인은 안 된다', () => {
  const draft = ad.generateDraft({ startDate: WEEK, weekCount: 1, counselors: [person('아', { stage: 0, category: '사주' })] });
  assert.deepEqual(picked(draft).map((r) => `${r.channel}${r.banner}`), ['전화사주', '채팅사주']);
  const taro = ad.generateDraft({ startDate: WEEK, weekCount: 1, counselors: [person('자', { stage: 3, category: '타로' })] });
  assert.deepEqual(picked(taro).map((r) => `${r.channel}${r.banner}`), ['전화메인'], '처리순서가 빠른 배너 하나만');
});

test('정렬: 수동고정 → 이월 → 희망 → 장기 대기 → 단계 → 최근 광고가 오래된 순', () => {
  const names = ['고정', '이월', '희망', '장기', '육단계', '삼단계'];
  const counselors = names.map((n) => person(n, { group: '퍼플', stage: n === '육단계' ? 6 : 3 }));
  const key = { group: '퍼플', channel: '전화', banner: '메인' };
  const draft = ad.generateDraft({
    startDate: WEEK, weekCount: 1, counselors,
    rules: ad.defaultRules().filter((r) => r.group === '퍼플' && r.channel === '전화' && r.banner === '메인'),
    exceptions: [{ enabled: true, type: '고정', nickname: '고정', reason: '시험' }],
    carryovers: [{ id: 'C1', nickname: '이월', ...key, start: '2026-11-16', count: 1, status: '대기' }],
    wishes: [{ id: 'W1', registeredAt: '2026-11-20', nickname: '희망', ...key, status: '대기' }],
    history: [...['고정', '이월', '희망', '육단계', '삼단계'].map((n) => ({ start: '2026-10-19', ...key, nickname: n, status: '확정' })),
      { start: '2026-10-05', ...key, nickname: '장기', status: '확정' }],
  });
  assert.deepEqual(picked(draft).map((r) => r.nickname), ['고정', '이월', '희망', '장기', '육단계', '삼단계']);
  assert.match(picked(draft)[2].description, /광고희망 2026-11-20/);
});

test('현행 순서 확인: 같은 조건이면 6주 희망자가 8주 비희망자보다 앞선다(운영자 판단 항목)', () => {
  const key = { group: '퍼플', channel: '전화', banner: '메인' };
  const draft = ad.generateDraft({
    startDate: WEEK, weekCount: 1, counselors: [person('여덟주', { group: '퍼플' }), person('여섯주', { group: '퍼플' })],
    rules: ad.defaultRules().filter((r) => r.group === '퍼플' && r.channel === '전화' && r.banner === '메인'),
    wishes: [{ id: 'W2', registeredAt: '2026-11-20', nickname: '여섯주', ...key, status: '대기' }],
    history: [{ start: '2026-10-05', ...key, nickname: '여덟주', status: '확정' }, { start: '2026-10-19', ...key, nickname: '여섯주', status: '확정' }],
  });
  assert.deepEqual(picked(draft).map((r) => r.nickname), ['여섯주', '여덟주']);
});

test('정원 초과: 희망자는 이월예정, 일반 미선정자는 이월하지 않는다. 자격 미달 희망은 사유와 함께 제외', () => {
  const only = ad.defaultRules().filter((r) => r.group === '그린' && r.channel === '채팅' && r.banner === '신점').map((r) => ({ ...r, capacity: 1 }));
  const key = { group: '그린', channel: '채팅', banner: '신점' };
  const draft = ad.generateDraft({
    startDate: WEEK, weekCount: 1, rules: only,
    counselors: [person('고정', { category: '신점' }), person('희망', { category: '신점' }), person('일반', { category: '신점' }), person('타로만', { category: '타로' })],
    exceptions: [{ enabled: true, type: '고정', nickname: '고정', reason: '시험' }],
    wishes: [{ id: 'W3', registeredAt: '2026-11-20', nickname: '희망', ...key, status: '대기' }, { id: 'W4', registeredAt: '2026-11-21', nickname: '타로만', ...key, status: '대기' },
      { id: 'W5', registeredAt: '2026-11-22', nickname: '없는사람', ...key, status: '대기' }],
  });
  assert.deepEqual(picked(draft).map((r) => r.nickname), ['고정']);
  assert.deepEqual(draft.rows.filter((r) => r.result === '이월예정').map((r) => r.nickname), ['희망']);
  assert.deepEqual(draft.rows.filter((r) => r.result === '제외').map((r) => `${r.nickname}:${r.description}`), ['타로만:상담 카테고리 불일치', '없는사람:정산 자료에서 닉네임을 찾지 못함']);
  assert.deepEqual(draft.summary, { selected: 1, carryover: 1, excluded: 2, emptySlots: 0 });
});

test('4주 일괄: 앞 주 배정이 뒤 주 주기에 반영되고, 주기가 지나면 같은 생성 안에서도 다시 배정된다', () => {
  const sajuOnly = ad.defaultRules().filter((r) => r.group === '그린' && r.channel === '전화' && r.banner === '사주');
  const counselors = [person('사주인', { stage: 0, category: '사주', service: '전화상담(1)' })];
  const four = ad.generateDraft({ startDate: WEEK, weekCount: 4, rules: sajuOnly, counselors });
  assert.deepEqual(picked(four).map((r) => r.week), ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21'], '0주 배너는 매주');
  const once = ad.generateDraft({ startDate: WEEK, weekCount: 4, rules: sajuOnly, counselors, policy: { oncePerBatch: true } });
  assert.deepEqual(picked(once).map((r) => r.week), ['2026-11-30'], 'v2.1 방식(한 번만)으로 되돌릴 수 있다');
  // 1주씩 네 번(앞 주를 확정 이력으로 넣어 가며) 돌려도 같은 결과다
  const history = [];
  for (let i = 0; i < 4; i++) {
    const week = ad.formatDay(ad.addDays(WEEK, i * 7));
    const one = ad.generateDraft({ startDate: week, weekCount: 1, rules: sajuOnly, counselors, history });
    assert.equal(picked(one).length, 1);
    history.push({ start: week, group: '그린', channel: '전화', banner: '사주', nickname: '사주인', status: '확정' });
  }
  const main = ad.defaultRules().filter((r) => r.group === '그린' && r.channel === '전화' && r.banner === '메인').map((r) => ({ ...r, capacity: 1 }));
  const rotate = ad.generateDraft({ startDate: WEEK, weekCount: 4, rules: main, counselors: [person('육', { stage: 6 }), person('오', { stage: 5 }), person('사', { stage: 4 })] });
  assert.deepEqual(picked(rotate).map((r) => `${r.week.slice(5)} ${r.nickname}`), ['11-30 육', '12-07 오', '12-14 사']);
  assert.equal(rotate.summary.emptySlots, 1, '4주차는 남은 후보가 없어 빈 자리');
});

test('정산 정리: 타사이동·누락·다른 그룹은 사유와 함께 빼고, 같은 닉네임이 둘이면 선정에서 뺀다', () => {
  const raw = (nickname, over = {}) => ({ sourceRow: 2, service: BOTH, category: '타로', group: '그린', stage: '3단계', manager: '가상담당', nickname, seconds: '1,200', memo: '', ...over });
  const { counselors, excluded, duplicates } = ad.normalizeSettlement([
    raw('정상'), raw('이동', { memo: '타사이동' }), raw('', {}), raw('분야없음', { category: '' }), raw('옐로', { group: '옐로' }), raw('쌍둥이'), raw('쌍둥이', { group: '퍼플 파트너' }),
  ]);
  assert.deepEqual(counselors.map((c) => `${c.nickname}/${c.group}/${c.stage}/${c.seconds}`), ['정상/그린/3/1200', '쌍둥이/그린/3/1200', '쌍둥이/퍼플/3/1200']);
  assert.deepEqual(excluded.map((e) => e.reason), ['타사이동', '닉네임 없음', '카테고리 없음', '그린·퍼플이 아닌 그룹']);
  assert.deepEqual(duplicates, ['쌍둥이']);
  const draft = ad.generateDraft({ startDate: WEEK, weekCount: 1, counselors });
  assert.ok(!draft.rows.some((r) => r.nickname === '쌍둥이'));
  assert.deepEqual(draft.duplicates, ['쌍둥이']);
});

test('예외설정: 기간 안의 제외·연기는 후보에서 빠지고, 기간 밖이면 후보다', () => {
  const r = rule('그린', '채팅', '메인');
  const data = (exceptions) => ad.prepare({ counselors: [person('차')], exceptions });
  const run = (exceptions) => { const d = data(exceptions); return ad.evaluateCandidate(d.counselors[0], r, ad.toDay(WEEK), [], {}, {}, d.exceptions); };
  assert.equal(run([{ enabled: true, type: '제외', nickname: '차', start: '2026-11-01', end: '2026-12-31', reason: '휴식' }]).reason, '예외설정 제외: 휴식');
  assert.equal(run([{ enabled: true, type: '연기', nickname: '차', banner: '메인', reason: '요청' }]).reason, '예외설정 연기: 요청');
  assert.equal(run([{ enabled: true, type: '제외', nickname: '차', start: '2026-12-07', reason: '휴식' }]).ok, true);
  assert.equal(run([{ enabled: false, type: '제외', nickname: '차', reason: '꺼짐' }]).ok, true);
});

test('검수본 검증: 정원 초과, 같은 광고 중복, 같은 주 중복을 찾는다', () => {
  const row = (nickname, channel, banner, over = {}) => ({ week: WEEK, group: '그린', channel, banner, nickname, result: '선정', ...over });
  assert.deepEqual(ad.validateDraft([row('가', '전화', '사주'), row('가', '채팅', '사주'), row('나', '전화', '메인')]), []);
  assert.deepEqual(ad.validateDraft([row('가', '전화', '사주'), row('가', '채팅', '메인')]), ['같은 주 중복 배정: 2026-11-30|가']);
  assert.ok(ad.validateDraft([row('가', '전화', '메인'), row('가', '전화', '메인')]).some((p) => p.startsWith('같은 광고 중복 배정')));
  const sixteen = Array.from({ length: 16 }, (_, i) => row(`사람${i}`, '전화', '사주'));
  assert.deepEqual(ad.validateDraft(sixteen), ['정원 초과: 2026-11-30|그린|전화|사주 (정원 15)']);
  assert.deepEqual(ad.validateDraft([row('가', '전화', '메인', { result: '이월예정' }), row('가', '채팅', '메인', { result: '제외' })]), [], '선정 행만 본다');
});

test('추적 ID는 닉네임·그룹·채널·배너가 같으면 같다', () => {
  assert.match(ad.trackingId('가온', '그린', '전화', '메인'), /^ADV-[0-9A-F]{12}$/);
  assert.equal(ad.trackingId(' 가온 ', '그린 파트너', '전화상담', '메인배너'), ad.trackingId('가온', '그린', '전화', '메인'));
});

test('광고 기록 시트 읽기: 구역·주차·연도 넘김·예정 열·메모·바뀐 닉네임', () => {
  const grid = [
    [],
    ['', '', '12.21 ~ 12.27', '12.28 ~ 01.03', '01.04 ~ 01.10', '01.11 예정'],
    ['', '그린\n전화\n메인', '가온', '나래 > 다솜', '라온 (그린)', '마루'],
    ['', '그린\n전화\n메인', '바다', '사주,신점 없음', '', ''],
    ['', '', '12.21 ~ 12.27', '12.28 ~ 01.03', '01.04 ~ 01.10', ''],
    ['', '그린\n전화\n사주', '가온', '', '하늘', '미리적음'], // 새 주 머리말이 맨 위 구역에만 있어도 같은 열로 읽는다
    ['', '', '', '', '아라', ''],
    [],
  ];
  const { records, skipped, blocks } = ad.parseHistoryTab('그린 전화상담', grid, { today: '2027-01-05' });
  assert.deepEqual(blocks.map((b) => `${b.banner} ${b.firstRow}~${b.lastRow} ${b.columns.map((c) => c.column + c.start + (c.planned ? '예정' : '')).join(',')}`), [
    '메인 3~4 C2026-12-21,D2026-12-28,E2027-01-04,F2027-01-11예정', '사주 6~7 C2026-12-21,D2026-12-28,E2027-01-04,F2027-01-11예정']);
  assert.deepEqual(records.map((r) => `${r.start} ${r.banner} ${r.nickname} ${r.status}`), [
    '2026-12-21 메인 가온 확정', '2026-12-21 메인 바다 확정', '2026-12-28 메인 다솜 확정', '2027-01-04 메인 라온 확정', '2027-01-11 메인 마루 예정',
    '2026-12-21 사주 가온 확정', '2027-01-04 사주 하늘 확정', '2027-01-04 사주 아라 확정', '2027-01-11 사주 미리적음 예정']);
  assert.equal(records[2].position, '그린 전화상담!D3');
  assert.deepEqual(skipped, [{ position: '그린 전화상담!D4', original: '사주,신점 없음' }]);
  assert.deepEqual(ad.parseHistoryTab('대면상담 배너', grid).records, [], '광고 탭이 아니면 읽지 않는다');
  // 예정 열은 주기 계산에 넣지 않는다
  const data = ad.prepare({ counselors: [person('마루')], history: records });
  assert.ok(!data.history.some((h) => h.nickname === '마루'));
});

test('규칙 파일: 정렬 순서·정원·반복 배정을 바꿀 수 있고, 잘못 적으면 알려 준다', () => {
  const key = { group: '퍼플', channel: '전화', banner: '메인' };
  const base = {
    startDate: WEEK, weekCount: 1, counselors: [person('여덟주', { group: '퍼플' }), person('여섯주', { group: '퍼플' })],
    wishes: [{ id: 'W2', registeredAt: '2026-11-20', nickname: '여섯주', ...key, status: '대기' }],
    history: [{ start: '2026-10-05', ...key, nickname: '여덟주', status: '확정' }, { start: '2026-10-19', ...key, nickname: '여섯주', status: '확정' }],
  };
  const main = (d) => picked(d, (r) => r.channel === '전화' && r.banner === '메인').map((r) => r.nickname);
  assert.deepEqual(main(ad.generateDraft(base)), ['여섯주', '여덟주']);
  assert.deepEqual(main(ad.generateDraft({ ...base, policy: { sortOrder: ['fixed', 'carry', 'longWait', 'wish', 'mainStage', 'elapsed'] } })), ['여덟주', '여섯주'], '장기 대기를 희망보다 먼저');
  const rules = ad.defaultRules().map((r) => (r.group === '퍼플' && r.channel === '전화' && r.banner === '메인' ? { ...r, capacity: 1 } : r));
  assert.deepEqual(main(ad.generateDraft({ ...base, policy: { rules } })), ['여섯주'], '정원 1');
  const saju = { startDate: WEEK, weekCount: 4, counselors: [person('사주인', { stage: 0, category: '사주', service: '전화상담(1)' })] };
  assert.equal(picked(ad.generateDraft(saju)).length, 4, '0주 배너는 매주');
  assert.equal(picked(ad.generateDraft({ ...saju, policy: { oncePerBatch: true } })).length, 1);
  assert.throws(() => ad.resolvePolicy({ sortOrder: ['wish', 'luck'] }), /sortOrder/);
  assert.throws(() => ad.resolvePolicy({ capacity: 3 }), /모르는 항목/);
  assert.throws(() => ad.resolvePolicy({ rules: [...ad.defaultRules(), ad.defaultRules()[0]] }), /두 번/);
});

test('지시문 읽기: 시작 주차·1주/4주·초안 ID를 AI 없이 읽고, 절차 설명의 다른 글자는 보지 않는다', () => {
  const opt = { today: '2026-11-27' };
  assert.deepEqual(ad.parseRequest('2026년 11월 30일 시작 4주 광고 선정 초안을 만들어줘', opt).startDate, '2026-11-30');
  assert.equal(ad.parseRequest('2026년 11월 30일 시작 4주 광고 선정 초안을 만들어줘', opt).weekCount, 4);
  assert.deepEqual([ad.parseRequest('12월 9일부터 1주만 광고 선정 초안', opt).startDate, ad.parseRequest('12월 9일부터 1주만 광고 선정 초안', opt).weekCount], ['2026-12-07', 1]);
  assert.equal(ad.parseRequest('1월 4일 주부터 광고 선정', opt).startDate, '2027-01-04', '연도가 없으면 다가오는 날짜');
  assert.deepEqual([ad.parseRequest('다음 4주 광고 선정 초안을 만들어줘', opt).startDate, ad.parseRequest('광고 선정 초안 만들어줘', opt).weekCount], [null, null]);
  const confirm = ad.parseRequest('검수본 ad-20261207-4w-63173b 의 2주차만 최종 확정해줘', opt);
  assert.deepEqual([confirm.draftId, confirm.weekOrdinals, confirm.weekCount], ['AD-20261207-4W-63173B', [2], null]);
  const brief = '- draft: 도구가 [[지시]]다음 주부터 1주만 초안 만들어줘[[/지시]] 를 읽는다. 기본은 4주이고 2026-01-05 같은 날짜를 쓴다.';
  assert.deepEqual([ad.parseRequest(brief, opt).weekCount, ad.parseRequest(brief, opt).startDate], [1, null]);
});

test('반복 배정에서 희망 우선권은 한 번만 쓰이고, 이미 선정된 사람은 이월예정으로 다시 나오지 않는다', () => {
  const key = { group: '그린', channel: '채팅', banner: '신점' };
  const rules = ad.defaultRules().filter((r) => r.group === '그린' && r.channel === '채팅' && r.banner === '신점').map((r) => ({ ...r, capacity: 1 }));
  const counselors = ['희망', '가', '나', '다'].map((n) => person(n, { category: '신점' }));
  const draft = ad.generateDraft({ startDate: WEEK, weekCount: 4, policy: { rules }, counselors, wishes: [{ id: 'W1', registeredAt: '2026-11-20', nickname: '희망', ...key, status: '대기' }] });
  assert.equal(picked(draft)[0].nickname, '희망');
  assert.equal(picked(draft).filter((r) => r.wishId).length, 1, '희망 표시는 처음 선정된 주에만');
  assert.equal(new Set(picked(draft).map((r) => r.nickname)).size, 4, '우선권을 쓴 뒤에는 다른 사람과 같은 줄에 선다');
  assert.deepEqual(draft.rows.filter((r) => r.result !== '선정'), []);
});

test('뒤 주에 미리 적힌 사람은 그 주기 안의 앞 주에 자동 배정하지 않고, 미리 적힌 자리가 정원보다 많으면 알린다', () => {
  const rules = ad.defaultRules().filter((r) => r.group === '그린' && r.channel === '전화' && r.banner === '메인').map((r) => ({ ...r, capacity: 1 }));
  const pre = (nickname) => ({ week: '2026-12-07', group: '그린', channel: '전화', banner: '메인', nickname, source: '시트' });
  const draft = ad.generateDraft({ startDate: WEEK, weekCount: 4, policy: { rules }, counselors: [person('예약자', { stage: 6 }), person('다른이', { stage: 3 })], preassigned: [pre('예약자')] });
  assert.deepEqual(picked(draft).map((r) => `${r.week.slice(5)} ${r.nickname}`), ['11-30 다른이', '12-07 예약자']);
  assert.deepEqual(draft.warnings, []);
  const over = ad.generateDraft({ startDate: WEEK, weekCount: 1, policy: { rules }, counselors: [person('갑'), person('을')], preassigned: [{ ...pre('갑'), week: WEEK }, { ...pre('을'), week: WEEK }] });
  assert.match(over.warnings.join('\n'), /정원보다 많습니다/);
  assert.ok(ad.validateDraft(over.rows, { rules }).some((p) => p.startsWith('정원 초과')));
});

test('규칙·예외 파일을 줄여 적어도 조용히 빠지지 않는다', () => {
  assert.equal(ad.resolvePolicy({ serviceTokens: { 전화: '전화상담(1)' } }).serviceTokens.채팅, '채팅상담(1)');
  const slim = ad.defaultRules().map(({ enabled, order, ...rest }) => rest);
  assert.equal(ad.prepare({ policy: { rules: slim } }).rules.length, 16, 'enabled·order를 빼면 사용·적은 순서');
  assert.throws(() => ad.resolvePolicy({ rules: slim.map(({ capacity, ...rest }) => rest) }), /capacity/);
  const data = ad.prepare({ counselors: [person('차')], exceptions: [{ type: '제외', nickname: '차', reason: '휴식' }], carryovers: [{ nickname: '차', group: '그린', channel: '전화', banner: '메인', start: '2026-11-16' }] });
  assert.equal(data.exceptions.length, 1);
  assert.equal(Object.keys(data.carryoverMap).length, 1);
  for (const [text, want] of [['1주차 11.30 ~ 12.06', false], ['12.07 ~ 12.13 예정', true], ['12.07(예정)', true], ['11.30~12.06', false]]) assert.equal(ad.weekLabel(text)?.planned, want, text);
  assert.equal(ad.weekLabel('가온'), null);
});

test('사람별 주기: 그 사람만 최소 주기가 짧아지고 다른 사람과 정원·중복 규칙은 그대로다', () => {
  const key = { group: '퍼플', channel: '전화', banner: '메인' };
  const rules = ad.defaultRules().filter((r) => r.group === '퍼플' && r.channel === '전화' && r.banner === '메인');
  const history = ['빠른이', '보통이'].map((n) => ({ start: '2026-11-09', ...key, nickname: n, status: '확정' }));
  const base = { startDate: WEEK, weekCount: 4, policy: { rules }, counselors: [person('빠른이', { group: '퍼플' }), person('보통이', { group: '퍼플' })], history };
  assert.deepEqual(picked(ad.generateDraft(base)).map((r) => `${r.week.slice(5)} ${r.nickname}`), ['12-21 보통이', '12-21 빠른이'], '둘 다 6주 뒤');
  const fast = ad.generateDraft({ ...base, exceptions: [{ type: '주기', nickname: '빠른이', weeks: 2 }] });
  assert.deepEqual(picked(fast).map((r) => `${r.week.slice(5)} ${r.nickname}`), ['11-30 빠른이', '12-14 빠른이', '12-21 보통이']);
  assert.match(picked(fast)[0].description, /개별 주기 2주/);
  const limited = ad.generateDraft({ ...base, exceptions: [{ type: '주기', nickname: '빠른이', weeks: 2, banner: '타로' }] });
  assert.equal(picked(limited).filter((r) => r.nickname === '빠른이').length, 1, '다른 배너에 건 주기는 메인에 영향이 없다');
});

test('미리 적힌 이름이 자격에 안 맞으면 빼고 알리고, 운영자가 지정한 자리는 넣고 알린다', () => {
  const rules = ad.defaultRules().filter((r) => r.group === '퍼플' && r.channel === '전화' && r.banner === '타로');
  const pre = (over) => ({ week: WEEK, group: '퍼플', channel: '전화', banner: '타로', nickname: '영단계', source: '시트', ...over });
  const counselors = [person('영단계', { group: '퍼플', stage: 0 }), person('파트너', { group: '퍼플', stage: 2 })];
  const sheet = ad.generateDraft({ startDate: WEEK, weekCount: 1, policy: { rules }, counselors, preassigned: [pre()] });
  assert.deepEqual(picked(sheet).map((r) => r.nickname), ['파트너']);
  assert.match(sheet.warnings[0], /영단계.*파트너 전용 배너.*뺐습니다/);
  assert.equal(sheet.dropped[0].nickname, '영단계');
  const forced = ad.generateDraft({ startDate: WEEK, weekCount: 1, policy: { rules }, counselors, preassigned: [pre({ force: true })] });
  assert.deepEqual(picked(forced).map((r) => r.nickname), ['영단계', '파트너']);
  assert.match(forced.warnings[0], /확인 필요/);
  const keep = ad.generateDraft({ startDate: WEEK, weekCount: 1, policy: { rules, dropIneligiblePreassigned: false }, counselors, preassigned: [pre()] });
  assert.equal(picked(keep).length, 2, '규칙을 끄면 그대로 둔다');
});

test('활동 상태: 승인완료 아이템이 없는 상담사는 빼고, 같은 닉네임의 옛 줄은 가려낸다', () => {
  const row = (nickname, group, stage, seconds, sourceRow) => ({ ...person(nickname, { group, stage, seconds }), sourceRow });
  const out = ad.applyActiveStatus([
    row('단독', '그린', 1, 0, 2), row('그만둔이', '그린', 0, 500, 3),
    row('단계다름', '그린', 2, 100, 4), row('단계다름', '퍼플', 2, 0, 5),
    row('단계같음', '퍼플', 0, 7200, 6), row('단계같음', '퍼플', 0, 0, 7),
    row('못가림', '그린', 0, 0, 8), row('못가림', '그린', 0, 0, 9),
  ], [{ nickname: '단독', stage: '그린 1단계' }, { nickname: '단계다름', stage: '그린 2단계' }, { nickname: '단계같음', stage: '퍼플 0단계' }, { nickname: '못가림', stage: '그린 0단계' }]);
  assert.deepEqual(out.counselors.map((c) => c.sourceRow), [2, 4, 6, 8, 9]);
  assert.deepEqual(out.inactive.map((c) => c.nickname), ['그만둔이']);
  assert.deepEqual(out.resolved.map((r) => `${r.nickname}:${r.keptRow}`), ['단계다름:4', '단계같음:6']);
  assert.deepEqual(out.unresolved, ['못가림']);
});

test('조정 명령: 넣기·빼기·우선·주기·희망·취소가 파일에 쌓이고 잘못 적으면 알려 준다', async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const vault = mkdtempSync(join(tmpdir(), 'ad-adjust-'));
  const run = (...a) => spawnSync(process.execPath, [require.resolve('../shared/보관함/광고운영/도구/ad-adjust.cjs'), ...a, '--vault', vault], { encoding: 'utf8' });
  try {
    assert.match(run('넣기', '--name', '가온', '--channel', '전화', '--banner', '메인', '--week', '2026-12-09').stdout, /EX-001\s+넣기\s+가온\s+전화 메인\s+2026-12-07 주/);
    assert.equal(run('빼기', '--name', '나래', '--from', '2026-12-07', '--until', '2026-12-28', '--reason', '휴식').status, 0);
    assert.equal(run('우선', '--name', '다솜', '--channel', '채팅', '--banner', '타로').status, 0);
    assert.equal(run('주기', '--name', '라온', '--weeks', '2').status, 0);
    assert.equal(run('희망', '--name', '마루', '--channel', '전화', '--banner', '신점').status, 0);
    assert.match(run('주기', '--name', '라온').stderr, /--weeks/);
    assert.match(run('넣기', '--name', '가온', '--channel', '문자', '--banner', '메인', '--week', '2026-12-07').stderr, /전화\|채팅/);
    assert.match(run('넣기', '--name', '가온', '--channel', '전화', '--banner', '메인', '--week', '2026-12-07').stderr, /이미 넣기가 있습니다/);
    const list = run('목록').stdout;
    assert.match(list, /조정 4건/); assert.match(list, /주기 2주\s+라온\s+모든 배너/); assert.match(list, /광고 희망\(대기\) 1건/);
    const saved = JSON.parse(readFileSync(join(vault, '예외.json'), 'utf8'));
    assert.deepEqual(saved.map((e) => e.type), ['지정', '제외', '고정', '주기']);
    assert.equal(ad.prepare({ counselors: [person('나래')], exceptions: saved }).exceptions.length, 4);
    assert.match(run('취소', '--id', 'ex-002').stdout, /없앴습니다/);
    assert.equal(JSON.parse(readFileSync(join(vault, '예외.json'), 'utf8')).length, 3);
    assert.match(run('취소', '--id', 'EX-099').stderr, /없습니다/);
  } finally { rmSync(vault, { recursive: true, force: true }); }
});

test('확정: AI 오피스 안의 확정 기록에만 남기고, 같은 초안은 다시 쓰지 않으며, 다른 초안이 있으면 "다시 확정"일 때만 바꾼다', async () => {
  const { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = mkdtempSync(join(tmpdir(), 'ad-apply-'));
  const tools = join(root, '보관함', '광고운영', '도구');
  try {
    cpSync(dirname(require.resolve('../shared/보관함/광고운영/도구/ad-lib.cjs')), tools, { recursive: true });
    writeFileSync(join(tools, '설정.json'), JSON.stringify({ sheet: 'https://docs.google.com/spreadsheets/d/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/edit' }));
    const make = (id, names) => {
      const draft = ad.generateDraft({ startDate: WEEK, weekCount: 4, counselors: names.map((n) => person(n)) });
      const file = join(root, `${id}-광고선정초안.json`);
      writeFileSync(file, JSON.stringify({ draftId: id, version: 1, weeks: ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21'], rows: draft.rows, policy: ad.defaultPolicy() }));
      return { file, rows: draft.rows.filter((r) => r.result === '선정') };
    };
    const one = make('AD-20261130-4W-AAAAAA', ['가온', '나래']), two = make('AD-20261130-4W-BBBBBB', ['다솜']);
    const run = (...a) => spawnSync(process.execPath, [join(tools, 'ad-apply.cjs'), ...a], { encoding: 'utf8', cwd: root });
    const ledger = () => JSON.parse(readFileSync(join(root, '보관함', '광고운영', '확정기록.json'), 'utf8'));
    assert.match(run('--draft', one.file, '--confirm', 'AD-20261130-4W-XXXXXX').stderr, /초안 ID가 맞지 않습니다/);
    assert.equal(existsSync(join(root, '보관함', '광고운영', '확정기록.json')), false);
    const first = run('--draft', one.file, '--confirm', 'AD-20261130-4W-AAAAAA', '--weeks', '2026-11-30', '--out', join(root, 'out'));
    assert.match(first.stdout, /확정 완료/); assert.match(first.stdout, /구글 시트에는 넣지 않았습니다/);
    assert.equal(ledger().length, one.rows.filter((r) => r.week === '2026-11-30').length);
    assert.equal(JSON.parse(readFileSync(join(root, 'out', '확정결과.json'), 'utf8')).ok, true);
    assert.match(run('--draft', one.file, '--confirm', 'AD-20261130-4W-AAAAAA', '--weeks', '2026-11-30').stdout, /이미 확정돼 있습니다/);
    assert.match(run('--draft', two.file, '--confirm', 'AD-20261130-4W-BBBBBB', '--weeks', '2026-11-30').stderr, /이미 확정된 다른 초안/);
    mkdirSync(join(root, 'task'), { recursive: true });
    writeFileSync(join(root, 'task', 'brief.md'), '- apply: [[지시]]초안 AD-20261130-4W-BBBBBB 1주차만 다시 확정해줘[[/지시]]');
    const again = run('--brief', join(root, 'task', 'brief.md'), '--find', root, '--out', join(root, 'out2'));
    assert.match(again.stdout, /바꾼 초안: AD-20261130-4W-AAAAAA/);
    assert.deepEqual([...new Set(ledger().map((r) => `${r.draftId} ${r.start} ${r.nickname}`))], two.rows.filter((r) => r.week === '2026-11-30').map((r) => `AD-20261130-4W-BBBBBB 2026-11-30 ${r.nickname}`));
    writeFileSync(join(root, 'task', 'brief.md'), '- apply: [[지시]]검토한 초안 최종 확정해줘[[/지시]]');
    assert.match(run('--brief', join(root, 'task', 'brief.md'), '--find', root).stderr, /초안 ID가 없어/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('두 번째 독립 검토 지적: 뺀 예정 자리·조정 기간·활동 줄 고르기·지시문 읽기', () => {
  // 뺀 미리 적힌 자리는 앞 주 배정을 막지 않는다
  const rules = ad.defaultRules().filter((r) => r.group === '그린' && r.channel === '전화' && ['메인', '타로'].includes(r.banner)).map((r) => ({ ...r, capacity: 2 }));
  const pre = (banner) => ({ week: '2026-12-21', group: '그린', channel: '전화', banner, nickname: '가', source: '시트' });
  const draft = ad.generateDraft({ startDate: '2026-12-07', weekCount: 4, policy: { rules }, counselors: ['가', '나', '다'].map((n) => person(n, { stage: 3 })), preassigned: [pre('메인'), pre('타로')] });
  assert.equal(draft.dropped.length, 1, '같은 주 두 배너 중 하나는 뺀다');
  const dropped = draft.dropped[0].banner, kept = dropped === '메인' ? '타로' : '메인';
  assert.ok(picked(draft, (r) => r.week === '2026-12-07' && r.banner === dropped).some((r) => r.nickname === '가'), '뺀 배너에서는 가가 앞 주 후보로 돌아온다');
  assert.ok(!picked(draft, (r) => r.banner === kept && r.week < '2026-12-21').some((r) => r.nickname === '가'), '남은 자리의 주기 안 앞 주에는 넣지 않는다');
  // 빼기 기간이 주 중간이어도 그 주에 적용된다
  const r = rule('그린', '채팅', '메인');
  const run = (exceptions) => { const d = ad.prepare({ counselors: [person('차')], exceptions }); return ad.evaluateCandidate(d.counselors[0], r, ad.toDay('2026-12-07'), [], {}, {}, d.exceptions); };
  assert.equal(run([{ type: '제외', nickname: '차', start: '2026-12-08', end: '2026-12-12', reason: '휴식' }]).ok, false);
  assert.equal(run([{ type: '제외', nickname: '차', start: '2026-12-14', reason: '휴식' }]).ok, true);
  assert.equal(run([{ type: '제외', nickname: '차', end: '2026-12-06', reason: '휴식' }]).ok, true);
  // 단계가 바뀐 뒤에도 활동 중인 그룹의 줄을 고른다
  const row = (group, stage, seconds, sourceRow) => ({ ...person('가', { group, stage, seconds }), sourceRow });
  assert.deepEqual(ad.applyActiveStatus([row('그린', 2, 0, 1), row('퍼플', 3, 9000, 2)], [{ nickname: '가', stage: '그린 3단계' }]).counselors.map((c) => c.sourceRow), [1]);
  assert.deepEqual(ad.applyActiveStatus([row('그린', 2, 5000, 1), row('퍼플', 1, 3000, 2)], [{ nickname: '가', stage: '그린 3단계' }]).unresolved, []);
  // 지시문: 주기·날짜 속 숫자는 범위가 아니고, 주차 여러 개와 지원하지 않는 범위를 읽는다
  const opt = { today: '2026-11-27' };
  assert.equal(ad.parseRequest('가온 주기 4주로 바꾸고 다음 주 초안 만들어줘', opt).weekCount, null);
  assert.equal(ad.parseRequest('4주 뒤부터 1주만 초안', opt).weekCount, 1);
  assert.deepEqual([ad.parseRequest('1/4 주부터 초안', opt).weekCount, ad.parseRequest('1/4 주부터 초안', opt).startDate], [null, '2027-01-04']);
  assert.equal(ad.parseRequest('12-14 주부터 초안', opt).startDate, '2026-12-14');
  assert.equal(ad.parseRequest('다음 4주 광고 선정 초안', opt).weekCount, 4);
  assert.equal(ad.parseRequest('2주 초안 만들어줘', opt).unsupportedWeeks, 2);
  assert.deepEqual(ad.parseRequest('초안 AD-20261207-4W-63173B 1, 2주차 확정', opt).weekOrdinals, [1, 2]);
  assert.deepEqual(ad.parseRequest('초안 AD-20261207-4W-63173B 1~3주차 확정', opt).weekOrdinals, [1, 2, 3]);
  assert.deepEqual(ad.parseRequest('12주차 정산 이야기', opt).weekOrdinals, []);
});
