import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateTool } from '../bin/guard.mjs';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safePath, revision, commit, recover, manifest, withLock } from '../lib/store.mjs';
import { validate, hash, json, redact } from '../lib/validation.mjs';
import { executeRequest, doctor, commandPrefix, checkCompletion } from '../lib/runtime.mjs';
import { validateRequest, stableJson } from '../lib/validation.mjs';
import { checkMount, runVerification } from '../lib/verification.mjs';

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