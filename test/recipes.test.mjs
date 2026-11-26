// 고정 절차: 정형 업무는 저장된 계획으로 바로 시작한다(자리 표시 채우기·쓸 수 없을 때 사유)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { latestFile, loadRecipes, recipeChoices, recipePlan } from '../lib/recipes.mjs';
import { judgeCommand } from '../lib/intent.mjs';

function workspace(t, recipes) {
  const root = mkdtempSync(join(tmpdir(), 'office-recipes-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'org'), { recursive: true });
  if (recipes !== undefined) writeFileSync(join(root, 'org', 'recipes.json'), typeof recipes === 'string' ? recipes : JSON.stringify({ version: 1, recipes }));
  return root;
}
const stage = (extra = {}) => ({ id: 's1', title: '수집', dept: 'biz', agent: 'biz-1', inputs: [], dependsOn: [], output: 'outputs/{{task}}/biz/biz-1-data.json', done: '대표 지시: "{{request}}"', ...extra });
const put = (root, rel, time) => { const file = join(root, ...rel.split('/')); mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, '{}'); utimesSync(file, time, time); };

test('절차 파일이 없거나 깨졌으면 절차가 없는 것으로 본다. 형식이 틀린 항목은 버린다', (t) => {
  assert.deepEqual(loadRecipes(workspace(t)), []);
  assert.deepEqual(loadRecipes(workspace(t, '{')), []);
  const root = workspace(t, [{ id: 'ok-one', when: '수집만', plan: { stages: [stage()] } }, { id: 'Bad Id', when: 'x', plan: { stages: [stage()] } }, { id: 'no-stages', when: 'x', plan: { stages: [] } }, { id: 'no-when', plan: { stages: [stage()] } }]);
  assert.deepEqual(recipeChoices(root), [{ id: 'ok-one', when: '수집만' }], '의도 판별에는 id와 설명만 준다');
});

test('자리 표시를 채워 계획을 만든다: 업무 id, 대표 지시 원문', (t) => {
  const root = workspace(t, [{ id: 'collect', when: '수집', plan: { goal: '자료 수집', stages: [stage()], deliverables: ['s1'] } }]);
  const { plan } = recipePlan(root, { id: 'collect', task: '2026-11-24/run-a', request: '3명만 수집해줘\n\n[저장 위치] 이 작업의 산출물은…' });
  assert.equal(plan.task, '2026-11-24/run-a');
  assert.equal(plan.stages[0].output, 'outputs/2026-11-24/run-a/biz/biz-1-data.json');
  assert.equal(plan.stages[0].done, '대표 지시: "3명만 수집해줘"', '실행기가 덧붙인 저장 위치 안내는 대표 지시가 아니다');
  assert.deepEqual(plan.publications, []);
  assert.equal(recipePlan(root, { id: 'missing', task: 't' }).plan, null);
});

test('가장 최근 파일 자리 표시: 무늬에 맞는 파일 중 가장 나중 것을 쓰고, 없으면 절차를 쓰지 않는다', (t) => {
  const root = workspace(t, [{ id: 'send', when: '발송', plan: { stages: [stage({ inputs: ['{{latest:outputs/**/care/draft.json}}'] })] } }]);
  assert.match(recipePlan(root, { id: 'send', task: 't' }).reason, /앞선 결과 파일이 없습니다/);
  put(root, 'outputs/2026-11-01/run-a/care/draft.json', new Date('2026-11-01T00:00:00Z'));
  put(root, 'outputs/2026-11-20/run-b/care/draft.json', new Date('2026-11-20T00:00:00Z'));
  put(root, 'outputs/2026-11-23/run-c/care/other.json', new Date('2026-11-23T00:00:00Z'));
  put(root, 'outputs/2026-11-23/run-c/quality/draft.json', new Date('2026-11-23T00:00:00Z'));
  assert.equal(latestFile(root, 'outputs/**/care/draft.json'), 'outputs/2026-11-20/run-b/care/draft.json');
  assert.equal(latestFile(root, '../outside/*.json'), null, '작업 공간 밖은 찾지 않는다');
  assert.deepEqual(recipePlan(root, { id: 'send', task: 't' }).plan.stages[0].inputs, ['outputs/2026-11-20/run-b/care/draft.json']);
});

test('외부 작업이 든 절차는 대표가 그 작업을 시켰을 때만, 연결 계정이 하나일 때만 쓴다', (t) => {
  const publication = { id: 'p1', action: 'mail', service: 'naverworks_mail', connection: '{{connection:naverworks}}', agent: 'biz-1', target: '', recipients: [], subject: '', content: 's1', instructions: '', files: [], attachments: [] };
  const root = workspace(t, [{ id: 'send', when: '발송', plan: { stages: [stage()], publications: [publication] } }]);
  const one = [{ id: 'w1', provider: 'naverworks', status: 'connected' }];
  assert.match(recipePlan(root, { id: 'send', task: 't', connections: one, allowedActions: [] }).reason, /시키지 않은 외부 작업/);
  assert.equal(recipePlan(root, { id: 'send', task: 't', connections: one, allowedActions: ['mail'] }).plan.publications[0].connection, 'w1');
  assert.match(recipePlan(root, { id: 'send', task: 't', connections: [], allowedActions: ['mail'] }).reason, /계정이 없습니다/);
  assert.match(recipePlan(root, { id: 'send', task: 't', connections: [...one, { id: 'w2', provider: 'naverworks', status: 'connected' }], allowedActions: ['mail'] }).reason, /여럿/);
  assert.match(recipePlan(root, { id: 'send', task: 't', connections: [{ id: 'w1', provider: 'naverworks', status: 'needs_login' }], allowedActions: ['mail'] }).reason, /없습니다/);
});

test('의도 판별: 등록된 절차 id만 인정하고, 빠른 조회·상시 실행에는 쓰지 않는다', async () => {
  const base = { kind: 'task', kindEvidence: '', externalActions: [], delegated: false, delegatedEvidence: '', standing: 'none', standingEvidence: '', durationMinutes: 0, deadline: '', intervalMinutes: 0,
    scheduleTime: '', scheduleDate: '', scheduleTimes: 0, scheduleEvidence: '', outputDir: '', outputDirEvidence: '', quick: false, quickAgent: '', quickEdit: false, quickEditFile: '', followUpRun: '' };
  const recipes = [{ id: 'care-mail-prepare', when: '상담사 메일 준비' }];
  const run = async (answer, list = recipes) => { let prompt = ''; const j = async (kind, p) => { prompt = String(p); return answer; }; const r = await judgeCommand('상담사 메일 준비해줘', { judge: j, recipes: list }); return { r, prompt }; };
  const hit = await run({ ...base, recipe: 'care-mail-prepare' });
  if (hit.r.source === 'ai') {
    assert.equal(hit.r.recipe, 'care-mail-prepare');
    assert.match(hit.prompt, /care-mail-prepare/);
    assert.equal((await run({ ...base, recipe: 'made-up' })).r.recipe, '', '목록에 없는 id는 버린다');
    assert.equal((await run({ ...base, recipe: 'care-mail-prepare' }, [])).r.recipe, '');
    assert.equal((await run({ ...base, quick: true, quickAgent: 'biz-1', recipe: 'care-mail-prepare' })).r.recipe, '');
  } else assert.ok(!hit.r.recipe, '판별을 못 하면 절차를 쓰지 않는다');
});

test('시작 전 점검: 보관함 도구만 --check로 실행하고, 실패하면 도구의 마지막 줄을 사유로 돌려준다', async (t) => {
  const { recipePreflight } = await import('../lib/recipes.mjs');
  const tool = '보관함/시험/도구/check.cjs';
  const root = workspace(t, [
    { id: 'pass-one', when: 'x', preflight: [{ tool }], plan: { stages: [stage()] } },
    { id: 'fail-one', when: 'x', preflight: [{ tool: '보관함/시험/도구/fail.cjs' }], plan: { stages: [stage()] } },
    { id: 'outside', when: 'x', preflight: [{ tool: '../밖/도구/x.cjs' }], plan: { stages: [stage()] } },
    { id: 'not-tool', when: 'x', preflight: [{ tool: 'org/recipes.json' }], plan: { stages: [stage()] } },
    { id: 'none', when: 'x', plan: { stages: [stage()] } },
  ]);
  mkdirSync(join(root, '보관함', '시험', '도구'), { recursive: true });
  writeFileSync(join(root, '보관함', '시험', '도구', 'check.cjs'), "if (process.argv[2] !== '--check' || process.env.SECRET_FOR_TEST) process.exit(3); console.log('확인됨');");
  writeFileSync(join(root, '보관함', '시험', '도구', 'fail.cjs'), "console.error('첫 줄'); console.error('ERP 로그인이 필요합니다.'); process.exit(1);");
  assert.deepEqual(await recipePreflight(root, 'pass-one', { env: { ...process.env, SECRET_FOR_TEST: '1' } }), { ok: true, checked: 1 }, '인자는 --check로 고정하고 목록에 없는 환경 변수는 넘기지 않는다');
  assert.deepEqual(await recipePreflight(root, 'fail-one'), { ok: false, message: 'ERP 로그인이 필요합니다.' });
  assert.match((await recipePreflight(root, 'outside')).message, /실행할 수 없습니다/);
  assert.match((await recipePreflight(root, 'not-tool')).message, /실행할 수 없습니다/);
  assert.deepEqual(await recipePreflight(root, 'none'), { ok: true, checked: 0 });
});

test('앞 단계 결과에서 받는 이름: {{from:단계:키}}는 처음에 …로 보이고, 값이 나오면 채운다(경로 글자는 지운다)', async (t) => {
  const { fillFrom, recipeTemplates } = await import('../lib/recipes.mjs');
  const root = workspace(t, [{ id: 'profile', when: '프로필', plan: { goal: '{{from:s1:예명}} 프로필', stages: [stage(), stage({ id: 's2', title: '프로필_{{from:s1:분야}}_{{from:s1:예명}}', output: 'outputs/{{task}}/biz/biz-1-card.pptx' })] } },
    { id: 'plain', when: 'x', plan: { stages: [stage()] } }]);
  const { plan } = recipePlan(root, { id: 'profile', task: 't' });
  assert.equal(plan.goal, '… 프로필');
  assert.equal(plan.stages[1].title, '프로필_…_…');
  const templates = recipeTemplates(root, 'profile', { task: 't' });
  assert.deepEqual(Object.keys(templates.titles), ['s2']);
  const read = (id) => id === 's1' ? { 예명: '가/나:다', 분야: '타로', 목록: ['x'] } : null;
  assert.equal(fillFrom(templates.titles.s2, read), '프로필_타로_가나다');
  assert.equal(fillFrom(templates.goal, read), '가나다 프로필');
  assert.equal(fillFrom('{{from:s1:목록}}_{{from:s9:예명}}', read), '…_…', '글자·숫자가 아닌 값과 없는 단계는 채우지 않는다');
  assert.equal(recipeTemplates(root, 'plain'), null);
});

test('도구 단계: 절차 파일에 적힌 보관함 도구만 AI 없이 실행하고, 계획이 절차와 다르면 도구 단계로 보지 않는다', async (t) => {
  const { recipeToolStage, runRecipeTool } = await import('../lib/recipes.mjs');
  const script = '보관함/시험/도구/make.cjs';
  const made = stage({ id: 's2', output: 'outputs/{{task}}/biz/biz-1-out.txt', tool: { script, args: ['outputs/{{task}}/biz/biz-1-data.json', 'outputs/{{task}}/biz/biz-1-out.txt'] } });
  const root = workspace(t, [{ id: 'make', when: 'x', plan: { stages: [stage(), made, stage({ id: 's3', output: 'outputs/{{task}}/biz/x.txt', tool: { script: 'org/recipes.json' } }),
    stage({ id: 's4', output: 'outputs/{{task}}/biz/y.txt', tool: { script, args: ['../밖'] } })] } }]);
  mkdirSync(join(root, '보관함', '시험', '도구'), { recursive: true });
  mkdirSync(join(root, 'outputs', 't', 'biz'), { recursive: true });
  writeFileSync(join(root, '보관함', '시험', '도구', 'make.cjs'), "if (process.env.SECRET_FOR_TEST) process.exit(3); require('fs').writeFileSync(process.argv[3], process.argv[2]); console.log('만듦');");
  const { plan } = recipePlan(root, { id: 'make', task: 't' });
  assert.equal(recipeToolStage(root, 'make', plan.stages[0], 't'), null, 'tool이 없는 단계는 직원이 한다');
  const spec = recipeToolStage(root, 'make', plan.stages[1], 't');
  assert.deepEqual(spec.args, ['outputs/t/biz/biz-1-data.json', 'outputs/t/biz/biz-1-out.txt']);
  assert.equal(recipeToolStage(root, 'make', { ...plan.stages[1], agent: 'biz-2' }, 't'), null, '담당이 바뀐 단계');
  assert.equal(recipeToolStage(root, 'make', { ...plan.stages[1], output: 'outputs/t/biz/other.txt' }, 't'), null, '산출물이 바뀐 단계');
  assert.equal(recipeToolStage(root, 'other', plan.stages[1], 't'), null);
  assert.match(recipeToolStage(root, 'make', plan.stages[2], 't').error, /실행할 수 없습니다/);
  assert.match(recipeToolStage(root, 'make', plan.stages[3], 't').error, /인자/);
  const ran = await runRecipeTool(root, spec, { env: { ...process.env, SECRET_FOR_TEST: '1' } });
  assert.equal(ran.code, 0, '목록에 없는 환경 변수는 넘기지 않는다');
  assert.match(ran.out, /만듦/);
  assert.equal(readFileSync(join(root, 'outputs', 't', 'biz', 'biz-1-out.txt'), 'utf8'), 'outputs/t/biz/biz-1-data.json');
});

test('절차 단계의 담당이 Aside 직원이면 절차를 쓰지 않는다(도구를 못 돌리고 권한 대기로 멈춘다)', (t) => {
  const root = workspace(t, [{ id: 'collect', when: '수집', plan: { stages: [stage()] } }]);
  const agent = stage().agent;
  const blocked = recipePlan(root, { id: 'collect', task: 't', asideAgents: [agent] });
  assert.equal(blocked.plan, null);
  assert.match(blocked.reason, /Aside 직원입니다/);
  assert.ok(recipePlan(root, { id: 'collect', task: 't', asideAgents: ['other-9'] }).plan, '다른 직원이 Aside면 그대로 쓴다');
});
