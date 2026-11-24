#!/usr/bin/env node
// 꼬리별 관측소 게시 장부와 댓글 대상: AI가 화면을 넘기며 읽던 일을 기록과 카페 자료에서 바로 뽑는다(읽기 전용, 글·댓글 등록 없음).
//
//   node 보관함/꼬리별/도구/cafe-ledger.cjs --out <장부.json> [--targets 20] [--style 아이스베어]
//   node 보관함/꼬리별/도구/cafe-ledger.cjs --check          네이버 카페 로그인만 확인(시작 전 점검용)
//
// 장부(이미 올린 글·댓글 단 글·쓴 영상·쓴 장소)는 프로그램의 게시 기록(.office/publications, video-publications.json)과 이전 핫플 글 파일에서 만든다.
// --targets N 을 주면 Aside 브라우저의 네이버 로그인으로 수다방 최근 글에서 댓글 대상 N건(작성자·제목·본문 요약·달린 댓글)과 핫플레이스 게시판 최근 글 제목을 읽는다.
// 회원 정보는 닉네임만 남긴다.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CAFE = '31520563', TALK_MENU = 44, HOT_MENU = 24;
// 프로그램이 이 카페에 글·댓글을 올리기 시작한 첫 글번호(2026-11-04). 이보다 앞선 글·댓글은 회원이 직접 쓴 것이다
const AUTO_FROM = 10475;
const root = path.resolve(__dirname, '..', '..', '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const fail = (message) => { console.error(message); process.exit(1); };
const checkOnly = args.includes('--check');
const out = opt('out');
const wanted = Math.max(0, Math.min(60, Number(opt('targets')) || 0));
// --style 닉네임,닉네임: 그 회원이 쓴 글·댓글을 말투 참고로 모은다("나"는 로그인한 내 닉네임)
const styleNames = opt('style') ? opt('style').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4) : [];
if (!out && !checkOnly) fail('--out <장부.json> 이 필요합니다.');

function asideBin() {
  const local = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Aside', 'CLI', 'current', 'aside.exe') : '';
  const home = path.join(process.env.HOME || process.env.USERPROFILE || '', '.aside', 'bin', 'aside');
  for (const p of [local, home]) if (p && fs.existsSync(p)) return p;
  return 'aside';
}
function repl(code) {
  const r = spawnSync(asideBin(), ['repl', '--json', '--file', '-'], { input: code, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 150000 });
  if (r.error) fail(`Aside를 실행하지 못했습니다(${r.error.message}). Aside 앱과 CLI가 설치돼 있는지 확인해 주세요.`);
  let parsed; try { parsed = JSON.parse(String(r.stdout || '').trim().split('\n').pop()); } catch { fail(`Aside 응답을 읽지 못했습니다: ${String(r.stdout || r.stderr).slice(-300)}`); }
  const text = (parsed.run?.content || []).map((c) => c.text || '').join('\n');
  const at = text.indexOf('AIO_RESULT');
  if (at < 0) fail(`카페 자료를 읽지 못했습니다: ${parsed.run?.error || text.slice(-300)}`);
  const end = text.indexOf('AIO_END', at);
  return JSON.parse(text.slice(at + 10, end < 0 ? undefined : end));
}

// 1) 기록에서 장부 만들기
const articleId = (url) => { let s = String(url || ''); for (let i = 0; i < 3; i++) { try { s = decodeURIComponent(s); } catch { break; } } const m = s.match(/articles\/(\d+)/) || s.match(/articleid=(\d+)/i) || s.match(/cafe\.naver\.com\/[a-z0-9_]+\/(\d+)(?:[?#]|$)/i); return m ? Number(m[1]) : null; };
const posted = new Set(), commented = new Set(), uncertain = [];
const pubDir = path.join(root, '.office', 'publications');
for (const name of fs.existsSync(pubDir) ? fs.readdirSync(pubDir) : []) {
  let r; try { r = JSON.parse(fs.readFileSync(path.join(pubDir, name), 'utf8')); } catch { continue; }
  if (r.service !== 'naver_cafe' || !/31520563|petdilab/.test(`${r.target} ${r.resultUrl}`)) continue;
  if (r.action === 'comment') { const id = articleId(r.target); if (id && ['confirmed', 'uncertain', 'committing'].includes(r.status)) commented.add(id); }
  else if (r.action === 'post') { const id = articleId(r.resultUrl); if (id && r.status === 'confirmed') posted.add(id); else if (r.status !== 'confirmed') uncertain.push(r.status); }
}
let videos = [];
try { videos = Object.keys(JSON.parse(fs.readFileSync(path.join(root, '.office', 'video-publications.json'), 'utf8')).videos || {}); } catch { videos = []; }
// 이전 핫플 글 파일의 장소(올렸든 아니든 다시 쓰지 않는다)
const places = new Map();
const walk = (dir, depth) => { if (depth > 6) return; let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of list) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, depth + 1); else if (/hotplace|핫플/i.test(e.name) && e.name.endsWith('.json')) { try { for (const post of JSON.parse(fs.readFileSync(p, 'utf8')).posts || []) if (post?.placeName) places.set(String(post.placeName).trim(), String(post.placeUrl || '')); } catch { /* 형식이 다른 파일은 건너뜀 */ } } } };
walk(path.join(root, 'outputs'), 0);
// 기록이 남기 전(다른 PC)에 올린 것은 기초 파일에서 더한다(없어도 된다)
const seedPath = path.join(__dirname, '장부-기초.json');
if (fs.existsSync(seedPath)) { try { const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8')); for (const id of seed.올린글번호 || []) posted.add(id); for (const id of seed.댓글단글번호 || []) commented.add(id); for (const v of seed.영상ID || []) videos.push(v); for (const p of seed.쓴장소 || []) places.set(p, places.get(p) || ''); } catch { fail('장부-기초.json을 읽지 못했습니다.'); } }

// 2) 카페에서 댓글 대상·핫플 최근 글 읽기(필요할 때만)
const cafeCode = (job) => `
const AIO = ${JSON.stringify(job)};
const aioTab = await openTab('https://cafe.naver.com/f-e/cafes/${CAFE}/menus/${TALK_MENU}');
await sleep(4000);
const aioData = await aioTab.evaluate(async (AIO) => {
  const get = async (url) => { try { const r = await fetch(url, { credentials: 'include' }); return r.ok ? await r.json() : null; } catch { return null; } };
  const strip = (html) => { const d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<(script|style)[^>]*>[\\s\\S]*?<\\/\\1>/gi, ''); return (d.innerText || d.textContent || '').replace(/\\s+/g, ' ').trim(); };
  const list = async (menu, page) => (await get('https://apis.naver.com/cafe-web/cafe2/ArticleListV2dot1.json?search.clubid=${CAFE}&search.queryType=lastArticle&search.menuid=' + menu + '&search.page=' + page + '&search.perPage=30'))?.message?.result?.articleList || [];
  const first = await list(${TALK_MENU}, 1);
  if (!first.length) return { error: 'login' };
  const article = async (id) => (await get('https://apis.naver.com/cafe-web/cafe-articleapi/v2.1/cafes/${CAFE}/articles/' + id + '?useCafeId=true&requestFrom=A'))?.result || null;
  const probe = await article(first[0].articleId);
  const me = probe?.user?.nick || '';
  if (!probe?.user?.isLogin) return { error: 'login' };
  if (AIO.checkOnly) return { me, member: probe.user.isCafeMember === true };
  const skip = new Set(AIO.skip); const targets = []; let looked = 0;
  for (let page = 1; page <= 4 && targets.length < AIO.wanted; page++) {
    const items = page === 1 ? first : await list(${TALK_MENU}, page);
    if (!items.length) break;
    for (const a of items) {
      if (targets.length >= AIO.wanted) break;
      if (a.self || a.writerNickname === me || a.replyArticle || a.blindArticle || a.enableComment === false || skip.has(a.articleId)) continue;
      looked++;
      const d = await article(a.articleId);
      if (!d?.article || d.article.isNotice || d.authority?.isWriteComment === false) continue;
      const comments = (d.comments?.items || []).map((c) => ({ 닉네임: c.writer?.nick || '', 내용: strip(c.content).slice(0, 120) }));
      if (comments.some((c) => c.닉네임 === me)) continue;
      const body = strip(d.article.contentHtml);
      targets.push({ 글번호: a.articleId, 주소: 'https://m.cafe.naver.com/ca-fe/web/cafes/${CAFE}/articles/' + a.articleId, 작성자: a.writerNickname, 제목: a.subject, 본문요약: body ? body.slice(0, 300) : '본문 글자 없음', 영상첨부: a.attachMovie === true || /youtu/.test(d.article.contentHtml || ''), 달린댓글: comments.slice(0, 8) });
    }
  }
  const hot = [...await list(${HOT_MENU}, 1), ...await list(${HOT_MENU}, 2)].slice(0, 50).map((a) => ({ 글번호: a.articleId, 제목: a.subject, 작성자: a.writerNickname }));
  // 말투 참고: 지정한 회원이 쓴 글(제목·본문)과 댓글을 최근 글에서 모은다. 프로그램이 올린 것(자동게시)과 직접 쓴 것을 구분해 준다
  const style = {};
  if (AIO.style.length) {
    const names = new Set(AIO.style.map((n) => n === '나' ? me : n));
    const posted = new Set(AIO.posted), commented = new Set(AIO.commented);
    for (const n of names) style[n] = { 글: [], 댓글: [] };
    // 여러 건을 동시에 읽는다(한 번에 6건). 하나씩 읽으면 브라우저 제한 시간에 걸린다
    const pool = async (items, fn) => { const out = new Array(items.length); let next = 0; await Promise.all(Array.from({ length: 6 }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } })); return out; };
    const seen = new Map();
    const pages = [];
    for (const menu of [${TALK_MENU}, ${HOT_MENU}]) for (let page = 1; page <= 6; page++) pages.push({ menu, page });
    // 프로그램이 글을 올리기 시작하기 전(글번호 ${AUTO_FROM} 미만)의 수다방 글도 몇 쪽 본다(그 회원이 직접 쓴 글·댓글이 거기 있다)
    for (const page of [20, 30, 40, 50, 60, 80]) pages.push({ menu: ${TALK_MENU}, page, old: true });
    for (const got of await pool(pages, async (p) => ({ p, items: await list(p.menu, p.page) }))) {
      if (got.p.old && !got.items.some((a) => a.articleId < ${AUTO_FROM})) continue;
      for (const a of got.items) seen.set(a.articleId, { ...a, menu: got.p.menu });
    }
    const all = [...seen.values()].sort((a, b) => b.articleId - a.articleId);
    const isAuto = (n, id) => posted.has(id) || (n === me && id >= ${AUTO_FROM});
    // 글: 회원별로 직접 쓴 글을 앞에, 모자라면 자동 게시 글로 채워 12건까지(본문은 8건까지 읽는다)
    for (const n of names) {
      const mine = all.filter((a) => a.writerNickname === n);
      const picked = [...mine.filter((a) => !isAuto(n, a.articleId)), ...mine.filter((a) => isAuto(n, a.articleId))].slice(0, 12);
      const bodies = await pool(picked.slice(0, 8), (a) => article(a.articleId));
      style[n].글 = picked.map((a, i) => ({ 글번호: a.articleId, 게시판: a.menu === ${HOT_MENU} ? '핫플레이스' : '수다방', 제목: a.subject, 본문: bodies[i]?.article ? strip(bodies[i].article.contentHtml).slice(0, 400) : '', 자동게시: isAuto(n, a.articleId) }));
    }
    // 댓글: 자동 게시 전 글을 먼저, 그다음 최근 글 순으로 댓글이 달린 글 60건의 댓글 목록에서 그 회원의 댓글을 모은다(회원별 25건까지)
    const withComments = [...all.filter((a) => a.articleId < ${AUTO_FROM}), ...all.filter((a) => a.articleId >= ${AUTO_FROM})].filter((a) => a.commentCount).slice(0, 60);
    const details = await pool(withComments, (a) => article(a.articleId));
    withComments.forEach((a, i) => { for (const c of details[i]?.comments?.items || []) { const n = c.writer?.nick; if (names.has(n) && style[n].댓글.length < 25) style[n].댓글.push({ 글제목: a.subject, 글작성자: a.writerNickname, 댓글: strip(c.content).slice(0, 200), 자동게시: n === me && a.articleId >= ${AUTO_FROM} }); } });
  }
  return { me, targets, looked, hot, style };
}, AIO);
console.log('AIO_RESULT' + JSON.stringify(aioData) + 'AIO_END');
await closeTab(aioTab);
`;

if (checkOnly) {
  const state = repl(cafeCode({ checkOnly: true, wanted: 0, skip: [], style: [], posted: [], commented: [] }));
  if (state.error) fail('네이버 카페 로그인이 필요합니다. Aside 브라우저에서 네이버에 로그인한 뒤 "로그인했어"라고 답해 주세요.');
  if (!state.member) fail('이 네이버 계정은 꼬리별 관측소 회원이 아닙니다. Aside 브라우저의 네이버 계정을 확인해 주세요.');
  console.log(`네이버 카페 로그인 확인됨(${state.me})`);
  process.exit(0);
}

const started = Date.now();
let cafe = null;
if (wanted || styleNames.length) {
  cafe = repl(cafeCode({ checkOnly: false, wanted, skip: [...commented, ...posted], style: styleNames, posted: [...posted], commented: [...commented] }));
  if (cafe.error) fail('네이버 카페 로그인이 필요합니다. Aside 브라우저에서 네이버에 로그인한 뒤 다시 실행해 주세요.');
}
const sorted = (set) => [...set].sort((a, b) => a - b);
const result = {
  기준: { 만든시각: new Date().toISOString(), 카페: 'https://cafe.naver.com/petdilab', 내닉네임: cafe?.me || '', 수다방: `https://cafe.naver.com/f-e/cafes/${CAFE}/menus/${TALK_MENU}`, 핫플레이스: `https://cafe.naver.com/f-e/cafes/${CAFE}/menus/${HOT_MENU}?viewType=L` },
  설명: { 올린글번호: '이미 올린 글(다시 올리지 않는다)', 댓글단글번호: '이미 댓글을 단 글(결과가 불확실했던 것 포함. 다시 달지 않는다)', 영상ID: '이미 쓴 유튜브 영상 ID(주소 형식이 달라도 같은 영상은 다시 쓰지 않는다)', 쓴장소: '이미 글로 쓴 장소 등록명(다시 쓰지 않는다)', 댓글대상: '이번에 댓글을 달 글. 내 글·공지·내가 이미 댓글 단 글·장부의 글은 뺀 목록이다. 주소(target)·제목·작성자를 그대로 옮긴다', 핫플최근글: '핫플레이스 게시판 최근 글 제목(장소 중복 확인용)' },
  올린글번호: sorted(posted), 댓글단글번호: sorted(commented), 영상ID: [...new Set(videos)], 쓴장소: [...places.keys()],
  댓글대상: cafe?.targets || [], 핫플최근글: cafe?.hot || [],
  말투참고: cafe?.style || {},
};
if (styleNames.length) result.설명.말투참고 = '지정한 회원이 카페에 쓴 글(제목·본문)과 댓글. 제목 말투, 문장 길이, 끝맺음, 자주 쓰는 표현을 여기서 따른다. "자동게시": false가 그 회원이 직접 쓴 것이라 먼저 참고하고, true(프로그램이 올린 것)는 겹치는 표현을 피하는 데만 쓴다. 문장을 그대로 베끼지 않는다';
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
console.log(`꼬리별 장부 완료: 올린 글 ${result.올린글번호.length}건, 댓글 단 글 ${result.댓글단글번호.length}건, 영상 ${result.영상ID.length}개, 장소 ${result.쓴장소.length}곳${wanted ? `, 댓글 대상 ${result.댓글대상.length}/${wanted}건(확인한 글 ${cafe.looked}건), 핫플 최근 글 ${result.핫플최근글.length}건` : ''}, ${Math.round((Date.now() - started) / 1000)}초`);
if (wanted && result.댓글대상.length < wanted) console.log(`댓글 대상이 ${wanted - result.댓글대상.length}건 부족합니다(최근 글 120건 안에서 조건에 맞는 글이 모자람).`);
console.log(`저장: ${out}`);
