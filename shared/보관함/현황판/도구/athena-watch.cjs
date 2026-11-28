#!/usr/bin/env node
// 아테나 주요사항 확인: 내 담당 상담사 중 지금 챙겨야 할 사람을 아테나에서 읽어 현황판(보관함/현황판/athena.json)에 올린다.
// Aside 브라우저의 아테나 로그인을 쓴다(읽기 전용: 저장·수정·상태 변경 없음). AI를 쓰지 않는다.
//
//   node 보관함/현황판/도구/athena-watch.cjs [--only weekly|incentive|daily] [--out <결과.json>]
//        weekly(기본): 이번 주 배정 상담사 · 파트너 계약 검토 · 포스팅 대기 · 홍멘토 멘토/멘티 신청
//        incentive   : 인센티브(소개비) 지급 대상
//        daily       : 1:1 문의·후기 규정 점검(어제·오늘 글에서 개인 연락·SNS 거래, 외부 거래, 욕설 표현을 찾는다. 기준은 보관함/현황판/점검규칙.json)
//   node 보관함/현황판/도구/athena-watch.cjs --check      아테나 로그인과 담당자 이름만 확인(시작 전 점검용)
//
// 아테나 주소: 같은 폴더의 설정.json {"athena":"https://…"} (없으면 보관함/광고운영/도구/설정.json의 athena)
// 담당자 이름: 보관함/현황판/설정.json {"manager":"이름"} — 현황판 화면에서 고르거나 적는다
// 전화번호·아이디(메일)·금액은 브라우저에서 읽은 자리에서 버리고, 누구인지 알아볼 이름·닉네임·분야·단계·상태·날짜만 남긴다.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveRules, checkText } = require('./watch-rules.cjs');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? String(args[i + 1] ?? '') : ''; };
const board = opt('vault') || path.join(__dirname, '..');
const panelFile = path.join(board, 'athena.json');
const settingsFile = path.join(board, '설정.json');
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return fallback; } };
const writeJson = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(data, null, 1)}\n`); fs.renameSync(tmp, file); };
const nowIso = () => new Date().toISOString();

const only = opt('only') || 'weekly';
const checkOnly = args.includes('--check');
if (!['weekly', 'incentive', 'daily'].includes(only)) { console.error('--only 는 weekly, incentive, daily 중 하나입니다.'); process.exit(1); }

// 실패해도 현황판에 사유가 보이게 남긴다(지난 목록은 그대로 둔다)
function fail(message, { record = true } = {}) {
  if (record && !checkOnly) {
    const panel = readJson(panelFile, null) || emptyPanel('');
    panel.error = { at: nowIso(), message };
    try { writeJson(panelFile, panel); } catch { /* 기록하지 못해도 사유는 출력한다 */ }
  }
  console.error(message); process.exit(1);
}

const CARDS = [
  { id: 'assign', group: 'weekly', title: '이번 주 배정 상담사', path: '/callee/callee', when: '월·수·금 10:30', hint: '내 담당으로 배정됐고 정산정보 입력일이 아직 없는 상담사' },
  { id: 'partner', group: 'weekly', title: '파트너 계약 검토', path: '/callee/partner?ce_contact_status=1', when: '월·수·금 10:30', hint: '파트너 계약이 검토중인 내 담당 상담사' },
  { id: 'posting', group: 'weekly', title: '포스팅 대기', path: '/items/posting?pt_status=1', when: '월·수·금 10:30', hint: '내 담당 상담사가 올린 포스팅 중 대기 상태' },
  { id: 'mentor', group: 'weekly', title: '홍멘토 멘토 신청', path: '/hongmentor/mentor/pending', when: '월·수·금 10:30', hint: '멘토를 신청한 내 담당 상담사' },
  { id: 'mentee', group: 'weekly', title: '홍멘토 멘티 신청', path: '/hongmentor/mentee/requested', when: '월·수·금 10:30', hint: '멘티를 신청했거나 멘토로 지목된 내 담당 상담사' },
  { id: 'qna', group: 'daily', title: '1:1 문의 규정 점검', path: '/items/qna', when: '매일 15:00', hint: '내 담당 상담사의 1:1 문의·답변 중 개인 연락·SNS 거래, 외부 거래, 욕설 표현이 걸린 글(사람이 다시 볼 후보)' },
  { id: 'review', group: 'daily', title: '후기 규정 점검', path: '/items/comment', when: '매일 15:00', hint: '내 담당 상담사의 후기·댓글 중 개인 연락·SNS 거래, 외부 거래, 욕설 표현이 걸린 글(사람이 다시 볼 후보)' },
  { id: 'incentive', group: 'incentive', title: '인센티브 지급 대상', path: '/callee/incentive', when: '매달 15일 11:30', hint: '내 담당 상담사 중 소개비가 지급대기인 건' },
];
function emptyPanel(manager) {
  return { version: 1, id: 'athena', title: '관리 필요 상담사', source: '아테나', manager, updatedAt: '', error: null,
    cards: CARDS.map((c) => ({ id: c.id, title: c.title, hint: c.hint, when: c.when, link: '', checkedAt: '', note: '', items: [] })) };
}

const toolConfig = readJson(path.join(__dirname, '설정.json'), {});
const adConfig = readJson(path.join(board, '..', '광고운영', '도구', '설정.json'), {});
const athena = String(opt('athena') || toolConfig.athena || adConfig.athena || '').replace(/\/+$/, '');
if (!/^https:\/\/[^/]+$/.test(athena)) fail('아테나 주소가 없습니다. 보관함/현황판/도구/설정.json에 {"athena":"https://…"}를 적어 주세요.');
const settings = readJson(settingsFile, {});
const manager = String(opt('manager') || settings.manager || '').trim();
// 지난 실행에서 본 담당자 식별값과 쪽 수(다음 실행이 느린 화면을 덜 기다리게 한다). 담당자가 바뀌면 쓰지 않는다
const memo = settings.memo && settings.memo.manager === manager && manager ? settings.memo : {};
const list = (v) => Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x).slice(0, 10) : [];
const count = (v) => Number.isInteger(v) && v >= 1 && v <= 60 ? v : 1;
const remembered = { managerIds: list(memo.managerIds), incentiveIds: list(memo.incentiveIds), calleePages: count(memo.calleePages), incentivePages: count(memo.incentivePages) };
let rules;
try { rules = resolveRules(fs.existsSync(path.join(board, '점검규칙.json')) ? JSON.parse(fs.readFileSync(path.join(board, '점검규칙.json'), 'utf8').replace(/^﻿/, '')) : null); }
catch (e) { fail('점검규칙.json 오류: ' + e.message); }
const kstDay = (offset) => new Date(Date.now() + 9 * 3600000 - offset * 86400000).toISOString().slice(0, 10);
const windowStart = kstDay(rules.days - 1), windowEnd = kstDay(0);

function asideBin() {
  const local = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Aside', 'CLI', 'current', 'aside.exe') : '';
  const home = path.join(process.env.HOME || process.env.USERPROFILE || '', '.aside', 'bin', 'aside');
  for (const p of [local, home]) if (p && fs.existsSync(p)) return p;
  return 'aside';
}
function repl(code, what) {
  const r = spawnSync(asideBin(), ['repl', '--json', '--file', '-'], { input: code, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 240000 });
  if (r.error) fail(`Aside를 실행하지 못했습니다(${r.error.message}). Aside 앱과 CLI가 설치돼 있는지 확인해 주세요.`);
  const line = String(r.stdout || '').trim().split('\n').pop();
  let parsed; try { parsed = JSON.parse(line); } catch { fail(`Aside 응답을 읽지 못했습니다(${what}).`); }
  const text = (parsed.run?.content || []).map((c) => c.text || '').join('\n');
  const at = text.indexOf('AIO_RESULT');
  if (at < 0) fail(`${what}을(를) 읽지 못했습니다: ${String(parsed.run?.error || '').slice(-200) || '응답 없음'}`);
  const end = text.indexOf('AIO_END', at);
  return JSON.parse(text.slice(at + 10, end < 0 ? undefined : end));
}

// 브라우저(아테나 화면) 안에서 실행된다. 화면의 표만 읽는다(GET 요청만 보낸다)
async function collect(AIO) {
  const n = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const isLogin = (doc) => !!doc.querySelector('input[type="password"]');
  const get = async (u) => {
    const r = await fetch(u, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u.split('?')[0]);
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    if (isLogin(doc)) { const e = new Error('login'); e.login = true; throw e; }
    return doc;
  };
  const ce = (tr) => { const m = tr.innerHTML.match(/viewCalleeInfo\('(CE-[0-9-]+)'/); return m ? m[1] : ''; };
  const pool = async (list, size, work) => { const queue = [...list]; await Promise.all(Array.from({ length: size }, async () => { while (queue.length) await work(queue.shift()); })); };
  const lastPage = (doc) => Math.max(1, ...[...doc.querySelectorAll('.pagination a')].map((a) => Number(((a.getAttribute('href') || '').match(/page=(\d+)/) || [])[1] || 0)));
  // 머리글에 need가 모두 있는 표의 줄 목록
  const tables = (doc, need) => [...doc.querySelectorAll('table')].map((tb) => {
    const heads = [...tb.querySelectorAll('thead th')].map((th) => n(th.textContent));
    if (!need.every((h) => heads.includes(h))) return null;
    return { heads, rows: [...tb.querySelectorAll('tbody tr')].map((tr) => ({ tr, cells: [...tr.children].map((td) => n(td.textContent)) })).filter((r) => r.cells.length >= need.length) };
  }).filter(Boolean);
  // hint: 지난번에 본 쪽 수. 그만큼은 첫 쪽을 기다리지 않고 한꺼번에 요청한다(느린 화면을 차례로 기다리지 않게). 실제 쪽 수는 첫 쪽에서 다시 읽는다
  const pages = async (base, max, hint) => {
    const url = (p) => p === 1 ? base : base + (base.includes('?') ? '&' : '?') + 'page=' + p;
    const want = Math.max(1, Math.min(hint || 1, max));
    const docs = await Promise.all(Array.from({ length: want }, (_, i) => get(url(i + 1))));
    const total = lastPage(docs[0]), upto = Math.min(total, max);
    const queue = [];
    for (let p = want + 1; p <= upto; p++) queue.push(p);
    await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) { const p = queue.shift(); docs[p - 1] = await get(url(p)); } }));
    return { docs: docs.slice(0, upto), total, cut: total > upto };
  };
  const same = (a, b) => a.length === b.length && a.every((v) => b.includes(v));
  const optionsOf = (doc) => [...doc.querySelectorAll('select[name="regist_id"] option')].map((o) => [o.value, n(o.textContent)]).filter((o) => o[0]);
  const out = { notes: [] };
  try {
    // 로그인 확인은 빨리 뜨는 화면으로 한다(로그인이 풀렸으면 get이 login으로 알린다)
    await get('/items/posting?pt_status=1');
    let options = null, mineIds = AIO.manager ? (AIO.managerIds || []) : [];
    if (AIO.onlyCheck && mineIds.length) return { ok: true };
    if (!mineIds.length) {
      options = optionsOf(await get('/callee/callee'));
      out.managers = [...new Set(options.map((o) => o[1]))];
      mineIds = options.filter((o) => o[1] === AIO.manager).map((o) => o[0]);
      if (!AIO.manager || !mineIds.length) return { error: 'manager', managers: out.managers };
      if (AIO.onlyCheck) return { ok: true, managers: out.managers, managerIds: mineIds };
    }

    // 내 담당 상담사 전체(상담사 리스트를 담당자로 걸러 읽는다)
    let mine = new Map(), calleePages = 1;
    for (let attempt = 0; attempt < 2; attempt++) {
      mine = new Map();
      let firstDoc = null;
      for (const id of mineIds) {
      const got = await pages('/callee/callee/?regist_id=' + encodeURIComponent(id), 60, AIO.calleePages);
      calleePages = Math.max(calleePages, got.total);
      if (!firstDoc) firstDoc = got.docs[0];
      if (got.cut && !out.notes.includes('상담사 리스트가 60쪽을 넘어 일부만 읽었습니다')) out.notes.push('상담사 리스트가 60쪽을 넘어 일부만 읽었습니다');
      for (const doc of got.docs) {
        const t = tables(doc, ['이름', '닉네임', '담당자', '등록일', '정산정보입력일'])[0];
        if (!t) return { error: 'columns', where: '상담사 리스트' };
        const at = (h) => t.heads.indexOf(h);
        for (const r of t.rows) {
          const code = ce(r.tr);
          if (!code || r.cells[at('담당자')] !== AIO.manager) continue;
          mine.set(code, { key: code, name: r.cells[at('이름')], nick: r.cells[at('닉네임')], cat: r.cells[at('카테고리')] || '', stage: r.cells[at('단계')] || '', state: r.cells[at('등록상태')] || '', reg: r.cells[at('등록일')], fin: r.cells[at('정산정보입력일')] });
        }
      }
    }
      if (options) break;
      // 기억해 둔 식별값이 지금 아테나의 담당자 목록과 같은지 확인한다. 다르면 새 값으로 한 번 더 읽는다
      options = optionsOf(firstDoc);
      out.managers = [...new Set(options.map((o) => o[1]))];
      const fresh = options.filter((o) => o[1] === AIO.manager).map((o) => o[0]);
      if (!fresh.length) return { error: 'manager', managers: out.managers };
      if (same(fresh, mineIds)) break;
      mineIds = fresh;
    }
    out.mine = mine.size; out.managerIds = mineIds; out.calleePages = calleePages;

    if (AIO.only === 'weekly') {
      // ① 이번 주 배정: 정산정보 입력일이 날짜로 적히지 않은 내 담당 상담사
      out.assign = [...mine.values()].filter((c) => !/\d{4}\D\d{1,2}\D\d{1,2}/.test(c.fin));

      // ② 파트너 계약 검토중
      const pdoc = await pages('/callee/partner?ce_contact_status=1', 10);
      const seen = new Set(); out.partner = [];
      for (const doc of pdoc.docs) {
        const found = [...tables(doc, ['닉네임', '계약상태처리']), ...tables(doc, ['닉네임', '계약상태'])];
        if (!found.length && doc === pdoc.docs[0]) return { error: 'columns', where: '파트너 계약' };
        for (const t of found) {
          const at = (h) => t.heads.indexOf(h);
          const si = at('계약상태처리') >= 0 ? at('계약상태처리') : at('계약상태');
          for (const r of t.rows) {
            const code = ce(r.tr);
            if (!code || seen.has(code) || !mine.has(code) || !/검토중/.test(r.cells[si])) continue;
            seen.add(code);
            out.partner.push({ key: code, name: r.cells[at('이름')] || mine.get(code).name, nick: r.cells[at('닉네임')], cat: r.cells[at('카테고리')] || '', stage: r.cells[at('단계구분')] || '', date: (r.cells[at('최근상태수정일')] || '').slice(0, 10) });
          }
        }
      }

      // ③ 포스팅 대기
      const post = await pages('/items/posting?pt_status=1', 40);
      if (post.cut) out.notes.push('대기 포스팅이 40쪽을 넘어 최근 것만 읽었습니다');
      out.posting = []; out.postingAll = 0;
      for (const doc of post.docs) {
        const t = tables(doc, ['제목', '상담사닉네임', '등록일', '등록상태'])[0];
        if (!t) { if (doc === post.docs[0]) return { error: 'columns', where: '포스팅 관리' }; continue; }
        const at = (h) => t.heads.indexOf(h);
        for (const r of t.rows) {
          const sel = r.tr.querySelector('select[name="pt_status"]');
          const chosen = sel ? (sel.querySelector('option[selected]') || {}).value : '1';
          if (chosen && chosen !== '1') continue;
          out.postingAll++;
          const code = ce(r.tr);
          if (!code || !mine.has(code)) continue;
          out.posting.push({ key: 'P' + r.cells[at('NO')], nick: r.cells[at('상담사닉네임')], title: r.cells[at('제목')].slice(0, 60), date: (r.cells[at('등록일')] || '').slice(0, 10) });
        }
      }

      // ⑤ 홍멘토 멘토 신청 · ⑥ 멘티 신청(신청 탭)
      const nicks = new Map();
      for (const c of mine.values()) if (c.nick) nicks.set(c.nick, nicks.has(c.nick) ? null : c.key);
      const mineOf = (td) => { const code = td ? ce(td) : ''; if (code) return mine.has(code) ? code : ''; const byNick = td ? nicks.get(n(td.textContent)) : ''; return byNick || ''; };
      out.mentor = []; out.mentee = [];
      const mdoc = await pages('/hongmentor/mentor/pending', 10);
      for (const doc of mdoc.docs) {
        const t = tables(doc, ['상담사 닉네임', '신청일시', '상태'])[0];
        if (!t) return { error: 'columns', where: '멘토 신청현황' };
        const at = (h) => t.heads.indexOf(h);
        for (const r of t.rows) {
          const code = mineOf(r.tr.children[at('상담사 닉네임')]);
          if (!code) continue;
          out.mentor.push({ key: 'M' + code + '|' + r.cells[at('신청일시')], name: mine.get(code).name, nick: r.cells[at('상담사 닉네임')], date: (r.cells[at('신청일시')] || '').slice(0, 10), state: r.cells[at('상태')] });
        }
      }
      const edoc = await pages('/hongmentor/mentee/requested', 10);
      for (const doc of edoc.docs) {
        const t = tables(doc, ['멘티상담사 닉네임', '멘토상담사 닉네임', '신청일시', '상태'])[0];
        if (!t) return { error: 'columns', where: '멘티 신청현황' };
        const at = (h) => t.heads.indexOf(h);
        for (const r of t.rows) {
          const menteeCode = mineOf(r.tr.children[at('멘티상담사 닉네임')]), mentorCode = mineOf(r.tr.children[at('멘토상담사 닉네임')]);
          if (!menteeCode && !mentorCode) continue;
          const code = menteeCode || mentorCode;
          out.mentee.push({ key: 'E' + code + '|' + r.cells[at('신청일시')], name: mine.get(code).name, nick: menteeCode ? r.cells[at('멘티상담사 닉네임')] : r.cells[at('멘토상담사 닉네임')], role: menteeCode ? '멘티 신청' : '멘토로 지목됨',
            other: menteeCode ? '멘토 ' + r.cells[at('멘토상담사 닉네임')] : '멘티 ' + r.cells[at('멘티상담사 닉네임')], date: (r.cells[at('신청일시')] || '').slice(0, 10) });
        }
      }
    } else if (AIO.only === 'daily') {
      // ⑦ 1:1 문의 · ⑧ 후기: 기간 안의 글 중 내 담당 상담사 것만 전체 글을 읽어 온다(규정 점검은 PC에서 한다)
      const range = '?start_date=' + AIO.start + '&end_date=' + AIO.end;
      out.qna = []; out.review = []; out.qnaAll = 0; out.reviewAll = 0;
      const qdoc = await pages('/items/qna' + range, 150);
      if (qdoc.cut) out.notes.push('1:1 문의가 150쪽을 넘어 일부만 읽었습니다');
      for (const doc of qdoc.docs) {
        const t = tables(doc, ['상담사닉네임', '고객문의', '상담사답변', '등록일'])[0];
        if (!t) { if (doc === qdoc.docs[0]) return { error: 'columns', where: '1:1 문의 관리' }; continue; }
        const at = (h) => t.heads.indexOf(h);
        for (const r of t.rows) {
          const link = r.tr.querySelector('[data-qano]');
          if (!link) continue;
          out.qnaAll++;
          const code = ce(r.tr);
          if (!code || !mine.has(code)) continue;
          out.qna.push({ key: 'Q' + link.getAttribute('data-qano'), no: link.getAttribute('data-qano'), nick: r.cells[at('상담사닉네임')], date: r.cells[at('등록일')], text: r.cells[at('고객문의')], reply: r.cells[at('상담사답변')] });
        }
      }
      // 목록의 글이 잘렸을 수 있어 상세 화면에서 전체 글을 읽는다(읽지 못하면 목록의 글로 점검한다)
      await pool(out.qna, 4, async (q) => {
        try {
          const d = await get('/items/qnaDetail?qa_no=' + q.no);
          const body = d.querySelector('textarea[name="qa_content"]'), reply = d.querySelector('textarea[name="qa_reply"]');
          if (body && body.value.length >= q.text.replace(/\.\.$/, '').length) q.text = n(body.value);
          if (reply && reply.value.length >= q.reply.length) q.reply = n(reply.value);
        } catch (e) { if (e.login) throw e; q.partial = true; }
      });
      const cdoc = await pages('/items/comment' + range, 150);
      if (cdoc.cut) out.notes.push('후기가 150쪽을 넘어 일부만 읽었습니다');
      for (const doc of cdoc.docs) {
        const t = tables(doc, ['상담사닉네임', '후기내용', '등록일'])[0];
        if (!t) { if (doc === cdoc.docs[0]) return { error: 'columns', where: '후기 관리' }; continue; }
        const at = (h) => t.heads.indexOf(h);
        for (const r of t.rows) {
          const link = r.tr.querySelector('[data-cmno]');
          if (!link) continue;
          out.reviewAll++;
          const code = ce(r.tr);
          if (!code || !mine.has(code)) continue;
          out.review.push({ key: 'R' + link.getAttribute('data-cmno'), no: link.getAttribute('data-cmno'), nick: r.cells[at('상담사닉네임')].replace(/\s*\(\d+\)\s*$/, ''), date: r.cells[at('등록일')], text: r.cells[at('후기내용')], reply: '' });
        }
      }
      // 후기 전체 글과 상담사 댓글은 화면의 "내용 보기"와 같은 조회로 읽는다(조회만 한다)
      await pool(out.review, 4, async (c) => {
        try {
          const res = await fetch('/api/items/getCommentContent', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: 'cm_no=' + encodeURIComponent(c.no) });
          const data = res.ok ? await res.json() : null;
          if (data && data.comment) { c.text = n(data.comment.cm_content) || c.text; c.reply = n(data.comment.reply); } else c.partial = true;
        } catch (e) { c.partial = true; }
      });
      const partial = [...out.qna, ...out.review].filter((x) => x.partial).length;
      if (partial) out.notes.push('전체 글을 읽지 못해 목록에 보이는 부분만 점검한 글 ' + partial + '건');
    } else {
      // ④ 인센티브(소개비) 지급대기: 담당자로 걸러 읽는다
      let incIds = AIO.incentiveIds || [], incOptions = null, bad = 0, incPages = 1;
      if (!incIds.length) {
        incOptions = optionsOf(await get('/callee/incentive'));
        incIds = incOptions.filter((o) => o[1] === AIO.manager).map((o) => o[0]);
        if (!incIds.length) return { error: 'manager', managers: out.managers, where: '인센티브 관리' };
      }
      for (let attempt = 0; attempt < 2; attempt++) {
      out.incentive = []; out.incentiveAll = 0; out.incentiveReview = 0; bad = 0;
      let firstDoc = null;
      for (const id of incIds) {
        const got = await pages('/callee/incentive/?regist_id=' + encodeURIComponent(id), 60, AIO.incentivePages);
        incPages = Math.max(incPages, got.total);
        if (!firstDoc) firstDoc = got.docs[0];
        for (const doc of got.docs) {
          const tb = doc.querySelector('table');
          const heads = tb ? n(tb.querySelector('thead') && tb.querySelector('thead').textContent) : '';
          if (!/소개비 상태/.test(heads) || !/추천인/.test(heads)) return { error: 'columns', where: '인센티브 관리' };
          for (const tr of tb.querySelectorAll('tbody tr')) {
            const c = [...tr.children].map((td) => n(td.textContent));
            if (c.length === 1) continue; // "내역 없음" 줄
            if (c.length !== 14) { bad++; continue; }
            out.incentiveAll++;
            if (/심사/.test(c[8]) || /심사/.test(c[11])) out.incentiveReview++;
            if (!/지급대기/.test(c[8]) && !/지급대기/.test(c[11])) continue;
            out.incentive.push({ key: ce(tr) || (c[2] + '|' + c[3]), who: c[2], cat: c[1], reg: c[3], status: c[8], recommender: c[10], recStatus: c[11] });
          }
        }
      }
      if (incOptions) break;
      incOptions = optionsOf(firstDoc);
      const fresh = incOptions.filter((o) => o[1] === AIO.manager).map((o) => o[0]);
      if (!fresh.length) return { error: 'manager', managers: out.managers, where: '인센티브 관리' };
      if (same(fresh, incIds)) break;
      incIds = fresh;
      }
      out.incentiveIds = incIds; out.incentivePages = incPages;
      if (bad && !out.incentiveAll) return { error: 'columns', where: '인센티브 관리' };
      if (bad) out.notes.push('인센티브 표에서 모양이 다른 줄 ' + bad + '개는 읽지 않았습니다');
    }
    return out;
  } catch (e) {
    if (e.login) return { error: 'login' };
    return { error: String(e.message || e) };
  }
}

const code = (onlyCheck) => `
const AIO = ${JSON.stringify({ origin: athena, manager, only, onlyCheck, start: windowStart, end: windowEnd, ...remembered })};
const aioTab = await openTab(AIO.origin + '/assets/js/AppCsrfAjax.js');
const aioData = await aioTab.evaluate(${collect.toString()}, AIO);
console.log('AIO_RESULT' + JSON.stringify(aioData) + 'AIO_END');
await closeTab(aioTab);
`;

// 규정 점검: 글과 답변을 따로 보고, 걸린 분류와 앞뒤 글 조각만 남긴다(글 전체는 저장하지 않는다)
function flagged(rows, textLabel, replyLabel) {
  const list = [];
  for (const row of rows || []) {
    const hits = [...checkText(row.text, rules).map((h) => ({ ...h, side: textLabel })), ...checkText(row.reply, rules).map((h) => ({ ...h, side: replyLabel }))];
    if (!hits.length) continue;
    list.push({ key: row.key, name: row.nick, sub: hits.slice(0, 3).map((h) => h.side + ' [' + h.word + '] ' + h.snippet).join(' / ').slice(0, 198), tags: [...new Set(hits.map((h) => h.category))], date: row.date });
  }
  return list;
}

const LOGIN = '아테나 로그인이 필요합니다. Aside 브라우저에서 아테나(관리 프로그램)에 로그인한 뒤 "로그인했어"라고 답해 주세요.';
const who = (c) => c.nick && c.nick !== c.name ? `${c.nick} (${c.name})` : c.name || c.nick;
const join = (...parts) => parts.filter(Boolean).join(' · ');

function main() {
  const started = Date.now();
  const got = repl(code(checkOnly), '아테나');
  // 담당자 목록은 현황판의 선택 칸에 쓰도록 남긴다
  {
    const now = readJson(settingsFile, {});
    const next = { ...now };
    if (Array.isArray(got.managers) && got.managers.length) next.managers = got.managers;
    if (manager && !got.error) {
      const old = now.memo && now.memo.manager === manager ? now.memo : {};
      next.memo = { ...old, manager, ...(got.managerIds ? { managerIds: got.managerIds } : {}), ...(got.calleePages ? { calleePages: got.calleePages } : {}), ...(got.incentiveIds ? { incentiveIds: got.incentiveIds } : {}), ...(got.incentivePages ? { incentivePages: got.incentivePages } : {}) };
    } else if (got.error === 'manager') delete next.memo;
    if (JSON.stringify(next) !== JSON.stringify(now)) writeJson(settingsFile, next);
  }
  if (got.error === 'login') fail(LOGIN);
  if (got.error === 'manager') fail(manager ? `아테나 담당자 목록에 "${manager}"이(가) 없습니다${got.where ? `(${got.where})` : ''}. 현황판 화면에서 담당자 이름을 다시 골라 주세요.` : '담당자 이름이 정해지지 않았습니다. 현황판 화면(대시보드 → 현황판)에서 본인 이름을 고르거나 적은 뒤 다시 실행해 주세요.');
  if (got.error === 'columns') fail(`아테나 ${got.where} 화면에서 필요한 열을 찾지 못했습니다. 화면 구성이 바뀌었는지 확인해 주세요.`);
  if (got.error) fail(`아테나를 읽지 못했습니다: ${got.error}`);
  if (checkOnly) { console.log(`아테나 로그인·담당자(${manager}) 확인됨`); return; }

  const items = {
    assign: (got.assign || []).map((c) => ({ key: c.key, name: who(c), sub: join(c.cat, c.stage, c.state), tags: [/\d/.test(c.fin) ? c.fin : '정산정보 미입력'], date: c.reg })),
    partner: (got.partner || []).map((c) => ({ key: c.key, name: who(c), sub: join(c.stage, c.cat), tags: ['검토중'], date: c.date })),
    posting: (got.posting || []).map((c) => ({ key: c.key, name: c.nick, sub: c.title, tags: ['대기'], date: c.date })),
    mentor: (got.mentor || []).map((c) => ({ key: c.key, name: who(c), sub: '멘토 신청', tags: [c.state || '신청'], date: c.date })),
    mentee: (got.mentee || []).map((c) => ({ key: c.key, name: who(c), sub: join(c.role, c.other), tags: ['신청'], date: c.date })),
    qna: flagged(got.qna, '고객 문의', '상담사 답변'),
    review: flagged(got.review, '후기', '상담사 댓글'),
    incentive: (got.incentive || []).map((c) => ({ key: c.key, name: c.who, sub: join(c.cat, c.recommender && c.recommender !== '-' ? `추천인 ${c.recommender}` : ''), tags: [...new Set([c.status, c.recStatus].filter((s) => /지급대기/.test(s)))], date: c.reg })),
  };
  const span = windowStart === windowEnd ? windowEnd : windowStart + ' ~ ' + windowEnd;
  const notes = {
    mentor: '', mentee: '',
    qna: got.qna ? span + ' 내 담당 ' + got.qna.length + '건 점검(전체 ' + got.qnaAll + '건 중)' : '',
    review: got.review ? span + ' 내 담당 ' + got.review.length + '건 점검(전체 ' + got.reviewAll + '건 중)' : '',
    assign: `내 담당 ${got.mine}명 중`,
    partner: '',
    posting: got.postingAll !== undefined ? `전체 대기 ${got.postingAll}건 중` : '',
    incentive: got.incentiveAll !== undefined ? `내 담당 ${got.incentiveAll}건 중(심사 중 ${got.incentiveReview}건)` : '',
  };
  const old = readJson(panelFile, null);
  // 담당자가 바뀌면 지난 목록과 비교하지 않는다
  const base = old && old.version === 1 && old.manager === manager ? old : emptyPanel(manager);
  const at = nowIso(), counts = {}, fresh = {};
  const panel = { ...emptyPanel(manager), updatedAt: at, error: null };
  panel.cards = CARDS.map((def) => {
    const before = (base.cards || []).find((c) => c.id === def.id) || { items: [], checkedAt: '', note: '' };
    const link = athena + def.path;
    if (def.group !== only) return { id: def.id, title: def.title, hint: def.hint, when: def.when, link, checkedAt: before.checkedAt || '', note: before.note || '', items: before.items || [] };
    const seen = new Map((before.items || []).map((i) => [i.key, i]));
    const first = !before.checkedAt;
    const list = items[def.id].map((i) => ({ ...i, firstSeen: seen.get(i.key)?.firstSeen || at, isNew: !first && !seen.has(i.key) }));
    // 규정 점검은 하루씩 넘어가므로, 이번에 읽은 기간보다 앞에 걸렸던 글은 keepDays 동안 남겨 둔다(확인함으로 접을 수 있다)
    if (def.group === 'daily') {
      const have = new Set(list.map((i) => i.key)), cutoff = kstDay(rules.keepDays);
      for (const old of before.items || []) if (!have.has(old.key) && old.date && old.date < windowStart && old.date >= cutoff) list.push({ ...old, isNew: false });
    }
    counts[def.id] = list.length; fresh[def.id] = list.filter((i) => i.isNew).length;
    return { id: def.id, title: def.title, hint: def.hint, when: def.when, link, checkedAt: at, note: [notes[def.id], ...(got.notes || [])].filter(Boolean).join(' · '), items: list };
  });
  writeJson(panelFile, panel);

  const out = opt('out');
  const kst = new Date(Date.parse(at) + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
  if (out) writeJson(out, { ok: true, only, manager, checkedAtKST: kst, counts, new: fresh, notes: got.notes || [], panel: '보관함/현황판/athena.json' });
  for (const def of CARDS.filter((c) => c.group === only)) console.log(`${def.title}: ${counts[def.id]}건${fresh[def.id] ? ` (새로 ${fresh[def.id]}건)` : ''}`);
  for (const note of got.notes || []) console.log(`참고: ${note}`);
  console.log(`담당자 ${manager} · 현황판에 반영함 · 걸린 시간 ${Math.round((Date.now() - started) / 1000)}초`);
}
main();
