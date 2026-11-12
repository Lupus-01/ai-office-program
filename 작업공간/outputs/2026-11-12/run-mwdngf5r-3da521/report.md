# 일일 AI 브리핑 · 2026.11.12 — 대장급 AI 개선 현황과 우리 서비스 적용

## 완료
- 최종 산출물: `outputs/2026-11-12/run-mwdngf5r-3da521/aitrend/aitrend-1-daily-ai-briefing.html`
- 조사 원본: `outputs/2026-11-12/run-mwdngf5r-3da521/aitrend/aitrend-2-ai-model-research.md`
- 헤드라인: Claude Fable 5.2가 직전 5.1 대비 AutomationBench 31.4%→51.4%(+20.0%p), Remote Labor Index 17.9%→41.3%, Terminal-Bench-Science 52.6%→74.6% 등으로 올랐습니다. 이번 재확인에서 새 대표 모델 발표는 없었습니다.
- 구성: 머리말 → 5분 브리핑 8개 흐름 → 오늘 우리 서비스에 적용할 것(우선 검토 3가지와 서비스별 표) → 키워드 TOP 5 → 핵심 수치 4개 → 대표 모델 현황 표 → 타임라인(KST) → 상세 8개 → 오늘의 온도 → 실무 팁 6개 → 확인 방식과 한계.
- 우선 검토 제안 3가지는 모두 "제안"으로 표시했고 효과 수치는 만들지 않았습니다.
  1. 큰 모델은 지휘, 작은 모델은 반복 작업 (AI Office)
  2. 판단 전용 API(Gemini Decision)로 서류·댓글 1차 판정 (홍카페·꼬리별 관측소)
  3. Gemini 가격·모델 전환 일정 점검
- 지난 브리핑 대비: 갱신 4건(Fable 5.2, Carbon, Muse Ember, Omni 1.2 Flash), 변동 없음 4건입니다.
- 가장 급한 일정은 Gemini 4 Carbon 도입가 종료(11/30, 12/1부터 가격 2배), Gemini 2.5 계열 요금 전환(12/1), Omni 1.1 Flash 자동 라우팅(12/3)입니다.

## 확인 필요
- Fable 5.2의 컨텍스트 길이, 5.1 가격, 지표별 측정 주체는 발표 페이지에 없어 미확인입니다. 개선 폭(%p)은 팀장이 전후 값의 차이로 계산했습니다.
- Gemini 4 Carbon 벤치마크·환각률, GPT-6 Cyber 가격·ExploitGym, Images 2.6 가격과 "50% 빠름"은 이번에 직접 재확인하지 못했거나 단일 출처입니다.
- Gemini Decision과 OpenAI Live API SIP 발신의 가격, Decision의 정식·프리뷰 여부는 미확인입니다.
- Inkling 2 Small의 가격과 11/12 현재 가중치 공개 여부는 미확인입니다.
- GPT-6 Astra, Grok 4.6, Microsoft, Mistral, DeepSeek은 공식 페이지를 열지 않은 2차 정보입니다. 이 회사들의 "11월 발표 없음"은 단정하지 않았습니다. 이번에 직접 연 공식 페이지는 6곳입니다.
- 모든 항목의 발표 시각(KST)을 확인하지 못해 타임라인은 날짜만 적었습니다.
- 우리 서비스가 현재 쓰는 모델·API를 확인하지 못해 적용 제안은 일반적인 방향입니다. Claude 요금제의 Fable 프로모션 대상 여부도 확인이 필요합니다.
- 출처 자동 확인에서 제목이 달랐던 링크 4건(Artificial Analysis Omniscience, CNBC, Google 블로그 Omni 1.2 Flash, ThursdAI)은 모두 접속됩니다. 이 4건은 지난 보고에서 가져온 보조 출처로 HTML에 "지난 보고"로 표시돼 있습니다. 본문 수치의 근거는 직접 연 공식 페이지입니다.
- 실제 역량 공백: 없음.

## 근거
- 직접 열람한 공식 페이지(2026-11-12): Anthropic 발표, Gemini API changelog, Gemini 4 Carbon 문서, OpenAI API changelog, Thinking Machines Inkling 2 Small, Meta Muse Ember 블로그.
- 출처 자동 확인: 11건 중 열리지 않는 링크 0건.
- 최종 검토: 비서실장이 HTML 전체와 조사 원본을 대조했습니다. 서식 (1)~(11), 한 단 800px 이하 레이아웃, 모바일 표 변환, 인쇄 스타일, 외부 스크립트·이미지 없음을 확인했습니다. 수치는 조사 원본과 일치했습니다.
- 별도 전문 검증은 대표 요청이 없어 실행하지 않았습니다. 검증실 결과는 없습니다.
- 외부 발송·게시 작업은 없습니다.