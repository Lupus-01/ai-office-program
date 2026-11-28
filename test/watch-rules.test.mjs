import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { defaultRules, resolveRules, checkText } = require('../shared/보관함/현황판/도구/watch-rules.cjs');

test('규정 점검: 개인 연락·SNS, 외부 거래, 욕설 표현을 분류별로 잡고 앞뒤 글 조각을 남긴다', () => {
  const rules = defaultRules();
  const sns = checkText('상담 감사합니다. 다음에는 카 톡으로 따로 물어봐도 될까요?', rules);
  assert.deepEqual(sns.map((h) => [h.category, h.word]), [['개인 연락·SNS', '카톡']]);
  assert.match(sns[0].snippet, /카 톡으로/);
  assert.deepEqual(checkText('010-1234-5678 로 주세요', rules).map((h) => h.category), ['개인 연락·SNS']);
  assert.deepEqual(checkText('insta 아이디 알려주세요', rules).map((h) => h.category), ['개인 연락·SNS']);
  assert.deepEqual(checkText('계좌로 입금하면 싸게 해 준대요', rules).map((h) => h.category), ['외부 거래']);
  assert.deepEqual(checkText('진짜 돌팔이네요', rules).map((h) => h.category), ['욕설·비방']);
  // 한 글에 여러 분류가 걸리면 분류마다 하나씩
  assert.deepEqual(checkText('사기꾼아 카톡 내놔', rules).map((h) => h.category), ['개인 연락·SNS', '욕설·비방']);
  // 걸릴 것이 없으면 빈 목록
  assert.deepEqual(checkText('덕분에 마음이 편해졌어요. 또 상담할게요!', rules), []);
  assert.deepEqual(checkText('', rules), []);
  // 넘길 표현은 잡지 않는다
  assert.deepEqual(checkText('여기가 새 출발의 시발점이네요', rules), []);
  // 영어 단어 속의 글자는 잡지 않는다("random"의 dm)
  assert.deepEqual(checkText('random 하게 뽑아 주셨어요', rules), []);
});

test('규정 점검 기준은 점검규칙.json으로 바꾼다: 단어 추가, 분류 교체, 기간. 잘못된 정규식은 거부한다', () => {
  const added = resolveRules({ addWords: { '외부 거래': ['문화상품권'] }, days: 1, keepDays: 7, ignore: [] });
  assert.equal(added.days, 1); assert.equal(added.keepDays, 7);
  assert.deepEqual(checkText('문화상품권으로 주시면', added).map((h) => h.category), ['외부 거래']);
  assert.deepEqual(checkText('시발점', added).map((h) => h.category), ['욕설·비방']); // ignore를 비웠다
  const replaced = resolveRules({ categories: [{ name: '금지어', words: ['환불'], patterns: ['\\d{6}-\\d{7}'] }] });
  assert.deepEqual(checkText('환불해 주세요', replaced).map((h) => h.category), ['금지어']);
  assert.deepEqual(checkText('카톡 주세요', replaced), []);
  assert.deepEqual(checkText('900101-1234567', replaced).map((h) => h.category), ['금지어']);
  assert.throws(() => resolveRules({ categories: [{ name: '가', patterns: ['('] }] }), /정규식/);
  assert.throws(() => resolveRules({ categories: [{ name: '가' }] }), /하나는/);
  // 범위를 벗어난 값은 기본값
  assert.equal(resolveRules({ days: 99 }).days, 2);
  assert.equal(resolveRules(null).categories.length, 3);
});
