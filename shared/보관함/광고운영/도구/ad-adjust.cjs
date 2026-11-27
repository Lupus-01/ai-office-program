#!/usr/bin/env node
// 광고 선정 조정: 사람을 넣고 빼거나, 먼저 뽑히게 하거나, 특정 사람만 주기를 다르게 한다. JSON을 손으로 고치지 않아도 된다.
// 조정은 보관함/광고운영/예외.json(넣기·빼기·우선·주기)과 희망.json(희망)에 쌓이고, 다음 초안 계산부터 반영된다. 시트에는 쓰지 않는다.
//
//   node 보관함/광고운영/도구/ad-adjust.cjs 목록
//   node 보관함/광고운영/도구/ad-adjust.cjs 넣기 --name <닉네임> --channel 전화|채팅 --banner 메인|타로|사주|신점 --week 2026-12-07 [--until 2026-12-28] [--reason <사유>]
//        그 주(들)의 그 배너 자리에 바로 넣는다. 자격·주기에 안 맞아도 넣고 초안의 확인 필요에 적는다.
//   node 보관함/광고운영/도구/ad-adjust.cjs 빼기 --name <닉네임> [--channel …] [--banner …] [--from 2026-12-07] [--until 2026-12-28] [--reason <사유>]
//        그 기간 동안 후보에서 뺀다(채널·배너를 안 적으면 모든 배너, 기간을 안 적으면 계속).
//   node 보관함/광고운영/도구/ad-adjust.cjs 우선 --name <닉네임> [--channel …] [--banner …] [--from …] [--until …]
//        자격·주기는 그대로 지키되 같은 배너 후보 중 맨 앞에 선다.
//   node 보관함/광고운영/도구/ad-adjust.cjs 주기 --name <닉네임> --weeks <주 수> [--channel …] [--banner …] [--from …] [--until …]
//        이 사람만 재노출 최소 주기를 <주 수>로 한다(0이면 매주 가능). 정원·같은 주 중복 규칙은 그대로다.
//   node 보관함/광고운영/도구/ad-adjust.cjs 희망 --name <닉네임> --channel … --banner …
//   node 보관함/광고운영/도구/ad-adjust.cjs 취소 --id <번호>          목록에 나온 번호(EX-…, WISH-…)의 조정을 없앤다
'use strict';
const fs = require('fs');
const path = require('path');
const ad = require('./ad-lib.cjs');

const [command, ...args] = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? String(args[i + 1] ?? '') : ''; };
const fail = (message) => { console.error(message); process.exit(1); };
const vault = opt('vault') || path.join(__dirname, '..');
const files = { ex: path.join(vault, '예외.json'), wish: path.join(vault, '희망.json') };
const load = (file) => { if (!fs.existsSync(file)) return []; try { const d = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); return Array.isArray(d) ? d : (d.exceptions || d.wishes || []); } catch (e) { fail(`${path.basename(file)}을 읽지 못했습니다(JSON 형식 확인): ${e.message}`); } };
const save = (file, list) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(list, null, 1)}\n`); };
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const nextId = (list, prefix) => `${prefix}-${String(Math.max(0, ...list.map((x) => Number(String(x.id || '').split('-')[1]) || 0)) + 1).padStart(3, '0')}`;
const day = (value, label) => { if (!value) return ''; const d = ad.formatDay(ad.toDay(value)); if (!d) fail(`${label} 날짜를 읽지 못했습니다(${value}). YYYY-MM-DD로 적어 주세요.`); return d; };
const one = (value, allowed, label, required) => {
  if (!value) { if (required) fail(`--${label} 이 필요합니다(${allowed.join('|')}).`); return ''; }
  const norm = label === 'channel' ? ad.normChannel(value) : ad.normBanner(value);
  if (!allowed.includes(norm)) fail(`--${label} 는 ${allowed.join('|')} 중 하나입니다(${value}).`);
  return norm;
};
const describe = (e) => {
  const where = [e.channel, e.banner].filter(Boolean).join(' ') || '모든 배너';
  const when = e.type === '지정' ? `${e.start}${e.end && e.end !== e.start ? ` ~ ${e.end}` : ''} 주` : e.start || e.end ? `${e.start || '처음'} ~ ${e.end || '계속'}` : '기간 없음(계속)';
  const what = { 지정: '넣기', 제외: '빼기', 연기: '빼기(연기)', 고정: '우선', 주기: `주기 ${e.weeks}주` }[e.type] || e.type;
  return `${e.id}  ${what}  ${e.nickname}  ${where}  ${when}${e.reason ? `  (${e.reason})` : ''}${e.enabled === false ? '  [꺼짐]' : ''}`;
};

const exceptions = load(files.ex), wishes = load(files.wish);
if (!command || command === '목록') {
  console.log(exceptions.length ? `조정 ${exceptions.length}건` : '조정 없음');
  for (const e of exceptions) console.log(`  ${describe(e)}`);
  const waiting = wishes.filter((w) => (w.status || '대기') === '대기');
  console.log(waiting.length ? `광고 희망(대기) ${waiting.length}건` : '광고 희망 없음');
  for (const w of waiting) console.log(`  ${w.id}  희망  ${w.nickname}  ${w.channel} ${w.banner}  등록 ${w.registeredAt}`);
  process.exit(0);
}
if (command === '취소') {
  const id = opt('id').toUpperCase();
  if (!id) fail('--id <번호> 가 필요합니다. 번호는 "목록"으로 확인합니다.');
  const ex = exceptions.find((e) => String(e.id).toUpperCase() === id), wish = wishes.find((w) => String(w.id).toUpperCase() === id);
  if (ex) { save(files.ex, exceptions.filter((e) => e !== ex)); console.log(`없앴습니다: ${describe(ex)}`); }
  else if (wish) { save(files.wish, wishes.filter((w) => w !== wish)); console.log(`없앴습니다: ${wish.id} 희망 ${wish.nickname} ${wish.channel} ${wish.banner}`); }
  else fail(`${id} 번 조정이 없습니다. "목록"으로 번호를 확인해 주세요.`);
  process.exit(0);
}
const nickname = ad.clean(opt('name'));
if (!nickname) fail('--name <닉네임> 이 필요합니다.');
const TYPES = { 넣기: '지정', 빼기: '제외', 우선: '고정', 주기: '주기' };
if (command === '희망') {
  const channel = one(opt('channel'), ad.CHANNELS, 'channel', true), banner = one(opt('banner'), ad.BANNERS, 'banner', true);
  if (wishes.some((w) => (w.status || '대기') === '대기' && w.nickname === nickname && w.channel === channel && w.banner === banner)) fail(`이미 대기 중인 희망입니다: ${nickname} ${channel} ${banner}`);
  const item = { id: nextId(wishes, 'WISH'), registeredAt: today, nickname, channel, banner, status: '대기' };
  save(files.wish, [...wishes, item]);
  console.log(`등록했습니다: ${item.id} 희망 ${nickname} ${channel} ${banner} (등록 ${today})`);
  process.exit(0);
}
if (!TYPES[command]) fail(`모르는 명령입니다(${command}). 목록 | 넣기 | 빼기 | 우선 | 주기 | 희망 | 취소 중 하나입니다.`);
const type = TYPES[command];
const item = { id: nextId(exceptions, 'EX'), enabled: true, type, nickname, channel: one(opt('channel'), ad.CHANNELS, 'channel', type === '지정'), banner: one(opt('banner'), ad.BANNERS, 'banner', type === '지정'), start: '', end: '', reason: ad.clean(opt('reason')), addedAt: today };
if (type === '지정') {
  if (!opt('week')) fail('--week <그 주의 날짜> 가 필요합니다(예: 2026-12-07).');
  item.start = ad.formatDay(ad.mondayOf(day(opt('week'), '--week')));
  item.end = opt('until') ? ad.formatDay(ad.mondayOf(day(opt('until'), '--until'))) : item.start;
  if (item.end < item.start) fail('--until 이 --week 보다 앞섭니다.');
} else {
  item.start = day(opt('from'), '--from'); item.end = day(opt('until'), '--until');
  if (item.start && item.end && item.end < item.start) fail('--until 이 --from 보다 앞섭니다.');
}
if (type === '주기') {
  const weeks = Number(opt('weeks'));
  if (opt('weeks') === '' || !Number.isInteger(weeks) || weeks < 0 || weeks > 52) fail('--weeks <주 수> 가 필요합니다(0~52의 정수. 0이면 매주 가능).');
  item.weeks = weeks;
}
const same = exceptions.find((e) => e.type === type && e.nickname === nickname && (e.channel || '') === item.channel && (e.banner || '') === item.banner && (e.start || '') === item.start && (e.end || '') === item.end);
if (same) fail(`같은 조정이 이미 있습니다: ${describe(same)}`);
save(files.ex, [...exceptions, item]);
console.log(`등록했습니다: ${describe(item)}`);
console.log('다음 초안 계산부터 반영됩니다. 이미 만든 초안에는 반영되지 않으니 초안을 다시 만들어 주세요.');
