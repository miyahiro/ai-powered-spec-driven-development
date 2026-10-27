# CHG-0001 作業メモ

- テストは `npm test --prefix .github/sdd`、検査は `node .github/sdd/check.mjs CHG-0001`。どちらも依存のインストールなしで動く。
- `applyTo: "**"` の共通ルールが、ファイルを開いていないチャットやエージェントでも読み込まれるかは未確認（利用者が VS Code で確かめる）。読み込まれない場合は、4つのエージェントの本文から共通ルールへリンクして読ませる案に切り替える（`outline.md`）。
- `customization.test.mjs` の `copilot-instructions.md` の検査は、ファイルがない導入先でも通るように、ファイルがあるときだけ行う。
