# 대장급 AI 모델 동향 수집 (조사 기간: 2026-11-10 ~ 2026-11-17 KST, 확인일 2026-11-17)

확인한 범위에서의 정리입니다. 수치는 아래 표시한 출처 페이지에서 확인한 값이며, 별도 표시가 없으면 회사 자체 발표(자체 측정)입니다. 결론: **실제 모델 관련 건수 3건(Anthropic 1, OpenAI 0~1 소규모, Google 1) + 기타 소항목**. 10건에 못 미친 사유는 맨 아래에 적었습니다.

지난 보고(outputs/2026-11-16/run-mwim8uz3-03ea92/aitrend/aitrend-2-ai-model-updates.md) 대비 상태: 각 항목에 신규/갱신/변동 없음 표시.

## 1. Anthropic (Claude) — 1건

### 1-1. "Introducing Claude Fable 5.2 and Claude Mythos 5.2" — 변동 없음(지난 보고와 동일 건, 이번에 공식 문서로 재확인, 비교 모델 열 추가)
- 발표일: 2026-11-09 미국 동부 14:00(EST) = KST 2026-11-10 04:00 (시각은 CNBC 기사 기준, 2차 출처). 날짜 2026-11-09는 Anthropic 뉴스룸·릴리스 노트에서 이번에 확인. 분류: 출시·신기능 / 성능 / 가격
- 출처(직접 열람): 「Introducing Claude Fable 5.2 and Claude Mythos 5.2 \ Anthropic」 https://www.anthropic.com/news/claude-fable-and-mythos-5-2 , 릴리스 노트 「Claude Platform release notes - Claude Platform Docs」 https://platform.claude.com/docs/en/release-notes/overview , 보조(2차) 「Anthropic releases Claude Fable 5.2 and Claude Mythos 5.2 ahead of IPO」(CNBC) https://www.cnbc.com/2026/11/09/anthropic-claude-fable-5-2-mythos-5-2.html
- 바뀐 점(공식): Fable 5.1 대비 코딩·추론·비전 개선, 출력 속도 최대 30% 향상, Medium effort에서 5.1보다 적은 토큰으로 작업 완료, 사이버·생물 안전장치 오차단 약 55% 감소(사이버 약 60%, 생물 약 40%). Fable·Mythos는 같은 기반 모델이고 Mythos 5.2는 검증 프로그램(Cyber/Life Sciences) 승인 기관만 사용.
- 벤치마크(모두 Anthropic 자체 발표, 안전장치 적용 상태. 비교 모델 수치도 Anthropic 발표표 기준이며 독립 평가 아님):

| 지표 | Fable 5.2 | Fable 5.1 | Opus 5.5 | GPT-6 Astra | Gemini 4 Carbon | 조건(페이지 표기) |
|---|---|---|---|---|---|---|
| FrontierCode 2.0 | 49.1% | 32.4% | 45.5% | 42.8% | 41.1% | Fable 5.2·5.1 Xhigh, Gemini Medium |
| FrontierSWE v2 | 69.9% | 56.3% | 62.3% | 65.5% | 61.2% | 최고 사용 가능 effort |
| AutomationBench | 51.4% | 31.4% | 42.5% | 41.4% | 53.9% | 최고 사용 가능 effort |
| Terminal-Bench-Science 0.1 | 74.6% | 52.6% | 58.7% | 68.1% | 64.8% | Mythos 5.2는 75.3% |
| OSWorld 2.1 (offline, partial) | 89.3% | 83.5% | 87.2% | 79.5% | 81.5% | 최고 사용 가능 effort |
| RoboDojo Sim | 64.9% | 27.6% | 39.4% | 29.8% | 미표기 | 내부 실행 |
| Remote Labor Index | 41.3% | 17.9% | 21.3% | 20.8% | 미표기 | Fable 5.2는 High effort |
| Humanity's Last Exam(도구 사용) | 74.2% | 65.6% | 67.7% | 57.2% | 미표기 | 최고 사용 가능 effort |
| Chartography(도구 없음) | 73.4% | 44.8% | 64.4% | 71.0% | 72.5% | 최고 사용 가능 effort |

  - Mythos 5.2: CVE Rediscovery 89.6%(Mythos 5.1 78.3%). 안전장치·표 열 대응은 원문 표 정렬이 불분명해 일부 셀은 원문 재확인 권장.
- 가격(릴리스 노트): Fable 5.2·Mythos 5.2 입력 $8 / 출력 $40 (100만 토큰당), Fable 5.1은 $10/$50. Fast mode $16/$80(최대 2.5배 빠른 생성). 컨텍스트 1M, 최대 출력 128K, 모델 ID `claude-fable-5-2`.
- 공개 범위: Fable 5.2 일반 공개(AWS·Google Cloud·Azure 포함). Mythos 5.2 제한 공개. 30일 데이터 보존 필요, ZDR은 별도 승인 필요(릴리스 노트).
- 같은 날 API 변경(릴리스 노트): prefix check 전 계정 적용, `computer_20251124` 도구 400 오류 → `computer_toolset_20260801` 이전 필요(Bedrock 제외).

### 1-2. Claude 개발자 플랫폼 소규모 변경 — 신규 (신기능 모음)
- 2026-11-12: 자체 호스팅 Claude Managed Agents 출시(서비스 전체를 자체 인프라에서 운영, 세션 기록 저장도 자체 인프라; 접근은 Anthropic 계정 팀에 요청) — 릴리스 노트.
- 2026-11-16: Opus 4.6·Opus 4.5·Sonnet 4.5·Haiku 4.5 생성 텍스트에 텍스트 워터마크 적용(지원 플랫폼; temperature/top_p/top_k를 기본값 외로 설정하면 적용 안 될 수 있음) — 릴리스 노트.
- 출처: 「Claude Platform release notes - Claude Platform Docs」 https://platform.claude.com/docs/en/release-notes/overview (11월 5일 항목은 조사 기간 밖). 릴리스 노트는 앞 100,000자만 읽었고 11월 항목은 모두 그 안에 있었음.
- 기타(모델 아님): 2026-11-10 "Anthropic launches roadshow for proposed initial public offering"(투자·사업, 뉴스 목록 제목만 확인). 2026-11-17 뉴스 항목은 제목이 없어 내용 미확인.

## 2. OpenAI (GPT) — 모델 출시 없음, 소규모 1건 (확인한 범위)
- 확인 출처(직접 열람): API 변경 기록 https://developers.openai.com/api/docs/changelog
- 조사 기간 안 항목: 2026-11-16 `omni-moderation-csam-latest` — 승인된 조직이 OpenAI CSAM 이미지 분류기를 /v1/moderations에서 사용 가능, CSAM과 AI 생성 CSAM 별도 신호 반환, 승인 조직에 무료. 분류: 안전·정책. 상태: 신규. (모델 성능 소식 아님)
- 기간 밖(참고): 11-05 `gpt-6-cyber`, 11-04 `gpt-image-2.6-sunburst`/`gpt-image-2.6-flare`, 11-02 `gpt-live-1`. 지난 보고와 동일 — 변동 없음.
- 대표 모델 현황(지난 보고 인용, 이번에 재확인 안 함): GPT-6 Astra $10/$50, 컨텍스트 1.05M(지난 보고가 모델 문서에서 확인). 이번 기간 변경 기록 없음.
- 한계: openai.com/news, ChatGPT 릴리스 노트는 이번에 열지 않음 → ChatGPT 앱 쪽 발표는 미확인. Releasebot(2차)은 11월 날짜 항목 없음으로 응답.

## 3. Google (Gemini) — 1건 + 관련 발표

### 3-1. "Introducing Gemini 4 Hydrogen for Agentic Workflows" — 갱신(지난 보고 항목, 가격 비교 정보 추가)
- 발표일: 2026-11-12 18:00 UTC = KST 11-13 03:00 (블로그 피드). 분류: 출시·신기능 / 가격
- 출처(직접 열람): 피드 https://blog.google/rss/ , 발표문 「Introducing Gemini 4 Hydrogen for Agentic Workflows」 https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/ (지난 보고에서 열람한 값 인용), 보조(2차) 「Google launches Gemini 4 Hydrogen for everyday coding tasks」(GCN) https://gcn.com/google-gemini-4-hydrogen-coding/23269/ (이번 열람)
- 바뀐 점(Google 발표): Gemini 3.8 Flash 대비 기본 설정에서 약 2.5배 빠름. Terminal-Bench 4.1 57%(3.8 Flash 18.2%, Google 발표 데이터). Artificial Analysis Intelligence Index 51(제3자 지수를 Google이 인용, high 기본 설정; 지난 보고 인용).
- 가격: 입력 $1.50 / 출력 $7.50 (100만 토큰당, 컨텍스트 전체 동일, 출력에 thinking 토큰 포함), 4,096토큰 이상 캐시 입력 $0.075(GCN 기사, 2차). Carbon·Argon 현재 프로모션가보다 25% 저렴하나 3.8 Flash 프로모션가보다는 비쌈(프로모션 2027-01-01 종료; GCN). 3.8 Flash 구체 가격은 미확인.
- 사양·공개: 사고 수준 low/medium/high(기본)/xhigh. Google AI Studio·Gemini API·Gemini 앱·Google 검색·Antigravity(유료 AI Pro·Ultra) 등(GCN). 컨텍스트 1M(지난 보고에서 공식 발표문 확인, 이번 재확인 안 함).

### 3-2. Gemini 앱·제품 관련(블로그 피드 제목만 확인, 본문 미열람 — 신규)
- 11-13 "Connect Google Wallet to Gemini for personal finance insights"
- 11-16 "Transform notes, research, and sources into interactive sites with Gemini Notebook."
- 11-16 "Regional voices are rolling out in the Gemini app."
- 11-16 "Ask Maps is coming to Europe." (Gemini 모델 기반이라고 피드에 표기)
- 출처: https://blog.google/rss/ — 수치·가격·공개 범위 미확인.
- 이전 보고의 "Gemini Decisions API"(11-11)는 기간(11-10~) 안이나 본문 미열람 상태 그대로 — 미확인(이번에도 열지 않음).
- Gemini 4 Carbon·Argon의 공식 출시일은 이번에도 공식 페이지 미확인. 검색 요약(2차)은 Carbon GA 11-10으로 적었으나 미검증. 다만 Anthropic 발표표에 Carbon 수치가 비교 대상으로 실려 있음(Anthropic 측정).

## 4. 기타 회사 (Meta·xAI·DeepSeek 등)
이번 수집에서는 조사하지 않음("큰 발표가 있을 때만" 범위). 없다는 뜻이 아니라 **미확인**입니다.

## 5. 건수와 부족 사유
- 같은 사건 묶음 기준 모델 출시·성능 관련 정식 건수: Claude Fable/Mythos 5.2 1건, Gemini 4 Hydrogen 1건 = **2건**. 소규모 기능·정책: Anthropic 2건(Managed Agents 자체 호스팅, 워터마크), OpenAI 1건(CSAM 분류기), Google 제품 소식 4건(제목만). 총 약 9개 항목이나 상세 수치가 있는 것은 2건뿐.
- 10건 미만 사유: 확인한 범위에서 조사 기간 내 대형 신규 모델 출시가 위 2건뿐이었고, OpenAI는 기간 내 모델 출시 기록이 변경 기록에 없었음.
- 못 연 곳: openai.com/news·ChatGPT 릴리스 노트(미시도), Gemini Decisions API·Carbon/Argon 공식 페이지(미열람).
- 추정: 없음. 검색 요약의 2차 정보(GPT-6.1 Terra, Gemini 4 Carbon GA 11-10 등)는 공식 확인 전이라 본문 수치에 쓰지 않음.
