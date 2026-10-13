# ai-powered-spec-drivien-development
生成 AI を活用したスペック駆動開発

## 利用

GitHub Copilot / VS Code Local 向けの8エージェント・15スキルと、状態管理・工程承認・更新復旧の補助ランナーを提供します。

[導入・操作ガイド](.github/sdd/README.md) を参照してください。初期状態は読み取り専用です。通常の窓口は `sdd-orchestrator`、状況確認は `/workflow-status` を使います。自動操作はホストの拒否制御を確認した環境だけで有効にします。

```sh
npm ci --prefix .github/sdd --ignore-scripts --no-audit --no-fund
npm test --prefix .github/sdd
node .github/sdd/bin/sddctl.mjs doctor
```

仕様: [要求定義](docs/spec/current/requirements/README.md)、[設計](docs/spec/current/design/README.md)。導入先へは設定と runtime を持ち込み、元案件の記録は含めません。
