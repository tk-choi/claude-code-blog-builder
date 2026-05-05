# 에이전트 상세 명세

> **이 문서의 목적**: 에이전트를 수정·추가하려는 개발자를 위한 레퍼런스.
> 실제 프롬프트 전문은 `.claude/agents/` 파일을 직접 확인할 것.

---

## 에이전트 구조 개요

모든 에이전트는 `.claude/agents/` 디렉토리의 `.md` 파일로 정의된다.

**파일 구조**:
```markdown
---
name: <에이전트 이름>
description: <에이전트 설명 — Claude가 호출 시점을 판단하는 데 사용>
tools: <사용 가능한 도구 목록>
---

<프롬프트 본문>
```

**`description` 필드 중요성**: Claude Code가 이 필드를 읽고 어떤 상황에서 에이전트를 호출할지 자동 판단한다. 명확하고 구체적으로 작성해야 한다.

---

## 에이전트 목록

### 1. `blog-researcher`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/agents/blog-researcher.md` |
| **역할** | AI 뉴스 리서치 전문. 글은 쓰지 않고 리서치만 수행 |
| **Tools** | `Bash, Read, Write, WebSearch, Grep, Glob` |
| **호출 시점** | `/blog-new` (STEP 1), `/blog-research` |
| **Input** | 키워드/주제 문자열 |
| **Output** | 리서치 브리프 (markdown) |

**내부 수행 순서**:
1. **1순위 — Exa MCP** (`mcp__exa__web_search_exa`): 최신 AI 뉴스 검색
2. **2순위 — WebSearch**: Exa 불가 시 폴백
3. **3순위 — Naver API** (`research.js`): 선택, API 키 없으면 건너뜀
4. 뉴스 선별 (최근 7일 이내, 주요 AI 회사 발표 우선)
5. 핵심 포인트 3~5개 추출
6. 해석 각도 2~3개 제안 (개발자 관점 / 업계 동향 / 한국 독자 관점)

**출력 형식** (리서치 브리프):
```markdown
# 리서치 브리프: <키워드>
## 선택한 뉴스 (제목, 출처, URL, 발행일)
## 핵심 내용 (3~5개)
## 기술적 수치/비교
## 해석 각도 제안 (2~3개)
## 인포그래픽 포인트 (3~5개)
## 추천 제목 후보 (3개)
## 작성 시 주의 (확인된 사실 / 확인 필요)
```

---

### 2. `blog-writer`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/agents/blog-writer.md` |
| **역할** | 학습자 관점의 AI 뉴스 요약+해석 글 작성. 품질검사는 훅에 위임 |
| **Tools** | `Read, Write, Edit, Bash, Grep` |
| **호출 시점** | `/blog-new` (STEP 2) |
| **Input** | 리서치 브리프 (blog-researcher 출력) |
| **Output** | `post.md`, `post.html`, `metadata.json` (제목·태그·메타설명·**`en_points`** 포함) |

**글쓰기 전 필수 로드 파일** (이 순서대로):
1. `knowledge/brand-facts.md` — 블로거 정보·톤 (SSoT)
2. `knowledge/tone-samples/real-blog-posts.txt` — 문체 학습 (있을 경우)
3. `knowledge/banned-words.json` — 금칙어
4. `output/_index.json` — 최근 패턴 확인 (있을 경우)

**글쓰기 구조**:
```
1. 뉴스 배경 (2~3문장)
2. 핵심 내용 요약 (bullet 또는 표)
3. 기술적 포인트 (선택)
4. 내 해석/시사점 (학습자 관점)
5. 마무리 + 원문 링크
```

**핵심 제약**:
- **원문 링크 필수**: `**원문**: [제목](URL)` 형식으로 반드시 포함
- 본문 1,500~2,000자, 메인 키워드 2~5회 자연 삽입
- `[IMAGE: 설명]` 마커 최소 2개 (썸네일용, 인포그래픽용)
- 외부 링크 ≤ 3개, 금칙어 0건, 표 ≥ 1개
- 확인되지 않은 수치 사용 금지 (원문 수치만)
- `metadata.json`에 영어 핵심 포인트(`en_points: string[]`, 각 5~10 단어, 3~5개) 포함 — `generate-images.js`의 `--en-points`로 전달됨

**브랜드팩트 미완성 감지**: `brand-facts.md`가 `[PLACEHOLDER]`로 시작하면 글 작성 중단 + `/setup` 실행 안내.

---

### 3. `blog-quality-reviewer`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/agents/blog-quality-reviewer.md` |
| **역할** | 작성 완료된 글의 품질·톤 일치도·SEO 종합 리뷰 (사람 눈높이) |
| **Tools** | `Read, Bash, Grep` |
| **호출 시점** | `/blog-new` (STEP 2 이후), `/blog-quality` |
| **Input** | `post.md` 경로 + 키워드 |
| **Output** | 품질 리뷰 리포트 (markdown) |

**검사 순서**:
1. `quality-check.js` 실행 (자동 7항목)
2. `duplicate-check.js` 실행
3. `knowledge/brand-facts.md` 로드 (톤·블로거 관점 확인)
4. 본문 직접 읽고 10개 항목 평가

**10개 평가 항목** (각 1~10점):

| # | 항목 | 합격 기준 |
|---|------|----------|
| 1 | 원문 링크 포함 | 원문 출처 URL 명시 (없으면 0점) |
| 2 | 학습자 관점 명확성 | 개인 의견이 "제 생각에는" 등으로 명확히 표현 |
| 3 | 뉴스 배경 설명 | 뉴스가 왜 나왔는지 맥락 설명 있음 |
| 4 | 뉴스 요약+해석 구조 | 배경→요약→해석→링크 흐름 자연스러움 |
| 5 | 패턴 정합성 | metadata.json에 선언한 구조대로 작성 |
| 6 | 문체 변주 | 어미·문장길이·전환어 반복 없음 |
| 7 | 접근성 | 어려운 기술 개념을 쉽게 풀어 설명 |
| 8 | 표·볼드 활용 | 핵심 정보가 볼드/표로 시각화 |
| 9 | 독자 공감/시사점 | "왜 이게 중요한가"가 명확 |
| 10 | 금칙어·원문링크 | 자동검사 결과 + 원문링크 확인 |

**판정 기준**: PASS(≥80점) / HOLD(65~79점) / FAIL(<65점)

**규칙**: 직접 고치지 말고 지적만 수행.

---

### 4. `setup-interviewer`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/agents/setup-interviewer.md` |
| **역할** | 개인 블로거 정보 인터뷰 → `knowledge/brand-facts.md` 자동 작성 |
| **Tools** | `Read, Write, Edit, Bash` |
| **호출 시점** | `/setup` (Phase 1), `/setup-tone` (Phase 2), `/setup-domain` (Phase 3) |
| **Input** | 없음 (인터랙티브 인터뷰) |
| **Output** | `knowledge/brand-facts.md`, `knowledge/banned-words.json`, `knowledge/tone-samples/real-blog-posts.txt` |

**핵심 원칙**:
1. 한 번에 한 질문만 (6개를 한꺼번에 보여주기 금지)
2. 모든 답변에 형식/길이 검증
3. 추정 금지 — 사용자가 답한 값만 사용
4. 기업 정보 질문 절대 금지 (회사명, 매출, 팀규모, 인증서 등)

**Phase 1 질문 목록** (순서대로):
1. 블로그명 / 필명
2. 블로그 한 줄 소개
3. 주력 AI 주제 (1~3개)
4. 글쓰기 스타일 / 톤
5. 주요 독자
6. 금지 단어 (선택)

---

## 에이전트 커스터마이징 가이드

### 기존 에이전트 수정

1. `.claude/agents/<name>.md` 파일을 직접 편집
2. `description` 필드: Claude의 자동 호출 판단에 사용 — 명확하게 유지
3. `tools` 필드: 필요한 도구만 유지 (불필요한 권한 최소화)
4. 프롬프트 본문: 철칙(규칙)과 예외 조건을 명시적으로 작성

### 새 에이전트 추가

```markdown
---
name: my-new-agent
description: <언제 이 에이전트를 호출해야 하는지 한 줄 설명>
tools: Read, Write, Bash
---

당신은 ... 역할입니다.

## 수행 절차
1. ...
2. ...

## 출력
- ...
```

파일을 `.claude/agents/my-new-agent.md`로 저장하면 즉시 사용 가능.

### 체크리스트 (에이전트 추가 후)

- [ ] `name` 필드가 파일명과 일치
- [ ] `description`이 호출 시점을 명확히 설명
- [ ] `tools` 필드에 실제 사용하는 도구만 포함
- [ ] 관련 명령어(`.claude/commands/*.md`)에서 호출 코드 추가
- [ ] `knowledge/brand-facts.md` 읽는 규칙이 있다면 포함 (SSoT 원칙 유지)

---

## 에이전트 간 관계 다이어그램

```
/blog-new 명령어
    │
    ├─ [STEP 1] blog-researcher
    │       └─ Exa MCP / WebSearch / research.js 호출
    │
    ├─ [STEP 2] blog-writer
    │       ├─ knowledge/ 파일 읽기
    │       ├─ post.md 저장 → [자동 훅] quality-check + duplicate-check
    │       └─ metadata.json.en_points → STEP 3 generate-images.js --en-points
    │
    └─ [독립] setup-interviewer ← /setup, /setup-tone, /setup-domain
```
