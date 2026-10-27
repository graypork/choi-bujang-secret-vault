import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('2단계 화면은 정적 data.json 대신 서버 함수에서 메모를 읽는다', async () => {
  const html = await text('public/index.html');
  assert.match(html, /(?:fetch|apiRequest)\(['"]\/api\/notes['"]/u);
  assert.doesNotMatch(html, /fetch\(['"]\/data\.json['"]/u);
});

test('2단계 빌드는 public data.json을 만들지 않고 aleph.json 생성은 유지한다', async () => {
  const build = await text('scripts/build-public.mjs');
  assert.match(build, /public.*data\.json|data\.json/u);
  assert.match(build, /rm\(/u);
  assert.doesNotMatch(build, /writeFile\([^\n]*data\.json/u);
  assert.match(build, /public.*aleph\.json|aleph\.json/u);
});

test('서버 함수는 서버 환경변수로 learning_notes를 읽고 공개 응답에는 필요한 필드만 보낸다', async () => {
  const source = await text('api/notes/read.js');
  assert.match(source, /SUPABASE_URL/u);
  assert.match(source, /SUPABASE_SECRET_KEY/u);
  assert.match(source, /from\(['"]learning_notes['"]\)/u);
  assert.match(source, /select\(['"]id, title, content['"]\)/u);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)/u);
});

test('README는 서버 함수가 아직 공개 주소라는 약점을 기록한다', async () => {
  const readme = await text('README.md');
  assert.match(readme, /\/api\/notes/u);
  assert.match(readme, /공개/u);
  assert.match(readme, /SUPABASE_SECRET_KEY/u);
  assert.match(readme, /브라우저/u);
});

test('public data.json 정적 파일은 저장소에서 제거된다', async () => {
  await assert.rejects(access(new URL('public/data.json', root), constants.F_OK));
});

test('Vercel은 공개 /api/notes 주소를 중첩 서버 함수로 연결한다', async () => {
  const config = JSON.parse(await text('vercel.json'));
  assert.ok(config.rewrites?.some(rule => rule.source === '/api/notes' && rule.destination === '/api/notes/read'));
});

test('배포 식별은 2단계 이후 단계값도 그대로 기록한다', async () => {
  const { deploymentIdentity } = await import('../scripts/deployment-identity.mjs');
  const env = {
    VERCEL_GIT_PROVIDER: 'github',
    VERCEL_GIT_REPO_OWNER: 'graypork',
    VERCEL_GIT_REPO_SLUG: 'choi-bujang-secret-vault',
    VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    VERCEL_URL: 'student-defense.vercel.app',
  };
  const base = {
    judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge',
    sampleMarker: 'SAMPLE_NOTE_1',
  };
  assert.equal(deploymentIdentity(env, { ...base, step: 2 }).step, 2);
  assert.equal(deploymentIdentity(env, { ...base, step: 3 }).step, 3);
});
