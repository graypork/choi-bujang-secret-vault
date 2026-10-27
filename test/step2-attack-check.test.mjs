import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runAttackChecks } from '../src/attack-check.mjs';

const config = {
  step: 2,
  sampleMarker: 'SAMPLE_NOTE_1',
  publicAppUrl: 'https://student-defense.vercel.app',
};

test('2단계 공격 점검은 정적 data.json과 공개 서버 API를 실제로 확인한다', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  try {
    globalThis.fetch = async (url) => {
      const value = String(url);
      urls.push(value);
      if (value.endsWith('/data.json')) {
        return new Response('not found', { status: 404 });
      }
      if (value.endsWith('/api/notes')) {
        return new Response(JSON.stringify({ notes: [{ id: '1', title: '가상', content: '본문' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected URL: ${value}`);
    };

    const results = await runAttackChecks(config);
    assert.deepEqual(urls, [
      'https://student-defense.vercel.app/data.json',
      'https://student-defense.vercel.app/api/notes',
    ]);
    assert.equal(results.length, 2);
    assert.equal(results[0].attackId, 'anonymous_static_note_read');
    assert.match(results[0].observed, /HTTP 404/u);
    assert.equal(results[1].attackId, 'anonymous_server_note_read');
    assert.match(results[1].observed, /1건/u);
    assert.doesNotMatch(JSON.stringify(results), /본문/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
