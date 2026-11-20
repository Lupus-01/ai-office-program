// 블로그 폼 셋 미리보기: 초안(.md)과 이미지 카드를 한 HTML 파일로 묶는다(2026-11-20). 그림은 파일 안에 넣어 HTML 하나만 전달하면 된다.
// 사용: node blog-preview.cjs <초안.md> [<초안.md> …] [--out <파일.html>]
//   초안 머리말의 소재(JSON)와 같은 이름의 폴더(블로그/이미지/<소재 이름>/)에서 사진 자리에 맞는 그림을 찾는다. 없으면 "넣을 자리" 상자로 보인다.
'use strict';
const { execFileSync } = require('child_process');
const { fs, path, ROOT, readJson, kst } = require('./lib.cjs');

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const OUT = outIdx >= 0 ? path.resolve(argv[outIdx + 1]) : path.join(ROOT, '블로그', `폼셋-미리보기-${kst().slice(0, 10)}.html`);
const drafts = argv.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1 || (outIdx < 0 && !a.startsWith('--'))).filter((a) => a.endsWith('.md')).map((a) => path.resolve(a));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

// 사진 자리 설명에서 어떤 그림인지 고른다
function pickImage(desc, files, used) {
  const rules = [[/표지/, /표지/], [/숫자/, /숫자요약/], [/한눈에/, /한눈에보기/], [/분야/, /상담분야/], [/스타일/, /상담스타일/], [/후기 인용/, /후기\d/]];
  for (const f of files) {
    const nick = (path.basename(f, '.png').match(/^\d+_\d+_(.+)$/) || [])[1];
    if (nick && desc.includes(nick) && !used.has(f)) return [f];
  }
  for (const [d, n] of rules) {
    if (!d.test(desc)) continue;
    const hit = files.filter((f) => n.test(path.basename(f)) && !used.has(f));
    if (hit.length) return /후기 인용/.test(desc) ? hit : [hit[0]];
  }
  return [];
}

function renderDraft(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = Object.fromEntries(fm[1].split('\n').map((l) => l.match(/^([^:]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1].trim(), m[2].trim()]));
  const body = raw.slice(fm[0].length);
  const src = path.resolve(path.dirname(file), meta['소재'].split(',')[0].trim());
  const source = readJson(src, {});
  const imgDir = path.join(ROOT, '블로그', '이미지', path.basename(src, '.json'));
  const files = fs.existsSync(imgDir) ? fs.readdirSync(imgDir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(imgDir, f)) : [];
  const used = new Set();
  const html = [];
  let list = null;
  const flush = () => { if (list) { html.push(`<ul>${list.join('')}</ul>`); list = null; } };
  for (const line of body.split('\n')) {
    const photo = line.match(/^\[사진\s*(\d+)\s*:\s*([^\]]+)\]/);
    if (line.startsWith('- ')) { (list = list || []).push(`<li>${inline(line.slice(2))}</li>`); continue; }
    flush();
    if (!line.trim()) continue;
    if (photo) {
      const imgs = pickImage(photo[2], files, used);
      imgs.forEach((f) => used.add(f));
      if (imgs.length) html.push(...imgs.map((f) => `<figure><img src="${dataUri(f)}" alt="${esc(photo[2])}"><figcaption>사진 ${photo[1]} · ${esc(photo[2])}</figcaption></figure>`));
      else html.push(`<div class="slot"><b>사진 ${photo[1]}</b>${esc(photo[2])}<span>게시할 때 담당자가 넣는 화면 캡처 자리</span></div>`);
    } else if (line.startsWith('## ')) html.push(`<h3>${inline(line.slice(3))}</h3>`);
    else if (line.startsWith('> ')) html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    else if (/^https?:\/\/\S+$/.test(line.trim())) html.push(`<a class="link" href="${esc(line.trim())}"><b>홍카페 상담사 프로필</b><span>${esc(line.trim())}</span></a>`);
    else html.push(`<p>${inline(line)}</p>`);
  }
  flush();
  let check = '';
  try { check = execFileSync(process.execPath, [path.join(__dirname, 'blog.cjs'), 'check', file], { encoding: 'utf8' }); } catch (e) { check = String(e.stdout || e.message); }
  const chars = body.replace(/^\[사진[^\]]*\]\s*$/gm, '').replace(/^#+\s*/gm, '').replace(/^>\s?/gm, '').replace(/\s/g, '').length;
  return { meta, html: html.join('\n'), check, chars, source, srcName: path.basename(src), photos: (body.match(/^\[사진/gm) || []).length, images: used.size, file };
}

const FORMS = {
  소개: {
    name: '폼 A · 상담사 소개 리포트',
    aim: '한 상담사를 숫자와 실제 후기로 소개합니다. "홍카페 + 예명" 검색과 그 상담사의 대표 고민 검색을 함께 노립니다.',
    spec: '본문 1,400~2,300자 · 소제목 4개 이상 · 사진 6장 이상 · 후기 인용 2~4개',
    title: ['홍카페 <예명> <타로|신점|사주> + 숫자나 대표 고민', '예: 홍카페 해율도령 신점, 최근 3개월 후기 719건으로 본 상담 스타일'],
    steps: [
      ['들머리', '이 상담사를 찾는 사람의 고민 한 장면으로 시작. 주 검색어를 넣는다', '표지'],
      ['한눈에 보는 ○○ 상담사', '분야·번호·가격·전화/채팅·약력 2~3줄', '프로필 화면'],
      ['숫자로 본 상담', '누적 후기, 최근 3개월 후기와 만족도, 답글 비율. 숫자마다 뜻을 한 줄', '숫자 요약 카드'],
      ['어떤 고민으로 많이 찾을까', '상담 분야 상위 3개 비율, 최근 늘어난 태그', '분야 비율 그래프'],
      ['후기에 자주 나오는 상담 스타일', '스타일 태그·후기 키워드·리딩 방식 + 실제 후기 인용', '스타일 카드, 후기 카드'],
      ['이런 분께 맞습니다', '맞는 고민 3~4줄과 솔직한 한계 1~2줄', ''],
      ['상담 전에 준비하면 좋은 질문', '상위 분야에 맞는 질문 예시 3~4개', ''],
      ['상담 방법', '프로필 링크, 전화·채팅 선택, 확인된 혜택만', '상담 신청 화면'],
      ['마무리', '상담은 참고용이라는 한 줄, 글쓴이 표기', ''],
    ],
  },
  큐레이션: {
    name: '폼 B · 고민별 상담사 큐레이션',
    aim: '한 고민(재회·속마음·이직…)에 후기가 많은 상담사 3~5명을 묶습니다. "<고민> 타로 잘보는곳" 같은 검색을 노립니다.',
    spec: '본문 1,800~3,200자 · 소제목 4개 이상 · 사진 7장 이상 · 상담사마다 후기 인용 1개 이상',
    title: ['<고민> <타로|신점> 잘보는곳 + 홍카페 + 고른 기준', '예: 속마음 전화타로, 홍카페에서 속마음 후기가 가장 많이 쌓인 상담사 5명'],
    steps: [
      ['들머리', '그 고민의 흔한 장면 → 고르기 어려운 이유 → 고른 기준과 기준일을 그대로 밝힌다', '표지'],
      ['고른 기준과 한눈에 보기', '무슨 숫자 순서인지, 5명의 예명·번호·후기 수·가격', '한눈에 보기 그래프'],
      ['상담사별 소개 (1~5)', '그 고민 후기 수와 비중, 최근 3개월 후기·만족도, 스타일, 약력 한 줄, 후기 인용, 프로필 링크', '상담사 카드'],
      ['나에게 맞는 상담사 고르는 법', '스타일 태그로 고르기, 비중 보기, 가격·질문 준비', ''],
      ['마무리', '순서는 기준일 숫자라 바뀔 수 있음, 상담은 참고용, 글쓴이 표기', ''],
    ],
  },
};
const RULES = [
  ['글쓴이는 홍카페 운영팀', '고객이 쓴 체험 후기처럼 쓰지 않습니다. "내돈내산", "제가 받아봤어요", "솔직 후기"는 검사에서 걸립니다.'],
  ['숫자는 소재에 있는 것만', '후기 수·비율·가격은 소재 카드 값 그대로 쓰고 기준일을 밝힙니다. 계산해서 만든 숫자도 걸립니다.'],
  ['후기는 실제 문장 그대로', '소재의 "인용할 수 있는 후기"만 옮깁니다. 줄일 때만 …를 쓰고, 닉네임·날짜를 붙이지 않습니다.'],
  ['결과를 약속하지 않음', '"100% 적중", "무조건", "반드시 재회", "1위", "최고의"를 쓰지 않습니다.'],
  ['한계를 한 줄 적기', '후기 비율이 낮은 분야, 연결이 어려울 수 있다는 점을 적습니다. 상위 체험 글의 절반이 아쉬운 점을 씁니다.'],
  ['상담사 사진은 쓰지 않음', '이미지는 글자·숫자 카드만 만듭니다. 화면 캡처는 게시할 때 담당자가 넣습니다.'],
];

function formPanel(d) {
  const f = FORMS[d.meta['폼']];
  const pass = /결과: 통과/.test(d.check);
  return `<section class="panel">
  <div class="intro"><h2>${esc(f.name)}</h2><p>${esc(f.aim)}</p><p class="spec">${esc(f.spec)}</p></div>
  <div class="cols">
    <aside>
      <h4>제목 공식</h4><p class="formula">${esc(f.title[0])}</p><p class="muted">${esc(f.title[1])}</p>
      <h4>문단 순서</h4>
      <ol class="steps">${f.steps.map(([t, c, p]) => `<li><b>${esc(t)}</b><span>${esc(c)}</span>${p ? `<em>사진: ${esc(p)}</em>` : ''}</li>`).join('')}</ol>
      <h4>이 견본의 검사 결과</h4>
      <p class="badge ${pass ? 'ok' : 'no'}">${pass ? '검사 통과' : '고칠 곳 있음'}</p>
      <pre>${esc(d.check.trim())}</pre>
      <p class="muted">소재: ${esc(d.srcName)} · 기준일 ${esc(d.source.asOf || '')}<br>본문 ${d.chars.toLocaleString()}자 · 사진 자리 ${d.photos}개(자동 이미지 ${d.images}장)</p>
    </aside>
    <article>
      <div class="kw">노리는 검색어: ${esc(d.meta['검색어'])}</div>
      <h1>${esc(d.meta['제목'])}</h1>
      <div class="byline">홍카페 운영팀 · 견본 초안(게시 전)</div>
      ${d.html}
    </article>
  </div>
</section>`;
}
function cardPanel(d) {
  const c = d.source;
  if (c.kind !== 'card') return '';
  const f = c.facts;
  const row = (k, v) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;
  const bars = (list) => list.map((x) => `${esc(x.name)} ${x.share}% <span class="muted">(${x.cnt.toLocaleString()}건)</span>`).join(' · ');
  return `<section class="panel"><div class="intro"><h2>소재 카드 예시 · ${esc(c.nick)} ${esc(c.number)}번</h2><p>글을 쓰기 전에 도구가 수집 자료에서 뽑아 주는 재료입니다. 글의 숫자와 후기 인용은 이 카드에 있는 것만 쓸 수 있고, 초안 검사가 이를 대조합니다.</p></div>
  <div class="cardbox"><table>
  ${row('기준일', esc(c.asOf))}${row('분류 · 등급', `${esc(c.category)} · ${esc(c.grade || '-')}`)}${row('가격', `${f.price?.toLocaleString() ?? '-'}코인 / ${esc(f.unit)}`)}
  ${row('누적 후기', `${f.reviewsTotal?.toLocaleString() ?? '-'}건 · 별점 ${f.star ?? '-'}점 · 5점 후기 ${f.fivePoint?.toLocaleString() ?? '-'}개`)}
  ${row('최근 3개월', `후기 ${f.recent3mReviews?.toLocaleString() ?? '-'}건 · 5점 만족도 ${f.recent3mFiveRate ?? '-'}%`)}
  ${row('상담사 답글', `${f.replies?.toLocaleString() ?? '-'}건 (후기의 ${f.replyRate ?? '-'}%)`)}
  ${row('상담 분야', bars(c.fields))}${row('상담 스타일', bars(c.styles))}${row('후기 키워드', esc(c.reviewKeywords.join(', ')))}
  ${row('최근 늘어난 태그', esc(c.rising.map((x) => `${x.name}(${x.before}→${x.now})`).join(', ') || '-'))}
  ${row('약력', esc(c.career.join(' / ')))}${row('리딩정보', esc(c.reading.join(' / ')))}
  ${row('노릴 검색어', esc([...c.keywords.name, ...c.keywords.topic].join(' , ')))}
  </table>
  <h4>인용할 수 있는 후기 (${c.quotes.length}개)</h4><ol class="quotes">${c.quotes.map((q) => `<li><span class="muted">${esc(q.date)} · ${esc(q.via)} · ${esc(q.field || '분야 없음')}</span><br>${esc(q.text)}</li>`).join('')}</ol>
  <p class="muted">개인 사정이 드러나는 후기, 인사만 있는 후기, 같은 글을 되풀이해 올린 후기, 결과를 단정하는 후기는 후보에서 뺍니다. 작성자 닉네임은 모으지 않습니다.</p></div></section>`;
}

function main() {
  if (!drafts.length) { console.log('사용: node blog-preview.cjs <초안.md> [<초안.md> …] [--out <파일.html>]'); process.exit(2); }
  const docs = drafts.map(renderDraft);
  const cardDoc = docs.find((d) => d.source.kind === 'card');
  const tabs = [...docs.map((d) => [FORMS[d.meta['폼']].name, formPanel(d)]), ...(cardDoc ? [['소재 카드 예시', cardPanel(cardDoc)]] : []),
    ['공통 규칙', `<section class="panel"><div class="intro"><h2>공통 규칙</h2><p>두 폼 모두에 적용됩니다. 초안 검사 도구가 대부분을 자동으로 확인합니다.</p></div><div class="rules">${RULES.map(([t, c]) => `<div><b>${esc(t)}</b><p>${esc(c)}</p></div>`).join('')}</div></section>`]];
  const css = `
:root{--bg:#F6F4F1;--card:#fff;--ink:#1F1B2D;--sub:#5B5670;--mute:#8A869A;--line:#E7E3EE;--brand:#6335B4;--tint:#EFEAF8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Pretendard","Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif;line-height:1.7;-webkit-text-size-adjust:100%}
header{padding:40px 24px 8px;max-width:1180px;margin:0 auto}header h1{font-size:28px;margin:0 0 8px;letter-spacing:-.5px}header p{margin:0;color:var(--sub);max-width:760px}
nav{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);margin-top:20px}nav div{max-width:1180px;margin:0 auto;padding:10px 24px;display:flex;gap:8px;overflow-x:auto}
nav button{font:inherit;font-weight:700;font-size:15px;white-space:nowrap;padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--sub);cursor:pointer}
nav button[aria-selected=true]{background:var(--brand);border-color:var(--brand);color:#fff}
main{max-width:1180px;margin:0 auto;padding:24px 24px 80px}.panel{display:none}.panel.on{display:block}
.intro h2{font-size:22px;margin:0 0 6px}.intro p{margin:0;color:var(--sub);max-width:820px}.intro .spec{margin-top:8px;font-weight:700;color:var(--ink)}
.cols{display:grid;grid-template-columns:340px minmax(0,1fr);gap:28px;margin-top:24px;align-items:start}
aside{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;font-size:14.5px;position:sticky;top:72px;max-height:calc(100vh - 90px);overflow:auto}
aside h4,.cardbox h4{font-size:13px;color:var(--mute);letter-spacing:.3px;margin:18px 0 6px}aside h4:first-child{margin-top:0}
.formula{font-weight:700;margin:0}.muted{color:var(--mute);font-size:13.5px;margin:4px 0 0}
.steps{margin:0;padding-left:20px}.steps li{margin-bottom:9px}.steps b{display:block}.steps span{color:var(--sub)}.steps em{display:block;font-style:normal;color:var(--brand);font-size:13px;font-weight:700}
.badge{display:inline-block;margin:0;padding:3px 12px;border-radius:999px;font-weight:700;font-size:13px}.badge.ok{background:#E3F4E8;color:#17663A}.badge.no{background:#FBE6E3;color:#A1271B}
pre{white-space:pre-wrap;background:var(--bg);border-radius:10px;padding:12px;font-size:12.5px;line-height:1.6;margin:8px 0;font-family:inherit;color:var(--sub)}
article{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:40px clamp(20px,5vw,64px) 56px;min-width:0}
article>*{max-width:680px;margin-left:auto;margin-right:auto}
.kw{font-size:13px;color:var(--brand);font-weight:700}article h1{font-size:28px;line-height:1.35;letter-spacing:-.6px;margin:8px auto 6px;word-break:keep-all}
.byline{font-size:13.5px;color:var(--mute);padding-bottom:20px;border-bottom:1px solid var(--line);margin-bottom:26px}
article p{font-size:16.5px;margin:0 auto 16px;word-break:keep-all}article h3{font-size:21px;margin:44px auto 14px;padding-left:12px;border-left:4px solid var(--brand);letter-spacing:-.3px}
article ul{padding-left:22px;margin:0 auto 16px;font-size:16.5px}article li{margin-bottom:6px;padding-left:2px}
blockquote{margin:0 auto 14px;padding:14px 18px;background:var(--tint);border-radius:12px;font-size:16px}
figure{margin:22px auto}figure img{display:block;width:100%;max-width:520px;margin:0 auto;border-radius:14px;border:1px solid var(--line)}figcaption{text-align:center;font-size:12.5px;color:var(--mute);margin-top:8px}
.slot{max-width:520px;margin:22px auto;border:2px dashed #CFC8DE;border-radius:14px;padding:26px 20px;text-align:center;color:var(--sub);font-size:15px}.slot b{display:block;color:var(--ink)}.slot span{display:block;font-size:12.5px;color:var(--mute);margin-top:4px}
.link{display:block;max-width:680px;margin:0 auto 16px;border:1px solid var(--line);border-radius:12px;padding:14px 18px;text-decoration:none;color:var(--ink)}.link span{display:block;font-size:13px;color:var(--mute);word-break:break-all}
.cardbox{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px;margin-top:24px;overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:15px}th{text-align:left;white-space:nowrap;color:var(--sub);font-weight:700;vertical-align:top;padding:9px 20px 9px 0;border-bottom:1px solid var(--line);width:1%}td{padding:9px 0;border-bottom:1px solid var(--line)}
.quotes{padding-left:22px;font-size:15px}.quotes li{margin-bottom:10px}
.rules{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:24px}.rules div{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px}.rules p{margin:6px 0 0;color:var(--sub);font-size:15px}
@media(max-width:900px){.cols{grid-template-columns:1fr}aside{position:static;max-height:none}header{padding-top:28px}}
`;
  const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>홍카페 블로그 폼 셋 예시</title><style>${css}</style></head><body>
<header><h1>홍카페 상담사 블로그 폼 셋 · 예시</h1><p>수집한 상담사 데이터로 만든 블로그 글 형식 두 가지와, 그 형식으로 실제 상담사를 써 본 견본입니다. 글 속 숫자·후기·이미지는 모두 ${esc(docs[0].source.asOf || '')} 수집 자료에서 나왔습니다. 게시 전 초안입니다.</p></header>
<nav><div role="tablist">${tabs.map(([t], i) => `<button role="tab" aria-selected="${i === 0}" data-i="${i}">${esc(t)}</button>`).join('')}</div></nav>
<main>${tabs.map(([, h], i) => h.replace('class="panel"', `class="panel${i === 0 ? ' on' : ''}" data-i="${i}"`)).join('\n')}</main>
<script>document.querySelectorAll('nav button').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('nav button').forEach(function(x){x.setAttribute('aria-selected',x===b)});document.querySelectorAll('.panel').forEach(function(p){p.classList.toggle('on',p.dataset.i===b.dataset.i)});window.scrollTo(0,0)})});</script>
</body></html>`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, page);
  console.log(`미리보기: ${OUT} (${(page.length / 1e6).toFixed(1)}MB, 초안 ${docs.length}개 · 이미지 ${docs.reduce((s, d) => s + d.images, 0)}장)`);
}
main();
