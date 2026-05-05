# 아키텍처

## 설계 원칙

이 프로젝트가 기반하는 4가지 핵심 원칙이다.

| 원칙 | 의미 | 왜 중요한가 |
|------|------|------------|
| **Single Source of Truth** | 블로거 정보는 `knowledge/brand-facts.md` 한 곳에만 | AI 픽션 방지 — 다른 곳의 정보 사용 금지 |
| **외부 의존성 0** | npm install 불필요, Node 20+ 내장 모듈만 | 설치 없이 clone → 즉시 실행 |
| **자동 검증** | PostToolUse 훅이 post.md 저장 시 품질검사 자동 실행 | 실수로 저품질 글 발행 방지 |
| **사람 발행** | 자동 발행 기능 의도적으로 없음 | 저품질 콘텐츠 대량 발행 리스크 방지 |

---

## 디렉토리 구조

```
claude-code-blog-builder/
│
├── CLAUDE.md                        # Claude Code 마스터 지시서
├── package.json                     # "type": "module", Node 20+
├── .env.example                     # 환경변수 템플릿
│
├── .claude/
│   ├── settings.json                # PostToolUse 훅 등록
│   ├── commands/                    # 8개 /명령어 정의 (*.md)
│   └── agents/                      # 4개 에이전트 프롬프트 (*.md)
│
├── scripts/                         # 7개 Node.js 실행 스크립트
│   ├── research.js                  # Naver API 키워드 리서치 (선택)
│   ├── generate-images.js           # Gemini API 이미지 생성 (2종) + --prompt-only
│   ├── quality-check.js             # 7항목 품질 검사
│   ├── duplicate-check.js           # 6-gram Jaccard 유사도 검사
│   ├── hook-post-write.js           # PostToolUse 훅 라우터
│   ├── preview.js                   # 발행 어시스턴트 HTML 생성
│   └── setup-tone-fetch.js          # 블로그 URL 본문 수집
│
├── knowledge/                       # ⭐ Single Source of Truth
│   ├── brand-facts.md               # 블로거 정보·톤 (gitignored, /setup이 생성)
│   ├── brand-facts.template.md      # 공개 템플릿
│   ├── banned-words.json            # 금칙어 목록 (gitignored)
│   ├── banned-words.template.json   # 공개 템플릿
│   ├── tone-samples/                # 실제 블로그 문체 샘플 (gitignored)
│   │   └── real-blog-posts.txt      # /setup-tone이 채움
│   └── patterns/                    # 글쓰기 패턴 가이드 (gitignored)
│       └── writing-playbook.txt
│
├── templates/                       # 이미지 생성용 HTML 템플릿
│   ├── thumbnail.html               # 16:9 썸네일
│   └── infographic.html             # 2:3 인포그래픽
│
├── keyword-bank/                    # 카테고리별 시드 키워드
│   ├── README.md                    # YAML 포맷 명세
│   └── *.yml                        # /setup-domain이 생성
│
├── output/                          # 생성 결과물 (gitignored)
│   ├── _index.json                  # 전체 글 인덱스
│   └── YYYY-MM-DD_키워드/           # 글 패키지 디렉토리
│       ├── post.md
│       ├── post.html
│       ├── metadata.json
│       ├── guide.md
│       ├── preview.html
│       ├── quality-report.json
│       └── images/
│           ├── thumbnail.png
│           └── infographic.png
│
└── docs/                            # 사용자 가이드 (≠ 이 spec/)
    ├── setup-guide.md
    ├── how-it-works.md
    └── troubleshooting.md
```

---

## 핵심 데이터 흐름

### 설정 단계 (1회)

```
사용자
  │ /setup
  ▼
setup-interviewer 에이전트
  │ 6개 질문 인터뷰 (블로거 정보)
  ├─ knowledge/brand-facts.md 생성     ← 블로거 정보 SSoT
  └─ knowledge/banned-words.json 수정  ← 금칙어

  │ /setup-tone
  ▼
setup-tone-fetch.js
  └─ knowledge/tone-samples/real-blog-posts.txt 생성  ← 문체 SSoT

  │ /setup-domain
  ▼
setup-interviewer 에이전트
  ├─ keyword-bank/*.yml 생성
  ├─ knowledge/banned-words.json 도메인 단어 추가
  └─ .env BRAND_NAME/COLORS 설정      ← 이미지 디자인 SSoT
```

### 글 생성 단계 (매 글마다)

```
사용자
  │ /blog-new "AI 뉴스 주제"
  ▼
[사전 로드] brand-facts.md, tone-samples, patterns, banned-words.json, _index.json
  │
  ▼
blog-researcher 에이전트
  │ Exa MCP → WebSearch → research.js (선택)
  └─ 리서치 브리프 반환
  │
  ▼
blog-writer 에이전트
  │ post.md + post.html 작성 (뉴스 배경→요약→해석→링크)
  └─ output/폴더/post.md 저장
         │
         │ [PostToolUse 훅 자동발사]
         ▼
  hook-post-write.js
    ├─ quality-check.js   → quality-report.json
    └─ duplicate-check.js → 콘솔 경고
  │
  ▼
generate-images.js (Gemini API 또는 --prompt-only)
  └─ output/폴더/images/{thumbnail,infographic}.png (2장)
  │
  ▼
metadata.json + guide.md + _index.json 업데이트
  │
  ▼
/blog-preview → preview.js → preview.html (브라우저에서 복붙)
```

---

## 환경변수 맵

| 변수 | 필수 | 용도 | 설정 주체 |
|------|------|------|----------|
| `GEMINI_API_KEY` | ⬜ 선택 | 이미지 자동 생성 (없으면 `--prompt-only` 사용) | 사용자 수동 |
| `NAVER_CLIENT_ID` | ⬜ 선택 | Naver Search API (없으면 건너뜀) | 사용자 수동 |
| `NAVER_CLIENT_SECRET` | ⬜ 선택 | Naver Search API | 사용자 수동 |
| `BRAND_NAME` | ⬜ 선택 | 이미지에 박힐 블로그명 | `/setup-domain` 자동 |
| `BRAND_BG_COLOR` | ⬜ 선택 | 이미지 배경색 hex | `/setup-domain` 자동 |
| `BRAND_FG_COLOR` | ⬜ 선택 | 이미지 본문색 hex | `/setup-domain` 자동 |
| `BRAND_ACCENT` | ⬜ 선택 | 이미지 포인트색 hex | `/setup-domain` 자동 |

Naver API 미설정 시: `research.js` 건너뜀, Exa MCP / WebSearch로 리서치.

---

## 자동화 메커니즘: PostToolUse 훅

`.claude/settings.json`에 등록된 훅이 핵심 자동화를 담당한다.

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{"type": "command", "command": "node scripts/hook-post-write.js"}]
    }]
  }
}
```

동작 원리:
1. Claude가 어떤 파일을 Write/Edit할 때마다 `hook-post-write.js`가 stdin으로 JSON payload를 받음
2. payload에서 파일 경로 추출
3. `output/*/post.md` 패턴 매칭 시에만 실행 (다른 파일은 무시)
4. `quality-check.js` → `duplicate-check.js` 순서로 자동 실행
5. 항상 exit 0으로 종료 (Claude 작업 블로킹 없음)
