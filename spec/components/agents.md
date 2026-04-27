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

**`tools` 필드**: 에이전트가 사용할 수 있는 Claude Code 도구 목록. 불필요한 도구는 제외해 보안·범위를 좁힌다.

---

## 에이전트 목록

### 1. `blog-researcher`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/agents/blog-researcher.md` |
| **역할** | 키워드 리서치 전문. 글은 쓰지 않고 리서치만 수행 |
| **Tools** | `Bash, Read, Write, WebSearch, Grep, Glob` |
| **호출 시점** | `/blog-new` (STEP 1), `/blog-research` |
| **Input** | 키워드 문자열 |
| **Output** | `output/폴더/research.json` + 리서치 브리프 (markdown) |

**내부 수행 순서**:
1. `research.js` 실행 (Naver API)
2. API 실패 시 `WebSearch`로 대체
3. 경쟁도 판정 (높음/보통/낮음)
4. 독자 의도 분류 (무관심/관심/비교/결정)
5. 적합 패턴 추천 (12종 중 2~3개)
6. 롱테일 키워드 5~8개 제안
7. `output/_index.json`의 `recent_rotation` 확인 → 중복 패턴 회피

**읽는 파일**: `knowledge/patterns/writing-playbook.txt`, `output/_index.json`

**출력 형식** (리서치 브리프):
```markdown
# 리서치 브리프: <키워드>
## 경쟁도 / ## 독자 의도 / ## 추천 패턴
## 롱테일 키워드 후보 / ## 최근 글과의 충돌
## 경쟁 글 요약 / ## 작성 시 주의
```

---

### 2. `blog-writer`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/agents/blog-writer.md` |
| **역할** | 브랜드 톤을 지키며 post.md / post.html 작성. 품질검사는 훅에 위임 |
| **Tools** | `Read, Write, Edit, Bash, Grep` |
| **호출 시점** | `/blog-new` (STEP 2) |
| **Input** | 리서치 브리프 (blog-researcher 출력) |
| **Output** | `post.md`, `post.html`, `metadata.json` |

**글쓰기 전 필수 로드 파일** (이 순서대로):
1. `knowledge/brand-facts.md` — 사용 가능 수치 (SSoT)
2. `knowledge/tone-samples/real-blog-posts.txt` — 문체 학습
3. `knowledge/patterns/writing-playbook.txt` — 패턴 구조 (있을 경우)
4. `knowledge/conversion-benchmarks.md` — 수치 인용 시
5. `output/_index.json` — 최근 패턴 확인

**핵심 제약**:
- `brand-facts.md`에 없는 수치 사용 금지 (픽션 금지)
- 도입부 4줄 공식: 문제 → 손실 → 자격 → 끝까지 읽으면 얻을 것
- A.E.A 구조 필수
- `[IMAGE: 설명]` 마커 ≥ 4개 삽입
- 외부 링크 0건, 금칙어 0건, 표 ≥ 1개

**브랜드팩트 미완성 감지 규칙**: `brand-facts.md`가 `[PLACEHOLDER]`로 시작하면 글 작성 중단 + 사용자에게 `/setup` 실행 안내.

---

### 3. `blog-quality-reviewer`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/agents/blog-quality-reviewer.md` |
| **역할** | 작성 완료된 글의 품질·톤 일치도·SEO 종합 리뷰 (사람 눈높이) |
| **Tools** | `Read, Bash, Grep` |
| **호출 시점** | `/blog-new` (STEP 4 이후), `/blog-quality` |
| **Input** | `post.md` 경로 + 키워드 |
| **Output** | 품질 리뷰 리포트 (markdown) |

**검사 순서**:
1. `quality-check.js` 실행 (자동 7항목)
2. `duplicate-check.js` 실행
3. `knowledge/tone-samples/real-blog-posts.txt` 재로드 (톤 비교)
4. `knowledge/brand-facts.md` 로드 (수치 검증)
5. 본문 직접 읽고 10개 항목 평가

**10개 평가 항목** (각 1~10점):

| # | 항목 | 합격 기준 |
|---|------|----------|
| 1 | 수치 정확성 | brand-facts.md 수치만 사용 |
| 2 | 시그니처 톤 일치도 | tone-samples 시그니처 표현 ≥ 2개 |
| 3 | 도입부 4줄 공식 | 문제·손실·자격·얻을 것 모두 |
| 4 | A.E.A 구조 | 3층 명확 |
| 5 | 패턴 정합성 | metadata.json 선언 패턴과 일치 |
| 6 | 문체 변주 | 어미·문장길이·전환어 반복 없음 |
| 7 | 구어체 자연스러움 | 회사 톤 기준 |
| 8 | 표·볼드 활용 | 핵심 정보 시각화 |
| 9 | CTA 자연스러움 | 선택권 주는 톤 |
| 10 | 금칙어·외부링크 | 0건 |

**판정 기준**: PASS(≥85점) / HOLD(70~84점) / FAIL(<70점)

**규칙**: 직접 고치지 말고 지적만 수행.

---

### 4. `medical-law-checker`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/agents/medical-law-checker.md` |
| **역할** | 의료법·표시광고 위반 표현 탐지 |
| **Tools** | `Read, Grep, Bash` |
| **호출 시점** | `/blog-new`(조건부), `/blog-publish-ready`(조건부), `/blog-quality`(조건부) |
| **Input** | `post.md` 경로 |
| **Output** | 의료법 검사 리포트 |

**자동 발동 조건**: 키워드에 아래 단어 포함 시
- 병원, 의원, 치과, 한의원, 피부과, 성형외과
- 필러, 보톡스, 리프팅, 레이저, 임플란트, 교정
- 시술, 수술, 처방, 진료, 효과
- 다이어트, 탈모, 모발이식

**5개 위반 패턴 카테고리**:
1. 과장·단정 표현 ("100% 효과", "부작용 없음", "기적의")
2. 비교·우위 표현 ("다른 병원보다 ~배", "1위", "TOP")
3. 환자 유인 표현 (할인·이벤트 강조, "저렴한 가격", "선착순")
4. 치료 효과 단정 ("낫는다", "완치", "근본 치료")
5. 전문의 사칭/비교 ("명의", "권위자")

**검사 방식**: Grep 정규식으로 위반 표현 위치(라인 번호) 탐지 → 대체 문구 제안

**원칙**: "의심스러우면 FAIL". 직접 수정 불가, 지적과 대체 제안만.

---

### 5. `setup-interviewer`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/agents/setup-interviewer.md` |
| **역할** | 사용자 회사 정보 인터뷰 → `knowledge/brand-facts.md` 자동 작성 |
| **Tools** | `Read, Write, Edit, Bash` |
| **호출 시점** | `/setup` (Phase 1), `/setup-tone` (Phase 2), `/setup-domain` (Phase 3) |
| **Input** | 없음 (인터랙티브 인터뷰) |
| **Output** | `knowledge/brand-facts.md`, `knowledge/banned-words.json`, `knowledge/tone-samples/real-blog-posts.txt` |

**핵심 원칙**:
1. 한 번에 한 질문만 (7개를 한꺼번에 보여주기 금지)
2. 모든 답변에 형식/길이/모순 검증
3. 추정 금지 — 사용자가 답한 값만 사용
4. 특정 회사명/수치를 예시로 들기 금지 (외부 공개판)

---

## 에이전트 커스터마이징 가이드

### 기존 에이전트 수정

1. `.claude/agents/<name>.md` 파일을 직접 편집
2. `description` 필드: Claude의 자동 호출 판단에 사용 — 명확하게 유지
3. `tools` 필드: 필요한 도구만 유지 (불필요한 권한 최소화)
4. 프롬프트 본문: 철칙(규칙)과 예외 조건을 명시적으로 작성

**수정 시 주의사항**:
- `blog-writer.md`의 철칙(금칙어 0건, 외부링크 0건 등)을 제거하면 `quality-check.js` FAIL이 자동 발생
- `brand-facts.md` 체크 로직 제거 시 픽션 데이터 삽입 위험

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

### 명령어에서 에이전트 호출

`.claude/commands/` 파일에서 에이전트 호출 방법:
```
`my-new-agent` 서브에이전트를 호출합니다.
```
또는 CLAUDE.md의 에이전트 호출 패턴을 참조.

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
    │       └─ research.js 호출
    │
    ├─ [STEP 2] blog-writer
    │       ├─ knowledge/ 파일 읽기
    │       └─ post.md 저장 → [자동 훅] quality-check + duplicate-check
    │
    ├─ [STEP 4, 조건부] blog-quality-reviewer
    │       └─ [의료/뷰티 키워드] medical-law-checker
    │
    └─ [독립] setup-interviewer ← /setup, /setup-tone, /setup-domain
```
