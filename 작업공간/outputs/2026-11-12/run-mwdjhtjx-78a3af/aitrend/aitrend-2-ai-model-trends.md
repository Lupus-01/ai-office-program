# 대장급 AI 모델 개선 동향·신기술 자료 수집 (조사 담당 원본)

- 조사 기간: 최근 약 3개월(2026-08 ~ 2026-11-12). 확인일: 2026-11-12
- 범위: Anthropic·OpenAI·Google 중심. xAI·Meta·DeepSeek은 의미 있는 발표만(확인 수준 낮음, 아래 4절).
- 표기: [확인]=직접 연 페이지에서 확인 / [2차]=언론·제3자 / [미확인]=못 채움. 수치는 모두 회사 자체 발표 수치이며 제3자 검증이 아님(별도 표기 제외).
- 건수: Anthropic 2건(Opus 5.5, Fable/Mythos 5.2; Fable/Mythos 5.1은 직접 확인 못 함), Google 2건, OpenAI 2건(GPT-6 Astra는 2차, GPT-6 Cyber 2차). 부족 사유: OpenAI 공식 페이지(help.openai.com 릴리스 노트)가 403으로 열리지 않았고 openai.com 발표문이 검색에 안 잡힘.

## 1. Anthropic (Claude)

### 1-1. Introducing Claude Fable 5.2 and Claude Mythos 5.2 \ Anthropic — 2026-11-09 (11-11 수정) [확인]
출처: https://www.anthropic.com/claude-fable-and-mythos-5-2 (확인 2026-11-12)

| 항목 | Fable 5.2 | 이전(Fable 5.1) |
|---|---|---|
| FrontierCode 2.0 (Xhigh) | 49.1% | 32.4% |
| FrontierSWE v2 | 69.9% | 56.3% |
| AutomationBench | 51.4% | 31.4% |
| Terminal-Bench-Science 0.1 | 74.6% | 52.6% |
| OSWorld 2.1 (offline, partial) | 89.3% | 83.5% |
| Remote Labor Index | 41.3% | 17.9% |
| Humanity's Last Exam (도구 사용) | 74.2% | 65.6% |
| Chartography (도구 없음) | 73.4% | 44.8% |
| AA-Briefcase v1.1 (Elo) | 1785 | 1669 |

- Mythos 5.2 vs 5.1: CyScenarioBench 76.3% vs 61.7%, CVE Rediscovery 89.6% vs 78.3%.
- 가격: 입력 $8 / 출력 $40 (100만 토큰당). 페이지에는 5.1 가격 기재 없음. 2차 출처(CNBC·Quartz 검색 요약)는 5.1이 $10/$50, 20% 인하라고 보도 [2차, 직접 미확인].
- 속도: 5.1 대비 출력 최대 30% 빠름. 선택형 fast mode 최대 2.5배(가격 $16/$80). Medium effort에서 어려운 과제에 5.1보다 토큰 적게 사용.
- 컨텍스트 길이: 페이지에 없음 [미확인].
- 새 기능: fast mode, Preserved thinking 전 API 계정 적용, Enterprise Frontier Safeguards(비공개 베타), Claude Security(저장소 상시 스캔·API/MCP 연동), Advisor·Orchestrator 역할, 안전 분류기 차단 약 55% 감소.
- 제공: Fable 5.2 전 플랫폼(AWS·Google Cloud·Azure), API ID `claude-fable-5-2`. Mythos 5.2는 검증 프로그램(사이버·생명과학) 참여 기관 한정.

### 1-2. Introducing Claude Opus 5.5 \ Anthropic — 2026-09-22 [확인]
출처: https://www.anthropic.com/claude-opus-5-5 (확인 2026-11-12)

| 항목 | Opus 5.5 | Opus 5 | Fable 5.1 |
|---|---|---|---|
| Terminal-Bench 4.0 | 66.4% | 52.3% | 55.8% |
| FrontierCode v1.1 (Main) | 54.4% | 48.0% | 50.3% |
| CursorBench 4.0 | 57.8% | 46.6% | 51.8% |
| GDPval-AA v2.1 (Elo) | 1846 | 1708 | 1735 |
| OSWorld 2.1 (partial) | 81.8% | 74.0% | 80.7% |
| 가격 입력/출력($/100만) | $4/$20 | $5/$25 | — |
| 캐시 읽기 | $0.20 | $0.50 | — |

- 같은 표에서 GPT-6 Astra가 AutomationBench(41.4% vs 40.0%)·Terminal-Bench-Science(64.6% vs 58.7%)는 더 높음(Anthropic 자체 표).
- 회사 설명: 대부분 작업에서 Fable 5.1 수준, Opus 5보다 약 40% 저렴(일반 작업 기준).
- 새 기능: effort 단계(low~max, 기본 medium), fast mode($8/$40), thinking 끌 수 없음, 행동 실행 전 분류기 검사, 오픈소스 샌드박스·코드 리뷰(엔터프라이즈), EU AI Act 대응 워터마킹. 5시간 사용 한도 상향(Pro·Max·Team 등).
- 예고: Sonnet 5.5·Haiku 5.5는 "수 주 내" 출시 예정(출시 여부 미확인). API ID `claude-opus-5-5`, 전 플랫폼, ZDR 지원. 컨텍스트 길이 [미확인].

## 2. OpenAI (GPT)

### 2-1. GPT-6 Astra — 2026-09-03 롤아웃 시작 [2차]
출처: https://www.cnbc.com/2026/09/03/open-ai-astra-gpt-6-cyber.html (직접 열람, 페이지 제목 "OpenAI announces rollout of GPT-6 Astra model"), 가격·API는 제3자 사이트(computingforgeeks, pasqualepillitteri 등, 직접 미열람, 상호 불일치).
- 확인(CNBC): 컴퓨터 사용·SW 엔지니어링·전문업무·과학에서 "state-of-the-art"라 주장. 다단계 워크플로 등 에이전트 능력 향상. 첫 "Critical" 사이버 임계치 도달로 접근 제한(Daybreak 프로그램 우선 → ChatGPT Plus/Pro/Business/Enterprise·API·AWS). 벤치마크·가격 수치는 CNBC에 없음.
- 이전 모델(GPT-5.6 Sol) 대비 수치: Anthropic Opus 5.5 페이지의 비교표에만 등장(Astra Terminal-Bench 4.0 57.9% vs Sol 37.3% 등, Anthropic 측정·발표). OpenAI 공식 수치는 [미확인].
- 2차 주장(미검증): 가격 $10/$50, API명 gpt-6-astra, 컨텍스트 약 1.05M. 출처 간 불일치(일부 $5/$25) — 사용 금지 수준.
- 보도: GPT-6.1 Astra 출시 계획이 취소됨(Register, 아래).

### 2-2. OpenAI releases GPT-6 Cyber, and promises this one stays within 'rules of engagement' — 2026-11-05 [2차, 보도 직접 열람]
출처: https://www.theregister.com/security/2026/11/05/openai-releases-gpt-6-cyber-and-promises-this-one-stays-within-rules-of-engagement/5307855
- 사이버 특화 모델. OpenAI ExploitGym 평가 48.5%(GPT-5.6 Cyber 32.1%), 범위 이탈 회피 99% 이상(OpenAI 자체 평가).
- 제공: API·Codex, 승인된 "Daybreak Red" 고객 한정, 수 주 내 확대 예정. 일반 서비스 적용과는 거리 있음.

### 2-3. 기타(검색 요약 수준, 날짜 미확인)
GPT-5.6 Sol/Luna, GPT-6.1 Terra, GPT-5.5 Instant 언급이 OpenAI 릴리스 노트에 있다는 검색 요약만 확보. 날짜·수치 [미확인].

## 3. Google (Gemini)

### 3-1. Gemini 4 Carbon: our next frontier model — 2026-10-28 [확인]
출처: https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-carbon/ (확인 2026-11-12)
- Artificial Analysis Intelligence Index v5.0 59점 1위(제3자 지수, 구글 인용). SEC-bench Pro 88.2%, ExploitGym 54.8%, CWE-bench 71.0%(Argon 대비 수치는 일부 "2배 이상" 등 상대 표현만).
- 프롬프트 인젝션(Gray Swan IPI) 공격 성공률 0.0% (Argon 0.7%). 근거 없는 주장 약 절반 감소, 과잉 행동 26% 감소(구글 내부, 미검증).
- 장시간(수일) 에이전트 작업 강조. 가격 $2/$10 (도입가, Argon 후 $4/$20), 캐시 입력 95% 할인.
- 제공: 일부 사이버 방어자(Fairwind Program) 한정, 일반 출시일 미정.

### 3-2. Introducing Gemini 4 Argon — 2026-09-30 [확인]
출처: https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/ (확인 2026-11-12)
- DeepSWE v1.1 77.9%, LVBench(긴 영상) 91.7%, AutomationBench(Zapier) 51.3% 1위 주장, CWE-bench v1 68%. Gemini 3.x와의 직접 수치 비교는 페이지에 없음 [미확인].
- 가격 입력 $2/출력 $10(도입가) → 도입 기간 후 $4/$20. 출력 토큰 한도 64K → 1M. (도입가 종료일 2026-11-30은 검색 요약 정보, 페이지 직접 확인 못 함.)
- 제공: 페이지 기준 사이버 방어자·내부팀 우선, 유료 API·AI Ultra 순차. 이후 정식 제공은 2차 검색 요약(Google Cloud 블로그 URL 존재, 직접 미열람).

## 4. 기타 회사 (검색 요약만, 직접 미열람 — 참고용)
- xAI: Grok 4.5(2026-07-08), Grok 4.6(개발자 문서 8-21). 기간 내 일부. 수치 없음.
- Meta: Muse Spark 1.2(8-05), Muse Glimmer 30B 오픈웨이트(8-10, Apache 2.0). Llama 계열 지위는 출처 간 불일치.
- DeepSeek: V4 계열 정식 출시 7-31(기간 이전). 10~11월 확정 발표 못 찾음.
- 모두 저품질 블로그 위주 → 팀장 판단 시 보고서에서 제외하거나 "미확인" 표기 권장.

## 5. 우리 서비스 적용 후보 (제안 — 사실 아님)

| 서비스 | 기술 후보 | 근거(출처) | 가능한 적용 예시 |
|---|---|---|---|
| 사무자동화(AI Office) | 에이전트 성능 향상: AutomationBench Fable 5.2 51.4%(5.1 31.4%), Gemini 4 Argon 51.3% | 1-1, 3-2 | 직원 AI에 최신 모델 적용 시 반복 업무 자동화 성공률 향상 기대 |
| 사무자동화 | Advisor·Orchestrator 역할, effort 단계, fast mode | 1-1, 1-2 | 팀장 취합은 고성능·실무는 저비용 모델로 분담, 비용·속도 조절 |
| 사무자동화 | Opus 5.5 가격 인하($4/$20, 캐시 읽기 $0.20) | 1-2 | 반복되는 지침 프롬프트 캐시 활용 비용 절감 |
| 사무자동화 | 행동 전 분류기·샌드박스·프롬프트 인젝션 방어(Gray Swan 0.0%) | 1-2, 3-1 | 브라우저 자동화 직원의 안전장치 설계 참고 |
| 홍카페 | 컴퓨터 사용 향상(OSWorld 2.1 89.3%) | 1-1 | 상담사 등록·프로필 제작 반복 폼 작업 자동화 검토 |
| 홍카페 | 긴 문서·표 이해(Chartography, Remote Labor Index 향상) | 1-1 | 상담사 제출 서류·이력 정리, 프로필 초안 작성 |
| 꼬리별 관측소 | 긴 영상 이해 LVBench 91.7% | 3-2 | 반려동물 영상 콘텐츠 요약·태깅 |
| 꼬리별 관측소 | 프롬프트 인젝션 내성, 안전 분류기 | 3-1, 1-1 | 댓글 운영 자동화 시 악성 지시 방어 (정확한 서비스 구조는 모름, 일반 방향) |

## 6. 확인 필요
1. OpenAI 공식 발표·릴리스 노트(403)로 Astra·Terra·Sol/Luna 날짜·수치 재확인 필요.
2. Fable/Mythos 5.1(2026-09-01)은 검색 요약에만 존재, 직접 미확인.
3. Fable 5.2 컨텍스트 길이, Opus 5.5 컨텍스트 길이 미확인.
4. Sonnet 5.5·Haiku 5.5 출시 여부 미확인.
