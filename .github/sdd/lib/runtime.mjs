import { existsSync, readFileSync, realpathSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { phases, requireCondition, validate, validateRequest, validateTasks, hash, json, stableJson, assertNoSecrets, redact } from './validation.mjs';
import { safePath, revision, readJson, manifest, pendingJournals, withLock, commit, recover } from './store.mjs';
import { runVerification, sandboxStatus } from './verification.mjs';
import { recordingStatus } from './setup.mjs';

const rolePhases = { ideation: 'ideation', requirements: 'requirements', 'external-design': 'external-design', 'internal-design': 'internal-design', 'task-planner': 'task-planning', implementer: 'development' };
const readOperations = new Set(['scratchpad.read', 'traceability.validate', 'git.inspect', 'doctor']);
const coordinatorOperations = new Set(['change.register', 'question.open', 'question.record_answer', 'decision.record', 'approval.request', 'approval.record', 'permission.record', 'workflow.transition', 'integration.record', 'recover']);
const identifiedOperations = new Set([...coordinatorOperations].filter(operation => operation !== 'recover'));
const statePath = changeId => `docs/scratchpad/${changeId}/state.json`;
const operationsPath = changeId => `docs/scratchpad/${changeId}/operations.json`;
const changesPath = changeId => `docs/spec/changes/${changeId}`;
const within = (path, prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(`${prefix.replace(/\/$/, '')}/`);

export function commandPrefix(root) {
  const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
  return `${quote(realpathSync(process.execPath))} ${quote(resolve(root, '.github/sdd/bin/sddctl.mjs'))} `;
}

export function parseRequestArgument(argument) {
  if (typeof argument === 'string' && /^[A-Za-z0-9_-]+$/.test(argument)) return JSON.parse(Buffer.from(argument, 'base64url').toString('utf8'));
  if (typeof argument === 'string' && /^\{[^'\u0000-\u001f\u007f]*\}$/.test(argument)) return JSON.parse(argument);
  throw new Error('A request must be one base64url argument or one single-line JSON object without single quotes.');
}

function gitBytes(root, argumentsList) {
  return execFileSync('git', ['--no-pager', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'diff.external=', '-C', root, ...argumentsList], { timeout: 10000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

function git(root, argumentsList) {
  return gitBytes(root, argumentsList).toString('utf8').trim();
}

export function inspectGit(root) {
  try {
    requireCondition(realpathSync(git(root, ['rev-parse', '--show-toplevel'])) === root, 'BRANCH_MISMATCH', 'Open the repository root as the workspace.');
    const branch = git(root, ['symbolic-ref', '--short', 'HEAD']);
    let head = null;
    try { head = git(root, ['rev-parse', '--verify', 'HEAD']); } catch {}
    return { branch, head, changes: redact(git(root, ['status', '--short'])) };
  } catch (error) {
    if (error.code === 'BRANCH_MISMATCH') throw error;
    return { branch: null, head: null, changes: '', unavailable: true };
  }
}

function shape(payload, allowed, required = []) {
  requireCondition(Object.keys(payload).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(payload, key)), 'INVALID_FORMAT', 'Unexpected or missing operation payload fields.');
}

function human(payload, intent = null) {
  validate('human', payload);
  requireCondition(Number.isFinite(Date.parse(payload.timestamp)), 'INVALID_FORMAT', 'The human response timestamp is invalid.');
  const answer = payload.answer.trim();
  if (intent === 'approval') requireCondition(/^(?:approve|approved|承認します|この工程を承認します|工程一式を承認します)[。.!]?$/i.test(answer), 'APPROVAL_REQUIRED', 'Record a short unambiguous approval response, not a continuation, question or comment.');
  if (intent === 'permission') requireCondition(/^(?:allow|authorized|permission granted|許可します|この操作を許可します|(?:文書の編集|更新|編集|検証|復旧|記録|マージ)を許可します)[。.!]?$/i.test(answer), 'PERMISSION_REQUIRED', 'Record a short explicit permission response.');
  return payload;
}

function dueQuestions(state, phase) {
  return state.questions.filter(question => question.status !== 'resolved' && phases.indexOf(question.duePhase) <= phases.indexOf(phase));
}

function assertApproval(root, state, phase, seen = new Set()) {
  if (phase === 'task-planning') return;
  requireCondition(!seen.has(phase), 'INVALID_FORMAT', 'Cyclic approval inputs.');
  seen.add(phase);
  const saved = state.phaseManifests[phase];
  requireCondition(saved, 'APPROVAL_REQUIRED', `No artifact manifest for ${phase}.`);
  const current = manifest(root, saved.roots, saved.inputs);
  requireCondition(state.approvals.some(approval => approval.phase === phase && approval.judgment === 'approved' && approval.manifest.revision === current.revision && json(approval.manifest.inputs) === json(saved.inputs)), 'APPROVAL_REQUIRED', `Current artifacts are not approved: ${phase}`);
  for (const [inputPhase, inputRevision] of Object.entries(saved.inputs)) {
    assertApproval(root, state, inputPhase, new Set(seen));
    const input = state.phaseManifests[inputPhase];
    requireCondition(manifest(root, input.roots, input.inputs).revision === inputRevision, 'APPROVAL_REQUIRED', `Approved input changed: ${inputPhase}`);
  }
}

function assertPreviousApprovals(root, state, phase) {
  for (const prior of phases.slice(0, phases.indexOf(phase))) assertApproval(root, state, prior);
}

function loadTasks(root, state) {
  return validateTasks(readJson(root, `${changesPath(state.changeId)}/tasks.json`));
}

function assertInputsCurrent(root, inputs) {
  requireCondition(Object.keys(inputs).length > 0, 'INVALID_FORMAT', 'Evidence needs at least one input revision.');
  for (const [path, expected] of Object.entries(inputs)) requireCondition(expected !== null && revision(root, path) === expected, 'CONFLICT', `Evidence input changed: ${path}`);
}

export function checkCompletion(root, state, taskList = null, requireAll = true) {
  const tasks = taskList ?? loadTasks(root, state).tasks;
  if (requireAll) requireCondition(tasks.length > 0 && tasks.every(task => ['verified', 'obsolete'].includes(task.status)), 'APPROVAL_REQUIRED', 'Required tasks are not verified.');
  for (const task of tasks.filter(task => task.status === 'verified')) {
    requireCondition(task.dependsOn.every(id => tasks.some(dependency => dependency.id === id && ['verified', 'obsolete'].includes(dependency.status))), 'APPROVAL_REQUIRED', 'Task dependencies are not verified.');
    requireCondition(task.evidence.length > 0 && task.review.length > 0, 'APPROVAL_REQUIRED', `Evidence and independent review are missing: ${task.id}`);
    const evidence = task.evidence.map(path => validate('evidence', readJson(root, path)));
    for (const item of evidence) {
      requireCondition(Number.isFinite(Date.parse(item.timestamp)), 'INVALID_FORMAT', 'Evidence timestamp is invalid.');
      if (!['red', 'green'].includes(item.tddStage)) assertInputsCurrent(root, item.inputRevisions);
      requireCondition(item.taskIds.includes(task.id), 'INVALID_FORMAT', 'Evidence does not reference its task.');
    }
    requireCondition(evidence.some(item => item.status === 'passed'), 'APPROVAL_REQUIRED', 'There is no successful required verification.');
    requireCondition(evidence.every(item => !['unavailable', 'not-run'].includes(item.status)), 'APPROVAL_REQUIRED', 'Required verification remains unavailable or not run.');
    for (const [input, expected] of Object.entries(task.inputs)) requireCondition(revision(root, input) === expected, 'CONFLICT', 'A task input changed after planning.');
    if (task.type === 'behavior') {
      requireCondition(evidence.some(item => item.tddStage === 'red' && item.status === 'failed' && item.failureKind === 'behavior'), 'APPROVAL_REQUIRED', 'An intended behavioral Red is missing.');
      requireCondition(evidence.some(item => item.tddStage === 'green' && item.status === 'passed') && evidence.some(item => item.tddStage === 'refactor' && item.status === 'passed'), 'APPROVAL_REQUIRED', 'Green or post-refactor verification is missing.');
    }
    for (const path of task.review) {
      const review = validate('evidence', readJson(root, path));
      requireCondition(review.mode === 'review' && review.independent === true && review.status === 'passed' && review.reviewer !== task.assignee && review.taskIds.includes(task.id), 'APPROVAL_REQUIRED', 'Independent review is incomplete.');
      assertInputsCurrent(root, review.inputRevisions);
    }
  }
  if (requireAll) requireCondition(traceability(root, state, {}).valid, 'INVALID_FORMAT', 'Traceability references are incomplete.');
}

function traceability(root, state, payload) {
  shape(payload, ['specRoots']);
  const links = validate('traceability', readJson(root, `${changesPath(state.changeId)}/traceability.json`)).links;
  const tasks = loadTasks(root, state).tasks;
  const ids = new Set(tasks.map(task => task.id));
  function scan(path) {
    const target = safePath(root, path);
    requireCondition(existsSync(target), 'INVALID_FORMAT', `Missing traceability source: ${path}`);
    if (readdirIfDirectory(target)) {
      for (const name of readdirSync(target)) scan(`${path.replace(/\/$/, '')}/${name}`);
    } else if (path.endsWith('.md')) {
      for (const match of readFileSync(target, 'utf8').matchAll(/\b(?:REQ|NFR|AC|DES)-[A-Z]+-\d{3}\b/g)) ids.add(match[0]);
    }
  }
  for (const path of payload.specRoots ?? ['docs/spec/current']) scan(path);
  const findings = [];
  for (const link of links) {
    for (const id of [link.requirementId, ...link.designIds, ...link.acceptanceIds, ...link.taskIds]) if (!ids.has(id)) findings.push({ type: 'missing-id', reference: id });
    for (const path of [...link.testRefs, ...link.evidenceRefs]) if (!existsSync(safePath(root, path.split('#')[0]))) findings.push({ type: 'missing-file', reference: path });
  }
  for (const task of tasks) for (const id of [...task.requirementIds, ...task.designIds, ...task.acceptanceIds]) if (!ids.has(id)) findings.push({ type: 'missing-id', reference: id });
  for (const id of [...ids].filter(id => /^(?:REQ|NFR)-/.test(id))) if (!links.some(link => link.requirementId === id)) findings.push({ type: 'unmapped-requirement', reference: id });
  for (const id of [...ids].filter(id => /^AC-/.test(id))) if (!links.some(link => link.acceptanceIds.includes(id))) findings.push({ type: 'unmapped-acceptance', reference: id });
  return { valid: findings.length === 0, findings, semanticReviewRequired: true };
}

function readdirIfDirectory(target) {
  try { readdirSync(target); return true; } catch { return false; }
}

function permit(state, operation, path = null, deletion = false, profile = null, role = 'orchestrator') {
  requireCondition(state.permissions.some(permission => permission.operations.includes(operation) && (role === 'orchestrator' || permission.phase === state.phase && permission.roles?.includes(role)) && (!path || permission.editPaths.some(prefix => within(path, prefix))) && (!deletion || permission.allowDelete) && (!profile || permission.profiles.includes(profile))), 'PERMISSION_REQUIRED', `Permission is required for ${operation}${path ? `: ${path}` : ''}.`);
}

function checkDocument(root, state, request, update) {
  shape(update, ['path', 'content'], ['path', 'content']);
  safePath(root, update.path);
  requireCondition(!['paused', 'awaiting-approval'].includes(state.status), 'OUT_OF_SCOPE', 'Return to active work before changing phase artifacts.');
  requireCondition(update.content === null || typeof update.content === 'string', 'INVALID_FORMAT', 'Document content must be text or null.');
  requireCondition(!/\/state\.json$|\/operations\.json$|\/pending\//.test(update.path), 'OUT_OF_SCOPE', 'Managed state cannot be edited as a document.');
  if (update.path.startsWith('docs/spec/changes/')) requireCondition(within(update.path, changesPath(state.changeId)), 'OUT_OF_SCOPE', 'Other change records are immutable.');
  if (update.path.startsWith('docs/scratchpad/')) requireCondition(within(update.path, `docs/scratchpad/${state.changeId}`), 'OUT_OF_SCOPE', 'Other Scratchpads are out of scope.');
  if (request.role === 'orchestrator') requireCondition(update.path.startsWith('docs/'), 'OUT_OF_SCOPE', 'The orchestrator does not implement application code.');
  else {
    requireCondition(rolePhases[request.role] === state.phase, 'OUT_OF_SCOPE', 'The role does not own the current phase.');
    assertPreviousApprovals(root, state, state.phase);
    if (request.role === 'implementer') {
      const tasks = loadTasks(root, state).tasks;
      requireCondition(tasks.some(task => task.assignee === 'implementer' && ['pending', 'active'].includes(task.status) && task.dependsOn.every(id => tasks.some(prior => prior.id === id && ['verified', 'obsolete'].includes(prior.status))) && task.editPaths.some(prefix => within(update.path, prefix))), 'OUT_OF_SCOPE', 'No ready task grants this edit.');
    } else requireCondition(update.path.startsWith('docs/'), 'OUT_OF_SCOPE', 'Design roles only edit documents.');
  }
  permit(state, request.operation, update.path, update.content === null, null, request.role);
  if (request.operation === 'scratchpad.update') requireCondition(within(update.path, `docs/scratchpad/${state.changeId}`), 'OUT_OF_SCOPE', 'Scratchpad updates stay in the current case.');
  if (/\/verification\/[^/]+\.json$/.test(update.path)) requireCondition(false, 'OUT_OF_SCOPE', 'Record evidence through verification.record or verification.run.');
  if (update.content !== null && update.path.endsWith('/tasks.json')) {
    const tasks = validateTasks(JSON.parse(update.content)).tasks;
    if (request.role !== 'orchestrator') {
      const previous = existsSync(safePath(root, update.path)) ? loadTasks(root, state).tasks : [];
      requireCondition(tasks.every(task => task.status === (previous.find(old => old.id === task.id)?.status ?? 'pending')), 'OUT_OF_SCOPE', 'Only the coordinator may change task status.');
    } else checkCompletion(root, state, tasks, false);
  }
  if (update.content !== null && update.path.endsWith('/traceability.json')) validate('traceability', JSON.parse(update.content));
  assertNoSecrets(update.content);
}

export function doctor(root) {
  const profilePath = resolve(root, '.github/sdd/profile.json');
  const profile = existsSync(profilePath) ? JSON.parse(readFileSync(profilePath, 'utf8')) : { mode: 'read-only' };
  const automatic = profile.mode === 'managed' && profile.hostChecks?.localHooks === true && profile.hostChecks?.failureDenies === true;
  return {
    node: process.version, platform: process.platform, harness: profile.harness ?? 'unconfirmed', mode: profile.mode,
    localRuntime: Number(process.versions.node.split('.')[0]) === 24 ? 'available' : 'unsupported',
    automaticOperations: automatic ? 'human-attested-not-independently-verified' : 'manual-only',
    ...recordingStatus(root),
    hostVerificationRequired: ['Local tool IDs and payloads', 'agent and skill discovery', 'hook denial and hook failure behavior'],
    sandbox: sandboxStatus(),
    commandPrefix: commandPrefix(root),
    excludedVerification: ['parallel-role-execution', 'mcp-integration']
  };
}

export async function executeRequest(workspace, request) {
  try {
    const root = realpathSync(workspace);
    validateRequest(request);
    assertNoSecrets(request);
    if (request.operation === 'doctor') return { status: 'ok', result: doctor(root) };
    requireCondition(request.role !== 'reviewer' || readOperations.has(request.operation), 'OUT_OF_SCOPE', 'The reviewer cannot write.');
    requireCondition(!coordinatorOperations.has(request.operation) || request.role === 'orchestrator', 'OUT_OF_SCOPE', 'This operation belongs to the orchestrator.');
    if (identifiedOperations.has(request.operation)) requireCondition(request.operationId, 'INVALID_FORMAT', 'This registration or transition requires an operation ID.');
    if (request.operation === 'git.inspect') return { status: 'ok', result: inspectGit(root) };
    const path = statePath(request.changeId);
    const loadState = () => validate('state', readJson(root, path));
    if (request.operation === 'scratchpad.read') {
      shape(request.payload, ['path']);
      const state = loadState();
      const target = request.payload.path ?? path;
      requireCondition(within(target, `docs/scratchpad/${request.changeId}`), 'OUT_OF_SCOPE', 'Scratchpad reads are case-scoped.');
      return { status: 'ok', result: request.payload.path ? readFileSync(safePath(root, target), 'utf8') : state, revisions: { [target]: revision(root, target) } };
    }
    if (request.operation === 'traceability.validate') return { status: 'ok', result: traceability(root, loadState(), request.payload) };
    if (request.operation === 'recover') {
      shape(request.payload, ['apply', 'human']);
      if (request.payload.apply) {
        human(request.payload.human, 'permission');
        const state = existsSync(safePath(root, path)) ? loadState() : null;
        if (state?.git.branch) requireCondition(inspectGit(root).branch === state.git.branch && request.branch === state.git.branch, 'BRANCH_MISMATCH', 'Recover on the original case branch.');
      }
      return { status: 'ok', result: withLock(root, () => recover(root, request.changeId, request.payload.apply === true)) };
    }
    return withLock(root, () => {
      requireCondition(pendingJournals(root, request.changeId).length === 0, 'INCOMPLETE_UPDATE', 'Resolve pending updates before continuing.', 'Run recover without apply, inspect the result, and request repair permission.');
      const ledgerPath = operationsPath(request.changeId);
      const ledger = existsSync(safePath(root, ledgerPath)) ? readJson(root, ledgerPath) : { schemaVersion: 1, operations: {} };
      requireCondition(ledger.schemaVersion === 1 && ledger.operations && typeof ledger.operations === 'object', 'INVALID_FORMAT', 'Invalid operation ledger.');
      const inputHash = hash(stableJson(request));
      if (request.operationId && Object.hasOwn(ledger.operations, request.operationId)) {
        const saved = ledger.operations[request.operationId];
        requireCondition(saved.inputHash === inputHash, 'CONFLICT', 'An operation ID was reused with different input.');
        return { ...saved.result, replayed: true };
      }
      let state = existsSync(safePath(root, path)) ? loadState() : null;
      requireCondition(Object.hasOwn(request.expectedRevisions, path) && request.expectedRevisions[path] === revision(root, path), 'CONFLICT', 'Supply the current state revision, or null for a new case.');
      if (state) {
        requireCondition(state.changeId === request.changeId, 'INVALID_FORMAT', 'The state belongs to a different case.');
        requireCondition(state.status !== 'completed' || request.operation === 'integration.record', 'OUT_OF_SCOPE', 'Completed change records are immutable.');
        if (!['change.register', 'integration.record'].includes(request.operation)) {
          requireCondition(request.branch === state.git.branch, 'BRANCH_MISMATCH', 'The request branch differs from the case.');
          if (state.git.branch !== null) requireCondition(inspectGit(root).branch === state.git.branch, 'BRANCH_MISMATCH', 'The workspace is on another branch.');
        }
      }
      const payload = request.payload;
      const updates = [];
      let result = {};
      if (request.operation === 'change.register') {
        shape(payload, ['kind', 'purpose', 'scope', 'actors', 'git'], ['kind', 'purpose', 'scope', 'actors', 'git']);
        validate('git', payload.git);
        requireCondition(payload.git.branch === request.branch, 'BRANCH_MISMATCH', 'Registration branch mismatch.');
        if (payload.git.branch !== null) {
          const actual = inspectGit(root);
          requireCondition(actual.branch === payload.git.branch && actual.head && payload.git.baseCommit, 'BRANCH_MISMATCH', 'Prepare the Git branch and initial commit manually before binding them.');
          requireCondition(git(root, ['rev-parse', '--verify', `${payload.git.baseCommit}^{commit}`]) === payload.git.baseCommit, 'BRANCH_MISMATCH', 'The base commit does not exist.');
        }
        if (state) {
          requireCondition(state.git.branch === null && state.kind === payload.kind && state.purpose === payload.purpose && json(state.scope) === json(payload.scope) && json(state.actors) === json(payload.actors), 'CONFLICT', 'An existing case can only bind its initially missing Git context.');
          state.git = payload.git;
        } else state = { schemaVersion: 1, changeId: request.changeId, kind: payload.kind, purpose: payload.purpose, scope: payload.scope, git: payload.git, phase: 'ideation', status: 'draft', actors: payload.actors, questions: [], decisions: [], approvals: [], permissions: [], phaseManifests: {}, handoff: { lastOperation: null, nextAction: 'Clarify scope and develop the idea.', reason: '' }, integration: { developmentApproved: false, merge: null, production: null } };
      } else {
        requireCondition(state, 'INVALID_FORMAT', 'Register the case first.');
        if (request.operation === 'permission.record') {
          shape(payload, ['permission'], ['permission']);
          validate('permission', payload.permission);
          human(payload.permission.human, 'permission');
          for (const target of [...payload.permission.editPaths, ...payload.permission.readPaths, ...payload.permission.outputPaths]) safePath(root, target);
          requireCondition(!payload.permission.roles?.includes('reviewer'), 'OUT_OF_SCOPE', 'The reviewer cannot receive write permission.');
          state.permissions.push(payload.permission);
        } else if (['document.update', 'scratchpad.update'].includes(request.operation)) {
          shape(payload, ['updates', 'handoff']);
          requireCondition(Array.isArray(payload.updates ?? []) && ((payload.updates ?? []).length > 0 || payload.handoff), 'INVALID_FORMAT', 'Updates or a handoff are required.');
          if (payload.handoff) {
            requireCondition(request.role === 'orchestrator' && request.operation === 'scratchpad.update', 'OUT_OF_SCOPE', 'Only the coordinator records shared handoff state.');
            shape(payload.handoff, ['nextAction', 'reason'], ['nextAction', 'reason']);
            state.handoff = { ...state.handoff, ...payload.handoff };
          }
          for (const update of payload.updates ?? []) {
            checkDocument(root, state, request, update);
            requireCondition(Object.hasOwn(request.expectedRevisions, update.path), 'CONFLICT', `Supply the expected revision: ${update.path}`);
            updates.push({ path: update.path, content: update.content, before: request.expectedRevisions[update.path] });
          }
          if (state.status === 'approved') state.status = 'active';
        } else if (request.operation === 'question.open') {
          shape(payload, ['text', 'options', 'recommendation', 'impact', 'duePhase'], ['text', 'options', 'recommendation', 'impact', 'duePhase']);
          const question = { ...payload, id: `Q-${String(state.questions.length + 1).padStart(4, '0')}`, status: 'open', answer: null, reflectedIn: [] };
          validate('question', question);
          state.questions.push(question);
          if (phases.indexOf(question.duePhase) <= phases.indexOf(state.phase)) state.status = 'blocked';
          result = { questionId: question.id };
        } else if (request.operation === 'question.record_answer') {
          shape(payload, ['questionId', 'human', 'reflectedIn'], ['questionId', 'human']);
          const question = state.questions.find(item => item.id === payload.questionId);
          requireCondition(question, 'INVALID_FORMAT', 'Unknown question.');
          question.answer = human(payload.human);
          question.reflectedIn = payload.reflectedIn ?? [];
          for (const target of question.reflectedIn) requireCondition(existsSync(safePath(root, target)), 'INVALID_FORMAT', 'Answer reflection target is missing.');
          question.status = question.reflectedIn.length ? 'resolved' : 'answered';
        } else if (request.operation === 'decision.record') {
          shape(payload, ['text', 'rationale', 'questionIds', 'references'], ['text', 'rationale', 'questionIds', 'references']);
          const record = { ...payload, id: `DEC-${String(state.decisions.length + 1).padStart(4, '0')}` };
          validate('decision', record);
          for (const id of record.questionIds) requireCondition(state.questions.some(question => question.id === id), 'INVALID_FORMAT', 'Unknown decision question.');
          for (const target of record.references) requireCondition(existsSync(safePath(root, target)), 'INVALID_FORMAT', 'Decision reference is missing.');
          state.decisions.push(record);
          result = { decisionId: record.id };
        } else if (request.operation === 'approval.request') {
          shape(payload, ['roots', 'disposition'], ['roots']);
          requireCondition(state.phase !== 'task-planning', 'INVALID_FORMAT', 'Task planning does not add an approval gate.');
          requireCondition(state.status !== 'paused', 'OUT_OF_SCOPE', 'Resume before requesting approval.');
          requireCondition(dueQuestions(state, state.phase).length === 0, 'APPROVAL_REQUIRED', 'Required questions are unresolved.');
          assertPreviousApprovals(root, state, state.phase);
          if (state.phase === 'development') checkCompletion(root, state);
          const inputs = {};
          for (const phase of phases.slice(0, phases.indexOf(state.phase)).filter(phase => phase !== 'task-planning')) inputs[phase] = manifest(root, state.phaseManifests[phase].roots).revision;
          requireCondition(Array.isArray(payload.roots) && payload.roots.every(target => within(target, 'docs/spec/current') || within(target, changesPath(state.changeId)) || state.phase === 'development'), 'OUT_OF_SCOPE', 'Approval roots must be phase artifacts.');
          if (state.phase === 'requirements') requireCondition(payload.roots.includes('docs/spec/current/requirements'), 'INVALID_FORMAT', 'Requirements approval includes the entire requirements root.');
          const current = manifest(root, payload.roots, inputs);
          if (payload.disposition) {
            current.disposition = payload.disposition;
            validate('manifest', current);
            human(payload.disposition.human);
            requireCondition(payload.disposition.referenceRevision !== null, 'INVALID_FORMAT', 'Unchanged or inapplicable phases need a reference revision.');
          }
          state.phaseManifests[state.phase] = current;
          state.status = 'awaiting-approval';
          result = { phase: state.phase, manifest: current, requiredActor: phases.indexOf(state.phase) <= 2 ? state.actors.customer : state.actors.technicalLead };
        } else if (request.operation === 'approval.record') {
          shape(payload, ['phase', 'revision', 'judgment', 'human'], ['phase', 'revision', 'judgment', 'human']);
          requireCondition(payload.phase === state.phase && state.status === 'awaiting-approval', 'APPROVAL_REQUIRED', 'Request approval for this phase first.');
          assertPreviousApprovals(root, state, state.phase);
          const saved = state.phaseManifests[state.phase];
          requireCondition(saved.revision === payload.revision && manifest(root, saved.roots, saved.inputs).revision === payload.revision, 'APPROVAL_REQUIRED', 'The approval refers to an old artifact revision.');
          const answer = human(payload.human, payload.judgment === 'approved' ? 'approval' : null);
          requireCondition(answer.actor === (phases.indexOf(state.phase) <= 2 ? state.actors.customer : state.actors.technicalLead), 'APPROVAL_REQUIRED', 'The response does not come from the required approval role.');
          const approval = { phase: state.phase, manifest: saved, judgment: payload.judgment, human: answer };
          validate('approval', approval);
          state.approvals.push(approval);
          state.status = payload.judgment === 'approved' ? 'approved' : 'active';
          if (state.phase === 'development') state.integration.developmentApproved = payload.judgment === 'approved';
        } else if (request.operation === 'workflow.transition') {
          shape(payload, ['action', 'nextPhase', 'human'], ['action']);
          if (payload.action === 'activate') {
            requireCondition(['draft', 'active', 'blocked'].includes(state.status), 'INVALID_FORMAT', 'Cannot activate this status.');
            requireCondition(dueQuestions(state, state.phase).length === 0, 'APPROVAL_REQUIRED', 'Required questions are unresolved.');
            assertPreviousApprovals(root, state, state.phase);
            state.status = 'active';
          } else if (payload.action === 'pause') {
            requireCondition(!['paused', 'completed'].includes(state.status), 'INVALID_FORMAT', 'Cannot pause this status.');
            human(payload.human);
            state.resumeStatus = state.status;
            state.status = 'paused';
          } else if (payload.action === 'resume') {
            requireCondition(state.status === 'paused', 'INVALID_FORMAT', 'This case is not paused.');
            human(payload.human);
            assertPreviousApprovals(root, state, state.phase);
            requireCondition(dueQuestions(state, state.phase).length === 0, 'APPROVAL_REQUIRED', 'Resolve the required questions before resuming.');
            state.status = state.resumeStatus;
            delete state.resumeStatus;
          } else if (payload.action === 'return') {
            human(payload.human);
            requireCondition(phases.indexOf(payload.nextPhase) >= 0 && phases.indexOf(payload.nextPhase) <= phases.indexOf(state.phase), 'INVALID_FORMAT', 'Return only to a current or earlier phase.');
            state.phase = payload.nextPhase;
            state.status = 'active';
          } else {
            requireCondition(payload.action === 'advance', 'INVALID_FORMAT', 'Unknown transition action.');
            requireCondition(!['paused', 'blocked'].includes(state.status) && dueQuestions(state, state.phase).length === 0, 'APPROVAL_REQUIRED', 'The phase is blocked or paused.');
            assertPreviousApprovals(root, state, state.phase);
            if (state.phase !== 'task-planning') assertApproval(root, state, state.phase);
            else {
              loadTasks(root, state);
              requireCondition(traceability(root, state, {}).valid, 'INVALID_FORMAT', 'Resolve traceability findings first.');
            }
            if (state.phase === 'development') {
              checkCompletion(root, state);
              state.status = 'completed';
            } else {
              requireCondition(state.git.branch && state.git.baseCommit, 'BRANCH_MISMATCH', 'Bind the Git branch and base commit before formal change management.');
              state.phase = phases[phases.indexOf(state.phase) + 1];
              requireCondition(!payload.nextPhase || payload.nextPhase === state.phase, 'INVALID_FORMAT', 'Cannot skip a phase.');
              state.status = 'active';
            }
          }
        } else if (request.operation === 'verification.record' || request.operation === 'verification.run') {
          requireCondition(['orchestrator', 'implementer'].includes(request.role), 'OUT_OF_SCOPE', 'Only the coordinator or implementer records verification.');
          assertPreviousApprovals(root, state, state.phase);
          permit(state, request.operation, null, false, request.operation === 'verification.run' ? payload.profile : null, request.role);
          const evidence = request.operation === 'verification.run' ? runVerification(root, state, payload) : validate('evidence', payload.evidence);
          const tasks = loadTasks(root, state).tasks;
          requireCondition(evidence.taskIds.length > 0 && evidence.taskIds.every(id => tasks.some(task => task.id === id)), 'INVALID_FORMAT', 'Evidence references an unknown task.');
          if (request.operation === 'verification.record') {
            shape(payload, ['evidence'], ['evidence']);
            requireCondition(request.role === 'orchestrator' && evidence.human, 'OUT_OF_SCOPE', 'Imported verification needs a human response and coordinator recording.');
            requireCondition(evidence.mode !== 'automatic' && !Object.hasOwn(evidence, 'command') && !Object.hasOwn(evidence, 'exitCode'), 'INVALID_FORMAT', 'Imported human evidence is manual or review, not fabricated automatic execution.');
            human(evidence.human);
            if (evidence.status === 'passed') assertInputsCurrent(root, evidence.inputRevisions);
          }
          const target = `${changesPath(state.changeId)}/verification/${evidence.id}.json`;
          requireCondition(Object.hasOwn(request.expectedRevisions, target), 'CONFLICT', 'Supply the evidence target revision.');
          assertNoSecrets(evidence);
          updates.push({ path: target, content: json(evidence), before: request.expectedRevisions[target] });
          result = { evidencePath: target, evidence };
        } else if (request.operation === 'integration.record') {
          shape(payload, ['branch', 'commit', 'human'], ['branch', 'commit', 'human']);
          requireCondition(state.status === 'completed' && state.integration.developmentApproved, 'APPROVAL_REQUIRED', 'Complete development before recording integration.');
          human(payload.human);
          permit(state, 'merge');
          const actual = inspectGit(root);
          requireCondition(actual.branch === payload.branch && request.branch === payload.branch && actual.head === payload.commit, 'BRANCH_MISMATCH', 'Verify the actual integration target and commit.');
          const approved = phases.map(phase => state.approvals.filter(approval => approval.phase === phase && approval.judgment === 'approved').at(-1)).filter(Boolean);
          for (const approval of approved) {
            requireCondition(approval.manifest.revision === manifest(root, approval.manifest.roots, approval.manifest.inputs).revision, 'APPROVAL_REQUIRED', 'Reapprove changed artifacts before integration.');
            for (const [target, expected] of Object.entries(approval.manifest.files)) requireCondition(hash(gitBytes(root, ['show', `${payload.commit}:${target}`])) === expected, 'CONFLICT', `Integration contents differ: ${target}`);
          }
          state.integration.merge = payload;
        } else requireCondition(false, 'INVALID_FORMAT', 'Unsupported operation.');
      }
      state.handoff.lastOperation = request.operationId ?? request.operation;
      validate('state', state);
      assertNoSecrets(state);
      updates.push({ path, content: json(state), before: request.expectedRevisions[path] });
      const response = { status: 'ok', operationId: request.operationId ?? null, result, revisions: Object.fromEntries(updates.map(update => [update.path, update.content === null ? null : hash(update.content)])) };
      if (request.operationId) {
        ledger.operations[request.operationId] = { inputHash, result: response };
        updates.push({ path: ledgerPath, before: revision(root, ledgerPath), content: json(ledger) });
      }
      commit(root, request.changeId, updates);
      return response;
    });
  } catch (error) {
    return { status: 'error', error: { code: error.code ?? 'INVALID_FORMAT', message: redact(error.message), nextAction: error.nextAction ?? 'Inspect the input and pending updates before retrying.' } };
  }
}