import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateTool } from '../bin/guard.mjs';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safePath, revision, commit, recover, manifest, withLock } from '../lib/store.mjs';
import { validate, hash, json, redact } from '../lib/validation.mjs';
import { executeRequest, doctor, commandPrefix, checkCompletion, parseRequestArgument } from '../lib/runtime.mjs';
import { validateRequest, stableJson } from '../lib/validation.mjs';
import { checkMount, runVerification } from '../lib/verification.mjs';
import { recordingStatus, enableAutomatic, disableAutomatic, setRecordingDefault, executingAgents } from '../lib/setup.mjs';

const profile = { mode: 'read-only', tools: { read_file: { kind: 'read' }, run_in_terminal: { kind: 'execute' } } };
const decision = result => result.hookSpecificOutput.permissionDecision;

test('unknown tools and malformed hook payloads are denied', () => {
  assert.equal(decision(evaluateTool({}, 'orchestrator', profile, process.cwd())), 'deny');
  assert.equal(decision(evaluateTool({ tool_name: 'apply_patch', tool_input: {} }, 'orchestrator', profile, process.cwd())), 'deny');
});

test('read-only bootstrap permits known reads but not terminal execution', () => {
  assert.equal(decision(evaluateTool({ tool_name: 'read_file', tool_input: { filePath: 'README.md' } }, 'requirements', { ...profile, tools: { ...profile.tools, read_file: { kind: 'read', pathKeys: ['filePath'] } } }, process.cwd())), 'allow');
  assert.equal(decision(evaluateTool({ tool_name: 'run_in_terminal', tool_input: { command: 'git push' } }, 'orchestrator', profile, process.cwd())), 'deny');
});

function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-test-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs'), { recursive: true });
  return root;
}

test('schema rejects missing request fields and unsupported versions', () => {
  assert.throws(() => validate('request', { schemaVersion: 2 }), { code: 'INVALID_FORMAT' });
});

test('managed paths reject traversal, symlinks, secrets and control settings', context => {
  const root = fixture(context);
  symlinkSync(tmpdir(), join(root, 'outside'));
  for (const path of ['../outside', 'outside/file.txt', '.github/agents/agent.md', './.github/agents/agent.md', 'docs//file.md', '.', '.env']) assert.throws(() => safePath(root, path), { code: 'OUT_OF_SCOPE' });
});

test('a stale expected revision leaves a human edit unchanged', context => {
  const root = fixture(context);
  writeFileSync(join(root, 'docs/a.md'), 'human edit');
  assert.throws(() => withLock(root, () => commit(root, 'CHG-0001', [{ path: 'docs/a.md', before: hash('old'), content: 'AI edit' }])), { code: 'CONFLICT' });
  assert.equal(readFileSync(join(root, 'docs/a.md'), 'utf8'), 'human edit');
});

test('partial local updates are recoverable and do not require a server', context => {
  const root = fixture(context);
  const updates = ['docs/a.md', 'docs/b.md'].map(path => ({ path, before: null, content: path }));
  assert.throws(() => withLock(root, () => commit(root, 'CHG-0001', updates, index => { if (index === 0) throw new Error('interrupted'); })), /interrupted/);
  assert.equal(recover(root, 'CHG-0001')[0].remaining.length, 1);
  withLock(root, () => recover(root, 'CHG-0001', true));
  assert.equal(revision(root, 'docs/b.md'), hash('docs/b.md'));
  assert.deepEqual(recover(root, 'CHG-0001'), []);
});

test('recovery refuses to erase a manual edit after interruption', context => {
  const root = fixture(context);
  assert.throws(() => commit(root, 'CHG-0001', [{ path: 'docs/a.md', before: null, content: 'AI' }], () => { throw new Error('interrupted'); }));
  writeFileSync(join(root, 'docs/a.md'), 'human');
  assert.throws(() => recover(root, 'CHG-0001', true), { code: 'CONFLICT' });
  assert.equal(readFileSync(join(root, 'docs/a.md'), 'utf8'), 'human');
});

test('approval manifests notice additions and exclude state records', context => {
  const root = fixture(context);
  writeFileSync(join(root, 'docs/a.md'), 'one');
  const before = manifest(root, ['docs']);
  writeFileSync(join(root, 'docs/b.md'), 'two');
  assert.notEqual(manifest(root, ['docs']).revision, before.revision);
  assert.throws(() => manifest(root, ['docs/scratchpad/CHG-0001']), { code: 'OUT_OF_SCOPE' });
});

test('known credential formats are redacted', () => {
  const secret = `ghp_${'a'.repeat(36)}`;
  assert.ok(!redact(json({ result: secret })).includes(secret));
  assert.ok(!redact(json({ password: 'sensitive-value' })).includes('sensitive-value'));
});

const actor = { actor: 'owner', answer: 'この工程を承認します', source: 'human conversation response', timestamp: '2026-10-13T00:00:00Z' };
const caseStatePath = 'docs/scratchpad/CHG-0001/state.json';

function request(root, operation, payload, operationId) {
  return { schemaVersion: 1, operation, role: 'orchestrator', changeId: 'CHG-0001', branch: null, expectedRevisions: { [caseStatePath]: revision(root, caseStatePath) }, payload, ...(operationId ? { operationId } : {}) };
}

async function register(root) {
  const input = request(root, 'change.register', { kind: 'new', purpose: 'example project', scope: { in: ['example'], out: [] }, actors: { customer: 'owner', technicalLead: 'owner' }, git: { defaultBranch: null, branch: null, baseCommit: null } }, 'register-1');
  const response = await executeRequest(root, input);
  assert.equal(response.status, 'ok', json(response));
  return input;
}

test('case registration can be replayed after a new runtime invocation', async context => {
  const root = fixture(context);
  const input = await register(root);
  assert.equal((await executeRequest(root, input)).replayed, true);
  assert.equal((await executeRequest(root, { ...input, payload: { ...input.payload, purpose: 'changed' } })).error.code, 'CONFLICT');
});

test('question answers are not approvals and future questions do not stop ideation', async context => {
  const root = fixture(context);
  await register(root);
  const response = await executeRequest(root, request(root, 'question.open', { text: 'Performance target?', options: [], recommendation: '', impact: ['performance design'], duePhase: 'requirements' }, 'question-1'));
  assert.equal(response.status, 'ok', json(response));
  assert.equal(readJsonForTest(root, caseStatePath).status, 'draft');
  const answer = await executeRequest(root, request(root, 'question.record_answer', { questionId: 'Q-0001', human: { ...actor, answer: 'Decide at requirements.' } }, 'answer-1'));
  assert.equal(answer.status, 'ok', json(answer));
  assert.equal(readJsonForTest(root, caseStatePath).approvals.length, 0);
});

function readJsonForTest(root, path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

test('phase approval excludes its own recording and does not grant Git permission', async context => {
  const root = fixture(context);
  await register(root);
  mkdirSync(join(root, 'docs/spec/changes/CHG-0001'), { recursive: true });
  writeFileSync(join(root, 'docs/spec/changes/CHG-0001/ideation.md'), 'approved idea\n');
  const approvalRequest = await executeRequest(root, request(root, 'approval.request', { roots: ['docs/spec/changes/CHG-0001/ideation.md'] }, 'approval-request-1'));
  assert.equal(approvalRequest.status, 'ok', json(approvalRequest));
  const input = { phase: 'ideation', revision: approvalRequest.result.manifest.revision, judgment: 'approved', human: actor };
  for (const [index, answer] of ['続けて', '承認は保留します', '承認しますか？', '承認できません'].entries()) {
    const ambiguous = await executeRequest(root, request(root, 'approval.record', { ...input, human: { ...actor, answer } }, `approval-ambiguous-${index}`));
    assert.equal(ambiguous.error.code, 'APPROVAL_REQUIRED');
  }
  const response = await executeRequest(root, request(root, 'approval.record', input, 'approval-1'));
  assert.equal(response.status, 'ok', json(response));
  const state = readJsonForTest(root, caseStatePath);
  assert.equal(state.phaseManifests.ideation.revision, approvalRequest.result.manifest.revision);
  assert.equal(state.status, 'approved');
  assert.equal(state.permissions.length, 0);
  const advance = await executeRequest(root, request(root, 'workflow.transition', { action: 'advance' }, 'advance-1'));
  assert.equal(advance.error.code, 'BRANCH_MISMATCH');
});

test('document updates require permission and preserve stale manual changes', async context => {
  const root = fixture(context);
  await register(root);
  const input = request(root, 'document.update', { updates: [{ path: 'docs/idea.md', content: 'candidate' }] });
  input.expectedRevisions['docs/idea.md'] = null;
  assert.equal((await executeRequest(root, input)).error.code, 'PERMISSION_REQUIRED');
  const permission = { operations: ['document.update'], editPaths: ['docs'], readPaths: ['docs'], outputPaths: [], profiles: [], allowDelete: false, human: { ...actor, answer: '文書の編集を許可します' } };
  assert.equal((await executeRequest(root, request(root, 'permission.record', { permission: { ...permission, human: { ...actor, answer: '許可できません' } } }, 'permission-denied'))).error.code, 'PERMISSION_REQUIRED');
  assert.equal((await executeRequest(root, request(root, 'permission.record', { permission }, 'permission-1'))).status, 'ok');
  const fresh = request(root, 'document.update', input.payload);
  fresh.expectedRevisions['docs/idea.md'] = null;
  assert.equal((await executeRequest(root, fresh)).status, 'ok');
  const stale = request(root, 'document.update', { updates: [{ path: 'docs/idea.md', content: 'overwrite' }] });
  stale.expectedRevisions['docs/idea.md'] = hash('candidate');
  writeFileSync(join(root, 'docs/idea.md'), 'human edit');
  assert.equal((await executeRequest(root, stale)).error.code, 'CONFLICT');
  assert.equal(readFileSync(join(root, 'docs/idea.md'), 'utf8'), 'human edit');
});

test('reviewers cannot register or update a case', async context => {
  const root = fixture(context);
  const input = await register(root);
  assert.equal((await executeRequest(root, { ...input, role: 'reviewer' })).error.code, 'OUT_OF_SCOPE');
});

test('doctor never claims that host hooks were tested by the CLI', context => {
  const root = fixture(context);
  assert.equal(doctor(root).automaticOperations, 'manual-only');
  assert.deepEqual(doctor(root).excludedVerification, ['parallel-role-execution', 'mcp-integration']);
});

test('operation payload schemas reject arbitrary shell fields and malformed booleans', context => {
  const root = fixture(context);
  assert.throws(() => validateRequest(request(root, 'doctor', { command: 'sh' })), { code: 'INVALID_FORMAT' });
  assert.throws(() => validateRequest(request(root, 'recover', { apply: 'yes' })), { code: 'INVALID_FORMAT' });
  assert.equal(stableJson({ first: 1, second: 2 }), stableJson({ second: 2, first: 1 }));
});

test('managed terminal accepts one fixed request and denies shell injection or role switching', context => {
  const root = fixture(context);
  const input = request(root, 'doctor', {});
  const encoded = Buffer.from(JSON.stringify(input)).toString('base64url');
  const managed = { mode: 'managed', hostChecks: { localHooks: true, failureDenies: true }, tools: { run_in_terminal: { kind: 'execute' } } };
  const command = `${commandPrefix(root)}${encoded}`;
  assert.equal(decision(evaluateTool({ tool_name: 'run_in_terminal', tool_input: { command } }, 'orchestrator', managed, root)), 'allow');
  for (const suffix of ['; git push', '\ntrue', ' > out', ' extra']) assert.equal(decision(evaluateTool({ tool_name: 'run_in_terminal', tool_input: { command: command + suffix } }, 'orchestrator', managed, root)), 'deny');
  assert.equal(decision(evaluateTool({ tool_name: 'run_in_terminal', tool_input: { command } }, 'implementer', managed, root)), 'deny');
});

test('managed terminal accepts one single-quoted JSON request and denies quote breaks or extra syntax', context => {
  const root = fixture(context);
  const managed = { mode: 'managed', hostChecks: { localHooks: true, failureDenies: true }, tools: { run_in_terminal: { kind: 'execute' } } };
  const text = JSON.stringify(request(root, 'doctor', {}));
  const allowed = `${commandPrefix(root)}'${text}'`;
  assert.equal(decision(evaluateTool({ tool_name: 'run_in_terminal', tool_input: { command: allowed } }, 'orchestrator', managed, root)), 'allow');
  for (const command of [`${allowed}; git push`, `${allowed} extra`, `${commandPrefix(root)}'${text}'\''x'`, `${commandPrefix(root)}'${text.replace('{', '{\n')}'`, `${commandPrefix(root)}${text}`, `${commandPrefix(root)}'[]'`]) {
    assert.equal(decision(evaluateTool({ tool_name: 'run_in_terminal', tool_input: { command } }, 'orchestrator', managed, root)), 'deny');
  }
  assert.equal(decision(evaluateTool({ tool_name: 'run_in_terminal', tool_input: { command: allowed } }, 'implementer', managed, root)), 'deny');
  assert.equal(decision(evaluateTool({ tool_name: 'run_in_terminal', tool_input: { command: allowed } }, 'orchestrator', { ...managed, mode: 'read-only' }, root)), 'deny');
});

test('the runner parses base64url or single-line JSON request arguments only', () => {
  const value = { schemaVersion: 1, operation: 'doctor', note: "it\u0027s" };
  assert.deepEqual(parseRequestArgument(Buffer.from(JSON.stringify(value)).toString('base64url')), value);
  assert.deepEqual(parseRequestArgument('{"schemaVersion":1,"note":"it\\u0027s"}'), { schemaVersion: 1, note: "it's" });
  for (const argument of ["{\"a\":\"'\"}", '{"a":1}\n', '[1]', 'not json!', '']) assert.throws(() => parseRequestArgument(argument));
});

test('tool guard rejects unscoped reads, protected files and unauthorized delegation', context => {
  const root = fixture(context);
  const scoped = { readRoots: ['docs'], tools: { read_file: { kind: 'read', pathKeys: ['filePath'] }, semantic_search: { kind: 'read', pathKeys: [] }, runSubagent: { kind: 'agent' } } };
  for (const filePath of ['.env', '../outside', 'src/a.mjs', './docs/a.md']) assert.equal(decision(evaluateTool({ tool_name: 'read_file', tool_input: { filePath } }, 'requirements', scoped, root)), 'deny');
  assert.equal(decision(evaluateTool({ tool_name: 'semantic_search', tool_input: { query: 'anything' } }, 'orchestrator', scoped, root)), 'deny');
  assert.equal(decision(evaluateTool({ tool_name: 'runSubagent', tool_input: { agentName: 'sdd-reviewer' } }, 'orchestrator', scoped, root)), 'allow');
  assert.equal(decision(evaluateTool({ tool_name: 'runSubagent', tool_input: { agentName: 'sdd-reviewer' } }, 'implementer', scoped, root)), 'deny');
});

test('approval rejects new artifacts after requesting the phase revision', async context => {
  const root = fixture(context);
  await register(root);
  mkdirSync(join(root, 'docs/spec/changes/CHG-0001/idea'), { recursive: true });
  writeFileSync(join(root, 'docs/spec/changes/CHG-0001/idea/first.md'), 'first');
  const response = await executeRequest(root, request(root, 'approval.request', { roots: ['docs/spec/changes/CHG-0001/idea'] }, 'request'));
  assert.equal(response.status, 'ok', json(response));
  writeFileSync(join(root, 'docs/spec/changes/CHG-0001/idea/second.md'), 'new');
  const approval = await executeRequest(root, request(root, 'approval.record', { phase: 'ideation', revision: response.result.manifest.revision, judgment: 'approved', human: actor }, 'approve'));
  assert.equal(approval.error.code, 'APPROVAL_REQUIRED');
});

test('verification mounts reject nested secrets and symlinks before starting workers', context => {
  const root = fixture(context);
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/.env'), 'not exposed');
  assert.throws(() => checkMount(root, 'src'), { code: 'OUT_OF_SCOPE' });
  rmSync(join(root, 'src/.env'));
  symlinkSync(tmpdir(), join(root, 'src/link'));
  assert.throws(() => checkMount(root, 'src'), { code: 'OUT_OF_SCOPE' });
});

test('unconfirmed isolation never falls back to an ordinary test command', context => {
  const root = fixture(context);
  mkdirSync(join(root, '.github/sdd'), { recursive: true });
  writeFileSync(join(root, '.github/sdd/profile.json'), JSON.stringify({ verificationProfiles: {} }));
  assert.throws(() => runVerification(root, { phase: 'development' }, { id: 'run', profile: 'unconfirmed', taskIds: ['TASK-0001'] }), { code: 'ENVIRONMENT_UNSUPPORTED' });
});

function completionFixture(root, type = 'documentation') {
  const folder = 'docs/spec/changes/CHG-0001/verification';
  mkdirSync(join(root, folder), { recursive: true });
  writeFileSync(join(root, 'docs/input.md'), 'current');
  const evidence = { schemaVersion: 1, id: 'manual', mode: 'manual', taskIds: ['TASK-0001'], inputRevisions: { 'docs/input.md': hash('current') }, environment: 'human test environment', timestamp: actor.timestamp, method: 'inspection', status: 'passed', result: 'Observed expected result.', nextAction: '', human: actor };
  writeFileSync(join(root, `${folder}/manual.json`), json(evidence));
  const review = { ...evidence, id: 'review', mode: 'review', independent: true, reviewer: 'independent-person', human: { ...actor, actor: 'independent-person' } };
  writeFileSync(join(root, `${folder}/review.json`), json(review));
  const task = { id: 'TASK-0001', title: 'example', type, requirementIds: [], designIds: [], acceptanceIds: [], dependsOn: [], inputs: { 'docs/input.md': hash('current') }, assignee: 'implementer', editPaths: ['docs/input.md'], verification: { method: type === 'behavior' ? 'tdd' : 'inspection', environment: 'human' }, completionCriteria: ['expected result'], status: 'verified', evidence: [`${folder}/manual.json`], review: [`${folder}/review.json`] };
  return { task, evidence, folder };
}

test('task completion needs current evidence and a genuinely distinct recorded reviewer', context => {
  const root = fixture(context);
  const { task, folder } = completionFixture(root);
  const state = { changeId: 'CHG-0001' };
  assert.doesNotThrow(() => checkCompletion(root, state, [task], false));
  assert.throws(() => checkCompletion(root, state, [{ ...task, review: [] }], false), { code: 'APPROVAL_REQUIRED' });
  const reviewPath = join(root, `${folder}/review.json`);
  const saved = JSON.parse(readFileSync(reviewPath, 'utf8'));
  writeFileSync(reviewPath, json({ ...saved, reviewer: 'implementer' }));
  assert.throws(() => checkCompletion(root, state, [task], false), { code: 'APPROVAL_REQUIRED' });
  writeFileSync(reviewPath, json(saved));
  writeFileSync(join(root, 'docs/input.md'), 'new revision');
  assert.throws(() => checkCompletion(root, state, [task], false), { code: 'CONFLICT' });
});

test('behavior completion requires intended Red, Green and current post-refactor evidence', context => {
  const root = fixture(context);
  const { task, evidence, folder } = completionFixture(root, 'behavior');
  const state = { changeId: 'CHG-0001' };
  const stages = ['red', 'green', 'refactor'];
  for (const stage of stages) writeFileSync(join(root, `${folder}/${stage}.json`), json({ ...evidence, id: stage, tddStage: stage, status: stage === 'red' ? 'failed' : 'passed', failureKind: stage === 'red' ? 'syntax' : 'unknown' }));
  task.evidence = stages.map(stage => `${folder}/${stage}.json`);
  assert.throws(() => checkCompletion(root, state, [task], false), { code: 'APPROVAL_REQUIRED' });
  writeFileSync(join(root, `${folder}/red.json`), json({ ...evidence, id: 'red', tddStage: 'red', status: 'failed', failureKind: 'behavior', inputRevisions: { 'docs/input.md': hash('prior behavior') } }));
  assert.doesNotThrow(() => checkCompletion(root, state, [task], false));
});

function setupFixture(context) {
  const root = fixture(context);
  mkdirSync(join(root, '.github/sdd'), { recursive: true });
  mkdirSync(join(root, '.github/agents'), { recursive: true });
  writeFileSync(join(root, '.github/sdd/profile.json'), JSON.stringify({ mode: 'read-only', recordingDefault: 'automatic', hostChecks: { localHooks: false, failureDenies: false } }));
  for (const role of [...executingAgents, 'reviewer']) writeFileSync(join(root, `.github/agents/sdd-${role}.agent.md`), `---\nname: sdd-${role}\ntools: [read, search]\n---\n\n# ${role}\n`);
  return root;
}

test('automatic recording is the default but stays stopped until a human confirms the host checks', context => {
  const root = setupFixture(context);
  assert.equal(recordingStatus(root).recording, 'setup-required');
  assert.equal(doctor(root).recording, 'setup-required');
  enableAutomatic(root, 'VS Code example');
  assert.deepEqual(recordingStatus(root), { recordingDefault: 'automatic', recording: 'automatic', hostChecked: true, executeEnabled: true });
  assert.match(readFileSync(join(root, '.github/agents/sdd-orchestrator.agent.md'), 'utf8'), /^tools: \[read, search, execute\]$/m);
  assert.match(readFileSync(join(root, '.github/agents/sdd-reviewer.agent.md'), 'utf8'), /^tools: \[read, search\]$/m);
  writeFileSync(join(root, '.github/agents/sdd-implementer.agent.md'), '---\nname: sdd-implementer\ntools: [read, search]\n---\n');
  assert.equal(recordingStatus(root).recording, 'setup-required');
  disableAutomatic(root);
  assert.equal(recordingStatus(root).executeEnabled, false);
  assert.equal(JSON.parse(readFileSync(join(root, '.github/sdd/profile.json'), 'utf8')).mode, 'read-only');
});

test('a workspace can make manual recording its default without disabling the host checks', context => {
  const root = setupFixture(context);
  enableAutomatic(root);
  setRecordingDefault(root, 'manual');
  assert.equal(recordingStatus(root).recording, 'manual');
  setRecordingDefault(root, 'automatic');
  assert.equal(recordingStatus(root).recording, 'automatic');
  assert.throws(() => setRecordingDefault(root, 'anything'));
});

test('agents cannot run the human setup command even after automatic recording is enabled', context => {
  const root = setupFixture(context);
  const managed = { mode: 'managed', hostChecks: { localHooks: true, failureDenies: true }, tools: { run_in_terminal: { kind: 'execute' } } };
  const node = commandPrefix(root).split(' ')[0];
  for (const command of [`${node} '${join(root, '.github/sdd/bin/setup.mjs')}' enable --confirm-host-checks`, `${commandPrefix(root)}setup`, 'node .github/sdd/bin/setup.mjs default automatic']) {
    assert.equal(decision(evaluateTool({ tool_name: 'run_in_terminal', tool_input: { command } }, 'orchestrator', managed, root)), 'deny');
  }
});

async function permitDocs(root) {
  const permission = { operations: ['document.update'], editPaths: ['docs'], readPaths: ['docs'], outputPaths: [], profiles: [], allowDelete: false, human: { ...actor, answer: '文書の編集を許可します' } };
  assert.equal((await executeRequest(root, request(root, 'permission.record', { permission }, 'permission-docs'))).status, 'ok');
}

function editRequest(root, path, edits) {
  const input = request(root, 'document.update', { updates: [{ path, edits }] });
  input.expectedRevisions[path] = revision(root, path);
  return input;
}

test('differential edits replace exactly one match in order and keep revision checks', async context => {
  const root = fixture(context);
  await register(root);
  await permitDocs(root);
  writeFileSync(join(root, 'docs/spec.md'), '# Spec\n\nalpha\nbeta\n');
  const response = await executeRequest(root, editRequest(root, 'docs/spec.md', [{ oldText: 'alpha', newText: 'ALPHA $&' }, { oldText: 'ALPHA $&\nbeta', newText: 'gamma' }]));
  assert.equal(response.status, 'ok', json(response));
  assert.equal(readFileSync(join(root, 'docs/spec.md'), 'utf8'), '# Spec\n\ngamma\n');
  assert.equal(response.revisions['docs/spec.md'], hash('# Spec\n\ngamma\n'));
  writeFileSync(join(root, 'docs/spec.md'), 'x\nx\n');
  assert.equal((await executeRequest(root, editRequest(root, 'docs/spec.md', [{ oldText: 'x', newText: 'y' }]))).error.code, 'INVALID_FORMAT');
  assert.equal((await executeRequest(root, editRequest(root, 'docs/spec.md', [{ oldText: 'missing', newText: 'y' }]))).error.code, 'INVALID_FORMAT');
  assert.equal(readFileSync(join(root, 'docs/spec.md'), 'utf8'), 'x\nx\n');
  const stale = editRequest(root, 'docs/spec.md', [{ oldText: 'x\nx', newText: 'z' }]);
  writeFileSync(join(root, 'docs/spec.md'), 'x\nx\nhuman edit\n');
  assert.equal((await executeRequest(root, stale)).error.code, 'CONFLICT');
  assert.equal(readFileSync(join(root, 'docs/spec.md'), 'utf8'), 'x\nx\nhuman edit\n');
  const missing = editRequest(root, 'docs/new.md', [{ oldText: 'a', newText: 'b' }]);
  assert.equal((await executeRequest(root, missing)).error.code, 'INVALID_FORMAT');
  assert.throws(() => validateRequest({ ...editRequest(root, 'docs/spec.md', []), payload: { updates: [{ path: 'docs/spec.md', content: 'a', edits: [{ oldText: 'a', newText: 'b' }] }] } }), { code: 'INVALID_FORMAT' });
});

test('differential edits follow the same permission and protected-path rules', async context => {
  const root = fixture(context);
  await register(root);
  writeFileSync(join(root, 'docs/spec.md'), 'alpha\n');
  assert.equal((await executeRequest(root, editRequest(root, 'docs/spec.md', [{ oldText: 'alpha', newText: 'beta' }]))).error.code, 'PERMISSION_REQUIRED');
  await permitDocs(root);
  const state = editRequest(root, caseStatePath, [{ oldText: '"draft"', newText: '"completed"' }]);
  assert.equal((await executeRequest(root, state)).error.code, 'OUT_OF_SCOPE');
  assert.equal(readFileSync(join(root, 'docs/spec.md'), 'utf8'), 'alpha\n');
});

test('revision reads return only versions and reject protected paths', async context => {
  const root = fixture(context);
  writeFileSync(join(root, 'docs/a.md'), 'content');
  const input = { schemaVersion: 1, operation: 'revision.read', role: 'reviewer', changeId: 'CHG-0001', branch: null, expectedRevisions: {}, payload: { paths: ['docs/a.md', 'docs/missing.md'] } };
  assert.deepEqual((await executeRequest(root, input)).result, { 'docs/a.md': hash('content'), 'docs/missing.md': null });
  for (const path of ['.github/sdd/profile.json', '.env', '../outside']) assert.equal((await executeRequest(root, { ...input, payload: { paths: [path] } })).status, 'error');
});

const statusSummaryPath = 'docs/scratchpad/CHG-0001/status.json';
const liveStatus = async (root, role = 'orchestrator', payload = {}) => executeRequest(root, { schemaVersion: 1, operation: 'workflow.status', role, changeId: 'CHG-0001', branch: null, expectedRevisions: {}, payload });

test('every state change writes a compact summary that status can read without the case files', async context => {
  const root = fixture(context);
  await register(root);
  let summary = readJsonForTest(root, statusSummaryPath);
  assert.equal(summary.basis, 'last-recorded-operation');
  assert.equal(summary.phase, 'ideation');
  assert.equal(summary.lastOperation, 'register-1');
  assert.ok(Date.parse(summary.generatedAt));
  assert.equal((await executeRequest(root, request(root, 'question.open', { text: '保存期間', options: [], recommendation: '', impact: ['保持'], duePhase: 'ideation' }, 'question-1'))).status, 'ok');
  summary = readJsonForTest(root, statusSummaryPath);
  assert.deepEqual(summary.questions.due.map(question => question.id), ['Q-0001']);
  assert.equal(summary.status, 'blocked');
  assert.match(summary.nextAction, /Q-0001/);
  const live = await liveStatus(root, 'reviewer');
  assert.equal(live.status, 'ok', json(live));
  assert.equal(live.result.basis, 'live');
  assert.deepEqual(live.result.questions.due, summary.questions.due);
  assert.equal(live.result.records, undefined);
  assert.deepEqual(live.result.permissions, []);
  const snapshot = request(root, 'scratchpad.update', { updates: [{ path: statusSummaryPath, content: '{}' }] });
  snapshot.expectedRevisions[statusSummaryPath] = revision(root, statusSummaryPath);
  assert.equal((await executeRequest(root, snapshot)).error.code, 'OUT_OF_SCOPE');
});

test('live status detects artifacts changed after approval and lists recent records on request', async context => {
  const root = fixture(context);
  await register(root);
  mkdirSync(join(root, 'docs/spec/changes/CHG-0001'), { recursive: true });
  writeFileSync(join(root, 'docs/spec/changes/CHG-0001/ideation.md'), 'approved idea\n');
  const approvalRequest = await executeRequest(root, request(root, 'approval.request', { roots: ['docs/spec/changes/CHG-0001/ideation.md'] }, 'approval-request-1'));
  assert.equal(readJsonForTest(root, statusSummaryPath).awaitingApproval.requiredActor, 'owner');
  await executeRequest(root, request(root, 'approval.record', { phase: 'ideation', revision: approvalRequest.result.manifest.revision, judgment: 'approved', human: actor }, 'approval-1'));
  assert.deepEqual((await liveStatus(root)).result.staleApprovals, []);
  writeFileSync(join(root, 'docs/spec/changes/CHG-0001/ideation.md'), 'edited after approval\n');
  const live = await liveStatus(root, 'orchestrator', { recordLimit: 5 });
  assert.deepEqual(live.result.staleApprovals, ['ideation']);
  assert.match(live.result.nextAction, /ideation/);
  assert.deepEqual(readJsonForTest(root, statusSummaryPath).staleApprovals, [], 'the snapshot reflects only the last recorded operation');
  assert.equal(live.result.records[0].type, 'approval');
  assert.equal(live.result.records[0].actor, 'owner');
  assert.equal((await liveStatus(root, 'orchestrator', { recordLimit: 51 })).error.code, 'INVALID_FORMAT');
});
