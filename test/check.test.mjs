import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import * as checker from '../plugins/sdd/skills/sdd-spec-check/scripts/check.mjs';

const { check, redact } = checker;
const script = join(import.meta.dirname, '..', 'plugins/sdd/skills/sdd-spec-check/scripts/check.mjs');

const requirements = `# 要求

| ID | 大分類 | 機能 | 要求 |
| --- | --- | --- | --- |
| REQ-INQ-001 | CAT-X | FUN-INQ-001 | 一覧を表示する |

| ID | 要求 |
| --- | --- |
| NFR-INQ-001 | 1秒以内 |

| ID | 対象 | 条件 |
| --- | --- | --- |
| AC-INQ-001 | REQ-INQ-001、NFR-INQ-001 | 表示される |
`;

const status = (extra = {}) => {
  const data = { id: 'CHG-0001', title: '一覧の改善', kind: 'enhancement', size: 'light', phase: 'outline', state: 'active', approvers: '宮下', branch: 'change/CHG-0001', ...extra };
  return `---\n${Object.entries(data).map(([key, value]) => `${key}: ${value}`).join('\n')}\n---\n\n# CHG-0001\n\n## 質問\n\n| ID | 質問 | 選択肢・推奨 | 期限 | 状態 | 回答 |\n| --- | --- | --- | --- | --- | --- |\n${extra.questions ?? ''}\n## 承認\n\n| 工程 | 日時 | 承認者 | 対象 |\n| --- | --- | --- | --- |\n${extra.approvals ?? ''}\n## 次の作業\n\n- 実装を始める\n`;
};

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function fixture(context, files) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-check-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  git(root, 'init', '-q', '-b', 'change/CHG-0001');
  git(root, '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'add', '-A');
  git(root, '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', 'init');
  return root;
}

function snapshot(root) {
  const files = {};
  const walk = dir => {
    for (const name of readdirSync(join(root, dir))) {
      if (name === '.git') continue;
      const path = dir ? `${dir}/${name}` : name;
      if (statSync(join(root, path)).isDirectory()) walk(path);
      else files[path] = readFileSync(join(root, path), 'utf8');
    }
  };
  walk('');
  return files;
}

test('a clean workspace passes and the check does not change files', context => {
  const root = fixture(context, { 'docs/spec/current/requirements/inquiry.md': requirements, 'docs/spec/changes/CHG-0001/status.md': status() });
  const before = snapshot(root);
  const result = check(root, 'CHG-0001');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.summary.phase, 'outline');
  assert.equal(result.summary.branchMatches, true);
  assert.deepEqual(result.summary.remainingGates, ['outline', 'completion']);
  assert.deepEqual(result.summary.next, ['実装を始める']);
  assert.deepEqual(snapshot(root), before);
});

test('duplicate IDs, requirements without acceptance criteria and broken links are errors', context => {
  const broken = requirements.replace('| NFR-INQ-001 | 1秒以内 |', '| NFR-INQ-001 | 1秒以内 |\n| REQ-INQ-001 | 重複 |\n| REQ-INQ-002 | 受入条件なし |') + '\n[設計](../design/missing.md)\n[節](#存在しない見出し)\n';
  const root = fixture(context, { 'docs/spec/current/requirements/inquiry.md': broken, 'docs/spec/current/design/a.md': '## DES-INQ-001 a\n\n| DES-INQ-001 | dup |\n' });
  const messages = check(root).errors.map(error => error.message);
  assert.ok(messages.some(message => message.includes('ID が重複しています: REQ-INQ-001')));
  assert.ok(messages.some(message => message.includes('ID が重複しています: DES-INQ-001')));
  assert.ok(messages.some(message => message.includes('受入条件のない要件です: REQ-INQ-002')));
  assert.ok(messages.some(message => message.includes('リンク先がありません: ../design/missing.md')));
  assert.ok(messages.some(message => message.includes('見出しがありません: #存在しない見出し')));
});

test('invalid status and task values are errors', context => {
  const root = fixture(context, {
    'docs/spec/changes/CHG-0001/status.md': status({ size: 'light', phase: 'design', state: 'working', kind: 'other', questions: '| Q-1 | ? | | someday | pending | |\n', approvals: '| design | 2026-10-20 | 他人 | docs/a.md |\n' }),
    'docs/spec/changes/CHG-0001/tasks.md': '| ID | 内容 | 要件・受入条件 | 設計 | 確認方法 | 状態 | 結果 |\n| --- | --- | --- | --- | --- | --- | --- |\n| TASK-1 | x | AC-1 | — | TDD | finished | |\n'
  });
  const messages = check(root, 'CHG-0001').errors.map(error => error.message).join('\n');
  for (const expected of ['phase の値が size=light に合いません', 'state の値が正しくありません', 'kind の値が正しくありません', '質問の期限が正しくありません', '質問の状態が正しくありません', '承認の工程が size=light に合いません', '承認者が approvers にありません', 'タスクの状態が正しくありません']) assert.ok(messages.includes(expected), expected);
  const missing = check(root, 'CHG-9999').errors.map(error => error.message);
  assert.ok(missing.includes('案件の状態ファイルがありません'));
});

test('approval commits are found and later edits require reapproval', context => {
  const root = fixture(context, { 'docs/spec/current/requirements/inquiry.md': requirements, 'docs/spec/changes/CHG-0001/status.md': status(), 'docs/spec/changes/CHG-0001/outline.md': '# 要点\n', 'docs/unrelated.md': 'x\n' });
  writeFileSync(join(root, 'docs/spec/changes/CHG-0001/status.md'), status({ phase: 'implementation', approvals: '| outline | 2026-10-20 | 宮下 | docs/spec/current/requirements/inquiry.md, docs/spec/changes/CHG-0001/outline.md |\n' }));
  assert.match(check(root, 'CHG-0001').warnings.map(item => item.message).join('\n'), /承認のコミットが見つかりません: outline/);
  git(root, 'add', '--', 'docs/spec/changes/CHG-0001/status.md');
  git(root, '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', 'approve(outline): CHG-0001 一覧の改善', '-m', '承認者: 宮下');
  let result = check(root, 'CHG-0001');
  assert.deepEqual(result.warnings, []);
  assert.equal(result.summary.approvals[0].stale, false);
  assert.match(result.summary.approvals[0].commit, /^[0-9a-f]{7}$/);
  assert.deepEqual(result.summary.remainingGates, ['completion']);
  writeFileSync(join(root, 'docs/unrelated.md'), 'changed\n');
  assert.equal(check(root, 'CHG-0001').summary.approvals[0].stale, false, 'unrelated edits do not require reapproval');
  writeFileSync(join(root, 'docs/spec/changes/CHG-0001/outline.md'), '# 要点\n変更\n');
  result = check(root, 'CHG-0001');
  assert.deepEqual(result.summary.reapproval, ['outline']);
  assert.match(result.warnings.map(item => item.message).join('\n'), /再承認が必要/);
});

test('due open questions are warnings and later questions are not', context => {
  const root = fixture(context, { 'docs/spec/changes/CHG-0001/status.md': status({ questions: '| Q-1 | 保存期間は？ | 1年/3年 | outline | open | |\n| Q-2 | 後で決める | | completion | open | |\n| Q-3 | 済み | | outline | resolved | 3年 |\n' }) });
  const result = check(root, 'CHG-0001');
  assert.deepEqual(result.summary.questions.due.map(question => question.id), ['Q-1']);
  assert.equal(result.summary.questions.open, 2);
  assert.equal(result.warnings.length, 1);
});

test('task counts and branch mismatch appear in the summary', context => {
  const root = fixture(context, {
    'docs/spec/changes/CHG-0001/status.md': status({ phase: 'implementation', branch: 'change/other' }),
    'docs/spec/changes/CHG-0001/tasks.md': '# タスク\n\n| ID | 内容 | 要件・受入条件 | 設計 | 確認方法 | 状態 | 結果 |\n| --- | --- | --- | --- | --- | --- | --- |\n| TASK-1 | a | AC-1 | DES-A-001 | TDD | done | ok |\n| TASK-2 | b | AC-2 | — | TDD | todo | |\n'
  });
  const summary = check(root, 'CHG-0001').summary;
  assert.deepEqual(summary.tasks, { counts: { done: 1, todo: 1 }, open: ['TASK-2'] });
  assert.equal(summary.branchMatches, false);
});

test('secret-like strings are masked in output', context => {
  const token = `ghp_${'a'.repeat(30)}`;
  assert.equal(redact(`token ${token}`), 'token [REDACTED]');
  const root = fixture(context, { 'docs/spec/changes/CHG-0001/status.md': status({ questions: `| Q-1 | ${token} を使うか | | outline | open | |\n` }) });
  const output = execFileSync('node', [script, 'CHG-0001', '--json'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /"id": "CHG-0001"/);
  assert.ok(!JSON.stringify(check(root, 'CHG-0001').summary.questions).includes(token));
  assert.ok(!output.includes(token));
});

test('the script checks the folder it runs in, not the folder it is installed in', context => {
  const root = fixture(context, { 'docs/spec/changes/CHG-0001/status.md': status() });
  const result = JSON.parse(execFileSync('node', [script, 'CHG-0001', '--json'], { cwd: root, encoding: 'utf8' }));
  assert.equal(result.summary.id, 'CHG-0001');
  assert.deepEqual(result.errors, []);
});

test('links can be checked in a given folder without changing the default scope', context => {
  const root = fixture(context, { 'plugins/sample/README.md': '[なし](missing.md)\n' });
  assert.equal(typeof checker.checkLinks, 'function');
  const errors = [];
  checker.checkLinks(root, errors, ['plugins']);
  assert.deepEqual(errors.map(error => error.path), ['plugins/sample/README.md']);
  assert.deepEqual(check(root).errors, []);
});
