# 要求定義書の目次

GitHub Copilot / VS Code 上で動作する、スペック駆動開発用の AI エージェント・スキル・ツールの要求定義書を管理する。

他プロジェクトへ導入できる新規開発向けの仕組みを基本とする。承認は工程単位で人の回答を記録する運用とする。状態の遷移は、人が AI との対話で判断を答え、AI がその回答を確認して管理下の経路で記録・遷移させる Human-in-the-loop の方式とし、人にコマンドや request の作成・実行を求めない。補助スクリプト・hooks は必要な整合性確認・操作制限に絞る。現在の設計入力は本フォルダの要求とし、出典のアイデア文書に対するレビュー後の方針を反映している。

設定ファイル数、状態の保存形式、対応バージョン、具体的なツール名は設計で決める。導入・更新方法は簡単な手順に留め、役割の並行実行と MCP 連携は検証対象外とする。これは支援先アプリの開発・テストを省略する意味ではない。

各文書は要求定義ドラフトであり、要件の承認や機能の実装が完了したことを示すものではない。

## 文書一覧

| 文書 | 対象・概要 |
| --- | --- |
| [common.md](common.md) | 共通の目的・対象範囲、用語、要求 ID のルール、環境・安全性・移植性の要求 |
| [workflow-orchestration.md](workflow-orchestration.md) | 対話、役割・スキルの連携、承認、状態、対話による状態の記録と遷移、中断・再開 |
| [specification-management.md](specification-management.md) | 要件・設計・原本・変更記録・Scratchpad の管理 |
| [development-verification.md](development-verification.md) | タスク計画、TDD、レビュー、検証と追跡 |
| [tool-integration.md](tool-integration.md) | 既存ツール・MCP の連携、操作契約、権限制御 |

## 機能の大分類

各要求は大分類・機能に対応する。機能は各文書の「提供する機能」で定義し、要求は機能要件の表の「大分類」「機能」列で対応先を示す。

| 大分類 | 名称・範囲 | 機能（定義先） |
| --- | --- | --- |
| CAT-FLOW 工程進行 | 入口、受付、担当への委任、承認、状況確認、中断・再開、質問、対話による状態の記録と遷移 | FUN-COM-001、FUN-WF-001〜008（[common.md](common.md)、[workflow-orchestration.md](workflow-orchestration.md)） |
| CAT-AUTHOR 仕様作成 | 壁打ち、要件定義、外部設計、内部設計、設計判断記録 | FUN-SPEC-001〜005（[specification-management.md](specification-management.md)） |
| CAT-CANON 原本管理 | 変更影響分析、原本候補の更新、整合性レビュー、Scratchpad | FUN-SPEC-006〜009（[specification-management.md](specification-management.md)） |
| CAT-DEV 開発検証 | タスク計画、TDD、検証と独立レビュー、仕様変更への対応 | FUN-DEV-001〜004（[development-verification.md](development-verification.md)） |
| CAT-GUARD 操作制御 | 管理下の更新、許可範囲、記録、復旧、取り込み確認、管理下の経路による自動実行 | FUN-TOOL-001〜007（[tool-integration.md](tool-integration.md)） |
| CAT-SETUP 導入配布 | 導入と更新 | FUN-COM-002（[common.md](common.md)） |

機能の名称・入力・結果・停止条件は要求であり、agent・skill の名称や分割は設計で決める。

## 読む順序

1. [common.md](common.md) で共通要求と記述ルールを確認する。
2. 設計・レビューする機能に対応する文書を読む。全体を確認する場合は、文書一覧の順に読む。

各機能文書は目的・対象範囲、機能要件・業務ルール、非機能要件、受入条件をまとめて記載する。共通要求は各文書から参照し、重複して定義しない。