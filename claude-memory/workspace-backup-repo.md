---
name: workspace-backup-repo
description: 집 PC 등 다른 PC에서 쓰려고 만든 회사 데이터 비공개 저장소(ai-office-workspace)의 위치·포함 기준·갱신 방법
metadata:
  node_type: memory
  type: project
  originSessionId: 927f2e8a-aaad-4699-a3d3-7be709ad567b
  modified: 2026-11-16T01:04:30.176Z
---

2026-11-12 대표 요청("집에 가서도 셋팅해서 사용할 수 있도록 내 GIT에 업로드")으로 만들었다.

- **프로그램 코드:** 포크 `Lupus-01/ai-office`의 `main`을 원본 최신과 같은 파일로 맞췄다(합치는 커밋 0e0b3fd, 강제 push 없음, 파일은 원본 ff97a92와 같음). 커밋 메시지에는 8780e42라고 적혔지만, 푸시 직전에 원본에 문서 커밋이 더 올라와서 실제 내용은 ff97a92다.
- **회사 데이터:** 로컬 `C:\Users\재영이\ai-office-workspace`(작업 공간과 별도 폴더, `.gitattributes`는 `* -text`) → 비공개 저장소 `Lupus-01/ai-office-workspace`. 넣는 것: `org-export.json`(설정 포함), `작업공간/org/`, `작업공간/보관함/프로필제작/양식/`, `작업공간/inputs/`, `작업공간/.office/publications/`·`video-publications.json`(게시 중복 방지 기록), `claude-memory/`(이 메모 폴더 복사본), README(집 PC 세팅 순서).
- 사용자 폴더가 `C:\Users\이재영`인 PC에서는 로컬 복사본이 `C:\Users\이재영\ai-office-workspace`다(2026-11-12 저녁에 받아 302692f까지 올림). `작업공간/org/`는 `company.md`도 함께 복사해야 회사 공통 규칙 변경이 반영된다.
- **넣지 않는 것:** 계정 정보, 실행 기록·생성 파일, 상담사 개인정보 파일(예시 14명·받은 파일·최종 워드·업로드·outputs; 연락처·주소·계좌가 있음). 대표가 `보관함/` 자료(프로필제작·초기화-백업·최종산출물·업로드·계정 파일)를 따로 압축해 보관한다(2026-11-12, 작업 공간 전체 압축은 아님). 그래서 저장소에는 넣지 않는다.
- 처음 `gh repo create … --private --push`는 auto mode 분류기가 막았다(공개 데이터 업로드로 판단). 대표가 같은 명령을 직접 지시해서 올렸다(2026-11-12, PRIVATE 확인). 계정 파일은 대표가 따로 보관해 옮긴다("env파일 자체는 내가 따로 보관하고 있으니깐 걱정안해도").
- **회사 PC(`C:\Users\재영이`, DESKTOP-8GNOE99) 첫 동기화(2026-11-16):** sync.mjs의 `fs.cpSync`가 이 PC의 한글 경로에서 폴더를 복사하다 exit 127로 꺼졌다([[windows-test-setup]]). 그래서 직접 복사하는 `copyTree`로 바꿨다(f6a7285). 그 뒤 `node sync.mjs --program "C:\Users\재영이\Desktop\AI-Office-App"`로 회사 설정 10부서·24명, 예약 2건, 메모 5개, AI 업무 폴더 6건을 가져왔다. 프로그램 위치는 main 50e7c1b로 기록했다. `--check`만 돌리면 `--program`이 저장되지 않으니 실제 실행에도 다시 붙인다.

**Why:** 작업 공간 `보관함/`은 프로그램이 `.gitignore`(`*`)로 Git에서 빼 두었고, 포크는 공개 저장소라 회사 데이터를 둘 수 없다.

**설정 동기화(2026-11-13 추가):** 대표가 "설정 동기화해줘"라고 하면 로컬 복사본 폴더에서 `node sync.mjs`(처음 한 번은 `--program <프로그램 폴더>`)를 실행하고 결과 줄을 그대로 전한다. 복사본이 없으면 `gh repo clone Lupus-01/ai-office-workspace`로 먼저 받는다. 회사 설정·예약·메모·AI트렌드부/AI평가부 업무 폴더를 비교해 최신 쪽으로 맞추고, 덮어쓰기 전 내용은 `.sync-backups/`에 남긴다. 먼저 `--check`로 방향을 보여 주고 싶으면 그렇게 한다. 대표는 두 PC를 동시에 켜지 않는다고 했다. 프로필 양식·inputs·게시 기록은 이 도구가 다루지 않으므로 아래 수동 갱신을 쓴다.

**How to apply:** "회사 데이터 저장소 갱신해줘"라고 하면 같은 목록을 다시 복사한 뒤 올리기 전에 개인정보 패턴(전화·메일·계좌)을 다시 검사하고 커밋해서 push한다. 계정 파일 이름은 명령·파일에 쓰지 않는다(훅 차단). [[windows-test-setup]] [[profile-production]]
