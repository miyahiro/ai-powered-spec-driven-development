import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import YAML from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
export function frontmatter(path) {
  const text = readFileSync(path, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  assert.ok(match, `Missing frontmatter: ${path}`);
  return YAML.parse(match[1]);
}

test('eight agents have explicit roles, least privilege, fixed-role hooks and execute only after human setup', () => {
  const folder = resolve(root, 'agents');
  const paths = readdirSync(folder).filter(name => name.endsWith('.agent.md'));
  assert.equal(paths.length, 8);
  const profile = JSON.parse(readFileSync(resolve(root, 'sdd/profile.json'), 'utf8'));
  const enabled = profile.mode === 'managed' && profile.hostChecks?.localHooks === true && profile.hostChecks?.failureDenies === true;
  for (const name of paths) {
    const data = frontmatter(resolve(folder, name));
    assert.equal(data.name, name.replace('.agent.md', ''));
    assert.ok(data.description.length > 20);
    assert.ok(Array.isArray(data.tools));
    assert.ok(!data.tools.includes('edit') && !data.tools.includes('web'));
    assert.equal(data.tools.includes('execute'), enabled && data.name !== 'sdd-reviewer', `${data.name}: execute must follow the human setup state`);
    assert.equal(data['user-invocable'], data.name === 'sdd-orchestrator');
    if (data.name === 'sdd-reviewer') {
      assert.deepEqual(data.tools, ['read', 'search']);
      assert.equal(data.hooks, undefined);
    } else {
      assert.equal(data.hooks.PreToolUse.length, 1);
      assert.equal(data.hooks.PreToolUse[0].command, `node .github/sdd/bin/guard.mjs ${data.name.replace('sdd-', '')}`);
    }
  }
});

test('fifteen discoverable skills have matching names and actionable procedures', () => {
  const folder = resolve(root, 'skills');
  const expected = ['change-intake', 'workflow-status', 'workflow-resume', 'clarification', 'phase-handoff', 'idea-dialogue', 'requirements-definition', 'external-design', 'ddd-internal-design', 'change-impact-analysis', 'canonical-spec-update', 'consistency-review', 'task-planning', 'tdd-cycle', 'verification-and-review'];
  assert.deepEqual(readdirSync(folder).sort(), expected.sort());
  for (const name of expected) {
    const path = resolve(folder, name, 'SKILL.md');
    const data = frontmatter(path);
    assert.equal(data.name, name);
    assert.ok(data.description.length > 20 && data.description.length <= 1024);
    assert.equal(data['user-invocable'], true);
    const body = readFileSync(path, 'utf8');
    for (const label of ['入力:', '1.', '停止:', '出力:']) assert.ok(body.includes(label), `${name}: ${label}`);
  }
});

const slug = heading => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
const anchors = path => new Set([...readFileSync(path, 'utf8').replace(/```[\s\S]*?```/g, '').matchAll(/^#{1,6} (.+)$/gm)].map(match => slug(match[1])));

test('customization documentation links and anchors resolve without source-workspace absolute paths', () => {
  function check(path) {
    const text = readFileSync(path, 'utf8');
    assert.ok(!text.includes('/workspaces/ai-powered-spec-drivien-development'));
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      if (/^https?:/.test(match[1])) continue;
      const [file, anchor] = match[1].split('#');
      const target = file ? resolve(dirname(path), file) : path;
      assert.ok(existsSync(target), `${path}: ${match[1]}`);
      if (anchor && target.endsWith('.md')) assert.ok(anchors(target).has(decodeURIComponent(anchor)), `${path}: missing anchor ${match[1]}`);
    }
  }
  for (const name of readdirSync(resolve(root, 'agents'))) check(resolve(root, 'agents', name));
  for (const name of readdirSync(resolve(root, 'skills'))) check(resolve(root, 'skills', name, 'SKILL.md'));
  check(resolve(root, 'copilot-instructions.md'));
  check(resolve(root, 'sdd/README.md'));
  check(resolve(root, 'sdd/user_guide.md'));
  for (const name of readdirSync(resolve(root, 'sdd/reference'))) if (name.endsWith('.md')) check(resolve(root, 'sdd/reference', name));
  for (const name of readdirSync(resolve(root, 'sdd/reference/operations'))) check(resolve(root, 'sdd/reference/operations', name));
  check(resolve(root, '../README.md'));
});

test('the reference has one file per runner operation and an index row for each', () => {
  const schema = JSON.parse(readFileSync(resolve(root, 'sdd/schemas/runtime.schema.json'), 'utf8'));
  const operations = schema.$defs.request.properties.operation.enum;
  const index = readFileSync(resolve(root, 'sdd/reference/README.md'), 'utf8');
  assert.deepEqual(readdirSync(resolve(root, 'sdd/reference/operations')).sort(), operations.map(operation => `${operation}.md`).sort());
  for (const operation of operations) {
    assert.ok(readFileSync(resolve(root, 'sdd/reference/operations', `${operation}.md`), 'utf8').startsWith(`# ${operation}\n`), `title: ${operation}`);
    assert.ok(index.includes(`[\`${operation}\`](operations/${operation}.md)`), `missing index row: ${operation}`);
  }
});
