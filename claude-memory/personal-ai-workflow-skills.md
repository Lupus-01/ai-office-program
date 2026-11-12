---
name: personal-ai-workflow-skills
description: 전역 설치한 execute·pr-lifecycle 스킬의 출처·기준 커밋·업데이트 방법과 채택하지 않은 항목
metadata:
  node_type: memory
  type: reference
  originSessionId: 62d70f7b-dbe6-464f-b5ed-81df344de44d
  modified: 2026-11-05T07:39:16.000Z
---

`~/.claude/skills/execute`와 `~/.claude/skills/pr-lifecycle`은 https://github.com/JISANGHYEOK-0901/personal-ai-workflow 의 `skills/`를 그대로 복사한 것이다. 기준은 `develop` 브랜치 `5e8abfa`(2026-10-30, 2026-11-05 설치)이고, 저장소 기본 브랜치도 `develop`이다. `main`은 오래됐다.

**업데이트 방법:** 임시 폴더에 받아 `git -c core.autocrlf=false archive origin/develop skills/execute skills/pr-lifecycle`로 원본 바이트를 꺼내 덮어쓰고, `git hash-object --no-filters`로 blob과 대조한다. 스킬 내용을 직접 고치지 않는다. 바뀐 내용은 설치 전에 읽고, 실행 코드가 새로 들어왔는지 확인한다.

**채택하지 않은 항목(2026-11-05):**
- "PR해줘"를 머지·브랜치 정리까지로 해석하는 개인 설정. 대표가 정한 범위는 [[pr-request-scope]]를 따른다.
- `workflow/CORE.md` 전역 연결. 위 해석이 들어 있고 모든 세션의 행동을 바꾼다.
- `hooks/communication.py`(PR·push 차단 훅)와 `scripts/`. 실행 코드라 설치하지 않았다.
- `third-party/installed-baseline/`. 저장소도 비활성 원본으로 두며, Notion 토큰·쿠키를 다루는 스크립트가 들어 있다.

pr-lifecycle의 PR 생성·머지 단계는 `gh`를 쓴다. 설치 위치와 로그인 확인은 [[windows-test-setup]]을 따른다.
