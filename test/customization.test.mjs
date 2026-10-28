import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { check, checkLinks } from '../plugins/sdd/skills/spec-check/scripts/check.mjs';

const workspace = resolve(import.meta.dirname, '..');
const plugin = resolve(workspace, 'plugins/sdd');

function read(path) {
  assert.ok(existsSync(path), `Missing: ${path}`);
  return readFileSync(path, 'utf8');
}

function list(folder) {
  assert.ok(existsSync(folder), `Missing: ${folder}`);
  return readdirSync(folder);
}

function frontmatter(path) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(read(path));
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

function markdownFiles(folder) {
  return list(folder).flatMap(name => {
    const path = resolve(folder, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

test('the plugin manifest and the marketplace entry agree', () => {
  const manifest = JSON.parse(read(resolve(plugin, 'plugin.json')));
  assert.equal(manifest.name, 'sdd');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  const marketplace = JSON.parse(read(resolve(workspace, '.github/plugin/marketplace.json')));
  assert.ok(marketplace.name && marketplace.owner?.name);
  const entry = marketplace.plugins.find(item => item.name === 'sdd');
  assert.ok(entry, 'Missing marketplace entry: sdd');
  assert.equal(entry.source, './plugins/sdd');
  assert.equal(entry.version, manifest.version);
});

test('four agents have explicit roles, least privilege and read the common rules first', () => {
  const folder = resolve(plugin, 'agents');
  const expected = { 'sdd-orchestrator': ['read', 'search', 'edit', 'execute', 'agent', 'vscode_askQuestions'], 'sdd-designer': ['read', 'search', 'edit'], 'sdd-implementer': ['read', 'search', 'edit', 'execute'], 'sdd-reviewer': ['read', 'search'] };
  assert.deepEqual(list(folder).sort(), Object.keys(expected).map(name => `${name}.agent.md`).sort());
  for (const [name, tools] of Object.entries(expected)) {
    const path = resolve(folder, `${name}.agent.md`);
    const data = frontmatter(path);
    assert.equal(data.name, name);
    assert.ok(data.description.length > 20);
    assert.deepEqual(data.tools, tools);
    assert.equal(data['user-invocable'], String(name === 'sdd-orchestrator'));
    const text = read(path);
    assert.ok(!text.includes('hooks:'), `${name}: custom hooks are not used`);
    const opening = text.replace(/^---[\s\S]*?\n---\n/, '').split('\n## ')[0];
    assert.ok(opening.includes('](../common-rules.md)'), `${name}: reads the common rules first`);
  }
  assert.deepEqual(frontmatter(resolve(folder, 'sdd-orchestrator.agent.md')).agents, ['sdd-designer', 'sdd-implementer', 'sdd-reviewer']);
});

test('fourteen discoverable skills have matching names and actionable procedures', () => {
  const folder = resolve(plugin, 'skills');
  const expected = ['change-intake', 'workflow-status', 'clarification', 'grill-me', 'phase-approval', 'idea-dialogue', 'requirements-definition', 'external-design', 'ddd-internal-design', 'change-impact-analysis', 'task-planning', 'tdd-cycle', 'review', 'spec-check'];
  assert.deepEqual(list(folder).sort(), [...expected].sort());
  for (const name of expected) {
    const path = resolve(folder, name, 'SKILL.md');
    const data = frontmatter(path);
    assert.equal(data.name, name);
    assert.ok(data.description.length > 20 && data.description.length <= 1024);
    assert.equal(data['user-invocable'], 'true');
    const body = read(path);
    for (const label of ['入力:', '1.', '停止:', '出力:']) assert.ok(body.includes(label), `${name}: ${label}`);
  }
});

test('only spec-check knows where the check script is', () => {
  const skill = resolve(plugin, 'skills/spec-check');
  assert.ok(existsSync(resolve(skill, 'scripts/check.mjs')), 'Missing: spec-check/scripts/check.mjs');
  assert.ok(read(resolve(skill, 'SKILL.md')).includes('scripts/check.mjs'));
  const guides = ['README.md', 'user_guide.md'].map(name => resolve(plugin, name));
  for (const path of markdownFiles(plugin)) {
    if (path.startsWith(skill) || guides.includes(path)) continue;
    assert.ok(!read(path).includes('check.mjs'), `${path}: refer to spec-check instead of the script path`);
  }
});

test('the common rules forbid remote Git operations and broad staging', () => {
  const text = read(resolve(plugin, 'common-rules.md'));
  assert.ok(!text.startsWith('---'), 'common rules are a plain file, not instructions');
  for (const phrase of ['push', 'git add -A', 'approve(<工程>)', 'spec-check']) assert.ok(text.includes(phrase), phrase);
  assert.match(read(resolve(plugin, 'skills/phase-approval/SKILL.md')), /git add -- <対象のパス> docs\/spec\/changes\/<ID>\/status\.md/);
});

test('project-wide instructions are left to the workspace', () => {
  const path = resolve(workspace, '.github/copilot-instructions.md');
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const phrase of ['approve(<工程>)', 'check.mjs', 'sdd-orchestrator']) assert.ok(!text.includes(phrase), phrase);
});

test('links inside the plugin are not broken', () => {
  const errors = [];
  checkLinks(workspace, errors, ['plugins']);
  assert.deepEqual(errors, []);
});

test('this repository passes its own check without errors', () => {
  assert.deepEqual(check(workspace).errors, []);
});
