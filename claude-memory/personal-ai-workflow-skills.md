---
name: personal-ai-workflow-skills
description: 전역 설치한 execute·pr-lifecycle·handoff·grip-it 스킬의 출처·기준 커밋·설치 위치(Claude·Codex)·업데이트 방법과 채택하지 않은 항목
metadata:
  node_type: memory
  type: reference
  originSessionId: 62d70f7b-dbe6-464f-b5ed-81df344de44d
  modified: 2026-11-20T08:58:25.095Z
---

`execute`·`pr-lifecycle`·`handoff`·`grip-it` 스킬은 https://github.com/JISANGHYEOK-0901/personal-ai-workflow 의 `skills/`를 그대로 복사한 것이다. 저장소 기본 브랜치는 `develop`이고 `main`은 오래됐다.

**회사 PC 기준(2026-11-20 대표 지시 "클로드, 코덱스 vs코드 등 적용할 수 있는 스킬셋 업데이트"):** `develop` `4d64f05`(2026-11-20)의 스킬 4개·파일 8개를 두 곳에 설치하고 blob 일치를 확인했다.
- Claude: `~/.claude/skills/` (Claude Code CLI와 VS Code의 Claude Code 확장이 같이 읽는다)
- Codex: `~/.codex/skills/` (Codex CLI와 VS Code의 ChatGPT/Codex 확장이 같이 읽는다)
- 설치 전 회사 PC는 9~10월 판이었고(Claude는 execute·pr-lifecycle만, Codex는 참조 문서도 빠진 9월 판), 직접 고친 파일은 없었다. 집 PC는 11-12에 `2a2ca6f`였다(이 PC와 다를 수 있으니 집에서도 같은 방법으로 올린다).
- Cursor는 이 PC에 없다. `~/.copilot`(Copilot CLI)에는 따로 넣지 않았다.

**바뀐 내용(2a2ca6f → 4d64f05):** 새 스킬 `grip-it`(착수 전 미결 결정을 전체 목록으로 보여 주고 한 토픽씩 확정, `ai-input/grip/<작업 ID>/GRIP_REGISTER.md`에 기록). execute는 사용자 소유의 미결 선택이 후속 작업을 구속하면 grip-it으로 넘긴다. pr-lifecycle은 실제 동작 검증 증거, 독립 리뷰 증표(훅이 있는 환경만), 보고 값은 현재 GitHub 조회에서, 의존 PR 임시 통합 검증을 더했다.

**업데이트 방법:** 임시 폴더에 받아 `git -c core.autocrlf=false archive origin/develop skills/execute skills/pr-lifecycle skills/handoff skills/grip-it | tar -x`로 원본 바이트를 꺼내 두 폴더에 덮어쓰고, `git hash-object --no-filters`로 `git ls-tree -r origin/develop skills`의 blob과 대조한다. 스킬 내용을 직접 고치지 않는다. 바뀐 내용은 설치 전에 읽고, 실행 코드가 새로 들어왔는지 확인한다(이번에도 스킬은 .md뿐이었다).

**채택하지 않은 항목(2026-11-05 결정, 11-20에도 그대로):**
- "PR해줘"를 머지·브랜치 정리까지로 해석하는 개인 설정. 대표가 정한 범위는 [[pr-request-scope]]를 따른다.
- `workflow/CORE.md` 전역 연결. 위 해석이 들어 있고 모든 세션의 행동을 바꾼다.
- `hooks/communication.py`(PR·push 차단, 독립 리뷰 강제, grip-it 편집 차단 훅)와 `scripts/`. 실행 코드라 설치하지 않았다. 그래서 스킬 속 "훅이 설치된 환경" 절차(증표 기록, `grip-edit-scope` 차단)는 이 PC에서 동작하지 않는다.
- `third-party/installed-baseline/`. 저장소도 비활성 원본으로 두며, Notion 토큰·쿠키를 다루는 스크립트가 들어 있다.

**Codex 전역 규칙 정리(2026-11-20 대표 지시 "전역 규칙을 옮기고 최신 스킬셋으로 다 변경"):** `~/.codex/AGENTS.md`에 2026-03-19에 만든 홍카페 개발용 "Safety-First" 규칙(승인 전 수정 금지, 항상 Read/Evaluate/Plan 보고서 형식)이 모든 Codex 실행에 걸려 있었다. AI Office 독립검증실(Codex, 첫 줄 `VERDICT:`)과 반대 방향이라 옮겼다.
- 원본 백업: `~/.codex/backups/AGENTS-전역규칙-2026-03-19.md`
- 옮긴 곳: `Desktop/홍카페_개발/Ops-Team_work_log/AGENTS.md`, `Desktop/홍카페_개발/profile-builder/AGENTS.md`(같은 내용, 커밋하지 않음). `hongcafe-ops-profile-integrated`는 이미 더 자세한 자체 AGENTS.md가 있어 그대로 뒀다.
- 전역은 3줄만 남겼다(한국어로 쉽게 설명, 프로젝트 AGENTS.md 따르기, 기존 코드·사용자 변경 보존). 전역에 스킬 연결 문구나 강한 규칙을 넣지 않는다. AI Office 실행기가 직원을 띄울 때 전역 설정을 차단하는 코드를 찾지 못해, 전역 규칙이 대시보드 직원에게도 적용될 수 있다.
- `~/.claude/CLAUDE.md`는 원래 없고 만들지 않았다.

handoff·grip-it은 `ai-input/`이 Git에서 제외된 저장소에 기록한다(AI-Office-App은 `.gitignore`에 `/ai-input/`가 있다). pr-lifecycle의 PR 생성·머지 단계는 `gh`를 쓴다. 설치 위치와 로그인 확인은 [[windows-test-setup]]을 따른다.
