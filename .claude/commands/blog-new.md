---
description: 키워드/주제 하나로 AI 뉴스 블로그 글 패키지 풀 파이프라인 실행 (리서치→작성→이미지→검증)
argument-hint: <키워드 또는 AI 뉴스 주제> [--interactive]
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

## 1.5. Pre-writing 각도 게이트 (NEW)

리서치 브리프(`output/<폴더>/research-brief.md`)를 바탕으로 **다음 한 줄을 사용자에게 출력**하고 응답을 기다립니다:

```
[각도 확인] [주] <각도1 한 줄 요약> | [Enter]=진행  2=<각도2 요약>  3=<각도3 요약>  x=취소
```

`--interactive` 플래그가 인자에 포함된 경우: 각 후보 각도의 핵심 주장 3줄과 Tier 출처를 추가로 표시합니다.

**응답 처리 규칙:**
- `[Enter]` / `ok` / `1` / `진행` → [주] 각도로 STEP 2 진행. `angle_selection_method = "user-default"`
- `2` / `각도 2` → 대안 1로 각도 변경 후 STEP 2 진행. `angle_selection_method = "user"`
- `3` / `각도 3` → 대안 2로 각도 변경 후 STEP 2 진행. `angle_selection_method = "user"`
- `다시` / `재리서치` → STEP 1 재실행. 재시도 카운터 +1. **최대 2회 허용.** 2회 후에도 미결정이면 "키워드를 더 구체적으로 좁혀달라"고 요청 후 종료.
- `x` / `취소` → 파이프라인 종료. output 폴더는 그대로 둠.
- 모호한 응답 → 가장 가까운 옵션을 추정해 한 번만 재확인. 무한 대화 금지.

**Non-TTY 환경 (CI, ralph, 파이프 입력 등):**
stdin이 TTY가 아닌 경우, 게이트 한 줄을 출력하되 블로킹하지 않고 [주] 각도로 자동 진행합니다.
`angle_selection_method = "non-interactive-default"` 로 기록하고 계속 진행합니다.

## 2. 콘텐츠 생성 (STEP 2)

> STEP 1.5에서 사용자가 승인한 각도(주 또는 대안)를 blog-writer에 명시적으로 전달할 것. 승인 각도: "[주]/[대안N] 각도 — <한 줄 요약>"

- `blog-writer` 서브에이전트에 위임 또는 직접 작성
- **구조**: 뉴스 배경 → 핵심 내용 요약 → 내 해석/시사점 → 원문 링크
- 본문 1,500~2,000자, 메인 키워드 2~5회 자연 삽입
- `[IMAGE: 설명]` 마커 최소 2개 (썸네일용, 인포그래픽용)
- 원문 링크 반드시 포함
- `post.md` 와 `post.html` 작성
- `output/<폴더>/` 에 저장 → 훅이 자동으로 품질검사·유사도검사 실행

## 2.5. 비주얼 컨셉 생성 (STEP 2.5)

썸네일 AI slop을 방지하기 위해, 이미지 생성 전 글 내용 기반 영문 비주얼 컨셉을 생성합니다.

`metadata.json`의 `en_points[0~2]`와 `selected_angle`을 바탕으로 아래 형식의 **영문 비주얼 컨셉 1문장**을 생성하세요:

> 시각적 오브젝트/구조 + 배치 + 강조 요소를 구체적으로 묘사. 예:
> - `"Three circular nodes connected by directional arrows: left=Token Budget, center=Session Control (highlighted with accent ring), right=Thread Persistence. Minimal monochrome flow diagram."`
> - `"Split-panel comparison: left side shows fragmented code blocks (red tint), right side shows unified API layer (accent color). Clean flat-style diagram, no people."`

생성한 컨셉을 `VISUAL_CONCEPT` 변수에 저장하고 STEP 3에서 사용합니다.

**en_points가 없는 경우**: `VISUAL_CONCEPT`을 빈 문자열로 두고 STEP 3에서 `--visual-concept` 인수를 생략합니다.

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
  --visual-concept "$VISUAL_CONCEPT" \
  --output "output/<폴더>/images"
```
썸네일 + 인포그래픽 2종 생성. `--visual-concept`이 있으면 글 내용을 반영한 썸네일 생성.

**옵션 B — 프롬프트 출력** (직접 AI Studio에 입력):
```bash
node scripts/generate-images.js \
  --title "..." --keyword "$ARGUMENTS" \
  --points "핵심포인트1|||핵심포인트2|||핵심포인트3" \
  --en-points "$EN_POINTS" \
  --visual-concept "$VISUAL_CONCEPT" \
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
  - blog-writer가 SEO 자동 선택했을 경우: `제목: "{제목}" (SEO 점수 {score}/3, {패턴})` 형식으로 표시
  - 나머지 후보는 `metadata.json`의 `title_candidates[]` 참조 안내
- 품질검사 결과, 유사도 검사 결과
- 이미지 생성 여부 (자동 or 프롬프트 출력)
- 발행 전 확인 항목 (원문 링크·수치 사실 여부)
- 다음 단계: `/blog-preview <폴더>` 로 발행 어시스턴트 실행

## --interactive 플래그

STEP 1.5 각도 게이트에서 각 후보 각도의 핵심 주장 3줄과 Tier 출처를 상세 표시합니다.
새로운 키워드, 복잡한 주제, 또는 각도 선택이 중요한 상황에서 사용을 권장합니다.

**기본(플래그 없음)**: 한 줄 요약만 표시. `[Enter]` 한 번으로 주 각도 진행 (최소 마찰).
**`--interactive`**: 각 각도 상세 표시 후 응답 대기 (정확한 각도 선택이 필요할 때).
