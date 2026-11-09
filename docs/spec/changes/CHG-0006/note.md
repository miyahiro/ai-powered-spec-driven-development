# CHG-0006 作業メモ

## 調べて分かった事実

- 検査スクリプトのリンクの検査は、コードのフェンスとインラインのコードの外にある `[…](…)` を対象とし、`http(s):`・`mailto:` を除く。対象は `docs/` と `.github/` の `.md` だけ（`plugins/sdd/skills/sdd-spec-check/scripts/check.mjs` の `checkLinks`）。
- スキル同士のリンク（`../sdd-<名前>/SKILL.md`）と、テンプレートからスキルへのリンク（`../../sdd-<名前>/SKILL.md`）は、`skills/` と `.github/skills/` で同じ形になる（`grep` で確認）。
- プラグインの中で配り方を決めつけている文: `plugins/sdd/user_guide.md` の19行目（「プラグインの共通ルール」）、207〜208行目（困ったときの表）。
- 開発環境: Node.js v24.21.0、npm 11.19.0。

## 作業上の前提（未確認）

- npx は、bin が1つだけのパッケージではその bin を実行する。`npx github:<owner>/<repo>#<ref>` は Git で取得し、`package.json` の `files` に従ってパッケージを作る。`"private": true` でも実行できる。実装のタスクで、実際に GitHub から取得して確かめる。
