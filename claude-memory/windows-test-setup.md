---
name: windows-test-setup
description: AI-Office-App 전체 테스트를 이 PC에서 제대로 돌리는 방법과 저장소 원격 구성
metadata:
  node_type: memory
  type: project
  originSessionId: 2a2463aa-16e8-460b-9040-ea1aaf0b48fd
  modified: 2026-11-17T04:46:08.784Z
---

이 PC(Windows, Node 24.14, 사용자 경로에 한글)에서는 `fs.cpSync`가 한글 경로에서 프로세스째 종료(exit 127)되어 `npm run check`의 chief-guard·session-context·workspace 테스트 파일이 실행되지 못한다. 프로그램 코드는 cpSync를 쓰지 않아 실행에는 영향이 없다.

**Why:** 실제 폴더에서 돌리면 안전장치 테스트가 통째로 빠진 채 "실패 7건"으로만 보인다.

**How to apply:** 전체 검증은 `git archive HEAD`를 영문 경로(예: `C:\Temp\aioffice-verify`)에 풀고 `npm ci` 후 TEMP·TMP도 그 복사본 **바깥의** 영문 폴더로 지정해 실행한다(복사본 안에 두면 "작업 공간이 프로그램 폴더 안" 오류가 대량으로 난다). 커밋 714ecae 기준 정상 결과는 514개 중 504 통과, 6 건너뜀, 실패 4건(심볼릭 링크 EPERM 1건, Windows Codex 인자 따옴표 기대값 3건). 테스트 수는 업데이트마다 늘 수 있으니 실패 목록이 같은지로 판단한다.

저장소 원격: `origin`은 대표의 포크(Lupus-01/ai-office), `upstream`이 원본(JISANGHYEOK-0901/ai-office)이다. "GitHub 최신으로 업데이트"는 upstream 기준으로 확인해야 하며, origin만 보면 이미 최신으로 보일 수 있다. 2026-11-09 원본 개발자의 초대를 수락해 대표 계정(Lupus-01)에 원본 쓰기 권한이 있다. 원본 흐름은 브랜치 push → PR → 개발자가 머지(merge commit)다. 같은 날 로컬 `main`을 upstream/main(f8d28cc)으로 맞추고 추적 대상을 upstream으로 바꿨다. 이전 포크 main은 로컬 `backup/fork-main-54b215e`이고, 포크 GitHub main은 원본과 이력이 갈라진 채 남아 있다. 회사 설정(작업 공간 `org/`)은 레포 밖이라 git 업데이트가 건드리지 않는다. 업데이트 전 백업은 `.office/backup-<날짜>-before-update/`에 둔다. 11-09 기준 전체 검사는 562개 중 552 통과, 실패 4(같은 환경 실패)였다.

2026-11-10 로그인 확인 개선(커밋 a8d2944: 업무 시작 실제 로그인 확인·대기 30분·바뀐 창 등록)은 대표 결정("일단 내 깃에만")으로 포크의 `fix/preflight-login` 브랜치에만 올렸다. 원본과 포크 `main`에는 넣지 않았고, 포크 CI는 10개 모두 통과했다. 2026-11-12에는 그 위에 `feat/chief-upload`(f346d7a: 지시창 파일 올리기, 계획용 문서 미리보기, 결과 파일 바로 받기)를 쌓아 같은 방식으로 포크에만 올렸다. 같은 날 원본 개발자의 요청("스킬셋 업데이트로 진행한거 올리라고")으로 두 커밋을 원본 `main`에 fast-forward로 바로 올렸다(6837b47..833d6ae). 이때 테스트에 있던 실제 상담사 예명을 가상 예명 '가상별'로 바꿔 커밋을 다시 만들었고(f346d7a → 833d6ae), 그래서 포크의 `feat/chief-upload`(f346d7a)는 원본과 SHA가 다르다. 로컬 작업 폴더는 이제 `main`(upstream 추적)이고, 원본을 받아도 두 개선은 빠지지 않는다. 공개 저장소에 올릴 때는 테스트 자료에 실제 고객·상담사 이름이 없는지 먼저 확인한다. 같은 날 원본 최신(8780e42, Aside 브라우저 직원 엔진·가이드 탭)으로 fast-forward했다. 백업은 `.office/backup-2026-11-12-before-update/`(org 복사본·sha256·org-export)이고, 업데이트 뒤 sha256과 export가 같았다. 순서: 실행 중 업무 확인 → 백업 → `office:stop` → `git merge --ff-only upstream/main` → package-lock 바뀌면 `npm ci` → `npm run sync -- --check`/`npm run sync` → 새 PATH로 `office:start` → 설정 대조·doctor.

PR: `gh` 2.103.3을 2026-11-05에 설치했다(`C:\Program Files\GitHub CLI\gh.exe`). 설치 전에 시작한 세션은 PATH에 없어 전체 경로로 부른다. 쓰기 전에 `gh auth status`를 확인하고, 로그인이 안 되어 있으면 대표에게 `gh auth login`을 요청한다. 로그인할 수 없을 때는 대표가 눌러 만드는 compare 링크(`quick_pull=1`)를 쓴다. 영문 경로의 `git worktree`를 쓰면 서버가 쓰는 프로그램 폴더를 건드리지 않고 최신 원본 기준으로 전체 검사까지 할 수 있다.

**2026-11-17 배포 전 점검:** 원본 057ea0c를 포크 main에 merge하고 결함 수정(재발송 판별·요일 예약·내려받기)을 더해 포크 main c996888로 fast-forward push, 회사 PC 로컬 main·서버도 갱신했다(백업 `.office/backup-2026-11-17-before-update/`, org·예약 그대로 확인). 이때 기준 전체 검사는 613개 중 604 통과, 5 건너뜀, 실패 4(같은 환경 실패). 영문 경로 worktree(`C:\Temp\aioffice-release`)로 검증했다. 포크의 공개 브랜치 `feat/chief-upload`(f346d7a)에는 실제 상담사 예명이 테스트에 남아 있어(원본 반영본 833d6ae는 가상 예명) 삭제를 대표에게 물었다.

**2026-11-16 로컬 추적 대상 변경:** 대표가 집 PC에서 상담사 분석 메일용 코드(`browser_download`·메일 서식·`browser_collect`·외부 작업 질문 전달)를 포크 `main`에 합쳤다(50e7c1b, 원본에는 없음). 그래서 회사 PC 로컬 `main`을 origin/main으로 fast-forward하고 추적 대상도 `origin/main`으로 바꿨다. 원본 새 커밋은 `git fetch upstream` 뒤 합쳐야 한다(포크 main이 원본보다 앞서 있어 fast-forward가 안 됨). 포크 CI의 macOS 3개는 GitHub 실행기 부족("not acquired by Runner")으로 시작하지 못해 실패로 보였다. Windows·Ubuntu 6개와 browser는 통과했다.
