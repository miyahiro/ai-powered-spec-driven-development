import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { check } from '../check.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workspace = resolve(root, '..');

function frontmatter(path) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(readFileSync(path, 'utf8'));
  assert.ok(match, `Missing frontmatter: ${path}`);
  const data = {};
  for (const line of match[1].split('\n')) {
    const pair = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const value = pair[2].trim();
    data[pair[1]] = /^\[.*\]$/.test(value) ? value.slice(1, -1).split(',').map(item => item.trim()).filter(Boolean) : value.replace(/^"|"$/g, '');
  }
  return data;
}

test('four agents have explicit roles and least privilege without custom hooks', () => {
  const folder = resolve(root, 'agents');
  const expected = { 'sdd-orchestrator': ['read', 'search', 'edit', 'execute', 'agent', 'vscode_askQuestions'], 'sdd-designer': ['read', 'search', 'edit'], 'sdd-implementer': ['read', 'search', 'edit', 'execute'], 'sdd-reviewer': ['read', 'search'] };
  assert.deepEqual(readdirSync(folder).sort(), Object.keys(expected).map(name => `${name}.agent.md`).sort());
  for (const [name, tools] of Object.entries(expected)) {
    const path = resolve(folder, `${name}.agent.md`);
    const data = frontmatter(path);
    assert.equal(data.name, name);
    assert.ok(data.description.length > 20);
    assert.deepEqual(data.tools, tools);
    assert.equal(data['user-invocable'], String(name === 'sdd-orchestrator'));
    assert.ok(!readFileSync(path, 'utf8').includes('hooks:'), `${name}: custom hooks are not used`);
  }
  assert.deepEqual(frontmatter(resolve(folder, 'sdd-orchestrator.agent.md')).agents, ['sdd-designer', 'sdd-implementer', 'sdd-reviewer']);
});

test('twelve discoverable skills have matching names and actionable procedures', () => {
  const folder = resolve(root, 'skills');
  const expected = ['change-intake', 'workflow-status', 'clarification', 'phase-approval', 'idea-dialogue', 'requirements-definition', 'external-design', 'ddd-internal-design', 'change-impact-analysis', 'task-planning', 'tdd-cycle', 'review'];
  assert.deepEqual(readdirSync(folder).sort(), [...expected].sort());
  for (const name of expected) {
    const path = resolve(folder, name, 'SKILL.md');
    const data = frontmatter(path);
    assert.equal(data.name, name);
    assert.ok(data.description.length > 20 && data.description.length <= 1024);
    assert.equal(data['user-invocable'], 'true');
    const body = readFileSync(path, 'utf8');
    for (const label of ['入力:', '1.', '停止:', '出力:']) assert.ok(body.includes(label), `${name}: ${label}`);
  }
});

test('instructions forbid remote Git operations and broad staging', () => {
  const text = readFileSync(resolve(root, 'copilot-instructions.md'), 'utf8');
  for (const phrase of ['push', 'git add -A', 'approve(<工程>)', 'check.mjs']) assert.ok(text.includes(phrase), phrase);
  const approval = readFileSync(resolve(root, 'skills/phase-approval/SKILL.md'), 'utf8');
  assert.match(approval, /git add -- <対象のパス> docs\/spec\/changes\/<ID>\/status\.md/);
});

test('this repository passes its own check without errors', () => {
  const result = check(workspace);
  assert.deepEqual(result.errors, []);
});
