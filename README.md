# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 만든 자료실을 단계별로 보호하는 실습 저장소입니다. 포함되는 기록은 모두 가상 자료이며 실제 학생 자료, 토큰, 비밀키를 코드나 Git에 넣지 않습니다.

## 현재 상태: 10단계 「백업에서 자료실을 되살립니다」 (복원 기능 부분 구현)

로그인은 `/api/auth/login`, `/api/auth/session`, `/api/auth/logout` 서버 함수를 통해 처리하고, 브라우저는 Supabase SDK·공개 키 대신 HttpOnly 쿠키 기반 세션을 사용합니다. 메모 목록·추가·수정·삭제는 모두 `/api/notes`와 `/api/notes/:id` 서버 함수만 사용합니다. 서버 함수는 기존 `src/verify-login.mjs`로 로그인 사용자를 확인하고 `id + owner_id` 소유권 검사를 유지하며, 서버 전용 Supabase 설정으로 `public.learning_notes`를 읽고 고칩니다. 브라우저의 `userId`·`role`이나 URL·본문의 `owner_id`는 신뢰하지 않습니다.

한 건 응답은 `{id,title,body}`, 수정 본문은 `{title,body}`를 유지합니다. `public/data.json`은 계속 배포하지 않으며 `/aleph.json`은 빌드에서 생성됩니다. 첫 화면과 API 응답에는 `X-Content-Type-Options: nosniff` 헤더를 적용합니다.

### 현재 5단계 방어 상태

`public.learning_notes`의 직접 테이블 권한은 `PUBLIC`, `anon`, `authenticated`에서 모두 회수했고 서버 함수에 필요한 `service_role` 권한은 유지했습니다. 기존 RLS 소유권 정책도 그대로 남겨 두었습니다. `aleph.config.json`의 `originalApiUrl`에는 쿼리 없는 Supabase REST 원본 경로를 기록했습니다. 공개 publishable/anon 키로 그 원본 경로를 직접 요청하면 401과 `permission denied for table learning_notes`가 반환됩니다. 실제 앱에서는 A 계정의 메모 읽기·추가·수정·삭제가 서버 함수 경유로 정상 동작하는 것을 확인했습니다.

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

`aleph.config.json`의 현재 단계는 `9`입니다. `repoUrl`과 `publicAppUrl`은 각각 저장소와 프로덕션 배포 주소를 기록합니다. `identityProvider`에는 Supabase Auth의 공개 issuer/audience/JWKS 정보가 있습니다. 현재 `allowedRoutes`는 `GET /api/notes/:id`, `PUT /api/notes/:id`, `DELETE /api/notes/:id`, `GET /api/announcements`, `GET /api/announcements/:id`, `GET /notes/:id`의 여섯 경로입니다. `GET /notes/:id`는 판정기에서 가상 요청의 단건 읽기 경로로 허용하며 실제 서버 API 경로를 새로 개설한 것은 아닙니다. `originalApiUrl`에는 쿼리 없는 Supabase REST 원본 경로를 기록하며 비밀키는 넣지 않습니다.

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

## 4단계 저장점

- `aleph.config.json`의 `step`은 `4`.
- API 소유권 검사 커밋: `927b1a32857db4e7a0f8f13c8a2abe105b81737e` (`Enforce note ownership in API`).
- 목록 GET과 POST는 서버가 검증한 사용자 ID를 사용하고, POST는 그 ID를 `owner_id`로 저장함.
- 단건 GET·PUT·DELETE는 `id + owner_id`를 함께 제한하며 상대 소유 메모는 자료를 노출하지 않고 404 처리함.
- PUT은 기존 행과 수정 결과 모두 본인 소유인지 확인하며 `{title,body}`만 갱신해 `owner_id` 변경을 허용하지 않음.
- 실제 CRUD 메서드·경로 5개가 `allowedRoutes`에 기록됨.
- `public.learning_notes`는 RLS 활성화. 정책은 SELECT·INSERT·UPDATE·DELETE 4개이며 모두 `auth.uid() = owner_id` 소유권 조건을 사용함. UPDATE는 `USING`과 `WITH CHECK`를 모두 적용함.
- 테이블 권한은 `anon`에 없음. `authenticated`에는 SELECT·INSERT·UPDATE·DELETE만 있고 TRUNCATE·REFERENCES·TRIGGER는 없음.
- 학습 데이터는 A 소유 4건, B 소유 1건, `owner_id IS NULL` 0건으로 확인함.
- 실제 앱 로그인 확인에서 A는 A 메모만, B는 B 메모만 보였음.
- 이 DB 설정은 `public.learning_notes` 한 테이블에만 적용했으며 다른 테이블은 변경하지 않음.

## 5단계 저장점

- `aleph.config.json`의 `step`은 `5`.
- 최신 구현에서는 로그인·세션·로그아웃도 `/api/auth/*` 서버 함수로 처리하고 HttpOnly 쿠키를 사용함. 브라우저의 Supabase SDK·공개 키는 제거했으며, 메모 CRUD는 서버 함수 `/api/notes`, `/api/notes/:id`로만 요청함.
- 서버 함수의 로그인 검증, `owner_id` 소유자 검사, 서버 전용 Supabase 설정은 그대로 유지함.
- `public.learning_notes`의 `PUBLIC`, `anon`, `authenticated` 직접 테이블 권한은 모두 없음. `service_role`의 서버 작업 권한은 유지됨.
- 기존 RLS 소유권 정책 4개는 유지하며 다른 테이블은 변경하지 않음.
- `originalApiUrl`은 쿼리 없는 Supabase REST 원본 HTTPS 경로로 기록됨.
- publishable/anon 키로 원본 경로를 직접 요청하면 **401 + permission denied**로 거부됨.
- 실제 앱에서 A 계정의 목록 읽기·추가·수정·삭제가 서버 함수 경유로 정상 동작함.
- 다시 확인: `npm ci`, `node --test test/*.test.mjs`, `npm run build -- --local`, 저장점 커밋 뒤 `npm run bundle`.

## 6단계 기기 등록 판정 — 로컬 확인 순서

1. 저장소 루트에서 `npm run decider:test`를 실행합니다. 별도 접속 프로그램 설치는 필요하지 않습니다.
2. 출력에서 `통과 · 등록 기기의 정상 요청`을 확인합니다. 등록 기기(`deviceRegistered: true`)의 판정은 `allow`, 이유 코드는 `approved`입니다.
3. 출력에서 `통과 · 미등록 기기의 가상 요청`을 확인합니다. 미등록 기기(`deviceRegistered: false`)의 판정은 `deny`, 이유 코드는 `device_not_registered`입니다. 값이 누락되어도 같은 이유로 거부합니다.
4. 거부 이유 코드까지 직접 확인하려면 아래 명령을 실행합니다.

```bash
node --input-type=module -e "import {decide} from './src/decider.mjs'; const r=await decide({requestId:'fixture-unregistered',deviceRegistered:false}); console.log(r.decision,r.reasonCode);"
```

정상 출력은 `deny device_not_registered`입니다. 2026-11-05 로컬 가상 요청 테스트에서 등록·미등록 항목 모두 통과했고 미등록 응답의 `decision: deny`, `reasonCode: device_not_registered`를 확인했습니다. 이 확인은 운영 엔진의 실제 기기 등록이나 심판의 미등록 기기 공격 결과를 뜻하지 않습니다. 실제 미등록 기기 공격은 심판이 수행합니다. 인증서·CA·서명 키나 별도 접속 프로그램은 생성·설치하지 않습니다.

## 6단계 저장점

- `aleph.config.json`의 `step`은 `6`이며, 실제 배포 주소·`judgeIssuer`·`identityProvider`·메모 API 허용 경로 5개·`originalApiUrl`은 기존 값을 유지합니다.
- `src/decider.mjs`의 유일한 규칙 `device_registered`는 `deviceRegistered === true`일 때 `allow / approved`, 미등록 또는 누락일 때 `deny / device_not_registered`를 반환합니다.
- `npm run decider:test` 로컬 가상 요청 테스트에서 등록 기기 허용과 미등록 기기 거부 2건을 확인했습니다. 실제 심판의 미등록 기기 공격 결과는 아직 확인하지 않았습니다.
- 기존 서버 로그인·HttpOnly 쿠키·메모 CRUD·소유권 검사는 보존했습니다. 별도 접속 프로그램이나 인증서·서명 키는 설치·생성하지 않았습니다.
- 재확인: `npm run decider:test`; 전체 회귀 확인은 `node --test test/*.test.mjs`, `npm run build -- --local`; 저장점 커밋 후 제출 묶음은 `npm run bundle`로 실행합니다.

## 7단계 저장점

- `aleph.config.json`의 `step`은 `7`입니다. 기존 배포 주소, GitHub 주소, 로그인 발급자, 심판 주소, 허용 경로와 원본 API 주소는 변경하지 않았습니다.
- `src/decider.mjs`는 기존 `device_registered` 규칙을 유지하며 `step_up_required`를 추가했습니다. 엔진 계약의 `signals`, `recentEvents`, `stepUp`만 사용합니다.
- 출처가 `judge_fixture`인 가상 요청에서 새벽 0~5시, `unusual` 네트워크, 최근 300초 이내 `risk_signal` 10건 이상이 함께 나타나면 `step_up / step_up_required`를 반환합니다. 지역 하나만으로 영구 차단하지 않습니다.
- `stepUp.verified === true`이고 `authAgeSeconds`가 0~300이면 같은 가상 복합 사건의 새 요청을 `allow`로 판정합니다. 이는 실제 재로그인 완료 시각이나 실제 자료 차단 실측이 아닙니다.
- `npm run decider:test`와 `npm run fixture:7`의 가상 시험에서 정상 허용·미등록 거부·복합 이상 추가 확인·확인 후 허용을 확인했습니다. 실제 엔진의 재로그인 전 자료 차단 및 새 로그인 후 접근 허용은 **미실행**입니다.
- 재확인: `npm run decider:test`, `npm run fixture:7`; 회귀 확인: `node --test test/*.test.mjs`, `npm run build -- --local`. `npm run bundle`은 별도 제출 묶음 점검이며 성공 여부를 따로 기록합니다.

## 8단계 저장점

- `aleph.config.json`의 `step`은 `8`입니다. 기존 배포 주소, `judgeIssuer`, Supabase 로그인 발급자, 원본 API 주소와 자료는 유지합니다.
- 판정기 `resource_zone` 규칙은 서비스·메서드·정확한 경로 모양으로 메모 단건(`GET/PUT/DELETE /api/notes/:id`)과 반 공지 조회(`GET /api/announcements`, `GET /api/announcements/:id`)만 허용합니다. 메모 목록·공지 쓰기·강사 자료·알 수 없는 경로는 거부합니다. 메모 ID를 UUID로 제한하지 않으며 기능 경로를 단건 ID로 오인하지 않습니다.
- 기존 `device_registered`, `step_up_required` 규칙을 유지합니다. `allowedRoutes`는 위 다섯 경로와 엔진 가상 요청용 `GET /notes/:id`를 합한 여섯 경로만 포함합니다. 이 추가 경로도 메모 단건 GET만 허용하며 목록·기능 경로는 거부합니다.
- 서버 메모 API는 검증된 사용자 ID와 저장된 `owner_id`로 단건 접근을 제한하고, 메모 목록·생성 직접 요청은 `403 RESOURCE_ZONE_DENIED`로 거부합니다. 타인 소유 메모는 `404 NOT_FOUND`로 자료를 숨깁니다. 기존 화면의 목록·추가 기능도 이 변경의 영향을 받습니다.
- 강사 역할 저장소 및 실제 공지·강사 자료 API는 구현되지 않았습니다. 반 공지 조회는 판정기 정책만 존재하며, 실제 강사 권한 검증이 완료됐다는 뜻이 아닙니다.
- 가상 판정 및 API 요청에서 단건 허용, 목록·쓰기·강사 자료 거부, 타인 메모 거부를 확인했습니다. 운영 심판·실제 배포 검증은 미실행입니다. 과거 단계 테스트 일부는 변경 전 `step`·`allowedRoutes`를 기대하여 실패합니다.
- 재확인: `npm run decider:test`, `npm run fixture:7`, `node --test test/step4-owner-api.test.mjs` (과거 경로 목록 기대에 따른 실패 가능). 제출 묶음은 저장점 커밋 후 `npm run bundle`로 별도 확인합니다.

## 9단계 저장점

- `aleph.config.json`의 `step`은 `9`입니다. 기존 배포 주소, `judgeIssuer`, 로그인 발급자, 원본 API 주소 및 허용 경로는 유지합니다.
- `src/detect.mjs`는 가상 사건의 `at`·`method`·`identity.sub`만 읽고, 같은 가명 사용자의 GET이 임의의 10분 구간에서 120건을 초과하면 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject: sub }`를 반환합니다. 그 밖에는 `{ action: 'observe' }`만 반환합니다.
- 정확히 120건, 다른 사용자 사건의 합산, 10분 밖의 사건, GET 외 요청은 회수 제안 대상이 아닙니다. 메모 본문·토큰·실명·기기·네트워크·지역은 읽거나 출력하지 않습니다.
- `npm run detect:test` 가상 사건 6건과 추가 경계 사례 5건이 통과했습니다. 실제 운영 사건 전달·접속 회수·심판 판정은 검증하지 않았으며, 회수 API나 기기 권한은 변경하지 않았습니다.
- 재확인: `npm run detect:test`, `npm run decider:test`. 저장점 커밋 후 `npm run bundle`로 제출 묶음을 별도 확인합니다.

## 10단계 저장점

- `aleph.config.json.step`은 `10`으로 기록합니다. 실제 배포 주소, 로그인 발급자, 심판 주소, 원본 API 주소, 기존 허용 경로는 변경하지 않았으며 `restoreRoute`는 구현 전이므로 `null`입니다.
- `scripts/policy-restore.mjs`는 정책 사본·SHA-256, 시험 정책 변경 비교 및 확인 토큰을 이용한 **시험 사본만의 복원**을 지원합니다. DB 정책 내보내기가 확인되지 않으면 검증과 복원을 중단합니다. 실제 DB 정책은 복원하지 않습니다.
- 시험 계정 B의 비공개 가상 메모 사본과 ID·소유자·내용 해시가 확보되지 않아 **단건 POST 복원 API는 코드 구현(운영 미검증)**, 실제 메모 복원은 미실행입니다. 임의의 복원 ID나 성공 결과를 기록하지 않습니다.
- 아래 1~9단계 회귀 검증 표는 실행 순서와 기대 결과이며, 이번 저장점에서 실제 운영 검증·복구·심판 판정을 수행하지 않았습니다. 기존 소유권 검사와 정책을 유지합니다.
- 재확인: `node scripts/policy-restore.mjs verify` (DB 사본 미확보 시 안전 중단), `npm run decider:test`, `npm run detect:test`, `npm run fixture:7`; 제출 묶음은 `npm run bundle`을 별도 실행하고 실제 결과만 기록합니다.

## 10단계 단건 복원 POST (코드 구현, 운영 미검증)

- 서비스: `learning_notes`의 **시험 계정 B 소유 가상 메모 한 건**. 경로: `POST /api/notes/restore/:id` (`aleph.config.json.restoreRoute`). Vercel 재작성 규칙에서 일반 단건 경로보다 먼저 매칭합니다. 운영 배포는 **미확인**입니다.
- 비공개 사본은 **서버 전용** 환경변수 `RESTORE_NOTE_BACKUP_JSON`에 보관하고, 시험 B의 UUID는 `RESTORE_B_OWNER_ID`로 설정합니다. 실제 값이나 메모 본문은 Git·README·공개 환경변수에 넣지 않습니다. JSON 형식: `{"version":"aleph.note.backup.v1","id":"<UUID>","owner_id":"<B UUID>","title":"<가상 제목>","content":"<가상 본문>","contentSha256":"<본문 UTF-8 SHA-256>"}`. **복원 대상 ID는 비공개 사본 미확보로 미확정**이며 임의로 정하지 않습니다.
- 두 요청 모두 시험 B로 검증된 **Authorization: Bearer** 헤더가 필요합니다. 본문 `{"mode":"preview"}`를 먼저 POST하면 **쓰기 없이** 사본 버전, 대상 ID·소유자·본문 SHA-256, 변경 범위, 확인 토큰을 보여 줍니다. 사용자가 확인한 뒤 **같은 경로**에 `{"mode":"apply","confirmation":"<preview의 확인 토큰>"}`을 POST해야 삽입을 시도합니다. 브라우저 쿠키만으로 복원할 수 없습니다.
- 서버는 백업 형식·본문 해시·B 소유자·경로 ID·DB에 대상 ID가 없는지 확인합니다. 사본이 없거나 검증 실패, 다른 소유자, 대상 행이 이미 존재하면 **중단**합니다. 성공 후 DB 반환 행의 ID·소유자·본문 해시를 재검증합니다. 대상 한 행의 INSERT 외 다른 메모·감사 기록·DB 정책은 수정하지 않습니다.
- **제약:** 사본은 배포자가 별도 검증해 제공해야 합니다. 현재 코드는 사본 출처의 진위를 독립적으로 증명하지 못하며, 삽입 후 검증 실패 시 자동 롤백을 수행하지 않습니다. 실 DB·B 계정 시험은 **미실행**입니다. 이 경로는 8단계의 일반 메모 목록·생성 차단을 해제하지 않습니다.
- 실행 예시(비밀 토큰은 셸 환경변수로만 주입): `curl -X POST "$APP_URL/api/notes/restore/$RESTORE_NOTE_ID" -H "Authorization: Bearer $B_ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"mode":"preview"}'`. 응답의 확인 토큰을 검토한 후에만 apply를 수행합니다. 예상 거부: A 계정 403, 사본 누락 503, 기존 대상 409, 확인 토큰 불일치 400.
- 화면에서 확인: Vercel 프로젝트의 **Settings → Environment Variables**에서 서버 전용 설정 유무를 확인하고, **Deployments**에서 실제 반영 여부를 확인합니다. 설정 값은 채팅·Git에 붙여 넣지 않습니다.

## 10단계 복구 후 1~9단계 회귀 검증 절차 (전 항목 미실행)

이 절은 **실행 순서와 기대 결과**만 기록합니다. 현재 시험 계정 B의 비공개 메모 사본(ID·소유자·내용 해시)이 확보되지 않았고, 단건 POST 복원 API는 코드만 구현됐고 비공개 사본이 없어 복구 성공을 주장하지 않습니다. 10단계 시험 정책 복원 도구는 실제 운영 DB 복원이 아닙니다. 아래의 **미실행**은 통과 또는 실패가 아닙니다.

### 실행 전 확인 및 중단 조건

1. **미실행 — 복원 버전과 범위:** 안전 정책 사본의 기준 커밋, `src/decider.mjs` 해시, `allowedRoutes` 해시, 실제 DB의 RLS·권한 정책 사본과 해시를 확인합니다. DB 정책 사본이 없거나 불일치하면 중단합니다. `node scripts/policy-restore.mjs verify`는 로컬 사본 검증이며 실제 DB 정책의 현행 상태를 확인하는 명령이 아닙니다.
2. **미실행 — 단건 자료 지정:** 비공개 가상 백업에서 **B 소유 메모 한 건**의 UUID, 서버가 확인한 B의 소유자 UUID, 제목·본문의 사전에 정한 정규화 방식에 따른 SHA-256을 기록합니다. README에는 메모 본문·인증 정보·비공개 사본을 넣지 않습니다. 대상 ID는 **미확정**이며 임의 ID를 사용하지 않습니다.
3. **미실행 — 변경 계획 승인:** 실행 전에 복원할 메모 ID·소유자·내용 해시, 복원 전 상태(없음/존재), 바뀔 행 1건과 적용할 정책 범위를 출력하고 승인받습니다. 다른 메모·다른 서비스 규칙·감사 이력은 변경 대상에서 제외합니다. 복원 경로가 구현·승인되지 않았다면 **POST를 보내지 않습니다**.
4. **미실행 — 복구 전 스냅샷:** 대상 메모의 복원 전 존재 여부, 다른 메모의 ID·소유자·내용 해시 목록, 감사 기록의 개수/식별자, 정책 해시를 비공개로 확보합니다. 운영 DB에 접근할 수 없으면 중단합니다.

### 복구 직후 순서: 자료와 정책

| 순서 | 확인 대상 및 방법 | 기대 결과 | 상태 |
|---|---|---|---|
| 1 | 승인된 B의 단건 복원 경로로 대상 **한 건만** 복구 (경로 미구현, 요청 금지) | B 소유 ID·owner_id·내용 SHA-256이 비공개 사본과 정확히 일치 | 미실행 |
| 2 | 다른 메모 및 감사 이력의 복구 전후 ID·해시·건수 비교 | 대상 외 메모 불변, 감사 기록 보존 | 미실행 |
| 3 | `src/decider.mjs`, `allowedRoutes`, DB RLS·GRANT의 복구 전후 해시 비교 | 검증된 안전 정책과 일치, 다른 서비스 정책 불변 | 미실행 |
| 4 | 비로그인 `GET /data.json` 및 `GET /api/notes/:id` | 공개 정적 메모 없음(404), 인증 없는 단건 API 거부(401) | 미실행 |
| 5 | B로 로그인 후 **B 소유 복구 대상** `GET /api/notes/:id` | 200, ID·소유자(DB 조회)·내용 해시가 백업과 일치 | 미실행 |
| 6 | A로 로그인 후 **B 소유 대상** `GET/PUT/DELETE /api/notes/:id` | 모두 404, B 자료 노출·변경 없음 | 미실행 |
| 7 | B로 로그인 후 **A 소유 메모** `GET/PUT/DELETE /api/notes/:id` | 모두 404, A 자료 노출·변경 없음 | 미실행 |
| 8 | A의 본인 소유 메모 단건 GET, 승인된 범위에서 PUT 후 GET | 정상 인증·소유권 검사 후 성공, B 대상 불변; 원래 값으로 복구 후 해시 재확인 | 미실행 |
| 9 | `GET/POST /api/notes`와 직접 Supabase REST 테이블 접근 | 현행 8단계 정책상 목록·생성 403, 공개 DB 직접 접근 권한 거부 | 미실행 |

### 판정기·탐지기 회귀 순서

| 단계 | 실행/점검 | 기대 결과 | 상태 |
|---|---|---|---|
| 1~2 | `npm ci`, `npm run build -- --local`, 비로그인 공개 파일 점검 | 의존성·로컬 빌드 성공, 공개 가상 메모 미노출 | 미실행 |
| 3~5 | 로그인·세션·로그아웃, A/B 단건 소유권 시험, 원본 DB 직접 접근 차단 | 유효한 로그인만 허용, 교차 소유자 404, 직접 테이블 권한 거부 | 미실행 |
| 6 | `npm run decider:test` | 등록 기기 허용, 미등록 기기 거부 | 미실행 |
| 7 | `npm run fixture:7` 및 `npm run decider:test` | 복합 이상 신호 step_up, 검증된 재확인 후 allow | 미실행 |
| 8 | `docs/DECIDER_REQUEST.md` 계약에 맞는 가상 단건·공지 GET, 목록·강사 자료·금지 경로 요청 | 허용 구역 allow, 금지 구역 deny; 실제 공지 API 존재를 뜻하지 않음 | 미실행 |
| 9 | `npm run detect:test` | 120건 observe, 동일 가명 사용자의 10분 내 121건 GET은 propose_revocation | 미실행 |

과거 테스트 일부는 당시의 `allowedRoutes`를 가정하여 현재 단계에서 실패할 수 있으므로 실패 원인을 구분해 기록합니다. `npm run bundle`은 마지막에 별도 실행하고 실제 결과만 적습니다. **로컬 가상 판정은 운영 권한 회수나 심판 판정의 증거가 아닙니다.** 복원 후에도 금지 요청이 성공하거나 다른 메모·감사 기록의 해시가 달라지면 즉시 검증을 중단하고 원인을 확인합니다. 자동 DB 롤백이나 `git reset --hard`는 실행하지 않습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 5단계의 서버 함수 집중 경로, 원본 API 주소 기록, 원본 테이블 직접 권한 회수와 A CRUD 확인은 완료됐습니다. 9단계 탐지 규칙은 가상 사건 기준으로 구현됐으며, 운영 사건 전달·회수 집행 연결은 별도로 검증해야 합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
