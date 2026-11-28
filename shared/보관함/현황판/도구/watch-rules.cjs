// 상담사 규정 점검 규칙: 후기·1:1 문의 글에서 개인 연락·SNS 거래, 외부 거래 유도, 욕설·비방 표현을 찾는다.
// 사람이 다시 볼 후보를 고르는 용도다(걸렸다고 위반이 확정된 것은 아니다). AI를 쓰지 않는다.
// 기준은 보관함/현황판/점검규칙.json으로 바꾼다:
//   {"days":2, "keepDays":14, "categories":[{"name":"…","words":["…"],"patterns":["정규식"]}], "ignore":["걸려도 넘길 표현"]}
//   categories를 적으면 기본 분류를 통째로 바꾸고, "addWords":{"분류 이름":["단어"]}는 기본 분류에 단어만 더한다.
'use strict';

function defaultRules() {
  return {
    days: 2,       // 확인할 날 수(어제·오늘)
    keepDays: 14,  // 걸린 글을 현황판에 남겨 두는 날 수
    categories: [
      { name: '개인 연락·SNS',
        words: ['카톡', '카카오톡', '오픈채팅', '오픈톡', '오픈카톡', '인스타', '텔레그램', '디엠', '페이스북', '페북', '트위터', '틱톡', '개인번호', '개인연락', '개인적으로연락', '따로연락', '연락처', '전화번호', '핸드폰번호', '폰번호', '휴대폰번호', '메일주소', '이메일', '블로그주소', '유튜브채널'],
        patterns: ['01[016789][-.\\s]?\\d{3,4}[-.\\s]?\\d{4}', '(?:^|[^a-z])(?:kakao|kakaotalk|insta|instagram|telegram|line\\s*id|dm)(?:$|[^a-z])', '@[a-z0-9_.]{4,}', 'https?://', '(?:아이디|id)\\s*[:：는은]?\\s*[a-z0-9_.]{5,}'] },
      { name: '외부 거래',
        words: ['직거래', '계좌', '입금', '송금', '이체', '현금으로', '따로결제', '개인결제', '밖에서상담', '개인상담', '개인적으로상담', '다른어플', '다른앱', '다른사이트', '타사이트', '다른플랫폼', '타플랫폼', '사무실로오', '신당으로오', '직접찾아오'],
        patterns: [] },
      { name: '욕설·비방',
        words: ['씨발', '시발', '씨바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '개새', '새끼', '좆', '존나', 'ㅈㄴ', '지랄', 'ㅈㄹ', '미친놈', '미친년', '또라이', '꺼져', '닥쳐', '쓰레기', '사기꾼', '돌팔이', '엿먹'],
        patterns: [] },
    ],
    ignore: ['시발점', '계좌이체가능', '입금확인'],
  };
}

function resolveRules(file) {
  const base = defaultRules();
  if (!file || typeof file !== 'object') return base;
  const days = Number.isInteger(file.days) && file.days >= 1 && file.days <= 14 ? file.days : base.days;
  const keepDays = Number.isInteger(file.keepDays) && file.keepDays >= 1 && file.keepDays <= 90 ? file.keepDays : base.keepDays;
  let categories = base.categories;
  if (Array.isArray(file.categories) && file.categories.length) {
    categories = file.categories.map((c, i) => {
      if (!c || typeof c.name !== 'string' || !c.name.trim()) throw new Error(`categories[${i}].name 이 없습니다.`);
      const words = Array.isArray(c.words) ? c.words.filter((w) => typeof w === 'string' && w.trim()) : [];
      const patterns = Array.isArray(c.patterns) ? c.patterns.filter((p) => typeof p === 'string' && p) : [];
      for (const p of patterns) { try { new RegExp(p, 'i'); } catch { throw new Error(`categories[${i}].patterns 의 정규식을 읽지 못했습니다: ${p}`); } }
      if (!words.length && !patterns.length) throw new Error(`categories[${i}] 에 words나 patterns가 하나는 있어야 합니다.`);
      return { name: c.name.trim(), words, patterns };
    });
  }
  if (file.addWords && typeof file.addWords === 'object') {
    categories = categories.map((c) => ({ ...c, words: [...new Set([...c.words, ...(Array.isArray(file.addWords[c.name]) ? file.addWords[c.name].filter((w) => typeof w === 'string' && w.trim()) : [])])] }));
  }
  const ignore = Array.isArray(file.ignore) ? file.ignore.filter((w) => typeof w === 'string' && w.trim()) : base.ignore;
  return { days, keepDays, categories, ignore };
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 글자 사이를 띄워 쓴 것("카 톡")도 잡도록 글자 사이의 공백을 허용한다
const wordRegex = (word) => new RegExp([...word.replace(/\s+/g, '')].map(escape).join('\\s*'), 'gi');

// 글 하나에서 걸린 표현: [{category, word, snippet}] (분류마다 처음 걸린 것 하나)
function checkText(text, rules) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  // 넘길 표현은 같은 길이의 빈칸으로 가려 놓고 찾는다(자리 번호가 어긋나지 않게)
  let masked = raw;
  for (const skip of rules.ignore || []) masked = masked.replace(wordRegex(skip), (m) => ' '.repeat(m.length));
  const hits = [];
  for (const category of rules.categories) {
    let found = null;
    for (const word of category.words) {
      const m = wordRegex(word).exec(masked);
      if (m && (!found || m.index < found.index)) found = { index: m.index, length: m[0].length, word };
    }
    for (const pattern of category.patterns) {
      const m = new RegExp(pattern, 'i').exec(masked);
      if (m && (!found || m.index < found.index)) found = { index: m.index, length: m[0].length, word: m[0].trim().slice(0, 20) };
    }
    if (!found) continue;
    const from = Math.max(0, found.index - 25), to = Math.min(raw.length, found.index + found.length + 25);
    hits.push({ category: category.name, word: found.word, snippet: `${from > 0 ? '…' : ''}${raw.slice(from, to)}${to < raw.length ? '…' : ''}` });
  }
  return hits;
}

module.exports = { defaultRules, resolveRules, checkText };
