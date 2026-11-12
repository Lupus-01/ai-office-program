# 대장급 AI 동향·신기술 조사 자료 (2차 조사, 사실만 수록)

- 확인 날짜: 2026-11-12
- 조사 기간(가정): 2026-11-04~11-12 (지난 브리핑 항목 재확인 + 직전 버전 대비 비교)
- 입력: 지난 조사 자료 `outputs/2026-11-12/run-mwdjxdlu-f058df/aitrend/aitrend-2-frontier-ai-research.md`(직접 읽음). 같은 폴더 HTML은 동일 내용의 서식본으로 보고 별도로 열지 않음(미열람).
- 이번에 직접 다시 연 공식 페이지(4건): Anthropic 발표 페이지, Gemini API changelog, OpenAI API changelog, Thinking Machines Inkling 2 Small 페이지. 그 외 항목은 지난 자료의 값을 그대로 인용했고 이번에 재열람하지 않았다(해당 행에 "지난 값 인용" 표시).
- 확인한 범위의 결과이며 전체 발표 목록이 아니다. 실제 건수: 8개 흐름(신기능 모음 포함), 이번 재확인에서 신규로 확인된 항목 0건 + 갱신 3건.

## 지난 브리핑 항목 재확인 결과

| # | 항목 | 상태 | 이번 확인 내용 |
|---|---|---|---|
| 1 | Anthropic Claude Fable 5.2 / Mythos 5.2 | **갱신** | 발표일 2026-11-09, 가격 입력 $8/출력 $40, 빠른 모드 $16/$80, Fable 전체 공개·Mythos 승인 조직 한정은 모두 지난 값과 동일. 새로 확인: 페이지 끝의 "Edit 11 November" 정정 메모가 "수학적 형식화" 섹션 문장 1개 수정 + 각주 1개 추가라고 기재(지난번 '수정 내용 미확인' 해소). 컨텍스트 길이는 이번에도 페이지에 없음 → 미확인 |
| 2 | Google Gemini 4 Carbon | **변동 없음** | changelog 11/10 GA, 도입가 입력 $2.00/출력 $10.00(11/30까지) 재확인. 12/1 이후 가격($4/$20 등)·벤치마크 수치는 지난 값 인용 |
| 3 | OpenAI GPT-6 Cyber | **변동 없음** | changelog Nov 5 항목 재확인(원문: 승인된 테스트 환경에서 취약점 조사·재현·수정 검증, Daybreak 설정 가이드 선행). 11/6~11/12 사이 새 OpenAI changelog 항목 없음. 가격·ExploitGym 수치는 지난 값 인용 |
| 4 | OpenAI Images 2.6 | **변동 없음** | changelog Nov 4 항목 재확인(`gpt-image-2.6-sunburst`·`gpt-image-2.6-flare`, 복잡도 조절·SVG·애니메이션 GIF·마크업 편집). 발표문(openai.com)은 이번에 열람 시도 안 함 → '50% 빠름' 수치는 계속 단일 출처·미재확인 |
| 5 | Meta Muse Ember | **변동 없음(미재확인)** | 지난 값 인용. 이번에 재열람 안 함 |
| 6 | Google Gemini Omni 1.2 Flash | **갱신** | changelog 11/5: GA, 영상 출력 100만 토큰당 $12.00(30% 인하), 유료 티어 rate limit 2배, `gemini-omni-1.1-flash`는 12/3부터 1.2 Flash로 자동 라우팅. (지난 자료의 '720p $0.07/초'는 Google 블로그 값, 이번 열람 아님) |
| 7 | Thinking Machines Inkling 2 Small (지난번 미확인: 가중치 공개 여부) | **갱신(해소 시도)** | 이번 열람 페이지는 여전히 11/5자이며 "가중치 비공개, Tinker에서만 이용, 외부 안전 시험 후 다음 주 Apache 2.0 공개 예정". 페이지에 공개 완료 표기 없음 → 11/12 현재 공개 완료 여부는 확인한 범위에서 확인되지 않음(미확인) |
| 8 | 신기능 모음 | **갱신** | 아래 추가 항목 참고 |

## 흐름 요약 (중요도 순)

| # | 회사 | 흐름 | 분류 | 상태 |
|---|---|---|---|---|
| 1 | Anthropic | Claude Fable 5.2 / Mythos 5.2 | 출시·신기능 + 성능·평가 + 가격 | 갱신 |
| 2 | Google | Gemini 4 Carbon (11/10 GA) | 출시·신기능 + 성능·평가 + 가격 | 변동 없음 |
| 3 | OpenAI | GPT-6 Cyber | 출시·신기능(제한 공개) | 변동 없음 |
| 4 | OpenAI | Images 2.6 | 출시·신기능 | 변동 없음 |
| 5 | Meta | Muse Ember | 출시·신기능 + 가격 | 변동 없음(미재확인) |
| 6 | Google | Gemini Omni 1.2 Flash | 출시·신기능 + 가격 | 갱신 |
| 7 | 기타 | Inkling 2 Small 외 오픈소스·타사 | 연구·오픈소스 | 갱신 |
| 8 | 복수 | 신기능 모음 | 출시·신기능 | 갱신 |

---

## 1. Anthropic — Claude Fable 5.2 / Claude Mythos 5.2 (갱신)

| 항목 | 내용 |
|---|---|
| 제목(원문) | Introducing Claude Fable 5.2 and Claude Mythos 5.2 \ Anthropic |
| 발표일 | 2026-11-09 (공식 페이지에 "Edit 11 November" 정정 메모 있음: 문장 1개 수정·각주 1개 추가) |
| 출처·확인일 | https://www.anthropic.com/claude-fable-and-mythos-5-2 · 2026-11-12 직접 열람 |
| 요약 | 같은 기반 모델의 두 버전. Fable 5.2는 전체 사용자 대상, Mythos 5.2는 사이버·생명과학 검증 프로그램 승인 조직 한정(빠른 모드도 동일). API ID `claude-fable-5-2` |
| 가격(Anthropic 공식) | 표준 입력 $8 / 출력 $40, 빠른 모드(생성 최대 2.5배 빠름) $16 / $80 (100만 토큰당). 5.1 가격은 페이지에 없어 인하폭 미확인(CNBC "약 20% 저렴"은 2차 보도) |
| 컨텍스트 | 미확인(공식 페이지에 기재 없음) |
| 직전 버전(Fable 5.1) 대비 | 아래 수치는 지난 자료에서 인용(이번 재열람 아님). 발표 주체는 Anthropic이며, 지표별 측정 주체는 RoboDojo Sim(Anthropic 내부 실행)을 제외하고 페이지에 명시되지 않아 '미확인'. 표 일반 주석: 별도 표기 없으면 각 모델 최고 가용 effort. FrontierCode 2.0은 Fable 5.2·5.1 모두 Xhigh, 비교 대상 Gemini 4 Carbon은 Medium |
| | FrontierCode 2.0 32.4→49.1% · FrontierSWE v2 56.3→69.9% · AutomationBench 31.4→51.4% · Terminal-Bench-Science 0.1 52.6→74.6% · OSWorld 2.1(오프라인 일부) 83.5→89.3% · Remote Labor Index 17.9→41.3%(5.2만 High 표기) · Humanity's Last Exam(도구) 65.6→74.2% · RoboDojo Sim 27.6→64.9%(Anthropic 내부 실행) |
| 안전 수치(Anthropic 자체) | 안전장치 차단 5.1 대비 약 55% 감소 — claude.ai·Claude Code·Cowork 초기 테스트 결과. Mythos 5.2 샌드박스 이탈 3.1%(5.1 21%) — 의도적 취약점이 있는 적대적 평가 조건. (지난 값 인용) |
| 배경 사실 | ① Mythos는 4월 제한 공개로 먼저 소개, Fable은 안전장치를 더한 공개판(CNBC, 2차). ② Advisor/Orchestrator 역할, preserved thinking 전체 API 계정 적용(지난 값 인용). ③ AWS·Google Cloud·Azure 제공(지난 값 인용) |
| 더 보기 | 위 공식 페이지(영상 링크 미확인) |

## 2. Google — Gemini 4 Carbon (변동 없음)

| 항목 | 내용 |
|---|---|
| 제목 | Gemini 4 Carbon (모델 ID `gemini-4-carbon`) |
| 발표일 | 11/10 GA — Gemini API changelog 이번 재확인. 10/28 제한 공개(Fairwind)는 VentureBeat 2차(지난 값) |
| 출처·확인일 | https://aistudio.google.com/docs/changelog ("Release notes - Gemini API | Google AI Studio", 2026-11-12 직접 열람) · https://aistudio.google.com/docs/whats-new-gemini-4-carbon ("What's new in Gemini 4 Carbon - Gemini API | Google AI Studio", 지난 값 인용) |
| 가격 | 11/30까지 입력 $2.00 / 출력 $10.00(100만 토큰당, changelog). 12/1부터 입력 $4.00 / 캐시 입력 $0.20 / 출력 $20.00(지난 값 인용). 컨텍스트 1,048,576 토큰 공유 창 |
| 직전 버전(Argon) 대비 | 모두 지난 자료 인용. Artificial Analysis(제3자): Intelligence Index v5.0 50→59, Terminal-Bench 4.0 57.1→65.2%. Proximal(제3자): FrontierSWE 2 55.0→61.2%. Google 자체: OSWorld-2.1(오프라인) 74.7→81.5%, Agents' Last Exam 69.0→77.4%, ExploitGym 42.0→54.8%(Fairwind 접근 시 성능). 환각률(AA-Omniscience v1.1, 제3자): Carbon High 11% / Medium 4% / Argon High 4%(오답÷(오답+부분정답+미응답), 낮을수록 좋음) |
| 비고 | Google 공식 블로그 원문 미열람. 평가 방법론 PDF 텍스트 미판독 |

## 3. OpenAI — GPT-6 Cyber (변동 없음)

| 항목 | 내용 |
|---|---|
| 제목 | GPT-6 Cyber (`gpt-6-cyber`) |
| 발표일 | 2026-11-05 (OpenAI API changelog, 2026-11-12 직접 열람) |
| 공개 범위 | 제한 공개 — Daybreak 접근·승인 필요(changelog 원문: 첫 요청 전 Daybreak 설정 가이드 확인) |
| 가격 | 지난 값 인용(공식 모델 문서 URL은 이번 확인에서 404로 열리지 않아 링크 제거 — 가격은 현재 재확인 불가, 지난 보고 기재값): 272K 이하 입력 $20 / 캐시 $2 / 출력 $100, 초과 시 $40 / $4 / $150. 컨텍스트 1,050,000 |
| 수치 | ExploitGym GPT-5.6 Cyber 32.1%→48.5%: OpenAI 자체 발표, 2차 출처(thursdai.news) 기반 단일 출처로 취급. 독립 평가 미확인 |
| 출처 | https://developers.openai.com/api/docs/changelog |
| 최신 일반 모델 | 확인한 범위에서 OpenAI 11월 일반 목적 신모델 공식 발표 없음(changelog에 11/6~11/12 항목 없음). GPT-6 Astra 9/3 출시·가격은 2차 검색 요약(미검증) |

## 4. OpenAI — Images 2.6 (변동 없음)

| 항목 | 내용 |
|---|---|
| 제목 | GPT-Image-2.6 Sunburst / Flare |
| 발표일 | 2026-11-04 (changelog 직접 열람, 2026-11-12) |
| 요약 | 이미지 생성·편집(`images/generations`·`images/edits`). 복잡도 조절, SVG 생성, 애니메이션 GIF 생성, GPT-Image-2.5·2.6에 마크업 기반 편집 추가 |
| 가격·조건 | 출력 100만 과금 토큰당 $30(지난 값, 공식 가이드). SVG는 n=1, 편집 엔드포인트 SVG 미지원(지난 값) |
| 단일 출처 | "이전보다 50% 빠름"은 OpenAI 발표문 기준이나 발표문 열람 불가(403) 이력 → 비교 대상 미확인, 단일 출처 |
| 출처 | https://developers.openai.com/api/docs/changelog |

## 5. Meta — Muse Ember (변동 없음, 이번 미재확인)

지난 값 인용. 발표일 2026-11-09(Meta 공식 블로그 research.meta.ai/blog/muse-ember). `muse-ember-1.0`, 일반 제공(Meta Model API·Muse Code). 가격 ≤20만 토큰 프롬프트 입력 $0.10 / 캐시 $0.004 / 출력 $0.50, 초과 $0.30 / $0.012 / $1.50(100만 토큰당). 컨텍스트 100만, 출력 최대 51.2만. 비교(Ember / Haiku 5.5 / GPT-6 Luna): Artificial Analysis(제3자) AA Intelligence Index 36 / 36 / 28, FrontierCode 2.0-AA 27.2 / 34.9 / 25.2%(Ember가 Haiku보다 낮음), Coding Agent Index-AA 46 / 37 / 31. Meta 내부 평가: Agents' Last Exam 61.6 / 57.0 / 57.1%. Terminal-Bench 4.0은 모델별 실행 도구가 달라 동일 조건 비교 아님. 직전 Meta 버전 대비는 미확인.

## 6. Google — Gemini Omni 1.2 Flash (갱신)

| 항목 | 내용 |
|---|---|
| 제목(원문) | Gemini Omni 1.2 Flash: 15-second video and lower pricing |
| 발표일 | 2026-11-05 |
| 갱신 내용 | changelog(이번 열람): GA, 영상 출력 100만 토큰당 $12.00(30% 인하), 유료 티어 rate limit 2배, 1.1 Flash는 12/3부터 1.2 Flash로 자동 라우팅 |
| 요약 | 영상 생성·편집 최대 15초(1.1은 10초), 멀티턴 편집, 립싱크 등(Google 블로그, 지난 값). 720p $0.07/초(블로그 값, 단위가 changelog와 다름) |
| 출처 | https://aistudio.google.com/docs/changelog (이번) · https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-omni-1-2-flash/ (지난 값) |

## 7. 기타 오픈소스·타사 (갱신)

| 회사 | 제품 | 날짜 | 내용·표시 |
|---|---|---|---|
| Thinking Machines Lab | Inkling 2 Small | 11/5 | 594B MoE(활성 17B). 이번 열람 기준 Tinker에서만 제공, 가중치 비공개, "다음 주" Apache 2.0 공개 예정(외부 안전 시험 후). 공개 완료 여부 11/12 시점 미확인. 제목: "Introducing Inkling 2 Small - Thinking Machines Lab" · https://thinkingmachines.ai/news/inkling-2-small/ |
| Moonshot AI | Kimi K3.1 Pro | 11/5 | 2.8T MoE(활성 104B), 오픈 가중치 — 단일 2차(thursdai), 지난 값 |
| Tencent | Hy4 | 11/4~5 | 100만 컨텍스트, 2차, 지난 값 |
| Cognition | SWE-2 Flash | 11/4~5 | 2차, 지난 값 |
| Ricursive | Ripple-65B Preview | 11/5 | Apache 2.0, TerminalBench 2.1 80.5% 자체 주장, 단일 출처 |
| ElevenLabs | Scribe v3 / v3 Live | 11/10 | 102개 언어, 2차 |

## 8. 신기능 모음 (갱신)

| 회사 | 항목 | 날짜 | 내용 | 공개 범위 | 출처 |
|---|---|---|---|---|---|
| Google | **Gemini Decision(`gemini-decision-1`)·Decisions API** | 11/11 | 이진·범주·루브릭 판단을 텍스트·이미지·오디오·비디오·PDF에 수행, 출력 토큰 0. changelog에는 가격·공개 범위(GA/프리뷰) 기재 없음 → 미확인(pricing·rate-limits 문서 미열람) | 미확인 | https://aistudio.google.com/docs/changelog (이번 열람) |
| OpenAI | Live API 아웃바운드 SIP 발신(`gpt-live-1`) — **신규** | 11/2 | 모든 조직이 SIP 제공업체를 통해 GPT-Live를 전화번호에 연결 가능 | 일반(모든 조직, changelog) | https://developers.openai.com/api/docs/changelog |
| Google | **신규** 문서 입력·함수 응답 확장 | 11/5 | PPT·ODP·ODS 입력 추가, 함수 응답에 오디오·비디오·Office 파일 반환, Files API URI 지원 | 일반 | changelog |
| Google | **신규** Gemini 3.8 TTS Voice remixing | 11/4 | 자연어 지시로 기존 음성 변형·저장 | changelog 기재 범위 내 일반 | changelog |
| Google | **신규(정책·일정)** 모델 라우팅 변경 | 11/2·11/6 | `gemini-2.5-pro`→12/1부터 `gemini-3.8-flash`, `gemini-2.5-flash`→`gemini-3.5-flash-lite`로 라우팅(호환성 변경 있음, 마이그레이션 확인 필요). `gemini-embedding-2-preview` 11/6 중단→`gemini-embedding-2` | 일반 | changelog |
| Google | Gemini CLI v0.68.0 · Robotics 2.5(파트너 제한) · Search core update 등 | 11/10~11 | 지난 값 인용 | | releasebot·deepmind 블로그 |
| DeepSeek | Harness Creator Mode | 11/5 보도 | 개발자 프리뷰, 2차·세부 불일치, 지난 값 | 베타 | implicator.ai |
| Anthropic | Claude Code 게임 복제 규칙 | 11/5 보도 | 단일 2차 | | thursdai.news |
| Mistral | Managed Agents 문서 갱신 | 11/5 | 미확인·단일 | | 검색 요약만 |

## 확인하지 못한 회사
xAI(최신 확인: Grok 4.7 9월, 2차)·Microsoft·DeepSeek 신모델·Mistral 신모델: 이번 기간 큰 발표를 확인하지 못함(이번에 추가 열람 안 함 → 단정하지 않음).

## 루머·단일 출처
OpenAI ExploitGym 수치, Images 2.6 속도 50%, Kimi K3.1 Pro, Ripple-65B, DeepSeek Creator Mode 세부, Claude Code 규칙, Mistral 문서. 루머·유출 분류 항목 없음.

## 우리 서비스에 적용할 만한 신기술 (제안 — 사실 아님, 근거 출처 연결)
서비스 세부 내용을 모르는 부분은 일반 방향으로만 적는다.
1. **AI Office(사무자동화)** — Claude Fable 5.2의 AutomationBench 31.4→51.4%(Anthropic 발표, 측정 주체 미확인)와 Advisor/Orchestrator 구조: 사무 에이전트의 라우팅·위임 설계 검토 후보. 근거: 항목 1. 가격 $8/$40로 비용 대비 효과 시험 필요.
2. **AI Office** — OpenAI Live API 아웃바운드 SIP(11/2): 전화 기반 자동 안내·확인 업무 후보(통화 녹음·동의 등 정책 확인 필요). 근거: 항목 8.
3. **홍카페(상담사 프로필·모집)** — Gemini Decision API: 서류·이미지·PDF를 기준표(루브릭)로 일괄 판정(예: 등록 서류 형식 점검) 후보. 가격·공개 범위 미확인이므로 문서 확인 후 판단. 근거: 항목 8. 또한 Images 2.6(항목 4)의 편집 일관성·마크업 편집은 프로필 이미지 제작 후보(상담사 동의·초상 정책 별도).
4. **꼬리별 관측소(커뮤니티 콘텐츠·댓글)** — Gemini Omni 1.2 Flash(15초 영상, $12/100만 토큰 영상 출력)와 Images 2.6 SVG·GIF: 반려동물 짧은 콘텐츠 제작 후보. Gemini Decision은 댓글 분류·검수 후보. 근거: 항목 4·6·8.
5. **공통 비용 절감** — Meta Muse Ember(입력 $0.10/출력 $0.50, 100만 토큰당)는 분류·추출 같은 반복 작업용 저가 모델 후보(근거: 항목 5, 지난 값·성능은 지표별로 갈림).
6. **주의(일정)** — Gemini 2.5 계열 12/1 라우팅·Omni 1.1 12/3 라우팅·Carbon 도입가 11/30 종료: Gemini API를 쓰는 경우 영향 확인 필요(근거: 항목 2·6·8).

## 확인한 출처 목록
- https://www.anthropic.com/claude-fable-and-mythos-5-2 — Introducing Claude Fable 5.2 and Claude Mythos 5.2 \ Anthropic (이번 열람)
- https://aistudio.google.com/docs/changelog — Release notes - Gemini API | Google AI Studio (이번 열람)
- https://developers.openai.com/api/docs/changelog — OpenAI API changelog (이번 열람)
- https://thinkingmachines.ai/news/inkling-2-small/ — Introducing Inkling 2 Small - Thinking Machines Lab (이번 열람)
- 지난 자료 인용(이번 미열람): research.meta.ai/blog/muse-ember, blog.google Omni 1.2 Flash, cnbc.com, venturebeat.com, releasebot.io, thursdai.news, nocode.mba, artificialanalysis.ai 등
