# ai-powered-spec-drivien-development
生成 AI を活用したスペック駆動開発

## 利用

GitHub Copilot / VS Code 向けの、スペック駆動開発のエージェント・スキル・検査スクリプトです。個人や少人数のチームで手軽に使える「ライト版」です。

| 読む人 | 文書 |
| --- | --- |
| 導入・管理する人 | [導入・管理ガイド](.github/sdd/README.md) |
| 開発を進める利用者 | [ユーザーガイド](.github/sdd/user_guide.md) |

- 窓口のエージェント `sdd-orchestrator` に、自然言語で依頼します。
- 工程は規模で選びます。軽量は「要点 → 実装 → 完了」、標準は「壁打ち → 要件 → 設計 → 実装 → 完了」です。
- 人は質問に答え、工程の区切りで承認します。承認は Git のローカルのコミットとして残り、案件の状態は `docs/spec/changes/<ID>/status.md` 1枚にまとまります。
- push・PR・マージは人が行います。

導入は `.github/` 配下をコピーするだけです。依存のインストールは不要です。

```sh
node .github/sdd/check.mjs            # 仕様と案件の検査
node .github/sdd/check.mjs CHG-0001   # 案件の状況の要約
```

仕様: [要件定義](docs/spec/current/requirements/README.md)、[設計](docs/spec/current/design/README.md)。
