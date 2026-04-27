# 파이프라인 — end-to-end

## 전체 흐름 개요

```
/setup ──────────────────────────────────────────► knowledge/ 초기화 (1회)
/setup-tone ─────────────────────────────────────► 톤 학습 (1회)
/setup-domain ───────────────────────────────────► 도메인 특화 (1회)

/blog-new "키워드"
  │
  ├─ STEP 0: 사전 로드 (knowledge/ 파일 읽기)
  ├─ STEP 1: 키워드 리서치 (research.js)
  ├─ STEP 2: 콘텐츠 생성 (blog-writer 에이전트)
  │    └─ [자동] STEP 4: 품질검사 훅 (hook-post-write.js)
  ├─ STEP 3: 이미지 생성 (generate-images.js)
  └─ STEP 5: 최종 패키지 (metadata.json + guide.md + _index.json)

/blog-preview "폴더" ────────────────────────────► 발행 어시스턴트 (preview.html)
/blog-publish-ready "폴더" ─────────────────────► 발행 직전 최종 체크
```

---

## 설정 단계 (최초 1회)

### Phase 1: `/setup` — 5분 필수

**목적**: `knowledge/brand-facts.md` 생성

**실행 주체**: `setup-interviewer` 에이전트

**7개 질문 순서**:
1. 회사명 (1~30자)
2. 한 줄 소개 (10~100자)
3. 주력 카테고리 1~3개
4. 자랑할 실수치 1~5개 (★가장 중요)
5. 인증·수상 내역
6. 타겟 고객 (한 명의 얼굴이 떠오를 정도로 구체)
7. 사용 금지 단어

**완료 결과물**:
- `knowledge/brand-facts.md` 생성
- `knowledge/banned-words.json` 도메인 단어 추가

**브랜드팩트 미완성 감지**: CLAUDE.md 규칙에 따라 `brand-facts.md`가 `[PLACEHOLDER]`로 시작하면 `/blog-new` 실행 시 에러 안내 후 중단.

---

### Phase 2: `/setup-tone` — 10분 권장

**목적**: `knowledge/tone-samples/real-blog-posts.txt` 생성 (문체 학습)

**입력**: 회사 블로그 URL 3~5개 (또는 벤치마킹 URL)

**실행 스크립트**:
```bash
node scripts/setup-tone-fetch.js --urls "URL1,URL2,URL3" --output "knowledge/tone-samples/real-blog-posts.txt"
```

**내부 동작**:
1. 각 URL에 fetch 요청
2. HTML에서 본문 영역 추출 (네이버 스마트에디터3 / 티스토리 / 워드프레스 / `<article>` 순서로 시도)
3. 결합 후 `real-blog-posts.txt` 저장 (목표 80KB+)
4. 시그니처 문장 5개 자동 추출 → 사용자 검증

---

### Phase 3: `/setup-domain` — 15분 선택

**목적**: 카테고리별 keyword-bank + 이미지 디자인 시스템 설정

**완료 결과물**:
- `keyword-bank/{카테고리}.yml` (각 카테고리당)
- `knowledge/banned-words.json` 도메인 단어 추가
- `knowledge/conversion-benchmarks.md` 업계 수치 추가
- `.env` 브랜드 시스템 변수 (`BRAND_NAME`, `BRAND_BG_COLOR` 등)

---

## 글 생성 단계 (`/blog-new "키워드"`)

### STEP 0: 사전 로드

**목적**: 글쓰기 컨텍스트 확보 (에이전트 실행 전 필수)

읽는 파일 순서:
1. `knowledge/brand-facts.md` — 사용 가능 수치 확인
2. `knowledge/tone-samples/real-blog-posts.txt` — 문체 학습 (있을 경우)
3. `knowledge/patterns/writing-playbook.txt` — 패턴 구조 확인 (있을 경우)
4. `knowledge/banned-words.json` — 금칙어 목록
5. `output/_index.json` — 최근 패턴 확인 → 중복 회피 (있을 경우)

---

### STEP 1: 키워드 리서치

**실행 주체**: `blog-researcher` 에이전트

**스크립트 호출**:
```bash
set -a && . ./.env && set +a && node scripts/research.js --keyword "<키워드>" --output "output/YYYY-MM-DD_키워드"
```

**research.js 내부 동작**:
1. Naver Search Blog API 호출 (`display=30, sort=sim`)
2. 전체 포스팅 수 집계 → 경쟁도 판정
   - 10만+ → 높음 (롱테일 공략)
   - 3만~10만 → 보통 (차별 각도)
   - 3만 미만 → 낮음 (정면 공략)
3. 최근 30일 비율 계산 (트렌드 활성도)
4. 상위 글 제목에서 연관 키워드 TOP 15 추출
5. 롱테일 키워드 8개 자동 제안
6. `research.json` 저장

**API 실패 시**: 에러 throw → Claude가 WebSearch로 수동 대체 리서치

**출력**: `output/YYYY-MM-DD_키워드/research.json` + 리서치 브리프 (markdown)

---

### STEP 2: 콘텐츠 생성

**실행 주체**: `blog-writer` 에이전트

**글쓰기 철칙** (에이전트 프롬프트에서):
- `brand-facts.md`에 없는 수치 사용 금지
- 도입부 4줄 공식: 문제 → 손실 → 자격 → 끝까지 읽으면 얻을 것
- A.E.A 구조: 권위(Authority) → 근거(Evidence) → 행동(Action)
- 본문 1,500~3,000자, 메인 키워드 5~12회
- `[IMAGE: 설명]` 마커 최소 4개
- 외부 링크 0건
- 금칙어 0건
- 표 1개 이상

**출력**:
- `output/YYYY-MM-DD_키워드/post.md`
- `output/YYYY-MM-DD_키워드/post.html`
- `output/YYYY-MM-DD_키워드/metadata.json`

**post.md 저장 즉시** → PostToolUse 훅이 STEP 4를 자동 실행

---

### STEP 4 (자동): 품질검사 + 유사도검사

**트리거**: `output/*/post.md` 저장 시 자동 (hook-post-write.js)

**quality-check.js 7개 항목**:

| # | 항목 | 기준 |
|---|------|------|
| 1 | 글자수 | 공백 제외 ≥ 1,500자 |
| 2 | 키워드 밀도 | 5~12회 |
| 3 | 어미 반복 | 3회 연속 동일 어미 금지 |
| 4 | 이미지 마커 | `[IMAGE: ...]` ≥ 4개 |
| 5 | 외부 링크 | 0건 |
| 6 | 금칙어 | 0건 (`banned-words.json` 참조) |
| 7 | 접속사 비율 | ≤ 5% |

**duplicate-check.js**: `output/` 내 다른 `post.md`들과 6-gram Jaccard 유사도 비교. 25% 초과 시 경고.

**의료/뷰티 키워드**: `medical-law-checker` 에이전트 추가 호출 (조건부)

---

### STEP 3: 이미지 생성

**스크립트**: `generate-images.js`

**API**: Gemini 3 Pro Image (REST, `GEMINI_API_KEY`)

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

**생성 이미지 4종**:

| 파일명 | 비율 | 용도 |
|--------|------|------|
| `thumbnail.png` | 16:9 | 썸네일 (메인 키워드 + 브랜드) |
| `infographic.png` | 2:3 | 핵심 포인트 3개 시각화 |
| `quote-card.png` | 1:1 | 핵심 인용문 강조 |
| `process.png` | 4:3 | 단계별 프로세스 다이어그램 |

**브랜드 시스템**: `.env`의 `BRAND_NAME`, `BRAND_BG_COLOR`, `BRAND_FG_COLOR`, `BRAND_ACCENT` 자동 적용

---

### STEP 5: 최종 패키지

**완성 파일 목록**:
```
output/YYYY-MM-DD_키워드/
├── post.md                  # 원본 마크다운
├── post.html                # 스마트에디터 붙여넣기용
├── metadata.json            # 패턴·톤변주·품질리포트 메타
├── guide.md                 # 편집 가이드 + 사실확인 체크리스트
├── quality-report.json      # quality-check.js 결과
└── images/
    ├── thumbnail.png
    ├── infographic.png
    ├── quote-card.png
    └── process.png
```

`output/_index.json` 업데이트: 새 글 항목 추가, `recent_rotation` 갱신

---

## 발행 단계

### `/blog-preview "폴더"`

**스크립트**: `preview.js`

**동작**: `output/폴더/preview.html` 생성 후 브라우저 자동 오픈

**기능**:
- 제목·태그·메타설명 복사 버튼
- 섹션별 "서식 포함 복사" / "텍스트만 복사"
- 이미지 4장 개별/일괄 다운로드
- 발행 체크리스트 10개

### `/blog-publish-ready "폴더"`

**목적**: 발행 직전 최종 10개 체크리스트

| # | 검사 항목 | 판정 |
|---|----------|------|
| 1 | 수치 brand-facts.md 일치 확인 | PASS/FAIL |
| 2 | 금칙어·최상급 탐지 | PASS/FAIL |
| 3 | 의료법 검사 (해당 키워드만) | PASS/FAIL |
| 4 | 이미지 4장 존재 + 크기 확인 | PASS/REVIEW |
| 5 | 외부 링크 0건 | PASS/FAIL |
| 6 | quality-check 재실행 | PASS/FAIL |
| 7 | duplicate-check 재실행 | PASS/WARN |
| 8 | metadata.json 존재 | PASS/FAIL |
| 9 | guide.md 존재 | PASS/FAIL |
| 10 | `_index.json` 반영 확인 | PASS/FAIL |

모든 PASS → "스마트에디터에서 수동 업로드하세요" 안내

---

## 운영 주의사항

- 하루 2건 이상 발행 권장하지 않음
- 발행 시간 불규칙하게 유지 (패턴 탐지 방지)
- 이미지는 반드시 스마트에디터에서 직접 업로드 (HTML 임베드 불가)
- 생성된 글은 반드시 사람이 검토 후 발행
