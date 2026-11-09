// プラグインからリポジトリ版を作り、導入先の .github/ に書き出す。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';

export const AREAS = ['.github/agents/', '.github/skills/', '.github/sdd/'];

const PLACES = [
  ['com.github.copilot/agents/', '.github/agents/'],
  ['skills/', '.github/skills/'],
  ['common-rules.md', '.github/sdd/common-rules.md'],
  ['user_guide.md', '.github/sdd/user_guide.md'],
];
const ADMIN_GUIDE = 'README.md';
const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

// Git が取り出すときに変えた改行（CRLF）を変更として扱わないよう、LF にそろえてから取る。
export const hash = content => `sha256-${createHash('sha256').update(String(content).replaceAll('\r\n', '\n')).digest('hex')}`;

function pluginFiles(pluginDir, dir = '') {
  return readdirSync(join(pluginDir, dir)).flatMap(name => {
    const path = dir ? `${dir}/${name}` : name;
    return statSync(join(pluginDir, path)).isDirectory() ? pluginFiles(pluginDir, path) : [path];
  });
}

function destinationOf(source) {
  for (const [from, to] of PLACES) {
    if (from.endsWith('/') ? source.startsWith(from) : source === from) return to + source.slice(from.length);
  }
  return null;
}

function rewriteTarget(target, source, destination, guideUrl) {
  if (/^(?:https?:|mailto:|#)/.test(target)) return target;
  const [file, anchor] = target.split('#');
  const linked = posix.normalize(posix.join(posix.dirname(source), decodeURIComponent(file)));
  const suffix = anchor === undefined ? '' : `#${anchor}`;
  if (linked === ADMIN_GUIDE) return guideUrl + suffix;
  const linkedDestination = destinationOf(linked);
  if (!linkedDestination) throw new Error(`プラグインの外へのリンクがあります: ${source} → ${target}`);
  return posix.relative(posix.dirname(destination), linkedDestination) + suffix;
}

// 検査スクリプトのリンクの検査と同じく、コードのフェンスとインラインのコードの外にあるリンクだけを書き換える。
function rewriteLinks(text, source, destination, guideUrl) {
  let fenced = false;
  return text.split('\n').map(line => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    return line.split(/(`[^`]*`)/).map(part => part.startsWith('`') ? part
      : part.replace(LINK, (link, target) => link.slice(0, -target.length - 1) + rewriteTarget(target, source, destination, guideUrl) + ')')).join('');
  }).join('\n');
}

export function buildEdition(pluginDir) {
  const manifest = JSON.parse(readFileSync(join(pluginDir, 'plugin.json'), 'utf8'));
  const guideUrl = `${manifest.repository}/blob/main/plugins/sdd/${ADMIN_GUIDE}`;
  const files = new Map();
  for (const source of pluginFiles(pluginDir).sort()) {
    const destination = destinationOf(source);
    if (!destination) continue;
    const content = readFileSync(join(pluginDir, source));
    files.set(destination, source.endsWith('.md') ? Buffer.from(rewriteLinks(content.toString('utf8'), source, destination, guideUrl)) : content);
  }
  const digest = createHash('sha256').update([...files].map(([path, content]) => `${path} ${hash(content)}`).join('\n')).digest('hex').slice(0, 12);
  return { plugin: manifest.name, version: manifest.version, repository: manifest.repository, digest, files };
}

export const RECORD = '.github/sdd/manifest.json';

function insideAreas(path) {
  if (posix.normalize(path) !== path || !AREAS.some(area => path.startsWith(area)) || path === RECORD) {
    throw new Error(`リポジトリ版の置き場所の外のパスです: ${path}`);
  }
  return path;
}

function currentHash(root, path) {
  const absolute = join(root, path);
  return existsSync(absolute) && statSync(absolute).isFile() ? hash(readFileSync(absolute)) : null;
}

export function readRecord(root) {
  const path = join(root, RECORD);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

// 記録の値（R）・実行した版の内容（N）・今のファイル（C）から、パスごとの動きを決める（DES-TOOL-008）。
export function planUpdate(root, record, edition) {
  const recorded = record?.files ?? {};
  const paths = [...new Set([...Object.keys(recorded), ...edition.files.keys()])].map(insideAreas).sort();
  const writes = new Map();
  const deletes = [];
  const files = {};
  const report = { added: [], replaced: [], newBesideExisting: [], newBesideModified: [], removedByHand: [], deleted: [], keptModified: [] };
  for (const path of paths) {
    const r = recorded[path] ?? null;
    const content = edition.files.get(path);
    const n = content ? hash(content) : null;
    const c = currentHash(root, path);
    if (n && c === n) files[path] = n;
    else if (n && !r && !c) { writes.set(path, content); files[path] = n; report.added.push(path); }
    else if (n && !r) { writes.set(`${path}.new`, content); files[path] = n; report.newBesideExisting.push(path); }
    else if (n && !c) { files[path] = r; report.removedByHand.push(path); }
    else if (n && c === r) { writes.set(path, content); files[path] = n; report.replaced.push(path); }
    else if (n) { writes.set(`${path}.new`, content); files[path] = n; report.newBesideModified.push(path); }
    else if (c && c === r) { deletes.push(path); report.deleted.push(path); }
    else if (c) report.keptModified.push(path);
  }
  const nextRecord = { plugin: edition.plugin, version: edition.version, digest: edition.digest, repository: edition.repository, files };
  return { writes, deletes, record: nextRecord, report };
}

function removeEmptySkillFolders(root, path) {
  for (let dir = posix.dirname(path); dir.startsWith(AREAS[1]); dir = posix.dirname(dir)) {
    const absolute = join(root, dir);
    if (!existsSync(absolute) || readdirSync(absolute).length) return;
    rmdirSync(absolute);
  }
}

// ファイルを先に書き、記録は最後に書く。途中で失敗しても、同じ操作をやり直せば続きから整う。
export function applyPlan(root, plan) {
  for (const [path, content] of plan.writes) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  for (const path of plan.deletes) {
    rmSync(join(root, path));
    removeEmptySkillFolders(root, path);
  }
  mkdirSync(dirname(join(root, RECORD)), { recursive: true });
  writeFileSync(join(root, RECORD), `${JSON.stringify(plan.record, null, 2)}\n`);
}

export function inspect(root, record) {
  const modified = [];
  const removedByHand = [];
  for (const [path, recordedHash] of Object.entries(record.files).sort()) {
    const c = currentHash(root, insideAreas(path));
    if (!c) removedByHand.push(path);
    else if (c !== recordedHash) modified.push(path);
  }
  return { modified, removedByHand };
}
