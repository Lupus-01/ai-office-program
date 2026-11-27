#!/usr/bin/env node
// 광고 선정 초안 교차 검증: 초안이 광고 규칙을 지켰는지 계산 도구(ad-lib.cjs)의 판정 함수를 쓰지 않고 따로 다시 따진다.
// 수집 자료(정산·이력)와 초안 JSON만 읽는다(AI 없음, 쓰는 것은 검증 결과 파일뿐).
//
//   node 보관함/광고운영/도구/ad-verify.cjs --in <수집 폴더> [--prefix <앞가지>] --draft <광고선정초안.json> [--out <검증.json>]
//
// 보는 것: ①정원 ②같은 주 중복 ③같은 광고 중복 ④자격(그룹·서비스·분야·파트너·메인 단계/시간·제외 분야) ⑤재노출 주기
//          ⑥예외설정(제외·연기) ⑦빈 자리가 있는데 들어갈 수 있었던 사람 ⑧뽑힌 사람보다 우선순위가 높은데 빠진 사람
// 문제가 하나라도 있으면 종료 코드 1.
'use strict';
const fs = require('fs');
const path = require('path');
// 글자 다듬기(공백·"전화상담"→"전화"·날짜 꼴)만 계산 도구와 같은 함수를 쓴다. 자격·주기·순위 판정은 아래에서 따로 한다
const { clean, normGroup, normChannel, normBanner, toDay, formatDay, mondayOf, asBoolean } = require('./ad-lib.cjs');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const fail = (message) => { console.error(message); process.exit(2); };
const read = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { fail(`파일을 읽지 못했습니다(${file}): ${e.message}`); } };
const listOf = (file, key) => { if (!fs.existsSync(file)) return []; const d = read(file); return Array.isArray(d) ? d : Array.isArray(d?.[key]) ? d[key] : []; };
if (!opt('in') || !opt('draft')) fail('--in <수집 폴더> 와 --draft <광고선정초안.json> 이 필요합니다.');

const settlement = read(path.join(opt('in'), `${opt('prefix')}정산.json`));
const collected = read(path.join(opt('in'), `${opt('prefix')}이력.json`));
const draft = read(opt('draft'));
const vault = opt('vault') || path.join(__dirname, '..');
const tidy = (e) => ({ ...e, nickname: clean(e.nickname), type: clean(e.type), group: e.group ? normGroup(e.group) : '', channel: e.channel ? normChannel(e.channel) : '', banner: e.banner ? normBanner(e.banner) : '' });
const exceptions = listOf(path.join(vault, '예외.json'), 'exceptions').filter((e) => e.enabled === undefined || asBoolean(e.enabled)).map((e) => ({ ...tidy(e), start: formatDay(toDay(e.start)), end: formatDay(toDay(e.end)) }));
const wishList = listOf(path.join(vault, '희망.json'), 'wishes').map((w) => ({ ...tidy(w), registeredAt: formatDay(toDay(w.registeredAt)) }));
const carryList = listOf(path.join(vault, '이월.json'), 'carryovers').map((c) => ({ ...tidy(c), start: formatDay(mondayOf(c.start)) }));
const policy = draft.policy;

// 날짜: 'YYYY-MM-DD' → 날 수(정수). 주 차이는 7로 나눈다
const dayNo = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const weeksApart = (older, newer) => Math.floor((dayNo(newer) - dayNo(older)) / 7);
const keyOf = (r) => `${r.group}|${r.channel}|${r.banner}`;
const rules = policy.rules.filter((r) => r.enabled === undefined || asBoolean(r.enabled)).slice().sort((a, b) => a.order - b.order);
const ruleOf = Object.fromEntries(rules.map((r) => [keyOf(r), r]));

const people = {};
for (const c of settlement.counselors) (people[c.nickname] ||= []).push(c);
const picked = draft.rows.filter((r) => r.result === '선정');
const isPre = (r) => String(r.description).startsWith('미리 정해짐');
const confirmed = (collected.history || []).filter((h) => h.status === '확정' || h.status === '완료' || (h.status === '예정' && h.start < draft.weeks[0]));
// 미리 정해진 자리의 근거: 시트의 "예정" 칸이나 운영자의 '지정'
const preSource = new Set([
  ...(collected.history || []).filter((h) => h.status === '예정').map((h) => `${h.start}|${h.nickname}|${h.group}|${h.channel}|${h.banner}`),
  ...exceptions.filter((e) => e.type === '지정').flatMap((e) => draft.weeks.filter((w) => { const from = formatDay(mondayOf(e.start)), until = e.end ? formatDay(mondayOf(e.end)) : from; return w >= from && w <= until; }).map((w) => `${w}|${e.nickname}|${e.channel}|${e.banner}`)),
]);

const wishOf = {};
for (const w of wishList) {
  if ((w.status || '대기') !== '대기' || !w.nickname) continue;
  const group = w.group || ((people[w.nickname] || []).length === 1 ? people[w.nickname][0].group : '');
  const k = `${w.nickname}|${group}|${w.channel}|${w.banner}`;
  if (!wishOf[k] || String(w.registeredAt) < String(wishOf[k].registeredAt)) wishOf[k] = w;
}
const carryOf = {};
for (const c of carryList) if ((c.status || '대기') === '대기') carryOf[`${c.nickname}|${c.group}|${c.channel}|${c.banner}`] = c;

// 그 주 이전의 마지막 같은 광고(확정 이력 + 초안의 앞선 주)
function lastBefore(nickname, rule, week) {
  let last = '';
  for (const h of confirmed) if (h.nickname === nickname && keyOf(h) === keyOf(rule) && h.start < week && h.start > last) last = h.start;
  for (const r of picked) if (r.nickname === nickname && keyOf(r) === keyOf(rule) && r.week < week && r.week > last) last = r.week;
  return last;
}
function exceptionFor(nickname, rule, week, types) {
  return exceptions.find((e) => e.nickname === nickname && types.includes(e.type) && (!e.start || new Date(Date.UTC(...week.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))) + 6 * 86400000).toISOString().slice(0, 10) >= e.start) && (!e.end || week <= e.end)
    && (!e.group || e.group === rule.group) && (!e.channel || e.channel === rule.channel) && (!e.banner || e.banner === rule.banner)) || null;
}
// 자격 미달 사유(없으면 '')
function ineligible(nickname, rule, week) {
  const list = people[nickname] || [];
  if (list.length === 0) return '정산 자료에 없는 닉네임';
  if (list.length > 1) return '정산 자료에 닉네임 중복';
  const c = list[0];
  if (c.group !== rule.group) return `그룹 불일치(${c.group})`;
  const bad = policy.excludeCategoryWords.find((w) => c.category.includes(w));
  if (bad) return `${bad} 카테고리`;
  if (!c.service.includes(policy.serviceTokens[rule.channel])) return `${rule.channel}상담 미제공`;
  if (rule.banner !== '메인' && !c.category.includes(rule.banner)) return `분야 불일치(${c.category})`;
  const partner = c.stage >= policy.partnerStages[0] && c.stage <= policy.partnerStages[1];
  if (rule.partner === '파트너' && !partner) return `파트너 전용인데 ${c.stage}단계`;
  if (rule.banner === '메인' && c.stage < Number(rule.mainStage || 0) && c.seconds < Number(rule.mainSeconds || 0)) return `${rule.mainStage}단계 미만이고 상담시간 ${Math.floor(c.seconds / 3600)}시간`;
  if (policy.oncePerBatch && picked.some((r) => r.nickname === nickname && keyOf(r) === keyOf(rule) && r.week < week)) return '이 초안에서 이미 배정됨(한 번만 배정 규칙)';
  const ex = exceptionFor(nickname, rule, week, ['제외', '연기']);
  if (ex) return `예외설정 ${ex.type}`;
  const own = exceptionFor(nickname, rule, week, ['주기']);
  const minWeeks = own && own.weeks !== undefined && own.weeks !== '' ? Number(own.weeks) : Number(rule.minWeeks || 0);
  const next = picked.filter((r) => isPre(r) && r.nickname === nickname && keyOf(r) === keyOf(rule) && r.week > week).map((r) => r.week).sort()[0];
  if (next && weeksApart(week, next) < minWeeks) return `주기 미충족(${next} 주에 미리 정해진 자리, ${weeksApart(week, next)}주 전)`;
  const last = lastBefore(nickname, rule, week);
  if (last && weeksApart(last, week) < minWeeks) return `주기 미충족(${last} 뒤 ${weeksApart(last, week)}주, 최소 ${minWeeks}주)`;
  return '';
}
// 우선순위(작을수록 먼저): 정렬 순서대로 숫자 배열을 만든다
function rank(nickname, rule, week) {
  const c = people[nickname][0];
  const last = lastBefore(nickname, rule, week);
  const elapsed = last ? weeksApart(last, week) : 9999;
  const k = `${nickname}|${rule.group}|${rule.channel}|${rule.banner}`;
  const ex = exceptionFor(nickname, rule, week, ['고정']);
  const usedEarlier = picked.some((r) => r.nickname === nickname && keyOf(r) === keyOf(rule) && r.week < week);
  const carry = usedEarlier ? null : carryOf[k], wish = usedEarlier ? null : wishOf[k];
  const stagePriority = rule.banner === '메인' && c.stage >= Number(rule.mainStage || 0);
  const part = {
    fixed: [ex ? 0 : 1],
    carry: [carry ? 0 : 1, carry && carry.start ? -Math.max(0, weeksApart(String(carry.start).slice(0, 10), week)) : 0],
    wish: [wish ? 0 : 1, wish && wish.registeredAt ? dayNo(wish.registeredAt) : Number.MAX_SAFE_INTEGER],
    longWait: [Number(rule.priorityWeeks) > 0 && elapsed >= Number(rule.priorityWeeks) ? 0 : 1],
    mainStage: [rule.banner === '메인' && stagePriority ? 0 : 1, stagePriority ? -c.stage : 0],
    elapsed: [-elapsed],
  };
  return policy.sortOrder.flatMap((name) => part[name]);
}
const before = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };

const issues = [];
const add = (check, text) => issues.push({ check, text });
const counts = { rows: picked.length, preassigned: picked.filter(isPre).length, slots: 0, eligibilityChecked: 0, completenessChecked: 0, priorityChecked: 0 };

// ①②③
const perSlot = {}, perPersonWeek = {};
for (const r of picked) {
  (perSlot[`${r.week}|${keyOf(r)}`] ||= []).push(r);
  (perPersonWeek[`${r.week}|${r.nickname}`] ||= []).push(r);
  if (!ruleOf[keyOf(r)]) add('규칙에 없는 배너', `${r.week} ${keyOf(r)} ${r.nickname}`);
  if (new Date(`${r.week}T00:00:00Z`).getUTCDay() !== 1) add('월요일이 아닌 주차', `${r.week} ${r.nickname}`);
  if (!draft.weeks.includes(r.week)) add('범위 밖 주차', `${r.week} ${r.nickname}`);
}
for (const [slot, list] of Object.entries(perSlot)) {
  const rule = ruleOf[slot.slice(11)];
  if (rule && list.length > rule.capacity) add('①정원 초과', `${slot}: ${list.length}/${rule.capacity}`);
  const names = list.map((r) => r.nickname);
  for (const n of new Set(names)) if (names.filter((x) => x === n).length > 1) add('③같은 광고 중복', `${slot}: ${n}`);
}
for (const [who, list] of Object.entries(perPersonWeek)) {
  if (list.length < 2) continue;
  const banners = [...new Set(list.map((r) => r.banner))];
  const channels = list.map((r) => r.channel);
  const ok = banners.length === 1 && policy.sameWeekTogether.includes(banners[0]) && new Set(channels).size === channels.length;
  if (!ok) add('②같은 주 중복', `${who}: ${list.map((r) => `${r.channel} ${r.banner}`).join(' + ')}`);
}
// ④⑤⑥
for (const r of picked) {
  const rule = ruleOf[keyOf(r)];
  if (rule && isPre(r) && !preSource.has(`${r.week}|${r.nickname}|${r.group}|${r.channel}|${r.banner}`) && !preSource.has(`${r.week}|${r.nickname}|${r.channel}|${r.banner}`)) add('⑨근거 없는 미리 정해진 자리', `${r.week} ${keyOf(r)} ${r.nickname}: 시트의 예정 칸에도 조정(넣기)에도 없습니다`);
  if (!rule || isPre(r)) continue;
  counts.eligibilityChecked++;
  const why = ineligible(r.nickname, rule, r.week);
  if (why) add(/주기/.test(why) ? '⑤주기 위반' : /예외/.test(why) ? '⑥예외설정 위반' : '④자격 미달', `${r.week} ${keyOf(r)} ${r.nickname}: ${why}`);
}
// ⑦⑧: 그 주 그 배너 차례에 아직 다른 배너를 받지 않았던 유자격자
for (const week of draft.weeks) {
  const takenBefore = {};
  for (const r of picked.filter((x) => x.week === week && isPre(x))) (takenBefore[r.nickname] ||= []).push(r.banner);
  for (const rule of rules) {
    counts.slots++;
    const chosen = picked.filter((r) => r.week === week && keyOf(r) === keyOf(rule));
    const chosenNames = new Set(chosen.map((r) => r.nickname));
    const free = (name) => { const prior = (takenBefore[name] || []); return !prior.length || (policy.sameWeekTogether.includes(rule.banner) && prior.every((b) => b === rule.banner)); };
    const left = settlement.counselors.filter((c) => c.group === rule.group && !chosenNames.has(c.nickname) && free(c.nickname) && !ineligible(c.nickname, rule, week)).map((c) => c.nickname);
    if (chosen.length < rule.capacity) {
      counts.completenessChecked++;
      if (left.length) add('⑦빈 자리인데 빠진 사람', `${week} ${keyOf(rule)}: ${chosen.length}/${rule.capacity}, 들어갈 수 있었던 사람 ${left.length}명(${left.slice(0, 5).join(', ')})`);
    } else {
      const auto = chosen.filter((r) => !isPre(r));
      if (auto.length && left.length) {
        counts.priorityChecked++;
        const worst = auto.map((r) => rank(r.nickname, rule, week)).reduce((a, b) => (before(a, b) ? b : a));
        const jumped = left.filter((n) => before(rank(n, rule, week), worst));
        if (jumped.length) add('⑧우선순위가 높은데 빠진 사람', `${week} ${keyOf(rule)}: ${jumped.length}명(${jumped.slice(0, 5).join(', ')})`);
      }
    }
    for (const r of chosen) if (!isPre(r)) (takenBefore[r.nickname] ||= []).push(rule.banner);
  }
}

const byCheck = {};
for (const i of issues) byCheck[i.check] = (byCheck[i.check] || 0) + 1;
const result = { draftId: draft.draftId, version: draft.version, verifiedAt: new Date().toISOString(), ok: issues.length === 0, counts, byCheck, issues };
if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify(result, null, 1));
console.log(`교차 검증 ${draft.draftId} v${draft.version}: 선정 ${counts.rows}행(미리 정해진 자리 ${counts.preassigned}), 배너·주 ${counts.slots}칸`);
console.log(`자격·주기 확인 ${counts.eligibilityChecked}행 · 빈 자리 확인 ${counts.completenessChecked}칸 · 우선순위 확인 ${counts.priorityChecked}칸`);
if (!issues.length) console.log('규칙 위반 0건');
else { console.log(`규칙 위반 ${issues.length}건: ${Object.entries(byCheck).map(([k, n]) => `${k} ${n}`).join(', ')}`); for (const i of issues.slice(0, 30)) console.log(`  [${i.check}] ${i.text}`); }
process.exit(issues.length ? 1 : 0);
