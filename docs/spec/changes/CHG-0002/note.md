# CHG-0002 作業メモ

- `check.mjs` は検査する workspace を `resolve(dirname(スクリプト), '../..')` で決めている（`.github/sdd/check.mjs` の末尾）。プラグインに移すと、インストール先を検査してしまう。使い方の表示（`node .github/sdd/check.mjs`）も直す必要がある。
- `node .github/sdd/check.mjs` の呼び出しは `sdd-orchestrator.agent.md`、スキルの `phase-approval`・`review`・`task-planning`・`requirements-definition`・`workflow-status` にある。
- VS Code の文書（agent-plugins、agent-plugin-reference）では、`${PLUGIN_ROOT}` が展開されるのは hooks と MCP の設定だけ。スキル・エージェントの本文での展開、プラグインのエージェントの `tools`・`agents`・`user-invocable` の扱いは書かれていない。VS Code で `chat.pluginLocations` に `plugins/sdd` を登録して確かめる。
- テストは `npm test --prefix .github/sdd`、検査は `node .github/sdd/check.mjs CHG-0002`（移動するまで）。
- Copilot CLI plugin reference（2026-10-28 確認）: legacy の `plugin.json` は `name` だけ必須で、`agents/`・`skills/` は既定の場所。マーケットプレイスは `.github/plugin/marketplace.json` に置ける。同じ ID のエージェント・同じ名前のスキルは workspace の `.github/agents/`・`.github/skills/` がプラグインより優先される。`${PLUGIN_ROOT}` の展開は MCP・LSP とエージェントの `mcp-servers` だけ。
- 設計の文書から `plugins/` の中へのリンクを書くと、`check.mjs` のリンクの検査でエラーになる（実装の前はファイルがないため）。パスはコードの書式で書いた。
- `customization.test.mjs` の「自分の検査でエラーにならない」テストは、`docs/` のリンク切れでも失敗する。設計の文書を直したら、テストも合わせて実行する。
- リポジトリに LICENSE ファイルがない。`plugin.json` の `license` は空けてある（設計 DES-TOOL-001 は書く項目に挙げている）。
- テストはリポジトリのルートで `npm test`（`test/`）、検査は `node plugins/sdd/skills/spec-check/scripts/check.mjs CHG-0002`。TASK-9 までは `npm test --prefix .github/sdd` も通る状態を保つ。
- インストール先のパス `~/.copilot/installed-plugins/<マーケットプレイス>/sdd/` は VS Code の文書の記述から書いたもので、実物は未確認（`<マーケットプレイス>` が `marketplace.json` の `name` になるかも未確認）。TASK-7 で確かめてガイドを直す。
- `chat.pluginLocations` は workspace の設定（`.vscode/settings.json`）には書けず、ユーザー（リモート）の設定に絶対パスで書く（TASK-7 で利用者が確認）。
- TASK-7 の試行はこのリポジトリで行われ、AI は `spec-check` のスクリプトを workspace からの相対パス（`plugins/sdd/...`）で実行した。プラグインのフォルダーが workspace の外にあるときに、`SKILL.md` のフォルダーから絶対パスを作って実行できるかは未確認。
- 変更 ID を付けずに検査すると、完了した CHG-0001 に「承認後に対象が変わっています（再承認が必要）」の警告が出る（`common.md`・`tool-integration.md` などを CHG-0002 で直したため。80acce8 以降）。検査スクリプトは完了した案件も承認後の変更を調べる。変更 ID を付けた実行では、その案件の警告だけが出るので気づきにくい。
