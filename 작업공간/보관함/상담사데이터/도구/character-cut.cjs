// 캐릭터 시트(한 장에 여러 자세)를 자세별 투명 PNG로 자른다.
// 배경은 테두리에서 이어진 밝은 단색 영역을 지우고(캐릭터의 진한 외곽선에서 멈춤), 경계는 부드럽게 반투명으로 둔다.
// 사용: node character-cut.cjs <시트 이미지> <자르기표.json> <출력 폴더>
//   자르기표: [{ "name": "볼콩_인사", "box": [x, y, 너비, 높이] }, ...]  (시트 픽셀 좌표)
'use strict';
const { fs, path, needProgram } = require('./lib.cjs');

async function main() {
  const [sheet, specFile, outDir] = process.argv.slice(2);
  if (!sheet || !specFile || !outDir) throw new Error('사용법: node character-cut.cjs <시트 이미지> <자르기표.json> <출력 폴더>');
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const ext = path.extname(sheet).toLowerCase() === '.png' ? 'png' : 'jpeg';
  const dataUrl = `data:image/${ext};base64,${fs.readFileSync(sheet).toString('base64')}`;
  const { chromium } = needProgram('playwright');
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: true }); } catch { browser = await chromium.launch({ headless: true }); }
  try {
    const page = await browser.newPage();
    await page.setContent('<canvas id="c"></canvas>');
    const results = await page.evaluate(async ({ dataUrl, spec }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const out = [];
      for (const { name, box, erase = [], tolerance = 26, feather = 34 } of spec) {
        const [bx, by, bw, bh] = box;
        const c = document.createElement('canvas');
        c.width = bw; c.height = bh;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, bx, by, bw, bh, 0, 0, bw, bh);
        // erase: 자르기 상자 안에 들어온 옆 칸 이름표 등을 배경색으로 덮는다([x, y, 너비, 높이], 상자 기준 좌표)
        if (erase.length) {
          const s = ctx.getImageData(1, 1, 1, 1).data;
          ctx.fillStyle = `rgb(${s[0]},${s[1]},${s[2]})`;
          for (const [ex, ey, ew, eh] of erase) ctx.fillRect(ex, ey, ew, eh);
        }
        const d = ctx.getImageData(0, 0, bw, bh);
        const px = d.data;
        // 배경색: 네 모서리의 평균
        const corner = (x, y) => { const i = (y * bw + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
        const cs = [corner(1, 1), corner(bw - 2, 1), corner(1, bh - 2), corner(bw - 2, bh - 2)];
        const bg = [0, 1, 2].map((k) => cs.reduce((s, c2) => s + c2[k], 0) / 4);
        const dist = (i) => Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]);
        // 테두리에서 이어진 배경을 넓게 채우기(그림자처럼 조금 진한 배경도 포함)
        const seen = new Uint8Array(bw * bh);
        const stack = [];
        for (let x = 0; x < bw; x++) { stack.push(x, 0, x, bh - 1); }
        for (let y = 0; y < bh; y++) { stack.push(0, y, bw - 1, y); }
        while (stack.length) {
          const y = stack.pop(); const x = stack.pop();
          if (x < 0 || y < 0 || x >= bw || y >= bh) continue;
          const p = y * bw + x;
          if (seen[p]) continue;
          const i = p * 4;
          const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          // 밝은 배경·연한 그림자는 지우고, 진한 외곽선(어두운 색)에서 멈춘다
          if (dist(i) > tolerance && lum < 200) continue;
          if (dist(i) > tolerance * 2.2) continue;
          seen[p] = 1;
          stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
        }
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const p = y * bw + x, i = p * 4;
          if (seen[p]) {
            // 외곽선 옆 경계는 배경색과 얼마나 다른지에 따라 반투명으로 둔다
            let edge = false;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (y + dy) * bw + (x + dx); if (x + dx >= 0 && x + dx < bw && y + dy >= 0 && y + dy < bh && !seen[q]) edge = true; }
            px[i + 3] = edge ? Math.max(0, Math.min(255, Math.round((dist(i) / feather) * 255))) : 0;
          }
        }
        // 그림자 찌꺼기 같은 작은 점(남은 덩어리가 minIsland 픽셀보다 작음)은 지운다. 효과 선(보라·빨강 짧은 선)은 이보다 크다
        const minIsland = 60;
        const comp = new Int32Array(bw * bh).fill(-1);
        for (let p0 = 0; p0 < bw * bh; p0++) {
          if (comp[p0] !== -1 || px[p0 * 4 + 3] <= 20) continue;
          const members = [p0]; comp[p0] = p0;
          for (let k = 0; k < members.length; k++) {
            const p = members[k], x = p % bw, y = (p - x) / bw;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
              const q = ny * bw + nx;
              if (comp[q] === -1 && px[q * 4 + 3] > 20) { comp[q] = p0; members.push(q); }
            }
          }
          if (members.length < minIsland) for (const p of members) px[p * 4 + 3] = 0;
        }
        let minX = bw, minY = bh, maxX = -1, maxY = -1;
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          if (px[(y * bw + x) * 4 + 3] > 20) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
        ctx.putImageData(d, 0, 0);
        if (maxX < 0) { out.push({ name, error: '남은 그림이 없습니다' }); continue; }
        const pad = 6;
        const tx = Math.max(0, minX - pad), ty = Math.max(0, minY - pad);
        const tw = Math.min(bw, maxX + pad + 1) - tx, th = Math.min(bh, maxY + pad + 1) - ty;
        const t = document.createElement('canvas');
        t.width = tw; t.height = th;
        t.getContext('2d').drawImage(c, tx, ty, tw, th, 0, 0, tw, th);
        out.push({ name, width: tw, height: th, png: t.toDataURL('image/png') });
      }
      return out;
    }, { dataUrl, spec });
    fs.mkdirSync(outDir, { recursive: true });
    for (const r of results) {
      if (r.error) { console.log(`${r.name}: ${r.error}`); continue; }
      const file = path.join(outDir, `${r.name}.png`);
      fs.writeFileSync(file, Buffer.from(r.png.split(',')[1], 'base64'));
      console.log(`${r.name}.png ${r.width}×${r.height}`);
    }
  } finally { await browser.close(); }
}

main().catch((e) => { console.error(`캐릭터 자르기 오류: ${e.message}`); process.exit(1); });
