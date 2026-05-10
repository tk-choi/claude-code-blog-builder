# Blog Pipeline Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미지 생성 브랜드명 기본값을 `taetae`로 변경하고, 최신 AI 뉴스를 다소스 수집해 포스팅 주제를 추천하는 `/blog-topics` 커맨드를 추가한다.

**Architecture:** Feature 1은 `generate-images.js` 1줄 수정. Feature 2는 기존 `blog-new → blog-researcher` 패턴을 따라 `blog-topics` 커맨드(흐름 제어)와 `blog-topic-discoverer` 에이전트(검색·분석 전담)를 분리해서 구현한다.

**Tech Stack:** Node.js 20+, Claude Code slash commands (`.claude/commands/*.md`), Claude Code agents (`.claude/agents/*.md`), Exa MCP, Claude Code 내장 WebSearch

---

## File Map

| 파일 | 작업 | 역할 |
|------|------|------|
| `scripts/generate-images.js` | Modify (line 53) | BRAND_NAME 기본값 변경 |
| `.claude/commands/blog-topics.md` | Create | `/blog-topics` 슬래시 커맨드 |
| `.claude/agents/blog-topic-discoverer.md` | Create | 다소스 수집·분석 전담 에이전트 |

---

## Task 1: Feature 1 — 브랜드명 기본값 변경

**Files:**
- Modify: `scripts/generate-images.js:53`

- [ ] **Step 1: 현재 상태 확인**

```bash
grep -n "YOUR BRAND\|BRAND_NAME" scripts/generate-images.js
```

Expected output:
```
53:const BRAND_NAME = process.env.BRAND_NAME || 'YOUR BRAND';
64:  `The only brand name shown is exactly "${BRAND_NAME}" — use this exact spelling and capitalization`,
```

- [ ] **Step 2: 기본값 변경**

`scripts/generate-images.js` 53번째 줄을 아래와 같이 수정:

```js
// 변경 전
const BRAND_NAME = process.env.BRAND_NAME || 'YOUR BRAND';

// 변경 후
const BRAND_NAME = process.env.BRAND_NAME || 'taetae';
```

- [ ] **Step 3: 변경 검증 — 프롬프트 출력으로 확인**

```bash
node scripts/generate-images.js \
  --title "테스트 글" \
  --keyword "AI 테스트" \
  --points "포인트1|||포인트2" \
  --output "/tmp/test-brand-images" \
  --prompt-only
```

Expected: `/tmp/test-brand-images/thumbnail_prompt.txt` 파일 생성

```bash
grep "taetae" /tmp/test-brand-images/thumbnail_prompt.txt && echo "OK: taetae 확인됨" || echo "FAIL: taetae 없음"
grep "taetae" /tmp/test-brand-images/infographic_prompt.txt && echo "OK: taetae 확인됨" || echo "FAIL: taetae 없음"
```

Expected output:
```
OK: taetae 확인됨
OK: taetae 확인됨
```

- [ ] **Step 4: BRAND_NAME 환경변수 우선 적용 확인**

```bash
BRAND_NAME="CustomBrand" node scripts/generate-images.js \
  --title "테스트" \
  --keyword "AI" \
  --points "p1" \
  --output "/tmp/test-brand-override" \
  --prompt-only

grep "CustomBrand" /tmp/test-brand-override/thumbnail_prompt.txt && echo "OK: 환경변수 우선 적용됨" || echo "FAIL"
```

Expected output: `OK: 환경변수 우선 적용됨`

- [ ] **Step 5: 커밋**

```bash
git add scripts/generate-images.js
git commit -m "fix: change BRAND_NAME default from 'YOUR BRAND' to 'taetae'

Constraint: BRAND_NAME env var takes precedence when set
Confidence: high
Scope-risk: narrow"
```

---

## Task 2: Feature 2a — blog-topic-discoverer 에이전트 생성

**Files:**
- Create: `.claude/agents/blog-topic-discoverer.md`

- [ ] **Step 1: 기존 에이전트 패턴 확인**

```bash
head -5 .claude/agents/blog-researcher.md
```

Expected (frontmatter 확인):
```
---
name: blog-researcher
description: ...
tools: Bash, Read, Write, WebSearch, Grep, Glob
---
```

- [ ] **Step 2: blog-topic-discoverer.md 생성**

`.claude/agents/blog-topic-discoverer.md` 파일을 아래 내용으로 생성:

````markdown
---
name: blog-topic-discoverer
description: 최신 AI 뉴스를 다소스(공식 블로그/AI 뉴스 미디어/Reddit) 수집·분석해 오늘 포스팅하면 좋은 주제 3개를 추천합니다. /blog-topics 커맨드에서 위임받아 실행됩니다.
tools: Read, WebSearch, Grep, Glob
---

당신은 AI 뉴스 토픽 발굴 담당입니다. 사용자와 직접 대화하지 않고, `/blog-topics` 커맨드의 위임을 받아 **주제 추천 결과만** 반환합니다.

## 목표

최신 AI 뉴스를 3개 소스에서 수집·분석하여, 오늘 포스팅하면 좋은 주제 3개를 구조화된 포맷으로 반환합니다.

## 수행 순서

### 1. 다소스 병렬 검색 (72시간 이내 뉴스 우선)

아래 3개 소스를 **동시에** 검색합니다.

**소스 A — 공식 블로그 (Exa MCP 우선, 없으면 WebSearch 폴백)**

Exa MCP가 설정된 경우:
- `mcp__exa__web_search_exa` 사용
- 쿼리: `site:openai.com OR site:anthropic.com OR site:blog.google OR site:ai.meta.com latest announcement 2026`
- 결과 5개 수집

Exa MCP 미설정 시:
- WebSearch 사용
- 쿼리: `OpenAI Anthropic Google Meta AI announcement news this week 2026`

**소스 B — AI 뉴스 미디어 (Exa MCP 우선, 없으면 WebSearch 폴백)**

Exa MCP가 설정된 경우:
- 쿼리: `AI LLM model release benchmark news VentureBeat TechCrunch TheVerge 2026`
- 결과 5개 수집

Exa MCP 미설정 시:
- WebSearch 사용
- 쿼리: `AI news this week site:techcrunch.com OR site:venturebeat.com`

**소스 C — Reddit 트렌드 (WebSearch)**

- WebSearch로 검색
- 쿼리: `reddit r/LocalLLaMA OR r/MachineLearning OR r/artificial hot posts this week AI`
- 화제성 높은 스레드 3~5개 확인

### 2. 뉴스 선별 기준

수집된 뉴스에서 아래 기준으로 상위 3개 주제 선정:

1. **신선도** — 72시간 이내 발표/화제 우선
2. **임팩트** — 모델 출시·기능 업데이트·벤치마크 등 실체 있는 뉴스 우선
3. **블로그 적합성** — AI에 관심 있는 개발자/직장인이 흥미로워할 것

### 3. 중복 제외

`output/_index.json` 파일이 존재하면 Read로 읽어서, 최근 7일 내 작성한 주제와 유사한 항목은 목록에서 제외합니다.

```
파일이 없으면 건너뜀 (에러 무시).
```

### 4. 결과 포맷 (반드시 이 구조로 반환)

```
[추천] 오늘 쓰면 좋은 AI 포스팅 주제

1. <주제 제목>
   왜 지금? <출처명>에서 <N>시간/일 전 발표, <화제성 지표 1줄>
   추천 각도: "<한 줄 각도 제안>"

2. <주제 제목>
   왜 지금? <출처명>에서 <N>시간/일 전 발표, <화제성 지표 1줄>
   추천 각도: "<한 줄 각도 제안>"

3. <주제 제목>
   왜 지금? <출처명>에서 <N>시간/일 전 발표, <화제성 지표 1줄>
   추천 각도: "<한 줄 각도 제안>"
```

### 5. 결과가 충분하지 않을 때

- 결과가 1~2개뿐이면: 있는 것만 포함해서 반환
- 72시간 이내 뉴스가 없으면: 최근 7일로 범위 확장 후 재검색
- 모든 소스에서 결과 없음: `[결과 없음] 현재 주목할 만한 AI 뉴스를 찾지 못했습니다.` 반환

## 주의

- 사용자에게 직접 질문하거나 대화하지 않습니다
- 결과 포맷 외 다른 내용(분석 과정, 중간 결과 등)은 출력하지 않습니다
- 글은 절대 작성하지 않습니다
````

- [ ] **Step 3: 파일 생성 확인**

```bash
head -5 .claude/agents/blog-topic-discoverer.md
```

Expected:
```
---
name: blog-topic-discoverer
description: 최신 AI 뉴스를 다소스(공식 블로그/AI 뉴스 미디어/Reddit) 수집·분석해 오늘 포스팅하면 좋은 주제 3개를 추천합니다. /blog-topics 커맨드에서 위임받아 실행됩니다.
tools: Read, WebSearch, Grep, Glob
---
```

- [ ] **Step 4: 커밋**

```bash
git add .claude/agents/blog-topic-discoverer.md
git commit -m "feat: add blog-topic-discoverer agent for multi-source AI news discovery

Confidence: high
Scope-risk: narrow"
```

---

## Task 3: Feature 2b — /blog-topics 커맨드 생성

**Files:**
- Create: `.claude/commands/blog-topics.md`

- [ ] **Step 1: 기존 커맨드 패턴 확인**

```bash
head -10 .claude/commands/blog-new.md
```

frontmatter 형식(description, argument-hint) 확인.

- [ ] **Step 2: blog-topics.md 생성**

`.claude/commands/blog-topics.md` 파일을 아래 내용으로 생성:

```markdown
---
description: 최신 AI 뉴스를 다소스 수집·분석해 오늘 포스팅하면 좋은 주제 3개를 추천합니다. 선택하면 /blog-new로 자동 연결됩니다.
---

최신 AI 뉴스를 분석해 오늘 쓰면 좋은 포스팅 주제를 추천합니다.

## 0. 사전 체크

`knowledge/brand-facts.md`를 Read로 읽어서 첫 줄이 `[PLACEHOLDER]`로 시작하면:
- "먼저 `/setup`을 실행해 블로그 정보를 설정해 주세요." 안내 후 중단.

## 1. 토픽 발굴

`blog-topic-discoverer` 에이전트에 위임합니다.

에이전트가 반환한 결과를 그대로 사용자에게 출력합니다.

**결과 없음** (`[결과 없음]`으로 시작하는 응답): 아래 메시지 출력 후 종료.

```
현재 주목할 만한 AI 뉴스를 찾지 못했습니다.
키워드를 직접 입력하려면: /blog-new "키워드"
```

**Exa MCP 미설정 안내**: 에이전트 결과에 WebSearch 전용 폴백 메시지가 포함된 경우, 사용자에게 아래를 추가 안내합니다.

```
💡 Exa MCP를 설정하면 더 정확한 뉴스 수집이 가능합니다.
```

## 2. 주제 선택

결과 출력 후 사용자 입력 대기:

```
선택 (1/2/3) 또는 [Enter]=취소:
```

**입력 처리:**

| 입력 | 동작 |
|------|------|
| `1` / `2` / `3` | 해당 주제로 `/blog-new "주제 제목" --interactive` 실행 |
| `Enter` / `x` / `취소` / `q` | "다음에 또 추천받으려면 `/blog-topics`를 실행하세요." 출력 후 종료 |
| 재검색 요청 (`다시` / `재검색`) | 에이전트 재실행 (최대 1회). 2회째 요청 시 "직접 키워드를 입력해 주세요: `/blog-new \"키워드\"`" 안내 후 종료 |
| 그 외 모호한 입력 | 가장 가까운 옵션 추정해 1회만 재확인. 무한 루프 금지 |

## 3. /blog-new 자동 실행

사용자가 번호를 선택하면, 해당 주제 제목으로 `/blog-new` 파이프라인을 시작합니다.

> 예시: 사용자가 `1` 선택 → "GPT-4.5 코딩 벤치마크 분석" 주제로 CLAUDE.md의 blog-new 파이프라인 전체(STEP 0~5) 실행.

`--interactive` 플래그를 사용하므로 STEP 1.5 각도 게이트에서 상세 각도가 표시됩니다.
```

- [ ] **Step 3: 파일 생성 확인**

```bash
grep -c "blog-topic-discoverer\|blog-new\|사전 체크" .claude/commands/blog-topics.md
```

Expected: `3` (3줄 이상 매칭)

- [ ] **Step 4: 커맨드 파일 목록 확인**

```bash
ls .claude/commands/
```

Expected: `blog-topics.md`가 목록에 포함되어 있어야 함.

- [ ] **Step 5: 커밋**

```bash
git add .claude/commands/blog-topics.md
git commit -m "feat: add /blog-topics command for AI news topic recommendation

Connects blog-topic-discoverer agent to /blog-new pipeline.
User selects from 3 recommended topics -> auto-runs /blog-new.

Confidence: high
Scope-risk: narrow"
```

---

## Task 4: 최종 검증

- [ ] **Step 1: 전체 파일 구조 확인**

```bash
ls .claude/commands/blog-topics.md .claude/agents/blog-topic-discoverer.md scripts/generate-images.js
```

Expected: 3개 파일 모두 존재

- [ ] **Step 2: generate-images.js 브랜드명 최종 확인**

```bash
grep "BRAND_NAME" scripts/generate-images.js | head -3
```

Expected:
```
const BRAND_NAME = process.env.BRAND_NAME || 'taetae';
```
(`'YOUR BRAND'` 가 없어야 함)

- [ ] **Step 3: 에이전트 frontmatter 유효성 확인**

```bash
head -6 .claude/agents/blog-topic-discoverer.md
```

Expected: `name`, `description`, `tools` 3개 필드 모두 존재

- [ ] **Step 4: 커맨드 내 에이전트 참조 확인**

```bash
grep "blog-topic-discoverer" .claude/commands/blog-topics.md
```

Expected: 에이전트 이름이 커맨드에 명시되어 있어야 함

- [ ] **Step 5: git log로 커밋 3개 확인**

```bash
git log --oneline -4
```

Expected: Task 1~3의 커밋 3개가 순서대로 표시

---

## 스펙 커버리지 확인

| 스펙 요구사항 | 구현 Task |
|-------------|----------|
| BRAND_NAME 기본값 `taetae` | Task 1 |
| BRAND_NAME 환경변수 우선 적용 | Task 1 Step 4 |
| 공식 블로그 소스 (Exa MCP) | Task 2 소스 A |
| AI 뉴스 미디어 소스 | Task 2 소스 B |
| Reddit 소스 (WebSearch) | Task 2 소스 C |
| 신선도·임팩트·적합성 선별 기준 | Task 2 Step 2 |
| 최근 7일 중복 제외 | Task 2 Step 3 |
| 추천 포맷 (주제+이유+각도) | Task 2 Step 4 |
| 결과 없을 때 처리 | Task 2 Step 5 |
| brand-facts placeholder 체크 | Task 3 Step 0 |
| Exa MCP 미설정 폴백 안내 | Task 3 Step 1 |
| 1/2/3 선택 → /blog-new 연결 | Task 3 Step 2 |
| 재검색 최대 1회 제한 | Task 3 Step 2 |
| --interactive 플래그 전달 | Task 3 Step 3 |
