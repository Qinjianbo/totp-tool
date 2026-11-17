import { cp, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { root, publicFiles } from './files.mjs';

const destination = join(root, 'dist');
await rm(destination, { recursive: true, force: true });
for (const [publicPath, source] of publicFiles) {
  const target = join(destination, publicPath);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(root, source), target);
}
console.log('已构建 dist/，可直接部署到任意静态网站服务。');
