# 대장급 AI 모델 동향 (확인일 2026-11-25, 조사 기간 2026-11-18 ~ 11-25)

확인한 범위에서의 정리입니다. 날짜·수치는 이번에 직접 연 공식 변경 기록·뉴스 목록에서만 가져왔고, 발표 시각은 공식 페이지에 없어 날짜만 적습니다. 직전 보고: outputs/2026-11-24/run-mwu1rnmi-7f833e/aitrend/aitrend-2-ai-model-updates.md

## 한눈에 보기
- 최근 24시간(11-24~11-25): 신규 모델 출시는 확인한 범위에서 없음. OpenAI API "Healthcare model configurations"(11-24)와 OpenAI 연구 글 2건(11-24)이 신규.
- 기간(11-18~11-25) 모델 출시: Google Gemini 4 Neon(11-18) 1건. GPT-6.2(11-17)는 기간 하루 전이라 변동 없음으로만 표시.
- 3사 모두 직접 확인함.

## 1. OpenAI (GPT)
### 1-1. "Healthcare model configurations in the OpenAI API" — 신규 (2026-11-24)
- 내용(OpenAI 모델 릴리스 노트): Astra·Sol 같은 모델을 의료용으로 맞춘 구성. 웹 검색을 켜면 전용 의료 색인에서 의학 근거를 찾아 출처와 함께 비교·요약. Responses API로 API 조직에 제공, ChatGPT for Healthcare 워크스페이스 불필요. "전문 의료 판단을 대체하지 않는다"고 명시.
- 수치: 가격·벤치마크 미표기 → 미확인.
- 출처: https://help.openai.com/en/articles/9624314-model-release-notes (확인일 11-25)
### 1-2. GPT-6.2 Astra / Sol — 변동 없음 (2026-11-17, 기간 밖)
- `gpt-6.2-astra`는 고난도 추론·코딩, `gpt-6.2-sol`은 속도·저비용 다단계 작업용. 둘 다 이전 세대보다 출력 토큰이 적다고 회사 노트에 기재. 텍스트·이미지 입력, 텍스트 출력.
- 가격·벤치마크: 이번 릴리스 노트에 없음 → 미확인. (직전 보고 인용, 이번 미재확인: Astra 입력 $8/출력 $40, Sol $2/$10, 100만 토큰당 — 회사 공지 인용.) 이전 모델 대비 개선 폭 수치 미확인.
- 출처: 위 릴리스 노트 주소
### 1-3. 소항목 (OpenAI 뉴스 목록, 제목·날짜만 확인, 본문 미열람)
- 11-24 "GPT-6 models demonstrate intrinsic protein-design capabilities"(Science), 11-24 "Searching for distant planets with Astra"(Science) — 신규, 내용 미확인.
- 11-23 "OpenAI and Cisco introduce Shirudo"(Security) — 변동 없음(직전 보고에 있음), 내용 미확인.
- 출처: https://openai.com/news/

## 2. Google (Gemini)
### 2-1. Gemini 4 Neon (`gemini-4-neon`) GA — 변동 없음 (2026-11-18)
- 가격(Google 공식 변경 기록): 입력 $3.00 / 출력 $15.00 (100만 토큰당), 유료 등급 전용. 같은 날 다중모달 파일 처리·슬라이싱 추가(모델명·가격 미표기).
- 벤치마크(직전 보고 인용, 이번 미재확인, Google 블로그 회사 발표): Artificial Analysis Intelligence Index 61점·3위(xhigh, Google이 인용한 제3자 지표), Terminal-Bench 4.1 65.2%, 작업당 비용 Carbon 대비 32% 낮음. 이전 모델 대비 개선 폭은 이번 미확인.
- 출처: 「Release notes - Gemini API | Google AI Studio」 https://aistudio.google.com/docs/changelog
### 2-2. 소항목 — 변동 없음
- 11-19 Genie 4(`genie-4`) GA: 입력 $1.50, 텍스트 출력 $9.00, 영상 출력 $17.50(100만 토큰당, 약 $0.10/초).
- 11-19 도구 검색(Preview): Gemini 3.6 이후 모델 지원, 가격 미표기.
- 11-17 `gemini-3.5-transcribe`(·live) 음성 편집(기간 밖).
- 변경 기록의 가장 최근 항목은 11-19, 11-20~11-25 새 항목 없음.

## 3. Anthropic (Claude)
- **해당 기간 새 모델 발표 없음.** 가장 최근 모델 발표: 2026-11-09 Claude Fable 5.2·Mythos 5.2(Platform 릴리스 노트: 입력 $8 / 출력 $40 per MTok, Fable 5.2 fast mode $16/$80 — 이번 직접 확인, 기간 밖).
- 11-23 Claude Opus 4.5 폐지 예고(API 종료 2027-01-22, Opus 5.5 이전 권장) — 변동 없음.
- 11-23 Enterprise Frontier Safeguards 베타(제로 데이터 보관, 고객 클라우드에 암호화 사본 저장) — 변동 없음.
- 11-20 Enterprise Analytics API 세션 집계 규칙 변경 — 신규(소항목, 가격·성능 무관).
- 뉴스 목록(제목·날짜만): 11-18 "Anthropic prices initial public offering", 11-20 "Anthropic announces closing of initial public offering, including full exercise of underwriters' option"(제목 일부 생략). 목록에 "November 25, 2026" 라벨이 있으나 제목이 표시되지 않아 미확인.
- 출처: "Claude Platform release notes - Claude Platform Docs" https://platform.claude.com/docs/en/release-notes/overview (앞 100,000자만 열람), "Newsroom \ Anthropic" https://www.anthropic.com/news

## 4. 그 밖의 회사
- xAI·Meta·DeepSeek: 이번에 열람하지 않음 → 미확인(직전 보고: DeepSeek 11-17 이후 항목 없음, xAI 신규 모델 없음).

## 5. 우리 서비스 적용 아이디어 (제안, 팀장 판단용)
- 해당 약함. Gemini API 도구 검색(11-19)은 AI Office의 다수 도구 호출 자동화에 검토 가능(근거: Gemini API 변경 기록).

## 6. 확인하지 못한 부분
- Claude 릴리스 노트 뒤 54,054자 미열람, OpenAI 뉴스 목록 일부 미확장, Gemini 4 Neon·GPT-6.2 벤치마크 이번 미재확인.
