# CHG-0006 作業メモ

## 調べて分かった事実

- 検査スクリプトのリンクの検査は、コードのフェンスとインラインのコードの外にある `[…](…)` を対象とし、`http(s):`・`mailto:` を除く。対象は `docs/` と `.github/` の `.md` だけ（`plugins/sdd/skills/sdd-spec-check/scripts/check.mjs` の `checkLinks`）。
- スキル同士のリンク（`../sdd-<名前>/SKILL.md`）と、テンプレートからスキルへのリンク（`../../sdd-<名前>/SKILL.md`）は、`skills/` と `.github/skills/` で同じ形になる（`grep` で確認）。
- プラグインの中で配り方を決めつけている文: `plugins/sdd/user_guide.md` の19行目（「プラグインの共通ルール」）、207〜208行目（困ったときの表）。
- 開発環境: Node.js v24.21.0、npm 11.19.0。

- `npx -y "git+file:///workspaces/ai-powered-spec-drivien-development#change/CHG-0006" init` で、Git から取得したパッケージの bin（`bin/sdd.mjs`）が実行された。取得されたのは `bin`・`lib`・`plugins`・`package.json`・`README.md`（npm が自動で含める）だけ。`"private": true` でも動いた（01fe7ad、npm 11.19.0）。
- `npx -y github:miyahiro/ai-powered-spec-drivien-development#change/CHG-0006 init` でも同じように動いた（44955ef）。

## テストや確認の方法

- 書き出しのテスト: `node --test test/repository-edition.test.mjs`。
- npx の流れをローカルで確かめる: 空のフォルダーで `npx -y "git+file://<このリポジトリの絶対パス>#<ブランチ>" init`。キャッシュを分けたいときは `npm_config_cache=<一時フォルダー>` を付ける。

## 作業上の前提（未確認）

- タグ（`#v0.6.0`）の指定でも、ブランチと同じように動く（タグはまだない）。
