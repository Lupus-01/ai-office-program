# 대장급 AI 모델 동향 (확인일 2026-11-24, 조사 기간 2026-11-17 ~ 11-24)

확인한 범위에서의 정리입니다. 수치·날짜는 이번에 직접 연 공식 페이지(변경 기록·뉴스 목록)에서만 적었고, 측정 주체를 항목마다 표시했습니다. 발표 시각은 공식 페이지에 없어 날짜만 적습니다.
직전 보고: outputs/2026-11-20/run-mwoc09hg-fbf740/aitrend/aitrend-2-frontier-ai-updates.md

## 한눈에 보기
- 모델 출시: 7일 내 2건(OpenAI GPT-6.2 Astra·Sol 11-17, Google Gemini 4 Neon 11-18). 모두 직전 보고에 있던 항목이고, 이번 기간(11-20~11-24) 신규 모델 출시는 확인한 범위에서 없음.
- 신규 소항목: Google Genie 4 GA(11-19), Anthropic Opus 4.5 폐지 예고·Enterprise Frontier Safeguards 베타(11-23), OpenAI·Cisco "Shirudo"(11-23, 제목만 확인).
- 직접 연 공식 변경 기록 중 11-20~11-24에 신규 모델 항목이 있는 곳은 없었음(OpenAI API 변경 기록 11-20~24 항목 없음, Gemini API 변경 기록 11-20~24 항목 없음).

## 1. OpenAI (GPT)

### 1-1. GPT-6.2 Astra / Sol — 변동 없음 (발표 2026-11-17)
- 발표 제목(원문): API 변경 기록 "GPT-6.2 Astra and GPT-6.2 Sol" (`gpt-6.2-astra`, `gpt-6.2-sol`)
- 내용(이번 직접 확인): Astra는 고난도 추론·코딩, Sol은 일상 코딩·에이전트 워크플로용. Responses API·Chat Completions 지원, 도구 호출은 Responses API 필요. 추론 보존 방식과 `instructions` 처리 방식 변경(마이그레이션 가이드 링크 있음).
- 수치: 변경 기록에는 벤치마크·가격 없음 → 이번 확인 기준 "미확인". (직전 보고 인용, 이번 미재확인: Astra 입력 $8/출력 $40, Sol $2/$10 100만 토큰당 — 회사 공지 인용.)
- 출처: https://developers.openai.com/api/docs/changelog
- 한 줄 요약: 상위 Astra와 실무용 Sol로 GPT-6.2 세대를 API에 출시.

### 1-2. 소항목 (OpenAI API 변경 기록, 이번 직접 열람)
- 2026-11-19 GPT-Live-1.1 (`gpt-live-1.1`) — 다국어 음성 대화에서 발음·억양 일관성·받아쓰기 개선(수치·가격 미제공). WebRTC 세션 standby 모드 추가. 변동 없음(직전 보고에 있음).
- 2026-11-17 Responses API 백그라운드 완료 창(공개 베타): 2시간/8시간 창에서 표준 대비 토큰 요금 30%/40% 낮음(회사 발표). 신규 모델은 Flex 처리 미지원. 변동 없음.
- 2026-11-23 "OpenAI and Cisco introduce Shirudo"(보안 분류) — **신규**. 뉴스 목록에서 제목·날짜만 확인, 본문 미열람이라 내용 미확인. 같은 목록의 11-18~11-22 항목(안전·연구·엔지니어링 글: "Managing frontier AI risk: From training to deployment", "Inside the Codex sandbox", "MedChemBench…" 등)은 모델 출시가 아니라 제목만 기록.
- 출처: https://openai.com/news/ (목록 "Load more"로 일부 미표시 가능)

## 2. Google (Gemini)

### 2-1. "Introducing Gemini 4 Neon" — 갱신(공식 변경 기록으로 가격 재확인, 발표 2026-11-18)
- 이번 확인(Gemini API 변경 기록, Google 공식): `gemini-4-neon` GA, 입력 $3.00 / 출력 $15.00 (100만 토큰당), 컨텍스트 1M 토큰, 사고 수준 4단계(low·medium·high 기본·xhigh).
- 벤치마크는 직전 보고 인용(Google 블로그 직접 열람, 회사 발표): Artificial Analysis Intelligence Index 61점·전체 3위(xhigh, Google이 인용한 제3자 지표), Terminal-Bench 4.1 65.2%, 작업당 비용 Carbon 대비 32% 낮음. 이번엔 블로그 재열람 안 함.
- 같은 날 추가: Word·PowerPoint·Excel 파일 직접 입력, 문서·영상·오디오 슬라이싱(가격 미표기).
- 출처: 「Release notes - Gemini API | Google AI Studio」 https://aistudio.google.com/docs/changelog
- 한 줄 요약: Carbon급 품질을 더 낮은 비용으로 제공하는 Gemini 4 중간 등급 모델.

### 2-2. Genie 4 GA (`genie-4`) — 신규 (2026-11-19)
- 실시간 대화형 세계 생성(Interactions API v1beta). 24fps 16:9 영상 + 48kHz 스테레오 오디오 스트리밍.
- 가격(Google 공식): 입력 $1.50, 텍스트 출력 $9.00, 영상 출력 $17.50 (각 100만 토큰당, 영상 약 $0.10/초).
- 출처: 「Release notes - Gemini API | Google AI Studio」 https://aistudio.google.com/docs/changelog
- 한 줄 요약: 실시간 월드 생성 모델이 API 정식 출시.

### 2-3. 신기능 모음 (Gemini API 변경 기록)
- 11-19 도구 검색(Tool retrieval, Preview): 도구 라이브러리를 검색해 함수 스키마를 필요할 때 불러옴. Gemini 3.6 이후(Gemini 4 전부 포함) 지원. 가격 미표기. **신규**
- 11-17 `gemini-3.5-transcribe`(·live) 음성으로 받아쓴 글 편집·서식 지정. 가격 미표기. **신규**
- Gemini 4 Hydrogen(2026-11-12 UTC): 기간 밖, 변동 없음(이번 재확인 안 함).

## 3. Anthropic (Claude)
- **최근 7일 새 모델 출시 없음**(확인한 범위: 뉴스 목록, Claude Platform 릴리스 노트 앞 100,000자).
- 뉴스(제목·날짜만, 사업 분류): "Anthropic prices initial public offering"(11-18), "Anthropic announces closing of initial public offering, including full exercise of underwriters' option to purchase additional shares…"(11-20, 제목 일부 생략). 내용 수치 미열람. **신규**
- 2026-11-23 Claude Opus 4.5(`claude-opus-4-5`) 폐지 예고: Claude API 종료 2027-01-22 예정, Opus 5.5로 이전 권장. **신규**
- 2026-11-23 Enterprise Frontier Safeguards(EFS) 베타: 최상위 모델 사용 조직에 제로 데이터 보관 제공, 암호화된 프롬프트·응답 사본(Sealed Safety Data)을 고객 클라우드 버킷에 저장. 외부 저장소 웹훅 이벤트 2종 추가(베타). **신규**
- 2026-11-17 Linked billing 베타 — 변동 없음.
- 기간 밖 참고: "Introducing Claude Fable 5.2 and Claude Mythos 5.2"(11-09) — 변동 없음.
- 출처: 「Newsroom \ Anthropic」 https://www.anthropic.com/news , 「Claude Platform release notes - Claude Platform Docs」 https://platform.claude.com/docs/en/release-notes/overview

## 4. 그 밖의 회사
- xAI: 공식 릴리스 노트(https://docs.x.ai/docs/release-notes)에서 7일 내 신규 모델 없음. 11-19 `grok-build-0.1` 서비스 종료(변동 없음에 해당하지 않는 신규 소항목). 2차 출처(검색 결과, 미확정)에 Grok 4.8이 학습 중이나 공식 발표 없다는 내용 있음 — 루머성·단일 계열 정보.
- DeepSeek: 기존에 적었던 뉴스 목록 주소는 열리지 않아(404) 뺐고, 대신 공식 「Change Log | DeepSeek API Docs」 https://api-docs.deepseek.com/updates 를 이번에 직접 열어 확인함(확인일 2026-11-24). 확인한 범위에서는 11-17 이후 항목 없음 — **최근 7일 새 소식 없음**(가장 최근 항목: 2026-11-13 "Releasing the full suite of application APIs", 기간 밖).
- Meta: 공식 페이지 미열람 → **미확인**(2차 검색에서 기간 내 Llama 발표 없음).
- Microsoft·Mistral 등: 이번에 확인하지 않음 → 미확인.

## 5. 건수·부족 사유
- 모델 출시 7일 내 2건(GPT-6.2, Gemini 4 Neon) + 모델급 신규 1건(Genie 4 GA). 11-20~11-24 신규 모델 출시 0건. 소항목: OpenAI 3, Google 3, Anthropic 4(IPO 2·Opus 4.5 폐지·EFS), xAI 1.
- 부족 사유: Gemini 블로그 목록은 글 제목이 로드되지 않음, Claude 릴리스 노트 뒤 48,084자 미열람, OpenAI 뉴스 "Load more" 미확장, DeepSeek 뉴스 목록 주소 404(변경 기록 페이지로 대체 확인함), Meta 등 미열람. GPT-6.2 Astra·Sol 가격·벤치마크는 이번 미재확인(직전 보고 인용).
- 우리 서비스 적용 아이디어(제안, 팀장 판단용): Gemini API 도구 검색(11-19), Google Docs/Office 파일 직접 입력(11-18)은 AI Office의 문서 업무 자동화에 검토 가능. 근거: Gemini API 변경 기록.
