// 업무 가이드(lib/guides.mjs)와 화면의 예시 찾기 테스트. 자료는 모두 가상이다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { guideCoverage, guidesFile, loadGuides, normalizeGuide, publicGuides } from '../lib/guides.mjs';
import { appendDraft, searchGuides } from '../dashboard/public/inbox.js';
import { startServer } from '../dashboard/server.mjs';

const GUIDES = { version: 1, guides: [
  { id: 'mail-prepare', title: '안내 메일 문안 준비', summary: '대상별 문안과 미리보기', keywords: ['상담사 메일'], output: '문안', agent: 'writer-1', reviewed: '2026-11-25',
    prepare: ['필수: 대상 명단'], steps: ['대상 확인', '문안 작성'], done: '준비 완료와 발송은 다릅니다.',
    examples: [{ label: '새 업무', text: '[기간]의 메일 초안을 준비해 줘.' }, { label: '보완', kind: 'reply', text: '명단을 첨부했어.' }] },
  { id: 'weekly-count', title: '주간 집계', summary: '회신 현황 표', recipe: 'weekly' },
  { id: 'old-post', title: '게시글 초안', agent: 'gone-1', recipe: 'gone', examples: [{ text: '초안 써 줘' }], ready: false },
  { id: 'mail-prepare', title: '중복', examples: [{ text: 'x' }] },
  { id: 'Bad Id', title: '잘못된 id' },
  { id: 'no-title' }] };
function workspace(data) {
  const root = mkdtempSync(join(tmpdir(), 'office-guides-'));
  mkdirSync(join(root, 'org'));
  if (data !== undefined) writeFileSync(guidesFile(root), typeof data === 'string' ? data : JSON.stringify(data));
  return root;
}

test('가이드 파일: 없으면 빈 목록, 깨졌으면 사유, 잘못된 항목은 빼고 무엇이 문제인지 알려 준다', () => {
  const none = workspace();
  assert.deepEqual(loadGuides(none), { guides: [], problems: [], exists: false });
  const broken = workspace('{ 깨진');
  assert.equal(loadGuides(broken).guides.length, 0);
  assert.match(loadGuides(broken).problems[0], /읽지 못했습니다/);
  const root = workspace(GUIDES);
  const { guides, problems, exists } = loadGuides(root);
  assert.equal(exists, true);
  assert.deepEqual(guides.map((g) => [g.id, g.ready]), [['mail-prepare', true], ['weekly-count', false], ['old-post', false]]);
  assert.equal(guides[0].examples[1].kind, 'reply');
  assert.equal(guides[0].examples[0].kind, 'new');
  assert.equal(guides[2].examples[0].label, '예시');
  assert.equal(problems.length, 4, problems.join(' / '));
  assert.ok(problems.some((p) => /weekly-count: 예시/.test(p)) && problems.some((p) => /같은 id가 두 번/.test(p)) && problems.some((p) => /id가 올바르지 않습니다/.test(p)) && problems.some((p) => /no-title: title/.test(p)));
  assert.equal(normalizeGuide(null).guide, null);
  assert.equal(normalizeGuide({ id: 'a1', title: '가'.repeat(200), examples: [{ text: 'x' }] }).guide.title.length, 80);
  for (const dir of [none, broken, root]) rmSync(dir, { recursive: true, force: true });
});

test('누락 점검: 근무 중인 직원·고정 절차 가운데 가이드가 없는 것, 끊긴 연결, 준비 중, 검토일 없음', () => {
  const root = workspace(GUIDES);
  const { guides } = loadGuides(root);
  const roster = [{ id: 'writer-1', name: '가나대리' }, { id: 'count-1', name: '다라주임' }, { id: 'rest-1', name: '마바사원', active: false }];
  const c = guideCoverage(guides, { roster, recipes: [{ id: 'weekly' }, { id: 'monthly' }] });
  assert.deepEqual(c.agentsWithout, [{ id: 'count-1', name: '다라주임' }], '쉬는 직원은 누락으로 세지 않는다');
  assert.deepEqual(c.recipesWithout, ['monthly']);
  assert.deepEqual(c.broken.map((b) => [b.id, b.reason]), [['old-post', '연결한 직원이 없습니다'], ['old-post', '연결한 고정 절차가 없습니다']]);
  assert.deepEqual(c.notReady.map((g) => g.id), ['weekly-count', 'old-post']);
  assert.deepEqual(c.unreviewed.map((g) => g.id), ['weekly-count', 'old-post']);
  assert.equal(guideCoverage(guides, { roster: [{ id: 'writer-1', active: false }], recipes: [] }).broken[0].reason, '연결한 직원이 휴무입니다');
  // 화면용 목록에는 직원·절차 연결이 없다
  const shown = publicGuides(guides, { roster: [{ id: 'writer-1', active: false }] });
  assert.ok(shown.every((g) => !('agent' in g) && !('recipe' in g)));
  assert.deepEqual(shown.map((g) => g.paused), [true, false, false]);
  // 어느 팀 일인지는 싣는다(가이드 페이지의 팀별 묶음, 팀장 방의 "맡길 수 있는 일")
  const withDept = publicGuides(guides, { roster: [{ id: 'writer-1', department: 'writing' }], departments: [{ id: 'writing', name: '시험문서부' }] });
  assert.deepEqual(withDept.map((g) => g.dept || null), [{ id: 'writing', name: '시험문서부' }, null, null]);
  rmSync(root, { recursive: true, force: true });
});

test('예시 찾기: 업무 이름·설명·다른 이름으로 찾고, 낱말이 모두 맞아야 한다. 입력창에는 쓰던 글 뒤에 붙인다', () => {
  const guides = GUIDES.guides.slice(0, 3);
  assert.equal(searchGuides(guides, '').length, 3);
  assert.deepEqual(searchGuides(guides, '상담사 메일').map((g) => g.id), ['mail-prepare']);
  assert.deepEqual(searchGuides(guides, '  집계 ').map((g) => g.id), ['weekly-count']);
  assert.deepEqual(searchGuides(guides, '메일 집계'), []);
  assert.deepEqual(searchGuides(guides, '보완').map((g) => g.id), ['mail-prepare'], '예시 이름으로도 찾는다');
  assert.equal(appendDraft('', '예시'), '예시');
  assert.equal(appendDraft('  \n', '예시'), '예시');
  assert.equal(appendDraft('쓰던 글\n', '예시'), '쓰던 글\n\n예시');
});

test('GET /api/guides: 파일만 읽어 화면용 목록과 점검 결과를 준다(직원 연결은 목록에 없다)', async () => {
  const root = workspace(GUIDES);
  writeFileSync(join(root, 'org/departments.json'), JSON.stringify([{ id: 'writing', name: '시험문서부', color: '#38bdf8' }]));
  writeFileSync(join(root, 'org/roster.json'), JSON.stringify([{ id: 'writer-1', name: '가나대리', department: 'writing' }]));
  const server = await startServer({ root, port: 0, quiet: true, env: { ...process.env, CLAUDE_BIN: join(root, 'none-a.mjs'), CODEX_BIN: join(root, 'none-b.mjs') } });
  try {
    const page = await (await fetch(server.url)).text();
    const token = /name="office-token" content="([^"]+)"/.exec(page)?.[1] || '';
    const res = await fetch(new URL('/api/guides', server.url), { headers: { 'X-Office-Token': token } });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.guides.map((g) => g.id), ['mail-prepare', 'weekly-count', 'old-post']);
    assert.ok(!JSON.stringify(data.guides).includes('writer-1'), '화면용 목록에 직원 id가 없다');
    assert.equal(data.exists, true);
    assert.deepEqual(data.coverage.agentsWithout, []);
    assert.equal(data.coverage.broken.length, 3);
  } finally { await server.close(); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }); }
});
