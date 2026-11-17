// 숏폼 영상 시안 만들기: 장면표(JSON) → 세로 1080×1920 장면 그림(PNG) → ffmpeg로 이어 붙인 mp4.
// 진행 캐릭터(host)가 있으면 말풍선과 함께 화면에 넣고, 들어올 때 미끄러지고 통통 튀게 움직인다.
// 화면 위아래 표시(홍카페·캐릭터 이름·내부 시안·기준·쪽수)는 기본으로 넣지 않는다(2026-11-17 대표 결정, plan.chrome:true면 넣음). 영상은 시안이며 게시·업로드하지 않는다.
// 사용: node make-short.cjs <장면표.json> [--out <폴더>] [--no-video]
//   장면표 형식: 같은 폴더의 장면표-형식.md
//   결과: <폴더>/<이름>.mp4, <폴더>/미리보기/장면-01.png …  (폴더 기본값은 장면표가 있는 폴더)
'use strict';
const { fs, path, ROOT, needProgram, readJson } = require('./lib.cjs');
const { spawnSync } = require('child_process');
const os = require('os');

const W = 1080, H = 1920, FPS = 30;
const WORKSPACE = path.resolve(ROOT, '..', '..');
const CHAR_DIR = path.join(ROOT, '영상', '캐릭터', '자른그림');
const MAX_SCENES = 12, MAX_SECONDS = 60;

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
// 3D(host.style "3d", 기본): 영상/캐릭터/3d/<자세>/f_000.png… 반복 동작. 2D: 영상/캐릭터/자른그림/<prefix><자세>.png 한 장
const CHAR3D_DIR = path.join(ROOT, '영상', '캐릭터', '3d');
const is3d = (plan) => (plan.host?.style || '3d') === '3d';
function hostFile(plan, pose) {
  const host = plan.host;
  if (!host) return null;
  const name = pose || host.pose || '기본';
  if (is3d(plan)) {
    const dir = path.join(host.dir3d ? path.resolve(WORKSPACE, host.dir3d) : CHAR3D_DIR, name);
    const first = path.join(dir, 'f_000.png');
    if (!fs.existsSync(first)) throw new Error(`3D 캐릭터 동작이 없습니다: ${dir} (node character3d.cjs ${name} 로 만드세요)`);
    return { file: first, seq: path.join(dir, 'f_%03d.png') };
  }
  const dir = host.dir ? path.resolve(WORKSPACE, host.dir) : CHAR_DIR;
  const file = path.join(dir, `${host.prefix ?? '볼콩_'}${name}.png`);
  if (!fs.existsSync(file)) throw new Error(`캐릭터 그림이 없습니다: ${file}`);
  return { file, seq: null };
}
// 장면의 캐릭터 자리(화면 픽셀). 아래쪽 바닥선(1700) 위에 선다. 3D 순위 장면은 팻말을 든 볼콩이를 가운데 크게 둔다
function hostBox(plan, s) {
  if (!plan.host) return null;
  let host = s.host;
  if (s.type === 'rank' && is3d(plan)) host = { pose: `팻말_${s.rank}`, at: 'center', size: 760, ...(s.host || {}) };
  if (!host) return null;
  const { file, seq } = hostFile(plan, host.pose);
  const at = host.at || 'left';
  const size = Number(host.size) || (at === 'center' ? 680 : 470);
  const { w: iw, h: ih } = pngSize(file);
  const h = Math.round(size), w = Math.round((iw * size) / ih);
  const y = 1700 - h;
  const x = at === 'right' ? W - 50 - w : at === 'center' ? Math.round((W - w) / 2) : 50;
  return { file, seq, at, x, y, w, h, say: host.say || '' };
}

const THEMES = {
  night: { bg: 'radial-gradient(120% 80% at 50% 0%, #4a2a7a 0%, #24123f 45%, #120a22 100%)', text: '#fbf7ff', sub: '#d9c9f2', accent: '#f5c86a', card: 'rgba(255,255,255,0.08)', line: 'rgba(245,200,106,0.55)', bubble: '#fffaf3', bubbleText: '#3a2340' },
  pastel: { bg: 'linear-gradient(180deg, #fde8f1 0%, #ece6ff 55%, #dff0ff 100%)', text: '#2b1f3a', sub: '#5d4d72', accent: '#b0458a', card: 'rgba(255,255,255,0.65)', line: 'rgba(176,69,138,0.35)', bubble: '#ffffff', bubbleText: '#3a2340' },
};

function sceneBody(s, plan) {
  const photo = s.photo && plan.counselor?.image ? `<div class="photo" style="background-image:url('${esc(plan.counselor.image)}')"></div>` : '';
  switch (s.type) {
    case 'title':
      return `<div class="center"><div class="kicker">${esc(s.kicker || '')}</div><div class="fit title">${lines(s.title)}</div><div class="sub">${lines(s.sub || '')}</div></div>`;
    case 'hook':
      return `<div class="center"><div class="kicker">${esc(s.kicker || '')}</div><div class="fit big">${lines(s.text)}</div></div>`;
    case 'rank': {
      // 볼콩이가 든 팻말에 순위를 쓴다(팻말 자세 그림 안의 판 위치에 맞춤)
      const file = plan.host && !is3d(plan) ? hostFile(plan, s.pose || '팻말').file : null;
      const sign = file ? `<div class="signwrap"><img src="${dataUrl(file)}"><div class="signtext"><small>${esc(s.label || 'TOP')}</small><b>${esc(s.rank)}</b></div></div>` : (plan.host && is3d(plan) ? '' : `<div class="fit name">${esc(s.label || 'TOP')} ${esc(s.rank)}</div>`);
      return `<div class="center rankc">${sign}<div class="fit name">${lines(s.title || '')}</div><div class="sub">${lines(s.sub || '')}</div></div>`;
    }
    case 'profile':
      return `<div class="center">${photo}<div class="fit name">${lines(s.title || plan.counselor?.nick || '')}</div>
        <div class="rows">${(s.lines || []).map((l) => `<div class="row">${esc(l)}</div>`).join('')}</div>
        ${(s.chips || []).length ? `<div class="chips">${s.chips.map((c) => `<span>#${esc(c)}</span>`).join('')}</div>` : ''}</div>`;
    case 'quote':
      return `<div class="center"><div class="qmark">“</div><div class="card"><div class="fit quote">${lines(s.text)}</div></div>
        <div class="meta">${esc(s.meta || '')}</div>${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}</div>`;
    case 'stats':
      return `<div class="center"><div class="fit mid">${lines(s.title || '')}</div><div class="stats">${(s.items || []).map((x) => `<div class="stat"><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join('')}</div></div>`;
    case 'cta':
      return `<div class="center"><div class="fit big">${lines(s.text)}</div><div class="sub">${lines(s.sub || '')}</div><div class="brand">홍카페 · hongcafe.com</div></div>`;
    default:
      return `<div class="center"><div class="fit mid">${lines(s.text || '')}</div></div>`;
  }
}

function bubbleHtml(box) {
  if (!box || !box.say) return '';
  const left = 60, right = 60, width = W - left - right;
  const tail = Math.min(Math.max(box.x + box.w / 2 - left, 60), width - 60);
  return `<div class="bubble" style="left:${left}px;right:${right}px;bottom:${H - box.y + 26}px"><div class="fitb">${lines(box.say)}</div><i style="left:${tail - 22}px"></i></div>`;
}

function sceneHtml(s, plan, i, n) {
  const t = THEMES[plan.theme] || THEMES.night;
  const box = hostBox(plan, s);
  const contentBottom = box ? H - box.y + (box.say ? 300 : 40) : 240;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{background:${t.bg};color:${t.text};font-family:'Noto Sans KR','Malgun Gothic',sans-serif;position:relative;word-break:keep-all;overflow-wrap:anywhere}
.stars{position:absolute;inset:0;background-image:radial-gradient(2px 2px at 12% 18%,#fff8,transparent),radial-gradient(2px 2px at 78% 12%,#fff6,transparent),radial-gradient(3px 3px at 64% 34%,#fff5,transparent),radial-gradient(2px 2px at 22% 72%,#fff5,transparent),radial-gradient(2px 2px at 88% 80%,#fff6,transparent);opacity:${plan.theme === 'pastel' ? 0 : 1}}
.top{position:absolute;top:70px;left:80px;right:80px;display:flex;justify-content:space-between;align-items:center;font-size:34px;color:${t.sub};font-weight:700;letter-spacing:.02em}
.draft{font-size:28px;border:2px solid ${t.line};border-radius:999px;padding:6px 18px;color:${t.accent}}
.center{position:absolute;top:${plan.chrome ? 200 : 150}px;bottom:${contentBottom}px;left:90px;right:90px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:32px}
.fit{width:100%;max-height:900px;overflow:hidden;line-height:1.35;font-weight:900}
.big{font-size:100px}.mid{font-size:78px}.name{font-size:110px;color:${t.accent}}.title{font-size:118px;line-height:1.25}
.quote{font-size:60px;font-weight:700;line-height:1.5;max-height:760px}
.kicker{font-size:44px;color:${t.accent};font-weight:700}
.rows{display:grid;gap:16px}.row{font-size:48px;color:${t.text};font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:16px;justify-content:center}.chips span{font-size:40px;padding:10px 26px;border-radius:999px;background:${t.card};color:${t.sub}}
.photo{width:400px;height:400px;flex:none;border-radius:50%;background-size:cover;background-position:center;border:8px solid ${t.accent};box-shadow:0 20px 60px #0006}
.qmark{font-size:200px;line-height:.6;color:${t.accent};font-family:Georgia,serif;height:110px}
.card{width:100%;background:${t.card};border-radius:40px;padding:56px 52px;border:2px solid ${t.line}}
.meta{font-size:40px;color:${t.sub};font-weight:700}.note{font-size:30px;color:${t.sub};opacity:.8}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:28px;width:100%}.stat{background:${t.card};border-radius:32px;padding:44px 20px;display:grid;gap:10px}.stat b{font-size:80px;color:${t.accent}}.stat span{font-size:38px;color:${t.sub}}
.sub{font-size:50px;color:${t.sub};font-weight:700;line-height:1.4}.brand{font-size:44px;color:${t.accent};font-weight:900;margin-top:20px}
.rankc{gap:24px}.signwrap{position:relative;width:640px;flex:none}.signwrap img{width:100%;display:block;filter:drop-shadow(0 18px 40px #0007)}
.signtext{position:absolute;left:14%;top:43%;width:63%;height:33%;display:flex;align-items:center;justify-content:center;gap:14px;color:#3a2340;font-weight:900}
.signtext small{font-size:54px;color:#b0458a}.signtext b{font-size:130px;line-height:1}
.bubble{position:absolute;background:${t.bubble};color:${t.bubbleText};border-radius:44px;padding:34px 44px;box-shadow:0 16px 40px #0005;max-height:250px}
.bubble i{position:absolute;bottom:-26px;width:0;height:0;border-left:22px solid transparent;border-right:22px solid transparent;border-top:28px solid ${t.bubble}}
.fitb{font-size:48px;font-weight:700;line-height:1.4;max-height:180px;overflow:hidden;text-align:center}
.foot{position:absolute;bottom:90px;left:80px;right:80px;display:flex;justify-content:space-between;font-size:28px;color:${t.sub};opacity:.85}
.bar{position:absolute;bottom:60px;left:80px;right:80px;height:6px;border-radius:6px;background:${t.card}}.bar i{display:block;height:100%;width:${Math.round(((i + 1) / n) * 100)}%;background:${t.accent};border-radius:6px}
</style></head><body><div class="stars"></div>
${plan.chrome ? `<div class="top"><span>홍카페${plan.host?.name ? ` · ${esc(plan.host.name)}` : ''}</span><span class="draft">내부 시안</span></div>` : ''}
${sceneBody(s, plan)}
${bubbleHtml(box)}
${plan.chrome ? `<div class="foot"><span>${esc(s.basis ?? plan.basis ?? '')}</span><span>${esc(plan.progressLabel || `${i + 1}/${n}`)}</span></div><div class="bar"><i></i></div>` : ''}
<script>
// 글이 칸을 넘치면 글자 크기를 줄인다
for (const el of document.querySelectorAll('.fit, .fitb')) { let size = parseFloat(getComputedStyle(el).fontSize); let guard = 0;
  while ((el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) && size > 26 && guard++ < 90) { size -= 3; el.style.fontSize = size + 'px'; } }
</script></body></html>`;
}

async function render(plan, outDir) {
  const { chromium } = needProgram('playwright');
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: true }); } catch { browser = await chromium.launch({ headless: true }); }
  const shots = [];
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const prev = path.join(outDir, '미리보기');
    fs.mkdirSync(prev, { recursive: true });
    for (let i = 0; i < plan.scenes.length; i++) {
      await page.setContent(sceneHtml(plan.scenes[i], plan, i, plan.scenes.length), { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
      await page.waitForTimeout(150);
      const png = path.join(prev, `장면-${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: png });
      shots.push(png);
      // 미리보기용: 캐릭터까지 얹은 모습(영상과 같은 자리, 움직임 없음)
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
    // 배경은 살짝 확대(줌)
    let chain = `[${bgIn}:v]scale=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0005,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}[bg${i}]`;
    let last = `bg${i}`;
    const b = boxes[i];
    if (b) {
      // 캐릭터: 0.5초 동안 미끄러져(가운데는 아래에서 튀어) 들어오고, 그 뒤로 통통 튄다
      args.push('-loop', '1', '-framerate', String(FPS), '-t', String(durs[i]), '-i', b.seq || b.file);
      const chIn = input++;
      const from = b.at === 'right' ? W : -b.w;
      const xExpr = b.at === 'center' ? `${b.x}` : `${b.x}-(${b.x - from})*pow(1-min(t/0.5,1),2)`;
      const yExpr = b.at === 'center' ? `${b.y}+260*pow(1-min(t/0.5,1),2)-abs(14*sin(2*PI*t/1.2))` : `${b.y}-abs(12*sin(2*PI*t/1.1))`;
      chain += `;[${chIn}:v]scale=${b.w}:${b.h},format=rgba[ch${i}];[${last}][ch${i}]overlay=x='${xExpr}':y='${yExpr}':eof_action=pass[ov${i}]`;
      last = `ov${i}`;
    }
    // 장면마다 픽셀 형식이 다르면(캐릭터를 얹은 장면은 투명 채널이 생김) 이어 붙일 때 화면이 검게 나오므로 같은 형식으로 맞춘다
    chain += `;[${last}]format=yuv420p,fade=t=in:st=0:d=0.3,fade=t=out:st=${(durs[i] - 0.3).toFixed(2)}:d=0.3,setsar=1,settb=AVTB,setpts=PTS-STARTPTS[v${i}]`;
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
  // 상담사 사진: 장면표에 image가 없으면 수집 원본의 프로필 사진을 쓴다(사진 사용은 내부 시안까지만)
  if (plan.counselor?.code && !plan.counselor.image) {
    const raw = readJson(path.join(ROOT, '원본', `${plan.counselor.code}.json`), null);
    if (raw?.image) plan.counselor.image = raw.image;
    if (raw && !plan.counselor.nick) plan.counselor.nick = raw.nick;
  }
  fs.mkdirSync(outDir, { recursive: true });
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
