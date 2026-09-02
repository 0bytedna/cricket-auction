import { spawn } from 'node:child_process';

const port = process.env.PORT || '8787';
const command = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
const child = spawn(
  command,
  [
    'dev',
    '--config',
    'dist/server/wrangler.json',
    '--ip',
    '0.0.0.0',
    '--port',
    port,
  ],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
