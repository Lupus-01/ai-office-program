// 상담사 순위 뽑기: 수집 원본으로 상담사코드(CE)별 순위를 만들고, 영상 대본에 쓸 기본 정보와 짧은 최근 후기 후보를 보여 준다.
// 사용: node top.cjs [--by 7일후기|평점|전체후기] [--top 10] [--json <저장 파일>]
//   기준 기본값은 최근 7일 후기 수(같으면 전체 후기 수). 없어진 프로필은 뺀다.
//   후기 후보는 ★5·15~70자 글을 최신순으로 최대 6개 보여 줄 뿐이다. 개인 사정(건강·가족·실명·연락처)이 드러나는 글은 대본에 쓰지 않는다.
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
const rows = [...groups.entries()].map(([ce, list]) => {
  list.sort((a, b) => (a.flag === 'call' ? -1 : 1) - (b.flag === 'call' ? -1 : 1));
  const main = list[0];
  const reviews = list.flatMap((p) => (p.reviews7d || []).map((r) => ({ ...r, code: p.code })));
  const quotes = reviews.filter((r) => r.point === 5 && !r.pinned && r.content && r.content.length >= 15 && r.content.length <= 70 && !/가림\]/.test(r.content))
    .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6)
    .map((r) => ({ date: String(r.date).slice(0, 10), field: r.field, text: r.content.replace(/\s+/g, ' ') }));
  const top3 = (xs) => (xs || []).slice().sort((a, b) => (b.cnt || 0) - (a.cnt || 0)).slice(0, 3).map((x) => x.name);
  return {
    ceCode: ce, nick: main.nick, code: main.code, codes: list.map((p) => p.code), kinds: list.map((p) => (p.flag === 'chat' ? '채팅' : '전화')),
    reviews7d: reviews.length, rating: main.rating, reviewsTotal: main.reviewCountLd ?? main.tabs?.reviews ?? null, recent3m: main.recent3m?.reviews ?? null,
    satisfaction: main.satisfaction, field: (main.knowsAbout || []).slice(0, 4), keywords: (main.stats?.keywords || []).slice(0, 5),
    topFields: top3(main.stats?.fields), topStyles: top3(main.stats?.styles), hasPhoto: !!main.image, url: main.url,
    collectedAt: main.collectedAt, quotes,
  };
});
const key = { '7일후기': (r) => [r.reviews7d, r.reviewsTotal || 0], 평점: (r) => [r.rating || 0, r.reviews7d], 전체후기: (r) => [r.reviewsTotal || 0, r.reviews7d] }[BY];
if (!key) throw new Error('--by는 7일후기·평점·전체후기 중 하나입니다');
rows.sort((a, b) => { const x = key(a), y = key(b); return y[0] - x[0] || y[1] - x[1]; });
const top = rows.slice(0, TOP).map((r, i) => ({ rank: i + 1, ...r }));
const collected = top.map((r) => r.collectedAt).filter(Boolean).sort()[0];
console.log(`기준: ${BY} 많은 순 · 상담사 ${rows.length}명 중 상위 ${top.length}명 · 수집 기준 ${collected ? kst(new Date(collected)) : '미상'}`);
for (const r of top) {
  console.log(`${r.rank}. ${r.nick} (${r.code}, ${r.kinds.join('+')}) 최근7일 후기 ${r.reviews7d} · 평점 ${r.rating ?? '-'} · 전체 후기 ${r.reviewsTotal ?? '-'} · 분야 ${r.field.join('/')} · 키워드 ${r.keywords.join(',')} · 사진 ${r.hasPhoto ? '있음' : '없음'} · 후기 후보 ${r.quotes.length}개`);
}
if (OUT) { fs.writeFileSync(path.resolve(OUT), `${JSON.stringify({ by: BY, collectedAt: collected, top }, null, 1)}\n`); console.log(`저장: ${path.resolve(OUT)}`); }
