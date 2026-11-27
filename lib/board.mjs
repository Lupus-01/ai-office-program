// 현황판: 도구가 작업 공간 보관함/현황판/<이름>.json 으로 올린 "지금 챙길 것" 목록을 화면에 보여 준다.
// 파일만 읽는다(AI 호출·외부 전송 0회). 업무가 늘면 도구가 판(panel) 파일을 하나 더 올리면 된다.
//   판 파일: {version:1, id, title, source?, manager?, updatedAt, error?:{at,message}, cards:[{id, title, hint?, when?, link?, checkedAt?, note?, items:[{key, name, sub?, tags?, date?, firstSeen?, isNew?}]}]}
//   설정.json: {manager, managers?}  — 담당자 이름(이 PC에서 누구의 담당 상담사를 볼지)과 도구가 읽어 둔 담당자 목록
//   확인.json: {"<판>:<카드>:<key>": "확인한 시각"} — 화면에서 "확인함"으로 접어 둔 항목
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { vaultDir } from './vault.mjs';

export const BOARD_DIR = '현황판';
export const boardDir = (root) => join(vaultDir(root), BOARD_DIR);
const RESERVED = new Set(['설정.json', '확인.json']);
const LIMITS = { panels: 30, cards: 20, items: 500, text: 200 };

const readJson = (file, fallback) => { try { return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return fallback; } };
function writeJson(file, data) {
  mkdirSync(join(file, '..'), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 1)}\n`);
  renameSync(tmp, file);
}
const text = (value, max = LIMITS.text) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const link = (value) => /^https:\/\/[^\s"'<>]+$/.test(String(value || '')) ? String(value).slice(0, 500) : '';

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object' || !text(raw.key) || !text(raw.name)) return null;
  return { key: text(raw.key, 120), name: text(raw.name), sub: text(raw.sub), tags: Array.isArray(raw.tags) ? raw.tags.map((t) => text(t, 40)).filter(Boolean).slice(0, 6) : [],
    date: text(raw.date, 30), firstSeen: text(raw.firstSeen, 40), isNew: raw.isNew === true };
}
function normalizeCard(raw) {
  if (!raw || typeof raw !== 'object' || !/^[a-z][a-z0-9-]{0,40}$/.test(String(raw.id || '')) || !text(raw.title)) return null;
  return { id: raw.id, title: text(raw.title, 60), hint: text(raw.hint), when: text(raw.when, 60), link: link(raw.link), checkedAt: text(raw.checkedAt, 40), note: text(raw.note),
    items: (Array.isArray(raw.items) ? raw.items : []).slice(0, LIMITS.items).map(normalizeItem).filter(Boolean) };
}
export function normalizePanel(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 1 || !/^[a-z][a-z0-9-]{0,40}$/.test(String(raw.id || '')) || !text(raw.title)) return null;
  return { id: raw.id, title: text(raw.title, 60), source: text(raw.source, 40), manager: text(raw.manager, 40), updatedAt: text(raw.updatedAt, 40),
    error: raw.error && text(raw.error.message) ? { at: text(raw.error.at, 40), message: text(raw.error.message, 400) } : null,
    cards: (Array.isArray(raw.cards) ? raw.cards : []).slice(0, LIMITS.cards).map(normalizeCard).filter(Boolean) };
}

export function loadBoard(root) {
  const dir = boardDir(root);
  const settings = readJson(join(dir, '설정.json'), {});
  const acks = readJson(join(dir, '확인.json'), {});
  const panels = [], problems = [];
  let names = [];
  try { names = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json') && !RESERVED.has(n)).sort() : []; } catch { names = []; }
  for (const name of names.slice(0, LIMITS.panels)) {
    const panel = normalizePanel(readJson(join(dir, name), null));
    if (panel) panels.push(panel); else problems.push(`${name}: 현황판 형식이 아니어서 건너뜀`);
  }
  // 지금 목록에 있는 항목의 확인 표시만 돌려준다(사라진 항목의 표시는 버린다)
  const live = new Set(panels.flatMap((p) => p.cards.flatMap((c) => c.items.map((i) => `${p.id}:${c.id}:${i.key}`))));
  const acked = {};
  for (const [key, at] of Object.entries(acks && typeof acks === 'object' ? acks : {})) if (live.has(key) && typeof at === 'string') acked[key] = at;
  return { manager: text(settings.manager, 40), managers: Array.isArray(settings.managers) ? settings.managers.map((m) => text(m, 40)).filter(Boolean).slice(0, 200) : [], panels, acks: acked, problems };
}

export function setBoardManager(root, name) {
  const manager = text(name, 40);
  if (!manager || /[\\/:*?"<>|\n]/.test(manager)) { const e = new Error('담당자 이름을 1~40자로 적어 주세요.'); e.status = 400; throw e; }
  const file = join(boardDir(root), '설정.json');
  writeJson(file, { ...readJson(file, {}), manager });
  return { manager };
}

export function setBoardAck(root, key, on) {
  if (typeof key !== 'string' || !/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*:.{1,120}$/.test(key)) { const e = new Error('확인할 항목을 찾지 못했습니다.'); e.status = 400; throw e; }
  const board = loadBoard(root);
  const file = join(boardDir(root), '확인.json');
  const acks = { ...board.acks };
  if (on === false) delete acks[key]; else acks[key] = new Date().toISOString();
  writeJson(file, acks);
  return { acks };
}
