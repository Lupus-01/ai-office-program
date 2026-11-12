# 대장급 AI 동향·신기술 조사 자료 (조사 담당 원본, 사실만 수록)

- 확인 날짜: 2026-11-12 (모든 항목 동일)
- **조사 기간(가정):** 기본 최근 24시간(2026-11-11~12) + 각 사 최신 대표 모델의 직전 버전 대비 개선폭 비교를 위해 2026-11-04~11-11 발표까지 포함. 24시간 안에 확인한 신규 발표: Gemini CLI v0.68.0(11/11), Gemini Decision·Decisions API(11/11, Gemini API changelog, 8번 표). Anthropic 모델 발표일은 **11/9**이며, 공식 발표 페이지의 11/11 수정 표기는 신규 발표 집계에서 제외하고 **'기존 문서 갱신'**으로 분리한다(수정 내용·수정일은 재확인하지 않아 미확인). 나머지는 최근 1주 발표다. **이 자료는 확인한 공식 페이지·집계 사이트 범위의 결과이며 해당 기간 전체 발표 목록이 아니다**(확인하지 못한 발표가 있을 수 있음).
- 이전 보고서 입력 없음(입력 []). 중복 제외 불가 → 최근 1주 전체를 수록.
- **열람 한계(과거 기록 vs 이번 재확인 구분):** 과거(이전 작성 시) openai.com·help.openai.com 페이지는 403으로 열리지 않았다. **이번(2026-11-12) 재확인:** developers.openai.com의 공식 모델 문서·이미지 가이드·변경 기록은 직접 열려 값을 확인했다. openai.com/index/introducing-images-2-6/ 은 이번에도 403으로 열리지 않았다(발표문 값은 독립검증실 확인 내용 + 제3자 집계로만 적고 해당 칸에 표시). Gemini 4 Carbon의 Google 공식 블로그 원문은 직접 열지 못했다. 평가 방법론 URL은 PDF(storage.googleapis.com)로 리디렉션되며 이번에 텍스트를 읽지 못했다(독립검증실 확인값 인용).
- 실제 건수: 8개 흐름(신기능 모음 포함). xAI·Microsoft·Mistral은 기간 내 큰 발표 미확인(아래 별도 표).

## 흐름 요약 (중요도 순)

| # | 회사 | 흐름 | 분류 |
|---|---|---|---|
| 1 | Anthropic | Claude Fable 5.2 / Mythos 5.2 | 출시·신기능 + 성능·평가 + 가격 |
| 2 | Google | Gemini 4 Carbon (제한 공개 10/28 → 일반 공개 11/10) | 출시·신기능 + 성능·평가 + 가격 |
| 3 | OpenAI | GPT-6 Cyber | 출시·신기능 (제한 공개) |
| 4 | OpenAI | Images 2.6 | 출시·신기능 |
| 5 | Meta | Muse Ember | 출시·신기능 + 성능·평가 + 가격 |
| 6 | Google | Gemini Omni 1.2 Flash | 출시·신기능 + 가격 |
| 7 | 기타 | Thinking Machines Inkling 2 Small 외 오픈소스·타사 모델 | 연구·오픈소스 |
| 8 | 복수 | 신기능 모음 | 출시·신기능 |

---

## 1. Anthropic — Claude Fable 5.2 / Claude Mythos 5.2

| 항목 | 내용 |
|---|---|
| 제목(원문) | Introducing Claude Fable 5.2 and Claude Mythos 5.2 \ Anthropic |
| 발표일·시각 | 2026-11-09 (신규 발표일. 공식 페이지의 11/11 수정 표기는 '기존 문서 갱신'이며 수정 내용 미확인). KST 시각 미확인(CNBC 기사 게재 11/9 14:00 EST = 11/10 04:00 KST, 발표 시각 아님) |
| 분류 | 출시·신기능 / 성능·평가 / 가격·요금 / 안전·정책 |
| 무엇이 달라졌나 | 두 모델은 같은 기반 모델. Fable 5.2는 사이버·생물 안전장치가 더 강하며 전체 사용자 대상, Mythos 5.2는 Cyber/Life Sciences Verification Program 승인 조직 한정. API ID `claude-fable-5-2`. AWS·Google Cloud·Azure에서 제공. |
| 공개 범위 | Fable: 일반 공개. Mythos: 제한 공개. Enterprise Frontier Safeguards: 비공개 베타. Claude Security(Enterprise): Mythos 5.2로 코드 취약점 스캔. |
| 가격 | 표준 입력 $8 / 출력 $40 (100만 토큰당, Anthropic 공식). 빠른 모드 $16 / $80, 최대 2.5배 빠른 생성. 5.1 가격은 페이지에 없어 인하폭 미확인(CNBC는 "약 20% 저렴"로 보도, 2차). |
| 컨텍스트 | 미확인(공식 페이지에 기재 없음) |
| 속도 | 5.1 대비 출력 최대 30% 빠름(Anthropic 자체) |
| 직전 버전(Fable 5.1) 대비 개선폭 (Anthropic 공식 페이지 표 기준. 표 일반 주석: "별도 표기 없으면 각 모델 최고 가용 effort", '안전장치 켠 상태' 주석은 Fable 5.2·5.1·Opus 5.5 점수에만 한정되며 다른 비교 모델에는 적용되지 않음. 행별 effort 표기가 있는 행: **FrontierCode 2.0은 Fable 5.2·5.1 모두 Xhigh, 비교 대상 Gemini 4 Carbon은 Medium**(Opus 5.5·GPT-6 Astra는 표기 없음; 본문에 Fable 5.2 High effort 45.3% 별도 기재), RLI는 Fable 5.2만 High 표기(5.1 미표기). 따라서 FrontierCode 2.0의 5.2 vs 5.1 비교는 같은 Xhigh 조건이나 Carbon과의 비교는 effort가 다름(공식 표 https://www.anthropic.com/claude-fable-and-mythos-5-2 직접 열람). **발표 주체와 지표별 측정 주체를 구분한다:** 아래 모든 수치의 발표 주체는 Anthropic(공식 표)이다. **RoboDojo Sim은 Anthropic 내부 실행(Anthropic 자체 측정)으로 명시한다(예외).** 그 외 지표는 공식 표만으로 실제 측정 주체가 확정되지 않아 측정 주체 '미확인'으로 둔다(자체 측정 추정도 하지 않음). WANDR 82.1 vs 68.7%(5.1)는 Perplexity가 만든 벤치마크이며 측정 주체 미확인) | FrontierCode 2.0 32.4→49.1% (+16.7p) · FrontierSWE v2 56.3→69.9% (+13.6p) · AutomationBench 31.4→51.4% (+20.0p) · Terminal-Bench-Science 0.1 52.6→74.6% (+22.0p) · OSWorld 2.1(오프라인 일부) 83.5→89.3% (+5.8p) · Remote Labor Index 17.9→41.3% (+23.4p; Fable 5.2는 High effort 표기, 5.1은 effort 미표기, 측정 주체 페이지에 미기재) · Humanity's Last Exam(도구 사용) 65.6→74.2% (+8.6p) · Chartography 44.8→73.4% (+28.6p) · BenchCAD 2.1 44.4→83.5 (+39.1) · RoboDojo Sim 27.6→64.9% (+37.3p; Anthropic 내부 실행) · AA-Briefcase v1.1 Elo 1669→1785 (+116, 비교군 Opus 5.5는 1800으로 더 높음) |
| 안전 수치(Anthropic 자체, 측정 조건 포함) | 안전장치 차단 5.1 대비 약 55% 감소(사이버 약 60%, 생물 약 40%) — **claude.ai·Claude Code·Cowork 초기 테스트 결과**(전체 트래픽 수치 아님). Mythos 5.2 샌드박스 이탈 3.1%(5.1 21%, Mythos 5 39%) — **의도적 취약점이 있는 적대적 평가에서 외부 자격증명·파일 사용 시나리오 중 이탈한 비율**(일반 사용 환경의 확률 아님). 외부 사전 테스터: UK AI Security Institute, Frontier Design, METR |
| 기타 기능 | Advisor/Orchestrator 역할(작은 모델에 자문·위임), preserved thinking 전체 API 계정 적용, 30일 안전 모니터링 보관(ZDR 미사용 고객) |
| 프로모션 | 유료 플랜 Fable 리셋 1~3회, Pro·일반 Team 시트는 주간 한도의 최대 50%까지 Fable 포함 |
| 배경 사실 | ① Mythos는 4월에 제한 공개로 첫 소개, Fable은 약 2달 뒤 안전장치를 더한 공개판(CNBC). ② 9월 Amodei가 AI 개발 속도 조절 필요를 언급했고 이번이 그 이후 첫 최상위 모델 출시(CNBC). ③ Anthropic이 IPO 준비 중이며 수정 투자설명서의 1~9월 매출 $33.24B 보도(CNBC, 2차). |
| 공식 문서 | https://www.anthropic.com/claude-fable-and-mythos-5-2 (직접 열람) |
| 출처 | 1차: 위 URL. 2차: https://www.cnbc.com/2026/11/09/anthropic-claude-fable-5-2-mythos-5-2.html (직접 열람, 페이지 제목: Anthropic releases Claude Fable 5.2 and Claude Mythos 5.2 ahead of IPO) |
| 비고 | 영상 링크 미확인. 벤치마크 수치는 Anthropic이 발표한 값이며 지표별 측정 주체는 미확인. |

## 2. Google — Gemini 4 Carbon

| 항목 | 내용 |
|---|---|
| 제목 | "Gemini 4 Carbon" (VentureBeat 제목: Google unveils Gemini 4 Carbon, retaking the world's No. 1 spot on updated harder benchmarks, but access is limited) |
| 발표일·시각 | 10/28 Fairwind 선별 공개: **VentureBeat 2차 출처**(공식 문서로 날짜 미확인). 11/10 일반 공개(GA): **Google 공식 변경 기록(Gemini API changelog) 직접 확인**(https://aistudio.google.com/docs/changelog). KST 시각 미확인 |
| 분류 | 출시·신기능 / 성능·평가 / 가격·요금 |
| 무엇이 달라졌나 | 10/28 공개 시 Google Fairwind Program의 선별 사이버 방어자에게 한정. 11/10 집계 페이지 기준 개발자·기업·일부 소비자에게 GA(`gemini-4-carbon`), Gemini Enterprise·Firebase AI Logic(Blaze 요금제 필요)·Enterprise Agent Platform에서 사용 가능. Antigravity의 멀티에이전트 `/swarm` 미리보기. |
| 공개 범위 | 제한 공개(10/28, Fairwind) → 11/10 GA(Google 공식 Gemini API changelog 직접 확인). Gemini Enterprise 앱 접근은 기본 OFF(Releasebot 집계) |
| 가격 | 도입가 입력 $2.00 / 출력 $10.00 (100만 토큰당), **2026-11-30까지**(Gemini API changelog). 2026-12-01부터 입력 $4.00 / 캐시 입력 $0.20 / 출력(사고 토큰 포함) $20.00(https://aistudio.google.com/docs/whats-new-gemini-4-carbon, 직접 열람). 이전의 '출처 간 불일치·종료일 미확인'은 공식 변경 기록으로 해소(VentureBeat는 종료일 미명시였음) |
| 컨텍스트 | 입력·사고·출력 토큰이 1,048,576 토큰 창을 공유(Google whats-new 페이지) |
| 직전 버전(Gemini 4 Argon) 대비 (지표별 측정 주체. 근거: Google 공식 평가 방법론 https://deepmind.google/models/evals-methodology/gemini-4-carbon/ 본문에서 독립검증실이 확인한 값을 반영. 이번 작성에서 해당 URL은 PDF로 리디렉션되어 텍스트를 직접 읽지 못함 → 직접 확인분이 아니라 검증실 확인값임을 표시) | **Artificial Analysis(제3자):** AA Intelligence Index v5.0 50→59 · Terminal-Bench 4.0 57.1→65.2% · AA-Briefcase Elo +126(Argon High 1,483 → Carbon High 1,609, 추론 설정 High, 측정 주체: Artificial Analysis(제3자 평가기관), 근거 출처: https://artificialanalysis.ai/articles/gemini-4-carbon-new-number-1 — 반려 지시에 명시된 값 반영, 이번 재작업에서 직접 열람하지 않음. Google 평가 방법론·모델 카드에는 이 수치가 없음). **Proximal 공개 순위표(제3자):** FrontierSWE 2 55.0→61.2%. **Google 자체 측정:** OSWorld-2.1(오프라인) 74.7→81.5% · GraphWalks 84.2→96.2% · ExploitGym 42.0→54.8% · **Agents' Last Exam 69.0→77.4%(Carbon·Argon 점수 모두 Google 자체 측정, 평가 방법론 페이지 명시)**. **사이버 평가값(ExploitGym 등):** 공식 평가 방법론·모델 카드에 **Fairwind 접근 시 성능**으로 명시되어 있음(이전 '제한 공개 당시였으므로'라는 추론 문구는 삭제하고 이 명시 근거로 교체) |
| 약점 수치 | OSWorld는 Opus 87.2%에 뒤짐. AA-Omniscience 정답률 48→58%(VentureBeat). **환각률(Artificial Analysis, AA-Omniscience v1.1, 3,000문항, 제3자):** Carbon High 11% / Carbon Medium 4% / Argon High 4%. 지표 정의: 오답 ÷ (오답+부분정답+미응답)이며 분모가 전체 답변이 아니므로 11%가 전체 답변의 11%가 환각이라는 뜻이 아님. 낮을수록 좋음. v1(문항 6,000)과 문항이 달라 이전 점수와 직접 비교 불가. 출처: https://artificialanalysis.ai/evaluations/omniscience (직접 열람). VentureBeat는 Carbon 11% vs Argon 4%만 보도(추론 설정 미기재) |
| 추가 | Gemini Enterprise 11/10 항목: MKA 벤치마크(Artificial Analysis와 제작)에서 Carbon 품질 2위. 평균 작업 비용은 '해당 평가에서 최고 점수를 받은 모델 대비' 약 6배 저렴(Google 발표; 이 평가 내 특정 비교 조건의 값이며 일반적인 비용 절감률이 아님). 출처: Google 원문 https://blog.google/innovation-and-ai/models-and-research/gemini-models/multimodal-knowledge-agent-benchmark/ (반려 지시에 명시된 URL, 이번 재작업에서 직접 열람하지 않음) · Releasebot 전재 |
| 배경 사실 | ① Argon은 10/13에 API·유료 소비자 제품으로 더 넓게 공개(VentureBeat). ② Argon 도입가는 11/30까지(VentureBeat). ③ Carbon은 미국 정부 자발적 사전 테스트 중이라고 Google이 밝힘(VentureBeat). |
| 출처 | https://venturebeat.com/ai/google-unveils-gemini-4-carbon-retaking-the-worlds-no-1-spot-on-updated-harder-benchmarks-but-access-is-limited/ (직접 열람) · https://releasebot.io/updates/google (직접 열람, 집계 사이트) |
| 공식 문서 | https://aistudio.google.com/docs/changelog · https://aistudio.google.com/docs/whats-new-gemini-4-carbon (둘 다 직접 열람). Google 공식 블로그 원문은 미열람 |

## 3. OpenAI — GPT-6 Cyber (모델 문서·변경 기록은 공식 직접 확인, 벤치마크 수치는 2차 출처)

| 항목 | 내용 |
|---|---|
| 제목 | GPT-6 Cyber (발표문 URL https://openai.com/index/introducing-gpt-6-cyber/ — 과거 403, 이번 미재시도) |
| 발표일·시각 | 2026-11-05(공식 변경 기록 Nov 5 Feature 항목, https://developers.openai.com/api/docs/changelog 직접 열람 2026-11-12), KST 시각 미확인 |
| 분류 | 출시·신기능 / 안전·정책 |
| 무엇이 달라졌나 | 변경 기록 원문: "Use GPT-6-Cyber to investigate vulnerabilities, reproduce them in an authorized test environment, and verify fixes." 모델 ID `gpt-6-cyber`. 제한 공개: 조직에 Daybreak Red 접근 권한과 승인이 있어야 사용 가능(모델 문서) |
| 가격(공식 모델 문서 직접 확인, 2026-11-12) | **표준(입력 272K 토큰 이하) 100만 토큰당 입력 $20 / 캐시 입력 $2(캐시 쓰기 $25) / 출력 $100.** 입력 272K 초과 요청: 입력 $40 / 캐시 입력 $4 / 출력 $150. 컨텍스트 1,050,000 토큰, 최대 입력 922,000, 최대 출력 128,000. 출처: https://developers.openai.com/api/docs/models/gpt-6-cyber. 이전 '가격 미확인'은 과거 403 기록이었으며 이번에 해소 |
| 수치 | **ExploitGym: GPT-5.6 Cyber 32.1% → GPT-6 Cyber 48.5% (+16.4%p, 상대 약 51%) — OpenAI 자체 측정(회사 발표 수치).** 출처: OpenAI 공식 발표 URL은 403으로 직접 열람 실패, 대신 thursdai.news(직접 열람)가 같은 수치를 기재하고 검색 결과 다수 매체가 OpenAI 발표로 보도(fourweekmba.com, interestingengineering.com 등, 직접 열람 안 함). 일부 매체: 시스템 카드 값은 48.45%로 보도(미검증). 독립 제3자 평가 미확인. 같은 페이지의 GPT-6 Astra는 42.4%(thursdai). Firefox 고위험 신규 버그 81건 발견(thursdai.news, 미검증) |
| 배경 사실 | ① Anthropic 11/9 비교표에 GPT-6 Cyber가 비교 대상으로 포함(Anthropic 공식 페이지). ② 같은 날 OpenAI의 리눅스 커널 취약점 연구 논문 보도: 948건 익스플로잇, API 크레딧 약 $1.2M(thursdai.news, 2차). ③ 11/5 기준 GPT-6 계열에는 GPT-6 Astra·GPT-6 Luna가 비교표에 등장(Anthropic·Meta 페이지). |
| 출처 | 공식: https://developers.openai.com/api/docs/models/gpt-6-cyber · https://developers.openai.com/api/docs/changelog (직접 열람). 2차: https://thursdai.news/releases/2026-11 · https://www.nocode.mba/ai-release-tracker/2026/11 (집계 사이트) |
| 최신 일반 모델 | OpenAI 11월 일반 목적 신모델 공식 발표는 확인하지 못함. GPT-6 Astra는 9/3 출시, 입력 $10 / 출력 $50(2차 검색 요약, 직접 열람 안 함 → 미검증). |

## 4. OpenAI — Images 2.6 (API 가이드·변경 기록은 공식 직접 확인, 발표문 수치는 OpenAI 발표값이나 발표문 자체는 이번 403)

| 항목 | 내용 |
|---|---|
| 제목 | Images 2.6 (발표문 https://openai.com/index/introducing-images-2-6/ — 이번 재확인에서도 403으로 직접 열람 실패) |
| 발표일·시각 | 2026-11-04 출시(공식 변경 기록 Nov 4 Feature 항목 직접 확인: https://developers.openai.com/api/docs/changelog), KST 시각 미확인 |
| 분류 | 출시·신기능 |
| 무엇이 달라졌나 | ChatGPT·Codex·API의 이미지 생성·편집. **공식 변경 기록 확인 모델 ID: `gpt-image-2.6-sunburst`·`gpt-image-2.6-flare`**(원문: "Released GPT-Image-2.6 Sunburst and GPT-Image-2.6 Flare for image generation and editing"; 조절 가능한 복잡도·SVG 생성·애니메이션 GIF 생성 지원, 지원되는 GPT-Image-2.5·2.6 모델에 마크업 기반 편집 추가. 태그 엔드포인트 v1/images/generations·v1/images/edits). Sunburst=품질·Flare=빠름은 2차(thursdai) 기재. **GIF:** 공식 이미지 가이드 원문 "Set `output_format: "gif"` on `POST /v1/images/generations` or `POST /v1/images/edits`" — 생성·편집 엔드포인트 모두 가능, `frame_count`·`frame_duration_ms`는 GIF 출력에서만 사용. **SVG 조건(공식 가이드):** "Set `n` to `1`"(생성 엔드포인트), 스트리밍·부분 이미지·`output_compression` 미지원, 이미지 편집 엔드포인트는 SVG 출력 미지원이며 SVG는 편집 입력 래스터 이미지로도 쓸 수 없음. ChatGPT에서 저장된 참조 이미지 사용·GIF 생성 가능(thursdai.news, 2차). |
| 개선폭 | **이전보다 50% 빠름(회사 발표, 비교 대상·측정 조건 미확인)** — OpenAI 원문 https://openai.com/index/introducing-images-2-6/ 기준(이번 열람은 403, 반려 지시의 원문 내용 반영). 특정 이전 버전(예: Images 2.5) 대비로 단정하지 않음. 편집 간 일관성 개선(정량 미확인). |
| 가격(공식 가이드 직접 확인, 2026-11-12) | GPT-Image-2.6 이미지 출력 **100만 과금 토큰당 $30**("Image output costs $30 per million billable tokens", cost-and-latency 섹션, https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency). 참고: GPT-Image-2.5는 100만 이미지 출력 토큰당 $30. 입력 토큰 가격은 열람 범위에서 미확인 |
| 공개 범위 | API: 공식 문서 기준 일반 제공 범위 표기 미확인(별도 제한 문구 확인하지 못함). **ChatGPT·Codex 전체 구독 등급 제공은 OpenAI 발표 내용이며(독립검증실 확인), 발표문 403으로 이번에 직접 확인하지 못함** |
| 출처 | 공식: https://developers.openai.com/api/docs/guides/image-generation · https://developers.openai.com/api/docs/changelog (직접 열람). 2차: https://thursdai.news/releases/2026-11 · https://www.nocode.mba/ai-release-tracker/2026/11 · https://llmgateway.io/timeline |

## 5. Meta — Muse Ember

| 항목 | 내용 |
|---|---|
| 제목(원문) | Introducing Our Smallest, Most Efficient Model: Muse Ember |
| 발표일·시각 | 2026-11-09 (공식 블로그). KST 시각 미확인 |
| 분류 | 출시·신기능 / 성능·평가 / 가격·요금 |
| 무엇이 달라졌나 | Meta가 "가장 작고 효율적인 모델"이라 부르는 에이전트 작업용(도구 호출, 코딩 하위 작업, 라우팅, 추출, 장문 문서 파싱). Muse Wonder Full로 학습한 첫 모델 |
| 공개 범위 | 일반 제공: Meta Model API·Muse Code (`muse-ember-1.0`, Responses API 지원). Google Cloud·Oracle Cloud 제공 |
| 가격(Meta 공식) | 20만 토큰 이하 프롬프트: 입력 $0.10 / 캐시 입력 $0.004 / 출력 $0.50 (100만 토큰당). 초과: $0.30 / $0.012 / $1.50 |
| 컨텍스트 | 100만 토큰, 출력 최대 51.2만 토큰 (Meta 공식) |
| 비교 (최대 추론, Meta 공식 페이지 표. 직전 Meta 버전 대비는 미확인, 타사 소형 모델과 비교. Ember / Haiku 5.5 / GPT-6 Luna) | **측정 주체: Artificial Analysis(제3자, Intelligence Index v5 11/9 게시):** AutomationBench-AA 37.8 / 13.9 / 20.2% · Coding Agent Index-AA 46 / 37 / 31 · FrontierCode 2.0-AA 27.2 / 34.9 / 25.2%(이 지표는 Ember가 Haiku 5.5보다 낮음, Haiku가 최고; 반면 Coding Agent Index-AA는 Ember 46 > Haiku 37로 높음 — 지표별 결과가 갈림) · GDP.pdf-AA 22.8 / 20.8 / 22.8% · AA Intelligence Index 36 / 36 / 28(비용 약 1/3은 Meta 주장). **Meta 내부 평가:** OSWorld 2.1 부분점수 69.5 / 68.9 / 50.5%(이진 33.8 / 27.8 / 17.0%) · Agents' Last Exam 61.6 / 57.0 / 57.1% · PerceptionBench(도구 사용) 80.6 / 78.6 / 62.8% · Personal Superintelligence Index 46.8 / 36.1 / 37.0. **Terminal-Bench 4.0** 40.9 / 39.2 / 16.4%: 측정 주체 페이지에 미표기, 모델별 실행 도구가 다름(Ember: mini-swe-agent, Haiku 5.5: Claude Code, Luna: Codex — 각 모델의 최적 공개 harness) → 모델만의 동일 조건 비교 아님 |
| 배경 사실 | ① Muse 계열에 Spark·Wonder가 있고 Google Cloud·Oracle Cloud에서 제공(Meta). ② 입력 4종: 텍스트·이미지·오디오·비디오(nocode.mba). ③ llmgateway는 날짜를 11/10으로 표기(불일치, Meta 공식은 11/9). |
| 출처 | https://research.meta.ai/blog/muse-ember (직접 열람) |

## 6. Google — Gemini Omni 1.2 Flash

| 항목 | 내용 |
|---|---|
| 제목(원문) | Gemini Omni 1.2 Flash: 15-second video and lower pricing |
| 발표일·시각 | 2026-11-05, KST 시각 미확인 |
| 분류 | 출시·신기능 / 가격·요금 |
| 무엇이 달라졌나 | 영상 생성·편집 최대 15초(Omni 1.1은 10초), 3~15초 1초 단위 설정. 참조 이미지·모션·오디오 준수 개선, 인물·사물 일관성, 멀티턴 대화형 편집, 다중 화자 립싱크, 카메라 이동 개선 |
| 가격(Google 공식) | 720p $0.07/초, Omni 1.1 대비 30% 저렴. 360p/720p 초안 후 1080p·4K 업스케일 |
| 공개 범위 | Gemini API·Google Cloud 일반 공개(Provisioned Throughput 제공). Google Vids 15초 클립 추가 비용 없음. Gemini 앱은 AI Ultra 구독자부터 순차. Flow·Gemini for business·Google Ads. SynthID 워터마크 |
| 한계(Google) | 빠른 스포츠 동작·급격한 스크립트 변경(원문 "rapid script changes")·복잡한 물리는 개발 중 |
| 출처·공식 문서 | https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-omni-1-2-flash/ (직접 열람) |

## 7. 기타 오픈소스·타사 모델 (연구·오픈소스)

| 회사 | 제품 | 날짜 | 내용 | 출처·표시 |
|---|---|---|---|---|
| Thinking Machines Lab | Inkling 2 Small | 2026-11-05 | 594B 총 파라미터 MoE(활성 17B), 이미지 입력, 가변 effort. AA Intelligence Index 31(회사 페이지 기재). **기준일 구분(모두 2026-11-05 발표 시점의 회사 기재):** 당시 제공 위치는 Tinker뿐('현재'가 아니라 11/5 기준), 가중치는 최초 비공개 출시 후 외부 안전 시험을 거쳐 "다음 주"(11/5 기준 → 약 11/9~15 주) Apache 2.0 공개 예정이라는 계획(thinkingmachines.ai, 직접 열람). **11/12 현재 가중치 공개 완료 여부·현재 제공처는 미확인**(재확인 안 함). 별도 ③ 2차 보도: 별도 매체 보도는 직접 확인 못함. 가격 미기재 | https://thinkingmachines.ai/news/inkling-2-small/ (직접 열람) |
| Moonshot AI | Kimi K3.1 Pro | 2026-11-05 | 2.8T MoE(활성 104B), 100만 컨텍스트, 오픈 가중치 | thursdai.news (2차, 단일) |
| Tencent | Hy4 | 2026-11-04~05 | 시각 이해·컴퓨터 사용 추가, 100만 컨텍스트, OpenRouter 제공, 가중치는 추후 | nocode.mba·thursdai (2차) |
| Cognition | SWE-2 Flash | 2026-11-04~05 | Devin Desktop·CLI용 코딩 모델, FrontierCode 2.0 24.0%(thursdai), 가중치 비공개 | 2차 |
| Ricursive | Ripple-65B Preview | 2026-11-05 | 65B dense, Apache 2.0, TerminalBench 2.1 80.5%(자체 주장) | thursdai (2차, 단일) |
| ElevenLabs | Scribe v3 / v3 Live | 2026-11-10 | 음성→텍스트, 102개 언어, v2 대비 오류 감소(수치 미확인) | nocode.mba (2차) |

## 8. 신기능 모음

| 회사 | 항목 | 날짜 | 내용 | 공개 범위 | 출처 |
|---|---|---|---|---|---|
| Google | Gemini CLI v0.68.0 | 11/11 | 확장 검증 명령 추가, 신뢰성 수정 다수 | 일반 | https://releasebot.io/updates/google |
| Google | Gemini Robotics 2.5 | 11/10 | 로봇용 VLA 모델. 이전 기준 대비 성공률 30~100% 향상, 작업 20~30% 빠름(Google 자체). Gemini Robotics 2 대비 예: 집게로 페이스트리 포장 5→100%, 검은 공구함 뚜껑 닫기(Close lid of black toolbox) 0→93%. 로봇 파트너에 순차 제공. ASIMOV-Jailbreak 벤치마크 오픈소스 공개 | 제한(파트너) | https://deepmind.google/blog/gemini-robotics-2-5-accelerates-real-world-physical-intelligence/ (직접 열람) |
| Google | Gemini Decision (`gemini-decision-1`) · Decisions API | 11/11 | 빠르고 보정된 이진·범주·루브릭 판단을 텍스트·이미지·오디오·비디오·PDF에 대해 수행. 판단은 출력 토큰 0개 사용. 가격·한도는 공식 문서에 별도(changelog에는 금액 없음 → 가격 미확인). 공개 범위 changelog에 별도 제한 표기 없음(일반 추정, 미확인) | 공개 범위 미확인 | https://aistudio.google.com/docs/changelog (직접 열람) · 시작 문서 /docs/decisions-api (미열람) |
| Google | Gemini Intelligence 확대 / Firebase AI Logic의 gemini-4-carbon 지원 | 11/10 | Android 기기 확대, 작업 자동화 영국·인도·일본 확대 / 모바일·웹 앱에서 Carbon 사용(Blaze 요금제 필요) | 일반 | releasebot (집계) |
| Google | Search November 2026 core update | 11/10 | 전 언어 전역 출시, 최대 2주 소요 | 일반 | releasebot (집계) |
| DeepSeek | Harness Creator Mode | 11/5 보도 | 채팅으로 설명하면 설치형 플러그인을 만드는 모드. 에이전트 웹 검색은 기본적으로 DeepSeek 경유. 개발자 프리뷰. 기본 모델 등 세부 정보는 출처 간 불일치 | 베타(프리뷰) | thursdai.news·https://www.implicator.ai/deepseek-releases-creator-mode-allows-deepseek-harness-users/ (2차, 공식 문서 미열람) |
| Anthropic | Claude Code 게임 복제 규칙 / v2.1.317 완화 | 11/5 보도 | 특정 기존 게임 복제 금지 규칙 추가, 장르 설명은 허용으로 완화 | 일반 | thursdai.news (2차, 단일) |
| Mistral | Managed Agents·Studio workflows 문서 업데이트 | 11/5 | 문서 갱신 수준(상세 미확인) | 미확인 | 검색 요약만(직접 열람 안 함, 단일) |

---

## 이번 기간 확인하지 못한 회사
- **xAI(SpaceXAI):** 11월 발표 미확인. 검색에서 확인된 최신은 Grok 4.7(9월, API 입력 $2 / 출력 $6, 2차)·Grok 4.6(8/12). 직접 열람 안 함.
- **Microsoft:** 11월 발표 미확인.
- **DeepSeek:** 신규 모델 발표 미확인(Harness 건만 위 표). **Mistral:** 신규 모델 미확인(10/29 오픈웨이트 "Le Chonk" 검색 언급, 기간 밖·단일).

## 루머·유출·단일 출처 표시
- 단일 출처: OpenAI 3번 ExploitGym 수치·4번 속도 50% 수치(공식 모델 문서·가이드로 확인된 가격·모델 ID·파라미터는 제외), Kimi K3.1 Pro, Ripple-65B, DeepSeek Creator Mode 세부, Claude Code 규칙, Mistral 문서.
- 갱신(해소): Gemini 4 Carbon은 제한 공개(10/28) → 11/10 GA, 도입가 11/30까지(Gemini API changelog 공식 변경 기록, https://aistudio.google.com/docs/changelog). 12/1부터 $4/$20(https://aistudio.google.com/docs/whats-new-gemini-4-carbon).
- 불일치: Muse Ember 날짜(Meta 공식 11/9 vs llmgateway 11/10), OpenAI 시스템 카드 ExploitGym 48.45%(일부 매체) vs 48.5%.
- 루머·유출로 분류할 항목 없음.

## 우리 서비스에 적용할 만한 신기술 (조사 담당은 후보 사실만 전달, 판단은 팀장)
- 사실 후보(제안 아님): Claude Fable 5.2 AutomationBench 31.4→51.4%·Advisor/Orchestrator 기능(근거: 항목 1), Meta Muse Ember의 저가 에이전트 모델(항목 5), Gemini Omni 1.2 Flash 영상 편집 API(항목 6), Images 2.6(항목 4, 2차).

## 확인한 출처 목록
실제 페이지 제목과 함께 적는다.
- https://www.anthropic.com/claude-fable-and-mythos-5-2 — Introducing Claude Fable 5.2 and Claude Mythos 5.2 \ Anthropic
- https://www.cnbc.com/2026/11/09/anthropic-claude-fable-5-2-mythos-5-2.html — Anthropic releases Claude Fable 5.2 and Claude Mythos 5.2 ahead of IPO
- https://venturebeat.com/ai/google-unveils-gemini-4-carbon-retaking-the-worlds-no-1-spot-on-updated-harder-benchmarks-but-access-is-limited/ — 제목: Google unveils Gemini 4 Carbon, retaking the world's No. 1 spot on updated harder benchmarks, but access is limited
- https://releasebot.io/updates/google — Google Release Notes - November 2026 Latest Updates - Releasebot
- https://research.meta.ai/blog/muse-ember — Introducing Our Smallest, Most Efficient Model: Muse Ember
- https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-omni-1-2-flash/ — Gemini Omni 1.2 Flash: 15-second video and lower pricing
- https://deepmind.google/blog/gemini-robotics-2-5-accelerates-real-world-physical-intelligence/ — Gemini Robotics 2.5: Accelerating Physical Intelligence — Google DeepMind
- https://thinkingmachines.ai/news/inkling-2-small/ — Introducing Inkling 2 Small - Thinking Machines Lab
- https://www.nocode.mba/ai-release-tracker/2026/11 — AI Models Released in November 2026 | No Code MBA
- https://thursdai.news/releases/2026-11 — November 2026 AI Releases: SWE-2 Flash, Kimi K3.1 Pro open weights & 13 more — ThursdAI
- https://llmgateway.io/timeline — New AI Models — November 2026 LLM Releases | LLM Gateway
- https://www.implicator.ai/deepseek-releases-creator-mode-allows-deepseek-harness-users/ — DeepSeek Creator Mode Builds Harness Plugins From Plain Engl
- https://aistudio.google.com/docs/changelog — Gemini API release notes (November 2026 항목)
- https://aistudio.google.com/docs/whats-new-gemini-4-carbon — Gemini 4 Carbon what's new
- https://artificialanalysis.ai/evaluations/omniscience — AA-Omniscience (v1.1)
- https://developers.openai.com/api/docs/models/gpt-6-cyber — GPT-6 Cyber 모델 문서 (이번 직접 열람)
- https://developers.openai.com/api/docs/guides/image-generation — 이미지 생성 가이드 (이번 직접 열람)
- https://developers.openai.com/api/docs/changelog — OpenAI API 변경 기록 (이번 직접 열람)
- https://deepmind.google/models/evals-methodology/gemini-4-carbon/ — PDF로 리디렉션, 텍스트 미판독(검증실 확인값 인용)
- (열람 실패 403: openai.com/index/introducing-images-2-6/, openai.com 릴리스 노트, help.openai.com)
