// 이미 모은 원본 정리: 다시 수집하지 않고, 저장된 구역 원문에서 고칠 수 있는 값을 고친다(2026-11-20).
//   - 자주 묻는 질문 답변의 화면 코드 제거, 화면 조각 구역 제거(용량 절반 이상 줄어듦)
//   - 최근 3개월 후기 수·만족도(예전 값은 다른 숫자를 읽어 틀렸다), 채팅 프로필 가격, 등급, 약력·리딩정보, 후기 종류별 수
//   - 지금 들어 있는 최근 7일 후기를 원본/후기/ 에 옮겨 쌓기 시작, 이번 회차 추이 기록
// 탭 수(판매상품·후기·문의·포스팅)·주 상담시간·누적 통계는 화면을 다시 읽어야 하므로 다음 수집 때 채워진다.
// 사용: node tidy.cjs [--dry]   여러 번 실행해도 결과가 같다
'use strict';
const { fs, path, RAW, STATE, TREND_DIR, readJson, writeAtomic, htmlText, cleanSections, deriveProfile, archiveReviews, writeSnapshot } = require('./lib.cjs');

const DRY = process.argv.includes('--dry');
let before = 0; let after = 0; let n = 0; let seeded = 0; let fixed3 = 0;
for (const f of fs.readdirSync(RAW)) {
  if (!f.endsWith('.json')) continue;
  const file = path.join(RAW, f);
  const text = fs.readFileSync(file, 'utf8');
  const p = readJson(file, null);
  if (!p || !p.code) continue;
  before += text.length;
  // 구역이 아직 정리되지 않은 파일만 구역 원문에서 다시 뽑는다(정리 뒤에는 근거 구역이 없어 값을 지우게 된다)
  if (!p.tidiedAt && p.sections) {
    const d = deriveProfile(p, p.sections);
    if ((p.recent3m?.reviews ?? null) !== (d.recent3m?.reviews ?? null)) fixed3++;
    Object.assign(p, d, { satisfaction: d.satisfaction ?? p.satisfaction ?? null });
    p.sections = cleanSections(p.sections);
  }
  p.faq = (p.faq || []).map((q) => ({ q: htmlText(q.q), a: /<[a-z][\s\S]*>/i.test(q.a) ? htmlText(q.a).slice(0, 1500) : String(q.a).slice(0, 1500) }));
  if (!DRY) {
    const kept = archiveReviews(p.code, p.reviews7d || []);
    seeded += kept.added;
    p.reviewsKept = kept.total;
  }
  p.tidiedAt = p.tidiedAt || new Date().toISOString();
  const out = `${JSON.stringify(p, null, 1)}\n`;
  after += out.length;
  if (!DRY && out !== text) writeAtomic(file, out);
  n++;
}
console.log(`${DRY ? '[미리 보기] ' : ''}프로필 ${n}개 정리 · 원본 ${(before / 1e6).toFixed(1)}M → ${(after / 1e6).toFixed(1)}M 글자 · 최근 3개월 값 바뀜 ${fixed3}개 · 쌓기 시작한 후기 ${seeded}건`);
if (!DRY) {
  const run = readJson(STATE, null);
  if (run?.runId && run.finishedAt && !fs.existsSync(path.join(TREND_DIR, `${run.runId}.json`))) {
    const snap = writeSnapshot(run.runId);
    console.log(`주간 추이 기록: ${snap.file} (프로필 ${snap.rows}개)`);
  }
}
