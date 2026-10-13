import { existsSync, lstatSync, realpathSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, readdirSync, rmdirSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SddError, requireCondition, hash, json } from './validation.mjs';

export function safePath(root, path, { control = false } = {}) {
  requireCondition(typeof path === 'string' && path.length > 0 && !isAbsolute(path) && !path.includes('\\') && !path.split('/').includes('..') && !path.includes(':') && !path.includes('\0'), 'OUT_OF_SCOPE', 'A workspace-relative POSIX path is required.');
  const clean = path.replace(/\/$/, '');
  requireCondition(clean.length > 0 && clean.split('/').every(part => part.length > 0 && part !== '.'), 'OUT_OF_SCOPE', 'Use canonical relative paths without dot or empty segments.');
  requireCondition(control || !clean.split('/').some(part => ['.git', '.github', '.vscode'].includes(part)), 'OUT_OF_SCOPE', 'Control configuration is protected.');
  requireCondition(!clean.split('/').some(part => /^(?:\.env(?:\..*)?|\.npmrc|\.netrc|id_rsa|id_ed25519)$/.test(part)), 'OUT_OF_SCOPE', 'Secret files are protected.');
  const target = resolve(root, clean);
  const rel = relative(root, target);
  requireCondition(rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), 'OUT_OF_SCOPE', 'Path escapes the workspace.');
  let current = target;
  while (current !== root) {
    if (existsSync(current) || (() => { try { return lstatSync(current).isSymbolicLink(); } catch { return false; } })()) {
      requireCondition(!lstatSync(current).isSymbolicLink(), 'OUT_OF_SCOPE', 'Symlinks are not accepted by managed updates.');
      requireCondition(realpathSync(current) === current, 'OUT_OF_SCOPE', 'Path resolves through a symlink.');
    }
    current = dirname(current);
  }
  return target;
}

export function revision(root, path, options) {
  const target = safePath(root, path, options);
  return existsSync(target) ? hash(readFileSync(target)) : null;
}

export function readJson(root, path) {
  const target = safePath(root, path);
  try { return JSON.parse(readFileSync(target, 'utf8')); }
  catch { throw new SddError('INVALID_FORMAT', `Cannot read valid JSON: ${path}`); }
}

export function atomicWrite(root, path, content, expected) {
  const target = safePath(root, path);
  mkdirSync(dirname(target), { recursive: true });
  safePath(root, path);
  const temporary = `${target}.sdd-${randomUUID()}`;
  try {
    writeFileSync(temporary, content, { flag: 'wx', mode: existsSync(target) ? lstatSync(target).mode & 0o777 : 0o600 });
    const descriptor = openSync(temporary, 'r');
    try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
    safePath(root, path);
    if (expected !== undefined) requireCondition(revision(root, path) === expected, 'CONFLICT', 'The target changed before replacement.');
    renameSync(temporary, target);
    const directory = openSync(dirname(target), 'r');
    try { fsyncSync(directory); } finally { closeSync(directory); }
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function withLock(root, callback) {
  const lock = safePath(root, '.github/sdd/.lock', { control: true });
  mkdirSync(dirname(lock), { recursive: true });
  try { mkdirSync(lock); }
  catch { throw new SddError('CONFLICT', 'An update lock is present.', 'Check whether an operation is running. A human must remove a stale lock after inspection.'); }
  try { return callback(); }
  finally { rmdirSync(lock); }
}

export function pendingJournals(root, changeId) {
  const folder = `docs/scratchpad/${changeId}/pending`;
  const target = safePath(root, folder);
  if (!existsSync(target)) return [];
  return readdirSync(target).filter(name => name.endsWith('.json')).map(name => ({ ...readJson(root, `${folder}/${name}`), path: `${folder}/${name}` })).filter(entry => entry.status === 'pending');
}

export function commit(root, changeId, updates, afterWrite) {
  const entries = updates.map(update => {
    requireCondition(revision(root, update.path) === update.before, 'CONFLICT', `The file changed: ${update.path}`);
    return { ...update, after: update.content === null ? null : hash(update.content) };
  });
  requireCondition(new Set(entries.map(entry => entry.path)).size === entries.length, 'INVALID_FORMAT', 'Duplicate update targets.');
  const journalPath = `docs/scratchpad/${changeId}/pending/${randomUUID()}.json`;
  const journal = { schemaVersion: 1, status: 'pending', timestamp: new Date().toISOString(), entries };
  atomicWrite(root, journalPath, json(journal));
  for (const [index, entry] of entries.entries()) {
    requireCondition(revision(root, entry.path) === entry.before, 'CONFLICT', `A manual edit occurred: ${entry.path}`);
    if (entry.content === null) {
      if (existsSync(safePath(root, entry.path))) unlinkSync(safePath(root, entry.path));
    } else atomicWrite(root, entry.path, entry.content, entry.before);
    if (afterWrite) afterWrite(index, entry);
  }
  for (const entry of entries) requireCondition(revision(root, entry.path) === entry.after, 'INCOMPLETE_UPDATE', 'An update has not been confirmed.');
  atomicWrite(root, journalPath, json({ schemaVersion: 1, status: 'completed', timestamp: journal.timestamp, entries: entries.map(({ path, before, after }) => ({ path, before, after })) }));
  return entries.map(({ path, after }) => ({ path, revision: after }));
}

export function recover(root, changeId, apply = false) {
  const reports = [];
  for (const journal of pendingJournals(root, changeId)) {
    requireCondition(journal.schemaVersion === 1 && Array.isArray(journal.entries), 'INVALID_FORMAT', 'Invalid recovery journal.');
    requireCondition(new Set(journal.entries.map(entry => entry.path)).size === journal.entries.length, 'INVALID_FORMAT', 'Duplicate recovery targets.');
    for (const entry of journal.entries) {
      requireCondition(!entry.path.startsWith('docs/scratchpad/') || entry.path.startsWith(`docs/scratchpad/${changeId}/`) && !entry.path.includes('/pending/'), 'OUT_OF_SCOPE', 'Recovery cannot change another case or its own journals.');
      requireCondition(!entry.path.startsWith('docs/spec/changes/') || entry.path.startsWith(`docs/spec/changes/${changeId}/`), 'OUT_OF_SCOPE', 'Recovery cannot change another change record.');
      requireCondition(entry.content === null ? entry.after === null : hash(entry.content) === entry.after, 'INVALID_FORMAT', 'Recovery contents do not match their revision.');
      const current = revision(root, entry.path);
      requireCondition(current === entry.before || current === entry.after, 'CONFLICT', `Recovery would overwrite a manual change: ${entry.path}`);
    }
    const remaining = journal.entries.filter(entry => revision(root, entry.path) !== entry.after);
    if (apply) {
      for (const entry of remaining) {
        requireCondition(revision(root, entry.path) === entry.before, 'CONFLICT', 'Recovery target changed.');
        if (entry.content === null) {
          if (existsSync(safePath(root, entry.path))) unlinkSync(safePath(root, entry.path));
        } else atomicWrite(root, entry.path, entry.content, entry.before);
      }
      for (const entry of journal.entries) requireCondition(revision(root, entry.path) === entry.after, 'INCOMPLETE_UPDATE', 'Recovery could not confirm the update.');
      atomicWrite(root, journal.path, json({ schemaVersion: 1, status: 'completed', timestamp: journal.timestamp, entries: journal.entries.map(({ path, before, after }) => ({ path, before, after })) }));
    }
    reports.push({ path: journal.path, remaining: remaining.map(entry => entry.path), status: apply ? 'completed' : 'pending' });
  }
  return reports;
}

export function manifest(root, roots, inputs = {}) {
  requireCondition(Array.isArray(roots) && roots.length > 0, 'INVALID_FORMAT', 'An approval needs artifact roots.');
  const files = {};
  function collect(path) {
    requireCondition(!path.startsWith('docs/scratchpad/'), 'OUT_OF_SCOPE', 'Scratchpad and approval records are excluded from approval revisions.');
    const target = safePath(root, path);
    requireCondition(existsSync(target), 'INVALID_FORMAT', `Missing artifact: ${path}`);
    if (lstatSync(target).isDirectory()) {
      for (const child of readdirSync(target).sort()) collect(`${path.replace(/\/$/, '')}/${child}`);
    } else {
      requireCondition(!/\/(?:approval|approvals|question|questions|operations|state)\.(?:md|json)$/.test(path), 'OUT_OF_SCOPE', 'Approval and question records are excluded from phase revisions.');
      files[path] = revision(root, path);
    }
  }
  for (const path of roots) collect(path.replace(/\/$/, ''));
  requireCondition(Object.keys(files).length > 0, 'INVALID_FORMAT', 'The artifact set is empty.');
  const sorted = Object.fromEntries(Object.entries(files).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  return { roots, files: sorted, inputs, revision: hash(JSON.stringify(sorted)) };
}