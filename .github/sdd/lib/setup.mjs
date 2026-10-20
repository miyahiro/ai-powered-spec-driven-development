import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';

export const executingAgents = ['orchestrator', 'ideation', 'requirements', 'external-design', 'internal-design', 'task-planner', 'implementer'];
const profilePath = root => resolve(root, '.github/sdd/profile.json');
const agentPath = (root, role) => resolve(root, `.github/agents/sdd-${role}.agent.md`);
const toolsLine = /^tools: \[([^\]\n]*)\]$/m;

function readProfile(root) {
  return existsSync(profilePath(root)) ? JSON.parse(readFileSync(profilePath(root), 'utf8')) : { mode: 'read-only' };
}

function writeAtomic(path, text) {
  writeFileSync(`${path}.tmp`, text);
  renameSync(`${path}.tmp`, path);
}

function agentTools(root, role) {
  if (!existsSync(agentPath(root, role))) return null;
  const match = toolsLine.exec(readFileSync(agentPath(root, role), 'utf8'));
  return match ? match[1].split(',').map(tool => tool.trim()).filter(Boolean) : null;
}

function setExecute(root, enabled) {
  const changed = [];
  for (const role of executingAgents) {
    const path = agentPath(root, role);
    const tools = agentTools(root, role);
    if (!tools) throw new Error(`The tools line of sdd-${role} was not found.`);
    const next = enabled ? (tools.includes('execute') ? tools : [...tools, 'execute']) : tools.filter(tool => tool !== 'execute');
    if (next.length === tools.length) continue;
    writeAtomic(path, readFileSync(path, 'utf8').replace(toolsLine, `tools: [${next.join(', ')}]`));
    changed.push(`.github/agents/sdd-${role}.agent.md`);
  }
  return changed;
}

export function recordingStatus(root) {
  const profile = readProfile(root);
  const hostChecked = profile.mode === 'managed' && profile.hostChecks?.localHooks === true && profile.hostChecks?.failureDenies === true;
  const executeEnabled = executingAgents.every(role => agentTools(root, role)?.includes('execute'));
  const recordingDefault = profile.recordingDefault === 'manual' ? 'manual' : 'automatic';
  const recording = recordingDefault === 'manual' ? 'manual' : hostChecked && executeEnabled ? 'automatic' : 'setup-required';
  return { recordingDefault, recording, hostChecked, executeEnabled };
}

export function enableAutomatic(root, note = null) {
  const profile = readProfile(root);
  profile.mode = 'managed';
  profile.hostChecks = { localHooks: true, failureDenies: true, confirmedAt: new Date().toISOString(), ...(note ? { note } : {}) };
  writeAtomic(profilePath(root), `${JSON.stringify(profile, null, 2)}\n`);
  return ['.github/sdd/profile.json', ...setExecute(root, true)];
}

export function disableAutomatic(root) {
  const profile = readProfile(root);
  profile.mode = 'read-only';
  profile.hostChecks = { localHooks: false, failureDenies: false };
  writeAtomic(profilePath(root), `${JSON.stringify(profile, null, 2)}\n`);
  return ['.github/sdd/profile.json', ...setExecute(root, false)];
}

export function setRecordingDefault(root, value) {
  if (!['automatic', 'manual'].includes(value)) throw new Error('Use automatic or manual.');
  const profile = readProfile(root);
  profile.recordingDefault = value;
  writeAtomic(profilePath(root), `${JSON.stringify(profile, null, 2)}\n`);
  return ['.github/sdd/profile.json'];
}
