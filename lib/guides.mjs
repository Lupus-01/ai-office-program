// 업무 가이드: "이런 일을 맡길 수 있어요" 예시 카드의 재료.
// 문구는 회사 데이터라 프로그램에 넣지 않고 작업 공간 org/guides.json에 둔다(회사마다 다르다). 프로그램은 형식·검사·화면만 가진다.
// 읽기만 한다(AI 호출·외부 전송 0회). 가이드를 고치는 화면은 없다 — 파일을 고치면 다음 조회부터 반영된다.
//
// 형식: { version: 1, guides: [{
//   id,                     영문 소문자·숫자·하이픈
//   title, summary,         업무 이름과 한 줄 설명(검색 대상)
//   keywords?: [],          검색에 걸릴 다른 이름
//   output?,                대표 산출물
//   prepare?: [],           시작 전에 준비할 것("필수: …", "선택: …")
//   steps?: [],             어떻게 진행되는지
//   done?,                  완료 확인과 다음 행동
//   examples: [{ label, text, kind?: 'new'|'reply' }],   복사할 명령 예시. reply는 진행 중인 대화에 보내는 보완 답글
//   agent?, recipe?,        연결된 직원 id·고정 절차 id(화면에는 보이지 않고 누락 점검에만 쓴다)
//   reviewed?: 'YYYY-MM-DD', ready?: false이면 "준비 중"
// }] }
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ID = /^[a-z][a-z0-9-]{1,60}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const GUIDE_LIMITS = Object.freeze({ guides: 200, title: 80, summary: 300, text: 2000, list: 20, examples: 10 });
export const guidesFile = (root) => join(root, 'org', 'guides.json');

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v, max) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, GUIDE_LIMITS.list) : []);

// 가이드 하나를 화면에 내보낼 모양으로 고른다. 쓸 수 없으면 null과 사유
export function normalizeGuide(raw) {
  if (!raw || typeof raw !== 'object') return { guide: null, problem: '항목이 객체가 아닙니다' };
  if (!ID.test(String(raw.id || ''))) return { guide: null, problem: `id가 올바르지 않습니다: ${String(raw.id || '(없음)').slice(0, 60)}` };
  const title = str(raw.title, GUIDE_LIMITS.title);
  if (!title) return { guide: null, problem: `${raw.id}: title이 없습니다` };
  const examples = (Array.isArray(raw.examples) ? raw.examples : []).map((e) => ({ label: str(e?.label, 60) || '예시', text: str(e?.text, GUIDE_LIMITS.text), kind: e?.kind === 'reply' ? 'reply' : 'new' }))
    .filter((e) => e.text).slice(0, GUIDE_LIMITS.examples);
  return { guide: {
    id: raw.id, title, summary: str(raw.summary, GUIDE_LIMITS.summary), keywords: list(raw.keywords, 40), output: str(raw.output, 200),
    prepare: list(raw.prepare, 300), steps: list(raw.steps, 300), done: str(raw.done, 600), examples,
    agent: ID.test(String(raw.agent || '')) ? raw.agent : '', recipe: ID.test(String(raw.recipe || '')) ? raw.recipe : '',
    reviewed: DATE.test(String(raw.reviewed || '')) ? raw.reviewed : '',
    // 예시가 없거나 ready: false면 "준비 중"으로 보이고 입력창에 넣을 수 없다
    ready: raw.ready !== false && examples.length > 0,
  }, problem: raw.ready !== false && !examples.length ? `${raw.id}: 예시(examples)가 없어 준비 중으로 표시합니다` : '' };
}

// 작업 공간의 가이드 파일을 읽는다. 파일이 없으면 빈 목록, 깨졌으면 빈 목록과 사유
export function loadGuides(root) {
  const file = guidesFile(root);
  if (!existsSync(file)) return { guides: [], problems: [], exists: false };
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { return { guides: [], problems: [`org/guides.json을 읽지 못했습니다: ${error.message}`], exists: true }; }
  const guides = [], problems = [], seen = new Set();
  for (const raw of (Array.isArray(data?.guides) ? data.guides : []).slice(0, GUIDE_LIMITS.guides)) {
    const { guide, problem } = normalizeGuide(raw);
    if (problem) problems.push(problem);
    if (!guide) continue;
    if (seen.has(guide.id)) { problems.push(`${guide.id}: 같은 id가 두 번 있습니다(뒤의 것은 쓰지 않습니다)`); continue; }
    seen.add(guide.id); guides.push(guide);
  }
  if (!Array.isArray(data?.guides)) problems.push('guides 배열이 없습니다');
  return { guides, problems, exists: true };
}

// 누락·재검토 점검: 근무 중인 직원과 고정 절차 가운데 가이드가 없는 것, 가이드가 가리키는 직원·절차가 없어졌거나 쉬는 것, 준비 중·검토일 없음
// roster: [{ id, name, active }], recipes: [{ id }]
export function guideCoverage(guides, { roster = [], recipes = [] } = {}) {
  const byAgent = new Set(guides.map((g) => g.agent).filter(Boolean)), byRecipe = new Set(guides.map((g) => g.recipe).filter(Boolean));
  const staff = new Map(roster.map((a) => [a.id, a])), recipeIds = new Set(recipes.map((r) => r.id));
  return {
    agentsWithout: roster.filter((a) => a.active !== false && !byAgent.has(a.id)).map((a) => ({ id: a.id, name: a.name || a.id })),
    recipesWithout: recipes.filter((r) => !byRecipe.has(r.id)).map((r) => r.id),
    broken: guides.flatMap((g) => [
      ...(g.agent && !staff.has(g.agent) ? [{ id: g.id, title: g.title, reason: '연결한 직원이 없습니다' }] : []),
      ...(g.agent && staff.get(g.agent)?.active === false ? [{ id: g.id, title: g.title, reason: '연결한 직원이 휴무입니다' }] : []),
      ...(g.recipe && !recipeIds.has(g.recipe) ? [{ id: g.id, title: g.title, reason: '연결한 고정 절차가 없습니다' }] : []),
    ]),
    notReady: guides.filter((g) => !g.ready).map((g) => ({ id: g.id, title: g.title })),
    unreviewed: guides.filter((g) => !g.reviewed).map((g) => ({ id: g.id, title: g.title })),
  };
}

// 화면에 내보낼 가이드: 직원 id·절차 id는 싣지 않고, 어느 팀 일인지(dept)만 싣는다(가이드 페이지의 팀별 묶음과 팀장 방의 "맡길 수 있는 일"에 쓴다).
// 쉬는 직원에 연결된 가이드는 "지금은 맡길 수 없음"으로 알린다
export function publicGuides(guides, { roster = [], departments = [] } = {}) {
  const staff = new Map(roster.map((a) => [a.id, a])), depts = new Map(departments.map((d) => [d.id, d]));
  return guides.map(({ agent, recipe, ...rest }) => {
    const who = staff.get(agent), dept = who ? depts.get(who.department) : null;
    return { ...rest, paused: Boolean(who && (who.active === false || dept?.active === false)), ...(dept ? { dept: { id: dept.id, name: dept.name } } : {}) };
  });
}
