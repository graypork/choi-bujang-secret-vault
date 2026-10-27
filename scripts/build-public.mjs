import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'public', 'data.json');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));

if (config.step < 2) {
  throw new Error('2단계부터 공개 data.json에는 메모 본문을 복사하지 않습니다.');
}

const publicData = {
  sampleMarker: config.sampleMarker,
  notes: [],
};

await mkdir(resolve(root, 'public'), { recursive: true });
await writeFile(output, `${JSON.stringify(publicData, null, 2)}\n`, 'utf8');
console.log('공개 data.json에서 메모 본문을 제거했습니다.');

if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(root, 'public', 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
