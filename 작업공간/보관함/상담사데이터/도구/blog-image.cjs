// 블로그 이미지 카드 만들기: 소재 카드·큐레이션 재료(JSON)의 숫자와 후기로 1080×1080 PNG를 만든다(2026-11-20).
// 상담사 사진은 쓰지 않는다(글자·숫자 카드만). 숫자는 소재 파일 값 그대로다.
// 사용: node blog-image.cjs <소재카드.json|큐레이션.json> [--quotes 1,3,6] [--out <폴더>]
//   --quotes 는 소재 카드의 "인용할 수 있는 후기" 번호(기본: 앞에서 3개). 큐레이션은 상담사마다 첫 번째 후기를 쓴다.
//   결과: 보관함/상담사데이터/블로그/이미지/<소재 이름>/01_표지.png …
'use strict';
const { fs, path, ROOT, needProgram, readJson, FONT_CSS, useLocalFonts, waitFonts } = require('./lib.cjs');

const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const SRC = argv[0] && !argv[0].startsWith('--') ? path.resolve(argv[0]) : null;
const W = 1080;
const H = 1080;
const LOGO_FILE = path.join(ROOT, '영상', '로고', '홍카페_로고_full.svg');
const LOGO = fs.existsSync(LOGO_FILE) ? fs.readFileSync(LOGO_FILE, 'utf8').replace(/<\?xml[^>]*\?>/, '') : '';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => (v == null ? '-' : Number(v).toLocaleString('ko-KR'));
const dateKo = (d) => { const [y, m, day] = String(d).split('-'); return `${y}년 ${Number(m)}월 ${Number(day)}일 기준`; };
const clip = (s, max) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > max ? `${t.slice(0, max - 1)}…` : t; };

// 색: 바탕은 따뜻한 흰색, 글자는 먹색 세 단계, 자료 표시(막대)는 홍카페 보라 한 가지. 글자에는 자료 색을 입히지 않는다
const CSS = `${FONT_CSS}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;background:#FBF9F6;color:#1F1B2D;font-family:'Noto Sans KR',sans-serif;overflow:hidden}
.card{position:relative;width:${W}px;height:${H}px;padding:84px 84px 96px;display:flex;flex-direction:column}
.logo{height:44px;margin-bottom:56px}.logo svg{height:44px;width:auto}
.eyebrow{font-size:34px;font-weight:700;color:#5B5670;letter-spacing:-0.5px}
h1{font-family:'Jua',sans-serif;font-weight:400;font-size:76px;line-height:1.18;letter-spacing:-1px;margin-top:14px;word-break:keep-all}
.sub{font-size:32px;color:#5B5670;margin-top:16px;line-height:1.45;word-break:keep-all}
.foot{position:absolute;left:84px;right:84px;bottom:52px;font-size:25px;color:#8A869A;display:flex;justify-content:space-between}
.grow{flex:1;display:flex;flex-direction:column;justify-content:center}
.name{font-family:'Jua',sans-serif;font-size:190px;line-height:1.05;letter-spacing:-3px}
.num{font-size:54px;font-weight:700;color:#5B5670;margin-left:18px}
.chips{display:flex;flex-wrap:wrap;gap:14px;margin-top:40px}
.chip{font-size:32px;font-weight:700;padding:12px 26px;border-radius:999px;background:#EFEAF8;color:#1F1B2D}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:48px}
.tile{background:#fff;border:1px solid #E7E3EE;border-radius:28px;padding:36px 36px 34px}
.tile .k{font-size:30px;color:#5B5670;font-weight:500}
.tile .v{font-size:92px;font-weight:900;letter-spacing:-2px;margin-top:10px;line-height:1.05}
.tile .v small{font-size:40px;font-weight:700;margin-left:6px;color:#5B5670}
.tile .d{font-size:25px;color:#8A869A;margin-top:10px;word-break:keep-all}
.bars{margin-top:52px;display:flex;flex-direction:column;gap:38px}
.row{display:grid;grid-template-columns:230px 1fr;align-items:center;column-gap:24px}
.row .lab{font-size:38px;font-weight:700;word-break:keep-all}
.track{position:relative;height:44px;border-left:2px solid #D9D4E3;display:flex;align-items:center}
.bar{height:44px;background:#6335B4;border-radius:0 9px 9px 0}
.val{font-size:36px;font-weight:700;margin-left:16px;white-space:nowrap}
.val small{font-size:26px;font-weight:500;color:#8A869A;margin-left:8px}
.q{font-family:'Noto Sans KR',sans-serif;font-weight:900;font-size:220px;line-height:1;color:#D9D4E3;height:120px}
.quote{font-weight:700;line-height:1.55;word-break:keep-all;letter-spacing:-0.5px;margin-top:18px}
.by{font-size:30px;color:#5B5670;margin-top:44px}
.rank{font-family:'Jua',sans-serif;font-size:64px;color:#5B5670}
`;
const page = (inner, foot) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="card">${LOGO ? `<div class="logo">${LOGO}</div>` : ''}${inner}<div class="foot"><span>${esc(foot[0])}</span><span>${esc(foot[1] || '')}</span></div></div></body></html>`;

function barRows(list, key, unit, max) {
  const top = Math.max(...list.map((x) => x[key]), 1);
  // 막대 뒤 값 글자가 잘리지 않게 가장 긴 막대도 칸의 62%까지만 쓴다
  return `<div class="bars">${list.slice(0, max).map((x) => `<div class="row"><div class="lab">${esc(x.name)}</div><div class="track"><div class="bar" style="width:${Math.max(1.5, (x[key] / top) * 62)}%"></div><div class="val">${n(x[key])}${unit}${x.note ? `<small>${esc(x.note)}</small>` : ''}</div></div></div>`).join('')}</div>`;
}
function quoteCard(text, by, foot) {
  const t = clip(text, 190);
  const size = t.length <= 60 ? 62 : t.length <= 110 ? 52 : t.length <= 150 ? 46 : 41;
  return page(`<div class="grow"><div class="q">“</div><div class="quote" style="font-size:${size}px">${esc(t)}</div><div class="by">${esc(by)}</div></div>`, foot);
}

function cardPages(c, quoteIdx) {
  const f = c.facts;
  const foot = [dateKo(c.asOf), '홍카페 공개 프로필·이용 후기'];
  const pages = [];
  const fields = c.fields.filter((x) => x.name !== '고민');
  pages.push(['표지', page(`<div class="grow"><div class="eyebrow">홍카페 ${esc(c.category)} 상담사</div><div><span class="name">${esc(c.nick)}</span>${c.number ? `<span class="num">${esc(c.number)}번</span>` : ''}</div><div class="sub">${esc(clip(c.headline.slice(0, 2).join(' '), 60))}</div><div class="chips">${fields.slice(0, 3).map((x) => `<span class="chip">${esc(x.name)}</span>`).join('')}</div></div>`, foot)]);
  const tiles = [
    f.reviewsTotal != null && ['누적 후기', n(f.reviewsTotal), '건', f.star != null ? `누적 별점 ${f.star}점` : ''],
    f.recent3mReviews != null && ['최근 3개월 후기', n(f.recent3mReviews), '건', '요즘 얼마나 활발한지'],
    f.recent3mFiveRate != null && ['5점 만족도', n(f.recent3mFiveRate), '%', '최근 3개월 후기 기준'],
    f.replyRate != null && ['상담사 답글', n(f.replyRate), '%', `후기 ${n(f.reviewsTotal)}건 중 ${n(f.replies)}건에 답글`],
  ].filter(Boolean);
  if (tiles.length >= 2) pages.push(['숫자요약', page(`<div class="eyebrow">숫자로 본 상담</div><h1>${esc(c.nick)} 상담사</h1><div class="tiles">${tiles.map(([k, v, u, d]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}<small>${u}</small></div><div class="d">${esc(d)}</div></div>`).join('')}</div>`, foot)]);
  if (fields.length >= 2) pages.push(['상담분야', page(`<div class="eyebrow">어떤 고민으로 많이 찾을까</div><h1>상담 분야</h1><div class="sub">후기에 붙은 상담 분야 태그 비율</div>${barRows(fields.map((x) => ({ name: x.name, share: x.share, note: `${n(x.cnt)}건` })), 'share', '%', 5)}`, foot)]);
  if (c.styles.length >= 2) pages.push(['상담스타일', page(`<div class="eyebrow">후기에 자주 나오는</div><h1>상담 스타일</h1><div class="sub">후기에 붙은 상담 스타일 태그 비율</div>${barRows(c.styles.map((x) => ({ name: x.name, share: x.share, note: `${n(x.cnt)}건` })), 'share', '%', 5)}`, foot)]);
  for (const i of quoteIdx) {
    const q = c.quotes[i - 1];
    if (!q) { console.log(`  ⚠ 후기 ${i}번이 소재 카드에 없습니다(1~${c.quotes.length}).`); continue; }
    pages.push([`후기${i}`, quoteCard(q.text, `${c.nick} 상담사 실제 이용 후기${q.field ? ` · ${q.field} 상담` : ''}`, [dateKo(c.asOf), '홍카페 이용 후기'])]);
  }
  return pages;
}

function topicPages(t) {
  const foot = [dateKo(t.asOf), '홍카페 공개 프로필·이용 후기'];
  const pages = [];
  const cat = t.category || '';
  pages.push(['표지', page(`<div class="grow"><div class="eyebrow">${esc(t.field)} 고민, 후기로 골랐습니다</div><h1 style="font-size:104px">홍카페 ${esc(cat)} 상담사 ${t.items.length}명</h1><div class="sub">${esc(t.criteria)}</div></div>`, foot)]);
  pages.push(['한눈에보기', page(`<div class="eyebrow">한눈에 보기</div><h1>'${esc(t.field)}' 후기 수</h1><div class="sub">후기에 '${esc(t.field)}' 분야 태그가 붙은 건수</div>${barRows(t.items.map((x) => ({ name: x.nick, cnt: x.fieldCnt, note: `${n(x.facts.price)}코인/${x.facts.unit}` })), 'cnt', '건', 6)}`, foot)]);
  for (const it of t.items) {
    const f = it.facts;
    const tiles = [
      [`'${t.field}' 후기`, n(it.fieldCnt), '건', `이 상담사 후기 태그의 ${it.fieldShare}%`],
      f.recent3mReviews != null && ['최근 3개월 후기', n(f.recent3mReviews), '건', f.recent3mFiveRate != null ? `5점 만족도 ${f.recent3mFiveRate}%` : ''],
    ].filter(Boolean);
    pages.push([`${it.rank}_${it.nick}`, page(`<div class="eyebrow">${it.rank}. 홍카페 ${esc(it.category)} 상담사</div><div style="margin-top:10px"><span class="name" style="font-size:150px">${esc(it.nick)}</span>${it.number ? `<span class="num">${esc(it.number)}번</span>` : ''}</div><div class="tiles" style="margin-top:36px">${tiles.map(([k, v, u, d]) => `<div class="tile"><div class="k">${esc(k)}</div><div class="v">${v}<small>${u}</small></div><div class="d">${esc(d)}</div></div>`).join('')}</div><div class="chips">${it.styles.slice(0, 3).map((x) => `<span class="chip">${esc(x.name)} ${x.share}%</span>`).join('')}<span class="chip" style="background:#fff;border:1px solid #E7E3EE">${n(f.price)}코인/${esc(f.unit)}</span></div>`, foot)]);
  }
  return pages;
}

async function main() {
  if (!SRC || !fs.existsSync(SRC)) { console.log('사용: node blog-image.cjs <소재카드.json|큐레이션.json> [--quotes 1,3,6] [--out <폴더>]'); process.exit(2); }
  const doc = readJson(SRC, null);
  if (!doc || !['card', 'topic'].includes(doc.kind)) { console.log('blog.cjs 가 만든 소재 카드(.json)나 큐레이션 재료(.json)가 아닙니다.'); process.exit(2); }
  const quoteIdx = String(arg('--quotes', '1,2,3')).split(',').map((s) => Number(s.trim())).filter(Boolean);
  const pages = doc.kind === 'card' ? cardPages(doc, quoteIdx) : topicPages(doc);
  const out = arg('--out') ? path.resolve(arg('--out')) : path.join(ROOT, '블로그', '이미지', path.basename(SRC, '.json'));
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = needProgram('playwright');
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: true }); } catch { browser = await chromium.launch({ headless: true }); }
  try {
    const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await useLocalFonts(pg);
    let i = 0;
    for (const [name, html] of pages) {
      i++;
      await pg.setContent(html, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await waitFonts(pg);
      // 글자가 카드 밖으로 넘치면 알린다(잘린 그림을 그대로 쓰지 않게)
      const over = await pg.evaluate(() => { const c = document.querySelector('.card'); return c.scrollHeight > c.clientHeight + 2 || c.scrollWidth > c.clientWidth + 2; });
      const file = path.join(out, `${String(i).padStart(2, '0')}_${name.replace(/[^0-9A-Za-z가-힣_-]+/g, '_')}.png`);
      await pg.screenshot({ path: file });
      console.log(`${over ? '⚠ 넘침 ' : ''}${file}`);
    }
  } finally { await browser.close(); }
  console.log(`이미지 ${pages.length}장 — ${out}`);
}
main().catch((e) => { console.error(`이미지 만들기 오류: ${e.message}`); process.exit(1); });
