// 상담사 순위 뽑기: 수집 원본으로 상담사코드(CE)별 순위를 만들고, 영상 대본에 쓸 기본 정보와 짧은 최근 후기 후보를 보여 준다.
// 사용: node top.cjs [--by 7일후기|평점|전체후기] [--top 10] [--json <저장 파일>]
//   기준 기본값은 최근 7일 후기 수(같으면 전체 후기 수). 없어진 프로필은 뺀다.
//   후기 후보는 ★5 중 내용이 구체적인 글을 점수순으로 최대 8개(인사만 있는 글·민감한 사정·가림 표시 제외). 대본에 쓰기 전 사람이 다시 확인한다.
//   상담사마다 대표 상담분야·상담스타일·최근 후기 분야·서비스 소개 첫 줄·공지·약력도 함께 준다(대본 재료).
'use strict';
const { fs, path, RAW, readJson, kst } = require('./lib.cjs');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const BY = arg('--by', '7일후기');
const TOP = Number(arg('--top', 10));
const OUT = arg('--json', null);

const groups = new Map();
for (const f of fs.readdirSync(RAW).filter((x) => x.endsWith('.json'))) {
  const p = readJson(path.join(RAW, f), null);
  if (!p || p.gone) continue;
  const key = p.ceCode || p.code;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(p);
}
// 영상 대본 재료(2026-11-17 대표: 내용에 더 신경): 인사만 있는 후기보다 상담 내용·느낌이 구체적인 후기를 먼저 고른다.
// 건강·임신·사망·폭력·빚 같은 민감한 사정이나 가림 표시가 있는 후기는 후보에서 뺀다
const SENSITIVE = /병원|수술|암\b|투병|임신|유산|낙태|사망|돌아가|장례|자살|죽고|폭력|폭행|우울증|공황|빚|대출|파산|이혼소송|소송|경찰|\[.*가림\]/;
const GENERIC = /^(감사합니다|감사해요|고맙습니다|최고|좋아요|굿|짱|감사)[.!~♡♥ ]*$/;
const SPECIFIC = /재회|연락|속마음|마음|위로|정확|적중|편안|따뜻|다정|친절|공감|명쾌|시원|조언|방향|힘이|용기|든든|신기|소름|맞|풀렸|정리|고민|답답|희망|기다|인연|궁합|취업|합격|사업|이사|타로|카드|사주/;
function scoreReview(r) {
  const t = r.content.replace(/\s+/g, ' ').trim();
  let s = 0;
  if (t.length >= 25 && t.length <= 90) s += 3; else if (t.length >= 15 && t.length <= 130) s += 1;
  s += Math.min(3, (t.match(new RegExp(SPECIFIC.source, 'g')) || []).length);
  if (r.best === 'Y') s += 2;
  if ((r.help || 0) > 0) s += 1;
  if (/(.)\1{3,}/.test(t) || /(선생님\s*){3,}|(감사합니다\s*){2,}/.test(t)) s -= 3; // 같은 말 되풀이
  return s;
}
const firstLines = (text, n = 2) => String(text || '').split('\n').map((l) => l.trim()).filter((l) => l && !/^(서비스 소개|상담사 공지|상담사 약력)/.test(l)).slice(0, n).join(' / ').slice(0, 120);
const rows = [...groups.entries()].map(([ce, list]) => {
  list.sort((a, b) => (a.flag === 'call' ? -1 : 1) - (b.flag === 'call' ? -1 : 1));
  const main = list[0];
  const reviews = list.flatMap((p) => (p.reviews7d || []).map((r) => ({ ...r, code: p.code })));
  const seen = new Set();
  const quotes = reviews.filter((r) => r.point === 5 && !r.pinned && r.content && r.content.length >= 12 && !SENSITIVE.test(r.content) && !GENERIC.test(r.content.trim()))
    .map((r) => ({ r, s: scoreReview(r) })).filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s || String(b.r.date).localeCompare(String(a.r.date)))
    .filter(({ r }) => { const k = r.content.replace(/\s+/g, '').slice(0, 18); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 8)
    .map(({ r, s }) => ({ date: String(r.date).slice(0, 10), field: r.field, style: r.style, best: r.best === 'Y', score: s, length: r.content.length, text: r.content.replace(/\s+/g, ' ').trim() }));
  const top3 = (xs) => (xs || []).slice().sort((a, b) => (b.cnt || 0) - (a.cnt || 0)).slice(0, 3).map((x) => x.name);
  const fieldsInReviews = Object.entries(reviews.reduce((m, r) => { for (const f of String(r.field || '').split(/,\s*/).filter(Boolean)) m[f] = (m[f] || 0) + 1; return m; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}(${v})`);
  return {
    ceCode: ce, nick: main.nick, code: main.code, codes: list.map((p) => p.code), kinds: list.map((p) => (p.flag === 'chat' ? '채팅' : '전화')),
    reviews7d: reviews.length, rating: main.rating, reviewsTotal: main.reviewCountLd ?? main.tabs?.reviews ?? null, recent3m: main.recent3m?.reviews ?? null,
    satisfaction: main.satisfaction, field: (main.knowsAbout || []).slice(0, 4), keywords: (main.stats?.keywords || []).slice(0, 5),
    topFields: top3(main.stats?.fields), topStyles: top3(main.stats?.styles), recentFields: fieldsInReviews,
    intro: firstLines(main.serviceIntro, 3), notice: firstLines(main.notice, 2), career: firstLines(main.sections?.['상담사 약력 + 리딩정보'], 2),
    hasPhoto: !!main.image, url: main.url, collectedAt: main.collectedAt, quotes,
  };
});
const key = { '7일후기': (r) => [r.reviews7d, r.reviewsTotal || 0], 평점: (r) => [r.rating || 0, r.reviews7d], 전체후기: (r) => [r.reviewsTotal || 0, r.reviews7d] }[BY];
if (!key) throw new Error('--by는 7일후기·평점·전체후기 중 하나입니다');
rows.sort((a, b) => { const x = key(a), y = key(b); return y[0] - x[0] || y[1] - x[1]; });
const top = rows.slice(0, TOP).map((r, i) => ({ rank: i + 1, ...r }));
const collected = top.map((r) => r.collectedAt).filter(Boolean).sort()[0];
console.log(`기준: ${BY} 많은 순 · 상담사 ${rows.length}명 중 상위 ${top.length}명 · 수집 기준 ${collected ? kst(new Date(collected)) : '미상'}`);
for (const r of top) {
  console.log(`${r.rank}. ${r.nick} (${r.code}, ${r.kinds.join('+')}) 최근7일 후기 ${r.reviews7d} · 상담분야 ${r.topFields.join('/')} · 스타일 ${r.topStyles.join('/')} · 키워드 ${r.keywords.join(',')} · 사진 ${r.hasPhoto ? '있음' : '없음'} · 구체적 후기 후보 ${r.quotes.length}개`);
}
if (OUT) { fs.writeFileSync(path.resolve(OUT), `${JSON.stringify({ by: BY, collectedAt: collected, top }, null, 1)}\n`); console.log(`저장: ${path.resolve(OUT)}`); }
