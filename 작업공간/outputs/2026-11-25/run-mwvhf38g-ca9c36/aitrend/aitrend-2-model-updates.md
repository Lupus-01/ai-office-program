# 대장급 AI 모델 최신 개선사항 조사 (AI트렌드 조사 담당)

- 조사 기간: 2026-06 ~ 2026-11-25 (가정: 대표 지시에 기간 명시 없음 → 최근 약 6개월)
- 확인일: 2026-11-25 (표의 "확인"은 모두 이 날짜에 직접 연 페이지 기준)
- 표기: **[이번 확인]** 이번에 직접 연 페이지 / **[2차]** 검색 요약·제3자 경유 / **[회사 발표]** 회사 자체 측정
- 지난 AI 브리핑: 이 단계에서는 읽지 않음(입력 없음, 완료 기준에 없음). 따라서 신규/갱신 표시는 하지 않고 "이번 조사 기준"으로만 적는다.

## 0. 요약 (확인한 범위에서는)

| # | 회사 | 현재 주력 모델 | 발표일 | 한 줄 요약 | 기준 충족 |
|---|---|---|---|---|---|
| 1 | Anthropic | Claude Fable 5.2 (보조: Claude Opus 5.5) | 2026-11-09 | Fable 5.1 대비 동일 벤치마크 전부 상승, 가격 20% 인하, 출력 최대 30% 빠름 | 충족 |
| 2 | OpenAI | GPT-6.2 Astra / GPT-6.2 Sol | 2026-11-17 (API) | GPT-6 Astra 대비 GDPval v2 +6.2점, Astra 가격 20% 인하 | 충족 |
| 3 | Google | Gemini 4 Carbon (이후 Hydrogen·Neon 추가) | 2026-11-10 | Argon 대비 사이버·안전 지표 개선(회사 발표), 가격은 11/30 이후 2배 | 충족(수치 일부 미확인) |
| 4 | xAI | Grok 4.7 | 2026-09-21 | Grok 4.6 대비 공개 8개 벤치마크 전부 상승, 가격 동일 | 충족 |
| 5 | DeepSeek / Meta | DeepSeek-V4 (Pro/Flash) | 2026-04-24 | **조사 기간(6개월) 밖** → 건수에서 제외. Meta Llama 이번에 미조사 | 미충족 |

**실제 건수: 4개사 (기간 내 발표 확인). 5번째 사유: DeepSeek 최신 확인 발표는 2026-04-24(기간 밖, 뉴스 검색 결과 [2차]), 공식 API 변경 기록은 못 열었음. Meta는 시간·범위상 조사하지 않음(미확인).**

---

## 1. Anthropic — Claude Fable 5.2

| 항목 | 내용 | 출처·구분 |
|---|---|---|
| 발표 제목·모델명 | "Introducing Claude Fable 5.2 and Claude Mythos 5.2 \\ Anthropic" (페이지 제목 원문) / `claude-fable-5-2` | https://www.anthropic.com/claude-fable-and-mythos-5-2 [이번 확인] |
| 발표일 | 2026-11-09 ("Released November 9, 2026") | "Claude Fable 5.2 - Claude Platform Docs" https://platform.claude.com/docs/en/models/fable-5-2/overview [이번 확인] |
| 공개 범위 | Fable 5.2: Claude API 전 고객. Mythos 5.2: 동일 기능이나 Cyber Verification Program 등 인증 조직만 | 같은 문서 / whats-new 페이지 [이번 확인] |
| 문맥·출력 | 문맥 1M 토큰, 최대 출력 128K (Fable 5.1도 동일 1M/128K → 변화 없음) | 모델 개요 표 [이번 확인] |
| 가격(API) | 입력 $8 / 출력 $40 per MTok. 이전 Fable 5.1은 $10 / $50 → 입력·출력 각 20% 인하. 빠른 모드 $16 / $80 | whats-new-fable-5-2, 모델 개요 [이번 확인] |
| 속도 | 출력이 Fable 5.1 대비 "최대 30% 빠름", 빠른 모드는 토큰 생성 최대 2.5배 (회사 발표 기준) | https://www.anthropic.com/claude-fable-and-mythos-5-2 의 내용을 WebFetch 요약으로 확인 [이번 확인, 요약 경유] |
| 새 기능 | 빠른 모드(Claude Code·Claude Platform 등), Advisor/Orchestrator 역할, Claude Security 연속 저장소 점검, 모든 계정에 preserved thinking 적용, 컴퓨터 사용 도구 `computer_toolset_20260801`로 전환(구 `computer_20251124`는 Amazon Bedrock 외 플랫폼에서 400 오류) | whats-new 페이지 [이번 확인] |
| 지식 기준일 | 2026-06 | 모델 개요 [이번 확인] |
| 호환성 주의(특이사항) | adaptive thinking 항상 켜짐(끌 수 없음), 강제 tool_choice(any/tool) 400 오류, 이전 모델 thinking 블록 호환 제한, 30일 데이터 보관 필수(Legacy ZDR 불가) | whats-new 페이지 [이번 확인] |

### 이전 모델 대비 개선 (Fable 5.2 vs Fable 5.1 vs Opus 5.5)
측정: Anthropic이 자체 실행·시스템 카드 보고 [회사 발표]. 조건: 별도 표기 없으면 각 모델의 최고 effort, 안전장치 켠 상태. 출처: https://www.anthropic.com/claude-fable-and-mythos-5-2 (WebFetch 요약) [이번 확인, 요약 경유]

| 벤치마크 | Fable 5.2 | Fable 5.1 | 변화 | Opus 5.5 | 측정 주체(페이지 기술) |
|---|---|---|---|---|---|
| FrontierCode 2.0 (Xhigh effort) | 49.1% | 32.4% | +16.7p | 45.5% | 제3자 벤치마크를 Anthropic이 실행 |
| FrontierSWE v2 | 69.9% | 56.3% | +13.6p | 62.3% | 제3자 벤치마크를 Anthropic이 실행 |
| AutomationBench | 51.4% | 31.4% | +20.0p | 42.5% | 측정 주체 개별 표기 없음 |
| Terminal-Bench-Science 0.1 | 74.6% | 52.6% | +22.0p | 58.7% | 개별 표기 없음 |
| WANDR (relaxed) | 82.1% | 68.7% | +13.4p | 72.3% | Perplexity 벤치마크 |
| OSWorld 2.1 (partial) | 89.3% | 83.5% | +5.8p | 87.2% | 개별 표기 없음 |
| RoboDojo Sim (Max effort) | 64.9% | 27.6% | +37.3p | 39.4% | Anthropic 내부 |
| Remote Labor Index (High effort) | 41.3% | 17.9% | +23.4p | 21.3% | 개별 표기 없음 |
| Humanity's Last Exam (도구 사용) | 74.2% | 65.6% | +8.6p | 67.7% | 제3자 벤치마크 |
| Chartography (도구 없음) | 73.4% | 44.8% | +28.6p | 64.4% | 개별 표기 없음 |

- 변화(p)는 표의 두 수치 차를 내가 계산한 값이다(추정 아님, 단순 산술).
- 회사 발표: "High effort의 Fable 5.2가 FrontierCode에서 Max effort의 Opus 5.5와 같은 수준이며 작업당 비용은 약 절반".
- 출시 전 외부 평가기관(UK AI Security Institute, Frontier Design, METR)이 테스트했으나 블로그·시스템 카드는 검토하지 않았다고 명시.
- 같은 날 발표된 하위 라인(참고, 기간 내): Claude Opus 5.5 (2026-09-22), Sonnet 5.5 (09-28), Haiku 5.5 (10-07). 가격: Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10~/$0.50~ per MTok, 모두 문맥 1M [이번 확인: 모델 개요 표]. 이 세 모델의 이전 대비 벤치마크는 이번에 열지 않음 → **비교 수치 미확인**.

---

## 2. OpenAI — GPT-6.2 Astra / GPT-6.2 Sol

| 항목 | 내용 | 출처·구분 |
|---|---|---|
| 모델명·제목 | "Introducing GPT-6.2 Astra and Sol" / `gpt-6.2-astra`, `gpt-6.2-sol` | https://openai.com/index/introducing-gpt-6-2-astra-sol/ [이번 확인] |
| 발표일 | API 2026-11-17 (릴리스 노트). 발표 페이지 자체에는 정확한 날짜 없음 | https://help.openai.com/en/articles/9624314-model-release-notes [이번 확인] |
| 공개 범위 | ChatGPT Work·Codex(Plus/Pro/Enterprise/Edu), API. Ultrafast는 Pro 500(둘 다)·Pro 200(Sol)·관리자 허용한 Enterprise/Edu. ChatGPT Chat 탭 적용(11/23)은 Releasebot 보도 [2차, 미확인] | 발표 페이지 [이번 확인] / Releasebot [2차] |
| 문맥·출력(Astra) | 문맥 1,050,000 (최대 입력 922,000), 최대 출력 128,000, 지식 기준일 2026-05-18 | "GPT-6.2 Astra Model \| OpenAI API" https://developers.openai.com/api/docs/models/gpt-6.2-astra [이번 확인] |
| 가격(API) | Astra $8 입력 / $0.40 캐시 입력 / $40 출력 per 1M. GPT-6 Astra 대비 입력·출력 20% 인하, 캐시 입력 60% 할인(회사 발표). Sol $2 / $0.10 / $10, GPT-6.1 Sol과 동일 | 발표 페이지 [이번 확인] |
| 새 기능·특이사항 | Ultrafast 모드, 이전 대비 출력 토큰 감소("fewer output tokens"), 사이버 고위험 요청 보호 강화. 11/24 의료용 구성(Astra·Sol, 의료 근거 검색 색인) 추가 | 발표 페이지, 릴리스 노트 [이번 확인] |
| 퇴보 지표(회사 시스템 카드) | MentalHealthBench(최대 effort): Astra 53.3%, Sol 50.9% vs GPT-6 Astra 58.7%, GPT-6.1 Sol 57.9% (하락). 일부 정직성 테스트에서 장애물을 생략할 가능성이 GPT-6 Astra보다 높음 | 시스템 카드 요약 [2차: 검색 요약, 원문 PDF 미열람] / 발표 페이지 [이번 확인, 후자] |

### 이전 모델 대비 개선 (회사 발표 기준)
| 지표 | 개선 폭 | 비교 대상·조건 | 측정 주체 |
|---|---|---|---|
| GDPval v2 (장기 지식업무) | Astra: GPT-6 Astra 대비 +6.2p, 출력 토큰 22% 감소. Sol: GPT-6.1 Sol 대비 +5.3p | effort 미표기 | OpenAI 내부 |
| Agents' Last Exam | Astra: GPT-6 Astra 대비 +5.2p, Claude Fable 5.2 대비 +5.5p (비용 약 1/3, 약 5%) | effort 미표기. Fable 5.2는 9개 과제 제외(폴백 모델 사용) | 측정 주체 미표기 |
| Terminal-Bench-Science 0.1 | Astra: GPT-6 Astra 대비 +9p | Fable 5.2 수치는 Artificial Analysis(mini-swe-agent 하네스) | 측정 주체 혼합 |
| AA-3D (사람 선호 Elo) | Astra 1,318 / Fable 5.2 1,271 / Sol 1,259 | 블라인드 사람 평가 | Artificial Analysis(제3자) |
| AA-AnalystAgent | Astra 62.5% (5회 모두 정답) | 이전 모델 비교 없음 → **비교 수치 미확인** | Artificial Analysis |
| FrontierCode 2.0 | Sol이 Astra와 0.5p 이내, 비용 약 1/5 (Max) | Astra 대비 | Cognition |

- 해석 주의: OpenAI가 경쟁사(Claude Fable 5.2)와 비교한 수치는 OpenAI가 고른 비교다. Anthropic 쪽 수치(표 1번)와 같은 지표 이름(Terminal-Bench-Science 0.1)이 있으나 조건이 달라 직접 비교하지 않는다.
- 같은 기간 직전 흐름: GPT-5.6 Sol(2026-07-09), GPT-6.1 Terra(2026-10-26, $1/$0.05/$5 per 1M), GPT-6 Rosalind Research(10-30, 승인 고객 한정) [이번 확인: 릴리스 노트]. 이들의 이전 대비 벤치마크는 미확인.

---

## 3. Google — Gemini 4 (Argon → Carbon → Hydrogen → Neon)

| 모델 | GA일 | 설명·가격 | 출처·구분 |
|---|---|---|---|
| Gemini 4 Argon (`gemini-4-argon`) | 2026-10-13 | 복잡한 코딩·에이전트·수학·과학용. 가격 변경기록에 미표기 | "Release notes - Gemini API \| Google AI Studio" https://aistudio.google.com/docs/changelog [이번 확인] |
| Gemini 4 Carbon (`gemini-4-carbon`) | 2026-11-10 | "most capable reasoning model". 도입가 입력 $2 / 출력 $10 per 1M (2026-11-30까지), 이후 $4 / $20 | changelog, "Gemini 4 Carbon is now available" https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-carbon-now-available/ [이번 확인] |
| Gemini 4 Hydrogen (`gemini-4-hydrogen`) | 2026-11-12 | 속도·효율, 일상 코딩·에이전트. `xhigh` thinking 추가. $1.50 / $7.50, 무료 티어 있음 | changelog [이번 확인] |
| Gemini 4 Neon (`gemini-4-neon`) | 2026-11-18 | 소프트웨어 엔지니어링·지식업무·과학용. thinking 4단계, 통합 1M 문맥. $3 / $15 | changelog [이번 확인] |

### Carbon vs Argon 개선(회사 발표 기준, 평가 설정 effort·토큰 예산 미표기 — 발표 글에 명시 없음)
| 지표 | 수치 | 측정 주체 |
|---|---|---|
| 레드팀 침해율(시도당) | Carbon 0.8% vs Argon 3.1% | Google |
| 자동 사이버공격 질의 성공률 | 2.17% vs 9.86% | Google |
| 에이전트 정직성 벤치마크 | 92% 통과 vs 70% | Google |
| Project Fortify(내부) 오픈소스 저장소 재현율 | Argon 대비 상대 25% 이상 개선 | Google 내부 |
| CursorBench 4.0, WANDR, AutomationBench | 1위(비교 모델 중, 작업당 비용 2배 이상 저렴이라 주장). 점수 없음 | 각 벤치마크 운영사 기준 순위를 Google이 인용 |
| SEC-bench Pro, ExploitGym, CWE-bench v1 | 1위. 이 페이지엔 점수 없음 | 점수는 검색 요약에 SEC-bench Pro 88.2%, ExploitGym 54.8%, AA Intelligence Index v5.0 59 → **[2차]**. DeepMind 개요 페이지는 다른 수치(AA 61 등)를 보인다는 지적이 있어 **불일치, 확정 안 함** |

- 문맥 길이: Carbon 문맥은 이번에 직접 확인 못함 → 미확인(Neon은 1M, changelog [이번 확인]).
- 특이사항: Carbon은 11/10 이전 약 2주간 Fairwind Program(사이버 방어자)에 먼저 공개됐다. Google AI Ultra·Antigravity·Gemini 앱 순차 적용. 가격은 11/30 이후 2배 인상 예정.
- Argon의 이전(Gemini 3.x) 대비 비교 수치는 이번에 열지 않음 → **비교 수치 미확인**. 같은 발표에서 3.x 대비 점수는 없다고 확인.
- 출처 간 날짜 차이: 일부 2차 출처는 Hydrogen을 11/13로 표기. 공식 변경 기록 값(11/12)을 사용.

---

## 4. xAI — Grok 4.7

| 항목 | 내용 | 출처·구분 |
|---|---|---|
| 모델명 | grok-4.7 (고속 변형 grok-4.7 Fast: Cursor·Grok Build 한정) | https://docs.x.ai/release-notes [이번 확인] |
| 발표일 | 2026-09-21 (x.ai 뉴스 페이지). API 릴리스 노트는 "September"만 표기. 검색 결과 한 곳은 10-02로 적었으나 확인 안 됨 | "Introducing Grok 4.7 \| SpaceXSI" https://x.ai/news/grok-4-7 [이번 확인] |
| 문맥 | 500k (릴리스 노트). 뉴스 글에는 문맥 크기 미기재 | docs.x.ai [이번 확인] |
| 가격 | $2 입력 / $0.50 캐시 / $6 출력 per 1M (프롬프트 200k 이하), 초과 시 $4/$1/$12. Grok 4.6과 동일. Fast는 2배 속도·2배 가격 | docs.x.ai, x.ai 뉴스 [이번 확인] |
| 새 기능 | `xhigh` 추론 effort 추가, Responses API가 암호화된 추론 내용 반환, 미국 리전 엔드포인트 | docs.x.ai [이번 확인] |

### Grok 4.7(xHigh) vs Grok 4.6(High) — xAI 자체 발표 [회사 발표]
출처: https://x.ai/news/grok-4-7 [이번 확인]. 조건: 4.7은 xHigh, 4.6은 High effort(DeepSWE의 4.7은 high effort). 비교 effort가 서로 다르다는 점에 주의.

| 벤치마크 | Grok 4.7 | Grok 4.6 | 변화 |
|---|---|---|---|
| CursorBench 4.0 | 46.3% | 40.4% | +5.9p |
| DeepSWE v1.1 | 71.0% | 65.2% | +5.8p |
| EEBench | 64.0% | 53.0% | +11.0p |
| AA Briefcase v1.1 | 1,657 | 1,546 | +111 |
| Terminal-Bench 4.0 | 37.6% | 20.3% | +17.3p |
| Harvey Legal Agent Benchmark | 19.6% | 15.8% | +3.8p |
| HealthBench Professional | 56.7% | 48.5% | +8.2p |
| GDPval Elo | 1605 | 1542 | +63 |

- 특이사항: 문서 전반에서 회사명이 "SpaceXSI"로 표기되고 인수 시기 설명이 출처마다 달라(검색 요약 [2차]) 사업 구조 변화는 확정하지 않는다. grok-build-0.1은 2026-11-19 API 서비스 종료([이번 확인] docs.x.ai).
- Grok 4.6(2026-08-14 xAI 뉴스, Google Cloud는 08-21 [2차]) → 4.7로 이어지는 6주 내 연속 출시.

---

## 5. 5번째 후보 (DeepSeek / Meta) — 건수 제외

| 회사 | 확인한 내용 | 구분 | 판단 |
|---|---|---|---|
| DeepSeek | DeepSeek-V4-Pro / V4-Flash 프리뷰, 2026-04-24, 오픈소스+API. V4-Pro 1.6T 총 / 49B 활성 파라미터(회사 발표라는 보도) | 언론·검색 요약 [2차]. DeepSeek 공식 API 변경 기록은 열지 못함(시도: 검색에서 미노출) | 조사 기간(6월~) 밖이라 건수 제외. 4월 이후 신규 발표 여부는 **미확인** |
| Meta (Llama) | 이번에 조사하지 않음 | — | **미확인** |

---

## 6. 확인한 사실 / 추정 구분

- **확인한 사실:** 위 표의 [이번 확인] 항목(가격·문맥·발표일·회사 발표 벤치마크 값).
- **추정 아님·단순 산술:** 변화(p) 열은 출처 두 수치의 차이로 내가 계산.
- **추정/주의:** (1) 회사 발표 벤치마크는 각 회사가 유리한 비교 대상·설정을 고른 것일 수 있다. 회사 간 같은 이름 지표를 직접 비교하지 않는다. (2) Anthropic·OpenAI·Google 발표 페이지 중 일부는 WebFetch 요약본으로 확인해 원문 표현과 다를 수 있다.

## 7. 확인 필요 / 미확인

1. 5개사 중 Meta 미조사, DeepSeek는 기간 밖(요청 시 추가 조사).
2. Gemini 4 Carbon 문맥 길이, 공식 벤치마크 점수(출처 간 불일치: AA Intelligence Index 59 vs 61).
3. GPT-6.2 시스템 카드 원문 수치(MentalHealthBench 등)는 검색 요약만 확인.
4. Opus 5.5·Sonnet 5.5·Haiku 5.5, GPT-5.6·GPT-6.1 Terra의 이전 대비 벤치마크 → 비교 수치 미확인.
5. GPT-6.2의 ChatGPT Chat 탭 적용일(11/23)은 2차 출처 단일.
6. Grok 4.7 발표일: x.ai 뉴스 9/21 vs 일부 검색 결과 10/02(공식 릴리스 노트는 "September").
7. 지난 AI 브리핑과의 신규/갱신 비교는 입력이 없어 하지 않음.

## 8. 우리 서비스 적용 제안 (제안, 사실 아님)

| 아이디어 | 근거 발표 | 대상 서비스 |
|---|---|---|
| 상담사 프로필 초안·댓글 분류 같은 대량·단순 작업은 가격이 낮은 모델(Claude Sonnet 5.5 $2/$10, GPT-6.2 Sol $2/$10, Gemini 4 Hydrogen $1.50/$7.50)로 시험 | 각 가격표 [이번 확인] | 홍카페, 꼬리별 관측소 |
| AI Office에 Fable 5.2 같은 고가 모델을 긴 작업·최종 검토에만 쓰고 나머지는 하위 모델로 분담(Advisor/Orchestrator 구조) | Anthropic Fable 5.2 발표 [이번 확인, 요약 경유] | AI Office |
| Fable 5.2 도입 시 adaptive thinking 고정, 강제 tool_choice 불가 등 호환 점검 필요 | whats-new 페이지 [이번 확인] | AI Office |
| Gemini 4 Carbon은 도입가가 11/30 이후 2배가 되므로 비용 비교는 인상 후 가격($4/$20)으로 | Google changelog [이번 확인] | 전 서비스 |
