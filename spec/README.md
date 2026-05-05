# claude-code-blog-builder 프로젝트 Spec

> **이 디렉토리의 목적**: 현재 프로젝트 구조·워크플로우·기술스택·구현 방법을 상세 문서화하여 새 Claude Code 세션이 즉시 핵심을 파악하고 커스터마이징할 수 있게 한다.

---

## 5분 요약

이 프로젝트는 **Claude Code에서 직접 실행하는 Tistory AI 뉴스 블로그 자동화 도구**다.

| 항목 | 내용 |
|------|------|
| 런타임 | Node.js 20+ (npm install 불필요) |
| 리서치 | Exa MCP (1순위) → WebSearch (2순위) → Naver API (선택) |
| 이미지 | Gemini API 자동 생성 또는 `--prompt-only`로 프롬프트 출력 |
| 진입점 | `/blog-new "AI 뉴스 주제"` 한 줄 |
| 핵심 설계 | `knowledge/` 폴더가 Single Source of Truth |
| 자동화 | PostToolUse 훅이 품질검사를 자동 실행 |
| 발행 | 사람이 직접 Tistory 에디터에 붙여넣기 (자동 발행 없음) |

### 빠른 시작 플로우

```
처음 사용 → /setup (5분 인터뷰) → /setup-tone (URL로 톤 학습) → /blog-new "AI 뉴스 주제"
```

---

## 문서 지도

| 파일 | 읽어야 할 때 |
|------|------------|
| **이 파일** (README.md) | 처음 — 프로젝트 전체 파악 |
| [architecture.md](./architecture.md) | 설계 원칙·디렉토리 구조·데이터 흐름 이해 시 |
| [pipeline.md](./pipeline.md) | `/blog-new` 가 내부에서 무슨 일을 하는지 이해 시 |
| [components/agents.md](./components/agents.md) | 에이전트 수정·추가·프롬프트 커스터마이징 시 ★ |
| [components/commands.md](./components/commands.md) | 각 `/명령어` 가 어떤 순서로 동작하는지 이해 시 ★ |
| [components/scripts.md](./components/scripts.md) | 스크립트 I/O·알고리즘·API 호출 방식 이해 시 |
| [components/knowledge-system.md](./components/knowledge-system.md) | `knowledge/` 폴더 구조와 SSoT 설계 이해 시 |

★ = 에이전트 커스터마이징 시 가장 먼저 읽을 것

---

## 핵심 파일 위치 한눈에 보기

```
claude-code-blog-builder/
│
├── .claude/
│   ├── settings.json        ← PostToolUse 훅 등록
│   ├── commands/            ← /blog-new 등 8개 명령어 정의
│   └── agents/              ← blog-writer 등 4개 에이전트 프롬프트 ★수정 포인트
│
├── scripts/                 ← 7개 Node.js 스크립트 (실제 로직)
├── knowledge/               ← 블로거 정보·톤·금칙어 SSoT (/setup이 채움)
├── keyword-bank/            ← 카테고리별 시드 키워드 YAML
├── templates/               ← 이미지 생성용 HTML 템플릿
└── output/                  ← 생성된 글·이미지 결과물 (gitignored)
```

---

## 커스터마이징 진입점

에이전트/프롬프트를 수정하려면 아래 파일들을 직접 편집한다:

| 목적 | 파일 |
|------|------|
| 글쓰기 규칙 변경 | `.claude/agents/blog-writer.md` |
| 리서치 방법 변경 | `.claude/agents/blog-researcher.md` |
| 품질 기준 변경 | `.claude/agents/blog-quality-reviewer.md` |
| 새 에이전트 추가 | `.claude/agents/<name>.md` 새 파일 생성 |
| 파이프라인 흐름 변경 | `.claude/commands/blog-new.md` |

→ 상세 방법: [components/agents.md](./components/agents.md)
