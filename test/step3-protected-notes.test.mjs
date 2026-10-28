import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import handler from '../api/notes/read.js';

function responseCapture() {
  const headers = new Map();
  let status;
  let body;
  return {
    response: {
      setHeader: (key, value) => headers.set(key.toLowerCase(), value),
      status: (value) => {
        status = value;
        return { json: (value) => { body = value; } };
      },
    },
    result: () => ({ headers, status, body }),
  };
}

test('자료 API는 토큰이 없으면 자료를 읽지 않고 401로 거부한다', async () => {
  let reads = 0;
  const capture = responseCapture();
  await handler({ method: 'GET', headers: {} }, capture.response, {
    verifyLoginAuthorization: async () => ({ kind: 'student', userId: 'server-verified' }),
    readLearningNotesImpl: async () => { reads += 1; return [{ id: 'secret-note' }]; },
  });
  const result = capture.result();
  assert.equal(result.status, 401);
  assert.equal(reads, 0);
  assert.deepEqual(result.body, { error: 'AUTH_REQUIRED' });
});

test('자료 API는 토큰 검증 실패 시 자료를 읽지 않고 401로 거부한다', async () => {
  let reads = 0;
  const capture = responseCapture();
  await handler({ method: 'GET', headers: { authorization: 'Bearer invalid.invalid.invalid' } }, capture.response, {
    verifyLoginAuthorization: async () => null,
    readLearningNotesImpl: async () => { reads += 1; return [{ id: 'secret-note' }]; },
  });
  const result = capture.result();
  assert.equal(result.status, 401);
  assert.equal(reads, 0);
  assert.deepEqual(result.body, { error: 'AUTH_REQUIRED' });
});

test('자료 API는 검증된 로그인 요청만 자료를 반환한다', async () => {
  const capture = responseCapture();
  await handler({ method: 'GET', headers: { authorization: 'Bearer verified.token.value' } }, capture.response, {
    verifyLoginAuthorization: async (authorization) => {
      assert.equal(authorization, 'Bearer verified.token.value');
      return { kind: 'student', userId: '11111111-1111-4111-8111-111111111111' };
    },
    listLearningNotesImpl: async (userId) => {
      assert.equal(userId, '11111111-1111-4111-8111-111111111111');
      return [{ id: 'n1', title: 't', body: 'c' }];
    },
  });
  const result = capture.result();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, [{ id: 'n1', title: 't', body: 'c' }]);
});

test('자료 API 소스는 틀의 verify-login을 사용하고 브라우저 userId/role을 신뢰하지 않는다', async () => {
  const source = await readFile(new URL('../api/notes/read.js', import.meta.url), 'utf8');
  assert.match(source, /src\/verify-login\.mjs/u);
  assert.match(source, /createLoginVerifier/u);
  assert.doesNotMatch(source, /request\.(?:body|query)\??\.(?:userId|role)/u);
});

test('브라우저는 로그인 토큰을 다루지 않고 same-origin 서버 세션만 사용한다', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /Authorization\s*:/u);
  assert.doesNotMatch(html, /access_token/u);
  assert.match(html, /\/api\/auth\/session/u);
  assert.match(html, /로그인 후 자료/u);
  assert.doesNotMatch(html, /(?:userId|role)\s*:/u);
});

test('현재 설정은 Supabase Auth 발급자와 실제 CRUD 메서드·경로를 기록한다', async () => {
  const config = JSON.parse(await readFile(new URL('../aleph.config.json', import.meta.url), 'utf8'));
  assert.equal(config.step, 5);
  assert.deepEqual(config.identityProvider, {
    issuer: 'https://rluscctcdfqrrfaxdeya.supabase.co/auth/v1',
    audience: 'authenticated',
    jwksUrl: 'https://rluscctcdfqrrfaxdeya.supabase.co/auth/v1/.well-known/jwks.json',
  });
  assert.deepEqual(config.allowedRoutes, ['GET /api/notes', 'POST /api/notes', 'GET /api/notes/:id', 'PUT /api/notes/:id', 'DELETE /api/notes/:id']);
});
