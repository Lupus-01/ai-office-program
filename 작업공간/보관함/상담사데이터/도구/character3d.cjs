// 볼콩이 3D: three.js로 볼콩이(운영팀 마스코트)를 입체 모델로 만들고, 자세마다 2초 반복 동작을 투명 PNG 연속 그림으로 뽑는다.
// 결과: 보관함/상담사데이터/영상/캐릭터/3d/<자세>/f_000.png … (영상 도구가 이 폴더를 반복 재생해 화면에 얹는다)
// 자세: 기본 인사 하트 감동 웃음 팻말_<글자>(팻말에 글자를 쓴다, 예: 팻말_1 … 팻말_10)
// 사용: node character3d.cjs [자세 …] [--frames 60] [--size 720] [--preview]
//   자세를 안 주면 기본·인사·하트·감동·웃음과 팻말_1~팻말_10을 만든다. --preview는 자세마다 첫 장만 만든다.
'use strict';
const { fs, path, ROOT, needProgram } = require('./lib.cjs');

const OUT = path.join(ROOT, '영상', '캐릭터', '3d');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const FRAMES = Number(opt('--frames', 60));
const SIZE = Number(opt('--size', 720));
const PREVIEW = argv.includes('--preview');
const named = argv.filter((a, i) => !a.startsWith('--') && !['--frames', '--size'].includes(argv[i - 1]));
const POSES = named.length ? named : ['기본', '인사', '하트', '감동', '웃음', ...Array.from({ length: 10 }, (_, i) => `팻말_${i + 1}`)];

const PAGE = String.raw`<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@900&display=swap" rel="stylesheet">
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"}}</script>
</head><body style="margin:0;background:transparent"><canvas id="c"></canvas>
<script type="module">
import * as THREE from 'three';
const SIZE = __SIZE__;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.45;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
camera.position.set(0, 1.35, 10.5); camera.lookAt(0, 0.95, 0);
scene.add(new THREE.HemisphereLight(0xfffaf0, 0xf1e4f7, 1.5));
const key = new THREE.DirectionalLight(0xfff3e2, 2.0); key.position.set(-1.2, 9, 5); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 8; Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); scene.add(key);
const fill = new THREE.DirectionalLight(0xf3e8ff, 0.7); fill.position.set(5, 2, 4); scene.add(fill);
const rim = new THREE.DirectionalLight(0xd9c2ff, 1.4); rim.position.set(0, 4, -6); scene.add(rim);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.62; ground.receiveShadow = true; scene.add(ground);

const plush = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.78, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xfff6ea), clearcoat: 0, ...extra });
const CREAM = 0xffebcc, BELLY = 0xfff6e6, LAVENDER = 0xe4cdf0, PINK = 0xf59c98, BLUSH = 0xf7a9a4, DARK = 0x3b2228;
const ball = (r, mat, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), mat); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
const tube = (pts, r, mat) => { const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))); return new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r, 12, false), mat); };

// ---------- 볼콩이 몸 ----------
const root = new THREE.Group(); scene.add(root);
const bodyG = new THREE.Group(); root.add(bodyG);
const body = ball(0.78, plush(CREAM), 1.0, 0.92, 0.86); body.position.set(0, 0.12, 0); bodyG.add(body);
const belly = ball(0.5, plush(BELLY), 1, 1, 0.35); belly.position.set(0, 0.06, 0.6); bodyG.add(belly);
const feet = [-0.36, 0.36].map((x) => { const f = ball(0.26, plush(CREAM), 1.05, 0.75, 1.15); f.position.set(x, -0.5, 0.32); bodyG.add(f); return f; });
const armL = new THREE.Group(), armR = new THREE.Group();
armL.position.set(-0.68, 0.42, 0.18); armR.position.set(0.68, 0.42, 0.18); bodyG.add(armL, armR);
const pawL = ball(0.2, plush(CREAM), 0.9, 1.2, 0.9); pawL.position.set(0, -0.2, 0.12); armL.add(pawL);
const pawR = ball(0.2, plush(CREAM), 0.9, 1.2, 0.9); pawR.position.set(0, -0.2, 0.12); armR.add(pawR);

const headG = new THREE.Group(); headG.position.set(0, 1.28, 0); root.add(headG);
const head = ball(1, plush(CREAM), 1.38, 0.98, 1.0); headG.add(head);
// 귀: 왼쪽은 서 있고 오른쪽은 접혀 있다(시트와 같게)
const earL = new THREE.Group(); earL.position.set(-0.78, 0.78, -0.05); earL.rotation.z = 0.35; headG.add(earL);
earL.add(ball(0.34, plush(CREAM), 1.0, 0.9, 0.7));
const innerL = ball(0.2, plush(LAVENDER), 1, 0.85, 0.4); innerL.position.set(0.02, 0.0, 0.18); earL.add(innerL);
const earR = new THREE.Group(); earR.position.set(0.86, 0.66, 0.05); earR.rotation.set(0.2, 0, -1.05); headG.add(earR);
earR.add(ball(0.36, plush(CREAM), 1.15, 0.7, 0.65));
// 얼굴
const face = new THREE.Group(); face.position.set(0, -0.05, 0.94); headG.add(face);
const darkMat = new THREE.MeshPhysicalMaterial({ color: DARK, roughness: 0.25, clearcoat: 1 });
const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const eyeDots = [], eyeArcs = [], sparkles = [], tears = [];
for (const s of [-1, 1]) {
  const eye = new THREE.Group(); eye.position.set(s * 0.44, 0.0, 0.03); face.add(eye);
  const dot = ball(0.13, darkMat, 0.9, 1.08, 0.5); eye.add(dot);
  const hi = ball(0.042, whiteMat); hi.position.set(-0.035, 0.05, 0.06); eye.add(hi);
  const hi2 = ball(0.016, whiteMat); hi2.position.set(0.035, -0.035, 0.05); eye.add(hi2); hi2.visible = false;
  eyeDots.push({ eye, dot, hi, hi2 });
  const arc = tube([[-0.1, -0.02, 0], [-0.05, 0.05, 0.01], [0.05, 0.05, 0.01], [0.1, -0.02, 0]], 0.022, darkMat); arc.position.set(s * 0.44, 0.0, 0.04); arc.visible = false; face.add(arc); eyeArcs.push(arc);
  const tear = ball(0.045, new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, roughness: 0.05, transmission: 0.3, transparent: true, opacity: 0.9, clearcoat: 1 }), 0.8, 1.2, 0.6);
  tear.position.set(s * 0.6, -0.1, 0.05); tear.visible = false; face.add(tear); tears.push(tear);
  const cheek = ball(0.25, new THREE.MeshBasicMaterial({ color: BLUSH, transparent: true, opacity: 0.85 }), 1.1, 0.78, 0.25); cheek.position.set(s * 0.76, -0.17, -0.06); face.add(cheek);
}
const nose = ball(0.055, plush(PINK), 1.2, 0.9, 0.8); nose.position.set(0, -0.1, 0.07); face.add(nose);
const mouthW = tube([[-0.15, -0.16, 0.05], [-0.08, -0.24, 0.06], [0, -0.17, 0.07], [0.08, -0.24, 0.06], [0.15, -0.16, 0.05]], 0.02, darkMat); face.add(mouthW);
const mouthOpen = new THREE.Group(); mouthOpen.position.set(0, -0.22, 0.06); face.add(mouthOpen); mouthOpen.visible = false;
mouthOpen.add(ball(0.1, new THREE.MeshPhysicalMaterial({ color: 0x8a2f3a, roughness: 0.4 }), 1.1, 0.9, 0.35));
const tongue = ball(0.06, plush(0xf38c8c), 1.2, 0.7, 0.35); tongue.position.set(0, -0.04, 0.02); mouthOpen.add(tongue);
// 반짝이(감동)
const starMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8 });
for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), starMat); st.visible = false; scene.add(st); sparkles.push(st); }

// ---------- 소품 ----------
const heartShape = new THREE.Shape();
heartShape.moveTo(0, -0.35); heartShape.bezierCurveTo(-0.55, 0.05, -0.38, 0.45, 0, 0.22); heartShape.bezierCurveTo(0.38, 0.45, 0.55, 0.05, 0, -0.35);
const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 8, curveSegments: 32 }),
  new THREE.MeshPhysicalMaterial({ color: 0xf0525c, roughness: 0.35, clearcoat: 0.6 }));
heart.geometry.center(); heart.position.set(0, 0.32, 0.95); heart.castShadow = true; heart.visible = false; root.add(heart);
let sign = null;
function makeSign(text) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d');
  g.fillStyle = '#fffaf4'; g.fillRect(0, 0, 1024, 512);
  const m = String(text).match(/^(\d+)$/);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (m) {
    g.fillStyle = '#b0458a'; g.font = '900 120px "Noto Sans KR","Malgun Gothic",sans-serif'; g.fillText('TOP', 330, 270);
    g.fillStyle = '#3b2228'; g.font = '900 300px "Noto Sans KR","Malgun Gothic",sans-serif'; g.fillText(m[1], 640 + (m[1].length > 1 ? 40 : 0), 280);
  } else { g.fillStyle = '#3b2228'; g.font = '900 150px "Noto Sans KR","Malgun Gothic",sans-serif'; g.fillText(text, 512, 270); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const board = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.15, 0.12), plush(0xf6ead8, { roughness: 0.5 })); frame.castShadow = true; board.add(frame);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 1.0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })); front.position.z = 0.065; board.add(front);
  board.position.set(0, 0.42, 1.0); board.rotation.x = -0.08; root.add(board);
  return board;
}

// ---------- 자세·표정 ----------
function setFace(kind) {
  const closed = kind === 'happy';
  eyeDots.forEach(({ eye, hi2 }) => { eye.visible = !closed; eye.scale.setScalar(kind === 'touched' ? 1.35 : 1); hi2.visible = kind === 'touched'; });
  eyeArcs.forEach((a) => { a.visible = closed; });
  tears.forEach((t) => { t.visible = kind === 'touched'; });
  mouthW.visible = !(kind === 'happy' || kind === 'wave');
  mouthOpen.visible = kind === 'happy' || kind === 'wave';
  sparkles.forEach((s) => { s.visible = kind === 'touched'; });
}
function reset() {
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
  headG.rotation.set(0, 0, 0); armL.rotation.set(0, 0, 0); armR.rotation.set(0, 0, 0);
  armL.position.set(-0.68, 0.42, 0.18); armR.position.set(0.68, 0.42, 0.18);
  heart.visible = false; if (sign) { root.remove(sign); sign = null; }
}
function pose(name, u) { // u: 0~1 반복 진행
  const w = Math.sin(u * Math.PI * 2), w2 = Math.sin(u * Math.PI * 4);
  reset();
  const blink = name !== 'happy' && u > 0.82 && u < 0.88;
  if (name === 'idle') {
    setFace('normal'); root.position.y = 0.04 * Math.abs(w); root.scale.set(1 + 0.015 * w, 1 - 0.015 * w, 1); headG.rotation.z = 0.04 * w;
  } else if (name === 'wave') {
    setFace('wave'); root.position.y = 0.04 * Math.abs(w); armR.position.set(1.22, 0.86, 0.72); armR.rotation.z = Math.PI + 0.38 * w2; headG.rotation.z = -0.06 + 0.03 * w;
  } else if (name === 'heart') {
    setFace('happy'); heart.visible = true; heart.scale.setScalar(1 + 0.07 * Math.max(0, w2)); root.rotation.z = 0.04 * w; root.position.y = 0.03 * Math.abs(w);
    armL.position.set(-0.42, 0.36, 0.62); armR.position.set(0.42, 0.36, 0.62); armL.rotation.z = -0.5; armR.rotation.z = 0.5;
  } else if (name === 'touched') {
    // 위쪽(후기 카드)을 올려다보며 두 손을 모은다. 눈은 크게 반짝이고 눈물이 맺힌다
    setFace('touched'); headG.rotation.set(-0.28, -0.18, 0.12 + 0.03 * w); root.position.y = 0.02 * w;
    armL.position.set(-0.24, 0.62, 0.66); armR.position.set(0.24, 0.62, 0.66); armL.rotation.z = -0.9; armR.rotation.z = 0.9;
    sparkles.forEach((s, i) => { const a = u * Math.PI * 2 + i * 1.7; s.position.set(-1.6 + (i % 2) * 3.2 + 0.15 * Math.sin(a), 2.2 + 0.5 * Math.floor(i / 2) + 0.1 * Math.cos(a), 0.4); s.scale.setScalar(0.6 + 0.5 * Math.abs(Math.sin(a * 1.3))); s.rotation.y = a; });
    tears.forEach((t, i) => { t.position.y = -0.02 - 0.06 * ((u + i * 0.5) % 1); });
  } else if (name === 'happy') {
    setFace('happy'); const j = Math.abs(Math.sin(u * Math.PI * 2)); root.position.y = 0.22 * j; root.scale.set(1 + 0.05 * (1 - j), 1 - 0.05 * (1 - j), 1);
    armL.rotation.z = -0.6 - 0.3 * j; armR.rotation.z = 0.6 + 0.3 * j;
  } else if (name.startsWith('sign:')) {
    setFace('normal'); sign = makeSign(name.slice(5)); root.position.y = 0.03 * Math.abs(w);
    armL.position.set(-0.78, 0.92, 0.95); armR.position.set(0.78, 0.92, 0.95);
  }
  if (blink) eyeDots.forEach(({ eye }) => { eye.scale.y = 0.12; });
}
window.renderPose = async (name, frames) => {
  await document.fonts.ready;
  const shots = [];
  for (let f = 0; f < frames; f++) { pose(name, f / frames); renderer.render(scene, camera); shots.push(canvas.toDataURL('image/png')); }
  return shots;
};
window.ready = true;
</script></body></html>`;

const KIND = { 기본: 'idle', 인사: 'wave', 하트: 'heart', 감동: 'touched', 웃음: 'happy' };

async function main() {
  const { chromium } = needProgram('playwright');
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); }
  catch { browser = await chromium.launch({ headless: true }); }
  try {
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
    page.on('pageerror', (e) => console.error(`페이지 오류: ${e.message}`));
    await page.setContent(PAGE.replace('__SIZE__', String(SIZE)), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
    for (const p of POSES) {
      const kind = p.startsWith('팻말_') ? `sign:${p.slice(3)}` : KIND[p];
      if (!kind) { console.log(`${p}: 모르는 자세(기본·인사·하트·감동·웃음·팻말_<글자>)`); continue; }
      const frames = PREVIEW ? 1 : FRAMES;
      const shots = await page.evaluate(([k, n]) => window.renderPose(k, n), [kind, frames]);
      // 모든 장면을 덮는 공통 영역으로 잘라 투명 여백을 줄인다
      const cropped = await page.evaluate(async (urls) => {
        const imgs = await Promise.all(urls.map((u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u; })));
        const W = imgs[0].width, H = imgs[0].height; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
        let x0 = W, y0 = H, x1 = 0, y1 = 0;
        for (const im of imgs) { g.clearRect(0, 0, W, H); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, W, H).data;
          for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
        const pad = 8; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
        const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1; const o = out.getContext('2d');
        return imgs.map((im) => { o.clearRect(0, 0, out.width, out.height); o.drawImage(im, x0, y0, out.width, out.height, 0, 0, out.width, out.height); return out.toDataURL('image/png'); });
      }, shots);
      const dir = path.join(OUT, p);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      cropped.forEach((u, i) => fs.writeFileSync(path.join(dir, `f_${String(i).padStart(3, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
      console.log(`${p}: ${cropped.length}장 → ${dir}`);
    }
  } finally { await browser.close(); }
}

main().catch((e) => { console.error(`3D 캐릭터 오류: ${e.message}`); process.exit(1); });
