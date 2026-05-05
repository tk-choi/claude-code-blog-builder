# 파이프라인 — end-to-end

## 전체 흐름 개요

```
/setup ──────────────────────────────────────────► knowledge/ 초기화 (1회)
/setup-tone ─────────────────────────────────────► 톤 학습 (1회)
/setup-domain ───────────────────────────────────► 도메인 특화 (1회)

/blog-new "AI 뉴스 주제"
  │
  ├─ STEP 0: 사전 로드 (knowledge/ 파일 읽기)
  ├─ STEP 1: AI 뉴스 리서치 (Exa MCP / WebSearch / research.js)
  ├─ STEP 2: 콘텐츠 생성 (blog-writer 에이전트)
  │    └─ [자동] 품질검사 훅 (hook-post-write.js)
  ├─ STEP 3: 이미지 생성 (generate-images.js 또는 --prompt-only)
  └─ STEP 5: 최종 패키지 (metadata.json + guide.md + _index.json)

/blog-preview "폴더" ────────────────────────────► 발행 어시스턴트 (preview.html)
/blog-publish-ready "폴더" ─────────────────────► 발행 직전 최종 체크
```

---

## 설정 단계 (최초 1회)

### Phase 1: `/setup` — 5분 필수

**목적**: `knowledge/brand-facts.md` 생성

**실행 주체**: `setup-interviewer` 에이전트

**6개 질문 순서**:
1. 블로그명 / 필명 (2~30자)
2. 블로그 한 줄 소개 (10~100자)
3. 주력 AI 주제 1~3개
4. 글쓰기 스타일 / 톤 (모름이면 기본값 사용)
5. 주요 독자
6. 금지 단어 (선택)

**완료 결과물**:
- `knowledge/brand-facts.md` 생성
- `knowledge/banned-words.json` 도메인 단어 추가

**브랜드팩트 미완성 감지**: `brand-facts.md`가 `[PLACEHOLDER]`로 시작하면 `/blog-new` 실행 시 에러 안내 후 중단.

---

### Phase 2: `/setup-tone` — 10분 권장

**목적**: `knowledge/tone-samples/real-blog-posts.txt` 생성 (문체 학습)

**입력**: 블로그 URL 3~5개 (또는 벤치마킹 URL)

**실행 스크립트**:
```bash
node scripts/setup-tone-fetch.js --urls "URL1,URL2,URL3" --output "knowledge/tone-samples/real-blog-posts.txt"
```

**내부 동작**:
1. 각 URL에 fetch 요청
2. HTML에서 본문 영역 추출 (Tistory / 네이버 스마트에디터 / 워드프레스 / `<article>` 순서로 시도)
3. 결합 후 `real-blog-posts.txt` 저장 (목표 80KB+)
4. 시그니처 문장 5개 자동 추출 → 사용자 검증

---

### Phase 3: `/setup-domain` — 15분 선택

**목적**: 카테고리별 keyword-bank + 이미지 디자인 시스템 설정

**완료 결과물**:
- `keyword-bank/{카테고리}.yml` (각 카테고리당)
- `knowledge/banned-words.json` 도메인 단어 추가
- `.env` 브랜드 시스템 변수 (`BRAND_NAME`, `BRAND_BG_COLOR` 등)

---

## 글 생성 단계 (`/blog-new "AI 뉴스 주제"`)

### STEP 0: 사전 로드

**목적**: 글쓰기 컨텍스트 확보 (에이전트 실행 전 필수)

읽는 파일 순서:
1. `knowledge/brand-facts.md` — 블로거 정보·톤 (SSoT)
2. `knowledge/tone-samples/real-blog-posts.txt` — 문체 학습 (있을 경우)
3. `knowledge/patterns/writing-playbook.txt` — 패턴 구조 확인 (있을 경우)
4. `knowledge/banned-words.json` — 금칙어 목록
5. `output/_index.json` — 최근 패턴 확인 → 중복 회피 (있을 경우)

---

### STEP 1: AI 뉴스 리서치

**실행 주체**: `blog-researcher` 에이전트

**우선순위**:
1. **Exa MCP** (`mcp__exa__web_search_exa`) — 설정된 경우 1순위
2. **Claude Code 내장 WebSearch** — Exa 불가 시 폴백
3. **Naver API** (선택):
```bash
set -a && . ./.env && set +a && node scripts/research.js --keyword "<키워드>" --output "output/YYYY-MM-DD_키워드"
```
API 키 없으면 건너뜀 (에러 무시).

**출력**: 리서치 브리프 (선택한 뉴스, 핵심 포인트, 해석 각도, 인포그래픽 포인트, 추천 제목 후보)

---

### STEP 2: 콘텐츠 생성

**실행 주체**: `blog-writer` 에이전트

**글쓰기 구조 (AI 뉴스 요약+해석)**:
```
1. 뉴스 배경 (2~3문장)
2. 핵심 내용 요약 (bullet 또는 표)
3. 기술적 포인트 (수치·비교, 선택)
4. 내 해석/시사점 (학습자 관점)
5. 마무리 + 원문 링크
```

**철칙**:
- **원문 링크 필수**: `**원문**: [제목](URL)` 형식
- 본문 1,500~2,000자, 메인 키워드 2~5회
- `[IMAGE: 설명]` 마커 최소 2개 (썸네일용, 인포그래픽용)
- 외부 링크 ≤ 3개 (원문 포함 허용)
- 금칙어 0건, 표 1개 이상

**출력**:
- `output/YYYY-MM-DD_키워드/post.md`
- `output/YYYY-MM-DD_키워드/post.html`
- `output/YYYY-MM-DD_키워드/metadata.json`

**post.md 저장 즉시** → PostToolUse 훅이 자동으로 품질검사 실행

---

### [자동] 품질검사 + 유사도검사

**트리거**: `output/*/post.md` 저장 시 자동 (hook-post-write.js)

**quality-check.js 7개 항목**:

| # | 항목 | 기준 |
|---|------|------|
| 1 | 글자수 | 공백 제외 ≥ 1,500자 |
| 2 | 키워드 빈도 | 2~5회 |
| 3 | 어미 반복 | 3회 연속 동일 어미 금지 |
| 4 | 이미지 마커 | `[IMAGE: ...]` ≥ 2개 |
| 5 | 외부 링크 | ≤ 3개 (원문 링크 포함 허용) |
| 6 | 금칙어 | 0건 (`banned-words.json` 참조) |
| 7 | 접속사 비율 | ≤ 5% |

**duplicate-check.js**: `output/` 내 다른 `post.md`들과 6-gram Jaccard 유사도 비교. 25% 초과 시 경고.

---

### STEP 3: 이미지 생성

**스크립트**: `generate-images.js`

```bash
# metadata.json에서 en_points 추출 (없으면 빈 문자열)
EN_POINTS=$(node -e "try{const m=require('./output/<폴더>/metadata.json');console.log((m.en_points||[]).join('|||'))}catch{console.log('')}")
```

**옵션 A — 자동 생성** (GEMINI_API_KEY 있을 경우):
```bash
set -a && . ./.env && set +a && node scripts/generate-images.js \
  --title "글 제목" \
  --keyword "키워드" \
  --points "포인트1|||포인트2|||포인트3" \
  --en-points "$EN_POINTS" \
  --output "output/<폴더>/images"
```

**옵션 B — 프롬프트 출력** (Google AI Studio에 직접 입력):
```bash
node scripts/generate-images.js \
  --title "글 제목" \
  --keyword "키워드" \
  --points "포인트1|||포인트2|||포인트3" \
  --en-points "$EN_POINTS" \
  --output "output/<폴더>/images" \
  --prompt-only
```
→ `thumbnail_prompt.txt`, `infographic_prompt.txt` 생성 (모두 영문 — AI Studio / DALL-E / Midjourney 범용)

**생성 이미지 2종**:

| 파일명 | 비율 | 용도 |
|--------|------|------|
| `thumbnail.png` | 16:9 | 썸네일 (메인 키워드 + 브랜드) |
| `infographic.png` | 2:3 | 핵심 포인트 시각화 |

**브랜드 시스템**: `.env`의 `BRAND_NAME`, `BRAND_BG_COLOR`, `BRAND_FG_COLOR`, `BRAND_ACCENT` 자동 적용

---

### STEP 5: 최종 패키지

**완성 파일 목록**:
```
output/YYYY-MM-DD_키워드/
├── post.md                  # 원본 마크다운
├── post.html                # Tistory 에디터 붙여넣기용
├── metadata.json            # 패턴·톤변주·품질리포트 메타
├── guide.md                 # 편집 가이드 + 사실확인 체크리스트
├── quality-report.json      # quality-check.js 결과
└── images/
    ├── thumbnail.png
    └── infographic.png
```

`output/_index.json` 업데이트: 새 글 항목 추가

---

## 발행 단계

### `/blog-preview "폴더"`

**스크립트**: `preview.js`

**동작**: `output/폴더/preview.html` 생성 후 브라우저 자동 오픈

**기능**:
- 제목·태그·메타설명 복사 버튼
- 섹션별 "서식 포함 복사" / "텍스트만 복사"
- 이미지 N장 개별/일괄 다운로드 (이미지 수 동적 표시)
- 이미지가 없고 `*_prompt.txt`만 있을 경우: 프롬프트 카드 (텍스트 + 1-click 복사) 렌더링
- 발행 체크리스트

### `/blog-publish-ready "폴더"`

**목적**: 발행 직전 최종 체크리스트

| # | 검사 항목 | 판정 |
|---|----------|------|
| 1 | 원문 링크 포함 확인 | PASS/FAIL |
| 2 | 금칙어·최상급 탐지 | PASS/FAIL |
| 3 | 이미지 2장 존재 확인 | PASS/REVIEW |
| 4 | 외부 링크 ≤ 3개 | PASS/FAIL |
| 5 | quality-check 재실행 | PASS/FAIL |
| 6 | duplicate-check 재실행 | PASS/WARN |
| 7 | metadata.json 존재 | PASS/FAIL |
| 8 | guide.md 존재 | PASS/FAIL |
| 9 | `_index.json` 반영 확인 | PASS/FAIL |

모든 PASS → "Tistory 에디터에서 수동 업로드하세요" 안내

---

## 운영 주의사항

- 하루 2건 이상 발행 권장하지 않음
- 발행 시간 불규칙하게 유지 (패턴 탐지 방지)
- 이미지는 반드시 Tistory 에디터에서 직접 업로드
- 생성된 글은 반드시 사람이 검토 후 발행
- 원문 링크의 수치·사실 여부 반드시 확인
