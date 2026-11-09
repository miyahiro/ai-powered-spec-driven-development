# ai-powered-spec-drivien-development
生成 AI を活用したスペック駆動開発

## 利用

GitHub Copilot / VS Code 向けの、スペック駆動開発のエージェント・スキル・検査スクリプトを、VS Code のエージェントプラグイン `sdd`（[plugins/sdd/](plugins/sdd/)）として配ります。チームで共有するときは、同じ中身を導入先のリポジトリの `.github/` に書き出して（リポジトリ版）コミットすることもできます。個人や少人数のチームで手軽に使える「ライト版」です。

| 読む人 | 文書 |
| --- | --- |
| 導入・管理する人 | [導入・管理ガイド](plugins/sdd/README.md) |
| 開発を進める利用者 | [ユーザーガイド](plugins/sdd/user_guide.md) |

- 窓口のエージェント `sdd-orchestrator` に、自然言語で依頼します。
- 工程は規模で選びます。軽量は「要点 → 実装 → 完了」、標準は「壁打ち → 要件 → 設計 → 実装 → 完了」です。
- 人は質問に答え、工程の区切りで承認します。承認は Git のローカルのコミットとして残り、案件の状態は `docs/spec/changes/<ID>/status.md` 1枚にまとまります。
- push・PR・マージは人が行います。

導入は、VS Code で `chat.plugins.enabled` を有効にし、`chat.plugins.marketplaces` にこのリポジトリを加えて、Agent Plugins から `sdd` をインストールします。依存のインストールは不要で、workspace のファイルは変わりません。リポジトリ版は、導入先のリポジトリのルートで `npx -y github:miyahiro/ai-powered-spec-drivien-development#<タグまたはブランチ> init` を実行して書き出します。詳しくは [導入・管理ガイド](plugins/sdd/README.md) を参照してください。

このリポジトリでの開発:

```sh
npm test                                                        # 検査スクリプト・プラグインの構成・リポジトリ版の書き出しのテスト
node plugins/sdd/skills/sdd-spec-check/scripts/check.mjs            # 仕様と案件の検査
node plugins/sdd/skills/sdd-spec-check/scripts/check.mjs CHG-0001   # 案件の状況の要約
```

仕様: [要件定義](docs/spec/current/requirements/README.md)、[設計](docs/spec/current/design/README.md)。
