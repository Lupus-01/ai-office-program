// 숏폼 영상 시안 만들기: 장면표(JSON) → 세로 1080×1920 장면 그림(PNG) → ffmpeg로 이어 붙인 mp4.
// 화면 오른쪽 위에 "내부 시안" 표시가 들어간다(외부 채널 사용은 법무·상담사 동의 확인 전, 2026-11-16 대표 결정에 따른 운영 규칙).
// 사용: node make-short.cjs <장면표.json> [--out <폴더>] [--no-video]
//   장면표 형식: 같은 폴더의 장면표-형식.md
//   결과: <폴더>/<이름>.mp4, <폴더>/미리보기/장면-01.png …  (폴더 기본값은 장면표가 있는 폴더)
'use strict';
const { fs, path, needProgram, readJson } = require('./lib.cjs');
const { spawnSync } = require('child_process');
const os = require('os');

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const outArg = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : null;
const NO_VIDEO = argv.includes('--no-video');
const W = 1080, H = 1920, FPS = 30;

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

const THEMES = {
  night: { bg: 'radial-gradient(120% 80% at 50% 0%, #4a2a7a 0%, #24123f 45%, #120a22 100%)', text: '#fbf7ff', sub: '#d9c9f2', accent: '#f5c86a', card: 'rgba(255,255,255,0.08)', line: 'rgba(245,200,106,0.55)' },
  pastel: { bg: 'linear-gradient(180deg, #fde8f1 0%, #ece6ff 55%, #dff0ff 100%)', text: '#2b1f3a', sub: '#5d4d72', accent: '#b0458a', card: 'rgba(255,255,255,0.65)', line: 'rgba(176,69,138,0.35)' },
};

function sceneBody(s, plan) {
  const photo = s.photo && plan.counselor?.image ? `<div class="photo" style="background-image:url('${esc(plan.counselor.image)}')"></div>` : '';
  switch (s.type) {
    case 'hook':
      return `<div class="center"><div class="kicker">${esc(s.kicker || '')}</div><div class="fit big">${lines(s.text)}</div></div>`;
    case 'profile':
      return `<div class="center">${photo}<div class="fit name">${lines(s.title || plan.counselor?.nick || '')}</div>
        <div class="rows">${(s.lines || []).map((l) => `<div class="row">${esc(l)}</div>`).join('')}</div>
        ${(s.chips || []).length ? `<div class="chips">${s.chips.map((c) => `<span>#${esc(c)}</span>`).join('')}</div>` : ''}</div>`;
    case 'quote':
      return `<div class="center"><div class="qmark">“</div><div class="card"><div class="fit quote">${lines(s.text)}</div></div>
        <div class="meta">${esc(s.meta || '')}</div><div class="note">${esc(s.note || '실제 후기 일부를 줄여 옮김')}</div></div>`;
    case 'stats':
      return `<div class="center"><div class="fit mid">${lines(s.title || '')}</div><div class="stats">${(s.items || []).map((x) => `<div class="stat"><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join('')}</div></div>`;
    case 'cta':
      return `<div class="center"><div class="fit big">${lines(s.text)}</div><div class="sub">${lines(s.sub || '')}</div><div class="brand">홍카페 · hongcafe.com</div></div>`;
    default:
      return `<div class="center"><div class="fit mid">${lines(s.text || '')}</div></div>`;
  }
}

function sceneHtml(s, plan, i, n) {
  const t = THEMES[plan.theme] || THEMES.night;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{background:${t.bg};color:${t.text};font-family:'Noto Sans KR','Malgun Gothic',sans-serif;position:relative;word-break:keep-all;overflow-wrap:anywhere}
.stars{position:absolute;inset:0;background-image:radial-gradient(2px 2px at 12% 18%,#fff8,transparent),radial-gradient(2px 2px at 78% 12%,#fff6,transparent),radial-gradient(3px 3px at 64% 34%,#fff5,transparent),radial-gradient(2px 2px at 22% 72%,#fff5,transparent),radial-gradient(2px 2px at 88% 80%,#fff6,transparent);opacity:${plan.theme === 'pastel' ? 0 : 1}}
.top{position:absolute;top:70px;left:80px;right:80px;display:flex;justify-content:space-between;align-items:center;font-size:34px;color:${t.sub};font-weight:700;letter-spacing:.02em}
.draft{font-size:28px;border:2px solid ${t.line};border-radius:999px;padding:6px 18px;color:${t.accent}}
.center{position:absolute;top:220px;bottom:300px;left:90px;right:90px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:36px}
.fit{width:100%;max-height:900px;overflow:hidden;line-height:1.35;font-weight:900}
.big{font-size:104px}.mid{font-size:80px}.name{font-size:120px;color:${t.accent}}
.quote{font-size:64px;font-weight:700;line-height:1.5;max-height:820px}
.kicker{font-size:44px;color:${t.accent};font-weight:700}
.rows{display:grid;gap:18px}.row{font-size:50px;color:${t.text};font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:16px;justify-content:center}.chips span{font-size:40px;padding:10px 26px;border-radius:999px;background:${t.card};color:${t.sub}}
.photo{width:420px;height:420px;border-radius:50%;background-size:cover;background-position:center;border:8px solid ${t.accent};box-shadow:0 20px 60px #0006}
.qmark{font-size:220px;line-height:.6;color:${t.accent};font-family:Georgia,serif;height:120px}
.card{width:100%;background:${t.card};border-radius:40px;padding:60px 56px;border:2px solid ${t.line}}
.meta{font-size:40px;color:${t.sub};font-weight:700}.note{font-size:30px;color:${t.sub};opacity:.8}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:28px;width:100%}.stat{background:${t.card};border-radius:32px;padding:44px 20px;display:grid;gap:10px}.stat b{font-size:84px;color:${t.accent}}.stat span{font-size:38px;color:${t.sub}}
.sub{font-size:52px;color:${t.sub};font-weight:700}.brand{font-size:44px;color:${t.accent};font-weight:900;margin-top:20px}
.foot{position:absolute;bottom:90px;left:80px;right:80px;display:flex;justify-content:space-between;font-size:28px;color:${t.sub};opacity:.85}
.bar{position:absolute;bottom:60px;left:80px;right:80px;height:6px;border-radius:6px;background:${t.card}}.bar i{display:block;height:100%;width:${Math.round(((i + 1) / n) * 100)}%;background:${t.accent};border-radius:6px}
</style></head><body><div class="stars"></div>
<div class="top"><span>홍카페</span><span class="draft">내부 시안</span></div>
${sceneBody(s, plan)}
<div class="foot"><span>${esc(plan.basis || '')}</span><span>${i + 1}/${n}</span></div><div class="bar"><i></i></div>
<script>
// 글이 칸을 넘치면 글자 크기를 줄인다
for (const el of document.querySelectorAll('.fit')) { let size = parseFloat(getComputedStyle(el).fontSize); let guard = 0;
  while ((el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) && size > 28 && guard++ < 80) { size -= 3; el.style.fontSize = size + 'px'; } }
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
    }
  } finally { await browser.close(); }
  return shots;
}

function encode(plan, shots, mp4) {
  const ff = ffmpegBin();
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  const durs = plan.scenes.map((s) => Math.min(Math.max(Number(s.seconds) || 3, 1.5), 10));
  shots.forEach((png, i) => args.push('-loop', '1', '-framerate', String(FPS), '-t', String(durs[i]), '-i', png));
  const bgm = plan.bgm && fs.existsSync(plan.bgm) ? plan.bgm : null;
  const total = durs.reduce((a, b) => a + b, 0);
  if (bgm) args.push('-i', bgm); else args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  // 장면마다 살짝 확대(줌)하고 0.3초 페이드로 잇는다
  const parts = shots.map((_, i) => {
    const frames = Math.round(durs[i] * FPS);
    return `[${i}:v]scale=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0006,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},fade=t=in:st=0:d=0.3,fade=t=out:st=${(durs[i] - 0.3).toFixed(2)}:d=0.3,setsar=1[v${i}]`;
  });
  const concat = `${shots.map((_, i) => `[v${i}]`).join('')}concat=n=${shots.length}:v=1:a=0,format=yuv420p[v]`;
  const a = shots.length;
  const audio = bgm ? `[${a}:a]atrim=0:${total},afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(total - 1, 0)}:d=1,volume=0.6[a]` : `[${a}:a]anull[a]`;
  args.push('-filter_complex', [...parts, concat, audio].join(';'), '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', String(FPS), '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', mp4);
  const r = spawnSync(ff, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg 실패: ${(r.stderr || '').slice(-600)}`);
  return total;
}

async function main() {
  if (!file) throw new Error('사용법: node make-short.cjs <장면표.json> [--out <폴더>] [--no-video]');
  const plan = readJson(path.resolve(file), null);
  if (!plan || !Array.isArray(plan.scenes) || !plan.scenes.length) throw new Error('장면표에 scenes(장면 목록)가 없습니다. 장면표-형식.md를 보세요.');
  if (plan.scenes.length > 12) throw new Error('장면은 12개 이하로 해 주세요(숏폼 15~30초 기준).');
  const total = plan.scenes.reduce((n, s) => n + (Number(s.seconds) || 3), 0);
  if (total > 60) throw new Error(`장면 길이 합이 ${total}초입니다. 60초 이하로 줄여 주세요.`);
  // 상담사 사진: 장면표에 image가 없으면 수집 원본의 프로필 사진을 쓴다(사진 사용은 내부 시안까지만)
  if (plan.counselor?.code && !plan.counselor.image) {
    const raw = readJson(path.join(__dirname, '..', '원본', `${plan.counselor.code}.json`), null);
    if (raw?.image) plan.counselor.image = raw.image;
    if (raw && !plan.counselor.nick) plan.counselor.nick = raw.nick;
  }
  const outDir = path.resolve(outArg || path.dirname(path.resolve(file)));
  fs.mkdirSync(outDir, { recursive: true });
  const shots = await render(plan, outDir);
  console.log(`장면 그림 ${shots.length}장: ${path.join(outDir, '미리보기')}`);
  if (NO_VIDEO) return;
  const name = String(plan.name || path.basename(file, '.json')).replace(/[\\/:*?"<>|]/g, '_');
  const mp4 = path.join(outDir, `${name}.mp4`);
  const tmp = path.join(os.tmpdir(), `short-${process.pid}.mp4`);
  const secs = encode(plan, shots, tmp);
  fs.copyFileSync(tmp, mp4);
  fs.rmSync(tmp, { force: true });
  console.log(`영상: ${mp4} (${secs.toFixed(1)}초, ${W}×${H}, 내부 시안)`);
}

main().catch((e) => { console.error(`영상 만들기 오류: ${e.message}`); process.exit(1); });
