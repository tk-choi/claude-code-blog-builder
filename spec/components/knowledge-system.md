# knowledge/ 시스템 상세 명세

> **핵심 원칙**: `knowledge/` 폴더는 이 프로젝트의 Single Source of Truth(SSoT)다.
> 블로그 글 작성 시 이 폴더 외의 출처에서 정보·톤·금칙어를 가져오는 것은 설계 위반이다.

---

## 디렉토리 구조

```
knowledge/
├── brand-facts.md                   # ★ 블로거 정보·톤 SSoT (gitignored, /setup 생성)
├── brand-facts.template.md          # 공개 템플릿 (git 추적)
├── banned-words.json                # 금칙어 목록 (gitignored)
├── banned-words.template.json       # 공개 템플릿 (git 추적)
├── tone-samples/                    # 문체 학습 데이터 (gitignored)
│   └── real-blog-posts.txt          # /setup-tone이 수집
└── patterns/                        # 글쓰기 패턴 가이드 (gitignored)
    └── writing-playbook.txt
```

**gitignore 원칙**: 실제 데이터 파일(`.md`, `.json`, `*.txt`)은 모두 gitignored. 템플릿 파일만 공개 저장소에 포함.

---

## 파일별 상세

### `brand-facts.md` (가장 중요)

**목적**: 글 작성 시 참조하는 블로거 정보·톤·독자 전체 목록

**생성 주체**: `/setup` (Phase 1, setup-interviewer 에이전트)

**포함 내용** (template 구조 기준):
- 블로그명, 필명, 한 줄 소개
- 주력 주제 (AI 뉴스 카테고리)
- 글쓰기 스타일 / 톤
- 주요 독자 및 독자가 얻어가길 바라는 것
- 블로거 배경 (선택)
- 주요 인용 소스 (Hugging Face, arXiv, The Verge 등)
- 금칙어

**핵심 규칙**:
```
blog-writer 에이전트의 철칙:
"확인되지 않은 수치를 임의로 쓰지 않을 것.
원문 출처를 반드시 링크로 명시할 것."
```

**Placeholder 감지**: 파일이 `[PLACEHOLDER]`로 시작하면 `/setup` 미실행 상태. 이 경우 `blog-writer`, `/blog-new`가 작동을 중단하고 `/setup` 실행을 안내한다.

**업데이트 방법**:
1. `/setup` 재실행 (전체 덮어쓰기)
2. 파일 직접 편집 (정보 추가 시 권장)

---

### `banned-words.json`

**목적**: 글 작성 시 절대 사용 금지 단어 목록

**생성 주체**: `/setup` (기본 단어 자동 추가) + `/setup-domain` (도메인 단어 추가)

**파일 구조** (template 기준):
```json
{
  "categories": {
    "superlatives": {
      "description": "최상급/절대적 표현 — 사실 여부 무관하게 금지",
      "words": ["최고", "최저", "최상", "무조건", "100%", "절대", "완벽", "유일", "독보적"]
    },
    "ai_cliches": {
      "description": "AI 생성물 티 나는 진부한 표현",
      "words": ["최첨단", "혁신적인", "획기적인", ...]
    },
    "domain_specific": {
      "description": "/setup과 /setup-domain이 추가한 도메인 단어",
      "words": []
    }
  }
}
```

**사용 주체**:
- `quality-check.js`: `superlatives` 배열로 자동 탐지
- `blog-writer` 에이전트: 글 작성 전 파일 읽고 회피

---

### `tone-samples/real-blog-posts.txt`

**목적**: AI가 블로거 문체를 학습하기 위한 실제 블로그 글 텍스트 모음

**생성 주체**: `/setup-tone` → `setup-tone-fetch.js`

**목표 크기**: 80KB+ (너무 적으면 톤 학습 부정확)

**사용 주체**:
- `blog-writer` 에이전트: 글 작성 전 필수 로드, 시그니처 표현 학습
- `blog-quality-reviewer` 에이전트: 톤 일치도 평가 시 참조

**없을 경우**: 에이전트가 brand-facts.md의 톤 설명만으로 일반 글 작성.

---

### `patterns/writing-playbook.txt`

**목적**: 글쓰기 패턴 구조 설명 (어떤 패턴을 어떤 상황에 쓸지)

**생성 주체**: 수동 작성 또는 `/setup-domain`

**AI 뉴스 블로그에 적합한 패턴 예시**:
- 핵심 발표 요약 + 내 해석 패턴
- 기술 비교 패턴 (이전 버전 vs 신 버전)
- "왜 이게 중요한가" 시사점 패턴
- 실제 사용 방법 가이드 패턴

---

## `output/_index.json`

**위치**: `output/_index.json` (knowledge/ 외부이지만 SSoT 역할 수행)

**목적**: 전체 생성 글 인덱스 + 최근 패턴 로테이션 추적

**구조**:
```json
{
  "posts": [
    {
      "folder": "2026-05-05_claude45",
      "keyword": "Claude 4.5 출시",
      "title": "Claude 4.5 출시: 무엇이 달라졌나",
      "toneVariant": "학습자-솔직형",
      "publishedAt": "2026-05-05",
      "qualityScore": 88
    }
  ],
  "recent_rotation": {
    "introStyles": ["뉴스배경형", "질문형", "수치형"]
  }
}
```

**사용 주체**:
- `blog-writer` 에이전트: 최근 도입부 스타일 확인 → 다른 조합 선택
- `/blog-publish-ready` 명령어: 발행 전 반영 여부 확인

---

## SSoT 원칙 요약

| 데이터 종류 | 파일 | 변경 방법 |
|------------|------|----------|
| 블로거 정보·톤 | `brand-facts.md` | `/setup` 재실행 또는 직접 편집 |
| 금칙어 | `banned-words.json` | `/setup-domain` 재실행 또는 직접 편집 |
| 문체·톤 | `tone-samples/real-blog-posts.txt` | `/setup-tone` 재실행 |
| 글쓰기 패턴 | `patterns/writing-playbook.txt` | 직접 편집 |
| 글 인덱스 | `output/_index.json` | `blog-writer` 에이전트가 자동 갱신 |

---

## 커스터마이징 가이드

### 새 금칙어 추가

`knowledge/banned-words.json`의 `domain_specific.words` 배열에 직접 추가:
```json
"domain_specific": {
  "words": ["추가할 단어1", "추가할 단어2"]
}
```
`quality-check.js`의 `BANNED` 배열은 별도로 관리됨 (스크립트 직접 수정 필요).

### 블로거 정보 수정

`knowledge/brand-facts.md` 직접 편집. 톤 설명, 독자 정보, 주력 주제 등을 업데이트하면 다음 글부터 반영.
