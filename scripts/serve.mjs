import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { root, publicFiles } from './files.mjs';

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
}
const port = Number(option('--port', process.env.PORT || 5173));
const host = option('--host', '127.0.0.1');
const production = args.includes('--dist');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.map': 'application/json', '.txt': 'text/plain' };
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer between 1 and 65535.');

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }
  let path;
  try { path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html'; }
  catch { response.writeHead(400).end('Bad request'); return; }
  if (!publicFiles.has(path)) { response.writeHead(404).end('Not found'); return; }
  try {
    const content = await readFile(production ? join(root, 'dist', path) : join(root, publicFiles.get(path)));
    response.writeHead(200, { 'Content-Type': `${types[extname(path)] || 'application/octet-stream'}; charset=utf-8` });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404).end(production ? 'File missing. Run npm run build first.' : 'File missing. Run npm install first.');
  }
});
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请使用 npm run dev -- --port 5174` : error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`\n  2FA 验证器${production ? ' · 生产预览' : ''}\n\n  Local: http://${host}:${port}\n  Ctrl+C 停止服务\n`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
