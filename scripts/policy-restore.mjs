import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const backupDir = join(root, 'artifacts', 'policy-restore');
const baseline = join(backupDir, 'baseline');
const trial = join(backupDir, 'trial');
const manifestPath = join(backupDir, 'manifest.json');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(path, 'utf8');
const write = (path, value) => { mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, value); };
const abort = message => { throw new Error(message); };
const file = name => join(baseline, name);
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const version = git('rev-parse', 'HEAD');
const policyFiles = ['decider.mjs', 'allowed-routes.json', 'db-policy.json'];

function validateDbPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || value.table !== 'public.learning_notes' || typeof value.rlsEnabled !== 'boolean'
      || !Array.isArray(value.policies) || !Array.isArray(value.grants)) {
    abort('DB 정책 내보내기 형식이 올바르지 않습니다. 실제 DB에서 조회한 정책·권한 자료가 필요합니다.');
  }
  // Export is policy metadata only; do not accept rows, credentials, or note bodies.
  if (Object.keys(value).some(key => !['table', 'rlsEnabled', 'forceRls', 'policies', 'grants'].includes(key))
      || value.policies.some(p => !p || typeof p !== 'object' || Array.isArray(p))
      || value.grants.some(g => !g || typeof g !== 'object' || Array.isArray(g))) {
    abort('DB 정책 외 자료는 사본에 포함할 수 없습니다.');
  }
  return JSON.stringify(value, null, 2) + '\n';
}
function verify() {
  if (!existsSync(manifestPath)) abort('안전 정책 사본 또는 확인용 해시가 없습니다. 중단합니다.');
  const m = JSON.parse(read(manifestPath));
  if (m.schema !== 'aleph.policy.backup.v1' || m.sourceCommit !== version
      || m.dbPolicyVerified !== true || !Array.isArray(m.files)
      || m.files.length !== policyFiles.length
      || policyFiles.some(name => !m.files.some(f => f.name === name && /^[a-f0-9]{64}$/.test(f.sha256)))) {
    abort('복원 버전이 다르거나 DB 정책이 검증되지 않았습니다. 중단합니다.');
  }
  for (const { name, sha256 } of m.files) {
    if (!policyFiles.includes(name) || !existsSync(file(name)) || sha(read(file(name))) !== sha256) {
      abort('안전 정책 사본이 없거나 해시가 일치하지 않습니다. 중단합니다.');
    }
  }
  const expectedDecider = read(join(root, 'src/decider.mjs'));
  const expectedRoutes = JSON.stringify(JSON.parse(read(join(root, 'aleph.config.json'))).allowedRoutes, null, 2) + '\n';
  if (read(file('decider.mjs')) !== expectedDecider || read(file('allowed-routes.json')) !== expectedRoutes) {
    abort('현재 코드/허용 경로가 사본과 다릅니다. 자동 적용하지 않고 중단합니다.');
  }
  return m;
}
function printPlan(m) {
  process.stdout.write('복원 기준 커밋: ' + m.sourceCommit + '\n');
  process.stdout.write('변경 범위: 시험용 사본 ' + join('artifacts','policy-restore','trial','decider.mjs') + ' 한 줄만 변경\n');
  process.stdout.write('운영 코드·설정·DB 정책 변경: 없음\n');
}
function snapshotPartial() {
  if (existsSync(manifestPath)) abort('기존 사본이 있습니다. 덮어쓰지 않습니다.');
  const copies = {
    'decider.mjs': read(join(root, 'src/decider.mjs')),
    'allowed-routes.json': JSON.stringify(JSON.parse(read(join(root, 'aleph.config.json'))).allowedRoutes, null, 2) + '\n',
  };
  const files = Object.entries(copies).map(([name, content]) => ({ name, sha256: sha(content) }));
  for (const [name, content] of Object.entries(copies)) write(file(name), content);
  write(manifestPath, JSON.stringify({ schema: 'aleph.policy.backup.v1', sourceCommit: version,
    dbPolicyVerified: false, files }, null, 2) + '\n');
  process.stdout.write('코드·허용 경로 사본 생성, DB 정책 미확인: 복원/시험 중단 상태\n');
  for (const f of files) process.stdout.write(f.name + ': ' + f.sha256 + '\n');
}
function snapshot(dbExport) {
  if (!dbExport || !existsSync(resolve(dbExport))) {
    abort('실제 DB 정책 내보내기 파일이 없습니다. DB 정책 확인 전 전체 백업을 만들지 않습니다.');
  }
  if (existsSync(manifestPath)) abort('기존 사본이 있습니다. 덮어쓰지 않습니다.');
  const db = validateDbPolicy(JSON.parse(read(resolve(dbExport))));
  const copies = {
    'decider.mjs': read(join(root, 'src/decider.mjs')),
    'allowed-routes.json': JSON.stringify(JSON.parse(read(join(root, 'aleph.config.json'))).allowedRoutes, null, 2) + '\n',
    'db-policy.json': db,
  };
  const files = policyFiles.map(name => ({ name, sha256: sha(copies[name]) }));
  for (const name of policyFiles) write(file(name), copies[name]);
  write(manifestPath, JSON.stringify({ schema: 'aleph.policy.backup.v1', sourceCommit: version,
    dbPolicyVerified: true, files }, null, 2) + '\n');
  process.stdout.write('사본 및 SHA-256 생성 완료 (DB 내보내기 출처는 별도 확인 필요)\n');
  for (const f of files) process.stdout.write(f.name + ': ' + f.sha256 + '\n');
}
function simulate() {
  const m = verify();
  printPlan(m);
  const original = read(file('decider.mjs'));
  const before = "export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required', 'resource_zone']);";
  const after = "export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required', 'resource_zone_trial']);";
  if (!original.includes(before)) abort('시험 변경 대상 규칙을 찾을 수 없습니다. 중단합니다.');
  write(join(trial, 'decider.mjs'), original.replace(before, after));
  const trialText = read(join(trial, 'decider.mjs'));
  const originalLines = original.split('\n');
  const changedLines = trialText.split('\n');
  const differences = changedLines.flatMap((line, i) => line === originalLines[i] ? [] : [
    '- ' + originalLines[i], '+ ' + line]);
  process.stdout.write('검증된 사본과 시험 정책의 차이만 표시:\n' + differences.join('\n') + '\n');
}
function restoreTrial(confirmation) {
  const m = verify();
  const target = join(trial, 'decider.mjs');
  if (!existsSync(target)) abort('시험 정책 사본이 없습니다. 중단합니다.');
  const safe = read(file('decider.mjs'));
  const current = read(target);
  const safeLines = safe.split('\\n');
  const currentLines = current.split('\\n');
  if (safeLines.length !== currentLines.length) abort('예상하지 못한 시험 정책 변경이 있습니다. 중단합니다.');
  const changes = currentLines.flatMap((line, index) => line === safeLines[index] ? [] :
    [{ line: index + 1, from: line, to: safeLines[index] }]);
  if (changes.length !== 1 || !changes[0].from.includes("'resource_zone_trial'")
      || !changes[0].to.includes("'resource_zone'")) {
    abort('허용되지 않은 변경 범위입니다. 중단합니다.');
  }
  const expected = sha(current);
  process.stdout.write('복원 기준 커밋: ' + m.sourceCommit + '\\n');
  process.stdout.write('대상: artifacts/policy-restore/trial/decider.mjs (시험 사본만)\\n');
  process.stdout.write('변경 줄: ' + changes[0].line + '\\n');
  process.stdout.write('- ' + changes[0].from + '\\n+ ' + changes[0].to + '\\n');
  process.stdout.write('다른 서비스 규칙·감사 이력·운영 코드·DB: 변경 없음\\n');
  process.stdout.write('확인 토큰(시험 사본 SHA-256): ' + expected + '\\n');
  if (confirmation !== expected) {
    process.stdout.write('미적용: 위 변경을 확인한 뒤 restore <확인 토큰>으로 실행하세요.\\n');
    return;
  }
  // The confirmation binds the exact trial bytes; do not overwrite if the trial changed.
  if (sha(read(target)) !== expected) abort('확인 후 시험 정책이 변경되었습니다. 중단합니다.');
  write(target, safe);
  if (sha(read(target)) !== sha(safe)) abort('복원 후 해시 검증 실패');
  process.stdout.write('시험 정책 복원 및 해시 검증 완료\\n');
}
try {
  const [command, arg] = process.argv.slice(2);
  if (command === 'snapshot-partial') snapshotPartial();
  else if (command === 'snapshot') snapshot(arg);
  else if (command === 'verify') { const m = verify(); printPlan(m); process.stdout.write('사본 해시 검증 통과\n'); }
  else if (command === 'simulate') simulate();
  else if (command === 'restore') restoreTrial(arg);
  else abort('사용법: node scripts/policy-restore.mjs snapshot-partial | snapshot <DB정책 JSON> | verify | simulate | restore [확인 토큰]');
} catch (error) {
  process.stderr.write('안전 중단: ' + error.message + '\n');
  process.exitCode = 1;
}
