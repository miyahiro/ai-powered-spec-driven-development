import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkLinks } from '../plugins/sdd/skills/sdd-spec-check/scripts/check.mjs';
import { AREAS, RECORD, buildEdition, hash, readRecord, planUpdate, applyPlan, inspect } from '../lib/repository-edition.mjs';

const workspace = resolve(import.meta.dirname, '..');
const plugin = resolve(workspace, 'plugins/sdd');

function temporary(context, prefix = 'sdd-edition-') {
  const root = mkdtempSync(join(tmpdir(), prefix));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeAll(root, files) {
  for (const [path, content] of files) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

test('the edition places every file under the repository areas', () => {
  const edition = buildEdition(plugin);
  const paths = [...edition.files.keys()];
  for (const path of paths) assert.ok(AREAS.some(area => path.startsWith(area)), path);
  for (const name of ['sdd-orchestrator', 'sdd-designer', 'sdd-implementer', 'sdd-reviewer']) assert.ok(paths.includes(`.github/agents/${name}.agent.md`), name);
  for (const path of ['.github/sdd/common-rules.md', '.github/sdd/user_guide.md', '.github/skills/sdd-spec-check/SKILL.md', '.github/skills/sdd-spec-check/scripts/check.mjs', '.github/skills/sdd-change-intake/templates/status.md']) assert.ok(paths.includes(path), path);
  assert.ok(!paths.some(path => /plugin\.json$|\/README\.md$/.test(path)), 'plugin.json and the admin guide are not written');
});

test('links in the edition resolve where they are written', context => {
  const root = temporary(context);
  const edition = buildEdition(plugin);
  writeAll(root, edition.files);
  const errors = [];
  checkLinks(root, errors, ['.github']);
  assert.deepEqual(errors, []);
  const agent = edition.files.get('.github/agents/sdd-orchestrator.agent.md').toString();
  assert.ok(agent.includes('](../sdd/common-rules.md)'), 'agents link to the common rules in .github/sdd');
  assert.ok(agent.includes('](../skills/sdd-change-intake/SKILL.md)'), 'agents link to skills in .github/skills');
});

test('links to the admin guide become the repository URL', () => {
  const edition = buildEdition(plugin);
  const rules = edition.files.get('.github/sdd/common-rules.md').toString();
  assert.match(rules, /\]\(https:\/\/github\.com\/[^)]+\/blob\/main\/plugins\/sdd\/README\.md\)/);
  assert.ok(!rules.includes('](README.md)'));
});

test('the edition carries the plugin version and a digest of its content', context => {
  const edition = buildEdition(plugin);
  assert.match(edition.version, /^\d+\.\d+\.\d+$/);
  assert.match(edition.digest, /^[0-9a-f]{12}$/);
  const copy = join(temporary(context), 'sdd');
  cpSync(plugin, copy, { recursive: true });
  writeFileSync(join(copy, 'skills/sdd-grill-me/SKILL.md'), '---\nname: sdd-grill-me\n---\n\n# changed\n');
  const changed = buildEdition(copy);
  assert.equal(changed.version, edition.version);
  assert.notEqual(changed.digest, edition.digest, 'same version, different content');
});

test('a link that leaves the plugin stops the build', context => {
  const copy = join(temporary(context), 'sdd');
  cpSync(plugin, copy, { recursive: true });
  writeFileSync(join(copy, 'common-rules.md'), '# rules\n\n[outside](../../docs/spec/current/requirements/common.md)\n\n`[ignored](../../nowhere.md)`\n');
  assert.throws(() => buildEdition(copy), /プラグインの外へのリンク.*common-rules\.md/);
});

function edition(version, files) {
  return { plugin: 'sdd', version, repository: 'https://github.com/example/sdd', digest: version.replaceAll('.', '').padEnd(12, '0'), files: new Map(Object.entries(files).map(([path, text]) => [path, Buffer.from(text)])) };
}

const read = (root, path) => readFileSync(join(root, path), 'utf8');
const A = name => `.github/agents/${name}.agent.md`;

test('updating follows the decision table and protects hand-made changes', context => {
  const root = temporary(context);
  const old = edition('0.1.0', { [A('a')]: 'a1', [A('b')]: 'b1', [A('c')]: 'c1', [A('d')]: 'd1', [A('e')]: 'e1', [A('f')]: 'f1', [A('g')]: 'g1', '.github/skills/sdd-x/SKILL.md': 'x1' });
  applyPlan(root, planUpdate(root, null, old));
  assert.equal(readRecord(root).version, '0.1.0');
  writeAll(root, [[A('p'), 'p2'], [A('q'), 'mine-q'], [A('b'), 'b2'], [A('c'), 'mine-c'], [A('f'), 'mine-f'], [A('c') + '.new', 'stale'], [A('custom'), 'custom']]);
  rmSync(join(root, A('d')));
  rmSync(join(root, A('g')));
  const next = edition('0.0.9', { [A('n')]: 'n2', [A('p')]: 'p2', [A('q')]: 'q2', [A('a')]: 'a2', [A('b')]: 'b2', [A('c')]: 'c2', [A('d')]: 'd2' });
  const plan = planUpdate(root, readRecord(root), next);
  assert.deepEqual(plan.report, {
    added: [A('n')],
    replaced: [A('a')],
    newBesideExisting: [A('q')],
    newBesideModified: [A('c')],
    removedByHand: [A('d')],
    deleted: [A('e'), '.github/skills/sdd-x/SKILL.md'],
    keptModified: [A('f')],
  });
  applyPlan(root, plan);
  assert.equal(read(root, A('n')), 'n2');
  assert.equal(read(root, A('a')), 'a2');
  assert.equal(read(root, A('q')), 'mine-q');
  assert.equal(read(root, A('q') + '.new'), 'q2');
  assert.equal(read(root, A('c')), 'mine-c');
  assert.equal(read(root, A('c') + '.new'), 'c2', 'an existing .new is overwritten');
  assert.ok(!existsSync(join(root, A('d'))), 'a file removed by hand is not restored');
  assert.ok(!existsSync(join(root, A('e'))));
  assert.ok(!existsSync(join(root, '.github/skills/sdd-x')), 'emptied skill folders are removed');
  assert.equal(read(root, A('f')), 'mine-f');
  assert.equal(read(root, A('custom')), 'custom', 'files outside the record are left alone');
  const record = readRecord(root);
  assert.equal(record.version, '0.0.9', 'an older version is applied as specified');
  assert.equal(record.digest, next.digest);
  assert.deepEqual(record.files, {
    [A('a')]: hash('a2'), [A('b')]: hash('b2'), [A('c')]: hash('c2'), [A('d')]: hash('d1'), [A('n')]: hash('n2'), [A('p')]: hash('p2'), [A('q')]: hash('q2'),
  });
  assert.deepEqual(inspect(root, record), { modified: [A('c'), A('q')], removedByHand: [A('d')] });
});

test('a file merged from .new counts as unchanged on the next update', context => {
  const root = temporary(context);
  applyPlan(root, planUpdate(root, null, edition('0.1.0', { [A('a')]: 'a1' })));
  writeAll(root, [[A('a'), 'mine']]);
  applyPlan(root, planUpdate(root, readRecord(root), edition('0.2.0', { [A('a')]: 'a2' })));
  writeAll(root, [[A('a'), 'a2']]);
  const plan = planUpdate(root, readRecord(root), edition('0.3.0', { [A('a')]: 'a3' }));
  assert.deepEqual(plan.report.replaced, [A('a')]);
  assert.deepEqual(plan.report.newBesideModified, []);
});

test('nothing is written outside the repository areas', context => {
  const root = temporary(context);
  for (const path of ['.github/workflows/ci.yml', '.github/copilot-instructions.md', '.github/sdd/../../evil.md']) {
    assert.throws(() => planUpdate(root, null, edition('0.1.0', { [path]: 'x' })), /置き場所の外/, path);
  }
  assert.throws(() => planUpdate(root, { files: { 'README.md': hash('x') } }, edition('0.1.0', {})), /置き場所の外/);
});

test('the record is written last, so a failed write leaves the old record', context => {
  const root = temporary(context);
  applyPlan(root, planUpdate(root, null, edition('0.1.0', { [A('a')]: 'a1' })));
  writeAll(root, [['.github/skills/sdd-y', 'a file where a folder is needed']]);
  const plan = planUpdate(root, readRecord(root), edition('0.2.0', { [A('a')]: 'a2', '.github/skills/sdd-y/SKILL.md': 'y' }));
  assert.throws(() => applyPlan(root, plan));
  assert.equal(readRecord(root).version, '0.1.0');
  assert.ok(existsSync(join(root, RECORD)));
});

const cli = resolve(workspace, 'bin/sdd.mjs');

function run(root, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  return { code: result.status, output: result.stdout + result.stderr };
}

function snapshot(root, dir = '') {
  return readdirSync(join(root, dir)).sort().flatMap(name => {
    const path = dir ? `${dir}/${name}` : name;
    return statSync(join(root, path)).isDirectory() ? snapshot(root, path) : [[path, readFileSync(join(root, path), 'utf8')]];
  });
}

test('the command writes, guards and reports the repository edition', context => {
  const root = temporary(context);
  writeAll(root, [['.github/copilot-instructions.md', '# 基本ルール\n'], ['src/app.js', 'app\n']]);
  const { version, digest } = buildEdition(plugin);

  assert.equal(run(root).code, 2, 'no operation shows the usage');
  assert.equal(run(root, 'deploy').code, 2);
  for (const operation of ['update', 'status']) {
    const result = run(root, operation);
    assert.equal(result.code, 1, operation);
    assert.match(result.output, /init/, `${operation} without a record suggests init`);
  }
  assert.ok(!existsSync(join(root, '.github/sdd')));

  const init = run(root, 'init');
  assert.equal(init.code, 0, init.output);
  assert.ok(init.output.includes(`${version}（${digest}）`));
  assert.match(init.output, /追加（\d+件）/);
  assert.match(init.output, /git status/);
  assert.equal(readFileSync(join(root, '.github/copilot-instructions.md'), 'utf8'), '# 基本ルール\n');
  assert.equal(readFileSync(join(root, 'src/app.js'), 'utf8'), 'app\n');
  assert.equal(readRecord(root).version, version);

  const before = snapshot(root);
  const again = run(root, 'init');
  assert.equal(again.code, 1);
  assert.match(again.output, /update/);
  assert.deepEqual(snapshot(root), before, 'a second init writes nothing');

  writeFileSync(join(root, '.github/agents/sdd-reviewer.agent.md'), 'mine\n');
  const changed = snapshot(root);
  const status = run(root, 'status');
  assert.equal(status.code, 0, status.output);
  assert.ok(status.output.includes(`${version}（${digest}）`));
  assert.match(status.output, /手で変えた（1件）[\s\S]*\.github\/agents\/sdd-reviewer\.agent\.md/);
  assert.deepEqual(snapshot(root), changed, 'status writes nothing');

  const update = run(root, 'update');
  assert.equal(update.code, 0, update.output);
  assert.ok(update.output.includes(`記録の版: ${version}（${digest}）→ 実行した版: ${version}（${digest}）`));
  assert.match(update.output, /`\.new` を置いた（手で変えた）（1件）/);
  assert.ok(existsSync(join(root, '.github/agents/sdd-reviewer.agent.md.new')));

  const checked = spawnSync(process.execPath, [join(root, '.github/skills/sdd-spec-check/scripts/check.mjs')], { cwd: root, encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stdout);
  assert.match(checked.stdout, /エラー 0 件/);
});

test('line endings changed by Git on checkout do not count as hand-made changes', context => {
  const root = temporary(context);
  applyPlan(root, planUpdate(root, null, edition('0.1.0', { [A('a')]: 'line1\nline2\n', [A('b')]: 'b1\n' })));
  writeAll(root, [[A('a'), 'line1\r\nline2\r\n']]);
  assert.deepEqual(inspect(root, readRecord(root)), { modified: [], removedByHand: [] });
  const plan = planUpdate(root, readRecord(root), edition('0.2.0', { [A('a')]: 'line1\nline2 changed\n', [A('b')]: 'b1\n' }));
  assert.deepEqual(plan.report.replaced, [A('a')]);
  assert.deepEqual(plan.report.newBesideModified, []);
});
