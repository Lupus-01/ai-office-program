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
| `org-export.json` | 부서 10개·직원 24명(2026-11-12 AI트렌드부 추가, 운영지원부를 AI평가부로 전환)·회사 공통 규칙(AI트렌드부 일일 브리핑·AI평가부 자체 평가의 검수 예외, 개선 노트 참고 규칙 포함)·회사 설정(업무 예산 80회·60분, 비서실장 Claude sonnet/high, 게시 간격 30초) | 회사 설정 → 가져오기 (5번) |
| `작업공간/org/` | 위와 같은 내용의 원본 파일(확인용) | 넣지 않아도 됨(5번이 대신함) |
| `작업공간/보관함/프로필제작/양식/` | 작성기준서 0.4판, 워드·PPT 틀 4개, 도구 5개, `내용-형식.json` | `~/AIOffice/보관함/프로필제작/양식/` |
| `작업공간/inputs/` | KPI 자료 | `~/AIOffice/inputs/` |
| `작업공간/.office/publications/`, `video-publications.json` | 꼬리별 관측소 글·댓글 게시 기록(같은 영상·글을 다시 올리지 않게 막는 기록) | `~/AIOffice/.office/` |
| `claude-memory/` | 터미널 Claude가 기억하던 메모(카페 규칙·올린 글 번호, 프로필제작 결정, PR 범위, 테스트 방법) | 8번 |
| `작업공간/.office/schedules.json` | 예약 2건(매일 오전 11시 AI 브리핑, 매일 낮 12시 AI 자체 평가) | `~/AIOffice/.office/schedules.json` (서버를 끈 상태에서 덮어씀) |
| `작업공간/outputs/2026-11-12/` | AI 브리핑 5건과 AI 자체 평가 1건의 업무 폴더. 지난 브리핑·개선 노트를 다음 업무가 찾아 읽는다(상담사 개인정보 없음) | `~/AIOffice/outputs/2026-11-12/` |
| `claude-settings/statusline-command.sh` | Claude Code 상태바 스크립트 | `~/.claude/statusline-command.sh` |

## 일부러 넣지 않은 것

- **계정 정보**(비밀번호·쿠키 등 서버만 쓰는 계정 파일): Git에 올리지 않습니다. 집 PC에서 계정 연결을 다시 하고 직접 로그인합니다(7번).
- **상담사 개인정보가 든 파일**(프로필 예시 14명, 받은 파일, 최종 워드, 업로드, 업무 폴더 `outputs/` 중 상담사 관련 업무): 연락처·주소·계좌가 들어 있어 이 저장소에는 넣지 않았습니다. 필요하면 USB·개인 클라우드로 옮깁니다. 프로필 작성의 예시 겹침 검사는 `보관함/프로필제작/예시/`가 있어야 하니, 집에서 프로필 업무를 하려면 예시 폴더를 함께 옮기세요.
- **실행 기록·생성 파일**(`.office/runs/` 등, `.claude/`, `.codex/`, `AGENTS.md`, `CLAUDE.md`, `scripts/`): 프로그램이 다시 만듭니다.

## 대표님 압축본 (보관함 자료)

대표님은 작업 공간 `보관함/`의 자료를 따로 압축해 보관하고 있습니다: `프로필제작`(양식·예시·받은 파일), `초기화-백업`, `최종산출물`, `업로드`, 계정 파일.
이 저장소와 압축본을 합치면 일하는 데 필요한 것은 모두 있습니다. 옮겨지지 않는 것은 대시보드의 지난 업무 목록·실행 기록과 업무 폴더 `outputs/`뿐입니다(2026-11-12 기준 업무 15건 모두 완료·닫힘, 예약 업무 없음).

**예약 업무(2026-11-12 저녁 추가):** 예약 2건은 `작업공간/.office/schedules.json`에 들어 있습니다. 아래 "설정 동기화"를 하면 그대로 실행됩니다. 두 PC를 같은 시각에 켜 두면 두 번씩 실행되니 한쪽에서는 대시보드 예약 탭에서 꺼 두세요.

아래 6번에서 압축본을 함께 넣습니다.

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

6. **자료 넣기(서버를 끈 상태):**
   1. 대표님 압축본을 `~/AIOffice/보관함/` 안에 풉니다. 그러면 `보관함/프로필제작`, `보관함/최종산출물`처럼 됩니다. 계정 파일도 `보관함/` 바로 아래에 둡니다. 한글 폴더 이름이 깨지지 않았는지 확인합니다.
   2. 이 저장소의 자료를 넣습니다(Git Bash). 프로필 양식은 이 저장소가 최신(기준서 0.4판)이라 덮어씁니다.

   ```bash
   cd <이 저장소 경로>/작업공간
   cp -r 보관함/프로필제작/양식 ~/AIOffice/보관함/프로필제작/
   cp -rn inputs .office ~/AIOffice/
   cd <프로그램 폴더>
   npm run sync
   npm run office:start
   ```

7. **계정 연결:** 계정 파일은 6번에서 `보관함/`에 넣었습니다. 브라우저 로그인 상태는 회사 PC에만 남아 있으므로, 대시보드 → **계정 연결**에서 네이버 "재영이 개인 네이버"를 확인하고(없으면 추가) 로그인 창에서 **직접** 다시 로그인합니다. 카페 공식 API를 쓰려면 같은 화면에서 다시 연결합니다.

8. **Claude 메모 옮기기:** 프로그램 폴더에서 Claude Code를 한 번 열면 `~/.claude/projects/` 아래에 프로그램 폴더 경로 이름의 폴더가 생깁니다(경로의 영문·숫자 외 글자가 `-`로 바뀐 이름, 회사 PC는 `C--Users-----Desktop-AI-Office-App`). 그 안에 `memory/` 폴더를 만들고 `claude-memory/`의 파일을 모두 넣습니다.

9. **개인 스킬(선택):** https://github.com/JISANGHYEOK-0901/personal-ai-workflow 의 `develop` 브랜치에서 `skills/execute`, `skills/pr-lifecycle`, `skills/handoff`를 `~/.claude/skills/`에 복사합니다.

10. **확인:** `npm run doctor`가 통과하고, 대시보드 조직 탭에 부서 10개·직원 24명, 회사 설정에 업무 예산 80회·60분이 보이면 끝입니다.

## 설정 동기화 (두 PC를 같은 설정으로 맞추기)

`sync.mjs`가 이 PC의 설정과 이 저장소(Git)의 설정을 비교해 **더 최신인 쪽으로** 맞춥니다. 출근·퇴근할 때 한 번씩 돌리면 두 PC가 같은 설정을 씁니다.

프로그램 폴더에서 Claude Code를 열고 이렇게 말하면 됩니다.

> 설정 동기화해줘

직접 실행할 때(이 저장소 폴더에서):

```bash
node sync.mjs --program <AI Office 프로그램 폴더>   # 처음 한 번. 다음부터는 node sync.mjs
node sync.mjs --check                              # 비교만 하고 바꾸지 않음
node sync.mjs --pull                               # 무조건 Git → 이 PC
node sync.mjs --push                               # 무조건 이 PC → Git
```

회사 PC에 이 저장소가 아직 없으면 먼저 `gh repo clone Lupus-01/ai-office-workspace`로 받습니다.

| 맞추는 것 | 최신을 정하는 기준 | 가져올 때 |
| --- | --- | --- |
| 회사 설정(부서·직원·회사 공통 규칙·회사 설정) | 이 PC에서 설정이 바뀐 시각 vs Git에 올린 시각 | 가져오기 전 설정을 백업하고 덮어씀 |
| 예약 | 지난 동기화 이후 어느 쪽이 바뀌었는지. 처음이거나 양쪽이 다 바뀌었으면 이 PC에서 가장 최근에 등록한 시각 vs Git에 올린 시각 | 서버를 잠깐 껐다 켬. 진행 중인 업무가 있으면 예약은 보류 |
| Claude 메모(`claude-memory/`) | 파일별 수정 시각 vs Git에 올린 시각 | 파일별로 덮어씀 |
| AI트렌드부·AI평가부 업무 폴더(`outputs/`) | 없는 폴더만 서로 채움(덮어쓰지 않음) | 연락처·메일·계좌로 보이는 내용이 있으면 올리지 않음 |
| 프로그램 코드 위치(`program.json`) | 올린 PC가 쓰는 브랜치·커밋. 다른 PC의 코드가 그보다 오래됐으면 알려 줌 | 코드는 자동으로 바꾸지 않고 맞추는 명령을 보여 줌 |

- **프로그램 코드(2026-11-13):** 엑셀 내려받기(`browser_download`)와 메일 본문 서식은 포크(`Lupus-01/ai-office`)의 `main`과 `feat/site-download` 브랜치에 있습니다(2026-11-14 포크 `main`에 합침. 여러 탭 한 번에 읽기 `browser_collect`와 외부 작업 질문 전달 수정도 포함. 원본 `main`에는 아직 없음). 회사 PC에서 처음 맞출 때: 프로그램 폴더에서 `npm run office:stop` → `git fetch origin` → `git switch feat/site-download` → `npm ci` → `npm run office:start`. 상담사 분석 메일 업무는 이 코드가 있어야 엑셀에서 메일 주소를 읽고 서식 있는 메일을 보냅니다.
- 덮어쓰기 전의 내용은 이 저장소 폴더의 `.sync-backups/`에 남습니다(Git에는 올리지 않음).
- 두 PC에서 **둘 다** 설정을 바꾼 뒤 동기화하면 더 나중 것이 이기고, 진 쪽 변경은 백업에만 남습니다. 자리를 옮기기 전에 한 번 동기화하면 이런 일이 없습니다.
- 예약 문구만 고친 경우처럼 시각이 남지 않는 변경은 방향을 잘못 고를 수 있습니다. 결과가 예상과 다르면 `--push`나 `--pull`로 방향을 정합니다.
- 계정 정보와 상담사 관련 파일은 동기화하지 않습니다.
- 상태바(선택, 처음 한 번): `claude-settings/statusline-command.sh`를 `~/.claude/`에 복사하고 `~/.claude/settings.json` 최상위에 `"statusLine": { "type": "command", "command": "sh ~/.claude/statusline-command.sh" }`를 추가합니다. `jq`가 필요합니다(`winget install jqlang.jq`, 설치 뒤 Claude Code 재시작).

## 다시 올리거나 가져올 때

- 회사 PC 터미널 Claude에게 "집에서 쓰게 회사 데이터 저장소 갱신해줘"라고 하면 같은 기준(개인정보·계정 정보 제외)으로 다시 복사해 올립니다.
- 집에서 바꾼 설정을 회사로 가져올 때도 같은 방식입니다: 내보내기 → 이 저장소 → 가져오기.
- 두 PC에서 동시에 설정을 바꾸면 나중에 가져온 쪽이 덮어씁니다. 한쪽에서만 바꾸세요.
- 이 저장소는 **비공개로 유지**합니다(조직 정보·카페 게시 기록).
