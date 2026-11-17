// 숏폼 영상 시안 만들기: 장면표(JSON) → 세로 1080×1920 장면 그림(PNG) → ffmpeg로 이어 붙인 mp4.
// 진행 캐릭터 볼콩이(3D, 기본)는 장면 내용(후기 카드·상담사 사진·순위 팻말)을 직접 들고 반응한다(character3d.cjs로 장면마다 만들고 다시 씀).
// 배경·글꼴·말풍선은 볼콩이 색(크림·라벤더·핑크)에 맞춘 'studio' 테마가 기본이다(2026-11-17 대표: 글과 캐릭터가 따로 놀지 않게).
// 화면 위아래 표시(홍카페·캐릭터 이름·내부 시안·기준·쪽수)는 기본으로 넣지 않는다(plan.chrome:true면 넣음). 영상은 시안이며 게시·업로드하지 않는다.
// 사용: node make-short.cjs <장면표.json> [--out <폴더>] [--no-video]
//   장면표 형식: 같은 폴더의 장면표-형식.md
//   결과: <폴더>/<이름>.mp4, <폴더>/미리보기/장면-01.png …  (폴더 기본값은 장면표가 있는 폴더)
'use strict';
const { fs, path, ROOT, needProgram, readJson, FONT_CSS, useLocalFonts, waitFonts } = require('./lib.cjs');
const { spawnSync } = require('child_process');
const os = require('os');

const W = 1080, H = 1920, FPS = 30;
const WORKSPACE = path.resolve(ROOT, '..', '..');
const CHAR_DIR = path.join(ROOT, '영상', '캐릭터', '자른그림');
const MAX_SCENES = 12, MAX_SECONDS = 60;
const FLOOR = 1730; // 캐릭터가 서는 바닥선
// 홍카페 로고(사이트 머리글 로고, 2026-11-17 대표: 로고 넣기). 위쪽 가운데에 작게, 인트로·마무리는 크게
const LOGO = path.join(ROOT, '영상', '로고', '홍카페_로고_full.svg');
const logoUrl = () => (fs.existsSync(LOGO) ? `data:image/svg+xml;base64,${fs.readFileSync(LOGO).toString('base64')}` : null);

function ffmpegBin() {
  const names = process.platform === 'win32' ? ['ffmpeg.exe'] : ['ffmpeg'];
  const dirs = [...String(process.env.PATH || '').split(path.delimiter), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
  for (const d of dirs) for (const n of names) if (d && fs.existsSync(path.join(d, n))) return path.join(d, n);
  // winget 설치 직후에는 PATH가 새로 켠 창에만 반영되므로 설치 폴더를 직접 찾는다
  const pkgs = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(pkgs)) {
    for (const p of fs.readdirSync(pkgs).filter((x) => /ffmpeg/i.test(x))) {
      const stack = [path.join(pkgs, p)];
      while (stack.length) {
        const dir = stack.pop();
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) stack.push(full);
          else if (e.name.toLowerCase() === 'ffmpeg.exe') return full;
        }
      }
    }
  }
  throw new Error('ffmpeg를 찾지 못했습니다. winget install Gyan.FFmpeg 로 설치하세요.');
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lines = (s) => esc(s).replace(/\n/g, '<br>');
const pngSize = (file) => { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

// ---------- 진행 캐릭터 ----------
const is3d = (plan) => (plan.host?.style || '3d') === '3d';
const POSE3D = { 기본: 'idle', 인사: 'wave', 하트: 'heart', 감동: 'touched', 웃음: 'happy', 수줍: 'shy' };
// 장면에서 볼콩이가 할 일: 3D는 렌더 작업(자세·표정·소품)과 자리·크기, 2D는 자른 그림 한 장
function hostSpec(plan, s) {
  if (!plan.host) return null;
  if (is3d(plan)) {
    const h = s.host || {};
    if (s.type === 'rank') return { at: 'center', size: h.size || 760, say: h.say, job: { pose: 'idle', expression: h.expression, prop: { type: 'sign', text: String(s.rank) } } };
    if (s.type === 'quote' && h.hold !== false) return { at: 'center', size: h.size || 1060, say: h.say, job: { pose: 'idle', expression: h.expression || 'touched', prop: { type: 'card', text: s.text, meta: s.meta || '' } } };
    if (s.type === 'profile' && s.photo && plan.counselor?.image) return { at: 'center', size: h.size || 940, say: h.say, job: { pose: 'idle', expression: h.expression || 'happy', prop: { type: 'photo', image: plan.counselor.imageData || plan.counselor.image } } };
    if (!s.host) return null;
    const at = h.at || 'center';
    return { at, size: h.size || (at === 'center' ? 760 : 520), say: h.say, job: { pose: POSE3D[h.pose] || 'idle', expression: h.expression } };
  }
  if (!s.host) return null;
  const dir = plan.host.dir ? path.resolve(WORKSPACE, plan.host.dir) : CHAR_DIR;
  const file = path.join(dir, `${plan.host.prefix ?? '볼콩_'}${s.host.pose || '기본'}.png`);
  if (!fs.existsSync(file)) throw new Error(`캐릭터 그림이 없습니다: ${file}`);
  return { at: s.host.at || 'left', size: s.host.size || (s.host.at === 'center' ? 640 : 430), say: s.host.say, file };
}
// 3D 렌더 작업을 모아 한 번에 만든다(같은 내용이면 전에 만든 것을 다시 씀). 상담사 사진은 미리 받아 그림 데이터로 넘긴다
async function ensure3d(plan) {
  if (!plan.host || !is3d(plan)) return;
  const { renderJobs, jobKey, OUT } = require('./character3d.cjs');
  if (plan.scenes.some((s) => s.type === 'profile' && s.photo) && plan.counselor?.image && !plan.counselor.imageData && /^https?:/.test(plan.counselor.image)) {
    try {
      const res = await fetch(plan.counselor.image, { signal: AbortSignal.timeout(20000) });
      if (res.ok) plan.counselor.imageData = `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
    } catch { /* 사진 없이 진행 */ }
  }
  const jobs = [];
  for (const s of plan.scenes) {
    const spec = hostSpec(plan, s);
    if (!spec?.job) continue;
    spec.job.outline = plan.host.outline !== false;
    spec.job.name = path.join('_장면', jobKey(spec.job));
    s._dir = path.join(OUT, spec.job.name);
    if (!jobs.some((j) => j.name === spec.job.name)) jobs.push(spec.job);
  }
  if (jobs.length) await renderJobs(jobs, { log: () => {} });
}
// 장면의 캐릭터 자리(화면 픽셀). 바닥선 위에 선다
function hostBox(plan, s) {
  const spec = hostSpec(plan, s);
  if (!spec) return null;
  let file = spec.file, seq = null;
  if (spec.job) { file = path.join(s._dir, 'f_000.png'); seq = path.join(s._dir, 'f_%03d.png'); if (!fs.existsSync(file)) throw new Error(`3D 캐릭터 그림이 없습니다: ${s._dir}`); }
  const { w: iw, h: ih } = pngSize(file);
  let h = Math.round(spec.size), w = Math.round((iw * h) / ih);
  if (w > W - 40) { w = W - 40; h = Math.round((ih * w) / iw); }
  const y = FLOOR - h;
  const x = spec.at === 'right' ? W - 40 - w : spec.at === 'left' ? 40 : Math.round((W - w) / 2);
  return { file, seq, at: spec.at, x, y, w, h, say: spec.say || '' };
}

const THEMES = {
  studio: { bg: 'linear-gradient(180deg, #fff6ee 0%, #fdebf1 48%, #efe4f8 100%)', text: '#3b2430', sub: '#8a6a9c', accent: '#e0607e', card: 'rgba(255,255,255,0.75)', line: 'rgba(224,96,126,0.25)', bubble: '#ffffff', bubbleText: '#3b2430', floor: 'rgba(214,170,214,0.55)', dots: true },
  night: { bg: 'radial-gradient(120% 80% at 50% 0%, #4a2a7a 0%, #24123f 45%, #120a22 100%)', text: '#fbf7ff', sub: '#d9c9f2', accent: '#f5c86a', card: 'rgba(255,255,255,0.08)', line: 'rgba(245,200,106,0.55)', bubble: '#fffaf3', bubbleText: '#3a2340', floor: 'rgba(160,120,220,0.35)', dots: false },
  pastel: { bg: 'linear-gradient(180deg, #fde8f1 0%, #ece6ff 55%, #dff0ff 100%)', text: '#2b1f3a', sub: '#5d4d72', accent: '#b0458a', card: 'rgba(255,255,255,0.65)', line: 'rgba(176,69,138,0.35)', bubble: '#ffffff', bubbleText: '#3a2340', floor: 'rgba(200,170,220,0.4)', dots: true },
};

function sceneBody(s, plan, box) {
  const three = plan.host && is3d(plan);
  const photo = s.photo && plan.counselor?.image && !(three && box) ? `<div class="photo" style="background-image:url('${esc(plan.counselor.image)}')"></div>` : '';
  switch (s.type) {
    case 'title':
      return `<div class="center"><div class="kicker">${esc(s.kicker || '')}</div><div class="fit title">${lines(s.title)}</div>${s.sub ? `<div class="sub">${lines(s.sub)}</div>` : ''}</div>`;
    case 'hook':
      return `<div class="center"><div class="kicker">${esc(s.kicker || '')}</div><div class="fit big">${lines(s.text)}</div></div>`;
    case 'rank':
      if (three) return `<div class="center"><div class="fit name">${lines(s.title || '')}</div>${s.sub ? `<div class="sub">${lines(s.sub)}</div>` : ''}</div>`;
      return `<div class="center"><div class="fit name">${esc(s.label || 'TOP')} ${esc(s.rank)}</div><div class="fit name">${lines(s.title || '')}</div><div class="sub">${lines(s.sub || '')}</div></div>`;
    case 'profile':
      return `<div class="center">${photo}<div class="fit name">${lines(s.title || plan.counselor?.nick || '')}</div>
        ${(s.lines || []).length ? `<div class="rows">${s.lines.map((l) => `<div class="row">${esc(l)}</div>`).join('')}</div>` : ''}
        ${(s.chips || []).length ? `<div class="chips">${s.chips.map((c) => `<span>#${esc(c)}</span>`).join('')}</div>` : ''}</div>`;
    case 'quote':
      // 3D에서는 볼콩이가 후기 카드를 들고 있으므로 위에는 머리말만 둔다
      if (three && box) return s.kicker || s.title ? `<div class="center"><div class="kicker">${esc(s.kicker || '')}</div>${s.title ? `<div class="fit mid">${lines(s.title)}</div>` : ''}</div>` : '';
      return `<div class="center"><div class="qmark">“</div><div class="card"><div class="fit quote">${lines(s.text)}</div></div>
        <div class="meta">${esc(s.meta || '')}</div>${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}</div>`;
    case 'stats':
      return `<div class="center"><div class="fit mid">${lines(s.title || '')}</div><div class="stats">${(s.items || []).map((x) => `<div class="stat"><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join('')}</div></div>`;
    case 'cta':
      return `<div class="center"><div class="fit big">${lines(s.text)}</div>${s.sub ? `<div class="sub">${lines(s.sub)}</div>` : ''}${(s.brand ?? 'hongcafe.com') ? `<div class="brand">${esc(s.brand ?? 'hongcafe.com')}</div>` : ''}</div>`;
    default:
      return s.text ? `<div class="center"><div class="fit mid">${lines(s.text)}</div></div>` : '';
  }
}

// 말풍선: 볼콩이 머리 바로 위에 붙이고, 꼬리를 머리 쪽으로 낸다
function bubbleHtml(box) {
  if (!box || !box.say) return '';
  const bw = Math.min(900, W - 80);
  const cx = box.x + box.w / 2;
  const left = Math.min(Math.max(cx - bw / 2, 40), W - 40 - bw);
  const tail = Math.min(Math.max(cx - left, 70), bw - 70);
  return `<div class="bubble" style="left:${left}px;width:${bw}px;bottom:${H - box.y - 6}px"><div class="fitb">${lines(box.say)}</div><i style="left:${tail - 24}px"></i></div>`;
}

function sceneHtml(s, plan, i, n) {
  const t = THEMES[plan.theme] || (plan.host && is3d(plan) ? THEMES.studio : THEMES.night);
  const box = hostBox(plan, s);
  const contentBottom = box ? H - box.y + (box.say ? 270 : 40) : 260;
  const logo = plan.logo !== false ? logoUrl() : null;
  const bigLogo = logo && ['title', 'cta'].includes(s.type);
  const contentTop = plan.chrome ? 200 : logo ? (bigLogo ? 250 : 200) : 140;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>${FONT_CSS}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{background:${t.bg};color:${t.text};font-family:'Noto Sans KR','Malgun Gothic',sans-serif;position:relative;word-break:keep-all;overflow-wrap:anywhere}
.deco{position:absolute;inset:0;${t.dots ? 'background-image:radial-gradient(circle at 12% 14%,rgba(255,255,255,.9) 0 14px,transparent 15px),radial-gradient(circle at 86% 9%,rgba(255,214,228,.9) 0 22px,transparent 23px),radial-gradient(circle at 92% 46%,rgba(255,255,255,.8) 0 10px,transparent 11px),radial-gradient(circle at 7% 58%,rgba(232,214,246,.9) 0 18px,transparent 19px),radial-gradient(circle at 18% 88%,rgba(255,255,255,.7) 0 12px,transparent 13px),radial-gradient(circle at 80% 92%,rgba(255,220,232,.8) 0 16px,transparent 17px);' : 'background-image:radial-gradient(2px 2px at 12% 18%,#fff8,transparent),radial-gradient(2px 2px at 78% 12%,#fff6,transparent),radial-gradient(3px 3px at 64% 34%,#fff5,transparent);'}}
.floor{position:absolute;left:50%;top:${FLOOR - 40}px;width:920px;height:150px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,${t.floor},transparent)}
.top{position:absolute;top:70px;left:80px;right:80px;display:flex;justify-content:space-between;align-items:center;font-size:34px;color:${t.sub};font-weight:700}
.draft{font-size:28px;border:2px solid ${t.line};border-radius:999px;padding:6px 18px;color:${t.accent}}
.logo{position:absolute;left:50%;transform:translateX(-50%);top:${bigLogo ? 70 : 64}px;height:${bigLogo ? 112 : 66}px}
.center{position:absolute;top:${contentTop}px;bottom:${contentBottom}px;left:80px;right:80px;overflow:hidden;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:26px}
.fit{width:100%;overflow:visible;line-height:1.25;font-family:'Jua','Noto Sans KR',sans-serif;font-weight:400}
.big{font-size:104px}.mid{font-size:84px}.name{font-size:120px;color:${t.accent};text-shadow:0 6px 0 rgba(255,255,255,.9)}.title{font-size:124px;color:${t.text};text-shadow:0 6px 0 rgba(255,255,255,.9)}
.quote{font-size:60px;font-family:'Noto Sans KR',sans-serif;font-weight:700;line-height:1.5;max-height:760px}
.kicker{display:inline-block;font-family:'Jua',sans-serif;font-size:46px;color:#fff;background:${t.accent};padding:10px 30px;border-radius:999px;box-shadow:0 8px 20px rgba(224,96,126,.25)}
.kicker:empty{display:none}
.rows{display:grid;gap:12px}.row{font-size:46px;color:${t.text};font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}.chips span{font-size:40px;padding:10px 26px;border-radius:999px;background:${t.card};color:${t.sub};font-weight:700}
.photo{width:380px;height:380px;flex:none;border-radius:50%;background-size:cover;background-position:center;border:10px solid #fff;box-shadow:0 18px 40px rgba(120,70,110,.25)}
.qmark{font-size:200px;line-height:.6;color:${t.accent};font-family:Georgia,serif;height:110px}
.card{width:100%;background:${t.card};border-radius:40px;padding:56px 52px;border:2px solid ${t.line}}
.meta{font-size:40px;color:${t.sub};font-weight:700}.note{font-size:30px;color:${t.sub};opacity:.8}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:28px;width:100%}.stat{background:${t.card};border-radius:32px;padding:44px 20px;display:grid;gap:10px}.stat b{font-family:'Jua',sans-serif;font-size:84px;color:${t.accent};font-weight:400}.stat span{font-size:38px;color:${t.sub};font-weight:700}
.sub{font-size:48px;color:${t.sub};font-weight:700;line-height:1.4}.brand{font-family:'Jua',sans-serif;font-size:48px;color:${t.accent};margin-top:16px}
.bubble{position:absolute;overflow:visible;background:${t.bubble};color:${t.bubbleText};border-radius:56px;padding:30px 46px;box-shadow:0 14px 34px rgba(120,70,110,.18);border:4px solid #f6dbe6;max-height:250px}
.bubble i{position:absolute;bottom:-30px;width:0;height:0;border-left:24px solid transparent;border-right:24px solid transparent;border-top:32px solid #f6dbe6}
.bubble i::after{content:'';position:absolute;left:-19px;top:-37px;border-left:19px solid transparent;border-right:19px solid transparent;border-top:27px solid ${t.bubble}}
.fitb{font-family:'Jua','Noto Sans KR',sans-serif;font-size:56px;line-height:1.36;max-height:190px;overflow:visible;text-align:center}
.foot{position:absolute;bottom:90px;left:80px;right:80px;display:flex;justify-content:space-between;font-size:28px;color:${t.sub};opacity:.85}
.bar{position:absolute;bottom:60px;left:80px;right:80px;height:6px;border-radius:6px;background:${t.card}}.bar i{display:block;height:100%;width:${Math.round(((i + 1) / n) * 100)}%;background:${t.accent};border-radius:6px}
</style></head><body><div class="deco"></div>${box ? '<div class="floor"></div>' : ''}${logo && !plan.chrome ? `<img class="logo" src="${logo}" alt="홍카페">` : ''}
${plan.chrome ? `<div class="top"><span>홍카페${plan.host?.name ? ` · ${esc(plan.host.name)}` : ''}</span><span class="draft">내부 시안</span></div>` : ''}
${sceneBody(s, plan, box)}
${bubbleHtml(box)}
${plan.chrome ? `<div class="foot"><span>${esc(s.basis ?? plan.basis ?? '')}</span><span>${esc(plan.progressLabel || `${i + 1}/${n}`)}</span></div><div class="bar"><i></i></div>` : ''}
<script>
// 글이 칸을 넘치면 글자 크기를 줄인다
window.fitText = () => {
const over = (el) => { const box = el.closest('.center'); return el.scrollWidth > el.clientWidth + 2 || (box && box.scrollHeight > box.clientHeight + 4) || (el.classList.contains('fitb') && el.scrollHeight > 200); };
for (const el of document.querySelectorAll('.fit, .fitb')) { let size = parseFloat(getComputedStyle(el).fontSize); let guard = 0;
  while (over(el) && size > 26 && guard++ < 90) { size -= 3; el.style.fontSize = size + 'px'; } }
};
window.fitText();
</script></body></html>`;
}

async function render(plan, outDir) {
  const { chromium } = needProgram('playwright');
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: true }); } catch { browser = await chromium.launch({ headless: true }); }
  const shots = [];
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await useLocalFonts(page);
    const prev = path.join(outDir, '미리보기');
    fs.mkdirSync(prev, { recursive: true });
    for (let i = 0; i < plan.scenes.length; i++) {
      await page.setContent(sceneHtml(plan.scenes[i], plan, i, plan.scenes.length), { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await waitFonts(page);
      // 글꼴이 바뀐 뒤 글자 크기 맞추기를 다시 한다
      await page.evaluate(() => window.fitText && window.fitText());
      await page.waitForTimeout(120);
      const png = path.join(prev, `장면-${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: png });
      shots.push(png);
      // 미리보기용: 캐릭터까지 얹은 모습(영상과 같은 자리, 첫 동작 한 장)
      const box = hostBox(plan, plan.scenes[i]);
      if (box) {
        await page.evaluate(({ src, x, y, w, h }) => { const im = document.createElement('img'); im.src = src; Object.assign(im.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }); document.body.appendChild(im); return im.decode(); },
          { src: dataUrl(box.file), x: box.x, y: box.y, w: box.w, h: box.h });
        await page.screenshot({ path: png.replace(/\.png$/, '-캐릭터.png') });
      }
    }
  } finally { await browser.close(); }
  return shots;
}

function encode(plan, shots, mp4) {
  const ff = ffmpegBin();
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  const durs = plan.scenes.map((s) => Math.min(Math.max(Number(s.seconds) || 3, 1.5), 10));
  const boxes = plan.scenes.map((s) => hostBox(plan, s));
  let input = 0;
  const parts = [];
  shots.forEach((png, i) => {
    // 배경 그림은 한 장만 넣는다. zoompan이 입력 한 장마다 d프레임을 만들므로, 반복 입력(-loop)으로 넣으면 장면이 수백 초로 늘어난다
    args.push('-i', png);
    const bgIn = input++;
    const frames = Math.round(durs[i] * FPS);
    let chain = `[${bgIn}:v]scale=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0004,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}[bg${i}]`;
    let last = `bg${i}`;
    const b = boxes[i];
    if (b) {
      // 캐릭터: 0.45초 동안 아래에서 톡 올라오거나(가운데) 옆에서 미끄러져 들어온다. 3D 동작은 자체 반복 움직임이 있다
      args.push('-loop', '1', '-framerate', String(FPS), '-t', String(durs[i]), '-i', b.seq || b.file);
      const chIn = input++;
      const from = b.at === 'right' ? W : -b.w;
      const ease = 'pow(1-min(t/0.45,1),3)';
      const xExpr = b.at === 'center' ? `${b.x}` : `${b.x}-(${b.x - from})*${ease}`;
      const yExpr = b.at === 'center' ? `${b.y}+${Math.round(b.h * 0.35)}*${ease}` : `${b.y}`;
      chain += `;[${chIn}:v]scale=${b.w}:${b.h},format=rgba[ch${i}];[${last}][ch${i}]overlay=x='${xExpr}':y='${yExpr}':eof_action=pass[ov${i}]`;
      last = `ov${i}`;
    }
    // 장면마다 픽셀 형식이 다르면(캐릭터를 얹은 장면은 투명 채널이 생김) 이어 붙일 때 화면이 검게 나오므로 같은 형식으로 맞춘다
    chain += `;[${last}]format=yuv420p,fade=t=in:st=0:d=0.25,fade=t=out:st=${(durs[i] - 0.25).toFixed(2)}:d=0.25,setsar=1,settb=AVTB,setpts=PTS-STARTPTS[v${i}]`;
    parts.push(chain);
  });
  const bgm = plan.bgm && fs.existsSync(path.resolve(WORKSPACE, plan.bgm)) ? path.resolve(WORKSPACE, plan.bgm) : null;
  const total = durs.reduce((a, c) => a + c, 0);
  if (bgm) args.push('-i', bgm); else args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  const audioIn = input++;
  const concat = `${shots.map((_, i) => `[v${i}]`).join('')}concat=n=${shots.length}:v=1:a=0,format=yuv420p[v]`;
  const audio = bgm ? `[${audioIn}:a]atrim=0:${total},afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(total - 1, 0)}:d=1,volume=0.6,aresample=44100,aformat=channel_layouts=stereo[a]` : `[${audioIn}:a]anull[a]`;
  args.push('-filter_complex', [...parts, concat, audio].join(';'), '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', String(FPS), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-shortest', '-movflags', '+faststart', mp4);
  if (process.env.SHORT_DEBUG) fs.writeFileSync(process.env.SHORT_DEBUG, JSON.stringify(args));
  const r = spawnSync(ff, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg 실패: ${(r.stderr || '').slice(-800)}`);
  return total;
}

// 장면표 하나를 영상으로. 모음 영상 도구(make-compilation.cjs)도 이 함수를 쓴다
async function renderPlan(plan, outDir, { name, noVideo = false, limits = true } = {}) {
  if (!plan || !Array.isArray(plan.scenes) || !plan.scenes.length) throw new Error('장면표에 scenes(장면 목록)가 없습니다. 장면표-형식.md를 보세요.');
  const total = plan.scenes.reduce((s, x) => s + (Number(x.seconds) || 3), 0);
  if (limits && plan.scenes.length > MAX_SCENES) throw new Error(`장면은 ${MAX_SCENES}개 이하로 해 주세요(숏폼 기준). 더 길게는 모음 영상(make-compilation.cjs)으로 이어 붙이세요.`);
  if (limits && total > MAX_SECONDS) throw new Error(`장면 길이 합이 ${total}초입니다. ${MAX_SECONDS}초 이하로 줄이거나 모음 영상으로 나누세요.`);
  // 상담사 사진: 장면표에 image가 없으면 수집 원본의 프로필 사진을 쓴다(사진 사용은 시안까지만)
  if (plan.counselor?.code && !plan.counselor.image) {
    const raw = readJson(path.join(ROOT, '원본', `${plan.counselor.code}.json`), null);
    if (raw?.image) plan.counselor.image = raw.image;
    if (raw && !plan.counselor.nick) plan.counselor.nick = raw.nick;
  }
  fs.mkdirSync(outDir, { recursive: true });
  await ensure3d(plan);
  const shots = await render(plan, outDir);
  if (noVideo) return { shots, mp4: null, seconds: total };
  const safe = String(name || plan.name || '영상').replace(/[\\/:*?"<>|]/g, '_');
  const mp4 = path.join(outDir, `${safe}.mp4`);
  const tmp = path.join(os.tmpdir(), `short-${process.pid}-${Date.now()}.mp4`);
  const secs = encode(plan, shots, tmp);
  fs.copyFileSync(tmp, mp4);
  fs.rmSync(tmp, { force: true });
  return { shots, mp4, seconds: secs };
}

module.exports = { renderPlan, ffmpegBin, W, H, FPS, WORKSPACE };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => !a.startsWith('--'));
  const outArg = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : null;
  (async () => {
    if (!file) throw new Error('사용법: node make-short.cjs <장면표.json> [--out <폴더>] [--no-video]');
    const plan = readJson(path.resolve(file), null);
    const outDir = path.resolve(outArg || path.dirname(path.resolve(file)));
    const res = await renderPlan(plan, outDir, { name: plan?.name || path.basename(file, '.json'), noVideo: argv.includes('--no-video') });
    console.log(`장면 그림 ${res.shots.length}장: ${path.join(outDir, '미리보기')}`);
    if (res.mp4) console.log(`영상: ${res.mp4} (${res.seconds.toFixed(1)}초, ${W}×${H})`);
  })().catch((e) => { console.error(`영상 만들기 오류: ${e.message}`); process.exit(1); });
}
