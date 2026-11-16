---
name: policy-knowledge-base
description: "홍카페정책부와 정책 지식창고(RAG) — Notion 「정책서 이력 관리」를 글로 저장해 직원이 검색해 답하는 구성, 갱신 도구·대표 결정·함정"
metadata:
  node_type: memory
  type: project
  originSessionId: 927f2e8a-aaad-4699-a3d3-7be709ad567b
  modified: 2026-11-16T04:47:36.729Z
---

2026-11-16 대표 요청("운영팀의 RAG… 상담사 모집부를 홍카페 정책부로 변경… 링크에 있는 모든 데이터를 저장")으로 만들었다.

- **원본:** Notion 「정책서 이력 관리」 https://app.notion.com/p/peoplev/33c504c917c9802b99bcfd6c1aad0134 (27행, 하위 페이지 없음). 페이지 본문은 거의 비어 있고 내용은 첨부(워드·엑셀·PDF·HTML)에 있다. 첨부 내려받기 링크는 약 2천 자, 5분 뒤 만료라 AI가 옮겨 적으면 틀린다.
- **지식창고:** `~/AIOffice/보관함/지식/홍카페정책/` — `목록.md`(현행 문서표·공개 범위·Notion 확인 필요), `현행/*.md`, `원본/`, `변경기록.md`, `상태.json`(도구 전용), `도구/policy-sync.cjs`.
- **도구 방식:** `policy-sync.cjs`가 `claude -p --model haiku --permission-mode dontAsk --allowedTools <Notion 읽기 2종> --disallowedTools Bash,Write…`를 임시 폴더에서 띄워 Notion을 읽고, stream-json의 도구 결과에서 서명 링크를 직접 꺼내 바로 내려받는다. `--tools`를 주면 claude.ai 커넥터(Notion)가 사라지니 주지 않는다. `--check`(비교만), `--force`(전부 다시), `--dir`(시험 폴더). 첫 시험: 현행 20개 실패 0, 1분 40초, 다시 돌리면 "그대로 20".
- **변환:** 워드는 자체 XML 해석(자동 번호 "제1조"·"①" 살림, 표→마크다운), 엑셀은 exceljs(프로그램 node_modules), PDF는 pdftotext(이 PC는 Git의 xpdf `C:\Program Files\Git\mingw64\bin`, `-v` 종료 코드가 0이 아님), HTML은 정규식. 그림 위주 PDF 쪽(홍멘토 첨부2 84쪽)은 직원이 원본을 Read로 보고 `<이름>.보완.md`로 보완.
- **대표 결정(2026-11-16):** 상담사모집부(운영 중지였음)를 없애고 홍카페정책부(policy: 정책팀장 policy-1, 정책자료담당 policy-2, sonnet, 도구 Read/Write/Edit/Glob/Grep/Bash, 품질검수부 권장)로 교체. 이전 버전은 넣지 않음. PG 도입 현황 같은 내부 문서는 넣고 '내부용' 표시(밖으로 나가는 글에 안 씀). 자동 갱신 매일 오후 1시. 질문은 대표(대시보드·터미널)와 다른 부서 직원이 함. 지식창고 자료는 비공개 백업 저장소에 넣지 않음(집 PC는 같은 Claude 계정 Notion 연결로 직접 받음; 도구 코드만 저장소에 넣음).
- **회사 공통 규칙에 추가:** [홍카페정책부 지식창고·정책 답변 예외](검수·독립 검증 예외, 보관함/지식 쓰기 허용, 밖으로 나가는 정책 문서는 예외 아님)와 [홍카페 정책 근거](모든 부서가 지식창고 현행 문서를 근거로 문서명·버전·시행일 적기). 바꾸기 전 구성 백업: 프로그램 폴더 `.office/org-backup-2026-11-16-before-policy.json`.
- **진행(2026-11-16):** 첫 적재는 대시보드 업무 mwis0f36-2ad7dc(정책자료담당, 현행 20·실패 0, 홍멘토 84쪽 보완 파일 작성)로 했다. 직원 Bash→node→중첩 claude 경로가 동작한다. 매일 13:00 예약 등록(id 9fedd7ce06db72fb, 첫 실행 11-17). 시험 질문 mwis6132-621d37(상담후기 기한·조건)은 FAQ·약관 근거와 확인 필요를 나눠 답했다. 목록.md 문서명은 Notion 링크로 건다. 문서 속 그림(매뉴얼 캡처 등 약 150개)은 글로 옮기지 않았다(대표가 원하면 별도 업무).
- 개인정보: 공개 약관 외 문서는 휴대전화·개인 메일(gmail·naver 등)·계좌·주민번호 형식을 가린다. 첨부 원래 파일 이름에 내부 작성자 이름이 있어 `<플랫폼>_<문서명>_<버전>[_첨부n]`으로 바꿔 저장한다.

**Why:** 대표가 운영팀용으로 정책을 바로 찾아 답하는 지식창고를 원했고, Notion 내용이 첨부에만 있어 페이지 복사로는 비어 버린다.

**How to apply:** 정책 질문·정책 근거가 필요한 업무는 홍카페정책부로 넘긴다. "정책 지식 갱신해줘"는 비서실장에게 넘기거나(대시보드) 급하면 도구를 직접 실행해 결과 줄을 전한다. Notion 조회가 실패하면 `claude mcp list`에서 claude.ai Notion 연결을 먼저 본다. 지식창고 자료를 공개 저장소·비공개 백업 저장소에 올리지 않는다. [[workspace-backup-repo]] [[push-updates-immediately]]
