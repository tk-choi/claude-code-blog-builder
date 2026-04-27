# 스크립트 상세 명세

> **위치**: `scripts/` 디렉토리
> **공통 사항**: Node.js 20+ ES6 모듈 (`"type": "module"`), npm install 불필요, 내장 모듈만 사용

---

## 공통 패턴

모든 스크립트는 동일한 CLI 파싱 패턴을 사용한다:

```js
// --key value 형식 파싱
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { args[key] = next; i++; }
      else { args[key] = true; }
    }
  }
  return args;
}
```

환경변수는 `.env`를 `set -a && . ./.env && set +a`로 로드 후 `process.env`로 접근.

---

## 스크립트 목록

### 1. `research.js`

| 항목 | 내용 |
|------|------|
| **목적** | Naver Search API로 키워드 리서치 수행 |
| **호출 주체** | `blog-researcher` 에이전트, `/blog-research` 명령어 |
| **사용 모듈** | `node:fs/promises`, `node:path`, `fetch` (내장) |

**입력**:
```bash
node scripts/research.js --keyword "상세페이지 AI" [--output output/폴더]
```

**필요 환경변수**:
- `NAVER_CLIENT_ID` (필수)
- `NAVER_CLIENT_SECRET` (필수)
- 미설정 시: Error throw → Claude가 WebSearch로 수동 대체

**내부 동작**:
1. Naver Blog Search API 호출 (`display=30, sort=sim`)
2. URL: `https://openapi.naver.com/v1/search/blog?query=<keyword>&display=30&sort=sim`
3. 전체 포스팅 수로 경쟁도 판정 (`competitionLevel()` 함수)
4. 최근 30일 비율 계산 (날짜 파싱)
5. 상위 글 제목에서 공통 단어 빈도 분석 → 연관 키워드 TOP 15 추출
6. 패턴 매칭으로 롱테일 키워드 8개 자동 제안

**출력**:
- `output/<폴더>/research.json`

```json
{
  "keyword": "상세페이지 AI",
  "total": 45000,
  "competition": "보통",
  "recentRatio": 0.23,
  "relatedKeywords": [...],
  "longtailSuggestions": [...],
  "topTitles": [...]
}
```

**경쟁도 판정 기준**:
```
total ≥ 100,000 → "높음" (롱테일 공략)
total ≥ 30,000  → "보통" (차별 각도)
total < 30,000  → "낮음" (정면 공략)
```

---

### 2. `generate-images.js`

| 항목 | 내용 |
|------|------|
| **목적** | Gemini API로 브랜드 이미지 4종 생성 |
| **호출 주체** | `/blog-new` 명령어 (STEP 3) |
| **사용 모듈** | `node:fs/promises`, `node:path`, `fetch` (내장) |

**입력**:
```bash
node scripts/generate-images.js \
  --title "글 제목" \
  --keyword "키워드" \
  --points "포인트1|||포인트2|||포인트3" \
  --quote "핵심 문구" \
  --steps "단계1|||단계2|||단계3" \
  --output "output/폴더/images"
```

**필요 환경변수**:
- `GEMINI_API_KEY` (필수)
- `BRAND_NAME` (기본값: "YOUR BRAND")
- `BRAND_BG_COLOR` (기본값: "#F7F6F2")
- `BRAND_FG_COLOR` (기본값: "#1A1A1A")
- `BRAND_ACCENT` (기본값: "#D97A3A")

**구분자**: 여러 값 전달 시 `|||` (파이프 3개)로 구분

**내부 동작**:
1. 브랜드 시스템 변수를 환경변수에서 읽기
2. 4종 이미지 각각에 대해 Gemini API 프롬프트 생성
3. REST API 호출 (POST `https://generativelanguage.googleapis.com/...`)
4. base64 응답 디코딩 → PNG 저장

**생성 이미지 4종**:

| 파일 | 비율 | 구성 요소 |
|------|------|----------|
| `thumbnail.png` | 16:9 | `--title`, `--keyword`, 브랜드명 |
| `infographic.png` | 2:3 | `--points` (3개 항목) |
| `quote-card.png` | 1:1 | `--quote` (핵심 문구) |
| `process.png` | 4:3 | `--steps` (단계별 순서) |

**출력**: `output/<폴더>/images/{thumbnail,infographic,quote-card,process}.png`

---

### 3. `quality-check.js`

| 항목 | 내용 |
|------|------|
| **목적** | 네이버 저품질 트리거 사전 검사 (7항목 결정론적 채점) |
| **호출 주체** | `hook-post-write.js` (자동), `/blog-quality` 명령어, `blog-quality-reviewer` 에이전트 |
| **사용 모듈** | `node:fs/promises`, `node:path` |

**입력**:
```bash
node scripts/quality-check.js --file output/폴더/post.html [--keyword "키워드"]
```

**7개 검사 항목**:

| # | 항목 | 구현 방식 | 기준 |
|---|------|----------|------|
| 1 | 글자수 | HTML 태그 제거 후 공백 제외 길이 | ≥ 1,500자 |
| 2 | 키워드 밀도 | 정규식으로 키워드 등장 횟수 / 총 길이 | 5~12회 |
| 3 | 어미 반복 | 연속 3문장 동일 어미 탐지 | 3회 연속 금지 |
| 4 | 이미지 마커 | `[IMAGE: ...]` 패턴 개수 | ≥ 4개 |
| 5 | 외부 링크 | `http://`, `https://` 탐지 | 0건 |
| 6 | 금칙어 | `BANNED` 배열: `['최고','최저','최상','무조건','100%','절대','완벽']` | 0건 |
| 7 | 접속사 비율 | `['또한','그리고','더불어','아울러']` / 총 문장 수 | ≤ 5% |

**HTML 전처리** (`stripHtml()` 함수):
- `<script>`, `<style>` 태그 및 내용 제거
- 모든 HTML 태그 제거
- HTML 엔티티 (`&nbsp;`, `&amp;` 등) 디코딩
- 연속 공백 정리

**출력**: `output/<폴더>/quality-report.json` + 콘솔 PASS/WARN 출력

**종료 코드**: 항상 0 (훅에서 호출 시 Claude 작업 블로킹 방지)

---

### 4. `duplicate-check.js`

| 항목 | 내용 |
|------|------|
| **목적** | 내 블로그 글끼리 유사도 검사 (네이버 유사문서 판정 회피) |
| **호출 주체** | `hook-post-write.js` (자동), `/blog-quality` 명령어 |
| **사용 모듈** | `node:fs/promises`, `node:path` |

**입력**:
```bash
node scripts/duplicate-check.js --file output/폴더/post.md [--threshold 25]
```

**알고리즘**: 6-gram Jaccard 유사도

```
1. 텍스트 전처리 (HTML 태그·마크다운 기호 제거)
2. 공백 제거 후 6글자 단위 셰이글(shingle) 집합 생성
3. 대상 파일과 output/ 내 모든 post.md 쌍에 대해 Jaccard 계산:
   Jaccard = |교집합| / |합집합| × 100
4. 임계값(기본 25%) 초과 시 경고
```

**비교 대상**: `output/` 하위 모든 `post.md` 파일 (대상 파일 자신 제외)

**종료 코드**: 항상 0 (경고만 출력, 블로킹 없음)

---

### 5. `hook-post-write.js`

| 항목 | 내용 |
|------|------|
| **목적** | PostToolUse 훅 라우터 — post.md 저장 시 자동 검사 실행 |
| **호출 주체** | `.claude/settings.json` PostToolUse 훅 |
| **사용 모듈** | `node:child_process`, `node:path` |

**입력**: stdin으로 JSON payload (Claude Code가 전달)

```json
{
  "tool_input": {
    "file_path": "output/2026-04-08_키워드/post.md"
  }
}
```

**내부 동작**:
1. stdin에서 JSON 읽기 (2초 타임아웃)
2. `tool_input.file_path` 또는 `file_path` 필드에서 경로 추출
3. `/output/*/post.md` 정규식으로 매칭 — **다른 파일은 모두 무시**
4. 폴더명에서 날짜 제거 → 키워드 추출 (`2026-04-08_병원마케팅` → `병원마케팅`)
5. `quality-check.js` 실행 (`spawnSync`)
6. `duplicate-check.js` 실행 (`spawnSync`)
7. `exit(0)` — 항상 성공으로 종료

**경로 매칭 정규식**: `/\/output\/[^/]+\/post\.md$/`

---

### 6. `preview.js`

| 항목 | 내용 |
|------|------|
| **목적** | 발행 어시스턴트용 self-contained HTML 생성 + 브라우저 오픈 |
| **호출 주체** | `/blog-preview` 명령어 |
| **사용 모듈** | `node:fs/promises`, `node:path`, `node:child_process`, `node:os` |

**입력**:
```bash
node scripts/preview.js --folder output/폴더 [--no-open]
```

**내부 동작**:
1. `output/폴더/post.html`에서 본문 읽기
2. `metadata.json`에서 제목·태그·메타설명 읽기
3. `post.html`을 `<h2>` 단위로 섹션 분할 (`splitSections()`)
4. 섹션별 복사 버튼 + 다운로드 버튼 HTML 생성
5. `output/폴더/images/*.png` 이미지 목록 확인
6. self-contained HTML 파일 조립 (외부 의존성 없음)
7. `open` (macOS) / `xdg-open` (Linux) / `start` (Windows)으로 브라우저 오픈

**출력**: `output/<폴더>/preview.html`

**`--no-open` 플래그**: 브라우저 자동 오픈 없이 파일만 생성

---

### 7. `setup-tone-fetch.js`

| 항목 | 내용 |
|------|------|
| **목적** | 블로그 URL 3~5개에서 본문 텍스트 추출 → 톤 학습용 텍스트 파일 생성 |
| **호출 주체** | `setup-interviewer` 에이전트 (Phase 2), `/setup-tone` 명령어 |
| **사용 모듈** | `node:fs/promises`, `node:path`, `fetch` (내장) |

**입력**:
```bash
node scripts/setup-tone-fetch.js \
  --urls "URL1,URL2,URL3" \
  --output "knowledge/tone-samples/real-blog-posts.txt"
```

**본문 추출 우선순위** (`htmlToText()` 함수):
1. 네이버 스마트에디터3: `div.se-main-container`
2. 티스토리: `div.post-view`
3. 워드프레스: `div.entry-content`
4. 시맨틱 태그: `<article>`
5. 위 4가지 실패 시 전체 HTML 텍스트 추출

**출력**: `knowledge/tone-samples/real-blog-posts.txt` (목표 80KB+)

---

## 스크립트 수정 가이드

### API 교체 시

**Naver → 다른 검색 API**: `research.js`의 `naverSearch()` 함수 교체. 출력 `research.json` 형식만 유지하면 `blog-researcher` 에이전트와의 호환성 유지.

**Gemini → 다른 이미지 API**: `generate-images.js`의 API 호출 부분 교체. 4종 PNG 파일명(`thumbnail.png`, `infographic.png`, `quote-card.png`, `process.png`)만 유지하면 나머지 파이프라인과 호환.

### 새 검사 항목 추가

`quality-check.js`의 `check()` 함수에 항목 추가:
```js
results.push({
  name: '새 항목',
  pass: <조건>,
  detail: `<설명>`,
});
```
