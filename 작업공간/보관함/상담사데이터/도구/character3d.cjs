// 볼콩이 3D(2판): three.js로 볼콩이(운영팀 마스코트)를 만들고, 자세·소품마다 2초 반복 동작을 투명 PNG 연속 그림으로 뽑는다.
// - 얼굴(눈·입·볼터치)은 그림으로 그려 머리에 붙인다(데칼). 표정: 기본·웃음·감동·수줍
// - 소품: 팻말(TOP n), 후기 카드(후기 글·날짜), 사진 액자(상담사 사진), 하트. 볼콩이가 직접 들고 바라본다
// - 스튜디오 조명(환경광)·부드러운 질감·바닥 그림자, 얇은 외곽선(원래 2D 디자인처럼, 끌 수 있음)
// 결과: 보관함/상담사데이터/영상/캐릭터/3d/<이름>/f_000.png … (영상 도구가 반복 재생)
//
// 사용(명령줄): node character3d.cjs [자세 …] [--frames 60] [--size 900] [--preview] [--no-outline]
//   자세: 기본 인사 하트 감동 웃음 수줍 팻말_<글자>. 안 주면 기본 자세 5개와 팻말_1~10을 만든다.
// 사용(다른 도구에서): const { renderJobs } = require('./character3d.cjs'); await renderJobs([{ name, pose, expression, prop }])
'use strict';
const { fs, path, ROOT, needProgram, FONT_CSS, useLocalFonts } = require('./lib.cjs');
const crypto = require('crypto');

const OUT = path.join(ROOT, '영상', '캐릭터', '3d');
const MODEL_VERSION = 8; // 모델·소품 모양을 바꾸면 올린다(저장해 둔 동작 그림을 새로 만들게 함)

const PAGE = String.raw`<!doctype html><html><head><meta charset="utf-8">
<style>__FONT_CSS__</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
</head><body style="margin:0;background:transparent"><canvas id="c"></canvas>
<script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
const key = new THREE.DirectionalLight(0xfff0dc, 1.25); key.position.set(-2.5, 6, 6); scene.add(key);
const front = new THREE.DirectionalLight(0xfff6ec, 0.95); front.position.set(0.5, 1.5, 10); scene.add(front);
const rim = new THREE.DirectionalLight(0xe6d2ff, 1.0); rim.position.set(3, 3, -5); scene.add(rim);
scene.add(new THREE.HemisphereLight(0xfff8f0, 0xffe9e0, 0.9));

// ---------- 재질 ----------
const CREAM = 0xfff0d6, BELLY = 0xfff8ec, LAVENDER = 0xe8d2f3, OUTLINE = 0x5c3a44;
const plush = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.14, roughness: 0.55, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), clearcoat: 0.12, clearcoatRoughness: 0.5, envMapIntensity: 0.7, ...o });
const outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
let OUTLINE_ON = true;
const outlined = [];
function addOutline(mesh, t = 0.035) { // 같은 모양을 조금 키워 뒷면만 진하게 칠하는 외곽선
  const o = new THREE.Mesh(mesh.geometry, outlineMat); o.userData.t = t; mesh.add(o); outlined.push(o); return mesh;
}
function refreshOutlines() {
  scene.updateMatrixWorld(true);
  for (const o of outlined) {
    o.visible = OUTLINE_ON;
    const s = new THREE.Vector3(); o.parent.getWorldScale(s);
    o.scale.set(1 + o.userData.t / s.x, 1 + o.userData.t / s.y, 1 + o.userData.t / s.z);
  }
}
const sphere = (r, mat, sx = 1, sy = 1, sz = 1, seg = 96) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg * 0.75), mat); m.scale.set(sx, sy, sz); return m; };

// ---------- 몸 ----------
const root = new THREE.Group(); scene.add(root);
const bodyG = new THREE.Group(); root.add(bodyG);
const body = addOutline(sphere(0.7, plush(CREAM), 1.0, 0.95, 0.9)); body.position.set(0, 0.18, 0); bodyG.add(body);
const belly = sphere(0.45, plush(BELLY), 1, 1.05, 0.32); belly.position.set(0, 0.12, 0.54); bodyG.add(belly);
[-0.3, 0.3].forEach((x) => { const f = addOutline(sphere(0.22, plush(CREAM), 1.05, 0.72, 1.15)); f.position.set(x, -0.36, 0.26); bodyG.add(f); });
// 팔: 어깨에서 손까지 이어진 통통한 팔(원기둥) + 둥근 손. 손 위치만 정하면 팔이 따라 늘어나고 방향을 맞춘다
const arms = {};
for (const side of ['L', 'R']) {
  const seg = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.14, 1, 40, 1), plush(CREAM)), 0.028);
  const seg2 = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.125, 1, 40, 1), plush(CREAM)), 0.028);
  const elbow = sphere(0.128, plush(CREAM), 1, 1, 1, 32);
  const paw = addOutline(sphere(0.175, plush(CREAM), 1.0, 1.0, 0.92));
  bodyG.add(seg, seg2, elbow, paw); arms[side] = { seg, seg2, elbow, paw };
}
const SHOULDER = { L: new THREE.Vector3(-0.46, 0.5, 0.1), R: new THREE.Vector3(0.46, 0.5, 0.1) };
const UP = new THREE.Vector3(0, 1, 0);
function bone(mesh, a, b) {
  const dir = b.clone().sub(a); const len = Math.max(dir.length(), 0.05);
  mesh.position.copy(a).addScaledVector(dir, 0.5); mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
}
function setArm(side, x, y, z, elbow = null) {
  const a = SHOULDER[side], b = new THREE.Vector3(x, y, z), arm = arms[side];
  if (elbow) {
    const e = new THREE.Vector3(...elbow);
    bone(arm.seg, a, e); bone(arm.seg2, e, b); arm.seg2.visible = true; arm.elbow.visible = true; arm.elbow.position.copy(e);
  } else { bone(arm.seg, a, b); arm.seg2.visible = false; arm.elbow.visible = false; }
  arm.paw.position.copy(b);
}

// 머리: 찹쌀떡처럼 넓고 아래가 평평하게
const headG = new THREE.Group(); root.add(headG);
const headGeo = new THREE.SphereGeometry(1, 128, 96);
{ const p = headGeo.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i);
    const y = v.y < 0 ? v.y * 0.76 : v.y * 0.9; const bulge = 1 + 0.03 * Math.max(0, -v.y);
    p.setXYZ(i, v.x * 1.3 * bulge, y, v.z * 0.98 * bulge); }
  headGeo.computeVertexNormals(); }
const head = addOutline(new THREE.Mesh(headGeo, plush(CREAM)), 0.024); headG.add(head);
// 귀: 왼쪽은 서 있고(안쪽 라벤더), 오른쪽은 앞으로 접혀 있다
const earL = new THREE.Group(); earL.position.set(-0.78, 0.78, -0.02); earL.rotation.z = 0.38; headG.add(earL);
earL.add(addOutline(sphere(0.36, plush(CREAM), 1.0, 0.95, 0.62)));
const innerL = sphere(0.21, plush(LAVENDER, { sheen: 0.4 }), 1, 0.9, 0.35); innerL.position.set(0.02, 0.0, 0.19); earL.add(innerL);
const earR = new THREE.Group(); earR.position.set(0.84, 0.74, 0.12); earR.rotation.set(0.75, -0.2, -0.8); headG.add(earR);
earR.add(addOutline(sphere(0.36, plush(CREAM), 1.15, 0.66, 0.6)));

// ---------- 얼굴(그림 데칼) ----------
function faceCanvas(kind) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 768; const g = c.getContext('2d');
  const ink = '#33202a';
  const blush = (x, y, r) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(247,150,150,0.75)'); gr.addColorStop(0.6, 'rgba(247,160,160,0.35)'); gr.addColorStop(1, 'rgba(247,170,170,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 1.15, r * 0.8, 0, 0, Math.PI * 2); g.fill(); };
  blush(512 - 330, 470, 120); blush(512 + 330, 470, 120);
  const eye = (x, y, sx, sy, sparkle) => {
    g.fillStyle = ink; g.beginPath(); g.ellipse(x, y, sx, sy, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createLinearGradient(x, y - sy, x, y + sy); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(90,55,85,0.25)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, sx, sy, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x - sx * 0.3, y - sy * 0.35, sx * 0.34, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x + sx * 0.3, y + sy * 0.3, sx * 0.14, 0, Math.PI * 2); g.fill();
    if (sparkle) { g.beginPath(); g.arc(x + sx * 0.38, y - sy * 0.5, sx * 0.11, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x - sx * 0.45, y + sy * 0.25, sx * 0.08, 0, Math.PI * 2); g.fill(); }
  };
  const arcEye = (x, y, up = true) => { g.strokeStyle = ink; g.lineWidth = 22; g.lineCap = 'round'; g.beginPath(); if (up) g.arc(x, y + 22, 52, Math.PI * 1.15, Math.PI * 1.85); else g.arc(x, y - 30, 50, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); };
  const nose = () => { g.fillStyle = '#f2a0a3'; g.beginPath(); g.ellipse(512, 405, 20, 14, 0, 0, Math.PI * 2); g.fill(); };
  const omega = () => { g.strokeStyle = ink; g.lineWidth = 15; g.lineCap = 'round'; g.beginPath(); g.arc(482, 432, 30, Math.PI * 0.05, Math.PI * 0.95); g.stroke(); g.beginPath(); g.arc(542, 432, 30, Math.PI * 0.05, Math.PI * 0.95); g.stroke(); };
  if (kind === 'happy') {
    arcEye(512 - 215, 360); arcEye(512 + 215, 360); nose();
    g.fillStyle = '#8b2f3d'; g.beginPath(); g.moveTo(462, 438); g.quadraticCurveTo(512, 438, 562, 438); g.quadraticCurveTo(560, 520, 512, 524); g.quadraticCurveTo(464, 520, 462, 438); g.fill();
    g.fillStyle = '#f48a92'; g.beginPath(); g.ellipse(512, 500, 30, 18, 0, 0, Math.PI * 2); g.fill();
  } else if (kind === 'touched') {
    eye(512 - 215, 350, 62, 72, true); eye(512 + 215, 350, 62, 72, true);
    g.fillStyle = 'rgba(150,205,255,0.95)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(512 + s * 228, 414, 30, 9, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = ink; g.lineWidth = 10; g.lineCap = 'round'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(512 + s * 170, 252); g.quadraticCurveTo(512 + s * 215, 236, 512 + s * 262, 258); g.stroke(); }
    nose(); g.lineWidth = 13; g.beginPath(); g.moveTo(478, 450); g.quadraticCurveTo(495, 436, 512, 450); g.quadraticCurveTo(529, 464, 546, 450); g.stroke();
  } else if (kind === 'blink') {
    arcEye(512 - 215, 350, false); arcEye(512 + 215, 350, false); nose(); omega();
  } else if (kind === 'shy') {
    arcEye(512 - 215, 350, false); arcEye(512 + 215, 350, false); nose(); omega();
    g.strokeStyle = 'rgba(232,110,120,0.9)'; g.lineWidth = 9; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(512 + s * 300 + k * 26 - 30, 488); g.lineTo(512 + s * 300 + k * 26 - 12, 456); g.stroke(); }
  } else {
    eye(512 - 215, 352, 52, 60, false); eye(512 + 215, 352, 52, 60, false); nose(); omega();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const faces = { normal: faceCanvas('normal'), happy: faceCanvas('happy'), touched: faceCanvas('touched'), shy: faceCanvas('shy'), blink: faceCanvas('blink') };
const faceMat = new THREE.MeshPhysicalMaterial({ map: faces.normal, transparent: true, roughness: 0.45, clearcoat: 0.3, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
scene.updateMatrixWorld(true);
const decal = new THREE.Mesh(new DecalGeometry(head, new THREE.Vector3(0, -0.05, 0.9), new THREE.Euler(0, 0, 0), new THREE.Vector3(2.0, 1.5, 1.6)), faceMat);
headG.add(decal);
headG.position.set(0, 1.18, 0);

// 반짝이(감동)
const sparkles = [];
const starShape = new THREE.Shape(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.045 : 0.14, a = i * Math.PI / 4; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(new THREE.ShapeGeometry(starShape), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe28a : 0xffc4d6, transparent: true })); scene.add(st); sparkles.push(st); }

// 바닥 그림자
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(90,50,80,0.42)'); gr.addColorStop(1, 'rgba(90,50,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.5; scene.add(shadow);

// ---------- 소품 ----------
const heartShape = new THREE.Shape(); heartShape.moveTo(0, -0.32); heartShape.bezierCurveTo(-0.52, 0.04, -0.36, 0.42, 0, 0.2); heartShape.bezierCurveTo(0.36, 0.42, 0.52, 0.04, 0, -0.32);
const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 10, curveSegments: 40 }), new THREE.MeshPhysicalMaterial({ color: 0xea3a55, roughness: 0.3, clearcoat: 0.8, envMapIntensity: 0.9 }));
heart.geometry.center(); heart.visible = false; root.add(heart); addOutline(heart, 0.02);
const font = (w, size, fam = 'Noto Sans KR') => w + ' ' + size + 'px "' + fam + '","Malgun Gothic",sans-serif';
function wrapLines(g, text, maxW, maxLines) {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width <= maxW) { cur = t; continue; }
    if (cur) lines.push(cur); cur = w; while (g.measureText(cur).width > maxW) { let k = cur.length; while (k > 1 && g.measureText(cur.slice(0, k)).width > maxW) k--; lines.push(cur.slice(0, k)); cur = cur.slice(k); } }
  if (cur) lines.push(cur);
  return lines.length > maxLines ? [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(' ').slice(0, 40) + '…'] : lines;
}
function boardTexture(kind, prop) {
  const W = kind === 'card' ? 1600 : 1200, H = kind === 'card' ? 960 : 640;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#fffaf2'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#ead9f0'; g.lineWidth = 14; g.strokeRect(22, 22, W - 44, H - 44);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (kind === 'sign') {
    const t = String(prop.text ?? ''); const m = t.match(/^\d+$/);
    if (m) { g.fillStyle = '#e0607e'; g.font = font(400, 150, 'Jua'); g.fillText('TOP', W * 0.3, H * 0.53); g.fillStyle = '#3b2430'; g.font = font(400, 360, 'Jua'); g.fillText(t, W * 0.64, H * 0.55); }
    else { g.fillStyle = '#3b2430'; g.font = font(400, 170, 'Jua'); g.fillText(t, W / 2, H / 2); }
  } else {
    g.fillStyle = '#f08aa0'; g.font = font(900, 200, 'Noto Sans KR'); g.textAlign = 'left'; g.fillText('“', 250, 205);
    g.fillStyle = '#2e1a24'; g.font = font(900, 118); g.textAlign = 'center';
    const lines = wrapLines(g, prop.text || '', W - 340, 3); const lh = 156; const y0 = H * 0.56 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh));
    if (prop.meta) { g.fillStyle = '#9a78b0'; g.font = font(700, 60); g.textAlign = 'right'; g.fillText(prop.meta, W - 70, H - 70); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
let propMesh = null;
async function makeProp(prop) {
  if (propMesh) { root.remove(propMesh); propMesh = null; }
  if (!prop || prop.type === 'heart') return;
  const g = new THREE.Group();
  if (prop.type === 'photo') {
    const img = new Image(); img.src = prop.image; await img.decode().catch(() => {});
    const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
    x.fillStyle = '#fffaf2'; x.fillRect(0, 0, 1024, 1024); x.save(); x.beginPath(); x.arc(512, 512, 440, 0, Math.PI * 2); x.clip();
    if (img.naturalWidth) { const s = Math.max(880 / img.naturalWidth, 880 / img.naturalHeight); x.drawImage(img, 512 - img.naturalWidth * s / 2, 512 - img.naturalHeight * s / 2 + 40, img.naturalWidth * s, img.naturalHeight * s); }
    x.restore(); x.lineWidth = 34; x.strokeStyle = '#f4c56a'; x.beginPath(); x.arc(512, 512, 456, 0, Math.PI * 2); x.stroke();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const frame = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 96), plush(0xffe7b0, { roughness: 0.35, clearcoat: 0.6 })), 0.02); frame.rotation.x = Math.PI / 2; g.add(frame);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.66, 96), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); face.position.z = 0.065; g.add(face);
    g.position.set(0, -0.12, 1.08);
  } else {
    const card = prop.type === 'card'; const w = card ? 2.5 : 2.1, h = card ? 1.5 : 1.12;
    const board = addOutline(new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.1, 6, 0.08), plush(0xfff1e2, { roughness: 0.6, clearcoat: 0.05 })), 0.02); g.add(board);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.12), new THREE.MeshBasicMaterial({ map: boardTexture(card ? 'card' : 'sign', prop), toneMapped: false })); face.position.z = 0.056; g.add(face);
    g.position.set(0, card ? 0.02 : 0.4, card ? 1.08 : 1.0); g.rotation.x = card ? -0.04 : -0.1;
  }
  root.add(g); propMesh = g;
}

// ---------- 자세 ----------
function setFace(kind) { faceMat.map = faces[kind] || faces.normal; faceMat.needsUpdate = true; }
function reset() {
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1); headG.rotation.set(0, 0, 0);
  setArm('L', -0.68, 0.12, 0.3); setArm('R', 0.68, 0.12, 0.3);
  heart.visible = false; sparkles.forEach((s) => { s.visible = false; });
}
function frame(job, u) {
  const w = Math.sin(u * Math.PI * 2), w2 = Math.sin(u * Math.PI * 4);
  reset();
  const pose = job.pose || 'idle';
  const faceKind = job.expression || ({ wave: 'happy', heart: 'happy', happy: 'happy', touched: 'touched', shy: 'shy' }[pose] || 'normal');
  root.position.y = 0.035 * Math.abs(w); root.scale.set(1 + 0.012 * w, 1 - 0.012 * w, 1);
  setArm('L', -0.68, 0.12 + 0.015 * w, 0.3); setArm('R', 0.68, 0.12 - 0.015 * w, 0.3);
  if (pose === 'wave') { setArm('R', 1.52 + 0.1 * w2, 1.1 + 0.05 * Math.cos(u * Math.PI * 4), 0.45, [1.18, 0.6, 0.32]); headG.rotation.z = -0.05 + 0.03 * w; }
  else if (pose === 'heart') { heart.visible = true; heart.position.set(0, 0.42, 0.92); heart.scale.setScalar(1 + 0.08 * Math.max(0, w2)); setArm('L', -0.36, 0.38, 1.0); setArm('R', 0.36, 0.38, 1.0); root.rotation.z = 0.035 * w; }
  else if (pose === 'happy') { const j = Math.abs(Math.sin(u * Math.PI * 2)); root.position.y = 0.2 * j; root.scale.set(1 + 0.05 * (1 - j), 1 - 0.05 * (1 - j), 1); setArm('L', -1.48, 0.98 + 0.16 * j, 0.42, [-1.15, 0.58, 0.3]); setArm('R', 1.48, 0.98 + 0.16 * j, 0.42, [1.15, 0.58, 0.3]); }
  else if (pose === 'touched') { headG.rotation.set(-0.1, 0.08, -0.06 + 0.02 * w); setArm('L', -0.15, 0.5, 0.86); setArm('R', 0.15, 0.5, 0.86); root.position.y = 0.015 * w; }
  else if (pose === 'shy') { headG.rotation.z = 0.07 * w; headG.rotation.x = 0.05; setArm('L', -0.17 - 0.03 * w, 0.22, 0.74); setArm('R', 0.17 - 0.03 * w, 0.22, 0.74); }
  if (job.prop && ['sign', 'card', 'photo'].includes(job.prop.type) && propMesh) {
    // 소품을 앞에 들고, 두 손으로 양쪽 가장자리를 앞에서 감싸 쥔다. 후기 카드·사진은 내려다본다(팻말은 정면)
    const p = propMesh; const card = job.prop.type === 'card', photo = job.prop.type === 'photo';
    p.rotation.z = 0.02 * w; p.position.y = (card ? 0.02 : photo ? -0.12 : 0.4) + 0.02 * Math.abs(w);
    const gx = card ? 1.08 : photo ? 0.6 : 0.98, gy = p.position.y + (card ? 0.64 : photo ? 0.32 : 0.2), gz = p.position.z + 0.14;
    setArm('L', -gx, gy, gz); setArm('R', gx, gy, gz);
    if (card || photo) headG.rotation.x = (card ? 0.08 : 0.12) + 0.015 * w;
  }
  if (faceKind === 'touched') sparkles.forEach((s, i) => { const a = u * Math.PI * 2 + i * 1.3; s.visible = true; s.position.set([-1.5, 1.45, -1.25, 1.2, 0][i] + 0.06 * Math.sin(a), [2.05, 2.15, 1.55, 1.6, 2.45][i] + 0.06 * Math.cos(a), 0.6); s.rotation.z = a * 0.5; s.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(a * 1.5))); s.material.opacity = 0.65 + 0.35 * Math.abs(Math.sin(a)); });
  const blink = faceKind === 'normal' && u > 0.84 && u < 0.89; setFace(blink ? 'blink' : faceKind);
  refreshOutlines();
}
window.renderJob = async (job, frames, size) => {
  const t = '가나다라 볼콩이 ABC 123 TOP “'; await Promise.all([document.fonts.load('400 64px Jua', t), document.fonts.load('700 64px "Noto Sans KR"', t), document.fonts.load('900 64px "Noto Sans KR"', t)]); await document.fonts.ready;
  if (!document.fonts.check('400 64px Jua', t) || !document.fonts.check('900 64px "Noto Sans KR"', t)) throw new Error('글꼴을 불러오지 못했습니다');
  OUTLINE_ON = job.outline !== false;
  renderer.setSize(size, size, false);
  const big = job.prop?.type === 'card' || job.prop?.type === 'photo';
  camera.position.set(0, big ? 1.2 : 1.25, big ? 11.2 : 10.2); camera.lookAt(0, big ? 0.7 : 0.9, 0); camera.updateProjectionMatrix();
  await makeProp(job.prop);
  const shots = [];
  for (let f = 0; f < frames; f++) { frame(job, f / frames); renderer.render(scene, camera); shots.push(canvas.toDataURL('image/png')); }
  return shots;
};
window.ready = true;
</script></body></html>`;

const POSE_NAMES = { 기본: { pose: 'idle' }, 인사: { pose: 'wave' }, 하트: { pose: 'heart' }, 감동: { pose: 'touched' }, 웃음: { pose: 'happy' }, 수줍: { pose: 'shy' } };
function jobFor(name) {
  if (name.startsWith('팻말_')) return { name, pose: 'idle', prop: { type: 'sign', text: name.slice(3) } };
  return POSE_NAMES[name] ? { name, ...POSE_NAMES[name] } : null;
}
const jobKey = (j) => crypto.createHash('sha1').update(JSON.stringify([j.pose, j.expression, j.prop, j.outline !== false, MODEL_VERSION])).digest('hex').slice(0, 12);

// 여러 작업을 브라우저 하나로 렌더링한다. 같은 내용(자세·표정·소품)이면 전에 만든 그림을 다시 쓴다
async function renderJobs(jobs, { frames = 60, size = 900, preview = false, outDir = OUT, log = console.log } = {}) {
  const todo = jobs.filter((j) => preview || !fs.existsSync(path.join(outDir, j.name, `.${jobKey(j)}`)));
  if (!todo.length) return jobs.map((j) => path.join(outDir, j.name));
  const { chromium } = needProgram('playwright');
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: true }); } catch { browser = await chromium.launch({ headless: true }); }
  try {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    page.on('pageerror', (e) => log(`페이지 오류: ${e.message}`));
    await useLocalFonts(page);
    await page.setContent(PAGE.replace('__FONT_CSS__', FONT_CSS), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
    for (const j of todo) {
      const shots = await page.evaluate(([job, n, s]) => window.renderJob(job, n, s), [j, preview ? 1 : frames, size]);
      const cropped = await page.evaluate(async (urls) => {
        const imgs = await Promise.all(urls.map((u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u; })));
        const W = imgs[0].width, H = imgs[0].height; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
        let x0 = W, y0 = H, x1 = 0, y1 = 0;
        for (const im of imgs) { g.clearRect(0, 0, W, H); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, W, H).data;
          for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
        const pad = 10; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
        const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1; const o = out.getContext('2d');
        return imgs.map((im) => { o.clearRect(0, 0, out.width, out.height); o.drawImage(im, x0, y0, out.width, out.height, 0, 0, out.width, out.height); return out.toDataURL('image/png'); });
      }, shots);
      const dir = path.join(outDir, j.name);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      cropped.forEach((u, i) => fs.writeFileSync(path.join(dir, `f_${String(i).padStart(3, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
      if (!preview) fs.writeFileSync(path.join(dir, `.${jobKey(j)}`), '');
      log(`${j.name}: ${cropped.length}장`);
    }
  } finally { await browser.close(); }
  return jobs.map((j) => path.join(outDir, j.name));
}

module.exports = { renderJobs, jobKey, OUT };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const named = argv.filter((a, i) => !a.startsWith('--') && !['--frames', '--size'].includes(argv[i - 1]));
  const names = named.length ? named : ['기본', '인사', '하트', '감동', '웃음', ...Array.from({ length: 10 }, (_, i) => `팻말_${i + 1}`)];
  const jobs = names.map((n) => { const j = jobFor(n); if (!j) console.log(`${n}: 모르는 자세(기본·인사·하트·감동·웃음·수줍·팻말_<글자>)`); return j; }).filter(Boolean)
    .map((j) => ({ ...j, outline: !argv.includes('--no-outline') }));
  renderJobs(jobs, { frames: Number(opt('--frames', 60)), size: Number(opt('--size', 900)), preview: argv.includes('--preview') })
    .catch((e) => { console.error(`3D 캐릭터 오류: ${e.message}`); process.exit(1); });
}
