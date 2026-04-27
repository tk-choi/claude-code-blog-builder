# knowledge/ 시스템 상세 명세

> **핵심 원칙**: `knowledge/` 폴더는 이 프로젝트의 Single Source of Truth(SSoT)다.
> 블로그 글 작성 시 이 폴더 외의 출처에서 수치·톤·금칙어를 가져오는 것은 설계 위반이다.

---

## 디렉토리 구조

```
knowledge/
├── brand-facts.md                   # ★ 수치·인증 SSoT (gitignored, /setup 생성)
├── brand-facts.template.md          # 공개 템플릿 (git 추적)
├── banned-words.json                # 금칙어 목록 (gitignored)
├── banned-words.template.json       # 공개 템플릿 (git 추적)
├── conversion-benchmarks.md         # 업계 벤치마크 수치 (gitignored)
├── conversion-benchmarks.template.md
├── tone-samples/                    # 문체 학습 데이터 (gitignored)
│   └── real-blog-posts.txt          # /setup-tone이 수집
└── patterns/                        # 글쓰기 패턴 가이드 (gitignored)
    └── writing-playbook.txt         # 12종 패턴 구조 설명
```

**gitignore 원칙**: 실제 데이터 파일(`.md`, `.json`, `*.txt`)은 모두 gitignored. 템플릿 파일만 공개 저장소에 포함.

---

## 파일별 상세

### `brand-facts.md` (가장 중요)

**목적**: 글 작성 시 사용 가능한 회사 데이터 전체 목록

**생성 주체**: `/setup` (Phase 1, setup-interviewer 에이전트)

**포함 내용** (template 구조 기준):
- 회사명, 한 줄 소개, 업력, 규모, 주력 카테고리
- 자랑할 실수치 1~5개 (추정 금지, 사실만)
- 인증·수상 내역
- 타겟 고객 (누가 돈을 내는가, 고객의 문제, 우리의 해결책)
- 자사 제품/서비스 (이름, 설명, 성과)
- 레퍼런스 브랜드

**핵심 규칙**:
```
blog-writer 에이전트의 철칙:
"brand-facts.md에 없는 수치 사용 금지 (픽션 금지).
AI가 추측한 숫자는 신뢰를 박살낸다."
```

**Placeholder 감지**: 파일이 `[PLACEHOLDER]`로 시작하면 `/setup` 미실행 상태. 이 경우 `blog-writer`, `/blog-new`가 작동을 중단하고 `/setup` 실행을 안내한다.

**업데이트 방법**:
1. `/setup` 재실행 (전체 덮어쓰기)
2. 파일 직접 편집 (새 수치 추가 시 권장)

---

### `banned-words.json`

**목적**: 글 작성 시 절대 사용 금지 단어 목록

**생성 주체**: `/setup` (기본 9개 자동 추가) + `/setup-domain` (도메인 단어 추가)

**파일 구조** (template 기준):
```json
{
  "categories": {
    "superlatives": {
      "description": "최상급/절대적 표현 — 사실 여부 무관하게 금지",
      "words": ["최고", "최저", "최상", "무조건", "100%", "절대", "완벽", "유일", "독보적"]
    },
    "medical_law": {
      "description": "의료법 위반 표현",
      "words": ["확실한 효과", "부작용 없음", "기적의", ...]
    },
    "ai_cliches": {
      "description": "AI 생성물 티 나는 진부한 표현",
      "words": ["최첨단", "혁신적인", "획기적인", ...]
    },
    "domain_specific": {
      "description": "/setup-domain과 /setup이 추가한 도메인 단어",
      "words": []
    }
  }
}
```

**사용 주체**:
- `quality-check.js`: `superlatives` 배열로 자동 탐지
- `blog-writer` 에이전트: 글 작성 전 파일 읽고 회피
- `medical-law-checker` 에이전트: `medical_law` 카테고리 참조

---

### `conversion-benchmarks.md`

**목적**: 업계 평균 전환율·객단가 등 글에서 비교 기준으로 사용할 벤치마크 수치

**생성 주체**: `/setup-domain` (Phase 3, 카테고리별 질문)

**포함 내용 예시**:
- 업계 평균 상세페이지 전환율: X%
- 업계 평균 블로그 체류시간: X분
- 카테고리별 평균 객단가

**사용 주체**: `blog-writer` 에이전트 (수치 인용 시)

---

### `tone-samples/real-blog-posts.txt`

**목적**: AI가 회사 문체를 학습하기 위한 실제 블로그 글 텍스트 모음

**생성 주체**: `/setup-tone` → `setup-tone-fetch.js`

**목표 크기**: 80KB+ (너무 적으면 톤 학습 부정확)

**사용 주체**:
- `blog-writer` 에이전트: 글 작성 전 필수 로드, 시그니처 표현 추출 후 2개 이상 자연 삽입
- `blog-quality-reviewer` 에이전트: 톤 일치도 평가 시 참조

**없을 경우**: 에이전트가 시그니처 톤 없이 일반 글 작성. 품질 점수에서 "시그니처 톤 일치도" 항목 감점.

---

### `patterns/writing-playbook.txt`

**목적**: 12종 글쓰기 패턴 구조 설명 (어떤 패턴을 어떤 상황에 쓸지)

**생성 주체**: 수동 작성 또는 `/setup-domain`

**패턴 종류 예시**:
- 비용 방어 패턴 (가격·견적 키워드)
- Why 질문법 (추천·업체 선택 키워드)
- 실패 사례 패턴
- 프로세스 공개 패턴
- 벤치마크 패턴
- 케이스 스터디 패턴

**사용 주체**:
- `blog-researcher` 에이전트: 적합 패턴 2~3개 추천 시 참조
- `blog-writer` 에이전트: 선택한 패턴의 구조 확인

---

## `output/_index.json`

**위치**: `output/_index.json` (knowledge/ 외부이지만 SSoT 역할 수행)

**목적**: 전체 생성 글 인덱스 + 최근 패턴 로테이션 추적

**구조**:
```json
{
  "posts": [
    {
      "folder": "2026-04-08_병원마케팅",
      "keyword": "병원 마케팅",
      "title": "...",
      "pattern": 3,
      "toneVariant": "구어체-A",
      "publishedAt": "2026-04-08",
      "qualityScore": 88
    }
  ],
  "recent_rotation": {
    "patterns": [3, 7, 1],
    "introStyles": ["문제-손실형", "통계형", "질문형"]
  }
}
```

**사용 주체**:
- `blog-researcher` 에이전트: 최근 패턴 확인 → 중복 회피
- `blog-writer` 에이전트: 최근 도입부 스타일 확인 → 다른 조합 선택
- `/blog-publish-ready` 명령어: 발행 전 반영 여부 확인

---

## SSoT 원칙 요약

| 데이터 종류 | 파일 | 변경 방법 |
|------------|------|----------|
| 회사 수치·인증 | `brand-facts.md` | `/setup` 재실행 또는 직접 편집 |
| 금칙어 | `banned-words.json` | `/setup-domain` 재실행 또는 직접 편집 |
| 문체·톤 | `tone-samples/real-blog-posts.txt` | `/setup-tone` 재실행 |
| 업계 벤치마크 | `conversion-benchmarks.md` | `/setup-domain` 재실행 또는 직접 편집 |
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

### 새 글쓰기 패턴 추가

`knowledge/patterns/writing-playbook.txt`에 새 패턴 섹션 추가. 패턴 번호, 이름, 적합 키워드 유형, 구조 순서를 명시.

### 브랜드팩트 수치 추가

`knowledge/brand-facts.md` 직접 편집. 새 수치 추가 후 `blog-writer`가 다음 실행부터 해당 수치를 사용 가능.
