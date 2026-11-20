// 상담사 데이터 도구 공통: 경로, 프로그램 폴더 찾기, 홍카페 요청, 글 정리
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..'); // 보관함/상담사데이터
const RAW = path.join(ROOT, '원본');
const STATE = path.join(ROOT, '상태.json');
const LOG = path.join(ROOT, '수집기록.md');
const SETTINGS = path.join(ROOT, '설정.json');
const SHEET_DIR = path.join(ROOT, '시트');
const SITE = 'https://www.hongcafe.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 HongcafeDataAsset/1.0';

function programRoot() {
  if (process.env.AI_OFFICE_PROGRAM) return process.env.AI_OFFICE_PROGRAM;
  let dir = __dirname;
  for (let i = 0; i < 12; i++) {
    const marker = path.join(dir, '.ai-office-workspace');
    if (fs.existsSync(marker)) {
      const m = fs.readFileSync(marker, 'utf8').match(/^program:\s*(.+)$/m);
      if (m) return m[1].trim();
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error('프로그램 폴더를 찾지 못했습니다. 작업 공간의 .ai-office-workspace 파일을 확인하세요.');
}
const needProgram = (name) => require(path.join(programRoot(), 'node_modules', name));

const parseJson = (t) => { try { return JSON.parse(t); } catch { return null; } };
const readJson = (file, fallback) => (fs.existsSync(file) ? parseJson(fs.readFileSync(file, 'utf8')) ?? fallback : fallback);
function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);

const decodeEnt = (s) => String(s ?? '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&');
function htmlText(html) {
  return decodeEnt(String(html ?? '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n');
}

// 홍카페 날짜("2026.11.10 13:22:01" 또는 "2026-11-10 13:22:01", 한국 시각)를 Date로
function siteDate(s) {
  const m = String(s || '').match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], (+m[4] || 0) - 9, +m[5] || 0, +m[6] || 0));
}

// 공개 글 속 연락처 형식은 가린다(휴대전화·메일·계좌·주민번호)
function maskContacts(text) {
  return String(text ?? '')
    .replace(/(?<!\d)\d{6}[- ]?[1-4]\d{6}(?!\d)/g, '[주민등록번호 가림]')
    .replace(/(?<![\d-])01[016789][-. ]?\d{3,4}[-. ]?\d{4}(?![\d-])/g, '[휴대전화 가림]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[메일 가림]')
    .replace(/(?<![\d-])[1-9]\d{1,5}(?:-\d{2,8}){2,4}(?![\d-])/g, (m) => {
      const n = m.replace(/-/g, '').length;
      return n >= 10 && n <= 16 && !/^\d{3}-\d{2}-\d{5}$/.test(m) ? '[계좌번호 가림]' : m;
    });
}

// 사이트 요청: 천천히, 실패하면 두 번까지 다시
let lastRequest = 0;
const GAP_MS = Number(process.env.HONGCAFE_GAP_MS || 350);
async function request(url, { form = null, referer = SITE, json = false } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastRequest + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    try {
      const res = await fetch(url, {
        method: form ? 'POST' : 'GET',
        headers: {
          'User-Agent': UA,
          Referer: referer,
          ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' } : {}),
        },
        body: form ? new URLSearchParams(form).toString() : undefined,
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 404 || res.status === 410) return { status: res.status, body: null, url: res.url };
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return { status: res.status, body: json ? parseJson(text) : text, url: res.url };
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

// 영상·3D 글꼴: 인터넷 글꼴 대신 도구/글꼴의 파일을 쓴다(장면마다 글꼴이 늦게 와서 굵기가 바뀌던 문제 방지, 2026-11-17)
const FONT_DIR = path.join(__dirname, '글꼴');
const FONT_CSS = "@font-face{font-family:'Jua';src:url(https://fonts.local/Jua-Regular.ttf) format('truetype');font-display:block}"
  + "@font-face{font-family:'Noto Sans KR';src:url(https://fonts.local/NotoSansKR.ttf) format('truetype');font-weight:100 900;font-display:block}";
async function useLocalFonts(page) {
  await page.route('https://fonts.local/**', (route) => {
    const file = path.join(FONT_DIR, decodeURIComponent(new URL(route.request().url()).pathname.slice(1)));
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: 'font/ttf', body: fs.readFileSync(file) });
  });
}
// 페이지의 글꼴을 다 불러올 때까지 기다리고, 못 불러오면 다른 글꼴로 그리지 않게 오류를 낸다
async function waitFonts(page) {
  const ok = await page.evaluate(async () => {
    const t = '가나다라 볼콩이 ABC 123 !?';
    await Promise.all([document.fonts.load('56px Jua', t), document.fonts.load('400 48px "Noto Sans KR"', t), document.fonts.load('700 48px "Noto Sans KR"', t), document.fonts.load('900 48px "Noto Sans KR"', t)]);
    await document.fonts.ready;
    return document.fonts.check('56px Jua', t) && document.fonts.check('700 48px "Noto Sans KR"', t);
  });
  if (!ok) throw new Error('글꼴(Jua·Noto Sans KR)을 불러오지 못했습니다. 보관함/상담사데이터/도구/글꼴 폴더를 확인하세요.');
}

// ---------- 프로필 정리(수집·tidy 공용, 2026-11-20) ----------
const REVIEW_DIR = path.join(RAW, '후기'); // 쌓아 두는 후기(프로필 코드별)
const TREND_DIR = path.join(RAW, '추이'); // 회차별 후기 수·평점 기록
const toNum = (s) => (s === undefined || s === null || s === '' ? null : Number(String(s).replace(/,/g, '')));
// 화면 조각일 뿐인 구역(버튼·필터·로그인 안내)과 채워지지 않은 화면 틀({{…}})은 저장하지 않는다
const UI_ONLY = new Set(['후기 필터 탭', '정렬 필터 바', '후기 리스트', '상단 바', '안내 박스', '코인 전화 상담 CTA', '채팅 상담 시작 CTA', '전체 후기 제목 + 평점', '후기가 있을때', '후기가 없을때']);
function cleanSections(sections) {
  return Object.fromEntries(Object.entries(sections || {}).filter(([name, text]) => !UI_ONLY.has(name) && !String(text).includes('{{')));
}
const bullets = (text) => String(text || '').split('\n').map((l) => l.trim()).filter((l) => l && !/^(•|전체보기|닫기|더보기|상담사 약력|리딩정보)$/.test(l));
// 구역 원문에서 뽑는 값. base는 지금까지 읽은 프로필, secText는 정리하기 전 구역 원문
function deriveProfile(base, secText) {
  const block = secText['프로필+최근3개월 묶음'] || secText['후기가 있을때'] || '';
  // "최근 3개월 … 후기 1,437 건 5점 만족도 100 %". 예전 식은 화면 아래쪽의 다른 숫자를 읽어 틀렸다
  const r3 = block.match(/최근 3개월[\s\S]{0,80}?후기\s*([\d,]+)\s*건\s*5점 만족도\s*([\d.]+)\s*%/);
  const chatPrice = block.match(/\n([\d,]+)\n\(\s*(\d+\s*[초분])\s*\)/); // 채팅 프로필은 060 번호가 없어 머리줄 식에 안 걸린다
  const gradeLine = (block.match(/\(\s*\d+\s*[초분]\s*\)\n([^\n]{1,12})(?:\n|$)/) || [])[1] || '';
  const [careerText, readingText = ''] = String(secText['상담사 약력 + 리딩정보'] || '').split(/\n리딩정보\n?/);
  const kinds = secText['후기 필터 탭'] || '';
  const kind = (label) => toNum((kinds.match(new RegExp(`${label}\\s*([\\d,]+)`)) || [])[1]);
  return {
    recent3m: r3 ? { reviews: toNum(r3[1]), fiveRate: Number(r3[2]) } : null,
    satisfaction: r3 ? Number(r3[2]) : null,
    price: base.price ?? (chatPrice ? toNum(chatPrice[1]) : null),
    unit: base.unit || (chatPrice ? chatPrice[2].replace(/\s+/g, '') : ''),
    grade: /교육|최근|현재|닫기|더보기/.test(gradeLine) ? '' : gradeLine,
    career: bullets(careerText),
    reading: bullets(readingText),
    reviewKinds: kinds ? { best: kind('베스트 후기'), handwriting: kind('손글씨 후기'), pick: kind('상담사 PICK'), success: kind('성공사례 후기'), story: kind('나만의 점 스토리') } : null,
  };
}
// 후기 쌓기: 프로필 코드별 파일에 후기 번호로 합친다. 다시 받은 후기는 새 값(도움돼요 수 등)으로 바꾼다
function loadReviews(code) {
  return readJson(path.join(REVIEW_DIR, `${code}.json`), { items: [] }).items || [];
}
function archiveReviews(code, list) {
  const file = path.join(REVIEW_DIR, `${code}.json`);
  const prev = loadReviews(code);
  if (!prev.length && !(list || []).length) return { total: 0, added: 0 };
  const map = new Map(prev.map((r) => [String(r.no), r]));
  let added = 0;
  for (const r of list || []) { if (!map.has(String(r.no))) added++; map.set(String(r.no), r); }
  const items = [...map.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (added || items.length !== prev.length || (list || []).length) writeAtomic(file, `${JSON.stringify({ code, updated: new Date().toISOString(), items }, null, 1)}\n`);
  return { total: items.length, added };
}
// 회차 기록: 상담사 프로필마다 후기 수·평점·가격 한 줄. 지난 회차와 비교해 "이번 주 후기가 많이 는 상담사"를 뽑는 데 쓴다
function writeSnapshot(runId) {
  const rows = {};
  for (const f of fs.readdirSync(RAW)) {
    if (!f.endsWith('.json')) continue;
    const p = readJson(path.join(RAW, f), null);
    if (!p || !p.code || p.gone) continue;
    rows[p.code] = { ce: p.ceCode || '', nick: p.nick || '', total: p.reviewStats?.total ?? p.reviewCountLd ?? p.tabs?.reviews ?? null,
      star: p.rating ?? p.reviewStats?.star ?? null, r3: p.recent3m?.reviews ?? null, r7: (p.reviews7d || []).length, price: p.price ?? null, grade: p.grade || '' };
  }
  const file = path.join(TREND_DIR, `${runId}.json`);
  writeAtomic(file, `${JSON.stringify({ runId, at: new Date().toISOString(), rows })}\n`);
  return { file, rows: Object.keys(rows).length };
}

module.exports = { FONT_CSS, useLocalFonts, waitFonts, fs, path, ROOT, RAW, STATE, LOG, SETTINGS, SHEET_DIR, SITE, REVIEW_DIR, TREND_DIR, needProgram, parseJson, readJson, writeAtomic, sleep, kst, decodeEnt, htmlText, siteDate, maskContacts, request,
  cleanSections, deriveProfile, loadReviews, archiveReviews, writeSnapshot };
