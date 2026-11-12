#!/usr/bin/env node
// AI Office 설정 동기화: 이 PC의 설정과 이 저장소(Git)의 설정을 비교해 더 최신인 쪽으로 맞춘다.
//
//   node sync.mjs --program <프로그램 폴더>      비교하고 최신 쪽으로 맞춘다(처음 한 번만 --program 필요)
//   node sync.mjs --check                        비교만 하고 바꾸지 않는다
//   node sync.mjs --push | --pull                방향을 직접 정한다(이 PC → Git | Git → 이 PC)
//
// 맞추는 것
//   1) 회사 설정(부서·직원·회사 공통 규칙·회사 설정): org-export.json
//   2) 예약: 작업공간/.office/schedules.json
//   3) Claude 메모: claude-memory/ (파일별)
//   4) AI트렌드부·AI평가부 업무 폴더: 작업공간/outputs/ (없는 폴더만 서로 채움, 덮어쓰지 않음)
// 덮어쓰기 전의 내용은 .sync-backups/ 에 남긴다(Git에 올리지 않음).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(REPO, '.sync-state.json');
const BACKUP_DIR = path.join(REPO, '.sync-backups');
const AI_DEPTS = new Set(['aitrend', 'operations']);
const PII = /01[016789][- ]?\d{3,4}[- ]?\d{4}|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[a-z]{2,}|\d{3,6}-\d{2,6}-\d{4,8}|gh[op]_[A-Za-z0-9]{10,}/;
const SCHEDULE_KEYS = ['id', 'prompt', 'time', 'startDate', 'times', 'untilDate', 'chief', 'policy', 'timeZone', 'enabled', 'createdAt'];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const CHECK = flag('--check');
const FORCE = flag('--push') ? 'push' : flag('--pull') ? 'pull' : null;

const log = (...a) => console.log(...a);
const fail = (msg) => { console.error(`오류: ${msg}`); process.exit(1); };
const readJson = (file, fallback = null) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const fmt = (ms) => (ms ? new Date(ms).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '없음');

function run(cmd, cmdArgs, cwd, { allowFail = false } = {}) {
  const res = spawnSync(cmd, cmdArgs, { cwd, encoding: 'utf8', windowsHide: true });
  if (res.error) fail(`${cmd} 실행 실패: ${res.error.message}`);
  if (res.status !== 0 && !allowFail) fail(`${cmd} ${cmdArgs.join(' ')}\n${res.stdout}${res.stderr}`);
  return { ok: res.status === 0, out: (res.stdout || '').trim(), err: (res.stderr || '').trim() };
}
const git = (gitArgs, o) => run('git', ['-c', 'core.quotepath=false', ...gitArgs], REPO, o);
const commitTime = (rel) => { const r = git(['log', '-1', '--format=%ct', '--', rel], { allowFail: true }); return r.ok && r.out ? Number(r.out) * 1000 : 0; };
const maxMtime = (files) => Math.max(0, ...files.filter((f) => fs.existsSync(f)).map((f) => fs.statSync(f).mtimeMs));
function backup(name, source) {
  if (!fs.existsSync(source)) return null;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const dest = path.join(BACKUP_DIR, `${stamp()}-${name}`);
  fs.cpSync(source, dest, { recursive: true });
  return dest;
}

// ── 준비 ────────────────────────────────────────────────────────────────────
const state = readJson(STATE_FILE, {});
const program = path.resolve(opt('--program') || state.program || process.cwd());
if (!fs.existsSync(path.join(program, 'scripts', 'office.mjs'))) {
  fail(`프로그램 폴더를 찾지 못했습니다: ${program}\n처음 한 번은 --program <AI Office 프로그램 폴더>를 붙여 주세요.`);
}
const { resolveWorkspace } = await import(pathToFileURL(path.join(program, 'lib', 'paths.mjs')).href);
const { readDashboardAccess } = await import(pathToFileURL(path.join(program, 'lib', 'dashboard-access.mjs')).href);
const workspace = resolveWorkspace({ cwd: program }).path;
if (!fs.existsSync(path.join(workspace, 'org'))) fail(`작업 공간을 찾지 못했습니다: ${workspace}\n프로그램을 한 번 켰다가(npm run office:start) 다시 실행해 주세요.`);
const memoryDir = path.join(os.homedir(), '.claude', 'projects', program.replace(/[^A-Za-z0-9]/g, '-'), 'memory');

log(`프로그램: ${program}`);
log(`작업 공간: ${workspace}`);
log(`저장소:   ${REPO}`);

const dirty = git(['status', '--porcelain']).out;
if (dirty) fail(`저장소에 올리지 않은 변경이 있습니다. 먼저 정리해 주세요.\n${dirty}`);
const pulled = git(['pull', '--ff-only', '-q'], { allowFail: true });
if (!pulled.ok) fail(`Git에서 최신 내용을 받지 못했습니다.\n${pulled.err}`);

const actions = [];   // 사람이 읽는 결과
const toCommit = [];  // 커밋 메시지용

// ── 1) 회사 설정 ─────────────────────────────────────────────────────────────
const repoOrgFile = path.join(REPO, 'org-export.json');
const tmpOrg = path.join(os.tmpdir(), `ai-office-org-${process.pid}.json`);
run('node', ['scripts/office.mjs', 'org', 'export', tmpOrg, '--yes'], program);
const localOrgText = fs.readFileSync(tmpOrg, 'utf8');
const localOrg = JSON.parse(localOrgText);
const repoOrg = readJson(repoOrgFile);
const orgSame = repoOrg && stable(localOrg) === stable(repoOrg);
const localOrgTime = maxMtime(fs.readdirSync(path.join(workspace, 'org')).map((f) => path.join(workspace, 'org', f)));
const repoOrgTime = commitTime('org-export.json');
const count = (o) => (o ? `부서 ${o.departments?.length ?? '?'}개·직원 ${o.roster?.length ?? '?'}명` : '없음');

let orgDir = null;
if (orgSame) actions.push('회사 설정: 같음');
else orgDir = FORCE || (!repoOrg || localOrgTime > repoOrgTime ? 'push' : 'pull');
if (orgDir) {
  log(`\n회사 설정이 다릅니다. 이 PC: ${count(localOrg)}, 바뀐 시각 ${fmt(localOrgTime)} / Git: ${count(repoOrg)}, 올린 시각 ${fmt(repoOrgTime)}`);
  if (orgDir === 'push') {
    actions.push(`회사 설정: 이 PC가 최신 → Git에 올림 (${count(localOrg)})`);
    if (!CHECK) {
      fs.writeFileSync(repoOrgFile, localOrgText);
      const orgCopy = path.join(REPO, '작업공간', 'org');
      fs.mkdirSync(orgCopy, { recursive: true });
      for (const f of fs.readdirSync(path.join(workspace, 'org'))) fs.copyFileSync(path.join(workspace, 'org', f), path.join(orgCopy, f));
      toCommit.push('회사 설정');
    }
  } else {
    actions.push(`회사 설정: Git이 최신 → 이 PC에 가져옴 (${count(repoOrg)})`);
    if (!CHECK) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const kept = path.join(BACKUP_DIR, `${stamp()}-org-before-pull.json`);
      fs.copyFileSync(tmpOrg, kept);
      run('node', ['scripts/office.mjs', 'org', 'import', repoOrgFile, '--yes'], program);
      actions.push(`  가져오기 전 설정 백업: ${kept}`);
    }
  }
}
fs.rmSync(tmpOrg, { force: true });

// ── 2) 예약 ──────────────────────────────────────────────────────────────────
const localSchedFile = path.join(workspace, '.office', 'schedules.json');
const repoSchedFile = path.join(REPO, '작업공간', '.office', 'schedules.json');
const schedItems = (file) => (readJson(file, { items: [] }).items || []).filter((s) => !s.completed);
const schedNorm = (items) => stable(items.map((s) => Object.fromEntries(SCHEDULE_KEYS.map((k) => [k, s[k] ?? null]))).sort((a, b) => String(a.id).localeCompare(String(b.id))));
const newest = (items) => Math.max(0, ...items.map((s) => Date.parse(s.createdAt) || 0));
const localSched = schedItems(localSchedFile);
const repoSched = schedItems(repoSchedFile);
const localSchedHash = hash(schedNorm(localSched));
const repoSchedHash = hash(schedNorm(repoSched));

let schedDir = null;
if (localSchedHash === repoSchedHash) actions.push('예약: 같음');
else if (FORCE) schedDir = FORCE;
else {
  const localChanged = state.schedules ? state.schedules !== localSchedHash : null;
  const repoChanged = state.schedules ? state.schedules !== repoSchedHash : null;
  if (localChanged === true && repoChanged === false) schedDir = 'push';
  else if (localChanged === false && repoChanged === true) schedDir = 'pull';
  else {
    // 처음 맞추는 PC이거나 양쪽이 다 바뀐 경우. 예약 파일은 실행할 때마다 고쳐져 파일 시각을 믿을 수 없으므로,
    // 이 PC에서 가장 최근에 등록한 예약의 시각과 Git에 올린 시각을 비교한다. 진 쪽은 백업으로 남는다.
    schedDir = localSched.length && newest(localSched) > commitTime('작업공간/.office/schedules.json') ? 'push' : 'pull';
  }
}
async function runningTasks() {
  const access = readDashboardAccess(workspace);
  if (!access) return { serverOn: false, running: 0 };
  try {
    const res = await fetch(new URL('/api/state', access.url), { headers: { 'X-Office-Token': access.token, Accept: 'application/json' } });
    const data = await res.json();
    return { serverOn: true, running: (data.runs || []).filter((r) => ['running', 'queued'].includes(r.status)).length };
  } catch { return { serverOn: false, running: 0 }; }
}
let schedApplied = true;
if (schedDir === 'push') {
  actions.push(`예약: 이 PC가 최신 → Git에 올림 (${localSched.length}건)`);
  if (!CHECK) {
    fs.mkdirSync(path.dirname(repoSchedFile), { recursive: true });
    fs.writeFileSync(repoSchedFile, `${JSON.stringify({ version: 1, items: localSched }, null, 2)}\n`);
    toCommit.push('예약');
  }
} else if (schedDir === 'pull') {
  actions.push(`예약: Git이 최신 → 이 PC에 가져옴 (${repoSched.length}건)`);
  if (!CHECK) {
    const { serverOn, running } = await runningTasks();
    if (running > 0) {
      schedApplied = false;
      actions.push(`  보류: 진행 중인 업무가 ${running}건 있어 예약은 바꾸지 않았습니다. 업무가 끝난 뒤 다시 실행해 주세요.`);
    } else {
      if (serverOn) run('node', ['scripts/office-bg.mjs', 'stop'], program, { allowFail: true });
      const kept = backup('schedules-before-pull.json', localSchedFile);
      fs.mkdirSync(path.dirname(localSchedFile), { recursive: true });
      fs.copyFileSync(repoSchedFile, localSchedFile);
      if (kept) actions.push(`  가져오기 전 예약 백업: ${kept}`);
      if (serverOn) { run('node', ['scripts/office-bg.mjs', 'start'], program, { allowFail: true }); actions.push('  예약을 바꾸려고 서버를 껐다가 다시 켰습니다.'); }
    }
  }
}

// ── 3) Claude 메모 ───────────────────────────────────────────────────────────
const repoMemDir = path.join(REPO, 'claude-memory');
if (!fs.existsSync(memoryDir)) actions.push(`Claude 메모: 이 PC에 메모 폴더가 없어 건너뜀 (${memoryDir})`);
else {
  const names = new Set([...fs.readdirSync(memoryDir), ...(fs.existsSync(repoMemDir) ? fs.readdirSync(repoMemDir) : [])].filter((f) => f.endsWith('.md')));
  const pushed = []; const pulledFiles = [];
  for (const name of [...names].sort()) {
    const local = path.join(memoryDir, name); const repo = path.join(repoMemDir, name);
    const l = fs.existsSync(local) ? fs.readFileSync(local) : null; const r = fs.existsSync(repo) ? fs.readFileSync(repo) : null;
    if (l && r && l.equals(r)) continue;
    const dir = FORCE || (!r || (l && fs.statSync(local).mtimeMs > commitTime(`claude-memory/${name}`)) ? 'push' : 'pull');
    if (dir === 'push' && l) { pushed.push(name); if (!CHECK) { fs.mkdirSync(repoMemDir, { recursive: true }); fs.copyFileSync(local, repo); } }
    else if (dir === 'pull' && r) { pulledFiles.push(name); if (!CHECK) { backup(`memory-${name}`, local); fs.copyFileSync(repo, local); } }
  }
  if (!pushed.length && !pulledFiles.length) actions.push('Claude 메모: 같음');
  if (pushed.length) { actions.push(`Claude 메모: 이 PC → Git ${pushed.length}개 (${pushed.join(', ')})`); if (!CHECK) toCommit.push('메모'); }
  if (pulledFiles.length) actions.push(`Claude 메모: Git → 이 PC ${pulledFiles.length}개 (${pulledFiles.join(', ')})`);
}

// ── 4) AI트렌드부·AI평가부 업무 폴더(없는 것만 채움) ─────────────────────────
const localOut = path.join(workspace, 'outputs');
const repoOut = path.join(REPO, '작업공간', 'outputs');
const taskDirs = (root) => (fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => fs.readdirSync(path.join(root, d.name), { withFileTypes: true }).filter((t) => t.isDirectory()).map((t) => `${d.name}/${t.name}`)) : []);
const isAiTask = (dir) => { const plan = readJson(path.join(dir, 'plan.json')); return Boolean(plan?.stages?.length) && plan.stages.every((s) => AI_DEPTS.has(s.dept)); };
function findPii(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !/\.(md|json|html|txt|csv)$/i.test(entry.name)) continue;
    const file = path.join(entry.parentPath || entry.path, entry.name);
    const hit = fs.readFileSync(file, 'utf8').match(PII);
    if (hit) return path.relative(dir, file);
  }
  return null;
}
const upTasks = []; const downTasks = []; const skipped = [];
if (FORCE !== 'pull') for (const rel of taskDirs(localOut)) {
  if (fs.existsSync(path.join(repoOut, rel)) || !isAiTask(path.join(localOut, rel))) continue;
  const pii = findPii(path.join(localOut, rel));
  if (pii) { skipped.push(`${rel} (연락처·메일·계좌로 보이는 내용: ${pii})`); continue; }
  upTasks.push(rel);
  if (!CHECK) fs.cpSync(path.join(localOut, rel), path.join(repoOut, rel), { recursive: true });
}
if (FORCE !== 'push') for (const rel of taskDirs(repoOut)) {
  if (fs.existsSync(path.join(localOut, rel))) continue;
  downTasks.push(rel);
  if (!CHECK) fs.cpSync(path.join(repoOut, rel), path.join(localOut, rel), { recursive: true });
}
if (!upTasks.length && !downTasks.length && !skipped.length) actions.push('AI 브리핑·평가 업무 폴더: 같음');
if (upTasks.length) { actions.push(`AI 브리핑·평가 업무 폴더: 이 PC → Git ${upTasks.length}건`); if (!CHECK) toCommit.push(`업무 폴더 ${upTasks.length}건`); }
if (downTasks.length) actions.push(`AI 브리핑·평가 업무 폴더: Git → 이 PC ${downTasks.length}건`);
for (const s of skipped) actions.push(`  올리지 않음: ${s}`);

// ── 마무리 ───────────────────────────────────────────────────────────────────
log(`\n${CHECK ? '[비교만 함 — 바꾸지 않았습니다]' : '[결과]'}`);
for (const a of actions) log(`- ${a}`);

if (!CHECK) {
  if (git(['status', '--porcelain']).out) {
    git(['add', '-A']);
    git(['commit', '-q', '-m', `설정 동기화: ${[...new Set(toCommit)].join('·') || '변경'} (${os.hostname()}, ${new Date().toISOString().slice(0, 10)})`]);
    const pushedGit = git(['push', '-q'], { allowFail: true });
    if (!pushedGit.ok) fail(`Git에 올리지 못했습니다. 저장소에서 git push를 다시 해 주세요.\n${pushedGit.err}`);
    log(`- Git에 올렸습니다: ${git(['log', '-1', '--format=%h %s']).out}`);
  } else log('- Git에 올릴 변경은 없습니다.');
  const finalSched = schedApplied ? hash(schedNorm(schedItems(localSchedFile))) : state.schedules;
  fs.writeFileSync(STATE_FILE, `${JSON.stringify({ program, schedules: finalSched, lastSync: new Date().toISOString() }, null, 2)}\n`);
}
