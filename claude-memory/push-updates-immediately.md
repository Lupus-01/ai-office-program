---
name: push-updates-immediately
description: 대표 지시(2026-11-13) — 진행하는 업데이트는 그때그때 대표 Git에 올려 다른 PC에서 바로 쓸 수 있게 한다
metadata:
  node_type: memory
  type: feedback
  originSessionId: e3619e18-e055-49ff-8029-335c6aa9e787
  modified: 2026-11-12T17:58:02.729Z
---

2026-11-13 대표가 "계속 진행하는 업데이트 사항은 git에 바로바로 업데이트해서 다음 주 월요일에 사용할 수 있도록 해야 할 것 같아"라고 했다. 집 PC에서 한 작업을 회사 PC에서 이어 쓰기 위해서다.

**How to apply (내 해석):**
- 프로그램 코드를 고치면 검증 뒤 커밋하고 대표 포크(`origin`, Lupus-01/ai-office)의 작업 브랜치로 바로 push한다. 따로 "커밋해줘", "올려줘"를 기다리지 않는다.
- 회사 설정(부서·직원·규칙·예산)·예약·메모를 바꾸면 [[workspace-backup-repo]]의 `node sync.mjs`를 돌려 비공개 저장소에 올린다. 코드 push 뒤에도 돌려야 `program.json`(브랜치·커밋 위치)이 갱신된다.
- 이 지시는 대표 저장소로 올리는 것까지다. 원본(`upstream`) main에 넣는 것, 포크 `main`에 머지하는 것, PR 생성은 [[pr-request-scope]]대로 대표가 따로 말할 때만 한다.
- 상담사 메일 실제 발송 같은 외부 작업은 이 지시와 무관하다(그 업무에서 따로 지시).

**Why:** 대표는 집과 회사 두 PC를 번갈아 쓰고(동시에 켜지 않음), 한쪽에서 한 작업이 다른 쪽에 없으면 다시 해야 한다.
