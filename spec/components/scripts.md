# 스크립트 상세 명세

> **위치**: `scripts/` 디렉토리
> **공통 사항**: Node.js 20+ ES6 모듈 (`"type": "module"`), npm install 불필요, 내장 모듈만 사용

---

## 공통 패턴

모든 스크립트는 `--key value` 형식 CLI 파싱을 사용한다 (값 없는 `--flag`는 boolean `true`). 환경변수는 `.env`를 `set -a && . ./.env && set +a`로 로드 후 `process.env`로 접근.

---

## 스크립트 목록

### 1. `research.js`

| 항목 | 내용 |
|------|------|
| **목적** | Naver Search API로 키워드 리서치 수행 (선택적 3순위 도구) |
| **호출 주체** | `blog-researcher` 에이전트, `/blog-research` 명령어 |
| **사용 모듈** | `node:fs/promises`, `node:path`, `fetch` (내장) |

> **참고**: `/blog-new` 파이프라인에서 리서치 우선순위는 Exa MCP → WebSearch → 이 스크립트(선택) 순서다.

**입력**:
```bash
set -a && . ./.env && set +a && node scripts/research.js --keyword "Claude 4.5" [--output output/폴더]
```

**필요 환경변수**:
- `NAVER_CLIENT_ID` (없으면 건너뜀)
- `NAVER_CLIENT_SECRET` (없으면 건너뜀)

**내부 동작**:
1. Naver Blog Search API 호출 (`display=30, sort=sim`)
2. 전체 포스팅 수로 경쟁도 판정
3. 최근 30일 비율 계산 (트렌드 활성도)
4. 상위 글 제목에서 공통 단어 빈도 분석 → 연관 키워드 TOP 15 추출
5. 롱테일 키워드 8개 자동 제안

**경쟁도 판정 기준**:
```
total ≥ 100,000 → "높음" (롱테일 공략)
total ≥ 30,000  → "보통" (차별 각도)
total < 30,000  → "낮음" (정면 공략)
```

**출력**: `output/<폴더>/research.json`

---

### 2. `generate-images.js`

| 항목 | 내용 |
|------|------|
| **목적** | Gemini API로 브랜드 이미지 2종 생성 (또는 --prompt-only로 프롬프트 출력) |
| **호출 주체** | `/blog-new` 명령어 (STEP 3) |
| **사용 모듈** | `node:fs/promises`, `node:path`, `fetch` (내장) |

**입력**:
```bash
# 사전: metadata.json에서 en_points 추출 (없으면 빈 문자열)
EN_POINTS=$(node -e "try{const m=require('./output/<폴더>/metadata.json');console.log((m.en_points||[]).join('|||'))}catch{console.log('')}")

# 자동 생성 (GEMINI_API_KEY 필요)
node scripts/generate-images.js \
  --title "글 제목" \
  --keyword "키워드" \
  --points "포인트1|||포인트2|||포인트3" \
  --en-points "$EN_POINTS" \
  --output "output/<폴더>/images"

# 프롬프트 출력 (API 키 불필요)
node scripts/generate-images.js \
  --title "글 제목" \
  --keyword "키워드" \
  --points "포인트1|||포인트2|||포인트3" \
  --en-points "$EN_POINTS" \
  --output "output/<폴더>/images" \
  --prompt-only
```

**필요 환경변수**:
- `GEMINI_API_KEY` (선택 — 없으면 `--prompt-only` 사용)
- `BRAND_NAME` (기본값: "YOUR BRAND")
- `BRAND_BG_COLOR` (기본값: "#F7F6F2")
- `BRAND_FG_COLOR` (기본값: "#1A1A1A")
- `BRAND_ACCENT` (기본값: "#D97A3A")

**구분자**: 여러 값 전달 시 `|||` (파이프 3개)로 구분

**`--en-points`**: 이미지 생성용 영어 핵심 포인트 (5~10 단어 × 3~5개). `metadata.json`의 `en_points` 필드에서 추출. 비어있으면 `--points`(한국어)를 폴백 사용.

**--prompt-only 동작**:
- API 호출 없이 영문 이미지 프롬프트 텍스트 파일 출력
- `thumbnail_prompt.txt`, `infographic_prompt.txt` 생성
- Google AI Studio / DALL-E / Midjourney 등 범용 사용 가능
- 프롬프트 텍스트는 모두 영문 (다국어 이미지 생성 도구 호환)

**생성 이미지 2종**:

| 파일 | 비율 | 구성 요소 |
|------|------|----------|
| `thumbnail.png` | 16:9 | `--keyword`(그대로 사용), 브랜드명, 영문 컨셉 일러스트 |
| `infographic.png` | 2:3 | `--en-points` 우선, 없으면 `--points` 폴백 (3~5개 항목) |

> 썸네일은 키워드 기반 영문 컨셉 일러스트로 생성. 한국어 제목 텍스트는 이미지에 렌더링하지 않음 (다국어 호환성).

**출력**: `output/<폴더>/images/{thumbnail,infographic}.png`

---

### 3. `quality-check.js`

| 항목 | 내용 |
|------|------|
| **목적** | 블로그 저품질 트리거 사전 검사 (7항목 결정론적 채점) |
| **호출 주체** | `hook-post-write.js` (자동), `/blog-quality` 명령어, `blog-quality-reviewer` 에이전트 |
| **사용 모듈** | `node:fs/promises`, `node:path` |

**입력**:
```bash
node scripts/quality-check.js --file output/폴더/post.md [--keyword "키워드"]
```

**7개 검사 항목**:

| # | 항목 | 구현 방식 | 기준 |
|---|------|----------|------|
| 1 | 글자수 | HTML 태그 제거 후 공백 제외 길이 | ≥ 1,500자 |
| 2 | 키워드 빈도 | 정규식으로 키워드 등장 횟수 | 2~5회 |
| 3 | 어미 반복 | 연속 3문장 동일 어미 탐지 | 3회 연속 금지 |
| 4 | 이미지 마커 | `[IMAGE: ...]` 패턴 개수 | ≥ 2개 |
| 5 | 외부 링크 | `http://`, `https://` 탐지 | ≤ 3개 |
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
| **목적** | 내 블로그 글끼리 유사도 검사 (유사문서 판정 회피) |
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
    "file_path": "output/2026-05-05_claude45/post.md"
  }
}
```

**내부 동작**:
1. stdin에서 JSON 읽기 (2초 타임아웃)
2. `tool_input.file_path` 또는 `file_path` 필드에서 경로 추출
3. `/output/*/post.md` 정규식으로 매칭 — **다른 파일은 모두 무시**
4. 폴더명에서 날짜 제거 → 키워드 추출
5. `quality-check.js` 실행 (`spawnSync`)
6. `duplicate-check.js` 실행 (`spawnSync`)
7. `exit(0)` — 항상 성공으로 종료

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
3. `post.html`을 `<h2>` 단위로 섹션 분할
4. 섹션별 복사 버튼 + 다운로드 버튼 HTML 생성
5. `output/폴더/images/*.png` 이미지 목록 확인
6. 이미지가 0장일 때만 폴백: `output/폴더/images/*_prompt.txt` 스캔
7. 이미지가 없고 프롬프트 파일만 있으면 → 프롬프트 카드 (텍스트 + 복사 버튼) 렌더링
8. 섹션 헤더는 `images.length`에 따라 동적: 이미지 N장 / (프롬프트 N개)
9. self-contained HTML 조립 (외부 의존성 없음)
10. `open` (macOS) / `xdg-open` (Linux) / `start` (Windows)으로 브라우저 오픈

**출력**: `output/<폴더>/preview.html`

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
1. Tistory: `div.post-view`
2. 네이버 스마트에디터3: `div.se-main-container`
3. 워드프레스: `div.entry-content`
4. 시맨틱 태그: `<article>`
5. 위 4가지 실패 시 전체 HTML 텍스트 추출

**출력**: `knowledge/tone-samples/real-blog-posts.txt` (목표 80KB+)

---

## 스크립트 수정 가이드

### API 교체 시

**Gemini → 다른 이미지 API**: `generate-images.js`의 `generateOne()` 함수 교체. 2종 PNG 파일명(`thumbnail.png`, `infographic.png`)만 유지하면 나머지 파이프라인과 호환.

### 새 검사 항목 추가

`quality-check.js`의 `check()` 함수에 항목 추가:
```js
results.push({
  name: '새 항목',
  pass: <조건>,
  detail: `<설명>`,
});
```
