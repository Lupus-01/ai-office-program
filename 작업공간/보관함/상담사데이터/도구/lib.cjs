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

module.exports = { fs, path, ROOT, RAW, STATE, LOG, SETTINGS, SHEET_DIR, SITE, needProgram, parseJson, readJson, writeAtomic, sleep, kst, decodeEnt, htmlText, siteDate, maskContacts, request };
