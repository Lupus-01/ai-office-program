# 대장급 AI 모델 개선사항 조사 (확인일 2026-11-12)

조사 기간: 각 회사 최신 플래그십 1건(2026-09 ~ 2026-11-10 발표). 총 6건 기재. 단 직접 연 1차 출처로 확인된 것은 3건(Anthropic 문서, Google 블로그, xAI 공지)이고, 나머지 3건은 2차 출처다. 표시 규칙: [직접]=직접 연 회사 페이지, [2차]=언론·제3자 페이지 경유(1차 미확인).

## 1. Anthropic — Claude Fable 5.2 / Mythos 5.2
| 항목 | 내용 |
|---|---|
| 발표일 | 2026-11-09 (Claude Platform release notes 기준). Yahoo Finance 기사는 "Monday, November 10"으로 적어 하루 차이 있음 |
| 직전 모델 대비 | 가격: 입력 $10→$8, 출력 $50→$40 per MTok (-20%) [직접, 회사 문서]. 속도: 빠른 모드 최대 2.5배 출력 토큰/초 (입력 $16·출력 $80) [직접]. "5.1보다 약 30% 빠르다"는 기사 서술 [2차, 비교 기준 불명확] |
| 컨텍스트 | 1M 토큰, 최대 출력 128k [직접] |
| 성능 수치 | 벤치마크 점수 미확인 (확인한 페이지에 없음). 코딩·추론·비전 개선이라는 정성 서술만 [2차] |
| 특이사항 | Mythos 5.2는 Cyber Verification Program 등 인증 기관 한정. 30일 데이터 보관 필수(ZDR 불가). computer use는 `computer_toolset_20260801` 필요 [직접] |
| 출처 | "Claude Platform release notes - Claude Platform Docs" https://platform.claude.com/docs/en/release-notes/overview ; "Anthropic debuts Claude Fable 5.2 and Mythos 5.2 models as IPO nears" https://finance.yahoo.com/technology/article/anthropic-debuts-claude-fable-52-and-mythos-52-models-as-ipo-nears-190405087.html |
| 비고 | anthropic.com 공식 발표문은 직접 열지 못함. qz.com은 403 |

## 2. OpenAI — GPT-6.1 Sol (GPT-6 계열)
| 항목 | 내용 |
|---|---|
| 발표일 | 2026-09-29 [2차: CometAPI] |
| 직전 모델 대비 | GPT-6 Sol 대비 캐시 입력 $0.20→$0.10/M. 표준 가격 입력 $2·출력 $10/M 동일. DeepSWE v1.1 +6.4p, OSWorld 2.0 +7p, 어려운 프롬프트 오류율(low effort) 11.4%→7.7% (OpenAI 보고 수치를 인용한 2차 서술) |
| 컨텍스트 | 1.05M 토큰, 출력 최대 128K [2차] |
| 특이사항 | GPT-6 Astra(2026-09-03 롤아웃)는 OpenAI 첫 "Critical" 사이버 위험 등급으로 고급 사이버 기능이 Daybreak 프로그램 등에 제한됨 [2차: CNBC]. 2026-10-07 "GPT-6 and Intelligent UI"로 ChatGPT에 Sol(유료)·Luna(무료) 배포 [검색 요약, 미확인] |
| 출처 | "What is GPT-6.1 Sol" https://www.cometapi.com/what-is-gpt-6-1-sol/ ; "OpenAI announces rollout of GPT-6 Astra model" https://www.cnbc.com/2026/09/03/open-ai-astra-gpt-6-cyber.html |
| 비고 | **openai.com 페이지는 403으로 열지 못함. 1차 미확인.** "플래그십"이 Astra(제한 공개)인지 Sol(일반 공개)인지 확정 못 함. 가정: 일반 사용자가 쓰는 최신 모델인 6.1 Sol 기재. 사이트마다 모델명 혼재(GPT-5.6 Sol 표기도 있음). 수치는 회사 발표를 제3자가 옮긴 것 |

## 3. Google — Gemini 4 Carbon
| 항목 | 내용 |
|---|---|
| 발표일 | 2026-11-10 [직접] |
| 직전(Argon) 대비 | 공격 시뮬레이션 침해율 3.1%→0.8%; Gray Swan 자동 사이버공격 질의 성공률 9.86%→2.17%; 에이전트 정직성 벤치 70%→92% [직접, 회사 발표] |
| 외부 벤치 | CursorBench 4.0, WANDR, AutomationBench 1위(절대 점수 미공개); Artificial Analysis 멀티모달 지식 에이전트 2위 [회사 발표] |
| 가격 | 도입가 입력 $2·출력 $10/M(Argon과 동일), 2026-11-30부터 $4/$20 [직접] |
| 컨텍스트 | 미기재 |
| 특이사항 | Argon보다 토큰을 더 많이 사용. 대부분의 코딩·지식 업무엔 Argon을 권장. 사이버용 Carbon은 Fairwind 프로그램(신청제). 앱은 AI Ultra 구독자 대상 |
| 출처 | "Gemini 4 Carbon is now available" https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-carbon-now-available/ |

## 4. xAI — Grok 4.7
| 항목 | 내용 |
|---|---|
| 발표일 | 2026-09-21 [직접] |
| 직전(Grok 4.6) 대비 (회사 발표, xAI 자체 수치) | CursorBench 4.0 40.4→46.3%; Terminal-Bench 4.0 20.3→37.6%; DeepSWE v1.1 65.2→71.0%(effort 설정 상이); EEBench 53.0→64.0%; HealthBench Professional 48.5→56.7% |
| 타사 비교(xAI 표) | Terminal-Bench 4.0에서 Fable 5.1 57.9%, Grok 4.7 37.6%. 즉 모든 항목 1위는 아님 |
| 가격·속도 | $2/$6 per M, 4.6과 동일 가격·속도. Fast 변형은 속도 2배·가격 2배 [직접] |
| 컨텍스트 | 500K [2차: ai-toolbox] |
| 특이사항 | 더 큰 새 베이스 모델, 장시간 과제 중심 RL, 새 안전장치. 사이버 레드팀 기능은 일부 파트너 초대제. 후속 Grok 4.8·5 일정은 공식 확인 못함(루머/미확인) |
| 출처 | "Introducing Grok 4.7" https://x.ai/news/grok-4-7 ; "Grok Models Explained: Grok 4.7, 4.6, 4.5 and 4.3 (2026)" https://www.ai-toolbox.co/grok-models/grok-models-explained-2026 |

## 5. Meta — Muse Wonder (미리보기) / Llama 계열은 Llama 4가 마지막
| 항목 | 내용 |
|---|---|
| 발표일 | Muse Wonder 2026-10-12 (preview) [2차]; Llama 4 2025-04 |
| 내용 | Meta의 최신 플래그십은 Llama가 아닌 Muse 계열(비공개 모델). Muse Spark 1.3(2026-09-02), Muse Spark Open(2026-10-15, 오픈 웨이트) |
| 수치 | Muse Wonder 컨텍스트 1,048,576, 가격 $4/$20 per M [2차]. 벤치마크 점수 미확인(출처에 차트만 있고 수치 없음). 직전 모델 대비 개선 폭 미확인 |
| 특이사항 | Llama 4는 라이선스상 EU 사용 제외. Meta의 EU 데이터 레지던시 문서 없음 [2차] |
| 출처 | "Meta Llama & Muse: Versions, Benchmarks & EU Availability" https://innfactory.ai/en/ai-models/meta-llama/ (innFactory 컨설팅 작성, 2026-10-28 갱신) |
| 비고 | **Meta 공식 페이지 미확인.** 단일 2차 출처라 확정 아님. "Llama"로 지정된 대상이 없어 Muse로 대체했으며 이는 가정 |

## 6. DeepSeek — V4.1-Flash-1017
| 항목 | 내용 |
|---|---|
| 발표일 | 2026-10-17 (기사 2026-10-18) [2차: SiliconANGLE] |
| 직전(9월 V4.1-Flash) 대비 | DeepSWE v1.1 74.2%→77% (회사 발표). "작업 수행 시간·출력 길이 감소"라 했으나 감소폭 미공개 |
| 타사 비교(기사) | Claude Opus 5가 DeepSeek 공개 벤치 11개 중 7개에서 앞섬 |
| 가격 | 9월 출시가 유지(비피크 미캐시 입력 $0.15/M). Search·Fetch API $0.75/1,000건 |
| 컨텍스트 | 미확인 |
| 특이사항 | 가중치 Hugging Face 공개(MIT). 기존 `deepseek-flash` ID로 접근 |
| 출처 | "DeepSeek releases updated V4.1-Flash model it says completes tasks faster" https://siliconangle.com/2026/10/18/deepseek-releases-updated-v4-1-flash-model-it-says-completes-tasks-faster/ |
| 비고 | DeepSeek 공식 페이지 미확인. V4-Pro-0813(2026-08-13)이 더 상위 모델일 수 있음(미확인). 가정: 가장 최근 발표인 Flash-1017 기재 |

## 확인 필요·한계
- 6건 채움. 1차 출처 직접 확인은 Claude(문서), Gemini, Grok. GPT·Meta·DeepSeek은 2차 출처만 근거이며 openai.com 등은 403.
- 사실: 위 표의 날짜·수치는 해당 출처에 적힌 값이다. 추정: 모델 선정(각 사의 "플래그십")은 가정이며 위 비고 참조.
- 해석·시사점은 쓰지 않았다.
