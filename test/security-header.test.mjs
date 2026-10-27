import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

test('첫 화면 포함 모든 경로에 nosniff 보안 헤더를 설정한다', () => {
  assert.ok(Array.isArray(config.headers));
  const globalRule = config.headers.find((rule) => rule.source === '/(.*)');
  assert.ok(globalRule, '전역 headers 규칙이 필요함');
  assert.ok(
    globalRule.headers?.some((header) =>
      header.key === 'X-Content-Type-Options' && header.value === 'nosniff'),
    'X-Content-Type-Options: nosniff가 필요함',
  );
});
