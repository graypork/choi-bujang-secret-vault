import assert from 'node:assert/strict';
import { test } from 'node:test';
import notesHandler from '../api/notes/read.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
function responseCapture() {
  const headers = new Map(); let status; let body;
  return { response: { setHeader: (key, value) => headers.set(key.toLowerCase(), value), status: (value) => { status = value; return { json: (value) => { body = value; } }; } }, result: () => ({ headers, status, body }) };
}

test('메모 API는 HttpOnly 세션 쿠키 access token도 기존 로그인 검증기로 확인한다', async () => {
  const capture = responseCapture(); let seenAuthorization;
  await notesHandler({ method: 'GET', headers: { cookie: 'aleph_access=verified.token.value' } }, capture.response, {
    verifyLoginAuthorization: async (authorization) => { seenAuthorization = authorization; return authorization === 'Bearer verified.token.value' ? { kind: 'student', userId: USER_ID } : null; },
    listLearningNotesImpl: async (userId) => { assert.equal(userId, USER_ID); return []; },
  });
  assert.equal(seenAuthorization, 'Bearer verified.token.value');
  assert.equal(capture.result().status, 200);
});

test('서버 로그인은 토큰을 JSON에 노출하지 않고 HttpOnly 쿠키로만 저장한다', async () => {
  const { default: loginHandler } = await import('../api/auth/login.js'); const capture = responseCapture();
  await loginHandler({ method: 'POST', body: { email: 'student', password: 'test-password' } }, capture.response, { signInWithPasswordImpl: async () => ({ accessToken: 'header.payload.signature', refreshToken: 'refresh-value', expiresIn: 3600, user: { email: 'student' } }) });
  const result = capture.result();
  assert.equal(result.status, 200); assert.deepEqual(result.body, { authenticated: true, user: { email: 'student' } });
  assert.equal(JSON.stringify(result.body).includes('header.payload.signature'), false); assert.equal(JSON.stringify(result.body).includes('refresh-value'), false);
  const cookies = result.headers.get('set-cookie'); assert.ok(Array.isArray(cookies));
  assert.ok(cookies.some((value) => /aleph_access=.*HttpOnly.*Secure.*SameSite=Lax/i.test(value)));
  assert.ok(cookies.some((value) => /aleph_refresh=.*HttpOnly.*Secure.*SameSite=Lax/i.test(value)));
});

test('서버 로그인 실패는 401 JSON이고 세션 쿠키를 만들지 않는다', async () => {
  const { default: loginHandler } = await import('../api/auth/login.js'); const capture = responseCapture();
  await loginHandler({ method: 'POST', body: { email: 'student', password: 'wrong' } }, capture.response, { signInWithPasswordImpl: async () => { const error = new Error('INVALID_LOGIN'); error.code = 'INVALID_LOGIN'; throw error; } });
  const result = capture.result(); assert.equal(result.status, 401); assert.deepEqual(result.body, { error: 'INVALID_LOGIN' }); assert.equal(result.headers.has('set-cookie'), false);
});

test('세션 확인은 쿠키 세션을 복구하고 필요하면 갱신 쿠키를 다시 설정한다', async () => {
  const { default: sessionHandler } = await import('../api/auth/session.js'); const capture = responseCapture();
  await sessionHandler({ method: 'GET', headers: { cookie: 'aleph_access=old; aleph_refresh=refresh' } }, capture.response, { resolveSessionImpl: async () => ({ user: { email: 'student' }, refreshed: { accessToken: 'new.header.signature', refreshToken: 'new-refresh', expiresIn: 3600 } }) });
  const result = capture.result(); assert.equal(result.status, 200); assert.deepEqual(result.body, { authenticated: true, user: { email: 'student' } }); assert.ok(Array.isArray(result.headers.get('set-cookie')));
});

test('로그아웃은 access/refresh 쿠키를 둘 다 만료시킨다', async () => {
  const { default: logoutHandler } = await import('../api/auth/logout.js'); const capture = responseCapture(); await logoutHandler({ method: 'POST' }, capture.response);
  const result = capture.result(); assert.equal(result.status, 200); assert.deepEqual(result.body, { authenticated: false }); const cookies = result.headers.get('set-cookie'); assert.ok(Array.isArray(cookies));
  assert.ok(cookies.some((value) => /aleph_access=.*Max-Age=0/i.test(value))); assert.ok(cookies.some((value) => /aleph_refresh=.*Max-Age=0/i.test(value)));
});
