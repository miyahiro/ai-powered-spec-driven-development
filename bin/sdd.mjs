#!/usr/bin/env node
// リポジトリ版の書き出しスクリプト。実行したフォルダーの .github/ に書き出す。導入先の Git は操作しない。
import { resolve } from 'node:path';
import { buildEdition, readRecord, planUpdate, applyPlan, inspect } from '../lib/repository-edition.mjs';

const USAGE = `使い方: npx -y github:<owner>/<repo>#<タグまたはブランチ> <操作>

  init     実行したフォルダーにリポジトリ版を書き出す
  update   実行したフォルダーのリポジトリ版を、実行した版に合わせる
  status   記録の版と、手で変えた・消したファイルを示す（ファイルを変えない）`;

const LABELS = {
  added: '追加',
  replaced: '置き換え',
  deleted: '削除',
  newBesideExisting: '`.new` を置いた（既存のファイル）',
  newBesideModified: '`.new` を置いた（手で変えた）',
  removedByHand: '手で消した（書き出していない）',
  keptModified: '手で変えたため残した（実行した版にない）',
};

const describe = ({ version, digest }) => `${version}（${digest}）`;

function printList(label, paths) {
  if (!paths.length) return;
  console.log(`${label}（${paths.length}件）:`);
  for (const path of paths) console.log(`  ${path}`);
}

function write(root, record, edition) {
  const plan = planUpdate(root, record, edition);
  applyPlan(root, plan);
  for (const [key, label] of Object.entries(LABELS)) printList(label, plan.report[key]);
  console.log('\n`git status` と `git diff` で確かめてからコミットしてください。');
}

function main(operation) {
  const root = process.cwd();
  const record = readRecord(root);
  const edition = buildEdition(resolve(import.meta.dirname, '../plugins/sdd'));
  if (operation === 'init') {
    if (record) { console.error(`すでに導入されています（${describe(record)}）。新しい版にするときは update を実行してください。`); return 1; }
    console.log(`sdd ${describe(edition)} を書き出します。\n`);
    write(root, null, edition);
    return 0;
  }
  if (!record) { console.error('リポジトリ版が導入されていません。先に init を実行してください。'); return 1; }
  if (operation === 'update') {
    console.log(`記録の版: ${describe(record)}→ 実行した版: ${describe(edition)}\n`);
    write(root, record, edition);
    return 0;
  }
  const { modified, removedByHand } = inspect(root, record);
  console.log(`記録の版: ${describe(record)}\n実行したスクリプトの版: ${describe(edition)}\n`);
  printList('手で変えた', modified);
  printList('手で消した', removedByHand);
  if (!modified.length && !removedByHand.length) console.log('手で変えた・消したファイルはありません。');
  return 0;
}

const operation = process.argv[2];
if (!['init', 'update', 'status'].includes(operation)) {
  console.error(USAGE);
  process.exitCode = 2;
} else {
  try {
    process.exitCode = main(operation);
  } catch (error) {
    console.error(`止まりました: ${error.message}`);
    process.exitCode = 1;
  }
}
