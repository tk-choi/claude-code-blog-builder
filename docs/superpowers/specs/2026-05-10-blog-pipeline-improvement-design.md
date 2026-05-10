# Blog Pipeline Improvement — Design Spec

**Date:** 2026-05-10  
**Author:** tk-choi  
**Status:** Approved

---

## Overview

두 가지 개선사항을 구현한다.

1. **Feature 1**: Gemini 이미지 생성 프롬프트의 브랜드명 기본값을 `'YOUR BRAND'`에서 `'taetae'`로 변경
2. **Feature 2**: 최신 AI 뉴스를 다소스 수집·분석해 포스팅 주제 3개를 추천하는 `/blog-topics` 커맨드 추가

---

## Feature 1: 브랜드명 기본값 변경

### 변경 위치

`scripts/generate-images.js` 53번째 줄:

```js
// 변경 전
const BRAND_NAME = process.env.BRAND_NAME || 'YOUR BRAND';

// 변경 후
const BRAND_NAME = process.env.BRAND_NAME || 'taetae';
```

### 동작

- `.env`에 `BRAND_NAME`이 설정된 경우 그 값이 우선 사용됨
- `BRAND_NAME`이 없을 때만 `'taetae'`를 폴백으로 사용
- 썸네일 하단 레이블 및 인포그래픽 푸터에 `taetae` 표시

---

## Feature 2: /blog-topics 커맨드

### 목적

현재 파이프라인은 사용자가 키워드를 직접 입력해야 시작된다. `/blog-topics`는 주제 결정 이전 단계로, 최신 AI 뉴스를 자동 수집·분석해 "오늘 쓰면 좋은 주제"를 추천하고 선택 즉시 `/blog-new`로 연결한다.

### 새로 추가할 파일

```
.claude/
├── commands/
│   └── blog-topics.md            # /blog-topics 슬래시 커맨드 (흐름 제어)
└── agents/
    └── blog-topic-discoverer.md  # 다소스 수집·분석 전담 에이전트
```

### 아키텍처 & 실행 흐름

```
사용자: /blog-topics
    ↓
blog-topics 커맨드
    ├── brand-facts.md placeholder 체크
    └── blog-topic-discoverer 에이전트 위임
            ├── Exa MCP: 공식 블로그 검색 (OpenAI/Anthropic/Google/Meta)
            ├── Exa MCP: AI 뉴스 미디어 검색 (VentureBeat, TechCrunch)
            └── WebSearch: Reddit 트렌드 검색 (r/LocalLLaMA, r/MachineLearning)
    ↓ 구조화된 결과 반환
blog-topics 커맨드
    ↓
[추천] 3개 주제 + 이유 + 각도 출력
    ↓ 사용자 선택 (1/2/3)
/blog-new "선택된 주제" --interactive 자동 실행
```

### blog-topic-discoverer 에이전트

**역할:** 검색·수집·분석만 담당. 사용자 인터랙션 없음.

**검색 전략 (병렬 실행):**

| 소스 | 검색 쿼리 예시 | 도구 |
|------|--------------|------|
| 공식 블로그 | `site:openai.com OR site:anthropic.com OR site:blog.google 2026` | Exa MCP (우선) |
| AI 뉴스 미디어 | `AI LLM breakthrough news this week VentureBeat TechCrunch` | Exa MCP (우선) |
| Reddit 트렌드 | `reddit r/LocalLLaMA r/MachineLearning hot posts this week` | WebSearch |

**분석 기준 (우선순위 순):**
1. **신선도** — 72시간 이내 발표/화제
2. **임팩트** — 모델 출시, 기능 업데이트, 벤치마크 등 실체 있는 뉴스
3. **블로그 적합성** — `knowledge/brand-facts.md`의 독자 프로필과 일치

**출력 포맷:**

```
[추천] 오늘 쓰면 좋은 AI 포스팅 주제

1. GPT-4.5 코딩 벤치마크 분석
   왜 지금? OpenAI가 48시간 전 공식 발표, Reddit 1.2k 댓글로 화제
   추천 각도: "실제 코딩 작업에서 체감 성능 vs 수치 비교"

2. ...
3. ...

선택 (1/2/3) 또는 [Enter]=취소:
```

### /blog-topics 커맨드 상세

**실행 순서:**

1. `knowledge/brand-facts.md` placeholder 체크 → `[PLACEHOLDER]`면 `/setup` 안내 후 중단
2. `blog-topic-discoverer` 에이전트 위임 (검색 실행)
3. 결과 3개 출력 + 선택 대기
4. 입력 처리:
   - `1`/`2`/`3` → `/blog-new "해당 주제" --interactive` 실행
   - `Enter` / `x` / `취소` → 종료 (output 폴더 생성 없음)
   - 재검색 요청 → 에이전트 재실행 (최대 1회)
5. Exa MCP 미설정 시 → WebSearch 전용으로 폴백, 사용자에게 안내

**엣지 케이스:**

| 상황 | 처리 |
|------|------|
| 검색 결과 없음 | "최근 72시간 내 주목할 만한 소식이 없습니다. 키워드를 직접 입력하시겠어요?" |
| 결과 3개 미만 | 있는 것만 출력, 최소 1개면 진행 |
| 최근 작성 주제 중복 | `output/_index.json`과 비교, 최근 7일 내 작성한 주제 제외 |
| Exa MCP 미설정 | WebSearch 전용 폴백, 소스 제한 안내 |

### /blog-new와의 역할 분리

| 커맨드 | 진입 조건 | 역할 |
|--------|----------|------|
| `/blog-new 키워드` | 사용자가 주제 결정 후 | 리서치→작성→이미지→검증 풀 파이프라인 |
| `/blog-topics` | 주제 결정 전 | 발견→선택→`/blog-new` 연결 |

---

## 구현 범위 (Out of Scope)

- 스케줄 자동 실행 (매일 아침 자동 수집) — 별도 구현
- 주간 큐 관리 — 별도 구현
- X(트위터) 트렌드 직접 크롤링 — API 제한으로 제외
