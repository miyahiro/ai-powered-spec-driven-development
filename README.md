# ai-powered-spec-drivien-development
生成 AI を活用したスペック駆動開発

## 利用

GitHub Copilot / VS Code Local 向けの8エージェント・15スキルと、状態管理・工程承認・更新復旧の補助ランナーを提供します。

| 読む人 | 文書 |
| --- | --- |
| 導入・管理する人 | [導入・管理ガイド](.github/sdd/README.md) |
| 開発を進める利用者 | [ユーザーガイド](.github/sdd/user_guide.md) |
| 手動利用を選ぶ人、コマンド・JSON の仕様を知りたい人 | [コマンドと操作のリファレンス](.github/sdd/reference.md) |

通常の窓口は `sdd-orchestrator`、状況確認は `/workflow-status` を使います。

工程は AI との対話（Human-in-the-loop）で進めます。人は質問への回答・工程承認・操作許可を対話で答えるだけで、窓口が回答を確認して状態を記録・遷移させます。記録は窓口がランナーを自ら実行する自動記録が既定です。導入時に1回、人がホストの拒否制御を確認して `setup.mjs enable` で有効化します（それまでは記録が止まります）。窓口が示すコマンドを人が実行する手動利用は、希望する人が対話で選ぶか、設定で既定にした場合だけです。

```sh
npm ci --prefix .github/sdd --ignore-scripts --no-audit --no-fund
npm test --prefix .github/sdd
node .github/sdd/bin/sddctl.mjs doctor
# ホストの確認後に1回
node .github/sdd/bin/setup.mjs enable --confirm-host-checks --note "VS Code <版> / Copilot <版> / <確認日>"
```

仕様: [要求定義](docs/spec/current/requirements/README.md)、[設計](docs/spec/current/design/README.md)。導入先へは設定と runtime を持ち込み、元案件の記録は含めません。
