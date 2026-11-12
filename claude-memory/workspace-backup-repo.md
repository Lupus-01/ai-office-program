---
name: workspace-backup-repo
description: 집 PC 등 다른 PC에서 쓰려고 만든 회사 데이터 비공개 저장소(ai-office-workspace)의 위치·포함 기준·갱신 방법
metadata:
  node_type: memory
  type: project
  originSessionId: 927f2e8a-aaad-4699-a3d3-7be709ad567b
  modified: 2026-11-12T14:45:11.270Z
---

2026-11-12 대표 요청("집에 가서도 셋팅해서 사용할 수 있도록 내 GIT에 업로드")으로 만들었다.

- **프로그램 코드:** 포크 `Lupus-01/ai-office`의 `main`을 원본 최신과 같은 파일로 맞췄다(합치는 커밋 0e0b3fd, 강제 push 없음, 파일은 원본 ff97a92와 같음). 커밋 메시지에는 8780e42라고 적혔지만, 푸시 직전에 원본에 문서 커밋이 더 올라와서 실제 내용은 ff97a92다.
- **회사 데이터:** 로컬 `C:\Users\재영이\ai-office-workspace`(작업 공간과 별도 폴더, `.gitattributes`는 `* -text`) → 비공개 저장소 `Lupus-01/ai-office-workspace`. 넣는 것: `org-export.json`(설정 포함), `작업공간/org/`, `작업공간/보관함/프로필제작/양식/`, `작업공간/inputs/`, `작업공간/.office/publications/`·`video-publications.json`(게시 중복 방지 기록), `claude-memory/`(이 메모 폴더 복사본), README(집 PC 세팅 순서).
- 사용자 폴더가 `C:\Users\이재영`인 PC에서는 로컬 복사본이 `C:\Users\이재영\ai-office-workspace`다(2026-11-12 저녁에 받아 302692f까지 올림). `작업공간/org/`는 `company.md`도 함께 복사해야 회사 공통 규칙 변경이 반영된다.
- **넣지 않는 것:** 계정 정보, 실행 기록·생성 파일, 상담사 개인정보 파일(예시 14명·받은 파일·최종 워드·업로드·outputs; 연락처·주소·계좌가 있음). 포함 여부는 대표에게 물었다.
- 처음 `gh repo create … --private --push`는 auto mode 분류기가 막았다(공개 데이터 업로드로 판단). 대표 승인이나 대표의 직접 실행이 필요하다.

**Why:** 작업 공간 `보관함/`은 프로그램이 `.gitignore`(`*`)로 Git에서 빼 두었고, 포크는 공개 저장소라 회사 데이터를 둘 수 없다.

**How to apply:** "회사 데이터 저장소 갱신해줘"라고 하면 같은 목록을 다시 복사한 뒤 올리기 전에 개인정보 패턴(전화·메일·계좌)을 다시 검사하고 커밋해서 push한다. 계정 파일 이름은 명령·파일에 쓰지 않는다(훅 차단). [[windows-test-setup]] [[profile-production]]
