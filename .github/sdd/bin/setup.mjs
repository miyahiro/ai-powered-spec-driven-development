import { realpathSync } from 'node:fs';
import { recordingStatus, enableAutomatic, disableAutomatic, setRecordingDefault } from '../lib/setup.mjs';

const usage = 'Use status, enable --confirm-host-checks [--note <text>], disable, or default <automatic|manual>.';

try {
  const root = realpathSync(process.cwd());
  const [command, ...rest] = process.argv.slice(2);
  let changed = [];
  if (command === 'enable') {
    if (rest[0] !== '--confirm-host-checks' || !(rest.length === 1 || rest.length === 3 && rest[1] === '--note')) throw new Error(`Confirm the host checks explicitly. ${usage}`);
    changed = enableAutomatic(root, rest[2] ?? null);
  } else if (command === 'disable' && rest.length === 0) changed = disableAutomatic(root);
  else if (command === 'default' && rest.length === 1) changed = setRecordingDefault(root, rest[0]);
  else if (command !== 'status' || rest.length !== 0) throw new Error(usage);
  console.log(JSON.stringify({ status: 'ok', changed, result: recordingStatus(root) }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ status: 'error', error: { code: 'INVALID_FORMAT', message: error.message } }));
  process.exitCode = 1;
}
