import { realpathSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { relative, isAbsolute } from 'node:path';
import { safePath } from '../lib/store.mjs';
import { validateRequest, roles } from '../lib/validation.mjs';
import { commandPrefix } from '../lib/runtime.mjs';

export function evaluateTool(event, role, profile, root) {
  const deny = reason => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
  const allow = () => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } });
  if (!roles.includes(role) || !event || typeof event.tool_name !== 'string' || !event.tool_input || typeof event.tool_input !== 'object' || Array.isArray(event.tool_input)) return deny('Invalid Local hook payload or role.');
  const mapping = profile.tools?.[event.tool_name];
  if (!mapping) return deny('Unknown tool. Inspect its Local schema before configuring a mapping.');
  if (mapping.kind === 'read') {
    if (!Array.isArray(mapping.pathKeys)) return deny('Read tool paths are unconfigured.');
    if (mapping.pathKeys.length === 0) return mapping.workspaceScopeVerified === true ? allow() : deny('Unscoped search requires a verified host workspace and protected-file boundary.');
    for (const key of mapping.pathKeys) {
      const value = event.tool_input[key];
      if (typeof value !== 'string') return deny('Explicit read scope is required.');
      const path = isAbsolute(value) ? relative(root, value) : value;
      if (/\.(?:env|git)(?:\/|\.|$)|id_rsa|id_ed25519|\.npmrc|\.netrc/.test(path)) return deny('Protected read target.');
      const literal = path.split(/[*?{[]/)[0].replace(/\/$/, '');
      if (literal !== path.replace(/\/$/, '') && mapping.protectedFilesVerified !== true) return deny('Glob searches need a host-verified protected-file boundary.');
      try { safePath(root, literal, { control: true }); } catch { return deny('Read path escapes the workspace or is not canonical.'); }
      if (!(profile.readRoots ?? ['docs', 'README.md']).some(prefix => literal === prefix || literal.startsWith(`${prefix}/`))) return deny('Read path is outside the configured roots.');
    }
    return allow();
  }
  if (mapping.kind === 'question') return role === 'orchestrator' ? allow() : deny('Questions must go through the orchestrator.');
  if (mapping.kind === 'agent') {
    const agent = event.tool_input.agentName;
    return role === 'orchestrator' && ['sdd-ideation', 'sdd-requirements', 'sdd-external-design', 'sdd-internal-design', 'sdd-task-planner', 'sdd-implementer', 'sdd-reviewer'].includes(agent) ? allow() : deny('Only the coordinator may invoke a fixed SDD specialist.');
  }
  if (mapping.kind !== 'execute' || profile.mode !== 'managed' || profile.hostChecks?.localHooks !== true || profile.hostChecks?.failureDenies !== true) return deny('Automatic execution is disabled. Use a human-operated runtime.');
  if (role === 'reviewer') return deny('The reviewer is read-only.');
  const command = event.tool_input.command;
  if (event.tool_input.mode && event.tool_input.mode !== 'sync' || event.tool_input.isBackground === true) return deny('The runner must be a one-shot synchronous command.');
  const prefix = commandPrefix(root);
  if (typeof command !== 'string' || !command.startsWith(prefix)) return deny('Only the fixed runtime command is permitted.');
  const encoded = command.slice(prefix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return deny('Additional shell syntax is prohibited.');
  let request;
  try {
    request = validateRequest(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
  } catch {
    return deny('Invalid runtime request.');
  }
  if (request.role !== role) return deny('The request role does not match the active agent.');
  return allow();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = realpathSync(process.cwd());
    const profile = JSON.parse(readFileSync(resolve(root, '.github/sdd/profile.json'), 'utf8'));
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
      if (input.length > 1024 * 1024) throw new Error('Hook input exceeds the limit.');
    }
    console.log(JSON.stringify(evaluateTool(JSON.parse(input), process.argv[2], profile, root)));
  } catch {
    process.stderr.write('SDD guard failed. Disable execute until the hook is repaired.\n');
    process.exitCode = 2;
  }
}