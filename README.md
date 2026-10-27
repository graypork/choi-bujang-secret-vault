# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 만든 자료실을 단계별로 보호하는 실습 저장소입니다. 포함되는 기록은 모두 가상 자료이며 실제 학생 자료, 토큰, 비밀키를 코드나 Git에 넣지 않습니다.

## 현재 상태: 3단계 「진짜 로그인을 붙입니다」

3단계에서는 Supabase Auth의 이메일·비밀번호 로그인/로그아웃을 붙이고, 브라우저가 받은 세션의 access token을 Bearer 헤더로 자료 API에 보냅니다. 서버는 기존 `src/verify-login.mjs`로 요청 토큰을 검사한 뒤에만 Supabase `public.learning_notes`에 접근합니다. 비밀번호나 JWT를 직접 만들거나 브라우저가 보낸 `userId`·`role`을 신뢰하지 않습니다.

목록 `GET /api/notes`는 서버가 확인한 사용자 ID의 `owner_id` 메모만 반환하고, `POST /api/notes`는 같은 사용자 ID를 `owner_id`로 저장합니다. 로그인한 사용자는 화면에서 메모를 추가·조회·수정·삭제할 수 있습니다. `public/data.json`은 계속 배포하지 않으며 `/aleph.json`은 빌드에서 생성됩니다. 첫 화면과 API 응답에는 `X-Content-Type-Options: nosniff` 헤더를 적용합니다.

### 현재 남아 있는 약점

단건 `GET /api/notes/:id`, `PUT /api/notes/:id`, `DELETE /api/notes/:id`는 로그인 여부만 확인하고 아직 `owner_id`를 검사하지 않습니다. 따라서 로그인한 B가 A의 메모 ID를 알면 단건 조회·수정·삭제를 시도할 수 있는 소유권 검사 허점이 남아 있습니다. 이 허점은 4단계 「로그인해도 내 자료만 보이게 합니다」에서 막습니다.

## 현재 파일에서 가상 메모 문장 확인하기

현재 파일에서 문장이 보이지 않는지 확인할 때 원문을 README나 새 검사 파일에 다시 복사하지 않습니다. 대신 1단계의 옛 공개 커밋에서 네 문장을 임시 파일로 꺼내 검색 패턴으로만 사용합니다. 아래 예시는 Git Bash/macOS/Linux 셸 기준이며 `/tmp`의 파일은 Git에 넣지 않습니다.

먼저 옛 공개 커밋의 `data.json`에서 메모 본문을 임시 패턴 파일로 만듭니다.

```bash
node - <<'NODE'
const { execFileSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const oldCommit = 'd803a28b6af133eb6e55fb83bc64bcacaf7badd2';
const raw = execFileSync('git', ['show', `${oldCommit}:data.json`], { encoding: 'utf8' });
const patterns = JSON.parse(raw).notes.map(note => note.content).join('\n') + '\n';
writeFileSync('/tmp/byte-back-note-patterns.txt', patterns, 'utf8');
NODE
```

GitHub 최신 `main` 파일은 다음처럼 확인합니다. 출력이 없으면 현재 `main` 파일에는 옛 네 메모 문장이 없다는 뜻입니다.

```bash
git fetch origin main
git grep -nF -f /tmp/byte-back-note-patterns.txt origin/main -- .
```

현재 프로덕션 배포의 공개 산출물은 배포 주소를 `APP_URL`에 넣고 내려받아 확인합니다. `/data.json`의 HTTP 상태도 함께 기록합니다.

```bash
APP_URL="https://현재-프로덕션-주소.vercel.app"
mkdir -p /tmp/byte-back-deploy
curl -sS "$APP_URL/" -o /tmp/byte-back-deploy/index.html
curl -sS "$APP_URL/aleph.json" -o /tmp/byte-back-deploy/aleph.json
curl -sS -o /tmp/byte-back-deploy/data.json -w 'data.json HTTP %{http_code}\n' "$APP_URL/data.json"
grep -nF -f /tmp/byte-back-note-patterns.txt /tmp/byte-back-deploy/*
```

2026-10-27 현재 확인 결과는 다음과 같습니다.

- GitHub 최신 `main`에서 옛 네 메모 문장 검색 결과: **0건**.
- 현재 프로덕션의 `/`와 `/aleph.json`에서 옛 네 메모 문장 검색 결과: **0건**.
- 현재 프로덕션의 `/data.json`: **404 Not Found**이며 옛 메모 문장은 나오지 않음.
- `/api/notes`: 로그인 없이 요청하면 **401 Unauthorized**와 JSON 오류 `{"error":"AUTH_REQUIRED"}`를 반환함. 정상 로그인 뒤 목록 GET은 서버가 확인한 사용자 ID의 `owner_id` 메모만 반환함.

### 과거 공개 이력은 별도로 남아 있음

위의 0건 결과는 **현재 `main`과 현재 프로덕션 산출물에서 원문이 제거됐다는 확인**일 뿐, 과거 노출이 해소됐다는 뜻이 아닙니다. 이 저장소는 현재 Public이고, 1단계 옛 공개 커밋 `d803a28b6af133eb6e55fb83bc64bcacaf7badd2`의 `data.json`에는 네 가상 메모가 그대로 남아 있습니다. 또한 1단계 옛 Vercel 배포의 `/data.json`도 2026-10-27 현재 **200 OK**로 열리며 같은 네 메모를 반환합니다.

따라서 옛 공개 커밋과 옛 배포가 접근 가능한 동안에는 **“과거 노출이 해소됐다”, “완전히 삭제됐다”, “더 이상 누구도 볼 수 없다”라고 기록하지 않습니다.** 현재 상태는 “최신 코드와 최신 배포의 정적 공개 파일에서는 제거됐지만, 과거 공개 이력은 남아 있음”으로 표현합니다.

옛 커밋과 옛 배포 상태도 필요할 때 각각 다시 확인합니다.

```bash
git grep -nF -f /tmp/byte-back-note-patterns.txt d803a28b6af133eb6e55fb83bc64bcacaf7badd2 -- data.json public/data.json
curl -sS "https://choi-bujang-secret-vault-29li8pv3q-grayporks-projects.vercel.app/data.json" \
  | grep -nF -f /tmp/byte-back-note-patterns.txt
```

## 1단계에서 한 일

1단계에서는 학생 본인의 GitHub 저장소와 Vercel 배포를 만들고 `/`와 공개 가상 자료를 확인했습니다. 2단계부터는 그 공개 정적 자료 흐름을 사용하지 않습니다.

## 빌드와 배포 식별

`vercel.json`은 정적 결과물 `public`을 배포하면서 `api/` 아래의 Vercel 서버 함수도 함께 사용합니다. 빌드 명령 `npm run build`는 2단계 이후 정적 `public/data.json`을 제거하고, Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증해 `public/aleph.json`을 생성합니다. `aleph.json`만으로 저장소 소유권이나 방어 성공을 인정하지 않으며 심판이 실제 공개 저장소와 배포 결과를 따로 대조합니다.

`aleph.config.json`의 현재 단계는 `3`입니다. `repoUrl`은 실제 GitHub 저장소 주소이고 `publicAppUrl`은 실제 프로덕션 배포 주소입니다. `identityProvider`에는 Supabase Auth의 공개 issuer/audience/JWKS 정보가 있고, `allowedRoutes`에는 `/api/notes`와 `/api/notes/:id`가 기록되어 있습니다. 비밀키는 이 파일에 넣지 않습니다.

로컬 정적 빌드만 확인할 때는 `npm run build -- --local`을 사용합니다. 이 명령은 Vercel 배포나 심판 판정을 증명하지 않습니다.

## 2단계 저장점 (과거 기록)

- 단계: `aleph.config.json`의 `step`은 `2`.
- 실제 프로덕션 주소: `https://choi-bujang-secret-vault-one-vert.vercel.app`.
- 2단계 당시 서버 함수는 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY`를 Vercel 환경변수에서 읽었고, 실제 값은 코드·Git·브라우저에 넣지 않았음.
- 로그인 발급자: 아직 없음 (`identityProvider: null`).
- 허용 경로: 아직 없음 (`allowedRoutes: []`).
- 원본 API/복구 경로: 아직 없음 (`originalApiUrl: null`, `restoreRoute: null`).
- 2단계 당시 화면은 `/api/notes`를 호출하고 정적 `/data.json`은 배포하지 않았음. 당시 `/api/notes`는 인증 없는 공개 주소였고 **200 OK로 가상 메모 4건을 반환했음**. `/data.json`은 **404 Not Found**였음.
- 다시 확인: `npm ci`, `node --test test/*.test.mjs`, `npm run build -- --local`, 저장점 커밋 뒤 `npm run bundle`.

이 저장점은 당시 2단계 상태를 기록한 과거 기록입니다. 옛 공개 커밋과 옛 배포가 접근 가능한 동안 과거 노출이 해소됐다고 기록하지 않습니다.

## 3단계 저장점

- 단계: `aleph.config.json`의 `step`은 `3`.
- 실제 프로덕션 주소: `https://choi-bujang-secret-vault-one-vert.vercel.app`.
- 로그인 발급자: Supabase Auth (`issuer`: `https://rluscctcdfqrrfaxdeya.supabase.co/auth/v1`, `audience`: `authenticated`, 공개 JWKS URL 기록).
- 허용 경로: `/api/notes`, `/api/notes/:id`.
- 원본 API/복구 경로: 아직 없음 (`originalApiUrl: null`, `restoreRoute: null`).
- 무로그인 자료 요청은 **401 + JSON `AUTH_REQUIRED`**로 거부되고, 로그인 사용자는 화면에서 메모 CRUD 가능. 목록 GET과 POST는 서버가 확인한 사용자 ID를 사용함.
- 현재 의도적으로 남은 약점: 단건 GET·PUT·DELETE에는 아직 `owner_id` 검사가 없어 다른 로그인 사용자의 메모 ID 접근을 4단계에서 막아야 함.
- 정적 `/data.json`은 **404**, `/aleph.json`은 배포에서 열리며, `X-Content-Type-Options: nosniff` 보안 헤더가 설정됨.
- 다시 확인: `npm ci`, `node --test test/*.test.mjs`, `npm run build -- --local`. `npm run bundle`은 3단계 `src/attack-check.mjs` 자기 점검이 최신 단계에 맞게 구현되기 전에는 완료됐다고 기록하지 않음.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 4단계에서는 단건 자료의 `owner_id` 소유권 검사를 추가하고, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.