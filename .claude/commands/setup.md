---
description: 블로그 자동화 시스템 초기 셋업 (5분 인터뷰 → knowledge/brand-facts.md 자동 생성)
argument-hint: (인자 없음)
---

# /setup — 5분 셋업 인터뷰

이 명령은 처음 레포를 clone한 사용자가 내 블로그에 맞게 시스템을 설정할 수 있도록 인터뷰를 진행합니다.

## 실행 절차

1. `setup-interviewer` 서브에이전트를 호출합니다.
2. 서브에이전트가 Phase 1 인터뷰를 진행 (Q1~Q6, 한 번에 한 질문씩).
3. 6개 질문이 모두 끝나면 자동으로:
   - `knowledge/brand-facts.template.md` → 답변으로 치환 → `knowledge/brand-facts.md`로 저장
   - `knowledge/banned-words.json` 도메인 단어 추가
4. 다음 단계 추천 (`/setup-tone` 또는 `/blog-new`).

## 시작 멘트 (서브에이전트가 출력)

```
안녕하세요! Tistory AI 기술 블로그 자동화 셋업을 시작합니다. 5분 정도 걸려요.

Phase 1 — 블로그 기본 정보 (6질문)
Phase 2 — 톤 학습 (선택, /setup-tone)
Phase 3 — 주제 특화 (선택, /setup-domain)

지금은 Phase 1만 진행합니다. 끝나면 바로 첫 글을 쓸 수 있어요.

준비되셨나요? 첫 질문 갑니다.
```

## 사전 조건 점검

서브에이전트 호출 전에 아래를 확인:
- `knowledge/brand-facts.md`가 이미 존재하고 placeholder가 아니면 → 사용자에게 "이미 셋업되어 있습니다. 다시 하시겠어요? (이전 데이터 덮어쓰기)" 확인
- `knowledge/brand-facts.template.md`가 없으면 → 에러 메시지 + "레포 clone이 완전한지 확인하세요" 안내
