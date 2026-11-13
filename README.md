# XeCMS Plugin AppBuilder

XeCMS 엔진 위에서 동작하는 **선택 업무 화면 빌더**입니다. 화면 작성·미리보기·실행 기능을
엔진 저장소와 별도로 개발하고 배포합니다. ERP 등 자체 업무 화면을 만드는 프로젝트에는
이 플러그인이 필요하지 않습니다.

빌더는 개발 중입니다. 기존 V1/V2 manifest와 DB 데이터를 유지하며, 아직 제공하지 않는
고급 편집 기능과 서버 권한 기반 초안 미리보기가 있습니다.

## 구성

| 디렉터리 | 패키지 | 역할 |
| --- | --- | --- |
| `packages/model` | `@xecms/admin-apps` | 화면 정의·컴파일·검증 |
| `packages/client` | `@xecms/app-builder-client` | 전용 REST 계약·세션/CSRF 공유 client |
| `packages/runtime` | `@xecms/admin-runtime` | 업무 화면 React runtime |
| `packages/server` | `@xecms/app-builder-server` | 서비스·저장소·API·서버 확장 |
| `packages/admin` | `@xecms/app-builder-admin` | 독립 Studio와 업무 화면 SPA |

엔진은 [XeCMS](https://github.com/mkjang2000/XeCMS)에서 개발합니다. 이 저장소는
엔진의 공개 패키지 API만 사용하며, 엔진 소스 경로·workspace 링크에 의존하지 않습니다.
구조는 [Project_tree.md](./Project_tree.md)를 참고하세요.

공통 TypeScript 옵션과 전체 빌드 순서는 루트 `tsconfig.json`에서 관리합니다.
패키지별 `tsconfig.json`은 독립 배포에 필요한 출력 경로·참조와 JSX/Vite 설정만 구분합니다.

## 설치 준비: 아직 게시되지 않은 0.6.0

Node.js 22.22 이상과 pnpm 10.30.1이 필요합니다. **엔진과 빌더 0.6.0은 npm에 아직
게시하지 않았습니다.** 현재는 아래 세 방법 중 하나로 실제 패키지 산출물을 설치합니다.

```bash
# 기본: engine-source.json에 고정한 공개 엔진 commit을 내려받아 빌드·pack 후 설치
pnpm bootstrap

# 이미 검증한 엔진 tarball 및 release-manifest.json이 있는 경우
pnpm bootstrap --artifacts /absolute/path/to/engine-release

# 로컬 엔진 checkout을 빌드·pack해 사용하는 경우 (엔진 소스를 링크하지 않음)
pnpm bootstrap --source /absolute/path/to/XeCMS
```

`--offline`은 캐시된 외부 의존성과 `--artifacts` 또는 `--source`가 있을 때 사용할 수 있습니다.
스크립트는 패키지 버전과 SHA-512를 확인한 후 `.engine-artifacts/`에 복사합니다.
`.pnpmfile.cjs`가 설치 과정에서만 엔진의 직접·전이 의존성을 해당 tarball로 연결합니다.
`package.json`은 항상 `0.6.0` 같은 정확한 공개 패키지 버전을 유지합니다.

사전 게시 단계의 `.engine-artifacts/`, `.engine-source/`, `.pnpmfile.cjs`, `pnpm-lock.yaml`은
Git에 포함하지 않습니다. npm 게시 후에는 이 로컬 hook과 임시 lock을 제거하고 일반
`pnpm install`로 전환한 뒤 레지스트리 기반 lock을 검증·커밋합니다. 현재 bootstrap과
pack 명령에는 npm 게시·로그인 동작이 없습니다.

## 개발 및 실행

```bash
cp .env.example .env
docker compose up -d --wait postgres
pnpm dev
```

엔진 관리 UI: `http://127.0.0.1:3100/admin/setup`

빌더 Studio: `http://127.0.0.1:5174/admin/apps`

`pnpm dev`는 먼저 패키지를 빌드한 뒤 설치된 엔진 서버와 빌더 Vite 서버를 실행합니다.
Studio 화면 변경은 HMR로 반영됩니다. 서버 코드 변경은 재빌드·재시작합니다.
엔진 관리 UI는 설치된 `@xecms/admin-app` 번들입니다.

```bash
pnpm build
pnpm start
```

운영 실행 전 `.env`에 운영 DB, 32바이트 이상의 session secret, HTTPS 공개 Origin을
설정하세요. 서버는 `/admin/apps`, `/admin-apps/:appId/screens`, `/apps/:appKey/*`를 제공하고
빌더 자산은 `/extensions/app-builder/`에서 제공합니다.

기존 XeCMS 소비 프로젝트에서는 `@xecms/app-builder-server`와 그 의존 패키지를 설치하고
`xecms.config.json`의 `extensions`에 `"@xecms/app-builder-server"`를 추가합니다.
서버 확장은 같은 프로세스에서 실행하는 trusted code이며 등록 변경 후 재시작합니다.
기존 Plugin SDK의 DB 설치/활성화 lifecycle과는 별도 설정입니다.

## 검증과 배포 준비

```bash
pnpm check                         # 경계 검사·타입 검사·보존된 빌더 단위 테스트
pnpm exec playwright install chromium
pnpm verify                        # clean·check·build·DB·두 브라우저 여정
pnpm release:pack --output dist/releases/0.6.0
```

`pnpm clean`은 각 패키지의 `dist`·`dist-types`와 저장소·패키지의 테스트 보고서·coverage·캐시를
제거합니다. `node_modules`에서는 `.cache`·`.vite`·`.vitest` 캐시만 제거합니다. 이후 `pnpm build` 또는 `pnpm dev`로 다시 빌드하세요. `dist/releases/`,
엔진 bootstrap 파일·의존성 설치, `.env`와 `.xecms`의 로컬 데이터는 보존합니다.

DB/E2E 검증은 기본적으로 별도 Docker 프로젝트와 임시 PostgreSQL을 사용합니다.
이미 격리된 DB가 있으면 `XECMS_TEST_DATABASE_URL`로 지정할 수 있습니다.
`pnpm test:database`만 실행할 때는 이 변수가 필수입니다.

pack은 저장소 밖 임시 stage에서 실행하여 로컬 bootstrap hook을 배제하고,
빌더 workspace 의존성만 실제 버전으로 치환합니다. 출력 tarball에는 엔진의 정확한
버전만 남고 `.engine-artifacts`, `.pnpmfile.cjs`, 임시 lock은 포함되지 않습니다.
`release-manifest.json`에 각 tarball의 SHA-512를 기록합니다. **pack은 게시하지 않습니다.**

기존 빌더 데이터·migration 이력·권한 식별자는 호환을 위해 엔진에 유지됩니다.
빌더를 제거해도 저장 데이터는 삭제하지 않습니다. 개발 계획과 내부 리뷰는 별도
비공개 XeCMS-Docs 저장소에서 관리합니다.
