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
