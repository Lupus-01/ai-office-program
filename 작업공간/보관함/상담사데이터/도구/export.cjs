// 상담사 데이터 엑셀 만들기: 원본/의 상담사별 JSON을 탭 7개짜리 엑셀로 묶는다.
// 설정.json의 driveFolder(구글 드라이브 데스크톱 동기화 폴더)가 있으면 그 폴더에도 같은 파일을 쓴다(구글 시트에서 열림).
// 후기 작성자 닉네임은 원본에도 없고 엑셀에도 넣지 않는다. 엑셀 칸 한도(32,767자)를 넘는 글은 잘라 쓴다.
// 사용: node export.cjs
'use strict';
const { fs, path, RAW, LOG, SETTINGS, SHEET_DIR, STATE, needProgram, readJson, kst } = require('./lib.cjs');
const ExcelJS = needProgram('exceljs');

const FILE_NAME = '홍카페_상담사데이터.xlsx';
const MAX = 32000;
const UI_SECTIONS = new Set(['후기 필터 탭', '정렬 필터 바', '후기 리스트', '상단 바', '안내 박스', '코인 전화 상담 CTA', '채팅 상담 시작 CTA',
  '전체 후기 제목 + 평점', '후기가 있을때', '후기가 없을때', '상담사 포스팅', '판매상품', '프로필+최근3개월 묶음', '회색 영역']);
const cut = (s, n = MAX) => { const t = String(s ?? ''); return t.length > n ? `${t.slice(0, n)}…(잘림)` : t; };
const top = (list, n = 3) => (list || []).slice().sort((a, b) => (b.cnt || 0) - (a.cnt || 0)).slice(0, n).map((x) => `${x.name}(${x.cnt})`).join(', ');

function loadProfiles() {
  const out = [];
  for (const f of fs.readdirSync(RAW)) {
    if (!f.endsWith('.json')) continue;
    const p = readJson(path.join(RAW, f), null);
    if (p && p.code) out.push(p);
  }
  return out;
}

async function main() {
  const profiles = loadProfiles();
  if (!profiles.length) { console.log('원본 데이터가 없습니다. 먼저 collect.cjs를 실행하세요.'); process.exit(2); }
  const live = profiles.filter((p) => !p.gone);
  const groups = new Map();
  for (const p of live) {
    const key = p.ceCode || p.code;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const settings = readJson(SETTINGS, {});
  const targets = [path.join(SHEET_DIR, FILE_NAME)];
  if (settings.driveFolder) {
    if (fs.existsSync(settings.driveFolder)) targets.push(path.join(settings.driveFolder, FILE_NAME));
    else console.log(`구글 드라이브 폴더를 찾지 못했습니다(${settings.driveFolder}). Google Drive 앱 로그인·동기화 상태를 확인하세요. 로컬에만 저장합니다.`);
  }
  fs.mkdirSync(SHEET_DIR, { recursive: true });
  const tmp = path.join(SHEET_DIR, `.${FILE_NAME}.tmp-${process.pid}`);
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: tmp, useStyles: true, useSharedStrings: false });
  const sheet = (name, cols) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = cols.map(([header, key, width]) => ({ header, key, width: width || 14 }));
    ws.getRow(1).font = { bold: true };
    return ws;
  };
  const counts = { counselors: 0, products: 0, reviews: 0, postings: 0, details: 0, stats: 0 };

  // 1) 상담사(1명 1행)
  const wsC = sheet('상담사', [['상담사코드', 'ce', 24], ['예명', 'nick', 12], ['대표 프로필', 'code', 24], ['프로필 코드(전체)', 'codes', 30], ['분야', 'field', 30],
    ['060 번호', 'n060', 9], ['가격', 'price', 9], ['단위', 'unit', 8], ['평점', 'rating', 7], ['전체 후기 수', 'reviews', 11], ['최근 3개월 후기', 'r3', 11],
    ['만족도(%)', 'sat', 9], ['1:1문의 수', 'qna', 10], ['포스팅 수', 'posts', 9], ['최근 7일 후기 수', 'r7', 11], ['후기 키워드', 'kw', 30],
    ['상담분야 TOP3', 'fieldTop', 30], ['상담스타일 TOP3', 'styleTop', 30], ['교육 이수', 'edu', 18], ['상담사 공지', 'notice', 50], ['약력·리딩정보', 'career', 50],
    ['서비스 소개', 'intro', 50], ['프로필 링크', 'url', 40], ['수집 시각', 'at', 17]]);
  // 2) 판매상품
  const wsP = sheet('판매상품', [['상담사코드', 'ce', 24], ['예명', 'nick', 12], ['프로필 코드', 'from', 24], ['상품 종류', 'kind', 10], ['상품 코드', 'code', 24],
    ['가격', 'price', 9], ['단위', 'unit', 8], ['상태', 'state', 10], ['내용', 'text', 40], ['링크', 'url', 40]]);
  // 3) 후기_최근7일
  const wsR = sheet('후기_최근7일', [['상담사코드', 'ce', 24], ['예명', 'nick', 12], ['프로필 코드', 'code', 24], ['후기 번호', 'no', 10], ['작성일', 'date', 17],
    ['평점', 'point', 6], ['상담 시간', 'duration', 9], ['상담 분야', 'field', 14], ['상담 스타일', 'style', 14], ['베스트', 'best', 7], ['도움돼요', 'help', 8],
    ['사진', 'photo', 6], ['상담사 답글', 'reply', 9], ['고정', 'pinned', 6], ['내용', 'content', 60]]);
  // 4) 포스팅
  const wsT = sheet('포스팅', [['상담사코드', 'ce', 24], ['예명', 'nick', 12], ['글 번호', 'id', 10], ['게시일', 'date', 17], ['제목', 'title', 40], ['조회', 'views', 8],
    ['좋아요', 'likes', 8], ['댓글', 'comments', 7], ['분야', 'category', 10], ['사진', 'image', 6], ['내용(앞 500자)', 'content', 60]]);
  // 5) 상세정보_원문
  const wsD = sheet('상세정보_원문', [['상담사코드', 'ce', 24], ['예명', 'nick', 12], ['프로필 코드', 'code', 24], ['구역', 'section', 20], ['내용', 'text', 80]]);
  // 6) 통계
  const wsS = sheet('통계', [['상담사코드', 'ce', 24], ['예명', 'nick', 12], ['프로필 코드', 'code', 24], ['종류', 'type', 12], ['이름', 'name', 16], ['건수', 'cnt', 8],
    ['추세', 'trend', 8], ['이전', 'prev', 8], ['변화율', 'rate', 8], ['기준일', 'date', 11]]);

  const sorted = [...groups.entries()].sort((a, b) => (b[1][0].reviewCountLd || 0) - (a[1][0].reviewCountLd || 0));
  for (const [ce, list] of sorted) {
    list.sort((a, b) => (a.flag === 'call' ? -1 : 1) - (b.flag === 'call' ? -1 : 1));
    const main = list[0];
    const r7 = list.reduce((n, p) => n + (p.reviews7d || []).length, 0);
    wsC.addRow({ ce, nick: main.nick, code: main.code, codes: list.map((p) => `${p.code}(${p.flag === 'chat' ? '채팅' : '전화'})`).join(', '),
      field: (main.knowsAbout || []).slice(0, 6).join(', '), n060: main.number060, price: main.price, unit: main.unit, rating: main.rating,
      reviews: main.reviewCountLd ?? main.tabs?.reviews ?? null, r3: main.recent3m?.reviews ?? null, sat: main.satisfaction, qna: main.tabs?.qna ?? null,
      posts: main.tabs?.postings ?? null, r7, kw: (main.stats?.keywords || []).join(', '), fieldTop: top(main.stats?.fields), styleTop: top(main.stats?.styles),
      edu: (main.education || []).join(', '), notice: cut(main.notice, 3000), career: cut(main.sections?.['상담사 약력 + 리딩정보'], 3000), intro: cut(main.serviceIntro, 3000),
      url: main.url, at: main.collectedAt ? kst(new Date(main.collectedAt)) : '' }).commit();
    counts.counselors++;
    for (const p of list) {
      for (const x of p.products || []) { wsP.addRow({ ce, nick: p.nick, from: p.code, kind: x.kind, code: x.code, price: x.price, unit: x.unit, state: x.state, text: cut(x.text, 500), url: x.url }).commit(); counts.products++; }
      for (const r of p.reviews7d || []) {
        wsR.addRow({ ce, nick: p.nick, code: p.code, no: r.no, date: r.date, point: r.point, duration: r.duration, field: [].concat(r.field ?? []).join(', '), style: [].concat(r.style ?? []).join(', '), best: r.best,
          help: r.help, photo: r.photo ? 'O' : '', reply: r.hasReply ? 'O' : '', pinned: r.pinned ? 'O' : '', content: cut(r.content) }).commit();
        counts.reviews++;
      }
      for (const [section, text] of Object.entries(p.sections || {})) {
        if (UI_SECTIONS.has(section)) continue;
        wsD.addRow({ ce, nick: p.nick, code: p.code, section, text: cut(text) }).commit();
        counts.details++;
      }
      if (p.description) { wsD.addRow({ ce, nick: p.nick, code: p.code, section: '프로필 설명(구조화 데이터)', text: cut(p.description) }).commit(); counts.details++; }
      for (const q of p.faq || []) { wsD.addRow({ ce, nick: p.nick, code: p.code, section: '자주 묻는 질문', text: cut(`Q. ${q.q}\nA. ${q.a}`) }).commit(); counts.details++; }
      const s = p.stats || {};
      for (const x of s.fields || []) { wsS.addRow({ ce, nick: p.nick, code: p.code, type: '상담분야', name: x.name, cnt: x.cnt }).commit(); counts.stats++; }
      for (const x of s.styles || []) { wsS.addRow({ ce, nick: p.nick, code: p.code, type: '상담스타일', name: x.name, cnt: x.cnt }).commit(); counts.stats++; }
      for (const k of s.keywords || []) { wsS.addRow({ ce, nick: p.nick, code: p.code, type: '후기 키워드', name: k }).commit(); counts.stats++; }
      for (const x of s.trend || []) { wsS.addRow({ ce, nick: p.nick, code: p.code, type: `최근 변화(${x.type || ''})`, name: x.name, cnt: x.curr, trend: x.trend, prev: x.prev, rate: x.diffRate, date: s.trendDate }).commit(); counts.stats++; }
    }
    if (ce.startsWith('CE-')) {
      const posts = readJson(path.join(RAW, '포스팅', `${ce}.json`), { items: [] });
      for (const t of posts.items || []) {
        wsT.addRow({ ce, nick: main.nick, id: t.id, date: t.date, title: cut(t.title, 500), views: t.views, likes: t.likes, comments: t.comments, category: t.category,
          image: t.image ? 'O' : '', content: cut(t.content, 500) }).commit();
        counts.postings++;
      }
    }
  }
  wsC.commit(); wsP.commit(); wsR.commit(); wsT.commit(); wsD.commit(); wsS.commit();

  // 7) 수집기록
  const wsL = sheet('수집기록', [['항목', 'k', 22], ['값', 'v', 80]]);
  const run = readJson(STATE, {});
  const rows = [
    ['엑셀 만든 시각', `${kst()} (KST)`],
    ['수집 회차', run.runId || ''],
    ['후기 기준', run.cutoff ? `${kst(new Date(run.cutoff))} 이후(최근 7일)` : ''],
    ['상담사(상담사코드 기준)', counts.counselors], ['판매상품', counts.products], ['후기(최근 7일)', counts.reviews], ['포스팅', counts.postings],
    ['없는 페이지(종료 추정)', profiles.length - live.length],
    ['참고', '후기 작성자 닉네임과 1:1문의 내용은 모으지 않음(대표 결정). 전체 원본은 작업 공간 보관함/상담사데이터/원본/'],
  ];
  for (const [k, v] of rows) wsL.addRow({ k, v }).commit();
  if (fs.existsSync(LOG)) for (const line of fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.startsWith('- '))) wsL.addRow({ k: '수집 기록', v: line.slice(2) }).commit();
  wsL.commit();
  await wb.commit();

  const saved = [];
  for (const t of targets) {
    try { fs.copyFileSync(tmp, t); saved.push(t); } catch (e) { console.log(`저장 실패: ${t} (${e.code === 'EBUSY' ? '파일이 열려 있음' : e.message})`); }
  }
  fs.rmSync(tmp, { force: true });
  console.log(`엑셀: 상담사 ${counts.counselors}명 · 판매상품 ${counts.products} · 최근 7일 후기 ${counts.reviews} · 포스팅 ${counts.postings} · 상세 구역 ${counts.details} · 통계 ${counts.stats}`);
  for (const s of saved) console.log(`저장: ${s}`);
  if (!settings.driveFolder) console.log('구글 드라이브 폴더가 아직 설정되지 않아 로컬에만 저장했습니다(설정.json의 driveFolder).');
}

main().catch((e) => { console.error(`엑셀 만들기 오류: ${e.message}`); process.exit(1); });
