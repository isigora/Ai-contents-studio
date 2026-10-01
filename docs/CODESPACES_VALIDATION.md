# Codespaces 이전 검증 — 2026-10-01

기준 소스: Library content-studio-p1.zip (P0 포함), 2026-09-29 보관본.

이번 환경에서 재실행한 결과:
- pnpm install --frozen-lockfile: 성공
- 서버 수용 테스트: 26/26 통과
- 마이그레이션·백업·복원: 4/4 통과
- UI 언어 렌더링: 3/3 통과
- TypeScript 검사: 통과
- Next.js production build: 통과

추가 변경: Codespaces Node 24/pnpm/FFmpeg 설치, 자동 서버 시작,
정확한 HTTPS origin 설정, HTTPS 인증 보안 쿠키.
Codespaces 실제 실행 결과는 온라인 환경 생성 후 추가합니다.
기존 P0/P1의 운영 출시 미검증 항목은 P1_RELEASE.md를 따릅니다.
