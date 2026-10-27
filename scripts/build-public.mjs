import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'public');
const publicData = resolve(publicDir, 'data.json');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));

if (!Number.isInteger(config.step) || config.step < 2) {
  throw new Error('2단계 이후 빌드는 정적 data.json 대신 서버 자료 API를 사용합니다.');
}

await mkdir(publicDir, { recursive: true });
await rm(publicData, { force: true });
console.log('정적 public/data.json을 배포 결과에서 제외했습니다.');

if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(publicDir, 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
