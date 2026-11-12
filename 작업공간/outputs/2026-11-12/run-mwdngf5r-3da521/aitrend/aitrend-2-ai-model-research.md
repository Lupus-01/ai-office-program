# AI 모델·신기능 조사 원본 (2026-11-12, aitrend-2)

- 조사 기간(가정): 2026-11-04 ~ 11-12 / 확인일: 2026-11-12
- 입력: 지난 브리핑 HTML(`보관함/최종산출물/2026-11-12/…run-mwdmined-cae197/일일 AI 브리핑_…html`) 8개 흐름 재확인
- 이번에 직접 연 페이지: Anthropic 발표, Gemini API changelog, Gemini 4 Carbon 문서, OpenAI API changelog, Thinking Machines Inkling 2 Small, Meta Muse Ember 블로그 (6곳). 그 밖의 회사는 검색 요약(2차)만 확인.
- 해석 없이 사실만 정리. "확인한 범위에서는"의 결과이며 전체 발표 목록이 아님.

## 한눈에: 지난 보고 대비 상태

| # | 흐름 | 상태 | 요지 |
|---|---|---|---|
| 1 | Claude Fable 5.2 | 갱신 | 표 항목 추가 확인(속도·프로모션·추가 벤치), 컨텍스트는 여전히 미기재 |
| 2 | Gemini 4 Carbon | 갱신(소) | 12/1 이후 가격·컨텍스트를 문서에서 직접 확인. 벤치마크는 이번 문서에 없음 |
| 3 | GPT-6 Cyber | 변동 없음 | changelog 11/5 항목 동일, 11/6 이후 새 항목 없음. 가격 미확인 |
| 4 | OpenAI Images 2.6 | 변동 없음 | changelog 11/4 동일 |
| 5 | Meta Muse Ember | 갱신 | 공식 블로그 직접 열람. AutomationBench-AA 등 지표 추가, 비용 표기 불일치 발견 |
| 6 | Gemini Omni 1.2 Flash | 갱신 | changelog 기준 세부 기능(30초 확장·참조 이미지 6개) 확인 |
| 7 | Inkling 2 Small | 변동 없음 | 여전히 비공개·Tinker 한정, "다음 주" 공개 계획만 기재 |
| 8 | 신기능 모음 | 변동 없음(+소 갱신) | SIP·Decision·문서 입력·자동 전환 일정 changelog에서 재확인 |
| - | xAI/Microsoft/Mistral/DeepSeek | 신규(2차) | 11월 신모델 발표는 확인 못함. 아래 9번 |

## 1. Claude Fable 5.2 / Mythos 5.2 — 갱신
- 제목(원문): "Introducing Claude Fable 5.2 and Claude Mythos 5.2 \ Anthropic"(페이지 제목) / 발표 2026-11-09(페이지에 "Edit 11 November" 표기). KST 시각 미확인.
- 출처: https://www.anthropic.com/claude-fable-and-mythos-5-2 (직접 열람 2026-11-12) / 분류: 성능·평가
- 가격: 표준 입력 $8·출력 $40 / 100만 토큰(Anthropic 가격표). 빠른 모드 $16·$80, 생성 최대 2.5배 빠름. 출력 생성 속도는 5.1 대비 최대 30% 빠름(Anthropic 자체 기재). 5.1 가격은 페이지에 없어 인하 폭 미확인.
- 공개: Fable 5.2 전 플랫폼(API ID `claude-fable-5-2`, AWS·Google Cloud·Azure 제공 명시). Mythos 5.2는 사이버·생명과학 검증 프로그램 승인 기관 한정. 유료 플랜 프로모션: Pro·Team 표준 좌석에 주간 한도 최대 50%까지 Fable 포함. 컨텍스트 길이: 페이지 미기재(미확인).
- 11/11 수정: "Mathematical formalization" 섹션 문장 1개 수정 + 각주 1개 추가(가격·수치 변경 언급 없음).
- 벤치마크(5.1→5.2, 발표 표, 지표별 측정 주체는 페이지에 명시 없음 = 미확인. Anthropic 발표 표):
  - AutomationBench 31.4→51.4% / FrontierCode 2.0 32.4→49.1%(양쪽 Xhigh) / FrontierSWE v2 56.3→69.9% / Terminal-Bench-Science 0.1 52.6→74.6%(Mythos 5.2 75.3%) / OSWorld 2.1(offline, partial) 83.5→89.3% / Remote Labor Index 17.9→41.3%(5.2만 High 표기) / HLE(도구) 65.6→74.2% / RoboDojo Sim 27.6→64.9% / WANDR 68.7→82.1% / AA-Briefcase v1.1 61.5→66.1% / Chartography(도구 없음) 44.8→73.4%
  - 사이버·생명과학 3종(CyScenarioBench 61.7→76.3%, CVE Rediscovery 78.3→89.6%, binder design 79.1→85.1)의 5.2 값은 Mythos 5.2 기준.
  - 이번에 새로 확인: WANDR, AA-Briefcase, Chartography, 속도·프로모션. (지난 보고의 RoboDojo "Anthropic 내부 실행" 표기는 이번 요약에서 재확인 못함 → 지난 보고 값으로 표기)
- 적용 단서(제안): AI Office 팀장-직원 분담에서 상위 모델은 지휘, 반복은 소형 모델에 위임하는 구조 시험 / 근거: 위 발표 + 항목 5.

## 2. Gemini 4 Carbon — 갱신(소)
- 제목: "Gemini 4 Carbon (`gemini-4-carbon`) GA" / 발표 2026-11-10 / 분류: 출시·가격
- 출처: "Release notes - Gemini API | Google AI Studio" https://aistudio.google.com/docs/changelog , "What's new in Gemini 4 Carbon - Gemini API | Google AI Studio" https://aistudio.google.com/docs/whats-new-gemini-4-carbon (직접 열람 2026-11-12)
- 가격(100만 토큰): 11/30까지 입력 $2·출력 $10(사고 토큰 포함, 캐시 입력 $0.10). 12/1부터 입력 $4·캐시 $0.20·출력 $20. 무료 티어 불가. 검색 그라운딩은 쿼리당 별도 과금.
- 컨텍스트: 입력·사고·출력 공유 1,048,576 토큰. 백그라운드 실행 시 단일 응답 최대 1M(입력 제외), 동기 응답 기본 65,536에서 중단.
- Argon 대비(문서 정성 설명): Carbon은 턴당 사고 토큰이 많아 복잡 작업에 적합, 토큰 사용량·지연 증가. Argon→Carbon은 모델 ID만 변경(스키마 변경 없음), `max_output_tokens`·타임아웃 점검 권고. 이 문서에는 벤치마크 수치 없음.
- 벤치마크(AA Index 50→59 등)와 환각률은 이번에 재열람 못함 → 지난 보고 값(Artificial Analysis 제3자 등)으로 유지, 이번 재확인 **미실행**.
- 적용 단서(제안): 11/30 전 실제 업무 2~3건 비교 시험. 근거: 위 가격표.

## 3. GPT-6 Cyber — 변동 없음
- 제목: "GPT-6-Cyber" / 2026-11-05 / 분류: 안전·정책(제한 공개)
- 출처: https://developers.openai.com/api/docs/changelog (열람 2026-11-12). 취약점 조사·승인된 테스트 환경 재현·수정 검증용, 첫 요청 전 Daybreak 설정 가이드 확인 요구.
- 가격·컨텍스트·ExploitGym 32.1→48.5%: 이번 changelog에 없음. 지난 보고 값(2차 thursdai.news 기반 단일 출처) → **미확인**.
- OpenAI 일반 목적 신모델(11월): 확인한 범위에서 없음. GPT-6 Astra(2026-09-03 출시)는 검색 결과 기사(Al Jazeera·9to5Mac 등 2차)로 존재 확인, 벤치마크는 OpenAI 자체 수치라는 보도. 공식 페이지 미열람 → 비교표에 넣지 않음.

## 4. OpenAI GPT-Image-2.6 — 변동 없음
- 제목: "GPT-Image-2.6 Sunburst / Flare" / 2026-11-04 / 출시·신기능
- changelog: 복잡도 조절, SVG, 애니메이션 GIF 생성. GPT-Image-2.5·2.6에 마크업 편집. API `v1/images/generations`, `v1/images/edits`. 가격은 changelog에 없음(지난 보고 값 $30/100만 과금 토큰은 재확인 안 함). "50% 빠름"은 단일 출처 유지.
- 적용 단서(제안): 홍카페 프로필 배너·꼬리별 썸네일 초안.

## 5. Meta Muse Ember — 갱신
- 제목: "Introducing Our Smallest, Most Efficient Model: Muse Ember" / 2026-11-09 / https://research.meta.ai/blog/muse-ember (직접 열람 2026-11-12)
- 공개: `muse-ember-1.0`, Muse Code·Meta Model API, Google Cloud·Oracle Cloud. 컨텍스트 100만, 최대 출력 51.2만.
- 가격(100만): 20만 토큰 이하 입력 $0.10·캐시 $0.004·출력 $0.50, 초과 $0.30·$0.012·$1.50.
- 지표(모두 "max" 설정, 비교: Haiku 5.5 / Luna):
  - Artificial Analysis(제3자): AA Index 36 / 36 / 28, AutomationBench-AA 37.8 / 13.9 / 20.2%, Coding Agent Index-AA 46 / 37 / 31, FrontierCode 2.0-AA 27.2 / 34.9 / 25.2%, GDP.pdf-AA 22.8 / 20.8 / 22.8%
  - Meta 내부: Agents' Last Exam 61.6 / 57.0 / 57.1%(Linux 하위 집합), PerceptionBench 80.6 / 78.6 / 62.8%, OSWorld 2.1(부분) 69.5 / 68.9 / 50.5%, Personal Superintelligence Index 46.8 / 36.1 / 37.0%
  - Terminal-Bench 4.0 40.9 / 39.2 / 16.4%: 모델별 최적 공개 하네스 사용, 출처 기관 미명시.
- 비용: 작업당 약 $0.14(Artificial Analysis 기준 표기). 같은 페이지 Muse Spark 1.3은 AA Index 37·작업당 $2.39. 단, 차트 설명("proposed pricing")과 각주("list pricing") 표현이 달라 비용 인용 주의.
- 직전 Meta 버전 대비 개선 폭: 미확인(Spark 1.3과 비교만 있음).
- 적용 단서(제안): 댓글 분류·서류 항목 추출 등 반복 작업 후보(개인정보 제거 샘플 시험).

## 6. Gemini Omni 1.2 Flash — 갱신
- 제목: "Gemini Omni 1.2 Flash GA (`gemini-omni-1.2-flash`)" / 2026-11-05 / 출처 페이지 제목 "Release notes - Gemini API | Google AI Studio" https://aistudio.google.com/docs/changelog
- 최대 15초 생성·대화형 편집, 첫/마지막 프레임 보간(3~10초), 턴별 확장 총 최대 30초, 참조 이미지 최대 6개 일관성 개선(이상 changelog). 영상 출력 $12/100만 토큰(30% 인하), 유료 티어 한도 2배. 12/3부터 `gemini-omni-1.1-flash`는 1.2 Flash 요금으로 자동 라우팅.
- 벤치마크 수치: 없음.
- 적용 단서(제안): 꼬리별 짧은 영상, 홍카페 분야 소개 클립(실존 인물 합성은 동의 필요).

## 7. Thinking Machines Inkling 2 Small — 변동 없음
- 제목: "Introducing Inkling 2 Small - Thinking Machines Lab" / 2026-11-05 / https://thinkingmachines.ai/news/inkling-2-small/ (열람 2026-11-12). 현재 가중치 비공개, Tinker 한정. "다음 주" Apache 2.0 공개 의향 기재, 구체 날짜 없고 외부 안전 테스트 결과에 따라 보류. 타 플랫폼은 테스트 뒤 수 주 내 예정. 가격 페이지에 없음(미확인). 11/12 현재 공개 여부 미확인(계속 재확인 필요).
- Kimi K3.1 Pro, Tencent Hy4, Ripple-65B 등은 지난 보고의 2차·단일 출처로 이번 미재확인.

## 8. 신기능 모음 — 변동 없음(changelog 재확인)
| 회사 | 항목 | 날짜 | 내용 | 공개 범위·가격 | 출처 |
|---|---|---|---|---|---|
| OpenAI | Live API 아웃바운드 SIP 발신(`gpt-live-1`, `v1/live/sessions`) | 11/2 | SIP 제공업체 통해 전화번호 발신 | 모든 조직. 가격 미확인 | OpenAI changelog |
| Google | Gemini Decision / Decisions API(`gemini-decision-1`) | 11/11 | 이진·범주·루브릭 판단, 출력 토큰 0, 텍스트·이미지·오디오·비디오·PDF | 가격·한도는 별도 문서(미확인), 정식/프리뷰 표기 미확인 | Gemini changelog |
| Google | PPT·ODP·ODS 입력, 함수 응답으로 Office·오디오·비디오 반환 | 11/5 | DOC·PPT·ODP는 페이지 이미지 렌더링, ODS는 첫 시트 데이터·수식 | API 일반 | Gemini changelog |
| Google | Gemini 3.8 TTS 음성 리믹싱(`POST /v1beta/voices`) | 11/4 | 자연어로 음성 변형·저장(`voice_...`) | 가격 미확인 | Gemini changelog |
| Google | `gemini-embedding-2-preview` 중단 | 11/6 | `gemini-embedding-2`로 라우팅, 스키마·가격·임베딩 공간 동일(재인덱싱 불필요) | - | Gemini changelog |
| Google | Gemini 2.5 Pro/Flash 중단 | 11/2 공지 | 12/1부터 2.5 Pro→3.8 Flash, 2.5 Flash→3.5 Flash-Lite 요금 청구. `thinking_budget`→`thinking_level` 등 호환성 변경 | - | Gemini changelog |
- xAI 문서: `grok-imagine-image-quality` 2026-11-02 퇴역(검색 요약 2차, docs.x.ai 직접 미열람).
- 적용 단서(제안): 서류 판정·댓글 분류(Decision), 안내 전화(SIP, 규정 확인·대표 승인 전제), 자동 전환 대비 모델명 점검.

## 9. 그 밖의 회사 (확인한 범위, 2차 검색 요약만)
- xAI(현 SpaceXAI): 11월 신모델 발표 확인 못함. 최근 대표 Grok 4.6(2026-08-12, 컨텍스트 500k, 입력 $2~, Artificial Analysis Index 61 — 기사 보도, 공식 x.ai/blog/grok-4-6 직접 미열람).
- Microsoft–Mistral: 2026-07 협력 확대(Mistral Medium 3.5·OCR 4 Foundry 제공)는 기사 보도. 11월 발표 미확인.
- DeepSeek: V4 프리뷰 보도(날짜 미확인). 지난 보고의 Harness Creator Mode(개발자 프리뷰)는 단일 출처로 이번 미재확인.
- Mistral Large 5 사전학습 보도·NVIDIA 포럼 글은 **루머·단일 출처**.
- 모두 공식 1차 출처 미열람이므로 "11월 발표 없음"으로 단정하지 않음.

## 부족·미확인 목록
- 직접 재열람 못한 것: Gemini 4 Carbon 벤치·환각률, Images 2.6 가격, GPT-6 Cyber 가격·ExploitGym, Kimi/Tencent/Ripple, DeepSeek·Mistral·xAI·Microsoft 공식 페이지.
- 미확인 값: Fable 5.2 컨텍스트·지표별 측정 주체·5.1 가격, Decision·SIP 가격, Inkling 가격·공개 여부, 모든 항목 KST 시각.
- 흐름 수: 8개(상한 충족), 기타 회사 1개 묶음은 부록.

Sources: Anthropic 발표, Gemini API changelog, Gemini 4 Carbon 문서, OpenAI API changelog, Thinking Machines Inkling 2 Small, Meta Muse Ember (URL 위 본문 참조).
