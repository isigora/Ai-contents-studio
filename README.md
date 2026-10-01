# Content Studio — P1 제작 확장 검토용

최상위 기준 문서는 `docs/Master_Development_Specification.md`이며 원본을 변경하지 않았습니다.

이번 업데이트의 기능·검증·남은 게이트·DB 이전 방법은 **docs/P1_RELEASE.md**를 먼저 읽으세요.

## P0 기반 기능

- 공개 홈페이지 + 한국어 작업공간 UI
- Better Auth 가입/로그인/로그아웃, 회사별 작업공간 생성·전환
- owner/editor/viewer 서버 권한, Workspace 범위를 강제하는 자료 API
- 회사/브랜드/제품/서비스/고객/문제/가치/가격/증거의 저장·수정
- 제품 소개/SNS/이메일/광고 초안, 검증된 근거와 누락 안내
- 원천 스냅샷, 가격 변경 이력, 초안 편집/버전/검토 상태/TXT·JSON 내보내기
- 사진/문서 업로드, 사진 안전 변환, PDF 격리, 권한 확인 후 파일 다운로드
- 중복 생성 방지, 원천 버전 충돌, 생성 실패 기록과 재시도

이 패키지는 검토용 구현입니다. **전체 P0 완료 승인 상태는 아니며 공개 배포하지 않았습니다.**

## GitHub Codespaces

온라인 실행은 [Codespaces 안내](docs/CODESPACES.md)를 참고하세요. 환경 설치와 개발 서버 시작이 자동 실행됩니다.

## 실행

Node.js 24와 pnpm을 사용합니다.

```bash
pnpm install --frozen-lockfile
pnpm setup:local
pnpm dev
```

`http://localhost:4173`에서 계정과 작업공간을 만드세요. 개요의 `예시 데이터로 흐름 살펴보기`는 예시로 명확히 표시된 고객군과 제품 각 1개를 추가합니다.

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

로컬 자료는 서버측 `.data/postgres`(PostgreSQL/PGlite), `.data/objects`(파일)에 저장됩니다. PGlite는 로컬 단일 프로세스 개발용입니다. 같은 디렉터리를 두 서버에서 동시에 열지 마세요. 테스트는 별도 임시 DB와 가상 계정만 사용합니다.

## 검증

- 서버 수용 테스트 26개 PASS (P0 18 + P1 8)
- 백업/복원·마이그레이션 검사 4개 PASS
- 3개 UI 언어 렌더링 PASS; 브라우저 영어 전환 확인
- 승인 화면의 320/390px 정적 렌더링 가로 넘침 없음
- TypeScript 및 프로덕션 빌드 PASS
- 실제 iPhone의 로그인 이후 전체 여정은 미검증

## AI의 현재 범위

`AI_ENABLED=false`가 기본입니다. 입력된 사실을 형식에 맞게 재구성하며 외부 AI를 호출하지 않습니다. 중국어/영어는 제품의 `자산·번역`에서 등록한 승인 문구를 사용합니다. 번역이 없으면 원문을 유지하고 누락을 표시합니다. 자동 번역 성공으로 표시하지 않습니다.

유료 AI는 제공자, 서버 어댑터 URL, 키, 모델, 예산 설정과 별도 승인 후 활성화합니다. 현재 외부 AI와 품질 검증은 연결하지 않았습니다. `docs/AI_PROVIDER.md`를 참고하세요. 결과의 근거 자동 검사만으로 모든 허위 주장을 판별할 수 없으므로 사람의 검토가 필요합니다.

## 운영 연결

`.env.example`에 환경 변수 이름과 설명이 있습니다.

1. 외부 PostgreSQL `DATABASE_URL`, 비공개 S3 호환 객체 저장소 `S3_*`, 무작위 `BETTER_AUTH_SECRET`을 설정합니다.
2. `APP_MODE=production`, HTTPS `APP_URL`, 정확한 `TRUSTED_ORIGINS`를 설정합니다.
3. `pnpm db:migrate`로 SQL 스키마를 적용합니다. 운영 자동 마이그레이션은 기본 꺼짐입니다.
4. 업로드 크기 제한/인증 요청 제한을 네트워크 경계에 적용하고, 신뢰하는 프록시 IP 전달 설정을 점검합니다. 기본 메모리 인증 요청 제한은 여러 서버 간에 공유되지 않습니다.
5. 이메일 인증/비밀번호 재설정 발송, PDF 안전 검사, 백업 복원을 운영 환경에 연결하고 검증합니다.

외부 PostgreSQL/S3는 자격 증명이 없어 연결 테스트하지 않았습니다. **Node.js 서버용 패키지**이며 Cloudflare Worker에 그대로 배포하는 패키지가 아닙니다. 남아 있는 starter 관련 보조 파일은 실행 경로에 사용하지 않습니다.

## 데이터·코드 구조

- `lib/server/schema.sql`: 실행 스키마. 동일 Workspace 복합 외래키와 버전 제약
- `lib/models.ts`: 회사/브랜드, 기능/혜택/가격/근거 JSONB 구조 검증
- `lib/server/service.ts`: 모든 자료 API, membership 검사, 원천 버전과 콘텐츠 이력
- `lib/server/generator.ts`: 사실 재구성·주장 검사·AI 어댑터
- `lib/server/storage.ts`: 사적 객체 저장, 형식 검사, 격리
- `app/studio/page.tsx`: 작업공간 입력·생성·검토·보관함
- `tests/acceptance.ts`: 재현 가능한 서버 수용 테스트

자료 삭제는 보관 처리하며 과거 콘텐츠는 유지합니다. PDF는 검사 전 격리되어 다운로드와 검증 근거 연결이 차단됩니다. 문서 자동 추출은 미연결입니다.

## 백업

앱을 종료한 뒤 `pnpm backup:local /절대경로/backup`을 실행합니다. DB 덤프와 객체 파일이 함께 저장됩니다. 백업에는 고객 정보가 있으므로 접근을 제한하세요.

복원은 빈 데이터 디렉터리에 PGlite `loadDataDir`로 `postgres.tar.gz`를 불러오고 객체 폴더를 함께 복원합니다. 운영 PostgreSQL은 관리형 백업 또는 pg_dump/pg_restore, S3는 버전 관리/백업을 사용하세요. 로컬 백업·복원은 별도 프로세스에서 DB와 객체 파일을 다시 읽는 테스트로 확인했습니다.

P1의 사진 기반 카드·기초 영상·자막 내보내기는 구현했습니다. 외부 게시/메일 발송, 결제, 성과 수집, 양방향 AI 매칭은 이번 범위에 포함하지 않습니다.
