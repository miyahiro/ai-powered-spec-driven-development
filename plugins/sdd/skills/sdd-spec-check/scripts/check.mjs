#!/usr/bin/env node
// SDD の検査スクリプト。ファイルを書き換えず、Git は読み取りのコマンドだけを使う。
import { readFileSync, readdirSync, existsSync, statSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PHASES = { standard: ['ideation', 'requirements', 'design', 'implementation', 'done'], light: ['outline', 'implementation', 'done'] };
const GATES = { standard: ['requirements', 'design', 'completion'], light: ['outline', 'completion'] };
const ORDER = { ideation: 0, outline: 1, requirements: 1, design: 2, implementation: 3, completion: 4, done: 4 };
const KINDS = ['new', 'enhancement', 'fix'];
const STATES = ['active', 'waiting-approval', 'blocked', 'paused', 'done'];
const QUESTION_STATES = ['open', 'resolved'];
const TASK_STATES = ['todo', 'doing', 'done', 'blocked', 'dropped'];
const FRONTMATTER_KEYS = ['id', 'title', 'kind', 'size', 'phase', 'state', 'approvers', 'branch'];

export const slug = heading => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
export const redact = text => String(text)
  .replace(/\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{8,}/g, '[REDACTED]')
  .replace(/\b(?:sk|xox[abp])-[A-Za-z0-9-]{8,}/g, '[REDACTED]')
  .replace(/\bAKIA[0-9A-Z]{12,}/g, '[REDACTED]')
  .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, '[REDACTED]');

function walk(root, dir, predicate, found = []) {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return found;
  for (const name of readdirSync(absolute)) {
    if (['node_modules', '.git'].includes(name)) continue;
    const path = dir ? `${dir}/${name}` : name;
    if (statSync(join(root, path)).isDirectory()) walk(root, path, predicate, found);
    else if (predicate(path)) found.push(path);
  }
  return found;
}

const withoutFences = text => text.split('\n').map((line, index, lines) => {
  const before = lines.slice(0, index).filter(item => /^\s*```/.test(item)).length;
  return before % 2 === 1 || /^\s*```/.test(line) ? '' : line;
});

function tableRows(lines, start = 0) {
  const rows = [];
  for (let index = start; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim().startsWith('|')) { if (rows.length) break; continue; }
    if (/^\s*\|\s*:?-{3,}/.test(line)) continue;
    rows.push({ line: index + 1, cells: line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()) });
  }
  return rows;
}

function allRows(lines) {
  return lines.flatMap((line, index) => line.trim().startsWith('|') && !/^\s*\|\s*:?-{3,}/.test(line) ? [{ line: index + 1, cells: line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()) }] : []);
}

function sectionTable(lines, heading) {
  const index = lines.findIndex(line => line.trim() === `## ${heading}`);
  if (index < 0) return null;
  const end = lines.findIndex((line, position) => position > index && /^## /.test(line));
  const rows = tableRows(lines.slice(0, end < 0 ? lines.length : end), index + 1);
  return { header: rows[0]?.cells ?? [], rows: rows.slice(1) };
}

function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split('\n')) {
    const pair = /^([A-Za-z]+):\s*(.*)$/.exec(line.trim());
    if (pair) data[pair[1]] = pair[2].replace(/\s+#.*$/, '').trim();
  }
  return data;
}

function git(root, args) {
  try {
    return execFileSync('git', ['--no-pager', '-C', root, ...args], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function checkIds(root, errors) {
  const definitions = new Map();
  const define = (id, path, line) => {
    if (definitions.has(id)) errors.push({ path, line, message: `ID が重複しています: ${id}（最初の定義: ${definitions.get(id)}）` });
    else definitions.set(id, `${path}:${line}`);
  };
  const requirements = walk(root, 'docs/spec/current/requirements', path => path.endsWith('.md'));
  const required = [];
  const covered = new Set();
  for (const path of requirements) {
    const lines = withoutFences(readFileSync(join(root, path), 'utf8'));
    for (const row of allRows(lines)) {
      const id = row.cells[0];
      if (!/^(?:REQ|NFR|AC|FUN)-[A-Z]+-\d+$/.test(id)) continue;
      define(id, path, row.line);
      if (/^(?:REQ|NFR)-/.test(id)) required.push({ id, path, line: row.line });
      if (/^AC-/.test(id)) for (const target of (row.cells[1] ?? '').match(/\b(?:REQ|NFR)-[A-Z]+-\d+\b/g) ?? []) covered.add(target);
    }
  }
  for (const item of required) if (!covered.has(item.id)) errors.push({ path: item.path, line: item.line, message: `受入条件のない要件です: ${item.id}` });
  for (const path of walk(root, 'docs/spec/current/design', path => path.endsWith('.md'))) {
    const lines = withoutFences(readFileSync(join(root, path), 'utf8'));
    lines.forEach((line, index) => {
      const heading = /^#{2,4} (DES-[A-Z]+-\d+)\b/.exec(line);
      const row = /^\|\s*(DES-[A-Z]+-\d+)\s*\|/.exec(line);
      if (heading) define(heading[1], path, index + 1);
      else if (row) define(row[1], path, index + 1);
    });
  }
}

export function checkLinks(root, errors, folders = ['docs', '.github']) {
  const anchors = new Map();
  const anchorsOf = path => {
    if (!anchors.has(path)) anchors.set(path, new Set(withoutFences(readFileSync(path, 'utf8')).map(line => /^#{1,6} (.+)$/.exec(line)?.[1]).filter(Boolean).map(slug)));
    return anchors.get(path);
  };
  const files = folders.flatMap(folder => walk(root, folder, path => path.endsWith('.md')));
  for (const path of files) {
    withoutFences(readFileSync(join(root, path), 'utf8')).forEach((line, index) => {
      for (const match of line.replace(/`[^`]*`/g, '').matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        if (/^(?:https?:|mailto:)/.test(match[1])) continue;
        const [file, anchor] = match[1].split('#');
        const target = file ? resolve(root, dirname(path), decodeURIComponent(file)) : join(root, path);
        if (!existsSync(target)) errors.push({ path, line: index + 1, message: `リンク先がありません: ${match[1]}` });
        else if (anchor && target.endsWith('.md') && !anchorsOf(target).has(decodeURIComponent(anchor))) errors.push({ path, line: index + 1, message: `見出しがありません: ${match[1]}` });
      }
    });
  }
}

function readCase(root, folder, errors, warnings) {
  const path = `docs/spec/changes/${folder}/status.md`;
  const text = readFileSync(join(root, path), 'utf8');
  const lines = text.split('\n');
  const data = frontmatter(text);
  const fail = (message, line = 1) => errors.push({ path, line, message });
  if (!data) { fail('frontmatter（--- で囲んだ項目）がありません'); return null; }
  for (const key of FRONTMATTER_KEYS) if (!Object.hasOwn(data, key)) fail(`項目がありません: ${key}`);
  if (data.id !== folder) fail(`id がフォルダ名と違います: ${data.id}`);
  if (!KINDS.includes(data.kind)) fail(`kind の値が正しくありません: ${data.kind}`);
  const size = data.size;
  if (!PHASES[size]) { fail(`size の値が正しくありません: ${size}`); return null; }
  if (!PHASES[size].includes(data.phase)) fail(`phase の値が size=${size} に合いません: ${data.phase}`);
  if (!STATES.includes(data.state)) fail(`state の値が正しくありません: ${data.state}`);
  const approvers = (data.approvers ?? '').split(/[、,]/).map(name => name.trim()).filter(Boolean);
  if (!approvers.length) fail('approvers が空です');
  const questions = [];
  const questionTable = sectionTable(lines, '質問');
  if (questionTable) {
    const column = name => questionTable.header.indexOf(name);
    for (const row of questionTable.rows) {
      const question = { id: row.cells[0], text: row.cells[column('質問')] ?? '', due: row.cells[column('期限')] ?? '', status: row.cells[column('状態')] ?? '', line: row.line };
      if (!/^Q-\d+$/.test(question.id)) fail(`質問の ID が正しくありません: ${question.id}`, row.line);
      if (!Object.hasOwn(ORDER, question.due)) fail(`質問の期限が正しくありません: ${question.due}`, row.line);
      if (!QUESTION_STATES.includes(question.status)) fail(`質問の状態が正しくありません: ${question.status}`, row.line);
      questions.push(question);
    }
  }
  const approvals = [];
  const approvalTable = sectionTable(lines, '承認');
  if (approvalTable) {
    const column = name => approvalTable.header.indexOf(name);
    for (const row of approvalTable.rows) {
      const approval = { gate: row.cells[column('工程')] ?? '', date: row.cells[column('日時')] ?? '', approver: row.cells[column('承認者')] ?? '', targets: (row.cells[column('対象')] ?? '').split(/[、,]/).map(item => item.trim().replace(/^`|`$/g, '')).filter(Boolean), line: row.line };
      if (!GATES[size].includes(approval.gate)) fail(`承認の工程が size=${size} に合いません: ${approval.gate}`, row.line);
      if (!approvers.includes(approval.approver)) fail(`承認者が approvers にありません: ${approval.approver}`, row.line);
      if (!approval.targets.length) fail('承認の対象がありません', row.line);
      approvals.push(approval);
    }
  }
  const nextIndex = lines.findIndex(line => line.trim() === '## 次の作業');
  const next = nextIndex < 0 ? [] : lines.slice(nextIndex + 1).filter(line => /^\s*[-*] /.test(line)).map(line => line.replace(/^\s*[-*] /, '').trim()).slice(0, 5);
  for (const question of questions) {
    if (question.status === 'open' && Object.hasOwn(ORDER, question.due) && ORDER[question.due] <= (ORDER[data.phase] ?? 0)) warnings.push({ path, line: question.line, message: `期限が来た未解決の質問があります: ${question.id}` });
  }
  for (const approval of approvals) {
    const commit = git(root, ['log', '-n', '1', '--format=%H', '--fixed-strings', `--grep=approve(${approval.gate}): ${folder}`]);
    if (!commit) { approval.commit = null; warnings.push({ path, line: approval.line, message: `承認のコミットが見つかりません: ${approval.gate}` }); continue; }
    approval.commit = commit.slice(0, 7);
    const changed = new Set([...(git(root, ['diff', '--name-only', commit, '--', ...approval.targets]) ?? '').split('\n'), ...(git(root, ['ls-files', '--others', '--exclude-standard', '--', ...approval.targets]) ?? '').split('\n')].filter(Boolean));
    approval.changed = [...changed];
    approval.stale = changed.size > 0;
    if (approval.stale) warnings.push({ path, line: approval.line, message: `承認後に対象が変わっています（再承認が必要）: ${approval.gate}: ${[...changed].slice(0, 5).join(', ')}` });
  }
  let tasks = null;
  const tasksPath = `docs/spec/changes/${folder}/tasks.md`;
  if (existsSync(join(root, tasksPath))) {
    const rows = allRows(withoutFences(readFileSync(join(root, tasksPath), 'utf8')));
    const statusColumn = rows.find(row => row.cells.includes('状態'))?.cells.indexOf('状態') ?? -1;
    tasks = { counts: {}, open: [] };
    for (const row of rows) {
      if (!/^TASK-\d+$/.test(row.cells[0])) continue;
      const status = row.cells[statusColumn] ?? '';
      if (!TASK_STATES.includes(status)) errors.push({ path: tasksPath, line: row.line, message: `タスクの状態が正しくありません: ${row.cells[0]}: ${status}` });
      tasks.counts[status] = (tasks.counts[status] ?? 0) + 1;
      if (!['done', 'dropped'].includes(status)) tasks.open.push(row.cells[0]);
    }
  }
  const latest = new Map(approvals.map(approval => [approval.gate, approval]));
  return {
    id: folder, title: data.title, kind: data.kind, size, phase: data.phase, state: data.state, approvers, branch: data.branch || null,
    questions: { due: questions.filter(question => question.status === 'open' && ORDER[question.due] <= (ORDER[data.phase] ?? 0)).map(({ id, text, due }) => ({ id, text: redact(text), due })), open: questions.filter(question => question.status === 'open').length },
    approvals: [...latest.values()].map(({ gate, date, approver, commit, stale }) => ({ gate, date, approver, commit, stale: Boolean(stale) })),
    reapproval: [...latest.values()].filter(approval => approval.stale).map(approval => approval.gate),
    remainingGates: GATES[size].filter(gate => !latest.has(gate)),
    tasks, next: next.map(redact)
  };
}

export function check(workspace, changeId = null) {
  const root = realpathSync(workspace);
  const errors = [];
  const warnings = [];
  checkIds(root, errors);
  checkLinks(root, errors);
  const cases = {};
  const changes = join(root, 'docs/spec/changes');
  if (existsSync(changes)) {
    for (const folder of readdirSync(changes).sort()) {
      if (!existsSync(join(changes, folder, 'status.md'))) continue;
      cases[folder] = readCase(root, folder, errors, warnings);
    }
  }
  let summary = null;
  if (changeId) {
    summary = cases[changeId] ?? null;
    if (!summary) errors.push({ path: `docs/spec/changes/${changeId}/status.md`, line: 1, message: '案件の状態ファイルがありません' });
    else {
      const current = git(root, ['branch', '--show-current']);
      summary.currentBranch = current || null;
      summary.branchMatches = !summary.branch || summary.branch === current;
    }
  }
  const scope = changeId ? item => !item.path.startsWith('docs/spec/changes/') || item.path.startsWith(`docs/spec/changes/${changeId}/`) : () => true;
  return { errors, warnings: warnings.filter(scope), summary };
}

function format(result) {
  const lines = [`検査: エラー ${result.errors.length} 件、警告 ${result.warnings.length} 件`];
  for (const item of result.errors) lines.push(`ERROR ${item.path}:${item.line} ${redact(item.message)}`);
  for (const item of result.warnings) lines.push(`WARN  ${item.path}:${item.line} ${redact(item.message)}`);
  const summary = result.summary;
  if (summary) {
    lines.push('', `${summary.id} ${redact(summary.title)}（${summary.size === 'light' ? '軽量' : '標準'}）`);
    lines.push(`  工程: ${summary.phase} / 状態: ${summary.state}`);
    lines.push(`  ブランチ: ${summary.branch ?? '未作成'}（今: ${summary.currentBranch ?? '不明'}${summary.branchMatches ? '' : '、一致しない'}）`);
    lines.push(`  期限の来た質問: ${summary.questions.due.length ? summary.questions.due.map(question => `${question.id} ${question.text}`).join(' / ') : 'なし'}（未解決 ${summary.questions.open} 件）`);
    lines.push(`  承認: ${summary.approvals.length ? summary.approvals.map(approval => `${approval.gate} ${approval.date} ${approval.approver}${approval.commit ? ` ${approval.commit}` : ''}${approval.stale ? '（再承認が必要）' : ''}`).join(' / ') : 'なし'}`);
    lines.push(`  残りの承認: ${summary.remainingGates.length ? summary.remainingGates.join('、') : 'なし'}`);
    lines.push(`  タスク: ${summary.tasks ? Object.entries(summary.tasks.counts).map(([status, count]) => `${status} ${count}`).join('、') || 'なし' : 'tasks.md なし'}`);
    lines.push(`  次の作業: ${summary.next.length ? summary.next.join(' / ') : '未記入'}`);
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const changeId = args.find(arg => /^CHG-\d+$/.test(arg)) ?? null;
  const unknown = args.filter(arg => arg !== '--json' && arg !== changeId);
  if (unknown.length) {
    console.error('使い方: workspace のルートで node <sdd-spec-check のフォルダー>/scripts/check.mjs [CHG-0001] [--json]');
    process.exitCode = 2;
  } else {
    const result = check(process.cwd(), changeId);
    console.log(json ? JSON.stringify(result, (key, value) => typeof value === 'string' ? redact(value) : value, 2) : format(result));
    if (result.errors.length) process.exitCode = 1;
  }
}

