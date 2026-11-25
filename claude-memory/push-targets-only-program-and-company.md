---
name: push-targets-only-program-and-company
description: "11-25부터 올리는 저장소는 ai-office-program(코드)과 ai-office-company(회사 설정) 둘뿐, 옛 포크 Lupus-01/ai-office에는 올리지 않는다"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 927f2e8a-aaad-4699-a3d3-7be709ad567b
  modified: 2026-11-25T01:20:22.198Z
---

2026-11-25 대표 지시: "더 이상 Lupus-01/ai-office 이 주소에는 올리지 않을거니깐 … ai-office-program, ai-office-company에만 진행". 코드는 `v2`(비공개 `Lupus-01/ai-office-program`의 작업 브랜치와 `main`), 회사 설정·메모는 `ai-office-company`(sync.mjs)와 2.0 저장소의 `company-data` 브랜치에만 올린다.

**Why:** 대표가 이유를 말하지는 않았다. 직전에 2.0 개발을 시작한다고 했고, 옛 포크는 공개 저장소다(이유 연결은 내 추정).

**How to apply:**
- `git push origin …`을 하지 않는다. 이 PC에서는 실수 방지를 위해 `origin`·`share`의 push 주소를 막아 두었고(되돌리기: `git remote set-url --push origin https://github.com/Lupus-01/ai-office.git`), `feat/mail-preview`·`main`의 추적 대상을 `v2`로 바꿨다.
- `npm run office:release`("배포해줘")는 옛 포크 main으로 올리는 명령이라 지금 상태로는 쓰지 않는다. 대표가 배포를 다시 지시하면 어느 저장소로 배포할지 먼저 확인한다. 옛 포크 main의 마지막 배포는 `9961912`(11-25)이고 그대로 남아 있다.
- `ai-office-share`(11-24에 만든 공개 배포용)도 대표가 말한 두 곳에 들지 않으므로 요청이 있을 때만 올린다.
- [[push-updates-immediately]], [[shared-company-org]], [[workspace-backup-repo]]의 "포크에 push" 설명은 이 지시가 대신한다.
