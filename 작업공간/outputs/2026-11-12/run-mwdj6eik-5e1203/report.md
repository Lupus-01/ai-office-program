# 대장급 AI 모델 개선 동향 보고

## 완료
- AI트렌드부가 Anthropic, OpenAI, Google, xAI, Meta, DeepSeek 6곳의 최신 대표 모델을 조사해 한국어 HTML 보고서로 정리했습니다.
- 조사 원본: `outputs/2026-11-12/run-mwdj6eik-5e1203/aitrend/aitrend-2-frontier-model-updates.md`
- 최종 산출물(HTML 보고서): `outputs/2026-11-12/run-mwdj6eik-5e1203/aitrend/aitrend-1-frontier-ai-update-report.html`
- 보고서 구성은 한눈에 보는 결론, 회사·모델별 비교표, 모델별 상세 카드, 한계, 다음 행동, 출처·확인일(2026-11-12) 순입니다. 표는 가로 스크롤이 되고 카드는 반응형이며 인쇄용 스타일이 있습니다.

### 핵심 내용
- **xAI Grok 4.7**: 직전 4.6보다 Terminal-Bench 4.0이 20.3%에서 37.6%로, CursorBench 4.0이 40.4%에서 46.3%로 올랐습니다. 공개된 개선 폭이 가장 큽니다. 다만 xAI 자체 표에서도 Claude Fable 5.1(57.9%)이 Terminal-Bench에서 더 높습니다. (회사 발표)
- **OpenAI GPT-6.1 Sol**: GPT-6 Sol 대비 DeepSWE +6.4점, OSWorld 2.0 +7점, 어려운 질문 오류율 11.4%에서 7.7%로 개선됐습니다. 2차 출처 경유입니다.
- **Google Gemini 4 Carbon**: 직전 Argon 대비 공격 시뮬레이션 침해율이 3.1%에서 0.8%로, 에이전트 정직성이 70%에서 92%로 개선됐습니다. 2026-11-30부터 가격이 $2/$10에서 $4/$20로 오릅니다. (회사 발표)
- **Anthropic Claude Fable 5.2**: 가격이 20% 내렸고(입력 $10에서 $8, 출력 $50에서 $40) 빠른 모드는 최대 2.5배 빠릅니다. 벤치마크 점수는 확인하지 못했습니다. (회사 문서)
- **DeepSeek V4.1-Flash-1017**: DeepSWE가 74.2%에서 77%로 올랐습니다. (회사 발표, 2차 경유)
- **Meta Muse Wonder**: 개선 폭을 확인하지 못했습니다.

## 확인 필요
- **1차 출처 한계**: 회사 페이지를 직접 확인한 것은 Claude 문서, Google 블로그, xAI 공지 3건입니다. GPT(openai.com은 403), Meta, DeepSeek은 언론·제3자 페이지만 근거라 공식 페이지가 열리면 재대조가 필요합니다.
- **모델 선정은 가정입니다**. OpenAI는 제한 공개인 Astra 대신 일반 공개인 Sol을 골랐습니다. Meta는 Llama(Llama 4가 마지막) 대신 Muse를 골랐고, DeepSeek은 가장 최근 발표인 Flash-1017을 골랐습니다. DeepSeek V4-Pro-0813이 더 상위 모델일 수 있습니다.
- **Claude 발표일**: 문서는 11-09, 기사는 11-10으로 하루 차이가 있습니다.
- **Claude 속도 서술**: "5.1보다 약 30% 빠르다"는 기사 서술이라 비교 기준이 불명확합니다.
- **미확인 항목**: Claude Fable 5.2 벤치마크 점수, Meta Muse Wonder 점수와 개선 폭, Gemini 4 Carbon·DeepSeek 컨텍스트 길이, ChatGPT Sol·Luna 배포, Grok 후속 일정.
- **회사 간 점수 비교 불가**: 수치는 대부분 회사 자체 발표이고 시험 조건이 달라 회사끼리 직접 비교할 수 없습니다.
- **역량 공백**: 없음.
- 외부 발송·게시는 이번 업무에 없습니다.

## 근거
- 조사 파일과 HTML을 Read로 대조했습니다. HTML의 수치·날짜는 조사 파일과 일치하고 조사 파일에 없는 수치는 없습니다.
- 출처 자동 확인은 9건 모두 열렸고, 제목 불일치와 확인 불가는 없습니다. 본문 수치는 자동 확인 대상이 아닙니다.
- 별도 검증실 검토는 대표가 요청하지 않아 진행하지 않았습니다. 검토자는 비서실장입니다.
- 반려는 0회입니다.