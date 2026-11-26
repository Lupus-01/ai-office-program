// 한글 문서 글자 읽기: .hwp(한글 5.x)와 .hwpx의 문단 글자를 문서 순서대로 돌려준다(외부 프로그램·라이브러리 없이 읽는다)
// 사용: const { hwpLines } = require('./hwp-text.cjs'); const lines = await hwpLines(file);
// 표의 칸이 바뀌는 곳은 빈 줄로 나눈다. 암호가 걸린 문서·배포용 문서는 읽지 못하고 사유를 알린다.
'use strict';
const fs = require('fs');
const zlib = require('zlib');

const END = 0xFFFFFFFE, FREE = 0xFFFFFFFF;

// 복합 파일(OLE) 안의 스트림을 이름 경로로 꺼낸다
function openCompound(buf) {
  if (buf.length < 512 || buf.readUInt32LE(0) !== 0xE011CFD0 || buf.readUInt32LE(4) !== 0xE11AB1A1) throw new Error('한글(.hwp) 파일 형식이 아닙니다.');
  const sectorSize = 1 << buf.readUInt16LE(30), miniSize = 1 << buf.readUInt16LE(32);
  const miniCutoff = buf.readUInt32LE(56);
  const sector = (n) => buf.subarray(512 + n * sectorSize, 512 + (n + 1) * sectorSize);
  // 할당표 위치 목록: 머리말의 109칸 + 이어지는 목록 섹터
  const fatSectors = [];
  for (let i = 0; i < 109; i++) { const v = buf.readUInt32LE(76 + i * 4); if (v < END) fatSectors.push(v); }
  let difat = buf.readUInt32LE(68);
  for (let guard = 0; difat < END && guard < 10000; guard++) {
    const s = sector(difat);
    for (let i = 0; i < sectorSize / 4 - 1; i++) { const v = s.readUInt32LE(i * 4); if (v < END) fatSectors.push(v); }
    difat = s.readUInt32LE(sectorSize - 4);
  }
  const fat = [];
  for (const n of fatSectors) { const s = sector(n); for (let i = 0; i + 4 <= s.length; i += 4) fat.push(s.readUInt32LE(i)); }
  const chain = (start, table, read) => {
    const parts = [];
    for (let n = start, guard = 0; n < END && n !== FREE && guard < 1e6; n = table[n], guard++) { parts.push(read(n)); if (table[n] === undefined) break; }
    return Buffer.concat(parts);
  };
  const dirBuf = chain(buf.readUInt32LE(48), fat, sector);
  const entries = [];
  for (let off = 0; off + 128 <= dirBuf.length; off += 128) {
    const nameLen = dirBuf.readUInt16LE(off + 64);
    entries.push({ name: nameLen >= 2 ? dirBuf.toString('utf16le', off, off + nameLen - 2) : '', type: dirBuf[off + 66],
      left: dirBuf.readUInt32LE(off + 68), right: dirBuf.readUInt32LE(off + 72), child: dirBuf.readUInt32LE(off + 76),
      start: dirBuf.readUInt32LE(off + 116), size: dirBuf.readUInt32LE(off + 120) });
  }
  const root = entries[0];
  if (!root) throw new Error('한글(.hwp) 파일의 목록을 읽지 못했습니다.');
  const miniFat = [];
  { const b = chain(buf.readUInt32LE(60), fat, sector); for (let i = 0; i + 4 <= b.length; i += 4) miniFat.push(b.readUInt32LE(i)); }
  let miniStream = null;
  const read = (entry) => {
    if (entry.size >= miniCutoff) return chain(entry.start, fat, sector).subarray(0, entry.size);
    miniStream ||= chain(root.start, fat, sector);
    return chain(entry.start, miniFat, (n) => miniStream.subarray(n * miniSize, (n + 1) * miniSize)).subarray(0, entry.size);
  };
  // 한 폴더의 자식들(형제는 이진 트리로 이어져 있다)
  const children = (entry) => {
    const out = [];
    const walk = (i, depth) => { if (i >= entries.length || i === FREE || depth > 4096) return; const e = entries[i]; walk(e.left, depth + 1); out.push(e); walk(e.right, depth + 1); };
    walk(entry.child, 0);
    return out;
  };
  const find = (names) => { let cur = root; for (const name of names) { cur = children(cur).find((e) => e.name === name); if (!cur) return null; } return cur; };
  return { find, children, read };
}

// 본문 스트림 하나에서 문단 글자를 뽑는다. 글자 조각(tag 67)만 읽고, 표 칸의 시작(tag 72)은 빈 줄로 남긴다
function sectionLines(data) {
  const lines = [];
  for (let off = 0; off + 4 <= data.length;) {
    const head = data.readUInt32LE(off); off += 4;
    const tag = head & 0x3FF;
    let size = head >>> 20;
    if (size === 0xFFF) { size = data.readUInt32LE(off); off += 4; }
    if (tag === 72) lines.push('');
    if (tag === 67) {
      let text = '';
      const end = Math.min(off + size, data.length);
      for (let p = off; p + 2 <= end;) {
        const code = data.readUInt16LE(p);
        if (code >= 32) { text += String.fromCharCode(code); p += 2; continue; }
        if (code === 10) text += '\n';
        if (code === 9) text += ' ';
        // 글자 하나짜리 제어 문자(0·10·13·24~31) 말고는 여덟 칸을 차지한다
        p += (code === 0 || code === 10 || code === 13 || code >= 24) ? 2 : 16;
      }
      for (const line of text.split('\n')) lines.push(line.replace(/\s+$/, ''));
    }
    off += size;
  }
  return lines;
}

function hwp5Lines(buf) {
  const doc = openCompound(buf);
  const header = doc.find(['FileHeader']);
  if (!header) throw new Error('한글(.hwp) 파일 머리말이 없습니다. 한글에서 다시 저장해 주세요.');
  const flags = doc.read(header).readUInt32LE(36);
  if (flags & 2) throw new Error('암호가 걸린 한글 문서는 읽지 못합니다. 암호를 풀어 다시 저장해 달라고 하세요.');
  if (flags & 4) throw new Error('배포용 한글 문서는 읽지 못합니다. 일반 문서(.hwp)나 워드(.docx)로 저장해 달라고 하세요.');
  const body = doc.find(['BodyText']);
  if (!body) throw new Error('한글(.hwp) 파일에 본문이 없습니다.');
  const sections = doc.children(body).filter((e) => /^Section\d+$/.test(e.name)).sort((a, b) => Number(a.name.slice(7)) - Number(b.name.slice(7)));
  const lines = [];
  for (const entry of sections) {
    const raw = doc.read(entry);
    lines.push(...sectionLines(flags & 1 ? zlib.inflateRawSync(raw) : raw));
  }
  return lines;
}

// .hwpx는 zip 안의 Contents/section*.xml에 문단(<hp:p>)과 글자(<hp:t>)가 있다
async function hwpxLines(file) {
  const { loadZip, all } = require('./profile-lib.cjs');
  const zip = await loadZip(file);
  const names = Object.keys(zip.files).filter((n) => /^Contents\/section\d+\.xml$/i.test(n)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (!names.length) throw new Error('한글(.hwpx) 파일에 본문이 없습니다.');
  const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const lines = [];
  for (const name of names) {
    const xml = await zip.file(name).async('string');
    // 표 칸이 시작되는 곳은 빈 줄, 문단이 끝나는 곳에서 한 줄
    let line = '', has = false;
    for (const token of all(xml, /<hp:tc[ >]|<hp:t(?: [^>]*)?>[\s\S]*?<\/hp:t>|<hp:lineBreak\s*\/>|<\/hp:p>/g)) {
      if (token.startsWith('<hp:tc')) lines.push('');
      else if (token.startsWith('<hp:lineBreak')) { lines.push(line.replace(/\s+$/, '')); line = ''; has = false; }
      else if (token === '</hp:p>') { if (has || line) lines.push(line.replace(/\s+$/, '')); line = ''; has = false; }
      else { line += unescape(token.replace(/<[^>]+>/g, '')); has = true; }
    }
  }
  return lines;
}

// 이어진 빈 줄은 하나로, 앞뒤 빈 줄은 없앤다
function tidy(lines) {
  const out = [];
  for (const line of lines) { if (line.trim() || (out.length && out[out.length - 1].trim())) out.push(line); }
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}

async function hwpLines(file) {
  if (/\.hwpx$/i.test(file)) return tidy(await hwpxLines(file));
  return tidy(hwp5Lines(fs.readFileSync(file)));
}

module.exports = { hwpLines };
