// 모음 영상 만들기: 모음표(JSON)의 구간(장면표)마다 영상을 만들고 하나로 이어 붙인다. 유튜브 챕터 목록도 만든다.
// 구간은 각각 30초 안팎의 숏폼으로도 쓸 수 있다.
// 사용: node make-compilation.cjs <모음표.json> [--force]
//   모음표 형식: 같은 폴더의 장면표-형식.md "모음 영상" 절
//   결과: <모음표 폴더>/<이름>.mp4, 유튜브챕터.txt, 구간/<NN_제목>/<제목>.mp4(구간별 숏폼)·미리보기/
'use strict';
const { fs, path, readJson } = require('./lib.cjs');
const { renderPlan, ffmpegBin, WORKSPACE } = require('./make-short.cjs');
const { spawnSync } = require('child_process');
const os = require('os');

const MAX_PARTS = 20, MAX_TOTAL = 600;
const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 60);
const clock = (sec) => { const s = Math.round(sec); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

async function main() {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) throw new Error('사용법: node make-compilation.cjs <모음표.json> [--force]');
  const force = argv.includes('--force');
  const compFile = path.resolve(file);
  const comp = readJson(compFile, null);
  if (!comp || !Array.isArray(comp.parts) || !comp.parts.length) throw new Error('모음표에 parts(구간 목록)가 없습니다. 장면표-형식.md를 보세요.');
  if (comp.parts.length > MAX_PARTS) throw new Error(`구간은 ${MAX_PARTS}개 이하로 해 주세요.`);
  const base = path.dirname(compFile);
  const shared = { theme: comp.theme, basis: comp.basis, host: comp.host };
  const results = [];
  let t = 0;
  for (let i = 0; i < comp.parts.length; i++) {
    const part = comp.parts[i];
    const planFile = part.plan ? path.resolve(base, part.plan) : null;
    const plan = planFile ? readJson(planFile, null) : { scenes: part.scenes };
    if (!plan) throw new Error(`구간 ${i + 1}의 장면표를 읽지 못했습니다: ${part.plan}`);
    for (const [k, v] of Object.entries(shared)) if (plan[k] === undefined && v !== undefined) plan[k] = v;
    plan.bgm = null; // 배경음은 모음 영상 전체에 한 번 깐다
    plan.progressLabel = `${i + 1}/${comp.parts.length}`;
    const title = part.title || plan.name || `구간 ${i + 1}`;
    const outDir = path.join(base, '구간', `${String(i + 1).padStart(2, '0')}_${safe(title)}`);
    const name = safe(title);
    const mp4 = path.join(outDir, `${name}.mp4`);
    const meta = path.join(outDir, '구간정보.json');
    // 장면표·모음표가 그대로면 전에 만든 구간 영상을 다시 쓴다(--force면 다시 만든다)
    const srcTime = Math.max(fs.statSync(compFile).mtimeMs, planFile ? fs.statSync(planFile).mtimeMs : 0);
    let seconds;
    if (!force && fs.existsSync(mp4) && fs.existsSync(meta) && fs.statSync(mp4).mtimeMs > srcTime) {
      seconds = readJson(meta, {}).seconds;
      console.log(`${i + 1}/${comp.parts.length} ${title}: 전에 만든 영상 사용`);
    } else {
      const res = await renderPlan(plan, outDir, { name });
      seconds = res.seconds;
      fs.writeFileSync(meta, `${JSON.stringify({ title, seconds, plan: planFile ? path.relative(base, planFile) : '(모음표 안)', made: new Date().toISOString() }, null, 1)}\n`);
      console.log(`${i + 1}/${comp.parts.length} ${title}: ${seconds.toFixed(1)}초`);
    }
    results.push({ title, mp4, seconds, start: t });
    t += seconds;
  }
  if (t > MAX_TOTAL) throw new Error(`전체 길이가 ${Math.round(t)}초입니다. ${MAX_TOTAL / 60}분 이하로 줄여 주세요.`);

  // 같은 설정으로 만든 구간 영상이라 다시 인코딩하지 않고 이어 붙인다
  const ff = ffmpegBin();
  const list = path.join(os.tmpdir(), `concat-${process.pid}.txt`);
  fs.writeFileSync(list, results.map((r) => `file '${r.mp4.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const name = safe(comp.name || path.basename(compFile, '.json'));
  const joined = path.join(os.tmpdir(), `joined-${process.pid}.mp4`);
  let r = spawnSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', joined], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`이어 붙이기 실패: ${(r.stderr || '').slice(-600)}`);
  const out = path.join(base, `${name}.mp4`);
  const bgm = comp.bgm && fs.existsSync(path.resolve(WORKSPACE, comp.bgm)) ? path.resolve(WORKSPACE, comp.bgm) : null;
  if (bgm) {
    const fadeAt = Math.max(t - 2, 0);
    r = spawnSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', joined, '-stream_loop', '-1', '-i', bgm,
      '-filter_complex', `[1:a]atrim=0:${t},afade=t=in:st=0:d=1,afade=t=out:st=${fadeAt}:d=2,volume=${Number(comp.bgmVolume) || 0.5},aresample=44100[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out], { encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) throw new Error(`배경음 넣기 실패: ${(r.stderr || '').slice(-600)}`);
  } else {
    fs.copyFileSync(joined, out);
  }
  fs.rmSync(joined, { force: true });
  fs.rmSync(list, { force: true });
  const chapters = results.map((x) => `${clock(x.start)} ${x.title}`).join('\n');
  fs.writeFileSync(path.join(base, '유튜브챕터.txt'), `${chapters}\n`);
  console.log(`모음 영상: ${out} (${clock(t)}, 구간 ${results.length}개${bgm ? ', 배경음 있음' : ', 배경음 없음'})`);
  console.log(`챕터: ${path.join(base, '유튜브챕터.txt')}`);
}

main().catch((e) => { console.error(`모음 영상 오류: ${e.message}`); process.exit(1); });
