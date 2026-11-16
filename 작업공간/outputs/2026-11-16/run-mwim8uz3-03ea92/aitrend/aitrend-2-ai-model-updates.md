# 대장급 AI 모델 특이사항 (조사 기간: 2026-11-09 ~ 2026-11-16, 확인일 2026-11-16)

확인한 범위에서의 정리입니다. 지난 AI 브리핑 파일은 찾지 못해 모든 항목이 "신규" 기준입니다. 수치는 직접 연 페이지에서 확인한 값이며, 별도 표시가 없으면 회사 발표(자체 측정)입니다.

## 1. Anthropic (Claude) — 특이사항 있음 (1건)

### 1-1. "Introducing Claude Fable 5.2 and Claude Mythos 5.2" — 신규
- 발표일: 2026-11-09 (2026-11-11 수정 표기). 분류: 출시·신기능 / 성능·평가 / 가격
- 출처: "Newsroom \ Anthropic"(https://www.anthropic.com/news)에서 제목·날짜 확인. 본문 "Introducing Claude Fable 5.2 and Claude Mythos 5.2 \ Anthropic"(https://www.anthropic.com/news/claude-fable-and-mythos-5-2)과 "Models overview - Claude Platform Docs"(https://platform.claude.com/docs/en/about-claude/models/overview)를 직접 열어 확인.
- 무엇이 바뀌었나(회사 발표): 5.1 대비 코딩·추론·비전 개선. 출력 속도 최대 30% 향상. Medium effort에서 Fable 5.1보다 적은 토큰으로 작업 완료. 안전장치 오차단 약 55% 감소(사이버 약 60%, 생물 약 40%). Fable과 Mythos는 같은 기반 모델이며 Mythos는 검증된 기관에게만 제공(제한 공개).
- 벤치마크(모두 Anthropic 자체 발표, Fable 5.2 / Fable 5.1 / Opus 5.5, 안전장치 켠 상태 기준):

| 지표 | 5.2 | 5.1 | Opus 5.5 | 조건 |
|---|---|---|---|---|
| FrontierCode 2.0 | 49.1% | 32.4% | 45.5% | Xhigh effort (High effort에서는 45.3%) |
| FrontierSWE v2 | 69.9% | 56.3% | 62.3% | effort 미기재 |
| AutomationBench | 51.4% | 31.4% | 42.5% | effort 미기재 |
| Terminal-Bench-Science 0.1 | 74.6% | 52.6% | 58.7% | Mythos 5.2는 75.3% |
| OSWorld 2.1 (offline, partial) | 89.3% | 83.5% | 87.2% | effort 미기재 |
| RoboDojo Sim | 64.9% | 27.6% | 39.4% | Max effort, 내부 실행 |
| Remote Labor Index | 41.3% | 17.9% | 21.3% | High effort |
| Humanity's Last Exam (도구 사용) | 74.2% | 65.6% | 67.7% | effort 미기재 |
| Chartography (도구 없음) | 73.4% | 44.8% | 64.4% | effort 미기재 |
| WANDR (relaxed) | 82.1% | 68.7% | 72.3% | effort 미기재 |

- Mythos 5.2: CVE Rediscovery 89.6%(Mythos 5.1 78.3%, Opus 5.5 81.3%·안전장치 없음), CyScenarioBench 76.3%(Mythos 5.1 61.7%, Opus 5.5 67.6%·안전장치 없음).
- 가격(문서 확인): Fable 5.2 입력 $8 / 출력 $40 (백만 토큰당). 이전 Fable 5.1은 $10 / $50(모델 개요 문서 표). 빠른 모드(최대 2.5배 빠른 생성) $16 / $80. Mythos 5.2도 $8 / $40.
- 컨텍스트: 1M 토큰, 최대 출력 128K 토큰(모델 개요 문서). 모델 ID `claude-fable-5-2`. 지식 기준 시점 2026-06.
- 공개 범위: Fable 5.2는 Claude API·AWS·Google Cloud·Microsoft 등 전 플랫폼. Mythos 5.2는 Cyber·Life Sciences 검증 프로그램 승인 기관만.
- 참고(대표 모델 현황, 변동 없음 확인): 같은 모델 개요 문서 기준 Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10부터/$0.50부터, 모두 1M 컨텍스트. 이 4종의 가격·사양은 이번 기간 변경 기록을 찾지 못함.

### 1-2. 기타(모델 아님)
- 2026-11-10 "Anthropic launches roadshow for proposed initial public offering" — 투자·사업 분류, 뉴스 목록 제목만 확인(본문 미열람).
- 2026-11-16 항목은 뉴스 목록에 날짜·분류만 있고 제목이 없어 내용 미확인.

## 2. OpenAI (GPT) — 최근 7일 특이사항 없음 (확인한 범위)
- 확인 출처: API 변경 기록(https://developers.openai.com/api/docs/changelog) 직접 확인. 2026-11 항목은 11-05 `gpt-6-cyber`, 11-04 `gpt-image-2.6-sunburst`/`gpt-image-2.6-flare`, 11-02 `gpt-live-1` 뿐이며 모두 조사 기간(11-09~) 이전입니다.
- 모델 문서(https://developers.openai.com/api/docs/models): 최상위 모델 GPT-6 Astra(`gpt-6-astra`) $10 입력 / $50 출력, 컨텍스트 1.05M, 최대 출력 128K, 지식 기준 2026-04-30. 하위: GPT-6.1 Sol $2/$10, GPT-6 Luna $0.10/$0.50. 출시일은 문서에 없음. 11월 변경 언급 없음.
- 한계: openai.com/news는 접근 거부(HTTP 403)로 열지 못했고, ChatGPT 제품 릴리스 노트는 확인하지 않았습니다. 따라서 ChatGPT 앱 쪽 발표는 미확인.
- 참고(2차 출처, 미검증): 검색 요약에 GPT-6.1 Terra(10-26) 언급이 있었으나 공식 문서에서 확인하지 못함.

## 3. Google (Gemini) — 특이사항 있음 (신규 모델 1건 + 관련 발표 2건)

### 3-1. "Introducing Gemini 4 Hydrogen for Agentic Workflows" — 신규
- 발표일: 2026-11-12 (블로그 피드 18:00 UTC = KST 11-13 03:00. 본문 표기는 11-12 게시, 11-13 갱신). 분류: 출시·신기능 / 성능·평가 / 가격
- 출처: https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/ (직접 확인), 피드 https://blog.google/rss/
- 개선 내용(회사 발표): 기존 Gemini 3.8 Flash 대비 기본(high) 설정에서 작업 완료 2.5배 빠름. 파트너 테스트에서 2~2.8배 빠르고 토큰 사용 12~23% 감소. 안전성(Google 내부 평가, 3.8 Flash 대비): 과잉 행동 최대 81% 감소 등.
- 벤치마크(Google 발표, 외부 지표는 출처에 측정 주체 별도 명시 없음):
  - Terminal-Bench 4.1: 57% (Gemini 3.8 Flash 18.2%)
  - Artificial Analysis Intelligence Index(제3자 지수, Google 인용): 51 (high 기본), Argon 50, xhigh에서 54
  - HLE-Diamond 58.8%, Vals Tax Agent Bench 52.3%(전체 1위 주장), Vals Legal Research Bench 55.8%(공동 1위), Agents' Last Exam v1.1 71.6%, MKA 53.4%
- 가격·사양: 입력 $1.50 / 출력 $7.50 (백만 토큰당, 전체 컨텍스트 동일). 컨텍스트 입력 1M, 출력 최대 1M. 사고 수준 low/medium/high(기본)/xhigh. 이전 3.8 Flash 가격은 미확인.
- 공개 범위: 2026-11-12부터 순차 확대. Gemini API·Google AI Studio(전 등급), Gemini 앱, Google Search(전 사용자), Android Studio 등. Antigravity는 유료 AI Pro·Ultra 대상.
- 포지셔닝: Gemini 4 Carbon·Argon이 심층 추론용 최상위, Hydrogen은 "daily driver". (Carbon·Argon의 출시일·수치는 이번에 공식 확인 못함; 2차 출처는 Carbon 약 11-10, Argon 10-13로 적었으나 미검증)

### 3-2. 관련 블로그 (피드 제목만 확인, 본문 미열람)
- "Gemini 4 Hydrogen: everyday coding and agentic workflows for developers" (11-12) — 3-1과 같은 사건으로 묶음.
- "Google Search gets a major upgrade with Gemini 4 Hydrogen" (11-12) — 같은 사건.
- "Gemini Decisions API: Fast, calibrated multimodal decisions" (2026-11-11) — 신규, 상세 수치·가격·공개 범위 미확인.

## 4. 기타 회사 (xAI·Meta·DeepSeek 등)
이번 조사에서 확인하지 않음. 특이사항이 있을 때만 다루는 범위여서 조사 대상에서 제외했으며, 없다는 뜻이 아니라 "미조사"입니다.

## 5. 확인 건수와 부족 사유
- 직접 연 공식 페이지: "Newsroom \ Anthropic"·발표 본문·"Models overview - Claude Platform Docs", OpenAI API 변경 기록·모델 문서, Google 블로그 피드·Hydrogen 발표문.
- 못 연 곳: openai.com/news(403), Anthropic 11-16 항목 제목 없음, Gemini Decisions API 본문·Carbon/Argon 공식 페이지 미열람.
- 검색 요약(2차 출처)은 참고만 했고 위 수치에는 쓰지 않았습니다.
