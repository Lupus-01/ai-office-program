// 블로그 폼 셋 미리보기: 초안(.md)과 이미지 카드를 한 HTML 파일로 묶는다(2026-11-20). 그림은 파일 안에 넣어 HTML 하나만 전달하면 된다.
// 사용: node blog-preview.cjs <초안.md> [<초안.md> …] [--out <파일.html>]
//   초안 머리말의 소재(JSON)와 같은 이름의 폴더(블로그/이미지/<소재 이름>/)에서 사진 자리에 맞는 그림을 찾는다. 없으면 "넣을 자리" 상자로 보인다.
'use strict';
const { execFileSync } = require('child_process');
const { fs, path, ROOT, readJson, kst } = require('./lib.cjs');

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const OUT = outIdx >= 0 ? path.resolve(argv[outIdx + 1]) : path.join(ROOT, '블로그', `폼셋-미리보기-${kst().slice(0, 10)}.html`);
const drafts = argv.filter((a, i) => a.endsWith('.md') && i !== outIdx + 1).map((a) => path.resolve(a));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

// 사진 자리 설명에서 어떤 그림인지 고른다: 그림 이름 끝의 낱말(표지·황제·뮤즈…)이 설명에 있으면 그 그림, 아니면 아래 규칙
function pickImage(desc, files, used) {
  for (const f of files) {
    const label = path.basename(f, '.png').split('_').pop();
    if (!used.has(f) && !/\d$/.test(label) && desc.includes(label)) return [f];
  }
  const rules = [[/숫자/, /숫자요약/], [/한눈에/, /한눈에보기/], [/고민 그래프/, /고민그래프/], [/분야/, /상담분야/], [/스타일/, /상담스타일/], [/인용/, /후기\d|인용\d/]];
  for (const [d, n] of rules) {
    if (!d.test(desc)) continue;
    const hit = files.filter((f) => n.test(path.basename(f)) && !used.has(f));
    if (hit.length) return /인용/.test(desc) ? hit : [hit[0]];
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
    name: '폼 A · 상담사 소개', when: '주 1회 (수요일)',
    aim: '한 상담사를 운영팀이 숫자와 실제 후기로 소개합니다. "홍카페 + 예명" 검색과 그 상담사의 대표 고민 검색을 함께 노립니다.',
    spec: '본문 1,200~2,300자 · 소제목 3개 이상 · 사진 6장 이상 · 후기 인용 2~4개',
    title: ['놀라운 숫자 하나 + 홍카페 <예명> <타로|신점|사주> + 물음', '예: 소개가 필요할까요? 석 달 후기만 719건, 홍카페 해율도령 신점'],
    steps: [
      ['들머리', '운영팀이 자주 듣는 말이나 궁금했던 점으로 시작 → 놀라운 숫자 하나', '표지'],
      ['숫자 이야기', '숫자를 늘어놓지 않고 하나를 골라 왜 놀라운지 풀어 쓴다', '프로필 화면, 숫자 요약'],
      ['어떤 고민으로 찾나', '분야 태그 비율을 고객의 질문으로 바꿔 말한다', '분야 그래프'],
      ['상담 스타일', '스타일 태그 + 후기 인용 2~3개 + 선생님 본인 소개', '스타일 카드, 후기 카드'],
      ['맞는 분 · 안 맞는 분', '솔직한 한계를 꼭 적는다', ''],
      ['전화 전 준비 · 프로필', '질문 세 줄, 가격, 프로필 링크', '상담 신청 화면'],
      ['마무리', '참고용 한 줄, 댓글을 부르는 질문, 서명', ''],
    ],
  },
  큐레이션: {
    name: '폼 B · 고민별 상담사 3명', when: '격주 (화요일)',
    aim: '한 고민에 후기가 많이 쌓인 상담사 3명을 묶습니다. "<고민> 타로 잘보는곳" 같은 검색을 노립니다.',
    spec: '본문 1,300~3,200자 · 소제목 4개 이상 · 사진 5장 이상 · 상담사마다 후기 인용 1개 이상',
    title: ['<고민> <타로|신점> 잘보는곳 + 홍카페 + 고른 기준', '예: 속마음 타로 잘보는곳, 홍카페에서 속마음 후기가 제일 많이 쌓인 세 분'],
    steps: [
      ['들머리', '그 고민의 흔한 장면 → 고른 기준과 기준일을 그대로 밝힌다(광고비 순서가 아님)', '표지'],
      ['후기 태그 설명', '무슨 숫자인지 한 문단, 세 분의 후기 수', '한눈에 보기'],
      ['상담사별 소개 ×3', '후기 수·비중·스타일을 문장으로, 후기 인용, 가격, 프로필 링크', '상담사 카드'],
      ['누구한테 전화할까', '스타일로 고르는 법, 준비할 것', ''],
      ['마무리', '순서는 바뀔 수 있음, 다음 주제를 댓글로 묻기, 서명', ''],
    ],
  },
  주간타로: {
    name: '폼 C · 주간 타로 이야기', when: '매주 (금요일, 다음 주 미리 보기)',
    aim: '그 주 홍카페 후기에서 가장 많았던 고민을 주제로 카드 세 장을 뽑아 한 주 이야기를 씁니다. 상담사 홍보 글이 아니라 매주 찾아 읽는 읽을거리입니다.',
    spec: '본문 1,100~2,200자 · 소제목 3개 이상 · 사진 5장 이상 · 카드는 도구가 뽑은 세 장 그대로',
    title: ['<몇 월 몇째 주> <고민> 타로｜한 줄 요약, 카드 3장', '예: 12월 첫째 주 재회 타로｜연락을 기다리는 분께, 카드 3장'],
    steps: [
      ['들머리', '이번 주 후기에서 가장 많았던 고민과 숫자 → 그래서 이번 주 주제', '표지, 고민 그래프'],
      ['이번 주 흐름 (카드 1)', '카드 뜻을 그 고민에 맞춰 풀고, 이번 주에 해 볼 일 하나', '카드'],
      ['조심할 점 (카드 2)', '후기에서 자주 보이는 이야기와 엮는다', '카드'],
      ['조언 (카드 3)', '그림을 떠올리게 설명하고 작은 행동으로 끝낸다', '카드'],
      ['세 장을 이어 보면', '한 줄 요약 → 그 고민 후기가 많았던 상담사 한 명과 후기 한 줄', ''],
      ['마무리', '재미와 참고용, 다음 주 주제를 댓글로 묻기, 서명', ''],
    ],
  },
  칼럼: {
    name: '폼 D · 타로·사주·신점 상식 칼럼', when: '매주 (월요일, 사주·신점·타로 번갈아)',
    aim: '사람들이 궁금해하는 상식 하나를, 홍카페 상담사가 직접 쓴 포스팅에서 답을 찾아 풀어 줍니다. 전문가의 말을 빌리되 누구 글인지 밝히고 프로필로 잇습니다.',
    spec: '본문 1,100~2,200자 · 소제목 2개 이상 · 사진 3장 이상 · 상담사 포스팅 인용 1개 이상',
    title: ['사람들이 실제로 하는 질문 + 통념 뒤집기', '예: 편관운이 오면 정말 힘들기만 할까요? 사주 선생님의 대처법'],
    steps: [
      ['들머리', '처음 보는 사람이 하는 질문 그대로 → 운영팀도 궁금했다 → 답을 찾은 포스팅 소개', '표지'],
      ['선생님의 답', '포스팅 문장 인용 + 우리 말로 쉬운 비유', '인용 카드'],
      ['헷갈리는 지점', '"그럼 이건요?" 하고 한 번 더 묻고 답한다. 선생님마다 다르다는 점도', ''],
      ['그래서 어떻게', '상담 전에 준비할 것, 하면 손해인 행동', ''],
      ['마무리', '한 선생님의 설명임을 밝히기, 프로필 링크, 다음 질문을 댓글로 받기, 서명', '프로필 화면'],
    ],
  },
};
const VOICE = [
  ['한 문장마다 줄을 바꿉니다', '반응 좋은 글은 한 줄이 40~50자 안팎이었습니다. 문단을 길게 붙이면 휴대폰에서 읽히지 않습니다.'],
  ['습니다체에 …요, …죠, …거든요를 섞습니다', '"~입니다"만 이어지면 보고서가 됩니다. 사주나루 글은 열 문장 중 서너 문장이 "~죠", "~거든요"로 끝납니다.'],
  ['글쓴이가 자기 생각을 말합니다', '"저희도 궁금해서", "저는 이게 재밌더라고요"처럼 운영팀이 직접 보고 느낀 것을 씁니다.'],
  ['숫자는 하나를 골라 풀어 씁니다', '숫자 여섯 개를 목록으로 늘어놓지 않습니다. 놀라운 숫자 하나를 고르고 왜 놀라운지 말합니다.'],
  ['독자에게 묻습니다', '"그 사람 지금 무슨 생각 해요?"처럼 고객이 실제로 하는 질문을 그대로 넣고, 글 끝에서 댓글로 되묻습니다.'],
  ['굳은 표현을 뺍니다', '"단순히 ~이 아니라", "눈에 띄는 것은", "~라는 뜻입니다", "다양한", "권합니다"는 검사에서 걸립니다.'],
];
const BEFORE = ['후기에 붙은 상담 분야 태그를 보면 애정 36%, 속마음 26%, 재회 17% 순서입니다. 연애와 관계에 얽힌 고민이 대부분을 차지합니다. 최근 한 달 사이에는 재회 태그가 107건에서 153건으로 늘었습니다.', '홍카페 베리 상담사를 찾는 분들의 고민은 대체로 이렇습니다. 상대의 속마음이 궁금할 때, 헤어진 뒤 다시 이어질 수 있을지 알고 싶을 때, 지금 만나는 사람과의 흐름이 불안할 때입니다.'];
const AFTER = ['후기에 붙은 분야 태그를 보면 답이 바로 나옵니다.', '애정 36%, 속마음 26%, 재회 17%.', '거의 다 연애 이야기예요.', '"그 사람 지금 무슨 생각 해요?"', '이 질문 하나 들고 전화하시는 분이 그만큼 많다는 거죠.', '요즘은 재회 쪽이 더 늘었습니다.', '한 달 사이에 재회 태그가 107건에서 153건이 됐거든요.', '연말이 가까워지면 다들 생각나는 사람이 있나 봅니다.'];
const BLOGS = [
  ['사주나루 블로그', '평일 매일 1개', '공감 20 · 댓글 21', '사주 상식 칼럼, 월운, 전문가 인터뷰. 글쓴이 목소리가 뚜렷하고 댓글로 질문을 받음'],
  ['신통 블로그', '하루 2~3개', '공감 8 · 댓글 2', '오늘의 띠별·별자리 운세, 고민 장면으로 시작하는 선생님 소개'],
  ['홍카페 공식 블로그', '주 4~5개', '공감 2 · 댓글 0.6', '상담사 소개(프로필 문구 중심), 운세·테스트. 반응이 좋았던 글은 질문과 답 형식의 궁합 글'],
];
const WEEK = [['월', '폼 D · 상식 칼럼', '사주 → 신점 → 타로 순서로 번갈아. 검색으로 꾸준히 들어오는 글'], ['화 (격주)', '폼 B · 고민별 상담사 3명', '고민과 분류(타로·신점·사주)를 바꿔 가며'], ['수', '폼 A · 상담사 소개', '그 주 후기가 많이 는 상담사부터'], ['금', '폼 C · 주간 타로', '다음 주 미리 보기. 매주 같은 요일에 올려 찾아오게 한다']];

function formPanel(d) {
  const f = FORMS[d.meta['폼']];
  const pass = /결과: 통과/.test(d.check);
  return `<section class="panel">
  <div class="intro"><h2>${esc(f.name)}</h2><p>${esc(f.aim)}</p><p class="spec">${esc(f.spec)} · 올리는 주기: ${esc(f.when)}</p></div>
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
function voicePanel() {
  return `<section class="panel"><div class="intro"><h2>말투 · 실제 블로그에서 뽑은 기준</h2><p>처음 견본은 통계를 늘어놓고 "~입니다"만 이어져 기계가 쓴 보고서처럼 읽혔습니다. 반응이 좋은 실제 블로그 글을 읽고 기준을 뽑아 다시 썼고, 같은 기준을 초안 검사에 넣었습니다.</p></div>
  <div class="cardbox"><h4 style="margin-top:0">살펴본 블로그 (최근 150개 글 기준, 2026-11-20 확인)</h4><table><tr><th>블로그</th><th>올리는 주기</th><th>글 하나 평균 반응</th><th>특징</th></tr>${BLOGS.map((r) => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}</table></div>
  <div class="ba"><div><span class="tag no">교정 전</span>${BEFORE.map((p) => `<p>${esc(p)}</p>`).join('')}<p class="muted">한 문단 100자 이상 · 전부 "~입니다" · 글쓴이가 보이지 않음</p></div><div><span class="tag ok">교정 후</span>${AFTER.map((p) => `<p>${esc(p)}</p>`).join('')}<p class="muted">한 줄 30자 안팎 · 해요체 절반 · 고객 질문과 글쓴이 생각이 들어감</p></div></div>
  <div class="rules">${VOICE.map(([t, c]) => `<div><b>${esc(t)}</b><p>${esc(c)}</p></div>`).join('')}</div>
  <div class="cardbox"><h4 style="margin-top:0">바뀌지 않는 원칙</h4><p style="margin:0">말투는 사람처럼 쓰지만 글쓴이는 끝까지 홍카페 운영팀입니다. 고객이 쓴 체험 후기처럼 꾸미지 않고("내돈내산", "제가 받아봤어요" 금지), 숫자와 인용은 소재에 있는 것만 쓰며, 결과를 약속하지 않습니다. 주간 타로의 카드는 글쓴이가 고르지 않고 도구가 뽑습니다.</p></div></section>`;
}
function weekPanel() {
  return `<section class="panel"><div class="intro"><h2>주간 편성 제안</h2><p>상담사 홍보 글(폼 A·B)과 매주 찾아 읽는 읽을거리(폼 C·D)를 섞어 한 주에 3~4개를 올리는 안입니다. 사주나루 블로그는 평일마다 1개씩 올리고 있고, 정해진 날에 올라오는 글(월운·시리즈)의 댓글이 가장 많았습니다.</p></div>
  <div class="cardbox"><table><tr><th>요일</th><th>폼</th><th>내용</th></tr>${WEEK.map((r) => `<tr><th>${esc(r[0])}</th><td><b>${esc(r[1])}</b></td><td>${esc(r[2])}</td></tr>`).join('')}</table>
  <p class="muted" style="margin-top:14px">요일과 횟수는 제안입니다. 게시 위치와 담당이 정해지면 맞춰 조정합니다. 실제 인물(연예인) 사주 풀이는 명예·초상권 문제가 있어 폼에 넣지 않았습니다.</p></div></section>`;
}

function main() {
  if (!drafts.length) { console.log('사용: node blog-preview.cjs <초안.md> [<초안.md> …] [--out <파일.html>]'); process.exit(2); }
  const order = ['소개', '큐레이션', '주간타로', '칼럼'];
  const docs = drafts.map(renderDraft).sort((a, b) => order.indexOf(a.meta['폼']) - order.indexOf(b.meta['폼']));
  const tabs = [...docs.map((d) => [FORMS[d.meta['폼']].name, formPanel(d)]), ['말투 교정 전·후', voicePanel()], ['주간 편성', weekPanel()]];
  const css = `
:root{--bg:#F6F4F1;--card:#fff;--ink:#1F1B2D;--sub:#5B5670;--mute:#8A869A;--line:#E7E3EE;--brand:#6335B4;--tint:#EFEAF8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Pretendard","Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif;line-height:1.7;-webkit-text-size-adjust:100%}
header{padding:40px 24px 8px;max-width:1180px;margin:0 auto}header h1{font-size:28px;margin:0 0 8px;letter-spacing:-.5px}header p{margin:0;color:var(--sub);max-width:780px}
nav{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);margin-top:20px}nav div{max-width:1180px;margin:0 auto;padding:10px 24px;display:flex;gap:8px;overflow-x:auto}
nav button{font:inherit;font-weight:700;font-size:15px;white-space:nowrap;padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--sub);cursor:pointer}
nav button[aria-selected=true]{background:var(--brand);border-color:var(--brand);color:#fff}
main{max-width:1180px;margin:0 auto;padding:24px 24px 80px}.panel{display:none}.panel.on{display:block}
.intro h2{font-size:22px;margin:0 0 6px}.intro p{margin:0;color:var(--sub);max-width:840px}.intro .spec{margin-top:8px;font-weight:700;color:var(--ink)}
.cols{display:grid;grid-template-columns:340px minmax(0,1fr);gap:28px;margin-top:24px;align-items:start}
aside{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;font-size:14.5px;position:sticky;top:72px;max-height:calc(100vh - 90px);overflow:auto}
aside h4,.cardbox h4{font-size:13px;color:var(--mute);letter-spacing:.3px;margin:18px 0 6px}aside h4:first-child{margin-top:0}
.formula{font-weight:700;margin:0}.muted{color:var(--mute);font-size:13.5px;margin:4px 0 0}
.steps{margin:0;padding-left:20px}.steps li{margin-bottom:9px}.steps b{display:block}.steps span{color:var(--sub)}.steps em{display:block;font-style:normal;color:var(--brand);font-size:13px;font-weight:700}
.badge,.tag{display:inline-block;margin:0;padding:3px 12px;border-radius:999px;font-weight:700;font-size:13px}.ok{background:#E3F4E8;color:#17663A}.no{background:#FBE6E3;color:#A1271B}
pre{white-space:pre-wrap;background:var(--bg);border-radius:10px;padding:12px;font-size:12.5px;line-height:1.6;margin:8px 0;font-family:inherit;color:var(--sub)}
article{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:40px clamp(20px,5vw,64px) 56px;min-width:0}
article>*{max-width:620px;margin-left:auto;margin-right:auto}
.kw{font-size:13px;color:var(--brand);font-weight:700}article h1{font-size:27px;line-height:1.38;letter-spacing:-.6px;margin:8px auto 6px;word-break:keep-all}
.byline{font-size:13.5px;color:var(--mute);padding-bottom:20px;border-bottom:1px solid var(--line);margin-bottom:26px}
article p{font-size:16.5px;margin:0 auto 15px;word-break:keep-all}article h3{font-size:21px;margin:46px auto 16px;padding-left:12px;border-left:4px solid var(--brand);letter-spacing:-.3px;word-break:keep-all}
article ul{padding-left:22px;margin:0 auto 16px;font-size:16.5px}article li{margin-bottom:6px;padding-left:2px}
blockquote{margin:6px auto 18px;padding:14px 18px;background:var(--tint);border-radius:12px;font-size:16px}
figure{margin:24px auto}figure img{display:block;width:100%;max-width:480px;margin:0 auto;border-radius:14px;border:1px solid var(--line)}figcaption{text-align:center;font-size:12.5px;color:var(--mute);margin-top:8px}
.slot{max-width:480px;margin:24px auto;border:2px dashed #CFC8DE;border-radius:14px;padding:26px 20px;text-align:center;color:var(--sub);font-size:15px}.slot b{display:block;color:var(--ink)}.slot span{display:block;font-size:12.5px;color:var(--mute);margin-top:4px}
.link{display:block;max-width:620px;margin:0 auto 16px;border:1px solid var(--line);border-radius:12px;padding:14px 18px;text-decoration:none;color:var(--ink)}.link span{display:block;font-size:13px;color:var(--mute);word-break:break-all}
.cardbox{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px;margin-top:24px;overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:15px}th{text-align:left;white-space:nowrap;color:var(--sub);font-weight:700;vertical-align:top;padding:9px 20px 9px 0;border-bottom:1px solid var(--line)}td{padding:9px 16px 9px 0;border-bottom:1px solid var(--line);vertical-align:top}
.rules{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:24px}.rules div{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px}.rules p{margin:6px 0 0;color:var(--sub);font-size:15px}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}.ba>div{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px}.ba p{font-size:16px;margin:12px 0 0;word-break:keep-all}.ba .muted{font-size:13.5px;margin-top:16px}
@media(max-width:900px){.cols,.ba{grid-template-columns:1fr}aside{position:static;max-height:none}header{padding-top:28px}}
`;
  const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>홍카페 블로그 폼 셋 예시</title><style>${css}</style></head><body>
<header><h1>홍카페 블로그 폼 셋 · 예시</h1><p>상담사 소개 글 두 가지와 매주 올리는 타로·사주·신점 읽을거리 두 가지, 모두 네 가지 형식입니다. 형식마다 실제 수집 자료(${esc(docs[0].source.asOf || '')})로 쓴 견본을 붙였습니다. 게시 전 초안입니다.</p></header>
<nav><div role="tablist">${tabs.map(([t], i) => `<button role="tab" aria-selected="${i === 0}" data-i="${i}">${esc(t)}</button>`).join('')}</div></nav>
<main>${tabs.map(([, h], i) => h.replace('class="panel"', `class="panel${i === 0 ? ' on' : ''}" data-i="${i}"`)).join('\n')}</main>
<script>document.querySelectorAll('nav button').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('nav button').forEach(function(x){x.setAttribute('aria-selected',x===b)});document.querySelectorAll('.panel').forEach(function(p){p.classList.toggle('on',p.dataset.i===b.dataset.i)});window.scrollTo(0,0)})});</script>
</body></html>`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, page);
  console.log(`미리보기: ${OUT} (${(page.length / 1e6).toFixed(1)}MB, 초안 ${docs.length}개 · 이미지 ${docs.reduce((s, d) => s + d.images, 0)}장)`);
}
main();
