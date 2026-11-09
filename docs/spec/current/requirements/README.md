# 要件定義書の目次

GitHub Copilot / VS Code 上で動作する、スペック駆動開発用の AI エージェント・スキル・補助スクリプトの要件定義書（ライト版）を管理する。これらはプラグインにまとめて配り、導入先のリポジトリの `.github/` に書き出して使うこともできる（リポジトリ版）。

主な利用者は個人または少人数のチームとする。工程は規模（標準・軽量）に応じて選び、人は対話で判断と承認を答える。承認はローカルのコミットとして残し、案件の状態は Markdown の状態ファイル1枚で管理する。操作の安全は Copilot / VS Code の標準の確認に任せ、補助スクリプトは検査だけに使う。

## 文書一覧

| 文書 | 対象・概要 |
| --- | --- |
| [common.md](common.md) | 共通の目的・対象範囲、用語、ID のルール、導入・安全・軽さの要件 |
| [workflow-orchestration.md](workflow-orchestration.md) | 受付、規模に応じた工程、承認とコミット、状態ファイル、状況確認、委任とレビュー |
| [specification-management.md](specification-management.md) | 壁打ち・要件・設計の作成、原本と変更記録、影響分析、整合性の検査 |
| [development-verification.md](development-verification.md) | タスク分解、テスト先行の実装、確認の記録、独立レビュー、完了 |
| [tool-integration.md](tool-integration.md) | 既存のツールの利用、Git の操作の範囲、検査スクリプト |

## 機能の大分類

| 大分類 | 名称・範囲 | 機能（定義先） |
| --- | --- | --- |
| CAT-FLOW 工程進行 | 入口、受付、工程、承認、質問、状態ファイル、委任、共通ルール | FUN-COM-001、FUN-COM-003、FUN-WF-001〜006（[common.md](common.md)、[workflow-orchestration.md](workflow-orchestration.md)） |
| CAT-AUTHOR 仕様作成 | 壁打ち、要件・要点、設計、設計判断記録 | FUN-SPEC-001〜004（[specification-management.md](specification-management.md)） |
| CAT-CANON 原本管理 | 原本と変更記録、影響分析、整合性の検査 | FUN-SPEC-005〜007（[specification-management.md](specification-management.md)） |
| CAT-DEV 開発検証 | タスク分解、テスト先行の実装、確認の記録、完了 | FUN-DEV-001〜003（[development-verification.md](development-verification.md)） |
| CAT-GUARD 操作と記録 | 既存ツールでの編集・実行、Git の利用、検査スクリプト | FUN-TOOL-001〜003（[tool-integration.md](tool-integration.md)） |
| CAT-SETUP 導入 | プラグインによる導入と更新、リポジトリ版の書き出しと更新、プラグインの開発と確認 | FUN-COM-002、FUN-COM-004、FUN-COM-005（[common.md](common.md)） |

## 読む順序

1. [common.md](common.md) で共通要件と記述ルールを確認する。
2. 設計・レビューする機能に対応する文書を読む。

## ライト版への見直しについて

2026-10-20 に、利用者の想定（個人・少人数）に合わせて要件を見直した。ランナーによる状態管理・期待版の照合・操作 ID・独自の操作ガード・記録方式の切り替えなどの「厳格版」の要件は外し、Git と Copilot の標準機能で代える。要件 ID は見直しに合わせて振り直した。見直し前の要件は Git の履歴（コミット 96e81d6）で参照できる。
