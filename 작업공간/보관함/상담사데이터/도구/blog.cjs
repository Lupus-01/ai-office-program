// 블로그 소재 도구: 수집 원본으로 블로그 글 재료를 만들고, 쓴 초안을 검사한다(2026-11-20).
// 글은 "홍카페 운영팀이 쓴 공식 소개"다. 고객이 쓴 체험 후기처럼 꾸미지 않는다(표시광고법상 기만 광고). 숫자·후기 인용은 이 도구가 만든 재료에 있는 것만 쓴다.
//
// 사용: node blog.cjs pick [--category 타로|신점|사주] [--top 20]     소개 글을 쓰기 좋은 상담사 후보
//       node blog.cjs card <예명|상담사코드|프로필 코드>                상담사 소재 카드(블로그/소재카드/)
//       node blog.cjs topics                                            고민 분야 목록과 노릴 검색어
//       node blog.cjs topic <분야> [--category 타로] [--top 5]          고민별 상담사 묶음 재료(블로그/큐레이션/)
//       node blog.cjs check <초안.md>                                   초안 검사(분량·사진 자리·금지 표현·숫자와 인용의 근거)
// 형식과 쓰는 법은 블로그-폼.md
'use strict';
const { fs, path, ROOT, RAW, TREND_DIR, readJson, writeAtomic, kst, loadReviews } = require('./lib.cjs');

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
const SENSITIVE = /병원|수술|암 |투병|임신|유산|낙태|사망|돌아가|장례|자살|죽고|폭력|폭행|우울증|공황|빚|대출|파산|이혼|소송|경찰|불륜|바람|유부|상간|가림\]/;
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
function buildCard(ce, list) {
  const main = list[0];
  const category = categoryOf(main) || categoryOf(list[list.length - 1]);
  const fields = sumBy(list.map((p) => p.stats?.fields));
  const styles = sumBy(list.map((p) => p.stats?.styles));
  const posts = ce.startsWith('CE-') ? (readJson(path.join(RAW, '포스팅', `${ce}.json`), { items: [] }).items || []) : [];
  const quotes = quotesFor(list, { max: 12 });
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
const pct = (list) => list.map((x) => `${x.name} ${x.share}%(${x.cnt.toLocaleString()}건)`).join(' · ');
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
  if (c.popularPosts.length) { L.push('', '## 상담사 포스팅 인기 글 (이 상담사가 어떤 주제에 강한지 보여 주는 재료)'); c.popularPosts.forEach((t) => L.push(`- ${t.title} (조회 ${t.views}, ${t.date})`)); }
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

// ---------- 초안 검사 ----------
const RULES = { 소개: { min: 1400, max: 2300, photos: 6, heads: 4 }, 큐레이션: { min: 1800, max: 3200, photos: 7, heads: 4 } };
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
  if (!rule) errors.push(`머리말의 폼이 "${meta['폼'] || ''}"입니다. 소개 또는 큐레이션이어야 합니다.`);
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
  if (!/홍카페/.test(title)) errors.push('제목에 "홍카페"가 없습니다.');
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
    const own = `${title}\n${body.replace(/^>.*$/gm, '')}`;
    const m = own.match(re);
    if (m) errors.push(`금지 표현 "${m[0]}": ${why}`);
  }
  // 프로필 주소 속 코드 숫자를 전화번호로 잘못 보지 않게 주소는 빼고 본다
  const noUrl = body.replace(/https?:\/\/\S+/g, ' ');
  if (/(?<![\d-])01[016789][-. ]?\d{3,4}[-. ]?\d{4}(?![\d-])|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(noUrl)) errors.push('연락처(휴대전화·메일)가 들어 있습니다.');
  if (!/홍카페[^\n]{0,30}(작성|운영팀)/.test(body)) errors.push('글쓴이 표기가 없습니다(예: "이 글은 홍카페 운영팀이 공개 프로필과 실제 이용 후기를 바탕으로 작성했습니다.").');
  if (cards.length) {
    const d = cards[0].asOf.split('-');
    const forms = [cards[0].asOf, `${d[0]}년 ${Number(d[1])}월 ${Number(d[2])}일`, `${d[0]}.${d[1]}.${d[2]}`];
    if (!forms.some((x) => body.includes(x))) errors.push(`기준일(${forms[1]})이 본문에 없습니다. 숫자는 "○○ 기준"을 밝힙니다.`);
    // 인용: > 로 시작하는 줄은 소재의 후기 문장이어야 한다
    const pool = cards.flatMap((c) => [...(c.quotes || []), ...(c.items || []).flatMap((x) => x.quotes || [])]).map((q) => q.text.replace(/\s+/g, ' '));
    const quoted = [...body.matchAll(/^>\s?(.+)$/gm)].map((m) => m[1].trim().replace(/^["“”']|["“”']$/g, ''));
    let bad = 0;
    for (const q of quoted) {
      const parts = q.split(/…|\.\.\./).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 6);
      if (!parts.length || !pool.some((p) => parts.every((s) => p.includes(s)))) { bad++; errors.push(`소재에 없는 후기 인용: "${q.slice(0, 40)}…" (후기를 지어내거나 고쳐 쓰지 않는다. 줄일 때만 … 사용)`); }
    }
    const need = meta['폼'] === '큐레이션' ? cards.flatMap((c) => c.items || []).length : 2;
    if (quoted.length - bad < need) errors.push(`실제 후기 인용(> 줄)이 ${quoted.length - bad}개입니다(소개는 2개 이상, 큐레이션은 상담사마다 1개 이상).`);
    else if (!bad) ok.push(`후기 인용 ${quoted.length}개 모두 소재와 일치`);
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
    if (missing.length) errors.push(`프로필 링크가 빠졌습니다: ${missing.slice(0, 3).join(', ')}`); else ok.push('프로필 링크 포함');
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
function main() {
  if (cmd === 'check') {
    const f = argv[1];
    if (!f || !fs.existsSync(f)) { console.log('검사할 초안 파일 경로를 주세요.'); process.exit(2); }
    return checkDraft(path.resolve(f));
  }
  if (!['pick', 'card', 'topics', 'topic'].includes(cmd)) {
    console.log('사용: node blog.cjs pick | card <예명> | topics | topic <분야> | check <초안.md>  (자세한 설명은 파일 맨 위·블로그-폼.md)');
    process.exit(cmd ? 2 : 0);
  }
  const groups = loadGroups();
  const category = arg('--category');
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
    const card = buildCard(hit[0][0], hit[0][1]);
    const base = path.join(CARD_DIR, safeName(`${card.nick}_${card.number || card.ceCode}`));
    writeAtomic(`${base}.json`, `${JSON.stringify(card, null, 1)}\n`);
    writeAtomic(`${base}.md`, cardMarkdown(card));
    console.log(`소재 카드: ${card.nick}${card.number ? ` ${card.number}번` : ''} [${card.category}] · 누적 후기 ${card.facts.reviewsTotal ?? '-'}건 · 인용 후보 ${card.quotes.length}개${card.warnings.length ? ` · 주의 ${card.warnings.length}개` : ''}`);
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
    items: rows.map((r, i) => {
      const c = buildCard(r.ce, r.list);
      const fq = quotesFor(r.list, { field, max: 4 });
      return { rank: i + 1, nick: c.nick, number: c.number, category: c.category, ceCode: c.ceCode, profileUrl: c.profileUrl, fieldCnt: r.fieldCnt, fieldShare: r.share,
        facts: c.facts, styles: c.styles.slice(0, 3), career: c.career, reading: c.reading, headline: c.headline, quotes: fq.length ? fq : c.quotes.slice(0, 3), quotesAreFieldTagged: fq.length > 0 };
    }),
  };
  const base = path.join(TOPIC_DIR, safeName(`${field}${cat ? `_${cat}` : ''}_TOP${rows.length}`));
  writeAtomic(`${base}.json`, `${JSON.stringify(doc, null, 1)}\n`);
  const L = [`# 큐레이션 재료: '${field}' ${cat} 상담사 ${rows.length}명`, '', `- 기준일: ${doc.asOf}`, `- 고른 기준(글 앞부분에 그대로 밝힌다): ${doc.criteria}`, `- 노릴 검색어: ${doc.keywords.join(' , ')}`, ''];
  for (const it of doc.items) {
    L.push(`## ${it.rank}. ${it.nick}${it.number ? ` ${it.number}번` : ''} (${it.category})`, `- 프로필: ${it.profileUrl}`,
      `- '${field}' 후기 태그 ${it.fieldCnt.toLocaleString()}건(이 상담사 후기 태그의 ${it.fieldShare}%) · 누적 후기 ${it.facts.reviewsTotal?.toLocaleString() ?? '-'}건 · 최근 3개월 ${it.facts.recent3mReviews ?? '-'}건 · 5점 만족도 ${it.facts.recent3mFiveRate ?? '-'}% · ${it.facts.price ?? '-'}코인/${it.facts.unit || '-'}`,
      `- 스타일: ${pct(it.styles)}`, `- 한 줄 소개: ${it.headline.join(' / ')}`, `- 약력: ${it.career.join(' / ') || '-'}`, `- 리딩정보: ${it.reading.slice(0, 3).join(' / ') || '-'}`,
      `- 인용할 수 있는 후기${it.quotesAreFieldTagged ? `('${field}' 태그 후기)` : '(이 분야 태그 후기가 없어 다른 후기)'}:`);
    it.quotes.forEach((q, i) => L.push(`  ${i + 1}. [${q.date} · ${q.field || '분야 없음'}] ${q.text}`));
    L.push('');
  }
  writeAtomic(`${base}.md`, `${L.join('\n')}\n`);
  console.log(`큐레이션 재료: '${field}' ${cat} ${rows.length}명 — ${doc.criteria}`);
  doc.items.forEach((it) => console.log(`  ${it.rank}. ${it.nick} ${it.number}번 · '${field}' ${it.fieldCnt.toLocaleString()}건(${it.fieldShare}%) · 인용 ${it.quotes.length}개`));
  console.log(`저장: ${base}.md\n      ${base}.json`);
  return undefined;
}
main();
