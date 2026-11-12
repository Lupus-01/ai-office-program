# AI Office 회사 데이터 (비공개)

대표님 AI Office의 회사 설정과 업무 자료를 다른 PC(집 PC 등)에서 그대로 쓰기 위한 **비공개** 백업입니다.
프로그램 코드는 별도 저장소에 있습니다: https://github.com/Lupus-01/ai-office (원본: https://github.com/JISANGHYEOK-0901/ai-office)

- 기준 시점: 2026-11-12, 회사 PC
- 프로그램 버전: 원본 `main` `ff97a92` (포크 `main`도 같은 파일)

## 가장 쉬운 방법

아래 "세팅 순서" 1~3까지만 직접 하고, 프로그램 폴더에서 Claude Code를 열어 이렇게 말하세요.

> ai-office-workspace 저장소 README대로 집 PC 세팅해줘

## 들어 있는 것

| 경로 | 내용 | 집 PC에서 넣는 곳 |
| --- | --- | --- |
| `org-export.json` | 부서 9개·직원 22명·회사 공통 규칙·회사 설정(업무 예산 80회·60분, 비서실장 Claude sonnet/high, 게시 간격 30초) | 회사 설정 → 가져오기 (5번) |
| `작업공간/org/` | 위와 같은 내용의 원본 파일(확인용) | 넣지 않아도 됨(5번이 대신함) |
| `작업공간/보관함/프로필제작/양식/` | 작성기준서 0.4판, 워드·PPT 틀 4개, 도구 5개, `내용-형식.json` | `~/AIOffice/보관함/프로필제작/양식/` |
| `작업공간/inputs/` | KPI 자료 | `~/AIOffice/inputs/` |
| `작업공간/.office/publications/`, `video-publications.json` | 꼬리별 관측소 글·댓글 게시 기록(같은 영상·글을 다시 올리지 않게 막는 기록) | `~/AIOffice/.office/` |
| `claude-memory/` | 터미널 Claude가 기억하던 메모(카페 규칙·올린 글 번호, 프로필제작 결정, PR 범위, 테스트 방법) | 8번 |

## 일부러 넣지 않은 것

- **계정 정보**(비밀번호·쿠키 등 서버만 쓰는 계정 파일): Git에 올리지 않습니다. 집 PC에서 계정 연결을 다시 하고 직접 로그인합니다(7번).
- **상담사 개인정보가 든 파일**(프로필 예시 14명, 받은 파일, 최종 워드, 업로드, 업무 폴더 `outputs/`): 연락처·주소·계좌가 들어 있어 이 저장소에는 넣지 않았습니다. 필요하면 USB·개인 클라우드로 옮깁니다. 프로필 작성의 예시 겹침 검사는 `보관함/프로필제작/예시/`가 있어야 하니, 집에서 프로필 업무를 하려면 예시 폴더를 함께 옮기세요.
- **실행 기록·생성 파일**(`.office/runs/` 등, `.claude/`, `.codex/`, `AGENTS.md`, `CLAUDE.md`, `scripts/`): 프로그램이 다시 만듭니다.

## 세팅 순서 (Windows 기준)

1. **설치:** Node.js 20 이상(LTS), Git, Claude Code(로그인), GitHub CLI(`gh auth login`). 선택: Codex. 프로필 업무를 하면 그림 확인용으로 아래도 설치합니다.

   ```powershell
   winget install TheDocumentFoundation.LibreOffice
   winget install oschwartz10612.Poppler
   ```

   Poppler는 사용자 PATH에 들어가므로, 설치 뒤 새 터미널에서 서버를 켜야 인식됩니다.

2. **프로그램 받기:** 회사 PC와 같게 로컬 `main`이 원본을 따라가도록 맞춥니다.

   ```bash
   git clone https://github.com/Lupus-01/ai-office.git AI-Office-App
   cd AI-Office-App
   git remote add upstream https://github.com/JISANGHYEOK-0901/ai-office.git
   git fetch upstream
   git switch -C main upstream/main
   git branch --set-upstream-to=upstream/main main
   npm ci
   npm run doctor
   ```

3. **이 저장소 받기:** 비공개라 `gh auth login`을 먼저 합니다.

   ```bash
   gh repo clone Lupus-01/ai-office-workspace
   ```

4. **첫 실행:** 프로그램 폴더에서 `npm run office:start` → http://127.0.0.1:4777 이 열리면 작업 공간 `~/AIOffice`가 만들어집니다. 확인 뒤 `npm run office:stop`으로 끕니다.

5. **회사 설정 가져오기:** 프로그램 폴더에서 실행합니다(대시보드 **회사 설정 → 가져오기**로 해도 됩니다).

   ```bash
   node scripts/office.mjs org import <이 저장소 경로>/org-export.json --yes
   ```

6. **자료 넣기(서버를 끈 상태):** Git Bash에서 실행합니다. `-n`은 이미 있는 파일을 덮어쓰지 않습니다.

   ```bash
   cd <이 저장소 경로>/작업공간
   cp -rn 보관함 inputs .office ~/AIOffice/
   cd <프로그램 폴더>
   npm run sync
   npm run office:start
   ```

7. **계정 연결:** 대시보드 → **계정 연결**에서 회사 PC와 같은 계정(네이버 "재영이 개인 네이버")을 추가하고, 로그인 창에서 **직접** 로그인합니다. 카페 공식 API를 쓰려면 같은 화면에서 다시 연결합니다.

8. **Claude 메모 옮기기:** 프로그램 폴더에서 Claude Code를 한 번 열면 `~/.claude/projects/` 아래에 프로그램 폴더 경로 이름의 폴더가 생깁니다(경로의 영문·숫자 외 글자가 `-`로 바뀐 이름, 회사 PC는 `C--Users-----Desktop-AI-Office-App`). 그 안에 `memory/` 폴더를 만들고 `claude-memory/`의 파일을 모두 넣습니다.

9. **개인 스킬(선택):** https://github.com/JISANGHYEOK-0901/personal-ai-workflow 의 `develop` 브랜치에서 `skills/execute`, `skills/pr-lifecycle`을 `~/.claude/skills/`에 복사합니다.

10. **확인:** `npm run doctor`가 통과하고, 대시보드 조직 탭에 부서 9개·직원 22명, 회사 설정에 업무 예산 80회·60분이 보이면 끝입니다.

## 다시 올리거나 가져올 때

- 회사 PC 터미널 Claude에게 "집에서 쓰게 회사 데이터 저장소 갱신해줘"라고 하면 같은 기준(개인정보·계정 정보 제외)으로 다시 복사해 올립니다.
- 집에서 바꾼 설정을 회사로 가져올 때도 같은 방식입니다: 내보내기 → 이 저장소 → 가져오기.
- 두 PC에서 동시에 설정을 바꾸면 나중에 가져온 쪽이 덮어씁니다. 한쪽에서만 바꾸세요.
- 이 저장소는 **비공개로 유지**합니다(조직 정보·카페 게시 기록).
