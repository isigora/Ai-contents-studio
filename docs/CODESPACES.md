# GitHub Codespaces 테스트

이 저장소는 기존 content-studio-p1.zip에서 가져온 P0 기반 + P1 제작 확장입니다.
P2(외부 게시·예약·성과·과금)는 구현본이 확인되지 않아 포함하지 않았습니다.
기준 명세 및 기존 검증 기록은 docs 폴더에 보존했습니다.

## 실행

GitHub 저장소에서 Code → Codespaces → Create codespace on main을 선택합니다.
Node.js 24, pnpm 11.25.0, FFmpeg가 자동 설치됩니다.
설치 후 개발 서버가 자동 시작됩니다. 하단 Ports에서 4173의 브라우저 열기를 누르세요.
테스트 주소는 생성된 Codespace마다 달라지며 인증용 APP_URL에도 자동 반영됩니다.
포트 공개 범위는 Private로 유지하고 GitHub 계정으로 접속합니다.

서버가 멈췄으면 터미널에서 `bash scripts/start-codespaces.sh`를 실행합니다.
로그: `.data/dev-server.log`. 종료: 서버 터미널에서 Ctrl+C 또는 Codespace를 Stop합니다.
자동 시작 서버를 수정/재실행할 때는 해당 프로세스를 먼저 종료해 DB 중복 실행을 피하세요.

## 테스트 순서

1. /studio에서 테스트용 계정 가입·로그인, 작업공간 생성.
2. 예시 데이터 버튼 또는 제품·고객 직접 등록.
3. 한국어 제품 소개와 SNS 초안을 생성·편집·저장.
4. 가격 수정 후 새 초안을 생성하고 기존 버전이 유지되는지 확인.
5. 승인 요청 → 승인 → 콘텐츠 재사용.
6. 권리를 가진 사진 업로드 후 PNG, 9초 MP4, SRT 제작·다운로드.
7. 로그아웃·재로그인 후 저장 데이터 확인.

## 데이터와 비용

별도 DB 가입 없이 내장 PGlite를 사용합니다. `.data/postgres`는 DB,
`.data/objects`는 업로드·제작 파일입니다. `.env.local`의 인증키는 자동 생성됩니다.
이 파일들은 GitHub에 커밋하지 않습니다. Codespace를 삭제하면 데이터도 없어지므로
필요한 자료는 앱을 중지하고 `pnpm backup:local /tmp/studio-backup`으로 백업·다운로드하세요.
Codespaces는 개발/테스트용이며 24시간 운영 서버가 아닙니다.
GitHub 계정의 무료 할당량과 사용량을 확인하고 테스트 후 Codespace를 Stop하세요.
유료 사용 추가, 외부 게시, 유료 AI 호출은 자동 활성화하지 않습니다.

## 검증 명령

```bash
pnpm test
pnpm typecheck
pnpm build
```

기존 기록은 당시 결과입니다. 이번 이전 검증 결과는 docs/CODESPACES_VALIDATION.md에 기록합니다.
