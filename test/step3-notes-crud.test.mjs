import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import collectionHandler from '../api/notes/read.js';

const A_ID = '11111111-1111-4111-8111-111111111111';
const B_ID = '22222222-2222-4222-8222-222222222222';
const NOTE_ID = '33333333-3333-4333-8333-333333333333';
const root = new URL('../', import.meta.url);

function responseRecorder() {
  const headers = new Map();
  let statusCode;
  let body;
  return {
    response: {
      setHeader(name, value) { headers.set(name.toLowerCase(), value); },
      status(value) {
        statusCode = value;
        return { json(value) { body = value; } };
      },
    },
    result() { return { headers, statusCode, body }; },
  };
}

const verifiedA = async () => ({ kind: 'student', userId: A_ID });
const verifiedB = async () => ({ kind: 'student', userId: B_ID });

async function itemHandler() {
  return (await import('../api/notes/item.js')).default;
}

test('목록 GET은 서버가 확인한 userId만 store에 넘기고 메모 배열을 직접 반환한다', async () => {
  const recorder = responseRecorder();
  let receivedUserId;
  await collectionHandler({ method: 'GET', headers: { authorization: 'Bearer test.token.value' } }, recorder.response, {
    verifyLoginAuthorization: verifiedA,
    listLearningNotesImpl: async userId => {
      receivedUserId = userId;
      return [{ id: NOTE_ID, title: '제목', body: '본문' }];
    },
  });
  assert.equal(receivedUserId, A_ID);
  assert.equal(recorder.result().statusCode, 200);
  assert.deepEqual(recorder.result().body, [{ id: NOTE_ID, title: '제목', body: '본문' }]);
});

test('POST는 verified userId와 {id,title,body}를 사용해 만들고 {id}를 반환한다', async () => {
  const recorder = responseRecorder();
  let received;
  await collectionHandler({
    method: 'POST',
    headers: { authorization: 'Bearer test.token.value' },
    body: { title: '새 메모', body: '새 본문' },
  }, recorder.response, {
    verifyLoginAuthorization: verifiedA,
    createLearningNoteImpl: async (userId, input) => {
      received = { userId, input };
      return { id: NOTE_ID };
    },
  });
  assert.deepEqual(received, { userId: A_ID, input: { title: '새 메모', body: '새 본문' } });
  assert.equal(recorder.result().statusCode, 201);
  assert.deepEqual(recorder.result().body, { id: NOTE_ID });
});

test('POST 무로그인 요청은 store 호출 없이 401로 거부한다', async () => {
  const recorder = responseRecorder();
  let called = false;
  await collectionHandler({ method: 'POST', headers: {}, body: { title: 'x', body: 'y' } }, recorder.response, {
    createLearningNoteImpl: async () => { called = true; },
  });
  assert.equal(called, false);
  assert.equal(recorder.result().statusCode, 401);
  assert.deepEqual(recorder.result().body, { error: 'AUTH_REQUIRED' });
});

test('단건 GET은 verified userId와 id를 store에 넘겨 {id,title,body}를 반환한다', async () => {
  const handler = await itemHandler();
  const recorder = responseRecorder();
  let args;
  await handler({ method: 'GET', headers: { authorization: 'Bearer test.token.value' }, query: { id: NOTE_ID } }, recorder.response, {
    verifyLoginAuthorization: verifiedA,
    getLearningNoteImpl: async (...received) => {
      args = received;
      return { id: NOTE_ID, title: 'A 메모', body: '본문' };
    },
  });
  assert.deepEqual(args, [A_ID, NOTE_ID]);
  assert.equal(recorder.result().statusCode, 200);
  assert.deepEqual(recorder.result().body, { id: NOTE_ID, title: 'A 메모', body: '본문' });
});

test('단건 PUT은 verified userId, /:id와 {title,body}로 수정한다', async () => {
  const handler = await itemHandler();
  const recorder = responseRecorder();
  let args;
  await handler({
    method: 'PUT', headers: { authorization: 'Bearer test.token.value' }, query: { id: NOTE_ID },
    body: { title: '수정', body: '수정 본문' },
  }, recorder.response, {
    verifyLoginAuthorization: verifiedA,
    updateLearningNoteImpl: async (...received) => { args = received; return { id: NOTE_ID }; },
  });
  assert.deepEqual(args, [A_ID, NOTE_ID, { title: '수정', body: '수정 본문' }]);
  assert.equal(recorder.result().statusCode, 200);
  assert.deepEqual(recorder.result().body, { id: NOTE_ID });
});

test('단건 DELETE 뒤 같은 id GET은 404가 될 수 있는 계약을 사용한다', async () => {
  const handler = await itemHandler();
  let exists = true;
  const deleteRecorder = responseRecorder();
  await handler({ method: 'DELETE', headers: { authorization: 'Bearer test.token.value' }, query: { id: NOTE_ID } }, deleteRecorder.response, {
    verifyLoginAuthorization: verifiedA,
    deleteLearningNoteImpl: async (userId, id) => { assert.equal(userId, A_ID); assert.equal(id, NOTE_ID); exists = false; return { id }; },
  });
  assert.equal(deleteRecorder.result().statusCode, 200);

  const getRecorder = responseRecorder();
  await handler({ method: 'GET', headers: { authorization: 'Bearer test.token.value' }, query: { id: NOTE_ID } }, getRecorder.response, {
    verifyLoginAuthorization: verifiedA,
    getLearningNoteImpl: async () => exists ? { id: NOTE_ID, title: 'x', body: 'y' } : null,
  });
  assert.equal(getRecorder.result().statusCode, 404);
  assert.deepEqual(getRecorder.result().body, { error: 'NOT_FOUND' });
});

test('단건 무로그인 요청은 자료 없이 401로 거부한다', async () => {
  const handler = await itemHandler();
  const recorder = responseRecorder();
  let called = false;
  await handler({ method: 'GET', headers: {}, query: { id: NOTE_ID } }, recorder.response, {
    getLearningNoteImpl: async () => { called = true; return null; },
  });
  assert.equal(called, false);
  assert.equal(recorder.result().statusCode, 401);
});

test('서버 소스는 목록·생성·단건 CRUD 모두 verified owner_id를 사용한다', async () => {
  const collection = await readFile(new URL('../api/notes/read.js', import.meta.url), 'utf8');
  const item = await readFile(new URL('../api/notes/item.js', import.meta.url), 'utf8');
  assert.match(collection, /eq\(['"]owner_id['"],\s*userId\)/u);
  assert.match(collection, /owner_id:\s*userId/u);
  assert.match(item, /owner_id/u);
  assert.doesNotMatch(collection, /request\.(?:body|query)(?:\?\.)?(?:userId|role)/u);
  assert.doesNotMatch(item, /request\.(?:body|query)(?:\?\.)?(?:userId|role)/u);
});

test('Vercel은 컬렉션과 /:id 실제 경로를 서버 함수에 연결한다', async () => {
  const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(vercel.rewrites.some(rule => rule.source === '/api/notes' && rule.destination === '/api/notes/read'));
  assert.ok(vercel.rewrites.some(rule => rule.source === '/api/notes/:id' && rule.destination === '/api/notes/item?id=:id'));
});

test('CRUD 화면과 allowedRoutes는 실제 컬렉션/단건 경로를 사용한다', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const config = JSON.parse(await readFile(new URL('../aleph.config.json', import.meta.url), 'utf8'));
  assert.match(html, /id=['"]note-form['"]/u);
  assert.match(html, /method:\s*['"]POST['"]/u);
  assert.match(html, /method:\s*['"]PUT['"]/u);
  assert.match(html, /method:\s*['"]DELETE['"]/u);
  assert.match(html, /note\.body/u);
  assert.deepEqual(config.allowedRoutes, ['GET /api/notes', 'POST /api/notes', 'GET /api/notes/:id', 'PUT /api/notes/:id', 'DELETE /api/notes/:id']);
});

// Guard the starter verifier as requested.
test('틀의 src/verify-login.mjs는 이 단계에서 수정 대상이 아니다', async () => {
  await access(new URL('../src/verify-login.mjs', import.meta.url));
});
