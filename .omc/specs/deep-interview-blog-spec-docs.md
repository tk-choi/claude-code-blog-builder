# Deep Interview Spec: Blog Builder 프로젝트 Spec 문서화

## Metadata
- Interview ID: di-blog-spec-2026
- Rounds: 4
- Final Ambiguity Score: 15.7%
- Type: brownfield
- Generated: 2026-04-27
- Threshold: 0.20
- Initial Context Summarized: no
- Status: PASSED

---

## Clarity Breakdown

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.87 | 35% | 0.305 |
| Constraint Clarity | 0.88 | 25% | 0.220 |
| Success Criteria | 0.78 | 25% | 0.195 |
| Context Clarity | 0.82 | 15% | 0.123 |
| **Total Clarity** | | | **0.843** |
| **Ambiguity** | | | **15.7%** |

---

## Goal

`claude-code-blog-builder` 프로젝트의 현재 구조·워크플로우·파이프라인·기술스택·구현 방법을 영역별 Markdown 문서로 상세화하여 `spec/` 최상위 디렉토리에 일괄 관리한다. 문서의 목적은 새로운 Claude Code 세션이 읽었을 때 핵심 요소(특히 에이전트/프롬프트 구조)를 즉시 파악하고, 나만의 블로그 워크플로우로 수정·개선할 수 있도록 하는 것이다.

---

## Constraints

- **디렉토리**: 프로젝트 루트의 `spec/` (최상위 독립 폴더, docs/와 별개)
- **문서 구조**: 하이브리드 방식
  - 전체 조감 문서 1개 (`README.md`)
  - 아키텍처 문서 1개 (`architecture.md`)
  - 파이프라인 문서 1개 (`pipeline.md`)
  - 컴포넌트 세부 문서 (`components/` 하위 폴더)
- **에이전트 문서 깊이**: 구조/역할 중심. 실제 프롬프트 전문은 `.claude/agents/` 파일 직접 참조 방식 (문서에 복사 ✗)
- **주요 독자**: 새 Claude Code 세션 (CLAUDE.md + spec/ 읽고 즉시 작업 착수)
- **주요 수정 타깃**: 에이전트/프롬프트 커스터마이징 → agents.md·commands.md 섹션 깊이 우선

---

## Non-Goals

- 실제 프롬프트 내용을 문서에 그대로 복사하지 않음 (`.claude/agents/` 파일이 원본)
- `docs/` 폴더 내용 수정 또는 통합 ✗
- 새 기능 구현 계획 문서 ✗ (현재 상태(as-is) 문서화가 목적)
- 사용자 가이드/튜토리얼 형식 ✗ (개발자 레퍼런스 형식)

---

## Acceptance Criteria

- [ ] `spec/` 폴더가 프로젝트 루트에 생성됨
- [ ] `spec/README.md`: 전체 문서 지도 + 5분 요약 (새 세션 진입점)
- [ ] `spec/architecture.md`: 전체 구조 + 설계 원칙 + 데이터 흐름 다이어그램
- [ ] `spec/pipeline.md`: 5단계 파이프라인 end-to-end (각 STEP 상세, 입출력, 트리거 조건)
- [ ] `spec/components/scripts.md`: 7개 스크립트 각각 (목적, I/O, 알고리즘, API 호출 방식)
- [ ] `spec/components/agents.md`: 5개 에이전트 각각 (역할, 호출 시점, 읽는 파일, 출력, 다른 에이전트와의 관계) + 에이전트 커스터마이징 방법 안내
- [ ] `spec/components/commands.md`: 8개 `/명령어` 각각 (사용법, 내부 흐름, 어떤 에이전트를 어떤 순서로 호출하는지)
- [ ] `spec/components/knowledge-system.md`: `knowledge/` SSoT 설계 + 각 파일 역할 + brand-facts.md 작성 원칙
- [ ] 새 세션이 `spec/README.md`만 읽어도 어디서 무엇을 찾을지 알 수 있음
- [ ] 에이전트를 추가하거나 수정하는 방법이 `agents.md`에 명시됨

---

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 문서를 한 단위로 쪼개는 기준이 파이프라인 단계일 것 | 컴포넌트 레이어별이 더 자연스러울 수 있음 | **하이브리드** 선택: overview + pipeline + components/ |
| 에이전트 프롬프트를 문서에 복사해야 할 것 | 실제 파일이 원본 — 복사하면 이중 관리 문제 발생 | **구조/역할만 문서화**, 프롬프트는 파일 직접 참조 |
| docs/ 하위에 두는 게 자연스러울 것 | 기존 docs/는 사용자 가이드 성격 — spec은 개발자 레퍼런스 | **spec/ 최상위 독립** 디렉토리 |
| 모든 컴포넌트가 동등한 깊이의 문서가 필요할 것 | 수정 목표에 따라 깊이 우선순위가 다름 | **agents.md, commands.md 우선** (에이전트 커스터마이징 목표) |

---

## Technical Context (Brownfield Codebase)

### 핵심 파일 위치 (문서화 대상)

| 영역 | 경로 | 문서 매핑 |
|------|------|-----------|
| 에이전트 정의 | `.claude/agents/*.md` | `spec/components/agents.md` |
| 명령어 정의 | `.claude/commands/*.md` | `spec/components/commands.md` |
| 훅 설정 | `.claude/settings.json` | `spec/pipeline.md` (STEP 4 자동훅) |
| 스크립트 | `scripts/*.js` | `spec/components/scripts.md` |
| 브랜드 지식 | `knowledge/` | `spec/components/knowledge-system.md` |
| 이미지 템플릿 | `templates/*.html` | `spec/components/scripts.md` (generate-images) |
| 키워드 뱅크 | `keyword-bank/*.yml` | `spec/pipeline.md` (STEP 1 인풋) |

### 기술스택 요약
- **런타임**: Node.js 20+ (ES6 modules, `"type": "module"`)
- **외부 의존성**: 없음 (npm install 불필요)
- **API**: Naver Search API (optional, fallback 존재), Gemini 3 Pro Image (required)
- **자동화**: `.claude/settings.json` PostToolUse 훅 → `hook-post-write.js` → quality-check + duplicate-check

### 파이프라인 트리거 맵
```
/blog-new <keyword>
  ├── blog-researcher → research.js (Naver API 또는 WebSearch)
  ├── blog-writer → reads: brand-facts.md, tone-samples, banned-words.json
  │    └── post.md 저장 → [PostToolUse 훅 자동발사]
  │         ├── quality-check.js (7항목 검사)
  │         └── duplicate-check.js (6-gram Jaccard)
  │              └── [의료/뷰티 키워드] → medical-law-checker
  ├── generate-images.js → Gemini API → 4 PNG
  └── preview.js → self-contained HTML
```

---

## Spec 문서 구조 (실행 타깃)

```
spec/
├── README.md                        # 진입점: 문서 지도 + 5분 요약
├── architecture.md                  # 전체 구조 + 설계 원칙 + 데이터 흐름
├── pipeline.md                      # 5단계 파이프라인 end-to-end
└── components/
    ├── scripts.md                   # 7개 스크립트 상세
    ├── agents.md                    # 5개 에이전트 + 커스터마이징 가이드 ★우선
    ├── commands.md                  # 8개 /명령어 흐름 ★우선
    └── knowledge-system.md          # knowledge/ SSoT 설계
```

---

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Document | core domain | title, content, area, format | Document belongs to Directory |
| Directory | core domain | name, path, location | Directory contains Documents |
| Pipeline | supporting | phases[], sequence, triggers | Pipeline consists of Steps |
| Component | supporting | type, role, implementation | Component is part of Pipeline |
| Agent | core domain | role, input, output, prompt_file | Agent is invoked by Command, Agent reads Knowledge |
| PromptPattern | supporting | structure, key_params, writing_rules | PromptPattern defines Agent behavior |
| NewSession | external system | reads_docs, understands_specs | NewSession reads Document |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 5 | 5 | - | - | N/A |
| 2 | 7 | 2 (Agent, Prompt) | 0 | 5 | 71% |
| 3 | 7 | 0 | 1 (Prompt→PromptPattern) | 6 | 100% |
| 4 | 7 | 0 | 0 | 7 | 100% |

도메인 모델은 Round 3부터 완전 수렴.

---

## Interview Transcript

<details>
<summary>Full Q&A (4 rounds)</summary>

### Round 1
**Q:** 문서를 어떤 단위로 쪼개서 관리하고 싶으신가요?
**A:** 개요+파이프라인+컴포넌트 혼합
**Ambiguity:** 35% (Goal: 0.72, Constraints: 0.65, Criteria: 0.50, Context: 0.75)

### Round 2
**Q:** 이 문서를 활용해 가장 먼저 수정하려는 부분은 어디인가요?
**A:** 에이전트/프롬프트 커스터마이징
**Ambiguity:** 26% (Goal: 0.82, Constraints: 0.65, Criteria: 0.70, Context: 0.75)

### Round 3
**Q:** 에이전트 문서를 어떻게 작성해야 할까요? (프롬프트 전체 복사 vs 구조/역할만)
**A:** 구조/역할만 설명
**Ambiguity:** 20.3% (Goal: 0.85, Constraints: 0.77, Criteria: 0.75, Context: 0.80)

### Round 4
**Q:** spec 문서를 어떤 위치에 두고 싶으신가요?
**A:** spec/ (독립 주레벨)
**Ambiguity:** 15.7% ✅ (Goal: 0.87, Constraints: 0.88, Criteria: 0.78, Context: 0.82)

</details>
