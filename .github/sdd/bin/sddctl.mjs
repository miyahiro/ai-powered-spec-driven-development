import { realpathSync, readFileSync } from 'node:fs';
import { executeRequest, doctor } from '../lib/runtime.mjs';
import { redact } from '../lib/validation.mjs';

try {
  const root = realpathSync(process.cwd());
  if (process.argv[2] === 'doctor') {
    console.log(JSON.stringify(doctor(root), null, 2));
  } else if (process.argv[2] === 'encode') {
    const text = readFileSync(process.argv[3], 'utf8');
    JSON.parse(text);
    console.log(Buffer.from(text).toString('base64url'));
  } else {
    const encoded = process.argv[2];
    if (process.argv.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(encoded ?? '')) throw new Error('Use doctor, encode <request.json>, or exactly one base64url JSON request.');
    const result = await executeRequest(root, JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'error') process.exitCode = 1;
  }
} catch (error) {
  console.log(JSON.stringify({ status: 'error', error: { code: 'INVALID_FORMAT', message: redact(error.message) } }));
  process.exitCode = 1;
}