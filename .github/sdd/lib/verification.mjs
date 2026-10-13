import { existsSync, readFileSync, lstatSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { safePath, revision } from './store.mjs';
import { requireCondition, validate, redact } from './validation.mjs';

export function sandboxStatus() {
  if (process.platform !== 'linux') return { status: 'unsupported', reason: 'Only Linux isolation is implemented.' };
  const result = spawnSync('bwrap', ['--version'], { encoding: 'utf8', timeout: 3000 });
  return result.status === 0 ? { status: 'unconfirmed', version: result.stdout.trim(), reason: 'Availability does not verify namespace and deny behavior.' } : { status: 'manual-only', reason: 'bubblewrap is unavailable. No unsandboxed fallback is permitted.' };
}

export function checkMount(root, path) {
  const target = safePath(root, path);
  const stats = lstatSync(target);
  requireCondition(stats.isDirectory() || stats.isFile(), 'OUT_OF_SCOPE', 'Sockets and special files are not verification inputs.');
  requireCondition(!path.split('/').some(part => ['.git', '.github', '.vscode'].includes(part)), 'OUT_OF_SCOPE', 'Verification mounts cannot include control settings.');
  if (stats.isDirectory()) for (const name of readdirSync(target)) checkMount(root, `${path}/${name}`);
  else requireCondition(stats.nlink === 1, 'OUT_OF_SCOPE', 'Hard-linked files are not accepted by the isolation profile.');
  return target;
}

export function runVerification(root, state, payload) {
  requireCondition(state.phase === 'development', 'APPROVAL_REQUIRED', 'Verification execution belongs to development.');
  requireCondition(typeof payload.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(payload.id) && typeof payload.profile === 'string' && Array.isArray(payload.taskIds), 'INVALID_FORMAT', 'A verification ID, profile and task IDs are required.');
  const profile = JSON.parse(readFileSync(resolve(root, '.github/sdd/profile.json'), 'utf8'));
  const config = profile.verificationProfiles?.[payload.profile];
  requireCondition(config?.isolationVerified === true && process.platform === 'linux', 'ENVIRONMENT_UNSUPPORTED', 'A human-confirmed isolated verification profile is required.');
  requireCondition(config.network === 'none' && config.environment && typeof config.environment === 'object' && Object.keys(config.environment).every(key => ['PATH', 'HOME', 'LANG', 'NODE_ENV', 'CI'].includes(key)), 'OUT_OF_SCOPE', 'Only non-secret environment settings and no external network are permitted.');
  requireCondition(typeof config.executable === 'string' && Array.isArray(config.args) && config.args.every(argument => typeof argument === 'string') && Array.isArray(config.readPaths) && Array.isArray(config.outputPaths), 'INVALID_FORMAT', 'Invalid verification profile.');
  const permission = state.permissions.find(item => item.operations.includes('verification.run') && item.profiles.includes(payload.profile));
  requireCondition(permission && config.readPaths.every(path => permission.readPaths.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) && config.outputPaths.every(path => permission.outputPaths.some(prefix => path === prefix || path.startsWith(`${prefix}/`))), 'PERMISSION_REQUIRED', 'Verification mounts exceed the agreed permission.');
  const inputs = {};
  for (const [path, expected] of Object.entries(payload.inputRevisions ?? {})) {
    requireCondition(expected !== null && revision(root, path) === expected, 'CONFLICT', 'Verification inputs changed.');
    inputs[path] = expected;
  }
  requireCondition(Object.keys(inputs).length > 0, 'INVALID_FORMAT', 'Verification input revisions are required.');
  const executable = safePath(root, config.executable);
  requireCondition(config.readPaths.some(path => config.executable === path || config.executable.startsWith(`${path}/`)), 'OUT_OF_SCOPE', 'The executable must be part of the mounted non-secret workspace inputs.');
  const argumentsList = ['--unshare-all', '--die-with-parent', '--new-session', '--clearenv', '--tmpfs', '/', '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp'];
  for (const path of ['/usr', '/bin', '/lib', '/lib64']) if (existsSync(path)) argumentsList.push('--ro-bind', path, path);
  argumentsList.push('--dir', '/workspace');
  for (const path of config.readPaths) argumentsList.push('--ro-bind', checkMount(root, path), `/workspace/${path}`);
  for (const path of config.outputPaths) {
    requireCondition(!['docs/spec', 'docs/scratchpad'].some(protectedPath => path === protectedPath || path.startsWith(`${protectedPath}/`) || protectedPath.startsWith(`${path}/`)), 'OUT_OF_SCOPE', 'Verification outputs cannot modify specification or workflow state.');
    requireCondition(!Object.keys(inputs).some(input => input === path || input.startsWith(`${path}/`)), 'OUT_OF_SCOPE', 'Verification inputs cannot be writable outputs.');
    requireCondition(!config.readPaths.some(readPath => path === readPath || readPath.startsWith(`${path}/`)), 'OUT_OF_SCOPE', 'Generated outputs must not expose source or control roots as writable.');
    argumentsList.push('--bind', checkMount(root, path), `/workspace/${path}`);
  }
  for (const [key, value] of Object.entries(config.environment)) argumentsList.push('--setenv', key, String(value));
  argumentsList.push('--chdir', '/workspace', '--', `/workspace/${config.executable}`, ...config.args);
  requireCondition(existsSync(executable), 'INVALID_FORMAT', 'Verification executable is missing.');
  const result = spawnSync('bwrap', argumentsList, { encoding: 'utf8', timeout: config.timeoutMs ?? 60000, maxBuffer: 1024 * 1024, env: { PATH: process.env.PATH } });
  requireCondition(!result.error && result.status !== null, 'ENVIRONMENT_UNSUPPORTED', 'The isolated verification did not complete. No fallback is permitted.');
  requireCondition(!/^bwrap:/m.test(result.stderr ?? ''), 'ENVIRONMENT_UNSUPPORTED', 'The isolation worker could not start. No fallback is permitted.');
  for (const [path, expected] of Object.entries(inputs)) requireCondition(revision(root, path) === expected, 'CONFLICT', 'Verification inputs changed during execution.');
  const evidence = { schemaVersion: 1, id: payload.id, mode: 'automatic', taskIds: payload.taskIds, inputRevisions: inputs, environment: `linux/bubblewrap/${basename(config.executable)}`, timestamp: new Date().toISOString(), method: payload.method ?? 'isolated test', status: result.status === 0 ? 'passed' : 'failed', result: redact(`${result.stdout ?? ''}\n${result.stderr ?? ''}`), nextAction: result.status === 0 ? '' : 'Inspect the failure before classifying a behavioral Red.', command: [config.executable, ...config.args], exitCode: result.status, tddStage: payload.tddStage ?? 'not-applicable', failureKind: 'unknown' };
  return validate('evidence', evidence);
}