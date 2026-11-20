// 홍카페 상담사 공개 프로필 수집 도구
// 사이트맵의 모든 상담사 프로필(전화 items/profile, 채팅 chat/profile)을 읽어 상세정보·판매상품·최근 7일 후기·포스팅·통계를
// 보관함/상담사데이터/원본/에 상담사별 JSON으로 저장한다. 공개 페이지만 읽고 로그인·글쓰기는 하지 않는다.
// 대표 결정(2026-11-16): 전체 상담사, 후기는 최근 7일만, 후기 작성자 닉네임은 저장하지 않는다. 1:1문의 내용은 모으지 않는다(건수만).
// 대표 결정(2026-11-20): 받는 범위는 그대로 최근 7일이지만, 한 번 모은 후기는 지우지 않고 원본/후기/<프로필 코드>.json 에 쌓는다(블로그 인용 재료).
//   회차가 끝나면 원본/추이/<회차>.json 에 상담사별 후기 수·평점·가격을 한 줄씩 남긴다(주간 변화 비교용).
//
// 사용: node collect.cjs                 이어서 수집(기본 8분 동안, 다 못 하면 다음 실행이 이어 감)
//       node collect.cjs --minutes 5     이번 실행 시간 제한(분)
//       node collect.cjs --only <코드>   한 프로필만 시험 수집(진행 상태는 건드리지 않음)
//       node collect.cjs --restart       진행 중인 회차를 버리고 새 회차 시작
//       node collect.cjs --status        진행 상태만 보기
'use strict';
const { fs, path, ROOT, RAW, STATE, LOG, SITE, REVIEW_DIR, TREND_DIR, readJson, writeAtomic, kst, htmlText, siteDate, maskContacts, request,
  deriveProfile, cleanSections, archiveReviews, writeSnapshot } = require('./lib.cjs');

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
// 기본 1.5분: 셸 명령 기본 제한 시간(2분) 안에 끝난다. 제한 시간을 10분으로 늘린 셸에서는 --minutes 9 로 돌리면 빠르다
const MINUTES = Number(arg('--minutes') || 1.5);
const ONLY = arg('--only');
const REVIEW_DAYS = 7;
const WORKERS = 2;
const POSTING_DIR = path.join(RAW, '포스팅');
const LOCK = path.join(ROOT, '.수집중');

const CODE_RE = /\/(items|chat)\/profile\/((?:IT|CH)-\d{14}-\d{3})/;

// ---------- 사이트맵 ----------
async function sitemapCodes() {
  const seen = new Map();
  const queue = [`${SITE}/sitemap.xml`];
  for (let i = 0; i < queue.length && i < 30; i++) {
    const r = await request(queue[i]);
    const xml = r?.body || '';
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      const loc = m[1];
      if (/<sitemap>/.test(xml) && /\.xml(\?|$)/.test(loc)) { queue.push(loc); continue; }
      const c = loc.match(CODE_RE);
      if (c && !seen.has(c[2])) seen.set(c[2], { code: c[2], flag: c[1] === 'chat' ? 'chat' : 'call', url: `${SITE}/${c[1]}/profile/${c[2]}` });
    }
  }
  return [...seen.values()];
}

// ---------- 프로필 페이지 해석 ----------
function ldBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try { out.push(...[].concat(JSON.parse(m[1]))); } catch { /* 깨진 블록은 건너뜀 */ }
  }
  return out;
}
// 페이지의 구역 표시 주석(<!-- s:이름 --> … <!-- e:이름 -->)으로 구역을 나눈다.
// 시작 표시만 있으면 다음 표시까지, 끝 표시만 있으면 앞 표시부터 그 끝까지를 그 구역으로 본다.
function markerSections(html) {
  const marks = [...html.matchAll(/<!--\s*([se]):\s*([\s\S]{0,120}?)\s*-->/g)].map((m) => ({
    t: m[1], name: m[2].split(/\s[—–]\s|\s\(|\s—/)[0].trim().slice(0, 40), start: m.index, end: m.index + m[0].length,
  }));
  const sections = {};
  marks.forEach((m, i) => {
    if (!m.name || m.name.startsWith('[') || sections[m.name]) return;
    let from;
    let to;
    if (m.t === 's') {
      const close = marks.slice(i + 1).find((x) => x.t === 'e' && x.name === m.name);
      from = m.end;
      to = close && close.start - m.end < 400000 ? close.start : (marks[i + 1]?.start ?? html.length);
    } else {
      if (marks.slice(0, i).some((x) => x.t === 's' && x.name === m.name)) return;
      from = marks[i - 1]?.end ?? 0;
      to = m.start;
    }
    const raw = html.slice(from, to);
    const text = htmlText(raw);
    if (text) sections[m.name] = { text: text.slice(0, 20000), html: raw };
  });
  return sections;
}
const num = (s) => (s === undefined || s === null || s === '' ? null : Number(String(s).replace(/,/g, '')));
// 사이트가 목록(['재회'])이나 글자로 주는 칸을 글자로 맞춘다
const joinList = (v) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : String(v ?? ''));

function parseProfile(html, item) {
  const ld = ldBlocks(html);
  const person = ld.find((x) => x['@type'] === 'Person') || {};
  const service = ld.find((x) => x['@type'] === 'Service') || {};
  const faq = ld.find((x) => x['@type'] === 'FAQPage');
  const secs = markerSections(html);
  const text = htmlText(html);
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const head = text.match(/(\S+)\s+(\d{2,4})\s*번\s*([\d,]+)\s*\(\s*(\d+\s*[초분])\s*\)/);
  // 탭은 있는 것만 나온다(판매상품·포스팅이 없는 상담사는 줄 자체가 없다). 한 줄씩 따로 읽는다
  const tabBlock = (text.match(/상세정보\n((?:(?:판매상품|후기|1:1문의|포스팅)[^\n]*\n){1,4})/) || [])[1] || '';
  const tabNum = (label) => { const m = tabBlock.match(new RegExp(`(?:^|\\n)${label}\\s*([\\d,]+)`)); return m ? num(m[1]) : null; };
  const hours = text.match(/주 상담시간[\s\S]{0,60}?(\d{1,2})\s*시\s*~\s*(\d{1,2})\s*시/);
  const total = text.match(/누적상담후기\s*([\d,]+)\s*건/);
  const five = text.match(/누적 5점\s*([\d,]+)\s*개/);
  const replies = text.match(/누적상담사댓글\s*([\d,]+)\s*건/);
  const star = text.match(/누적별점\s*([\d.]+)/);
  const education = [...new Set([...text.matchAll(/\[\s*([^\]\s]+)\s*\]\s*교육\s*이수/g)].map((m) => m[1]))];

  // 판매상품: 판매상품 구역과 "판매중인 서비스" 구역의 다른 상품 링크
  const zones = [secs['판매상품']?.html || ''];
  const k = html.indexOf('판매중인 서비스');
  if (k >= 0) zones.push(html.slice(k, k + 30000));
  const products = [];
  for (const z of zones) {
    for (const m of z.matchAll(/href="(https:\/\/www\.hongcafe\.com\/([a-z]+)\/[a-z]+\/([A-Z]{2}-\d{14}-\d{3}))"/g)) {
      if (m[3] === item.code || products.some((p) => p.code === m[3])) continue;
      const after = htmlText(z.slice(m.index, m.index + 1500)).split('\n').slice(0, 12).join(' ');
      const price = after.match(/([\d,]+)\s*\(\s*([^)]+?)\s*\)/);
      const state = (after.match(/상담중|상담가능|부재중|접속알림신청|휴무|판매중|품절/) || [])[0] || '';
      products.push({ code: m[3], kind: m[2] === 'chat' ? '채팅상담' : m[2] === 'items' ? '전화상담' : m[2], url: m[1],
        text: after.slice(0, 200), price: price ? num(price[1]) : null, unit: price ? price[2] : '', state });
    }
  }
  const pick = (name) => secs[name]?.text || '';
  const secText = Object.fromEntries(Object.entries(secs).map(([n, v]) => [n, v.text]));
  const base = {
    code: item.code, flag: item.flag, url: item.url,
    ceCode: (html.match(/CE-\d{14}-\d{3}/) || [])[0] || null,
    nick: person.name || head?.[1] || title.split(' ')[0] || '',
    pageTitle: title,
    jobTitle: htmlText(person.jobTitle || '').slice(0, 300),
    serviceName: htmlText(service.name || '').slice(0, 300),
    description: htmlText(person.description || service.description || '').slice(0, 5000),
    knowsAbout: person.knowsAbout || [],
    keywordsLd: service.keywords || '',
    image: person.image || '',
    rating: num(service.aggregateRating?.ratingValue),
    reviewCountLd: num(service.aggregateRating?.reviewCount),
    number060: head?.[2] || '',
    price: head ? num(head[3]) : null,
    unit: head ? head[4].replace(/\s+/g, '') : '',
    tabs: tabBlock ? { products: tabNum('판매상품'), reviews: tabNum('후기'), qna: tabNum('1:1문의'), postings: tabNum('포스팅') } : {},
    hours: hours ? `${hours[1]}시~${hours[2]}시` : '',
    reviewStats: total || five || replies ? { total: total ? num(total[1]) : null, fivePoint: five ? num(five[1]) : null, replies: replies ? num(replies[1]) : null, star: star ? Number(star[1]) : null } : null,
    education,
    greeting: pick('인사말'),
    notice: pick('상담사 공지'),
    serviceIntro: pick('서비스 소개'),
    inside: pick('상담사 인사이드'),
    recentChange: pick('최근 변화'),
    sections: cleanSections(secText),
    // 답변에 화면 코드가 통째로 들어오는 상담사가 있다(원본 용량의 절반을 차지했다). 글자만 남긴다
    faq: faq ? (faq.mainEntity || []).map((q) => ({ q: htmlText(q.name || ''), a: htmlText(q.acceptedAnswer?.text || '').slice(0, 1500) })) : [],
    products,
  };
  // 최근 3개월 후기·만족도, 채팅 가격, 등급, 약력·리딩정보는 구역 원문에서 뽑는다(이미 모은 원본도 tidy.cjs가 같은 함수로 고친다)
  return { ...base, ...deriveProfile(base, secText) };
}

// ---------- 데이터 주소(API) ----------
async function api(pathname, form, referer) {
  const r = await request(`${SITE}/api/${pathname}`, { form, referer, json: true });
  return r?.body && r.body.response === 'success' ? r.body : null;
}

async function recentReviews(item, cutoff) {
  const out = new Map();
  for (let offset = 0; offset < 3000; offset += 100) {
    const body = await api('comment/getItemComment', { offset, limit: 100, type: '', order: '', item_code: item.code, profilePage: 'true', item_flag: item.flag }, item.url);
    const items = body?.items || [];
    if (!body) break;
    let older = false;
    for (const it of items) {
      const d = siteDate(it.regist_date);
      if (!d || d < cutoff) { if (it.is_fixed !== 'Y') older = true; continue; }
      if (out.has(it.cm_no)) continue;
      // 작성자 닉네임(ac_nick)은 저장하지 않는다(대표 결정)
      out.set(it.cm_no, {
        no: it.cm_no, date: it.regist_date, point: num(it.cm_point), content: maskContacts(htmlText(it.cm_content)),
        duration: it.ca_duration ?? null, counselType: it.ca_type || '', best: it.best || '', field: joinList(it.cm_counsel_field), style: joinList(it.cm_style),
        help: num(it.help_cnt), like: num(it.cm_like_cnt), photo: !!it.cm_img_url, hasReply: !!(it.cm_reply && String(it.cm_reply).trim()),
        pinned: it.is_fixed === 'Y', status: it.cm_status ?? null,
      });
    }
    if (older || !body.next || !items.length) break;
  }
  return [...out.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

async function postings(ceCode, referer) {
  const file = path.join(POSTING_DIR, `${ceCode}.json`);
  const prev = readJson(file, { ceCode, items: [] });
  const known = new Map(prev.items.map((p) => [String(p.id), p]));
  const fresh = new Map();
  let complete = false;
  for (let offset = 0; offset < 20000; offset += 100) {
    // total을 빈 값으로 보내면 사이트가 500을 내므로 넣지 않는다. limit보다 1개 더 오는 것은 id로 겹침을 없앤다
    const body = await api('items/getPostingList', { offset, limit: 100, ce_code: ceCode }, referer);
    const items = body?.items || [];
    if (!body) break;
    let hitKnown = false;
    for (const p of items) {
      const id = String(p.pt_id);
      if (known.has(id)) hitKnown = true;
      fresh.set(id, {
        id, title: htmlText(p.pt_title), content: maskContacts(htmlText(p.pt_content)), date: p.display_date || p.regist_date || '',
        views: num(p.pt_view_cnt), likes: num(p.pt_like_cnt), comments: num(p.pt_comment_cnt), image: !!p.pt_img_url,
        category: p.it_category_name || '', itemCode: p.item_code || '', status: p.pt_status ?? null,
      });
    }
    if (!body.next || !items.length) { complete = true; break; }
    if (hitKnown && prev.items.length) break; // 이미 받은 글에 닿으면 멈춘다(맨 앞 100개는 늘 새로 받아 조회수 갱신)
  }
  const merged = new Map([...known, ...fresh]);
  const newCount = [...fresh.keys()].filter((id) => !known.has(id)).length;
  const items = [...merged.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  writeAtomic(file, `${JSON.stringify({ ceCode, updated: new Date().toISOString(), complete: complete || prev.complete || false, items }, null, 1)}\n`);
  return { total: items.length, newCount };
}

async function stats(item) {
  const [counsel, kw, trend] = [
    await api('comment/getProfileCounselStat', { item_code: item.code, more: 'true' }, item.url),
    await api('comment/getProfileKeyword', { item_code: item.code, item_flag: item.flag }, item.url),
    await api('comment/getProfileTagTrend', { item_code: item.code, item_flag: item.flag }, item.url),
  ];
  return {
    fields: (counsel?.field || []).map((x) => ({ name: x.name, cnt: num(x.cnt) })),
    styles: (counsel?.style || []).map((x) => ({ name: x.name, cnt: num(x.cnt) })),
    keywords: (kw?.keywords || []).map((x) => x.kw_text).filter(Boolean),
    trend: (trend?.items || []).map((x) => ({ type: x.tag_type, name: x.tag_name, trend: x.trend, curr: num(x.curr_cnt), prev: num(x.prev_cnt), diffRate: x.diff_rate })),
    trendDate: trend?.stat_date || '',
  };
}

async function collectOne(item, run) {
  const r = await request(item.url);
  if (!r || r.status === 404 || r.status === 410 || !r.body) return { gone: true, reason: `페이지 없음(${r?.status || '응답 없음'})` };
  if (!String(r.url || '').includes(item.code)) return { gone: true, reason: '다른 페이지로 이동됨(종료된 프로필로 보임)' };
  const profile = parseProfile(r.body, item);
  const cutoff = new Date(run.cutoff);
  profile.reviews7d = await recentReviews(item, cutoff);
  profile.reviewsSince = run.cutoff;
  const kept = archiveReviews(item.code, profile.reviews7d);
  profile.reviewsKept = kept.total;
  profile.stats = await stats(item);
  let post = null;
  if (profile.ceCode && !run.postingsDone[profile.ceCode]) {
    post = await postings(profile.ceCode, item.url);
    run.postingsDone[profile.ceCode] = true;
  }
  profile.collectedAt = new Date().toISOString();
  profile.runId = run.runId;
  writeAtomic(path.join(RAW, `${item.code}.json`), `${JSON.stringify(profile, null, 1)}\n`);
  return { profile, post, keptNew: kept.added };
}

// ---------- 회차 진행 ----------
function newRun(codes) {
  const now = new Date();
  return { runId: kst(now).replace(/[ :]/g, '').slice(0, 12), startedAt: now.toISOString(), cutoff: new Date(now.getTime() - REVIEW_DAYS * 86400e3).toISOString(),
    codes, next: 0, done: 0, gone: [], failed: [], postingsDone: {}, newReviews: 0, newPostings: 0, keptNew: 0, finishedAt: null };
}

async function main() {
  fs.mkdirSync(RAW, { recursive: true });
  fs.mkdirSync(POSTING_DIR, { recursive: true });
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  fs.mkdirSync(TREND_DIR, { recursive: true });
  if (argv.includes('--status')) {
    const s = readJson(STATE, null);
    if (!s) return console.log('아직 수집한 적이 없습니다.');
    console.log(`회차 ${s.runId}: ${s.done}/${s.codes.length} (실패 ${s.failed.length}, 없는 페이지 ${s.gone.length})${s.finishedAt ? ` · 완료 ${kst(new Date(s.finishedAt))}` : ' · 진행 중'}`);
    return;
  }
  if (ONLY) {
    const m = ONLY.match(/(?:IT|CH)-\d{14}-\d{3}/);
    if (!m) throw new Error('코드 형식이 아닙니다(예: IT-20230216112800-712)');
    const item = { code: m[0], flag: m[0].startsWith('CH') ? 'chat' : 'call', url: `${SITE}/${m[0].startsWith('CH') ? 'chat' : 'items'}/profile/${m[0]}` };
    const run = newRun([item]);
    const res = await collectOne(item, run);
    if (res.gone) return console.log(`${item.code}: ${res.reason}`);
    const p = res.profile;
    console.log(`${p.nick} (${p.code}) 수집: 판매상품 ${p.products.length} · 최근 7일 후기 ${p.reviews7d.length}(쌓인 후기 ${p.reviewsKept}, 새로 ${res.keptNew}) · 포스팅 전체 ${res.post?.total ?? '-'}(새 ${res.post?.newCount ?? 0}) · 상세 구역 ${Object.keys(p.sections).length}개`);
    console.log(`  탭 ${JSON.stringify(p.tabs)} · 최근 3개월 ${JSON.stringify(p.recent3m)} · 누적 ${JSON.stringify(p.reviewStats)} · 가격 ${p.price}/${p.unit} · 등급 ${p.grade} · 상담시간 ${p.hours} · 약력 ${p.career.length}줄 · 리딩정보 ${p.reading.length}줄`);
    console.log(`저장: ${path.join(RAW, `${p.code}.json`)}`);
    return;
  }

  // 잠금: 적힌 프로세스가 살아 있을 때만 다른 수집으로 본다(명령 제한 시간에 끊긴 실행은 바로 이어 받는다)
  if (fs.existsSync(LOCK)) {
    const pid = Number(fs.readFileSync(LOCK, 'utf8').trim());
    let alive = false;
    try { if (pid && pid !== process.pid) { process.kill(pid, 0); alive = true; } } catch { alive = false; }
    if (alive && Date.now() - fs.statSync(LOCK).mtimeMs < 15 * 60e3) {
      console.log('다른 수집이 진행 중입니다. 잠시 뒤 다시 실행하세요.');
      process.exit(3);
    }
  }
  fs.writeFileSync(LOCK, `${process.pid}\n`);
  process.on('exit', () => { try { fs.rmSync(LOCK, { force: true }); } catch { /* 없음 */ } });

  let run = readJson(STATE, null);
  if (!run || run.finishedAt || argv.includes('--restart')) {
    const codes = await sitemapCodes();
    if (!codes.length) { console.log('사이트맵에서 상담사 프로필을 찾지 못했습니다.'); process.exit(2); }
    run = newRun(codes);
    console.log(`새 회차 ${run.runId}: 사이트맵 상담사 프로필 ${codes.length}개(후기 기준 ${kst(new Date(run.cutoff))} 이후)`);
  }
  const deadline = Date.now() + MINUTES * 60e3;
  let thisRun = 0;
  const save = () => writeAtomic(STATE, `${JSON.stringify(run, null, 1)}\n`);
  async function worker() {
    while (Date.now() < deadline && run.next < run.codes.length) {
      const item = run.codes[run.next++];
      fs.utimesSync(LOCK, new Date(), new Date());
      try {
        const res = await collectOne(item, run);
        if (res.gone) {
          run.gone.push({ code: item.code, reason: res.reason });
          const f = path.join(RAW, `${item.code}.json`);
          const old = readJson(f, null);
          if (old) writeAtomic(f, `${JSON.stringify({ ...old, gone: true, goneAt: new Date().toISOString() }, null, 1)}\n`);
        } else {
          run.newReviews += res.profile.reviews7d.length;
          run.keptNew = (run.keptNew || 0) + (res.keptNew || 0);
          run.newPostings += res.post?.newCount || 0;
        }
      } catch (e) {
        run.failed.push({ code: item.code, reason: String(e.message || e).slice(0, 120) });
      }
      run.done++;
      thisRun++;
      save();
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker));
  const left = run.codes.length - run.next;
  if (!left) {
    run.finishedAt = new Date().toISOString();
    save();
    const snap = writeSnapshot(run.runId);
    console.log(`주간 추이 기록: ${snap.file} (프로필 ${snap.rows}개)`);
    const line = `- ${kst(new Date(run.startedAt))} 시작 → ${kst()} 완료: 프로필 ${run.codes.length}개, 최근 7일 후기 ${run.newReviews}건, 새 포스팅 ${run.newPostings}건, 쌓인 후기 새로 ${run.keptNew || 0}건, 없는 페이지 ${run.gone.length}, 실패 ${run.failed.length}`;
    const prev = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8') : '# 상담사 데이터 수집 기록\n';
    writeAtomic(LOG, `${prev.trimEnd()}\n${line}\n`);
  }
  console.log(`이번 실행: 프로필 ${thisRun}개 처리 · 전체 ${run.next}/${run.codes.length} · 최근 7일 후기 누적 ${run.newReviews}건 · 쌓인 후기 새로 ${run.keptNew || 0}건 · 새 포스팅 누적 ${run.newPostings}건 · 없는 페이지 ${run.gone.length} · 실패 ${run.failed.length}`);
  if (run.failed.length) console.log(`실패 예: ${run.failed.slice(-3).map((f) => `${f.code}(${f.reason})`).join(', ')}`);
  console.log(left ? `남은 상담사 ${left} — 같은 명령을 다시 실행하세요` : `남은 상담사 0 — 수집 완료. 이어서 node ${path.join(__dirname, 'export.cjs')} 로 엑셀을 만드세요`);
}

main().catch((e) => { console.error(`수집 중 오류: ${e.message}`); process.exit(1); });
