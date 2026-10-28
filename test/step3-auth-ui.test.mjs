import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('화면은 Supabase SDK나 공개 키 없이 서버 Auth 함수만 사용한다', () => {
  assert.doesNotMatch(html, /@supabase\/supabase-js/i);
  assert.doesNotMatch(html, /sb_publishable_[A-Za-z0-9_-]+/i);
  assert.doesNotMatch(html, /SUPABASE_(?:PUBLISHABLE|ANON)_KEY/i);
  assert.doesNotMatch(html, /createClient\s*\(/);
  assert.match(html, /fetch\(['"]\/api\/auth\/login['"]/);
  assert.match(html, /fetch\(['"]\/api\/auth\/session['"]/);
  assert.match(html, /fetch\(['"]\/api\/auth\/logout['"]/);
});

test('로그인 전후 화면은 유지되고 로그인 실패 이유를 화면에 표시한다', () => {
  assert.match(html, /id="auth-signed-out"/);
  assert.match(html, /id="auth-signed-in"/);
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.match(html, /id="auth-error"/);
  assert.match(html, /signedOut\.hidden\s*=\s*Boolean\(session\)/);
  assert.match(html, /signedIn\.hidden\s*=\s*!session/);
});

test('메모 API는 브라우저 토큰 없이 same-origin 쿠키 세션을 사용한다', () => {
  assert.match(html, /(?:fetch|apiRequest)\(['"]\/api\/notes['"]/);
  assert.doesNotMatch(html, /Authorization\s*:/);
  assert.doesNotMatch(html, /access_token/);
});
