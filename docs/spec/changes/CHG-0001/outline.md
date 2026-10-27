# CHG-0001 要点

- 変える箇所: REQ-COM-005・AC-COM-004（導入先の `copilot-instructions.md` を配布物に含めない）。`.github/copilot-instructions.md`、新しく作る `.github/instructions/sdd.instructions.md`、`.github/sdd/test/customization.test.mjs`、`.github/sdd/README.md`、`spec-driven-dev-summary.md`。
- 方針: 今の共通ルールの本文を `sdd.instructions.md`（frontmatter に `description` と `applyTo: "**"`）へそのまま移し、相対リンクを1階層深い位置に合わせて直す。`copilot-instructions.md` は、このリポジトリの基本ルール（日本語で応答する、読みやすさを優先する、不要な分岐を作らない）に書き換え、配布物から外す。コーディング方針は短いので `coding.instructions.md` には分けない。エージェントの本文からルールを参照させる案は、`applyTo` で読み込まれなかったときの代わりの案として残す。
- 影響: SDD のルールの中身は変えない。導入先では、`copilot-instructions.md` を差分で確かめてマージする手間がなくなる。導入済みの workspace では、更新するときに古い `copilot-instructions.md` から SDD のルールを取り除く必要がある（導入・管理ガイドに書く）。`spec-driven-dev-summary.md` は古い構成（エージェント 8、スキル 15 など）を書いているため、削除して今の構成で書き直す。
- テスト: `customization.test.mjs` の共通ルールの検査を新しいパスに変え、`applyTo` があることと、`copilot-instructions.md` に SDD のルールが含まれないことを検査に加える。`npm test`（`.github/sdd`）と `node .github/sdd/check.mjs` で、リンク切れを含めてエラーがないことを確かめる。読み込まれ方は利用者が VS Code で確かめる。
- 設計の文書: `docs/spec/current/design/tool-integration.md` を変える。配置図（DES-TOOL-001: 共通ルールの場所、スキルの数 12 → 13、`.gitignore`）、検査スクリプトが使う Git の読み取りコマンドと、承認後の変更の検査に未追跡のファイルを含めること（DES-TOOL-003）、共通ルールの場所（DES-TOOL-004）、導入の手順（DES-TOOL-005）を実態に合わせる。`design/README.md` の DES-COM-002 は数が変わらないので変更しない。
