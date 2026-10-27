import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import itemHandler, { deleteLearningNote, getLearningNote, updateLearningNote } from '../api/notes/item.js';

const A_ID = '11111111-1111-4111-8111-111111111111';
const B_ID = '22222222-2222-4222-8222-222222222222';
const NOTE_ID = '33333333-3333-4333-8333-333333333333';
const verifiedA = async () => ({ kind: 'student', userId: A_ID });
const dbOptions = createClientImpl => ({
  env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-server-key' },
  createClientImpl,
});

function recorder() {
  let statusCode;
  let body;
  return {
    response: {
      setHeader() {},
      status(value) {
        statusCode = value;
        return { json(value) { body = value; } };
      },
    },
    result: () => ({ statusCode, body }),
  };
}

function fakeClient(rows) {
  const operations = [];
  let index = 0;
  const query = {
    select(value) { operations.push(['select', value]); return this; },
    update(value) { operations.push(['update', value]); return this; },
    delete() { operations.push(['delete']); return this; },
    eq(key, value) { operations.push(['eq', key, value]); return this; },
    async maybeSingle() { return { data: rows[index++] ?? null, error: null }; },
  };
  return {
    operations,
    createClientImpl: () => ({ from: table => { operations.push(['from', table]); return query; } }),
  };
}

test('단건 API는 URL·본문 owner_id 대신 verifier의 userId를 사용한다', async () => {
  const get = recorder();
  const put = recorder();
  const del = recorder();
  let getArgs;
  let putArgs;
  let deleteArgs;

  await itemHandler({ method: 'GET', headers: { authorization: 'Bearer token' }, query: { id: NOTE_ID, owner_id: B_ID } }, get.response, {
    verifyLoginAuthorization: verifiedA,
    getLearningNoteImpl: async (...args) => { getArgs = args; return { id: NOTE_ID, title: 'A', body: 'body' }; },
  });
  await itemHandler({ method: 'PUT', headers: { authorization: 'Bearer token' }, query: { id: NOTE_ID, owner_id: B_ID }, body: { title: '수정', body: '본문', owner_id: B_ID } }, put.response, {
    verifyLoginAuthorization: verifiedA,
    updateLearningNoteImpl: async (...args) => { putArgs = args; return { id: NOTE_ID }; },
  });
  await itemHandler({ method: 'DELETE', headers: { authorization: 'Bearer token' }, query: { id: NOTE_ID, owner_id: B_ID } }, del.response, {
    verifyLoginAuthorization: verifiedA,
    deleteLearningNoteImpl: async (...args) => { deleteArgs = args; return { id: NOTE_ID }; },
  });

  assert.deepEqual(getArgs, [A_ID, NOTE_ID]);
  assert.deepEqual(putArgs, [A_ID, NOTE_ID, { title: '수정', body: '본문' }]);
  assert.deepEqual(deleteArgs, [A_ID, NOTE_ID]);
  assert.deepEqual(get.result().body, { id: NOTE_ID, title: 'A', body: 'body' });
});

test('단건 GET과 DELETE는 id와 owner_id를 함께 제한한다', async () => {
  const getDb = fakeClient([{ id: NOTE_ID, title: 'A', content: 'body', owner_id: A_ID }]);
  const delDb = fakeClient([{ id: NOTE_ID, owner_id: A_ID }]);

  assert.deepEqual(await getLearningNote(A_ID, NOTE_ID, dbOptions(getDb.createClientImpl)), { id: NOTE_ID, title: 'A', body: 'body' });
  assert.deepEqual(await deleteLearningNote(A_ID, NOTE_ID, dbOptions(delDb.createClientImpl)), { id: NOTE_ID });

  for (const operations of [getDb.operations, delDb.operations]) {
    assert.ok(operations.some(op => op[0] === 'eq' && op[1] === 'id' && op[2] === NOTE_ID));
    assert.ok(operations.some(op => op[0] === 'eq' && op[1] === 'owner_id' && op[2] === A_ID));
  }
});

test('PUT은 기존 행과 수정 결과 모두 본인 소유인지 확인하고 owner_id를 수정하지 않는다', async () => {
  const db = fakeClient([
    { id: NOTE_ID, owner_id: A_ID },
    { id: NOTE_ID, owner_id: A_ID },
  ]);

  assert.deepEqual(
    await updateLearningNote(A_ID, NOTE_ID, { title: '수정', body: '본문', owner_id: B_ID }, dbOptions(db.createClientImpl)),
    { id: NOTE_ID },
  );
  assert.deepEqual(db.operations.find(op => op[0] === 'update'), ['update', { title: '수정', content: '본문' }]);
  assert.equal(db.operations.filter(op => op[0] === 'eq' && op[1] === 'owner_id' && op[2] === A_ID).length, 2);
  assert.equal(db.operations.filter(op => op[0] === 'select' && /owner_id/u.test(op[1])).length, 2);
});

test('상대 메모는 자료 없이 404가 되고 allowedRoutes는 실제 CRUD 메서드·경로를 기록한다', async () => {
  for (const [method, key] of [['GET', 'getLearningNoteImpl'], ['PUT', 'updateLearningNoteImpl'], ['DELETE', 'deleteLearningNoteImpl']]) {
    const out = recorder();
    await itemHandler({ method, headers: { authorization: 'Bearer token' }, query: { id: NOTE_ID }, body: method === 'PUT' ? { title: 'x', body: 'y' } : undefined }, out.response, {
      verifyLoginAuthorization: verifiedA,
      [key]: async () => null,
    });
    assert.deepEqual(out.result(), { statusCode: 404, body: { error: 'NOT_FOUND' } });
  }

  const config = JSON.parse(await readFile(new URL('../aleph.config.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.allowedRoutes, [
    'GET /api/notes',
    'POST /api/notes',
    'GET /api/notes/:id',
    'PUT /api/notes/:id',
    'DELETE /api/notes/:id',
  ]);
});
