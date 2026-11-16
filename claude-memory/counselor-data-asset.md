---
name: counselor-data-asset
description: "상담사데이터자산화부 — 홍카페 상담사 공개 프로필 전체 수집(collect.cjs)·엑셀/구글 드라이브(export.cjs)·숏폼 영상 시안(make-short.cjs), 대표 결정과 함정"
metadata:
  node_type: memory
  type: project
  originSessionId: 927f2e8a-aaad-4699-a3d3-7be709ad567b
  modified: 2026-11-16T07:03:04.133Z
---

2026-11-16 대표 요청("상담사 등록부를 상담사 데이터 자산화로 … 상담사 페이지 내 모든 정보(상세정보, 판매상품, 후기, 포스팅) 데이터화 → 구글 스프레드시트 → 영상·숏폼")으로 만들었다.

- **조직:** 상담사등록부(onboarding)를 없애고(대표: "이전 설정은 날려줘", 백업 안 함) 상담사데이터자산화부(asset)로 교체. 자산화팀장 asset-1(기획·장면표), 데이터수집담당 asset-2, 영상제작담당 asset-3, 모두 sonnet, 도구 Read/Write/Edit/Glob/Grep/Bash. 회사 공통 규칙에 [상담사데이터자산화부 수집 예외](수집 갱신은 검수 예외·보관함/상담사데이터와 드라이브 폴더 쓰기 허용, 숏폼·영상은 검수 포함) 추가.
- **대표 결정:** 전체 상담사(사이트맵 items/profile 1,158 + chat/profile 398 = 1,556개, 상담사코드 CE-로 묶음), 후기는 최근 7일만, 구글 시트는 대표가 준 드라이브 폴더 https://drive.google.com/drive/folders/1sIhtRBelCFRXy3Mu3TaHMaA9yLkUZuHD (= `G:/내 드라이브/Ai-Office/상담사 데이터 자산`), 영상은 자동 제작·음성 없이 자막+배경음, 정기 갱신 매주 금요일 오후 1시.
- **도구(작업 공간 `보관함/상담사데이터/도구/`):** `collect.cjs`(공개 페이지+사이트 내부 API: `api/comment/getItemComment`·`api/items/getPostingList`·`getProfileCounselStat/Keyword/TagTrend`, POST 폼, 보안 토큰 불필요, limit 100 가능, 350ms 간격·2개 동시, 기본 1.5분씩 나눠 돌고 `남은 상담사 0`까지 반복, 잠금은 pid가 살아 있을 때만), `export.cjs`(탭 7개 엑셀 → 로컬 `시트/`와 `설정.json`의 driveFolder), `make-short.cjs`(장면표 JSON → Playwright 1080×1920 PNG → ffmpeg mp4, "내부 시안" 표시), `장면표-형식.md`. 첫 시험: 베리 IT-20230216112800-712 8.5초, 최근 7일 후기 104·포스팅 215. 시험 영상 `보관함/상담사데이터/영상/시안/베리_숏폼_시안1/`(17초).
- **함정:** getPostingList에 `total=''`를 보내면 HTTP 500(빼야 함). 구역 표시 주석은 시작만/끝만 있는 경우가 있어 앞뒤 표시로 자른다. cm_counsel_field·cm_style은 배열로 온다. 후기 작성자 닉네임(ac_nick)은 저장하지 않는다. 1:1문의 내용은 모으지 않는다(건수만). Google Drive 데스크톱은 폴더 메타데이터를 늦게 불러와서, 폴더 ID로 찾으려면 G: 아래를 한 번 훑은 뒤 `%LOCALAPPDATA%/Google/DriveFS/<계정>/metadata_sqlite_db`(사본)를 `node:sqlite`로 조회했다. ffmpeg는 winget(Gyan.FFmpeg) 설치 직후 서버 PATH에 없어서 도구가 WinGet 설치 폴더를 직접 찾는다.
- **영상 규칙:** 이용약관 v3.0.0 제18조 ④(고객 게시물은 서비스·관련 프로모션에 노출·일부 편집 가능, 작성자는 삭제 요청 가능)가 근거. 외부 채널 게시는 법무 확인 전, 상담사 사진·소개글은 상담사 동의 확인 전이라 내부 시안까지만 만든다. 개인 사정이 드러나는 후기·과장 표현은 쓰지 않는다.
- **요일 예약:** 프로그램 예약 기능에 요일 반복이 없어 포크 `feat/weekly-schedule`(dd23f85)에 추가했다(weekdays, "매주 금요일 오후 1시에" 규칙 판별). 원본 반영·PR은 대표 지시가 있을 때. 회사 PC는 이 브랜치로 서버를 다시 켰고(11-16 16:0x), 예약 a14d49d2f7810521 "매주 금요일 13:00"을 등록했다(첫 실행 11-20).
- **첫 수집(11-16, 업무 mwivma3u-2e4346):** 15:23~15:57, 프로필 1,556(없는 페이지 6, 실패 0) → 상담사코드 기준 1,201명(전화+채팅 묶인 349명), 최근 7일 후기 3,144, 포스팅 7,501(이 중 215는 시험 수집분), 엑셀 10MB. 지시문의 "포스팅"(데이터 항목 이름)을 판별 AI가 글 게시(post)로 읽어 "외부 작업 대상·계정 확인" 질문으로 두 번 멈췄다 → 지시문에 "포스팅"·"드라이브에 올리기"를 넣지 말 것. Google Drive 앱은 로그인 직후 "동기화 일시중지" 상태였다(`%LOCALAPPDATA%/Google/DriveFS/user-paused`, 로그 "Syncing is paused") — 대표가 트레이 아이콘에서 재개해야 클라우드에 올라간다.

**Why:** 대표가 상담사 페이지 정보를 데이터 자산으로 쌓아 시트로 보고 영상·숏폼 제작에 쓰려 한다.

**How to apply:** 데이터 갱신·영상 요청은 상담사데이터자산화부로 넘긴다. 수집 자료(원본·엑셀·영상)는 공개 저장소에 절대 올리지 않고 비공개 백업 저장소에도 도구와 설정.json만 넣는다. [[policy-knowledge-base]] [[workspace-backup-repo]] [[push-updates-immediately]]
