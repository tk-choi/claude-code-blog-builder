# 명령어 상세 명세

> **이 문서의 목적**: 각 `/명령어`가 내부에서 어떤 순서로 동작하는지 이해하기 위한 레퍼런스.
> 실제 명령어 정의는 `.claude/commands/` 디렉토리의 `.md` 파일을 직접 확인할 것.

---

## 명령어 구조 개요

모든 명령어는 `.claude/commands/` 디렉토리의 `.md` 파일로 정의된다.

**파일 구조**:
```markdown
---
description: <명령어 설명>
argument-hint: <인자 힌트 (예: <키워드>)>
---

<명령어 실행 지시 (프롬프트 형식)>
```

Claude Code에서 `/명령어 인자` 입력 시 해당 파일의 내용이 Claude에게 전달되어 실행된다. `$ARGUMENTS`는 사용자가 입력한 인자로 치환된다.

---

## 설정 명령어

### `/setup`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/commands/setup.md` |
| **설명** | 블로그 자동화 시스템 초기 셋업 (5분 인터뷰 → `brand-facts.md` 자동 생성) |
| **인자** | 없음 |
| **사전 조건** | 없음 (처음 사용 시) |

**실행 흐름**:
```
/setup 호출
  │
  ├─ [사전 체크] knowledge/brand-facts.md 존재 여부 확인
  │     └─ 이미 존재 시 → 사용자에게 덮어쓰기 확인
  │
  └─ setup-interviewer 에이전트 호출 (Phase 1)
        │
        ├─ Q1~Q6 순서대로 질문 (한 번에 하나씩)
        │   (블로그명/필명, 소개, 주력 주제, 스타일, 독자, 금지 단어)
        │
        └─ 완료 후 자동 실행:
              ├─ knowledge/brand-facts.template.md 읽기
              ├─ 답변으로 placeholder 치환
              ├─ knowledge/brand-facts.md 저장
              ├─ knowledge/banned-words.json 도메인 단어 추가
              └─ 다음 단계 안내 (A: /blog-new / B: /setup-tone / C: /setup-domain)
```

---

### `/setup-tone`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/commands/setup-tone.md` |
| **설명** | 블로그 URL에서 실제 글 본문을 수집해 톤 학습 |
| **인자** | 없음 (인터뷰에서 URL 수집) |
| **사전 조건** | `/setup` 완료 필수 |

**실행 흐름**:
```
/setup-tone 호출
  │
  └─ setup-interviewer 에이전트 호출 (Phase 2)
        │
        ├─ URL 3~5개 입력받기
        ├─ URL 형식 검증
        │
        └─ 자동 실행:
              node scripts/setup-tone-fetch.js \
                --urls "URL1,URL2,URL3" \
                --output "knowledge/tone-samples/real-blog-posts.txt"
              │
              ├─ 수집 결과 확인 (목표 80KB+)
              └─ 시그니처 문장 5개 추출 → 사용자 검증
```

---

### `/setup-domain`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/commands/setup-domain.md` |
| **설명** | 카테고리별 키워드뱅크·금칙어·이미지 시스템 설정 |
| **인자** | 없음 |
| **사전 조건** | `/setup` 완료 필수 |

**실행 흐름**:
```
/setup-domain 호출
  │
  └─ setup-interviewer 에이전트 호출 (Phase 3)
        │
        ├─ knowledge/brand-facts.md에서 주력 주제 읽기
        │
        ├─ 주제별 순회 (각 주제당):
        │     ├─ Q1: 주요 키워드 5~10개 → keyword-bank/{slug}.yml 생성
        │     └─ Q2: 피해야 할 표현 → banned-words.json 추가
        │
        └─ 이미지 디자인 시스템 (선택):
              ├─ 브랜드 컬러 3개 (배경/메인/포인트, hex)
              └─ .env 파일에 BRAND_NAME, BRAND_BG_COLOR, BRAND_FG_COLOR, BRAND_ACCENT 저장
```

---

## 글 생성 명령어

### `/blog-new`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/commands/blog-new.md` |
| **설명** | AI 뉴스 주제 하나로 블로그 글 패키지 풀 파이프라인 실행 |
| **인자** | `<키워드>` (예: `/blog-new "Claude 4.5 출시"`) |
| **사전 조건** | `/setup` 완료 필수 |

**실행 흐름** (가장 중요한 명령어):

```
/blog-new "AI 뉴스 주제"
  │
  ├─ [사전 체크] knowledge/brand-facts.md placeholder 확인
  │     └─ placeholder 상태 → 중단 + /setup 안내
  │
  ├─ [STEP 0] 사전 로드
  │     ├─ knowledge/brand-facts.md
  │     ├─ knowledge/tone-samples/real-blog-posts.txt (있을 경우)
  │     ├─ knowledge/patterns/writing-playbook.txt (있을 경우)
  │     ├─ knowledge/banned-words.json
  │     └─ output/_index.json (있을 경우)
  │
  ├─ [STEP 1] blog-researcher 에이전트
  │     └─ Exa MCP → WebSearch → research.js(선택) 순서로 리서치
  │
  ├─ [STEP 2] blog-writer 에이전트
  │     ├─ post.md 작성 (1,500~2,000자, 뉴스 배경→요약→해석→링크)
  │     ├─ post.html 작성 (Tistory 에디터용)
  │     └─ metadata.json 저장
  │           │
  │           │ [PostToolUse 훅 자동 발사 — post.md 저장 시]
  │           ▼
  │     hook-post-write.js
  │       ├─ quality-check.js (7항목)
  │       └─ duplicate-check.js (6-gram Jaccard)
  │
  ├─ [STEP 3] generate-images.js
  │     ├─ GEMINI_API_KEY 있을 경우: 2 PNG 자동 생성 (thumbnail, infographic)
  │     └─ 없을 경우: --prompt-only → 프롬프트 txt 파일 출력
  │
  └─ [STEP 5] 최종 패키지
        ├─ guide.md 작성 (편집 가이드 + 원문 사실확인 체크리스트)
        └─ output/_index.json 업데이트 (새 글 항목 추가)

완료 후 보고:
  - 제목 / 글자수 / 원문 출처
  - 품질검사 결과 / 유사도 결과
  - 이미지 생성 여부 (자동 or 프롬프트 출력)
  - 발행 전 확인 항목 (원문 링크·수치 사실 여부)
  - 다음 단계: /blog-preview <폴더>
```

---

### `/blog-research`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/commands/blog-research.md` |
| **설명** | AI 뉴스 리서치만 실행 (글 작성 없음) |
| **인자** | `<키워드>` |

**실행 흐름**:
```
/blog-research "AI 뉴스 주제"
  │
  ├─ Exa MCP / WebSearch / research.js 순서로 리서치
  │
  └─ 리서치 브리프 출력:
        - 선택한 뉴스 (제목, 출처, URL)
        - 핵심 포인트 3~5개
        - 해석 각도 제안
        - 추천 제목 후보

※ 글 작성 안함. "써줘"라고 할 때 /blog-new로 진행.
```

---

## 품질·검증 명령어

### `/blog-quality`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/commands/blog-quality.md` |
| **설명** | 특정 글 폴더의 품질검사·유사도검사 재실행 |
| **인자** | `<폴더명 또는 경로>` |

**실행 흐름**:
```
/blog-quality "2026-05-05_claude45"
  │
  ├─ 경로 추정: "폴더명" → "output/폴더명/post.md"
  │
  ├─ quality-check.js 실행
  ├─ duplicate-check.js 실행
  │
  └─ 표 형식 결과 보고:
        - 전 항목 PASS/WARN 상태
        - 유사도 상위 3건
        - 경고 시 수정 방향 제안 (수정은 하지 않음)
```

---

### `/blog-preview`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/commands/blog-preview.md` |
| **설명** | 발행 어시스턴트 HTML 생성 + 브라우저 오픈 |
| **인자** | `<폴더명 또는 경로>` |

**실행 흐름**:
```
/blog-preview "2026-05-05_claude45"
  │
  ├─ preview.js 실행:
  │     node scripts/preview.js --folder "output/..."
  │
  └─ 브라우저 자동 오픈 + 사용자 안내:
        "제목부터 차례로 복사해 Tistory 에디터에 붙여넣으세요."
```

---

### `/blog-publish-ready`

| 항목 | 내용 |
|------|------|
| **파일** | `.claude/commands/blog-publish-ready.md` |
| **설명** | 발행 직전 최종 체크리스트 |
| **인자** | `<폴더명>` |

**실행 흐름**:
```
/blog-publish-ready "2026-05-05_claude45"
  │
  ├─ [1] 원문 링크 포함 확인
  ├─ [2] 금칙어·최상급: banned-words.json 로드 → 탐지
  ├─ [3] 이미지 2장 존재 + 크기 확인
  ├─ [4] 외부 링크 ≤ 3개: post.html에서 http/https 탐지
  ├─ [5] quality-check.js 재실행
  ├─ [6] duplicate-check.js 재실행
  ├─ [7] metadata.json 존재 확인
  ├─ [8] guide.md 존재 확인
  └─ [9] output/_index.json 반영 확인

최종 보고:
  - 전 항목 PASS/FAIL/REVIEW 표 출력
  - FAIL 항목 수정 방향 제안
  - 전체 PASS → "Tistory 에디터에서 수동 업로드하세요" 안내
```

---

## 명령어 관계 맵

```
설정 흐름:
  /setup → /setup-tone → /setup-domain

글 생성 흐름:
  /blog-research (선택, 사전 조사)
      ↓
  /blog-new (메인 파이프라인)
      ↓
  /blog-quality (재검사, 필요 시)
      ↓
  /blog-preview (발행 어시스턴트)
      ↓
  /blog-publish-ready (최종 체크)
```

---

## 명령어 커스터마이징

명령어 수정 시 `.claude/commands/<name>.md` 파일을 직접 편집한다.

**`$ARGUMENTS` 사용**: 사용자가 입력한 인자를 그대로 사용하려면 `$ARGUMENTS` 플레이스홀더를 사용.

**에이전트 호출 추가**: "xxx 서브에이전트를 호출합니다" 형식으로 작성하면 Claude가 해당 에이전트를 실행.

**스크립트 호출 추가**: 코드 블록으로 bash 명령어를 명시하면 Claude가 해당 스크립트를 실행.
