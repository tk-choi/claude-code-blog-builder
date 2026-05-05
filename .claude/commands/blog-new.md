---
description: 키워드/주제 하나로 AI 뉴스 블로그 글 패키지 풀 파이프라인 실행 (리서치→작성→이미지→검증)
argument-hint: <키워드 또는 AI 뉴스 주제>
---

사용자가 "$ARGUMENTS" 주제로 AI 뉴스 블로그 글을 만들어달라고 요청했습니다.

> ⚠️ **사전 체크**: `knowledge/brand-facts.md`가 placeholder 상태(`[PLACEHOLDER]`로 시작)면 먼저 사용자에게 `/setup` 실행을 안내하고 중단하세요.

CLAUDE.md의 실행 파이프라인에 따라 아래 순서를 **반드시 전부** 수행하세요:

## 0. 사전 로드 (생략 금지)
다음 파일을 먼저 Read로 읽습니다:
1. `knowledge/brand-facts.md` — 블로거 정보·톤·독자 (Single Source of Truth)
2. `knowledge/tone-samples/real-blog-posts.txt` — 블로그 문체 (있을 경우)
3. `knowledge/patterns/writing-playbook.txt` — 글쓰기 패턴 가이드 (있을 경우)
4. `knowledge/banned-words.json` — 금칙어
5. `output/_index.json` — 최근 사용한 패턴/도입부 확인 (있을 경우 — 의도적으로 다른 조합 선택)

## 1. AI 뉴스 리서치 (STEP 1)

`blog-researcher` 에이전트에 위임하거나 직접 수행:

**1순위 — Exa MCP** (설정된 경우):
- `mcp__exa__web_search_exa` 도구로 최신 AI 뉴스 검색
- 쿼리: `"$ARGUMENTS AI news 2026"` 또는 `"$ARGUMENTS 최신 뉴스"`

**2순위 — 내장 WebSearch**:
- `"$ARGUMENTS AI 뉴스 최신"` 검색

**3순위 — Naver API** (선택):
```bash
set -a && . ./.env && set +a && node scripts/research.js --keyword "$ARGUMENTS" --output "output/$(date +%Y-%m-%d)_$(echo $ARGUMENTS | tr -d ' /\\:*?"<>|')"
```
API 키 없으면 건너뜀 (에러 무시).

## 2. 콘텐츠 생성 (STEP 2)
- `blog-writer` 서브에이전트에 위임 또는 직접 작성
- **구조**: 뉴스 배경 → 핵심 내용 요약 → 내 해석/시사점 → 원문 링크
- 본문 1,500~2,000자, 메인 키워드 2~5회 자연 삽입
- `[IMAGE: 설명]` 마커 최소 2개 (썸네일용, 인포그래픽용)
- 원문 링크 반드시 포함
- `post.md` 와 `post.html` 작성
- `output/<폴더>/` 에 저장 → 훅이 자동으로 품질검사·유사도검사 실행

## 3. 이미지 생성 (STEP 3)

`metadata.json`의 `en_points`(영어 핵심 포인트)를 인포그래픽에 사용합니다.

```bash
# metadata.json에서 en_points 추출 (없으면 빈 문자열)
EN_POINTS=$(node -e "try{const m=require('./output/<폴더>/metadata.json');console.log((m.en_points||[]).join('|||'))}catch{console.log('')}")
```

**옵션 A — 자동 생성** (GEMINI_API_KEY 있을 경우):
```bash
set -a && . ./.env && set +a && node scripts/generate-images.js \
  --title "..." --keyword "$ARGUMENTS" \
  --points "핵심포인트1|||핵심포인트2|||핵심포인트3" \
  --en-points "$EN_POINTS" \
  --output "output/<폴더>/images"
```
썸네일 + 인포그래픽 2종 생성.

**옵션 B — 프롬프트 출력** (직접 AI Studio에 입력):
```bash
node scripts/generate-images.js \
  --title "..." --keyword "$ARGUMENTS" \
  --points "핵심포인트1|||핵심포인트2|||핵심포인트3" \
  --en-points "$EN_POINTS" \
  --output "output/<폴더>/images" \
  --prompt-only
```
`thumbnail_prompt.txt`, `infographic_prompt.txt` 파일이 생성됩니다.
→ Google AI Studio / DALL-E / Midjourney 등 어디서든 붙여넣기 가능한 영문 프롬프트.

## 4. 품질 검증 (STEP 4)
훅이 자동 실행하지만, 경고가 나오면 본문을 수정하고 재검사.

## 5. 최종 패키지 (STEP 5)
- `metadata.json` (패턴·톤 변주·품질 리포트)
- `guide.md` (편집 가이드 · 사실 확인 체크리스트 · 이미지 삽입 위치)
- `output/_index.json` 에 새 글 항목 추가

## 완료 후 사용자에게 보고할 것
- 제목 / 글자수 / 원문 출처
- 품질검사 결과, 유사도 검사 결과
- 이미지 생성 여부 (자동 or 프롬프트 출력)
- 발행 전 확인 항목 (원문 링크·수치 사실 여부)
- 다음 단계: `/blog-preview <폴더>` 로 발행 어시스턴트 실행
