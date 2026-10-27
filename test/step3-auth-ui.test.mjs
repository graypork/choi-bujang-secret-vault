import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('3단계 화면은 공식 Supabase SDK의 이메일 비밀번호 로그인과 로그아웃 흐름을 사용한다', () => {
  assert.match(html, /@supabase\/supabase-js@2\.117\.2/);
  assert.match(html, /createClient\(/);
  assert.match(html, /signInWithPassword\(\{\s*email,\s*password\s*\}\)/s);
  assert.match(html, /onAuthStateChange\(/);
  assert.match(html, /signOut\(\{\s*scope:\s*['"]local['"]\s*\}\)/);
});

test('로그인 전후 화면은 서로 다르고 로그인 실패 이유를 화면에 표시한다', () => {
  assert.match(html, /id="auth-signed-out"/);
  assert.match(html, /id="auth-signed-in"/);
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.match(html, /id="auth-error"/);
  assert.match(html, /authError\.textContent\s*=\s*error\.code\s*\?/);
  assert.match(html, /signedOut\.hidden\s*=\s*Boolean\(session\)/);
  assert.match(html, /signedIn\.hidden\s*=\s*!session/);
});

test('인증 UI 추가 뒤에도 기존 메모 API 흐름은 유지한다', () => {
  assert.match(html, /(?:fetch|apiRequest)\(['"]\/api\/notes['"]/);
  assert.doesNotMatch(html, /localStorage\.setItem\([^\n]*(?:password|jwt|token)/i);
  assert.doesNotMatch(html, /(?:atob|btoa)\(/);
});
