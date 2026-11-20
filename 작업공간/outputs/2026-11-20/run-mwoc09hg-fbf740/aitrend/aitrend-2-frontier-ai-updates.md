# 대장급 AI 모델 특이사항 (확인일 2026-11-20, 조사 기간: 최근 24시간 우선 → 없으면 최근 7일 = 2026-11-13 ~ 11-20 KST)

확인한 범위에서의 정리입니다. 수치는 직접 연 페이지에서만 적었고, 측정 주체는 항목마다 표시했습니다. 발표 시각(KST)은 공식 페이지에 없어 날짜만 적습니다.
직전 보고: outputs/2026-11-19/run-mwmwkesq-9cf7fd/aitrend/aitrend-2-ai-model-updates.md (비교해 신규/변동 없음 표시)

## 한눈에 보기
- 최근 24시간(11-19 ~ 11-20): 대형 모델 신규 출시는 확인한 범위에서 없음. 소항목 1건(OpenAI GPT-Live-1.1, 11-19).
- 최근 7일: 모델 출시 2건(OpenAI GPT-6.2, Google Gemini 4 Neon) + 기능·API 소항목. 모두 직전 보고에 있던 항목이며 이번에 공식 페이지로 다시 확인했습니다.
- 건수: 같은 사건 묶음 기준 7일 내 모델 출시 2건, 24시간 내 0건(소항목 1건). 부족 사유는 맨 아래.

## 1. OpenAI (GPT)

### 1-1. GPT-6.2 Astra / Sol — 변동 없음 (발표 2026-11-17, 7일 내)
- 발표 제목(원문): API 변경 기록 11-17 항목 `gpt-6.2-astra`, `gpt-6.2-sol` (커뮤니티 공지 제목은 "GPT-6.2 Astra and Sol are now available", 직전 보고 인용)
- 내용(이번 확인, OpenAI 공식 API 변경 기록): Astra는 고난도 추론·코딩, Sol은 일상 코딩·에이전트 워크플로용. Responses API·Chat Completions 지원, 도구 호출은 Responses API 필요. 추론 보존·`instructions` 처리 방식이 바뀜(마이그레이션 가이드 링크 있음).
- 수치: 변경 기록 페이지에는 벤치마크·가격이 없음. 직전 보고(커뮤니티 공지 인용, 이번 재열람 안 함, 회사 발표): Astra 작업당 비용 GPT-6 Astra의 1/3 미만, 가격 Astra 입력 $8/출력 $40, Sol $2/$10(100만 토큰당). 제3자(Artificial Analysis 지수, 2차 인용·미재확인): Astra 62, Sol 57.
- 출처: https://developers.openai.com/api/docs/changelog (이번 직접 열람)
- 한 줄 요약: OpenAI가 상위 Astra와 실무용 Sol로 GPT-6.2 세대를 API에 내놓았다.

### 1-2. 신기능·API 소항목 (OpenAI API 변경 기록, 이번 직접 열람)
- 2026-11-19 **[신규, 24시간 내 가능성·시각 미확인]** `gpt-live-1.1` (v1/live/sessions): 다국어 음성 대화에서 발음·억양 일관성·받아쓰기 개선(수치 미제공). GPT-Live-1·1.1 WebRTC 세션에 대기(standby) 모드 추가 — 무음 구간 추론을 멈추고 말하면 재개.
- 2026-11-17 Responses API 공개 베타: gpt-6.2-astra·gpt-6.2-sol·gpt-6.1-terra·gpt-6-luna에서 백그라운드 완료 2시간/8시간 창 — 표준 대비 토큰 요금 30%/40% 낮음. 변동 없음.
- 2026-11-16 `omni-moderation-csam-latest`: 승인 조직 무료. 변동 없음.

## 2. Google (Gemini)

### 2-1. "Introducing Gemini 4 Neon" — 변동 없음 (발표 2026-11-18, 7일 내)
- 가격(Google 공식): 100만 토큰당 입력 $3 / 캐시 입력 $0.15 / 출력 $15, 컨텍스트 1M 토큰.
- 벤치마크(전부 Google이 블로그에 적은 값. Artificial Analysis·Vals·Arena 등은 Google이 인용한 제3자 지표이며 원 페이지는 직접 열지 않음):
  - Artificial Analysis Intelligence Index 61점, 전체 3위 (xhigh 추론 설정)
  - Terminal-Bench 4.1 65.2%, FrontierCode 2.0 46.2% (기본 high 설정, 비교 모델 수치는 본문에 없음)
  - Terminal-Bench Science 70.5%, HLE-Diamond 71.3%, Zapier AutomationBench 56.3% (Google 표기 1위)
  - 비용: 기본 high에서 Gemini 4 Carbon 대비 작업당 32% 낮음, 경쟁 프런티어 모델 대비 약 50~80% 낮음(Google 주장, 비교 대상 미명시).
- 공개 범위: Gemini API 유료 티어(AI Studio·Android Studio), Antigravity(유료 AI Pro·Ultra), Gemini for business, Gemini 앱(Pro·Ultra). 사이버 방어용은 Fairwind Program에 수일 내 순차 제공.
- 출처: https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/ (이번 직접 열람)
- 한 줄 요약: Carbon급 품질을 더 낮은 작업당 비용으로 내놓은 Gemini 4 신모델.

### 2-2. Gemini 4 Hydrogen — 변동 없음 (발표 2026-11-12 UTC, KST 11-13, 7일 경계)
- 이번에 공식 페이지는 다시 열지 않음(직전 보고 인용: Gemini 3.8 Flash 대비 약 2.5배 빠름, Terminal-Bench 4.1 57%, $1.50/$7.50). 2차 출처(GoogleWatchBlog, 11월 둘째 주 정리)는 Hydrogen·Carbon·Omni 1.2 Flash(영상 생성), Memory Summary, Android XR 안경 사전 예약 등을 언급했으나 날짜·수치가 없어 인용하지 않습니다.

## 3. Anthropic (Claude)
- **최근 7일 신규 모델 발표 없음**(확인한 범위: Claude Platform 릴리스 노트 앞 100,000자 중 11-13~11-20 항목 2건뿐).
- 참고(기간 밖, 변동 없음): "Introducing Claude Fable 5.2 and Claude Mythos 5.2" 2026-11-09. Reuters 기사(The Star 인용, 2차)로 이번에 재확인: 5.1 대비 출력 속도 최대 30% 빠름(회사 발표를 기사가 전달), 입력 $8/출력 $40, Fable 5.2는 일반 공개·Mythos 5.2는 승인 기관만. 벤치마크 세부는 직전 보고(Anthropic 공식 페이지 직접 열람 값) 참고.
- 기능 소항목(릴리스 노트, 직접 열람): 2026-11-17 Linked billing 베타(고객 조직이 앱 사용량을 결제, 헤더 `user-profiles-billing-2026-10-01`) — 변동 없음. 2026-11-16 Opus 4.6·4.5·Sonnet 4.5·Haiku 4.5 텍스트 워터마크 — 변동 없음.
- 출처: "Claude Platform release notes - Claude Platform Docs" https://platform.claude.com/docs/en/release-notes/overview , https://www.thestar.com.my/tech/tech-news/2026/11/10/anthropic-unveils-new-fable-mythos-models-as-competition-heats-up-ahead-of-ipo

## 4. xAI · Meta · DeepSeek
- 최근 7일 특이사항 확인 못 함. 검색에서 이 기간 기사는 나오지 않았고(최신 확인값은 2차 기사의 7~8월 정보) 공식 페이지는 열지 않았습니다. "없음"이 아니라 **미확인**(시도: 웹 검색 1회, 공식 사이트 미열람).

## 5. 건수·부족 사유
- 24시간 내 모델 출시 0건 / 7일 내 모델 출시 2건(GPT-6.2, Gemini 4 Neon) + 경계 1건(Hydrogen). 소항목 4건(GPT-Live-1.1, 백그라운드 창, Linked billing 등).
- 부족 사유: 24시간 내 대형 발표를 확인한 범위에서 찾지 못함. 미확인: openai.com 뉴스·릴리스 노트(HTTP 403), Anthropic 뉴스 페이지, Gemini 앱 릴리스 노트, Anthropic 릴리스 노트 뒷부분 45,890자, 제3자 평가 원 페이지, xAI·Meta·DeepSeek 공식 페이지.
- 단일 출처·루머: GPT-6.2 "자기 개선 임계치 도달" 주장은 단일 출처로 미확인.
