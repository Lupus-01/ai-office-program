# 대장급 AI 모델 특이사항 (조사 기간: 2026-11-12 ~ 2026-11-19 KST, 확인일 2026-11-19)

확인한 범위에서의 정리입니다. 수치는 직접 연 페이지에서만 적었고, 별도 표시가 없으면 회사 발표(자체 측정)입니다. 제3자 측정은 측정 주체를 적었습니다.
**건수: 모델 출시 3건(OpenAI 1, Google 1, Anthropic 1) + 기능·API 소항목.** 지난 보고(outputs/2026-11-17/run-mwk1op42-d304f7/aitrend/aitrend-2-대장급AI-동향수집.md) 대비 상태를 항목마다 표시했습니다.

[신규] 표시 주의: 발표 시각(KST)은 공식 페이지에 없어 확인하지 못했습니다. GPT-6.2(11-17 미국 시간 게시)와 Gemini 4 Neon(11-18)은 24시간 이내일 가능성이 있으나 시각 미확인이라 "[신규·시각 미확인]"으로 적었습니다.

## 1. OpenAI (GPT)

### 1-1. [신규·시각 미확인] "GPT-6.2 Astra and Sol are now available" — 신규 (발표일 2026-11-17)
- 바뀐 점: GPT-6.2 Astra(복잡한 추론·코딩)·GPT-6.2 Sol(일상 코딩·에이전트 워크플로) 출시. API는 Responses API·Chat Completions 지원, 도구 호출은 Responses API 필요(OpenAI API 변경 기록). 분류: 출시·신기능 / 가격
- 개선 수치(전부 OpenAI 발표 근거. 공식 게시글 차트에 점수가 텍스트로 없어 세부 점수는 미확인):
  - Astra: 전문 업무·과학 연구 평가에서 "new highs", 작업당 비용 GPT-6 Astra의 3분의 1 미만 (회사 발표).
  - Agents' Last Exam: Astra(xhigh)가 GPT-6 Astra(max)보다 5.2점 높고 작업당 비용 절반 미만 (회사 발표).
  - ExploitBench Internal Port: GPT-6 Astra 대비 22점 상승 (회사 발표, 사이버 평가).
  - Sol: FrontierCode 2.0에서 Astra에 근접, 비용 약 5분의 1 (회사 발표).
  - 제3자(CASRAI 기사가 인용한 값, 2차 출처이며 원 평가 페이지는 직접 열지 않음): Artificial Analysis Intelligence Index Astra 62·Sol 57, Astra는 GPT-6 Astra보다 5점 높고 Claude Fable 5.2는 65.
- 가격(100만 토큰당, 공식 커뮤니티 공지): Astra 입력 $8 / 출력 $40, Sol 입력 $2 / 출력 $10. 캐시 입력(Astra $0.40, Sol $0.10)과 "Astra는 GPT-6 Astra보다 20% 낮음, Sol은 GPT-6.1 Sol과 동일"은 CASRAI 기사(2차) 기준. GPT-6 Astra 기존 가격은 지난 보고 인용($10/$50).
- 공개 범위: ChatGPT Work·Codex의 Plus·Pro·Enterprise·Edu(일반 Chat에는 추가 안 됨), API 제공. Ultrafast 모드는 Pro $500은 두 모델 모두, Pro $200은 Sol부터. 계정별 단계적 배포. 고위험 사이버 요청 안전장치 강화.
- 출처: 「GPT-6.2 Astra and Sol are now available」 https://community.openai.com/t/gpt-6-2-astra-and-sol-are-now-available/1417531 (직접 열람, 공식 개발자 커뮤니티 공지), API 변경 기록 https://developers.openai.com/api/docs/changelog (직접 열람), 보조 「OpenAI GPT-6.2 Astra and Sol: what researchers get — CASRAI」 https://casrai.org/news/openai-gpt-6-2-astra-sol-release-2026 (2차). 시스템 카드 「GPT-6.2 System Card - OpenAI Deployment Safety Hub」 https://deploymentsafety.openai.com/gpt-6-2-astra-sol 는 참고 링크로만 적었고 본문 수치는 인용하지 않음.
- 미확인: openai.com/news 원문, 단독 보도된 "자기 개선 임계치 도달" 주장은 단일 출처라 확인 못 함.

### 1-2. 신기능 모음 (OpenAI API 변경 기록)
- 2026-11-17 Responses API 공개 베타: gpt-6.2-astra·gpt-6.2-sol·gpt-6.1-terra·gpt-6-luna에서 백그라운드 완료 시간창 2시간/8시간 선택 — 표준 대비 토큰 요금 2시간 30%, 8시간 40% 낮음. 신규.
- 2026-11-16 `omni-moderation-csam-latest`: 승인 조직이 CSAM 이미지 분류기를 /v1/moderations에서 사용, 승인 조직 무료. 변동 없음(지난 보고에 있던 항목).

## 2. Google (Gemini)

### 2-1. [신규·시각 미확인] "Introducing Gemini 4 Neon" — 신규 (발표일 2026-11-18)
- 바뀐 점: Gemini 4 Neon 출시. Gemini 앱에서 Argon을 대체, 3.1 Pro는 서비스 종료(9to5Google, 2차). 분류: 출시·신기능 / 성능 / 가격
- 개선 수치(Google 발표. 아래 중 Artificial Analysis·Arena·Vals·Epoch 등 제3자 평가는 Google이 인용한 것이며 원 페이지는 열지 않음):
  - Carbon 대비: 기본 high에서 작업당 비용 32% 낮음, CWE-bench v2 70.7%(Carbon 대비 3.4% 향상).
  - Artificial Analysis Intelligence Index 61점(xhigh, 전체 3위, 제3자 지수를 Google이 인용). 같은 지수로 CASRAI는 Claude Fable 5.2 65, GPT-6.2 Astra 62로 적음(2차).
  - FrontierCode 2.0 46.2%(기본 high 설정, 비교 대상 미표기), Terminal-Bench 4.1 65.2%(비교 대상 미표기), Terminal-Bench Science 70.5%, HLE-Diamond 71.3%, Zapier AutomationBench 56.3%(Google 표기 #1), Chartography 73.5%.
  - 경쟁 프런티어 모델 대비 high에서 작업당 비용 약 50~80% 낮음(Google 주장, 비교 대상 미명시).
- 가격(100만 토큰당, 공식 발표): 입력 $3 / 캐시 입력 $0.15 / 출력 $15, 컨텍스트 1M. 기사(9to5Google)에 따르면 Argon·Carbon 프로모션가는 $2/$10(11-30까지), 이후 $4/$20.
- 공개 범위: Gemini API(Google AI Studio 유료 티어), Gemini for business, Google Antigravity(유료 AI Pro·Ultra), Gemini 앱(Pro·Ultra), Android Studio. 사이버 방어 버전은 Fairwind Program에 수일 내 순차 제공.
- 출처: 「Introducing Gemini 4 Neon」 https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/ (직접 열람), 보조 「Gemini 4 Neon launches: Carbon quality at Flash speeds, for AI Pro」 https://9to5google.com/2026/11/18/gemini-4-neon-announcement/ (2차).

### 2-2. "Introducing Gemini 4 Hydrogen for Agentic Workflows" — 변동 없음 (발표 2026-11-12 18:00 UTC = KST 11-13 03:00, 지난 보고 인용)
- Gemini 3.8 Flash 대비 약 2.5배 빠름, Terminal-Bench 4.1 57%(3.8 Flash 18.2%), 가격 $1.50/$7.50(지난 보고 인용, 이번 재열람 안 함). Neon은 Hydrogen 가격의 2배(9to5Google·Rolling Out, 2차).
- 출처: https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/

## 3. Anthropic (Claude)

### 3-1. "Introducing Claude Fable 5.2 and Claude Mythos 5.2 \ Anthropic" — 변동 없음 (발표 2026-11-09, 조사 기간 이전 출시. 공식 페이지에 11-11 일부 문장·각주 수정 표기)
- 이번에 공식 페이지 재열람. 가격 입력 $8 / 출력 $40(Fable 5.1은 $10/$50, 지난 보고·릴리스 노트 인용), 패스트 모드 $16/$80. Fable 5.2 전 플랫폼 일반 공개, Mythos 5.2는 사이버·생명과학 검증 프로그램 승인 기관만.
- 벤치마크(Anthropic 자체 발표, 안전장치 켠 상태·최고 effort 기준, 비교 모델 수치도 Anthropic 표 기준): FrontierCode 2.0 Fable 5.2 49.1%(Xhigh) vs Fable 5.1 32.4% / GPT-6 Astra 42.8% / Gemini 4 Carbon 41.1%(Medium); OSWorld 2.1 89.3% vs 83.5% / 79.5% / 81.5%; Remote Labor Index 41.3%(High) vs 17.9% / 20.8%; Humanity's Last Exam(도구) 74.2% vs 65.6% / 57.2%; AutomationBench는 Carbon 53.9%가 Fable 5.2 51.4%보다 높음. 나머지 지표는 지난 보고 표 참고.
- 출처: https://www.anthropic.com/claude-fable-and-mythos-5-2 (직접 열람)

### 3-2. Claude 개발자 플랫폼 신기능 모음 (「Claude Platform release notes - Claude Platform Docs」 직접 열람, https://platform.claude.com/docs/en/release-notes/overview — 앞 100,000자만 읽음, 11-12 이후 항목은 모두 그 안)
- 2026-11-17 [신규·시각 미확인] Linked billing(베타): 헤더 `user-profiles-billing-2026-10-01`, 고객이 앱 사용량을 자기 Claude 조직으로 결제, 요청별 `billing_policy` 지정. 신규.
- 2026-11-16 Opus 4.6·Opus 4.5·Sonnet 4.5·Haiku 4.5 생성 텍스트에 텍스트 워터마크. 변동 없음(지난 보고 항목).
- 2026-11-12 자체 호스팅 Claude Managed Agents(접근은 계정 팀에 요청). 변동 없음.
- 11-12 이후 새 모델 출시는 확인한 범위에서 없음.

## 4. xAI Grok · Meta · DeepSeek
- 최근 7일 특이사항 확인 못 함(공식 출처 미열람). 검색 요약(2차 트래커)상 최신은 Grok 4.7(2026-09-21), Meta Muse Wonder(2026-10-12), DeepSeek-V4.1-Flash(2026-09-10)이며 기간 내 출시 기록은 못 찾음. xAI 워터마크 정책 변경(11-14)은 단일 트래커 정보라 미검증. DeepSeek 11-23 출시 전망은 예측일 뿐 확정 아님. 공식 사이트는 이번에 열지 않아 "없음"이 아닌 **미확인**.

## 5. 건수와 부족 사유
- 같은 사건 묶음 기준 모델 출시·성능 건: GPT-6.2 1, Gemini 4 Neon 1, (기간 내 재확인 항목) Gemini 4 Hydrogen 1 = 3건. 기간 내 Anthropic 신규 모델은 없음(Fable/Mythos 5.2는 11-09 출시). 기능·API 소항목 5건.
- 부족 사유: 확인한 범위에서 위 건수가 전부이며 기준 개수에 못 미침. 미열람: OpenAI 시스템 카드·openai.com/news·ChatGPT 릴리스 노트, Artificial Analysis 등 제3자 원 페이지, xAI·Meta·DeepSeek 공식 페이지, Gemini 앱 릴리스 노트.
- 사실/추정: 위는 열람한 값이며 추정 없음. 2차 출처 값은 개별 표시.
