#!/usr/bin/env node
/**
 * 블로그 품질 검증기 — 네이버 저품질 트리거 사전 검사.
 * Usage: node scripts/quality-check.js --file post.html [--keyword "병원 마케팅"]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const stripHtml = (s) =>
  s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

const BANNED = ['최고', '최저', '최상', '무조건', '100%', '절대', '완벽'];
const CONJUNCTIONS = ['또한', '그리고', '더불어', '아울러'];
const CONJ_RE = new RegExp(CONJUNCTIONS.join('|'), 'g');

const ANGLE_STOPWORDS = new Set([
  '그리고', '하지만', '그러나', '이번', '다음', '정말', '아주', '매우',
  '있습니다', '합니다', '됩니다', '입니다', '있는', '하는', '되는',
  '통해', '위해', '대한', '관련', '경우', '때문', '이후', '이전',
  '이것', '저것', '그것', '이런', '저런', '그런', '때문에',
]);

function check(text, raw, keyword, angleSummary) {
  const results = [];
  const charCount = text.replace(/\s/g, '').length;

  // 1. 글자수
  results.push({
    name: '글자수',
    pass: charCount >= 1500,
    detail: `공백제외 ${charCount}자 (목표 ≥ 1500)`,
  });

  // 2. 키워드 밀도
  if (keyword) {
    const occurrences = (
      text.match(new RegExp(escapeRe(keyword), 'g')) || []
    ).length;
    const totalWords = text.length / 2; // 한국어 대략 추정 (글자÷2)
    const density = (occurrences / totalWords) * 100;
    const ok = occurrences >= 2 && occurrences <= 5;
    results.push({
      name: '키워드 빈도',
      pass: ok,
      detail: `"${keyword}" ${occurrences}회 (권장 2~5회), 추정밀도 ${density.toFixed(2)}%`,
    });
  }

  // 3. 반복 어미
  const sentences = text.split(/[.!?。]\s*/).filter((s) => s.length > 5);
  let maxRun = 1;
  let runEnding = '';
  let cur = 1;
  let prev = '';
  for (const s of sentences) {
    const ending = s.trim().slice(-3);
    if (ending && ending === prev) {
      cur++;
      if (cur > maxRun) {
        maxRun = cur;
        runEnding = ending;
      }
    } else {
      cur = 1;
    }
    prev = ending;
  }
  results.push({
    name: '문장 어미 반복',
    pass: maxRun < 3,
    detail:
      maxRun >= 3
        ? `"${runEnding}" 어미 ${maxRun}회 연속 — 변주 필요`
        : '연속 3회 이상 동일 어미 없음',
  });

  // 4. 이미지 마커
  const imgMarkers = (raw.match(/\[IMAGE:/g) || []).length;
  results.push({
    name: '이미지 마커',
    pass: imgMarkers >= 2,
    detail: `[IMAGE:] ${imgMarkers}개 (권장 ≥ 2)`,
  });

  // 5. 외부 링크
  const links = raw.match(/https?:\/\/[^\s"'<>)]+/g) || [];
  results.push({
    name: '외부 링크',
    pass: links.length <= 3,
    detail:
      links.length <= 3
        ? links.length === 0
          ? '외부 링크 없음'
          : `외부 링크 ${links.length}개 (원문 링크 포함 허용)`
        : `${links.length}개 발견 — 3개 이하로 줄여주세요: ${links.slice(0, 3).join(', ')}`,
  });

  // 6. 금칙어
  const hits = BANNED.filter((w) => text.includes(w));
  results.push({
    name: '최상급/금칙어',
    pass: hits.length === 0,
    detail: hits.length === 0 ? '없음' : `발견: ${hits.join(', ')}`,
  });

  // 7. 접속사 비율
  const conjCount = (text.match(CONJ_RE) || []).length;
  const conjRatio = sentences.length
    ? (conjCount / sentences.length) * 100
    : 0;
  results.push({
    name: '접속사 비율',
    pass: conjRatio <= 5,
    detail: `${conjCount}회 / ${sentences.length}문장 = ${conjRatio.toFixed(1)}% (목표 ≤ 5%)`,
  });

  // 8. 각도 일치성 (angleSummary 있을 때만)
  if (angleSummary) {
    // [IMAGE:...] 마커와 ## 헤딩 제거 후 앞 30% 추출
    const cleaned = raw
      .replace(/\[IMAGE:[^\]]*\]/g, '')
      .replace(/^##.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
    const intro = cleaned.slice(0, Math.floor(cleaned.length * 0.3));

    const tokens = [...new Set(
      (angleSummary.match(/[가-힣A-Za-z0-9]+/g) || [])
        .filter((t) => t.length >= 2 && !ANGLE_STOPWORDS.has(t))
    )];

    if (tokens.length > 0) {
      const angleHits = tokens.filter((t) => intro.includes(t));
      results.push({
        name: '각도 일치성',
        pass: angleHits.length >= 2,
        detail: `승인 각도 핵심어 ${angleHits.length}/${tokens.length}개 도입부 등장 (목표 ≥ 2개)${angleHits.length > 0 ? ` — 매칭: ${angleHits.join(', ')}` : ''}`,
      });
    }
  }

  return { charCount, sentences: sentences.length, results };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.file) {
    console.error('Usage: --file <path> [--keyword <kw>]');
    process.exit(2);
  }

  const raw = await readFile(args.file, 'utf8');
  const isHtml = /<[a-z][\s\S]*>/i.test(raw);
  const text = isHtml ? stripHtml(raw) : raw;

  let angleSummary = null;
  try {
    const metaPath = join(dirname(args.file), 'metadata.json');
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    angleSummary = meta.angle_summary || null;
  } catch {
    // optional — 기존 글에는 이 필드가 없어 정상
  }

  if (angleSummary === null && args.file.endsWith('post.md')) {
    console.warn('⚠️  metadata.json 없음 또는 angle_summary 미설정 — 각도 일치성 검사 생략');
  }

  const report = check(text, raw, args.keyword, angleSummary);

  console.log(`\n📋 블로그 품질 리포트`);
  console.log(`파일: ${args.file}`);
  console.log(`형식: ${isHtml ? 'HTML' : 'Markdown/Text'}`);
  console.log(`총 ${report.sentences}문장, 공백제외 ${report.charCount}자\n`);

  let warnings = 0;
  for (const r of report.results) {
    const mark = r.pass ? '✅ PASS' : '⚠️  WARN';
    console.log(`${mark}  ${r.name.padEnd(14)} — ${r.detail}`);
    if (!r.pass) warnings++;
  }
  console.log(
    `\n결과: ${warnings === 0 ? '모든 검사 통과' : `${warnings}개 경고`}\n`
  );

  const reportPath = join(dirname(args.file), 'quality-report.json');
  await writeFile(
    reportPath,
    JSON.stringify(
      { file: args.file, keyword: args.keyword || null, ...report },
      null,
      2
    )
  );
  console.log(`리포트 저장: ${reportPath}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
