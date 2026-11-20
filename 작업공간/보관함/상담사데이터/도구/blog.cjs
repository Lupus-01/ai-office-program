// 블로그 소재 도구: 수집 원본으로 블로그 글 재료를 만들고, 쓴 초안을 검사한다(2026-11-20).
// 글은 "홍카페 운영팀이 쓴 공식 소개"다. 고객이 쓴 체험 후기처럼 꾸미지 않는다(표시광고법상 기만 광고). 숫자·후기 인용은 이 도구가 만든 재료에 있는 것만 쓴다.
//
// 사용: node blog.cjs pick [--category 타로|신점|사주] [--top 20]     소개 글을 쓰기 좋은 상담사 후보
//       node blog.cjs card <예명|상담사코드|프로필 코드>                상담사 소재 카드(블로그/소재카드/)
//       node blog.cjs topics                                            고민 분야 목록과 노릴 검색어
//       node blog.cjs topic <분야> [--category 타로] [--top 5]          고민별 상담사 묶음 재료(블로그/큐레이션/)
//       node blog.cjs week [--week 2026-W48]                            주간 타로 이야기 재료: 이번 주 후기에서 많았던 고민 + 카드 3장 뽑기(블로그/주간/)
//       node blog.cjs posts <낱말> [--category 신점] [--top 6]          상식 칼럼 재료: 상담사가 직접 쓴 포스팅 가운데 그 낱말이 든 글(블로그/칼럼재료/)
//       node blog.cjs check <초안.md>                                   초안 검사(분량·사진 자리·금지 표현·말투·숫자와 인용의 근거)
// 형식과 쓰는 법은 블로그-폼.md
'use strict';
const { fs, path, ROOT, RAW, TREND_DIR, SITE, readJson, writeAtomic, kst, loadReviews, request, htmlText, maskContacts } = require('./lib.cjs');

const argv = process.argv.slice(2);
const cmd = argv[0];
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const BLOG = path.join(ROOT, '블로그');
const CARD_DIR = path.join(BLOG, '소재카드');
const TOPIC_DIR = path.join(BLOG, '큐레이션');
const today = () => kst().slice(0, 10);

// ---------- 원본 읽기 ----------
function loadGroups() {
  const groups = new Map();
  const all = [];
  for (const f of fs.readdirSync(RAW)) {
    if (!f.endsWith('.json')) continue;
    const p = readJson(path.join(RAW, f), null);
    if (p && p.code && !p.gone) all.push(p);
  }
  // 사이트 목록에서 빠져 이번 회차에 다시 모으지 못한 프로필(그만둔 상담사일 수 있다)은 글감에서 뺀다
  const latest = Math.max(...all.map((p) => new Date(p.collectedAt || 0).getTime()));
  for (const p of all) {
    if (latest - new Date(p.collectedAt || 0).getTime() > 3 * 86400e3) continue;
    const key = p.ceCode || p.code;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  for (const list of groups.values()) list.sort((a, b) => (a.flag === 'call' ? -1 : 1) - (b.flag === 'call' ? -1 : 1));
  return groups;
}
const categoryOf = (p) => (String(p.pageTitle || '').match(/(?:전화|채팅)\s*(타로|신점|사주)/) || [])[1] || '';
const sumBy = (lists) => {
  const m = new Map();
  for (const l of lists) for (const x of l || []) m.set(x.name, (m.get(x.name) || 0) + (x.cnt || 0));
  return [...m.entries()].map(([name, cnt]) => ({ name, cnt })).sort((a, b) => b.cnt - a.cnt);
};
const withShare = (list, n) => {
  const total = list.reduce((s, x) => s + x.cnt, 0);
  return list.slice(0, n).map((x) => ({ ...x, share: total ? Math.round((x.cnt / total) * 100) : 0 }));
};
const totalReviews = (p) => p.reviewStats?.total ?? p.reviewCountLd ?? p.tabs?.reviews ?? null;

// ---------- 인용할 후기 고르기 ----------
// 건강·임신·사망·폭력·빚·소송 같은 개인 사정, 가림 표시, 인사만 있는 글은 뺀다. 작성자 닉네임은 원본에도 없다.
// 건강 결과·도박·당첨처럼 광고 글에 옮기면 효과를 약속하는 것처럼 읽히는 이야기도 뺀다
const SENSITIVE = /병원|수술|암 |투병|임신|유산|낙태|사망|돌아가|장례|자살|죽고|폭력|폭행|우울증|공황|빚|대출|파산|이혼|소송|경찰|불륜|바람|유부|상간|가림\]|용종|내시경|의사|진단|토토|로또|복권|도박|당첨/;
const GENERIC = /^(감사합니다|감사해요|고맙습니다|최고|좋아요|굿|짱|감사)[.!~♡♥ ]*$/;
const SPECIFIC = /재회|연락|속마음|마음|위로|정확|적중|편안|따뜻|다정|친절|공감|명쾌|시원|조언|방향|힘이|용기|든든|신기|소름|맞|풀렸|정리|고민|답답|희망|기다|인연|궁합|취업|합격|사업|이사|타로|카드|사주|공수/g;
// 결과를 보장하는 것처럼 읽히는 말이 든 후기는 인용 후보에서 뺀다(광고 글로 옮기면 과장이 된다)
const OVERCLAIM = /100%|백프로|무조건|반드시|틀린 적|다 맞|전부 맞/;
function scoreReview(r) {
  const t = String(r.content || '').replace(/\s+/g, ' ').trim();
  if (r.point !== 5 || t.length < 25 || GENERIC.test(t) || SENSITIVE.test(t) || OVERCLAIM.test(t)) return -1;
  let s = 0;
  if (t.length >= 40 && t.length <= 160) s += 3; else if (t.length <= 260) s += 1;
  s += Math.min(4, (t.match(SPECIFIC) || []).length);
  if (r.best === 'Y') s += 2;
  if ((r.help || 0) > 0) s += 1;
  if (r.field) s += 1;
  if (/(.)\1{4,}/.test(t) || /ㅋ{6,}|ㅠ{6,}/.test(t)) s -= 2;
  if (t.length > 40 && (t.split(' ').length - 1) / t.length < 0.05) s -= 4; // 띄어쓰기 없이 붙여 쓴 글은 읽기 어렵다
  if (/\d{1,2}월.{0,14}(연락|온다|역전|재회|합격|들어온)/.test(t)) s -= 2; // 아직 일어나지 않은 예측을 옮기면 결과를 약속하는 글처럼 읽힌다
  return s;
}
// 같은 사람이 같은 글을 되풀이해 올린 후기를 가려내는 열쇠(글자만 남긴 앞 24자)
const repeatKey = (text) => String(text || '').replace(/[^가-힣A-Za-z0-9]/g, '').slice(0, 24);
function quotesFor(list, { field = null, max = 12 } = {}) {
  const all = new Map();
  for (const p of list) for (const r of loadReviews(p.code).concat(p.reviews7d || [])) all.set(String(r.no), { ...r, code: p.code, via: p.flag === 'chat' ? '채팅' : '전화' });
  const repeats = new Map();
  for (const r of all.values()) { const k = repeatKey(r.content); repeats.set(k, (repeats.get(k) || 0) + 1); }
  const scored = [...all.values()].map((x) => ({ ...x, score: scoreReview(x) }))
    .filter((x) => x.score >= 3 && repeats.get(repeatKey(x.content)) < 3 && (!field || String(x.field).includes(field)));
  scored.sort((a, b) => b.score - a.score || String(b.date).localeCompare(String(a.date)));
  const out = [];
  const seenKey = new Set();
  const perField = new Map();
  for (const r of scored) {
    const k = repeatKey(r.content);
    const f = String(r.field || '').split(',')[0].trim();
    if (seenKey.has(k) || (!field && (perField.get(f) || 0) >= 4)) continue; // 한 분야로 쏠리지 않게 분야당 4개까지
    seenKey.add(k);
    perField.set(f, (perField.get(f) || 0) + 1);
    out.push({ no: String(r.no), date: String(r.date).slice(0, 10), field: r.field || '', style: r.style || '', via: r.via, text: String(r.content).replace(/\s+/g, ' ').trim() });
    if (out.length >= max) break;
  }
  return out;
}

// ---------- 주간 변화 ----------
function trendOf(codes) {
  if (!fs.existsSync(TREND_DIR)) return null;
  const files = fs.readdirSync(TREND_DIR).filter((f) => f.endsWith('.json')).sort();
  if (files.length < 2) return null;
  const last = readJson(path.join(TREND_DIR, files[files.length - 1]), null);
  // 같은 주에 두 번 모은 기록은 건너뛰고, 3일 넘게 떨어진 앞 기록과 비교한다
  let prev = null;
  for (let i = files.length - 2; i >= 0 && !prev; i--) {
    const c = readJson(path.join(TREND_DIR, files[i]), null);
    if (c && last && (new Date(last.at) - new Date(c.at)) / 86400e3 >= 3) prev = c;
  }
  if (!last || !prev) return null;
  let delta = 0; let has = false;
  for (const c of codes) { const a = last.rows[c]?.total; const b = prev.rows[c]?.total; if (a != null && b != null) { delta += a - b; has = true; } }
  return has ? { days: Math.round((new Date(last.at) - new Date(prev.at)) / 86400e3), reviewsAdded: delta, from: prev.at.slice(0, 10), to: last.at.slice(0, 10) } : null;
}

// ---------- 검색어 ----------
const FIELD_WORD = { 속마음: '속마음', 재회: '재회', 애정: '연애운', 이별: '이별', 짝사랑: '짝사랑', 궁합: '궁합', 인간관계: '인간관계', 진로: '진로', 사업: '사업운', 취업: '취업운', 재물: '재물운', 결혼: '결혼운', 합격: '합격운', 시험: '시험운', 이사: '이사운', 가족: '가족', 건강: '건강운', 속궁합: '속궁합', 꿈해몽: '꿈해몽' };
function keywordsFor(nick, category, fields) {
  const cat = category || '타로';
  const top = fields.filter((f) => f.name !== '고민').slice(0, 2).map((f) => FIELD_WORD[f.name] || f.name);
  return {
    name: [`홍카페 ${nick}`, `홍카페 ${nick} 후기`, `${nick} ${cat}`],
    topic: [...top.map((w) => `${w} 전화${cat}`), ...top.map((w) => `${w} ${cat} 잘보는곳`), `전화${cat} 잘보는곳`, `홍카페 ${cat}`],
  };
}

// ---------- 소재 카드 ----------
function buildCard(ce, list, maxQuotes = 12) {
  const main = list[0];
  const category = categoryOf(main) || categoryOf(list[list.length - 1]);
  const fields = sumBy(list.map((p) => p.stats?.fields));
  const styles = sumBy(list.map((p) => p.stats?.styles));
  const posts = ce.startsWith('CE-') ? (readJson(path.join(RAW, '포스팅', `${ce}.json`), { items: [] }).items || []) : [];
  const quotes = quotesFor(list, { max: maxQuotes });
  const total = totalReviews(main);
  const rs = main.reviewStats || null;
  const warn = [];
  if ((total || 0) < 30) warn.push('누적 후기가 30건 미만이라 "후기로 본" 표현의 근거가 약하다');
  if ((main.recent3m?.reviews || 0) < 10) warn.push('최근 3개월 후기가 10건 미만이다(요즘 활동이 적다)');
  if (quotes.length < 3) warn.push('인용할 만한 후기가 3개 미만이다(후기는 매주 쌓인다. 몇 주 뒤 다시 만들면 늘어난다)');
  if (!main.career?.length) warn.push('약력이 비어 있다');
  return {
    version: 1, kind: 'card', asOf: today(), collectedAt: main.collectedAt ? kst(new Date(main.collectedAt)) : '',
    ceCode: ce, nick: main.nick, number: main.number060 || '', category, grade: main.grade || '',
    profiles: list.map((p) => ({ code: p.code, type: p.flag === 'chat' ? '채팅' : '전화', url: p.url, price: p.price, unit: p.unit })),
    profileUrl: main.url,
    facts: {
      price: main.price, unit: main.unit, hours: main.hours || '',
      reviewsTotal: total, star: main.rating ?? rs?.star ?? null, fivePoint: rs?.fivePoint ?? null,
      replies: rs?.replies ?? null, replyRate: rs?.replies && total ? Math.round((rs.replies / total) * 100) : null,
      recent3mReviews: main.recent3m?.reviews ?? null, recent3mFiveRate: main.recent3m?.fiveRate ?? null,
      reviews7d: list.reduce((n, p) => n + (p.reviews7d || []).length, 0),
      postings: posts.length || main.tabs?.postings || 0, education: main.education || [],
      weekly: trendOf(list.map((p) => p.code)),
    },
    fields: withShare(fields, 6), styles: withShare(styles, 6),
    reviewKeywords: main.stats?.keywords || [],
    rising: (main.stats?.trend || []).filter((x) => x.trend === 'up' || Number(x.diffRate) > 0).slice(0, 4).map((x) => ({ type: x.type, name: x.name, now: x.curr, before: x.prev })),
    career: main.career || [], reading: main.reading || [],
    // 인사말 구역에는 화면 머리줄(보는 중 인원·번호·가격)만 들어오는 상담사가 많다. 그런 값은 버린다
    greeting: /^현재 \d|보는 중/.test(main.greeting || '') ? '' : (main.greeting || ''),
    headline: String(main.jobTitle || main.serviceIntro || '').split('\n').filter((l) => l && l !== '서비스 소개').slice(0, 3),
    intro: String(main.serviceIntro || '').replace(/^서비스 소개\n/, '').replace(/\n?전체보기\s*$/, '').slice(0, 900),
    quotes,
    popularPosts: posts.slice().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5).map((t) => ({ title: t.title, views: t.views, date: String(t.date).slice(0, 10) })),
    keywords: keywordsFor(main.nick, category, fields),
    warnings: warn,
  };
}
// ---------- 이야기 재료 더하기(2026-11-20 대표: "내용이 너무 적다, 상담사 내용 활용을 극대화") ----------
// 글을 쓸 상담사만 그때 받아 온다(상담사 한 명에 요청 3번). 매주 전체 수집의 범위(최근 7일 후기)는 그대로다.
//   베스트 후기: 고객이 직접 쓴 긴 이야기(홍카페가 베스트로 뽑은 후기) / 상담사 PICK: 상담사가 고른 후기 / 도움돼요 순 상위 후기
//   + 그 후기에 상담사가 단 답글. 답글 속 고객 닉네임은 ○○으로 가린다. 닉네임은 저장하지 않는다.
async function fetchPicked(p, want = { best: 10, pick: 30, help: 20 }) {
  const out = new Map();
  for (const [kind, extra] of [['best', { type: 'best' }], ['pick', { type: 'pick' }], ['help', { order: 'help' }]]) {
    if (!want[kind]) continue;
    let body = null;
    try {
      const r = await request(`${SITE}/api/comment/getItemComment`, { form: { offset: 0, limit: want[kind], type: '', order: '', item_code: p.code, profilePage: 'true', item_flag: p.flag, ...extra }, referer: p.url, json: true });
      body = r?.body?.response === 'success' ? r.body : null;
    } catch { body = null; }
    for (const it of body?.items || []) {
      const no = String(it.cm_no);
      if (out.has(no)) continue;
      const nick = String(it.ac_nick || '').trim();
      const rep = [].concat(it.cm_reply || [])[0];
      // 답글은 "○○님"으로 시작하는 일이 많고 닉네임을 줄여 부르기도 한다. 닉네임과 답글 첫머리의 부름말을 모두 가린다
      const called = (htmlText(rep?.cm_content || '').trim().match(/^([^\s,.!~]{1,10}(?: [^\s,.!~]{1,8})?)님/) || [])[1] || '';
      const names = [nick, called, called.replace(/^우리\s*/, '')].filter((x) => x && x.length >= 2).sort((a, b) => b.length - a.length);
      const hide = (s) => names.reduce((t, x) => t.split(x).join('○○'), s);
      const join = (v) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : String(v ?? ''));
      out.set(no, { no, kind, date: String(it.regist_date || '').slice(0, 10), point: Number(it.cm_point), field: join(it.cm_counsel_field), style: join(it.cm_style), help: Number(it.help_cnt) || 0,
        text: hide(maskContacts(htmlText(it.cm_content))).replace(/\s+/g, ' ').trim(), reply: rep ? hide(maskContacts(htmlText(rep.cm_content || ''))).replace(/\s+/g, ' ').trim() : '' });
    }
  }
  return [...out.values()];
}
const KIND_LABEL = { best: '베스트 후기', pick: '상담사 PICK', help: '도움돼요 많은 후기' };
async function enrich(card, list, { stories = 12, replies = 6, posts = 6 } = {}) {
  const main = list[0];
  const picked = await fetchPicked(main);
  const usable = picked.filter((r) => r.point === 5 && r.text.length >= 80 && !SENSITIVE.test(r.text) && !OVERCLAIM.test(r.text));
  const order = { best: 0, pick: 1, help: 2 };
  card.stories = usable.sort((a, b) => order[a.kind] - order[b.kind] || b.text.length - a.text.length).slice(0, stories)
    .map((r) => ({ no: r.no, kind: KIND_LABEL[r.kind], date: r.date, field: r.field, style: r.style, text: r.text.slice(0, 1600) }));
  card.replies = picked.filter((r) => r.reply.length >= 40 && !SENSITIVE.test(r.reply) && !SENSITIVE.test(r.text)).sort((a, b) => b.reply.length - a.reply.length).slice(0, replies)
    .map((r) => ({ no: r.no, date: r.date, field: r.field, to: r.text.slice(0, 160), text: r.reply.slice(0, 600) }));
  const all = card.ceCode.startsWith('CE-') ? (readJson(path.join(RAW, '포스팅', `${card.ceCode}.json`), { items: [] }).items || []) : [];
  card.posts = all.filter((t) => String(t.content || '').length >= 200 && !SENSITIVE.test(t.title)).sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, posts)
    .map((t) => ({ title: t.title, date: String(t.date).slice(0, 10), views: t.views || 0, text: maskContacts(String(t.content)).slice(0, 2000) }));
  card.notice = String(main.notice || '').replace(/^상담사 공지\n/, '').replace(/\n?전체보기\s*$/, '').slice(0, 900);
  card.faq = (main.faq || []).map((q) => ({ q: q.q, a: String(q.a).slice(0, 400) })).filter((q) => q.q && q.a);
  card.fetchedAt = kst();
  return card;
}

const pct = (list) => list.map((x) => `${x.name} ${x.share}%(${x.cnt.toLocaleString()}건)`).join(' · ');
function richMarkdown(c, L) {
  if (c.stories?.length) {
    L.push('', '## 고객이 직접 쓴 긴 이야기 (글의 중심 재료. 문장 그대로 인용하고, 줄일 때만 … 사용. 닉네임을 붙이지 않는다)');
    c.stories.forEach((s, i) => L.push(`${i + 1}. [${s.kind} · ${s.date} · ${s.field || '분야 없음'}] ${s.text}`, ''));
  }
  if (c.replies?.length) {
    L.push('## 상담사가 후기에 단 답글 (상담사의 말투와 마음 씀씀이를 보여 주는 재료. 고객 닉네임은 ○○으로 가렸다)');
    c.replies.forEach((r, i) => L.push(`${i + 1}. [${r.date} · ${r.field || '분야 없음'}] 답글: ${r.text}`, `   (받은 후기: ${r.to}…)`, ''));
  }
  if (c.posts?.length) {
    L.push('## 상담사가 직접 쓴 포스팅 (상담사의 생각과 조언. 인용할 때 문장 그대로, 한 글에서 두세 문장까지)');
    c.posts.forEach((p, i) => L.push(`### ${i + 1}. ${p.title} (${p.date} · 조회 ${p.views.toLocaleString()})`, '```', p.text, '```', ''));
  }
  if (c.notice) L.push('## 상담사 공지 (상담사가 프로필에 직접 쓴 글)', '```', c.notice, '```', '');
  if (c.faq?.length) { L.push('## 프로필의 자주 묻는 질문'); c.faq.forEach((q) => L.push(`- Q. ${q.q} / A. ${q.a}`)); }
}
function cardMarkdown(c) {
  const f = c.facts;
  const L = [];
  L.push(`# 소재 카드: ${c.nick}${c.number ? ` ${c.number}번` : ''} (${c.category || '분류 미상'})`, '');
  L.push(`- 기준일: ${c.asOf} (수집 ${c.collectedAt}) · 상담사코드 ${c.ceCode}`);
  L.push(`- 프로필: ${c.profiles.map((p) => `${p.type} ${p.url} (${p.price ?? '-'}코인/${p.unit || '-'})`).join(' , ')}`);
  L.push(`- 등급 ${c.grade || '-'} · 주 상담시간 ${f.hours || '화면에 없음'} · 교육 이수 ${f.education.join(', ') || '-'}`, '');
  L.push('## 숫자 (글에 쓰는 숫자는 여기 있는 것만)');
  L.push(`- 누적 후기 ${f.reviewsTotal?.toLocaleString() ?? '-'}건 · 누적 별점 ${f.star ?? '-'}점 · 5점 후기 ${f.fivePoint?.toLocaleString() ?? '-'}개`);
  L.push(`- 최근 3개월 후기 ${f.recent3mReviews?.toLocaleString() ?? '-'}건 · 5점 만족도 ${f.recent3mFiveRate ?? '-'}%`);
  L.push(`- 최근 7일 후기 ${f.reviews7d}건 · 상담사 댓글 ${f.replies?.toLocaleString() ?? '-'}건${f.replyRate != null ? `(후기의 ${f.replyRate}%)` : ''} · 포스팅 ${f.postings}개`);
  if (f.weekly) L.push(`- 지난 수집(${f.weekly.from}) 뒤 ${f.weekly.days}일 동안 후기 ${f.weekly.reviewsAdded}건 늘었다`);
  L.push(`- 상담 분야(후기 태그 기준): ${pct(c.fields) || '-'}`);
  L.push(`- 상담 스타일(후기 태그 기준): ${pct(c.styles) || '-'}`);
  if (c.reviewKeywords.length) L.push(`- 후기 키워드: ${c.reviewKeywords.join(', ')}`);
  if (c.rising.length) L.push(`- 최근 한 달 늘어난 태그: ${c.rising.map((x) => `${x.name}(${x.before}→${x.now})`).join(', ')}`);
  L.push('', '## 상담사가 직접 쓴 소개 (옮겨 쓸 때는 뜻을 바꾸지 않는다)');
  if (c.headline.length) L.push(`- 한 줄 소개: ${c.headline.join(' / ')}`);
  if (c.greeting) L.push(`- 인사말: ${c.greeting.replace(/\n/g, ' ')}`);
  L.push(`- 약력: ${c.career.join(' / ') || '-'}`, `- 리딩정보: ${c.reading.join(' / ') || '-'}`);
  if (c.intro) L.push('', '```', c.intro, '```');
  L.push('', '## 인용할 수 있는 후기 (이 문장만 인용한다. 줄일 때는 … 로 표시, 닉네임·날짜를 지어내지 않는다)');
  c.quotes.forEach((q, i) => L.push(`${i + 1}. [${q.date} · ${q.via} · ${q.field || '분야 없음'}${q.style ? ` · ${q.style}` : ''}] ${q.text}`));
  if (!c.quotes.length) L.push('- 없음');
  richMarkdown(c, L);
  if (c.popularPosts.length) { L.push('', '## 상담사 포스팅 인기 글 제목 (이 상담사가 어떤 주제에 강한지 보여 주는 재료)'); c.popularPosts.forEach((t) => L.push(`- ${t.title} (조회 ${t.views}, ${t.date})`)); }
  L.push('', '## 노릴 검색어', `- 이름: ${c.keywords.name.join(' , ')}`, `- 고민: ${c.keywords.topic.join(' , ')}`);
  if (c.warnings.length) { L.push('', '## 주의'); c.warnings.forEach((w) => L.push(`- ${w}`)); }
  return `${L.join('\n')}\n`;
}
function findGroup(groups, q) {
  const key = String(q).replace(/[\s번]/g, '');
  return [...groups.entries()].filter(([ce, list]) => ce === q || list.some((p) => p.code === q || p.nick === q || `${p.nick}${p.number060}` === key));
}
const safeName = (s) => String(s).replace(/[^0-9A-Za-z가-힣_-]+/g, '_');

// ---------- 고민별 묶음 ----------
function topicRows(groups, field, category, min3m) {
  const rows = [];
  for (const [ce, list] of groups) {
    const main = list[0];
    const cat = categoryOf(main);
    if (category && cat !== category) continue;
    const fields = sumBy(list.map((p) => p.stats?.fields));
    const hit = fields.find((f) => f.name === field);
    if (!hit || !hit.cnt) continue;
    const total = fields.reduce((s, x) => s + x.cnt, 0);
    const r3 = main.recent3m?.reviews || 0;
    if (r3 < min3m) continue;
    rows.push({ ce, list, nick: main.nick, number: main.number060 || '', category: cat, fieldCnt: hit.cnt, share: Math.round((hit.cnt / total) * 100), r3 });
  }
  return rows.sort((a, b) => b.fieldCnt - a.fieldCnt);
}

// ---------- 주간 타로: 카드 뽑기 ----------
// 메이저 아르카나 22장과 널리 쓰는 뜻. 글쓴이가 카드를 고르지 않고 도구가 주(週) 이름으로 뽑는다(같은 주는 언제 돌려도 같은 카드)
const MAJOR = [
  ['바보', 'The Fool', '새 출발·자유·가벼운 발걸음', '무모함·준비 부족·망설임'],
  ['마법사', 'The Magician', '실행력·재능 발휘·시작할 준비', '말뿐인 계획·재능 낭비·속임수'],
  ['여사제', 'The High Priestess', '직관·침묵·기다림', '숨긴 마음·직감 무시·비밀'],
  ['여황제', 'The Empress', '풍요·돌봄·여유', '과한 의존·소홀한 자기 돌봄·정체'],
  ['황제', 'The Emperor', '책임·질서·주도권', '고집·통제욕·권위 다툼'],
  ['교황', 'The Hierophant', '조언·전통·믿을 만한 길', '틀에 갇힘·형식적인 관계·내 방식 찾기'],
  ['연인', 'The Lovers', '선택·끌림·마음의 일치', '엇갈림·우유부단·가치관 차이'],
  ['전차', 'The Chariot', '전진·의지·승부', '방향 상실·조급함·힘 조절 실패'],
  ['힘', 'Strength', '인내·부드러운 용기·감정 다스리기', '자신감 저하·감정 폭발·지침'],
  ['은둔자', 'The Hermit', '혼자만의 시간·성찰·신중함', '고립·회피·지나친 거리 두기'],
  ['운명의 수레바퀴', 'Wheel of Fortune', '전환점·흐름의 변화·기회', '어긋난 타이밍·되풀이되는 패턴·정체'],
  ['정의', 'Justice', '공정·균형·결과를 받아들임', '불공평·책임 회피·치우친 판단'],
  ['매달린 사람', 'The Hanged Man', '멈춤·다른 시각·내려놓기', '헛된 희생·미루기·제자리'],
  ['죽음', 'Death', '끝과 시작·정리·변화', '끝내지 못함·미련·변화 거부'],
  ['절제', 'Temperance', '균형·조율·천천히 섞임', '과함·불균형·성급함'],
  ['악마', 'The Devil', '집착·유혹·끊기 어려운 습관', '벗어남·끊어 냄·자유 되찾기'],
  ['탑', 'The Tower', '갑작스러운 변화·무너짐·드러나는 진실', '미뤄진 위기·변화에 대한 두려움·겨우 피함'],
  ['별', 'The Star', '희망·회복·잔잔한 기대', '실망·자신감 부족·기대 낮추기'],
  ['달', 'The Moon', '불안·오해·보이지 않는 것', '오해가 풀림·불안이 잦아듦·진실 확인'],
  ['태양', 'The Sun', '기쁨·성공·활력', '잠시 흐림·늦어지는 기쁨·지나친 낙관'],
  ['심판', 'Judgement', '다시 부름·결단·반가운 소식', '망설임·자기 의심·지난 일에 묶임'],
  ['세계', 'The World', '완성·결실·한 단계 마무리', '미완성·마지막 한 걸음·늦어지는 마무리'],
];
function seeded(seed) { // 글자를 씨앗으로 쓰는 간단한 난수(mulberry32)
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function drawCards(weekId) {
  const rnd = seeded(`hongcafe-${weekId}`);
  const idx = MAJOR.map((_, i) => i);
  const roles = ['이번 주 흐름', '조심할 점', '조언'];
  return roles.map((role) => {
    const i = idx.splice(Math.floor(rnd() * idx.length), 1)[0];
    const reversed = rnd() < 0.35;
    const [name, en, up, down] = MAJOR[i];
    return { role, no: i, name, en, direction: reversed ? '역방향' : '정방향', keywords: (reversed ? down : up).split('·') };
  });
}
// 주 이름(ISO 주)과 월요일~일요일 날짜. 금·토·일에 돌리면 다음 주를 준다(글은 그 주가 시작되기 전에 쓴다)
function weekInfo(given) {
  const now = new Date(Date.now() + 9 * 3600e3);
  let mon;
  if (given && /^\d{4}-W\d{2}$/.test(given)) {
    const [y, w] = given.split('-W').map(Number);
    const jan4 = new Date(Date.UTC(y, 0, 4));
    mon = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400e3 + (w - 1) * 7 * 86400e3);
  } else {
    const dow = (now.getUTCDay() + 6) % 7; // 월=0
    mon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + (dow >= 4 ? 7 - dow : -dow) * 86400e3);
  }
  const thu = new Date(mon.getTime() + 3 * 86400e3);
  const week = Math.ceil(((thu - Date.UTC(thu.getUTCFullYear(), 0, 1)) / 86400e3 + 1) / 7);
  const sun = new Date(mon.getTime() + 6 * 86400e3);
  const md = (d) => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  return { id: `${thu.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, label: `${md(mon)}~${md(sun)}`, from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}

// ---------- 말투 검사 ----------
// 2026-11-20 대표 지적("너무 AI 같은 글")으로, 반응이 좋은 실제 블로그(글마다 공감·댓글 20개 안팎) 글에서 뽑은 기준이다.
// 한두 문장마다 줄을 바꾼다(줄 길이 중앙 40~50자), 습니다체에 …요·…죠·…거든요를 섞는다, 글쓴이가 자기 생각을 말한다, 목록 대신 문장으로 푼다.
const AI_PHRASES = [
  [/단순히 [^.\n]{0,30}(아니라|넘어)/, '단순히 ~이 아니라'], [/뿐만 아니라/, '뿐만 아니라'], [/결론적으로|종합하면|요약하면|정리하자면/, '결론적으로·종합하면'],
  [/살펴보겠습니다|알아보겠습니다|알아보도록|소개해 ?드리겠습니다/, '살펴보겠습니다·알아보겠습니다'], [/다양한/, '다양한'], [/눈에 띄는 것은|주목할 (점|만한)/, '눈에 띄는 것은·주목할 점'],
  [/라는 뜻입니다|를 의미합니다|을 의미합니다|라는 근거입니다/, '~라는 뜻입니다·~를 의미합니다'], [/이처럼|이와 같이|이를 통해|이러한 점에서/, '이처럼·이를 통해'],
  [/중요합니다|필수적입니다/, '중요합니다'], [/도움이 됩니다|도움이 될 것입니다|도움이 될 수 있습니다/, '도움이 됩니다'], [/(^|\n)(또한|한편|따라서|그러므로),/, '또한,·한편,·따라서,'],
  [/첫째|둘째|셋째/, '첫째·둘째·셋째'], [/에 대해 (알아|살펴)/, '~에 대해 알아보'], [/할 수 있습니다[^\n]*\n[^\n]*할 수 있습니다/, '~할 수 있습니다 되풀이'],
  [/권합니다|권장합니다|추천드립니다/, '권합니다·추천드립니다'], [/대체로 이렇습니다|다음과 같습니다|아래와 같습니다/, '다음과 같습니다'],
];
function toneCheck(body, errors, warns, ok) {
  const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !/^\[사진|^##|^>|^https?:|^- |^"|^“/.test(l));
  if (lines.length < 10) return;
  const lens = lines.map((l) => l.length).sort((a, b) => a - b);
  const median = lens[lens.length >> 1];
  const long = lines.filter((l) => l.length > 130);
  if (median > 62) errors.push(`한 줄 길이 중앙값이 ${median}자입니다(62자 이하). 블로그 글은 한두 문장마다 줄을 바꿉니다.`);
  else ok.push(`한 줄 길이 중앙 ${median}자`);
  if (long.length) errors.push(`130자를 넘는 줄 ${long.length}개: "${long[0].slice(0, 30)}…" — 문장을 나눠 줄을 바꾸세요.`);
  const sents = lines.join(' ').split(/(?<=[.?!~])\s+/).filter((s) => s.length > 5);
  const soft = sents.filter((s) => /(요|죠|까|네)[.?!~^ㅎ ]*$/.test(s)).length;
  const softRate = Math.round((soft / Math.max(1, sents.length)) * 100);
  if (softRate < 22) errors.push(`…요·…죠·…까요로 끝나는 문장이 ${softRate}%입니다(22% 이상). 습니다체만 이어지면 보고서처럼 읽힙니다.`);
  else if (softRate > 85) warns.push(`…요로 끝나는 문장이 ${softRate}%입니다. 습니다체를 조금 섞으면 가볍지 않게 읽힙니다.`);
  else ok.push(`말투 섞임(해요체 ${softRate}%)`);
  const hits = AI_PHRASES.filter(([re]) => re.test(body.replace(/^>.*$/gm, ''))).map(([, name]) => name);
  if (hits.length >= 3) errors.push(`기계가 쓴 글처럼 읽히는 표현 ${hits.length}가지: ${hits.join(', ')} — 말하듯이 바꾸세요.`);
  else if (hits.length) warns.push(`굳은 표현: ${hits.join(', ')} — 말하듯이 바꾸면 더 좋습니다.`);
  const bullets = (body.match(/^- /gm) || []).length;
  if (bullets > 12) errors.push(`목록(- ) 줄이 ${bullets}개입니다(12개 이하). 숫자와 특징을 목록으로 늘어놓지 말고 문장으로 풀어 쓰세요.`);
  if (!/저희|저는|전 |제 생각|운영팀이|운영팀에|더라고요|거든요/.test(body.replace(/^>.*$/gm, ''))) errors.push('글쓴이의 목소리가 없습니다. "저희가 후기를 읽어 보니", "~더라고요", "~거든요"처럼 운영팀이 직접 보고 느낀 것을 말하세요.');
  if (!/댓글/.test(body)) warns.push('댓글을 부르는 한마디가 없습니다(반응 좋은 글은 "댓글로 알려 주세요"처럼 묻습니다).');
}

// ---------- 초안 검사 ----------
// 2026-11-20 대표: "내용이 너무 적다". 반응이 큰 일반 사용자 글은 2,700~4,700자에 사진 12~15장이었다. 분량과 인용 기준을 올렸다
const RULES = {
  소개: { min: 2400, max: 4800, photos: 9, heads: 5, quotes: 7, own: 2, story: 1 }, 큐레이션: { min: 2400, max: 5200, photos: 7, heads: 5, quotes: 6, own: 2 },
  주간타로: { min: 1900, max: 4000, photos: 6, heads: 4, quotes: 3, own: 1 }, 칼럼: { min: 1900, max: 4000, photos: 4, heads: 4, quotes: 4, own: 3 },
};
const FAKE_REVIEW = /내돈내산|제가 (?:직접 )?(?:상담|받아|전화)|저는 (?:이번에|직접)|받아봤|다녀왔|찐 ?후기|솔직 ?후기|체험 ?후기|상담받고 왔/;
const OVERSELL = /100% ?적중|무조건|반드시 (?:재회|합격|성공|맞)|보장|완치|치료|틀림없|국내 ?최초|업계 ?1위|1위|최고의/;
function numbersIn(obj, out = new Set()) {
  if (obj == null) return out;
  if (typeof obj === 'number') out.add(String(obj));
  else if (typeof obj === 'string') for (const m of obj.matchAll(/\d[\d,]*(?:\.\d+)?/g)) out.add(m[0].replace(/,/g, ''));
  else if (Array.isArray(obj)) obj.forEach((x) => numbersIn(x, out));
  else if (typeof obj === 'object') Object.values(obj).forEach((x) => numbersIn(x, out));
  return out;
}
function checkDraft(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const errors = []; const warns = []; const ok = [];
  if (!fm) { console.log('✖ 맨 위에 --- 머리말(폼·소재·제목·검색어)이 없습니다. 블로그-폼.md의 초안 형식을 따르세요.'); process.exit(1); }
  const meta = Object.fromEntries(fm[1].split('\n').map((l) => l.match(/^([^:]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1].trim(), m[2].trim()]));
  const body = raw.slice(fm[0].length);
  const rule = RULES[meta['폼']];
  if (!rule) errors.push(`머리말의 폼이 "${meta['폼'] || ''}"입니다. ${Object.keys(RULES).join('·')} 가운데 하나여야 합니다.`);
  const sources = String(meta['소재'] || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => (path.isAbsolute(s) ? s : path.resolve(path.dirname(file), s)));
  const cards = [];
  for (const s of sources) { const j = readJson(s, null); if (!j) errors.push(`소재 파일을 읽지 못했습니다: ${s}`); else cards.push(j); }
  if (!sources.length) errors.push('머리말에 소재(소재 카드·큐레이션 JSON 경로)가 없습니다.');
  const title = meta['제목'] || '';
  const text = body.replace(/^\[사진[^\]]*\]\s*$/gm, '').replace(/^#+\s*/gm, '').replace(/^>\s?/gm, '');
  const chars = text.replace(/\s/g, '').length;
  const photos = (body.match(/^\[사진\s*\d+\s*:[^\]]+\]/gm) || []).length;
  const heads = (body.match(/^##\s+\S/gm) || []).length;
  if (rule) {
    if (chars < rule.min || chars > rule.max) errors.push(`본문 ${chars}자입니다(${rule.min}~${rule.max}자).`); else ok.push(`본문 ${chars}자`);
    if (photos < rule.photos) errors.push(`사진 자리 ${photos}개입니다(${rule.photos}개 이상, "[사진 1: 설명]" 한 줄).`); else ok.push(`사진 자리 ${photos}개`);
    if (heads < rule.heads) errors.push(`소제목(## ) ${heads}개입니다(${rule.heads}개 이상).`); else ok.push(`소제목 ${heads}개`);
  }
  if (title.length < 18 || title.length > 48) errors.push(`제목 ${title.length}자입니다(18~48자).`);
  // 상담사 소개·큐레이션은 "홍카페 + 이름/고민" 검색을 노리므로 제목에 홍카페를 넣는다. 주간 타로·칼럼은 주제 낱말이 먼저다
  if (['소개', '큐레이션'].includes(meta['폼']) && !/홍카페/.test(title)) errors.push('제목에 "홍카페"가 없습니다.');
  const kws = String(meta['검색어'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!kws.length) errors.push('머리말에 검색어가 없습니다.');
  else {
    const mainKw = kws[0];
    const words = mainKw.split(/\s+/);
    if (!words.every((w) => title.includes(w))) errors.push(`제목에 첫 검색어 "${mainKw}"의 낱말이 모두 들어 있지 않습니다.`);
    const first = text.slice(0, 300);
    if (!words.every((w) => first.includes(w))) warns.push(`본문 첫 300자 안에 첫 검색어 "${mainKw}"의 낱말이 모두 나오면 좋습니다.`);
    const cnt = words.map((w) => text.split(w).length - 1);
    if (Math.min(...cnt) < 3) warns.push(`첫 검색어 낱말이 본문에 ${Math.min(...cnt)}번 나옵니다(3~8번 권장).`);
  }
  for (const [re, why] of [[FAKE_REVIEW, '고객이 쓴 체험 후기처럼 읽히는 표현(회사가 쓴 글에는 쓰지 않는다)'], [OVERSELL, '결과 보장·근거 없는 최상급 표현']]) {
    // 인용한 후기(> 줄) 안의 표현은 고객의 말이므로 본문만 본다
    // 체험 꾸밈 표현은 따옴표 안(상담사 포스팅 제목, 고객이 한 질문을 옮긴 말)에서는 보지 않는다
    const own = `${re === FAKE_REVIEW ? title.replace(/"[^"\n]{0,80}"/g, '') : title}\n${re === FAKE_REVIEW ? body.replace(/^>.*$/gm, '').replace(/"[^"\n]{0,80}"|“[^”\n]{0,80}”/g, '') : body.replace(/^>.*$/gm, '')}`;
    const m = own.match(re);
    if (m) errors.push(`금지 표현 "${m[0]}": ${why}`);
  }
  // 프로필 주소 속 코드 숫자를 전화번호로 잘못 보지 않게 주소는 빼고 본다
  const noUrl = body.replace(/https?:\/\/\S+/g, ' ');
  if (/(?<![\d-])01[016789][-. ]?\d{3,4}[-. ]?\d{4}(?![\d-])|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(noUrl)) errors.push('연락처(휴대전화·메일)가 들어 있습니다.');
  toneCheck(body, errors, warns, ok);
  if (!/홍카페[^\n]{0,30}(작성|운영팀)/.test(body)) errors.push('글쓴이 표기가 없습니다(예: "이 글은 홍카페 운영팀이 공개 프로필과 실제 이용 후기를 바탕으로 작성했습니다.").');
  if (cards.length) {
    const d = cards[0].asOf.split('-');
    const forms = [cards[0].asOf, `${d[0]}년 ${Number(d[1])}월 ${Number(d[2])}일`, `${d[0]}.${d[1]}.${d[2]}`];
    // 칼럼은 후기 숫자를 다루는 글이 아니라 기준일을 요구하지 않는다
    if (meta['폼'] !== '칼럼' && !forms.some((x) => body.includes(x))) errors.push(`기준일(${forms[1]})이 본문에 없습니다. 숫자는 "○○ 기준"을 밝힙니다.`);
    // 인용: > 로 시작하는 줄은 소재의 후기 문장이어야 한다
    // 인용할 수 있는 글: 후기(소재 카드·큐레이션·주간 재료)와 상담사가 직접 쓴 포스팅(칼럼 재료). 누구 글인지도 함께 기억한다
    // 한 상담사(소재 카드, 큐레이션의 한 명, 주간 재료의 한 명)에게서 나오는 인용 재료와 종류
    //   review 짧은 후기 · story 고객이 쓴 긴 이야기 · post 상담사 포스팅 · own 상담사가 직접 쓴 말(답글·공지·소개·약력)
    const from = (x, nick, url) => [
      ...(x.quotes || []).map((q) => ({ text: q.text, nick, url, type: 'review' })),
      ...(x.stories || []).map((q) => ({ text: q.text, nick, url, type: 'story' })),
      ...(x.replies || []).map((q) => ({ text: q.text, nick, url, type: 'own' })),
      ...(x.posts || []).map((p) => ({ text: p.text, nick: p.nick || nick, url: p.profileUrl || url, type: 'post', post: true })),
      ...[x.notice, x.intro, x.greeting, ...(x.career || []), ...(x.reading || []), ...(x.headline || []), ...(x.faq || []).map((q) => q.a)].filter(Boolean).map((t) => ({ text: String(t), nick, url, type: 'own' })),
    ];
    const sourcesOfQuote = cards.flatMap((c) => [
      ...from(c, c.nick, c.profileUrl),
      ...(c.items || []).flatMap((x) => from(x, x.nick, x.profileUrl)),
      ...(c.counselors || []).flatMap((x) => from(x, x.nick, x.profileUrl)),
    ]).map((q) => ({ ...q, text: q.text.replace(/\s+/g, ' ') }));
    const pool = sourcesOfQuote.map((q) => q.text);
    const quoted = [...body.matchAll(/^>\s?(.+)$/gm)].map((m) => m[1].trim().replace(/^["“”']|["“”']$/g, ''));
    let bad = 0;
    const quotedFrom = [];
    for (const q of quoted) {
      const parts = q.split(/…|\.\.\./).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 6);
      const from = parts.length ? sourcesOfQuote.find((p) => parts.every((s) => p.text.includes(s))) : null;
      if (!from) { bad++; errors.push(`소재에 없는 인용: "${q.slice(0, 40)}…" (후기·포스팅을 지어내거나 고쳐 쓰지 않는다. 줄일 때만 … 사용)`); } else quotedFrom.push(from);
    }
    const people = cards.flatMap((c) => c.items || []);
    const need = meta['폼'] === '큐레이션' ? Math.max(rule?.quotes || 0, people.length * 2) : (rule?.quotes ?? 2);
    if (quoted.length - bad < need) errors.push(`실제 인용(> 줄)이 ${quoted.length - bad}개입니다(이 폼은 ${need}개 이상). 고객 후기와 상담사 글을 더 넣어 내용을 채우세요.`);
    else if (!bad) ok.push(`인용 ${quoted.length}개 모두 소재와 일치`);
    // 상담사 내용 활용: 상담사가 직접 쓴 말(포스팅·답글·공지·소개)과 고객의 긴 이야기를 실제로 썼는지
    const n = (t) => quotedFrom.filter((q) => (t === 'own' ? q.type === 'own' || q.type === 'post' : q.type === t)).length;
    const hasStories = sourcesOfQuote.some((q) => q.type === 'story');
    const hasOwn = sourcesOfQuote.some((q) => q.type === 'post' || q.type === 'own');
    if (rule?.own && hasOwn && n('own') < rule.own) errors.push(`상담사가 직접 쓴 말(포스팅·답글·공지·소개) 인용이 ${n('own')}개입니다(${rule.own}개 이상). 상담사 내용을 더 살리세요.`);
    else if (rule?.own && hasOwn) ok.push(`상담사가 직접 쓴 말 인용 ${n('own')}개`);
    if (rule?.story && hasStories && n('story') < rule.story) errors.push(`고객이 쓴 긴 이야기(베스트 후기·상담사 PICK) 인용이 ${n('story')}개입니다(${rule.story}개 이상). 재료의 "고객이 직접 쓴 긴 이야기"에서 고르세요.`);
    else if (rule?.story && hasStories) ok.push(`고객의 긴 이야기 인용 ${n('story')}개`);
    if (meta['폼'] === '큐레이션') for (const x of people) { const k = quotedFrom.filter((q) => q.nick === x.nick).length; if (k < 2) errors.push(`${x.nick} 상담사의 인용이 ${k}개입니다(상담사마다 2개 이상).`); }
    // 상담사 포스팅을 인용했으면 누구 글인지 밝히고 그 상담사 프로필을 건다
    for (const f of quotedFrom.filter((x) => x.post)) {
      if (!body.includes(f.nick)) errors.push(`포스팅을 인용한 상담사 이름(${f.nick})이 본문에 없습니다. 누구 글인지 밝히세요.`);
      if (f.url && !body.includes(f.url)) errors.push(`포스팅을 인용한 ${f.nick} 상담사의 프로필 링크가 없습니다: ${f.url}`);
    }
    // 주간 타로: 도구가 뽑은 카드와 방향을 그대로 썼는지
    for (const c of cards.filter((x) => x.kind === 'week')) {
      for (const card of c.cards) {
        const at = body.indexOf(card.name);
        if (at < 0) errors.push(`뽑힌 카드 "${card.name}"(${card.role})가 본문에 없습니다.`);
        else if (!body.includes(`${card.name} ${card.direction}`) && !body.includes(`${card.name}(${card.direction})`) && !body.includes(`${card.name}, ${card.direction}`)) errors.push(`"${card.name}"의 방향(${card.direction})을 "${card.name} ${card.direction}"처럼 밝히세요. 도구가 뽑은 방향과 달라지면 안 됩니다.`);
      }
      const other = MAJOR.map((m) => m[0]).filter((nm) => !c.cards.some((k) => k.name === nm) && nm.length >= 3 && new RegExp(`${nm} (정방향|역방향)`).test(body));
      if (other.length) errors.push(`뽑지 않은 카드가 나옵니다: ${other.join(', ')}`);
      else ok.push(`카드 3장(${c.cards.map((k) => `${k.name} ${k.direction}`).join(', ')}) 뽑은 그대로`);
    }
    // 숫자: 건·%·코인·점·개·명 앞 숫자는 소재에 있어야 한다
    const known = numbersIn(cards);
    const own = text.split('\n').filter((l) => !pool.some((p) => l.replace(/\s+/g, ' ').trim() && p.includes(l.replace(/^["“”']|["“”']$/g, '').split(/…|\.\.\./)[0].replace(/\s+/g, ' ').trim()))).join('\n');
    const used = [...own.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(건|%|코인|점|개|명|번|시)/g)].map((m) => ({ n: m[1].replace(/,/g, ''), unit: m[2], at: m.index }));
    const small = (u) => (u.unit === '개' || u.unit === '명') && Number(u.n) <= 10;
    const unknown = used.filter((u) => !known.has(u.n) && !small(u));
    for (const u of unknown.slice(0, 8)) errors.push(`소재에 없는 숫자: ${u.n}${u.unit} ("${own.slice(Math.max(0, u.at - 15), u.at + 12).replace(/\n/g, ' ')}")`);
    if (!unknown.length) ok.push(`숫자 ${used.length}개 모두 소재와 일치`);
    const urls = cards.flatMap((c) => [c.profileUrl, ...(c.items || []).map((x) => x.profileUrl)]).filter(Boolean);
    const missing = urls.filter((u) => !body.includes(u));
    if (missing.length) errors.push(`프로필 링크가 빠졌습니다: ${missing.slice(0, 3).join(', ')}`); else if (urls.length) ok.push('프로필 링크 포함');
    // 주간·칼럼 글은 홍보 글이 아니어도 홍카페로 이어지는 링크가 하나는 있어야 한다
    if (!urls.length && !/https:\/\/www\.hongcafe\.com\/\S+/.test(body)) errors.push('홍카페 링크(상담사 프로필 등)가 하나도 없습니다.');
    if (meta['폼'] === '큐레이션' && !/순서|기준/.test(text.slice(0, 700))) errors.push('큐레이션 글은 앞부분에 고른 기준(무슨 숫자 순서인지)을 밝혀야 합니다.');
  }
  console.log(`초안 검사: ${path.basename(file)} (${meta['폼'] || '?'} · 제목 "${title}")`);
  ok.forEach((x) => console.log(`  ✔ ${x}`));
  warns.forEach((x) => console.log(`  ⚠ ${x}`));
  errors.forEach((x) => console.log(`  ✖ ${x}`));
  console.log(errors.length ? `결과: 고칠 곳 ${errors.length}개` : `결과: 통과${warns.length ? ` (참고 ${warns.length}개)` : ''}`);
  process.exit(errors.length ? 1 : 0);
}

// ---------- 명령 ----------
async function main() {
  if (cmd === 'check') {
    const f = argv[1];
    if (!f || !fs.existsSync(f)) { console.log('검사할 초안 파일 경로를 주세요.'); process.exit(2); }
    return checkDraft(path.resolve(f));
  }
  if (!['pick', 'card', 'topics', 'topic', 'week', 'posts'].includes(cmd)) {
    console.log('사용: node blog.cjs pick | card <예명> | topics | topic <분야> | week | posts <낱말> | check <초안.md>  (자세한 설명은 파일 맨 위·블로그-폼.md)');
    process.exit(cmd ? 2 : 0);
  }
  const groups = loadGroups();
  const category = arg('--category');
  if (cmd === 'week') {
    const w = weekInfo(arg('--week'));
    // 최근 7일 후기에 붙은 분야 태그
    const cutoff = Date.now() - 7 * 86400e3;
    const recent = (p) => loadReviews(p.code).concat(p.reviews7d || []).filter((r) => new Date(String(r.date).replace(/\./g, '-').replace(' ', 'T')).getTime() >= cutoff);
    const tags = new Map();
    const per = [];
    let reviews = 0;
    for (const [ce, list] of groups) {
      const seen = new Set();
      const mine = new Map();
      for (const p of list) for (const r of recent(p)) {
        if (seen.has(String(r.no))) continue;
        seen.add(String(r.no)); reviews++;
        for (const k of String(r.field || '').split(',').map((s) => s.trim()).filter(Boolean)) { tags.set(k, (tags.get(k) || 0) + 1); mine.set(k, (mine.get(k) || 0) + 1); }
      }
      per.push({ ce, list, mine });
    }
    const fields = withShare([...tags.entries()].map(([name, cnt]) => ({ name, cnt })).sort((a, b) => b.cnt - a.cnt), 8);
    const themes = fields.filter((f) => f.name !== '고민');
    const theme = arg('--theme') || themes[0]?.name;
    if (!theme) { console.log('최근 7일 후기가 없습니다. 먼저 수집하세요.'); process.exit(2); }
    const counselors = per.filter((x) => (x.mine.get(theme) || 0) > 0 && (x.list[0].recent3m?.reviews || 0) >= 30)
      .sort((a, b) => b.mine.get(theme) - a.mine.get(theme)).slice(0, 3).map((x) => {
        const c = buildCard(x.ce, x.list);
        return { nick: c.nick, number: c.number, category: c.category, profileUrl: c.profileUrl, themeCnt: x.mine.get(theme), price: c.facts.price, unit: c.facts.unit, styles: c.styles.slice(0, 2), quotes: quotesFor(x.list, { field: theme, max: 3 }) };
      });
    // 그 고민을 다룬 상담사 포스팅(상담사가 직접 쓴 조언). 카드 풀이에 전문가의 말을 엮는 재료
    const themePosts = [];
    for (const [ce, list] of groups) {
      if (!ce.startsWith('CE-')) continue;
      for (const t of readJson(path.join(RAW, '포스팅', `${ce}.json`), { items: [] }).items || []) {
        const text = String(t.content || '');
        if (text.length < 300 || !(t.title + text).includes(theme) || SENSITIVE.test(t.title)) continue;
        themePosts.push({ nick: list[0].nick, number: list[0].number060 || '', category: t.category || categoryOf(list[0]), profileUrl: list[0].url, title: t.title, date: String(t.date).slice(0, 10), views: t.views || 0, text: maskContacts(text).slice(0, 1800) });
      }
    }
    themePosts.sort((a, b) => b.views - a.views);
    const doc = { version: 1, kind: 'week', asOf: today(), week: w, reviews7d: reviews, theme, themeWord: FIELD_WORD[theme] || theme, fields, cards: drawCards(w.id), counselors, posts: themePosts.slice(0, 5),
      keywords: [`주간 타로 ${w.label.split('~')[0]}`, `${FIELD_WORD[theme] || theme} 타로`, `이번 주 타로 운세`, `${FIELD_WORD[theme] || theme} 전화타로`] };
    const base = path.join(BLOG, '주간', w.id);
    writeAtomic(`${base}.json`, `${JSON.stringify(doc, null, 1)}\n`);
    const L = [`# 주간 타로 이야기 재료: ${w.id} (${w.label})`, '', `- 기준일: ${doc.asOf} · 최근 7일 후기 ${reviews.toLocaleString()}건의 분야 태그`,
      `- 이번 주 많았던 고민: ${pct(fields)}`, `- 이번 글의 주제: **${theme}** ('고민' 태그는 뜻이 넓어 주제에서 뺀다. 바꾸려면 --theme <분야>)`, '',
      '## 뽑힌 카드 (도구가 주 이름으로 뽑았다. 바꾸지 않는다. 글에는 "카드 이름 방향"으로 적는다)',
      ...doc.cards.map((c) => `- ${c.role}: **${c.name} ${c.direction}** (${c.en}) — ${c.keywords.join(' · ')}`), '',
      `## 이번 주 '${theme}' 후기가 많았던 상담사 (글 끝에 한두 명만 가볍게 소개한다. 순서는 최근 7일 '${theme}' 후기 수)`];
    for (const c of counselors) {
      L.push(`- ${c.nick} ${c.number}번 (${c.category}) · 최근 7일 '${theme}' 후기 ${c.themeCnt}건 · ${c.price ?? '-'}코인/${c.unit || '-'} · ${pct(c.styles)} · ${c.profileUrl}`);
      c.quotes.forEach((q, i) => L.push(`  ${i + 1}. [${q.date} · ${q.field}] ${q.text}`));
    }
    if (doc.posts.length) {
      L.push('', `## '${theme}'를 다룬 상담사 포스팅 (카드 풀이에 선생님의 말을 엮는다. 인용하면 이름과 프로필 링크를 넣는다)`);
      doc.posts.forEach((p, i) => L.push(`### ${i + 1}. ${p.title}`, `- ${p.nick} ${p.number}번 (${p.category}) · ${p.date} · 조회 ${p.views.toLocaleString()} · ${p.profileUrl}`, '```', p.text, '```', ''));
    }
    L.push('', `## 노릴 검색어`, `- ${doc.keywords.join(' , ')}`);
    writeAtomic(`${base}.md`, `${L.join('\n')}\n`);
    console.log(`주간 재료 ${w.id} (${w.label}): 최근 7일 후기 ${reviews}건 · 주제 '${theme}' · 카드 ${doc.cards.map((c) => `${c.name} ${c.direction}`).join(' / ')} · 상담사 ${counselors.map((c) => c.nick).join(', ')}`);
    console.log(`저장: ${base}.md\n      ${base}.json`);
    return undefined;
  }
  if (cmd === 'posts') {
    const word = argv[1];
    const top = Number(arg('--top', 6));
    if (!word || word.startsWith('--')) { console.log('찾을 낱말을 주세요. 예: node blog.cjs posts 생년월일 --category 신점'); process.exit(2); }
    const hits = [];
    for (const [ce, list] of groups) {
      if (!ce.startsWith('CE-')) continue;
      const main = list[0];
      const cat = categoryOf(main);
      for (const t of readJson(path.join(RAW, '포스팅', `${ce}.json`), { items: [] }).items || []) {
        const text = String(t.content || '');
        if (text.length < 300 || !(t.title + text).includes(word)) continue;
        if (category && (t.category || cat) !== category) continue;
        if (SENSITIVE.test(t.title)) continue;
        hits.push({ nick: main.nick, number: main.number060 || '', category: t.category || cat, ceCode: ce, profileUrl: main.url, title: t.title, date: String(t.date).slice(0, 10), views: t.views || 0, text: text.slice(0, 2400) });
      }
    }
    hits.sort((a, b) => b.views - a.views);
    const posts = hits.slice(0, top);
    if (!posts.length) { console.log(`"${word}"가 든 300자 이상 포스팅이 없습니다(지금 활동하는 상담사 기준).`); process.exit(2); }
    const doc = { version: 1, kind: 'column', asOf: today(), keyword: word, category: category || '', found: hits.length, posts,
      keywords: [`${category || ''} ${word}`.trim(), `${word} 뜻`, `${word} ${category || '사주'}`, `홍카페 ${category || '상담'}`] };
    const base = path.join(BLOG, '칼럼재료', safeName(`${word}${category ? `_${category}` : ''}`));
    writeAtomic(`${base}.json`, `${JSON.stringify(doc, null, 1)}\n`);
    const L = [`# 칼럼 재료: "${word}"${category ? ` (${category})` : ''}`, '', `- 기준일: ${doc.asOf} · 찾은 포스팅 ${hits.length}개 가운데 조회수 상위 ${posts.length}개`,
      '- 상담사가 홍카페에 직접 쓴 글이다. 인용할 때는 문장을 그대로 옮기고(줄일 때만 …), 누구 글인지 밝히고, 그 상담사 프로필을 건다.',
      '- 한 포스팅을 통째로 옮기지 않는다. 한 글에서 두세 문장까지만 인용하고 나머지는 우리 말로 설명한다.', ''];
    posts.forEach((p, i) => L.push(`## ${i + 1}. ${p.title}`, `- ${p.nick} ${p.number}번 (${p.category}) · ${p.date} · 조회 ${p.views.toLocaleString()} · ${p.profileUrl}`, '', '```', p.text, '```', ''));
    writeAtomic(`${base}.md`, `${L.join('\n')}\n`);
    console.log(`칼럼 재료 "${word}": 포스팅 ${hits.length}개 가운데 ${posts.length}개`);
    posts.forEach((p, i) => console.log(`  ${i + 1}. [${p.category}] ${p.nick} ${p.number}번 · 조회 ${p.views} · ${p.date} · ${p.title.slice(0, 40)}`));
    console.log(`저장: ${base}.md\n      ${base}.json`);
    return undefined;
  }
  if (cmd === 'pick') {
    const top = Number(arg('--top', 20));
    const rows = [...groups.entries()].map(([ce, list]) => {
      const main = list[0];
      return { ce, list, nick: main.nick, number: main.number060 || '', cat: categoryOf(main), total: totalReviews(main) || 0, r3: main.recent3m?.reviews || 0, r7: list.reduce((n, p) => n + (p.reviews7d || []).length, 0) };
    }).filter((r) => (!category || r.cat === category) && r.r3 >= 30).sort((a, b) => b.r7 - a.r7 || b.r3 - a.r3).slice(0, top);
    console.log(`소개 글 후보(최근 3개월 후기 30건 이상, 최근 7일 후기 많은 순${category ? `, ${category}` : ''}) — 기준일 ${today()}`);
    for (const r of rows) console.log(`- ${r.nick}${r.number ? ` ${r.number}번` : ''} [${r.cat || '?'}] 최근 7일 ${r.r7}건 · 3개월 ${r.r3}건 · 누적 ${r.total.toLocaleString()}건 · 인용 후보 ${quotesFor(r.list, { max: 12 }).length}개 · ${r.ce}`);
    console.log('카드 만들기: node blog.cjs card <상담사코드>');
    return undefined;
  }
  if (cmd === 'card') {
    const q = argv[1];
    if (!q) { console.log('예명이나 상담사코드를 주세요. 예: node blog.cjs card 베리'); process.exit(2); }
    const hit = findGroup(groups, q);
    if (!hit.length) { console.log(`"${q}" 상담사를 찾지 못했습니다.`); process.exit(2); }
    if (hit.length > 1) {
      console.log(`"${q}"가 ${hit.length}명입니다. 상담사코드로 다시 지정하세요:`);
      hit.forEach(([ce, l]) => console.log(`- ${l[0].nick} ${l[0].number060 || ''}번 [${categoryOf(l[0])}] ${ce}`));
      process.exit(2);
    }
    const card = buildCard(hit[0][0], hit[0][1], 24);
    await enrich(card, hit[0][1]);
    const base = path.join(CARD_DIR, safeName(`${card.nick}_${card.number || card.ceCode}`));
    writeAtomic(`${base}.json`, `${JSON.stringify(card, null, 1)}\n`);
    writeAtomic(`${base}.md`, cardMarkdown(card));
    console.log(`소재 카드: ${card.nick}${card.number ? ` ${card.number}번` : ''} [${card.category}] · 누적 후기 ${card.facts.reviewsTotal ?? '-'}건 · 짧은 후기 ${card.quotes.length}개 · 긴 이야기 ${card.stories.length}개 · 상담사 답글 ${card.replies.length}개 · 포스팅 ${card.posts.length}개${card.warnings.length ? ` · 주의 ${card.warnings.length}개` : ''}`);
    card.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    console.log(`저장: ${base}.md\n      ${base}.json`);
    return undefined;
  }
  if (cmd === 'topics') {
    const all = sumBy([...groups.values()].flatMap((l) => l.map((p) => p.stats?.fields)));
    console.log(`고민 분야(후기 태그 합계)와 노릴 검색어 — 기준일 ${today()}`);
    for (const f of all) {
      if (f.name === '고민') continue;
      const w = FIELD_WORD[f.name] || f.name;
      const n = topicRows(groups, f.name, null, 30).length;
      console.log(`- ${f.name}: 후기 ${f.cnt.toLocaleString()}건 · 최근 3개월 30건 이상 상담사 ${n}명 · 검색어 예: ${w} 타로 잘보는곳, ${w} 전화신점, 홍카페 ${w}`);
    }
    console.log('묶음 재료: node blog.cjs topic <분야> [--category 타로|신점|사주] [--top 5]');
    return undefined;
  }
  // topic
  const field = argv[1];
  const top = Number(arg('--top', 5));
  const min3m = Number(arg('--min3m', 30));
  if (!field || field.startsWith('--')) { console.log('분야를 주세요. 목록: node blog.cjs topics'); process.exit(2); }
  const rows = topicRows(groups, field, category, min3m).slice(0, top);
  if (!rows.length) { console.log(`"${field}" 분야에서 조건(최근 3개월 후기 ${min3m}건 이상${category ? `, ${category}` : ''})에 맞는 상담사가 없습니다.`); process.exit(2); }
  const w = FIELD_WORD[field] || field;
  const cat = category || '';
  const doc = {
    version: 1, kind: 'topic', asOf: today(), field, category: cat,
    criteria: `'${field}' 분야 후기 태그 수가 많은 순서(최근 3개월 후기 ${min3m}건 이상인 상담사${cat ? `, ${cat}` : ''})`,
    keywords: [`${w} ${cat || '타로'} 잘보는곳`, `${w} 전화${cat || '타로'}`, `홍카페 ${w}`, `${w} 상담 추천`],
    items: [],
  };
  for (const [i, r] of rows.entries()) {
    const c = buildCard(r.ce, r.list);
    await enrich(c, r.list, { stories: 20, replies: 3, posts: 3 });
    const fq = quotesFor(r.list, { field, max: 6 });
    // 긴 이야기는 그 고민 태그가 붙은 것을 먼저, 모자라면 다른 것으로 채운다
    const st = [...c.stories.filter((s) => String(s.field).includes(field)), ...c.stories.filter((s) => !String(s.field).includes(field))].slice(0, 4);
    doc.items.push({ rank: i + 1, nick: c.nick, number: c.number, category: c.category, ceCode: c.ceCode, profileUrl: c.profileUrl, fieldCnt: r.fieldCnt, fieldShare: r.share,
      facts: c.facts, styles: c.styles.slice(0, 3), career: c.career, reading: c.reading, headline: c.headline, intro: c.intro.slice(0, 500), quotes: fq.length ? fq : c.quotes.slice(0, 3), quotesAreFieldTagged: fq.length > 0,
      stories: st, replies: c.replies, posts: c.posts });
  }
  const base = path.join(TOPIC_DIR, safeName(`${field}${cat ? `_${cat}` : ''}_TOP${rows.length}`));
  writeAtomic(`${base}.json`, `${JSON.stringify(doc, null, 1)}\n`);
  const L = [`# 큐레이션 재료: '${field}' ${cat} 상담사 ${rows.length}명`, '', `- 기준일: ${doc.asOf}`, `- 고른 기준(글 앞부분에 그대로 밝힌다): ${doc.criteria}`, `- 노릴 검색어: ${doc.keywords.join(' , ')}`, ''];
  for (const it of doc.items) {
    L.push(`## ${it.rank}. ${it.nick}${it.number ? ` ${it.number}번` : ''} (${it.category})`, `- 프로필: ${it.profileUrl}`,
      `- '${field}' 후기 태그 ${it.fieldCnt.toLocaleString()}건(이 상담사 후기 태그의 ${it.fieldShare}%) · 누적 후기 ${it.facts.reviewsTotal?.toLocaleString() ?? '-'}건 · 최근 3개월 ${it.facts.recent3mReviews ?? '-'}건 · 5점 만족도 ${it.facts.recent3mFiveRate ?? '-'}% · ${it.facts.price ?? '-'}코인/${it.facts.unit || '-'}`,
      `- 스타일: ${pct(it.styles)}`, `- 한 줄 소개: ${it.headline.join(' / ')}`, `- 약력: ${it.career.join(' / ') || '-'}`, `- 리딩정보: ${it.reading.slice(0, 3).join(' / ') || '-'}`,
      `- 인용할 수 있는 후기${it.quotesAreFieldTagged ? `('${field}' 태그 후기)` : '(이 분야 태그 후기가 없어 다른 후기)'}:`);
    it.quotes.forEach((q, i) => L.push(`  ${i + 1}. [${q.date} · ${q.field || '분야 없음'}] ${q.text}`));
    if (it.intro) L.push('- 상담사가 쓴 서비스 소개:', '```', it.intro, '```');
    richMarkdown(it, L);
    L.push('');
  }
  writeAtomic(`${base}.md`, `${L.join('\n')}\n`);
  console.log(`큐레이션 재료: '${field}' ${cat} ${rows.length}명 — ${doc.criteria}`);
  doc.items.forEach((it) => console.log(`  ${it.rank}. ${it.nick} ${it.number}번 · '${field}' ${it.fieldCnt.toLocaleString()}건(${it.fieldShare}%) · 인용 ${it.quotes.length}개`));
  console.log(`저장: ${base}.md\n      ${base}.json`);
  return undefined;
}
main().catch((e) => { console.error(`오류: ${e.message}`); process.exit(1); });
