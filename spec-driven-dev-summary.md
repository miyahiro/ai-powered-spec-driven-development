# スペック駆動開発 構成まとめ

本リポジトリの `.github/` 配下に作成している、スペック駆動開発用のエージェント・スキル・共通指示・ローカルランナーの整理。

## 1. 全体像

- 進め方: 壁打ち → 要件定義 → 外部設計 → 内部設計 → タスク分解・整合性確認 → 開発・テスト
- 通常の入口は `sdd-orchestrator` のみ。必要な担当へ直列に委任する。
- 初期設定は**読み取り専用**。操作ガード・隔離が未確認の環境では execute を有効にしない。

| 種類 | 場所 | 数 |
| --- | --- | --- |
| 共通指示 | [.github/copilot-instructions.md](.github/copilot-instructions.md) | 1 |
| エージェント | [.github/agents/](.github/agents) | 8 |
| スキル | [.github/skills/](.github/skills) | 15 |
| ローカルランナー | [.github/sdd/](.github/sdd) | 1 式 |
| 仕様（候補原本） | [docs/spec/current/](docs/spec/current) | 要件・設計 |

## 2. 共通指示（copilot-instructions.md）

日本語で対話・文書化する。主なルール:

- **保存先**: 全体仕様の候補原本 `docs/spec/current/`、変更記録 `docs/spec/changes/<change-id>/`、共有状態 `docs/scratchpad/<change-id>/`。変更ブランチの候補原本を「既定ブランチへ取り込み済み・本番反映済み」とは呼ばない。
- **質問**: 決められない前提は質問にし、選択肢・推奨・影響・確認期限の工程を示す。後工程の質問で現在作業を止めない。回答のない事項を決定済みにしない。
- **承認**: 工程成果物一式の版に対して記録。発注者が壁打ち・要件定義・外部設計、技術責任者が内部設計・開発完了を承認。タスク分解に新しい承認工程は作らない。
- **区別**: 回答・作業継続・工程承認・操作許可は別物。「続けて」を承認に変換しない。本人認証・電子署名は実装したと扱わない。
- **書き込み**: 許可範囲と期待版を確認し、管理下のランナー経由。人の変更を消さない。競合・部分更新・結果不明は停止して復旧方法を示す。
- **Git**: 初期化・ブランチ作成・コミット・push・PR・マージ・本番反映を自動実行しない。秘密値は記録しない。
- **検証**: 隔離が使えなければ手動確認へ切り替え、未実施を成功としない。

## 3. エージェント（8）

窓口 `sdd-orchestrator` のみ `user-invocable: true`。他は窓口から呼ばれる。

| エージェント | 役割 | 主な使うスキル | 備考 |
| --- | --- | --- | --- |
| sdd-orchestrator | 受付・状態・回答・承認・許可・引き継ぎの窓口 | change-intake, workflow-status, workflow-resume, clarification, phase-handoff | tools: read, search, agent, vscode_askQuestions。他7担当へ委任 |
| sdd-ideation | 壁打ち、課題・価値・制約、候補比較、範囲整理 | idea-dialogue | 前工程承認不要 |
| sdd-requirements | 機能別要件・業務ルール・非機能・受入条件 | requirements-definition | |
| sdd-external-design | UI・帳票・API・外部連携の動作と例外 | external-design | |
| sdd-internal-design | DDD・責務・依存・データ・処理・運用・テスト方針 | ddd-internal-design | |
| sdd-task-planner | 依存順タスク・編集範囲・検証計画・追跡表 | task-planning | tasks.json / traceability.json のみ編集。追加の人承認は要求しない |
| sdd-implementer | 承認済みタスクの TDD 実装・文書/構築・管理下の検証 | tdd-cycle | 許可範囲内のみ |
| sdd-reviewer | 読み取り専用の独立レビュー | consistency-review, verification-and-review | 指摘のみ返す |

共通: `tools: [read, search]`、`agents: []`、`PreToolUse` hook で `node .github/sdd/bin/guard.mjs <role>` を実行（例: task-planner は `guard.mjs task-planner`）。担当呼び出し不可なら役割切り替えで続行できるが「独立確認」とは表示しない。

## 4. スキル（15）

| 区分 | スキル | 用途 |
| --- | --- | --- |
| 受付・運用 | change-intake | 新規・改善・修正の受付。目的、変更 ID、対象、承認役割、Git 準備と操作許可 |
| | workflow-status | 進捗・現在工程・阻害・承認待ち・質問待ちの確認（応答のみ） |
| | workflow-resume | 中断・結果不明からの再開。保存状態・ブランチ・版・許可を照合 |
| | clarification | 未解決の前提・選択肢・回答の整理。現在必要な質問と後工程の質問を分離 |
| | phase-handoff | 工程承認と次工程への引き継ぎ。成果物一式・入力版・承認・許可を分けて確認 |
| 上流工程 | idea-dialogue | アイデア壁打ち（templates/idea.md） |
| | requirements-definition | 要件定義（templates/feature-requirements.md） |
| | external-design | 外部設計（templates/external-design.md） |
| | ddd-internal-design | DDD 内部設計（templates/internal-design.md） |
| 変更管理 | change-impact-analysis | 改善・修正の影響、互換性、移行、回帰、再検証・再承認の対象 |
| | canonical-spec-update | 合意変更を候補原本と変更記録へ反映（マージはしない） |
| | consistency-review | 要件・設計・原本・タスク・追跡表の整合性レビュー（指摘のみ） |
| 下流工程 | task-planning | 承認済み内部設計からタスク分解・検証計画・追跡表 |
| | tdd-cycle | Red・Green・Refactor による開発 |
| | verification-and-review | 受入条件への適合、検証証跡、独立レビュー、完了前提の確認 |

`/change-intake`、`/workflow-status` などで直接指定も可能。

## 5. ローカルランナー（.github/sdd/）

| ファイル | 役割 |
| --- | --- |
| [README.md](.github/sdd/README.md) | 導入手順と操作契約 |
| [user_guide.md](.github/sdd/user_guide.md) | 利用者向けガイド（工程ごとの依頼例、承認・許可、中断・再開、困ったとき） |
| profile.json | 動作モード（現状 `read-only`）、読み取り許可パス、ツール種別、検証プロファイル |
| bin/sddctl.mjs, bin/guard.mjs | ランナー CLI（`doctor`・`status` 等）／hook 用ガード |
| lib/ (runtime, store, validation, verification) | 状態管理・検証の実装 |
| schemas/ | operations / runtime の JSON Schema |
| test/ | customization / runtime のテスト（`node --test`） |

- 導入: Node.js 24 系。`npm ci --prefix .github/sdd --ignore-scripts --no-audit --no-fund` → `npm test --prefix .github/sdd` → `node .github/sdd/bin/sddctl.mjs doctor`
- 依存: ajv 8.17.1, yaml 2.8.1
- 初期は担当が文書案・差分・JSON 操作案を返し、人がランナーを実行する。案を保存済みと扱わない。
- 版管理: ファイルは `sha256:<64桁>` のバイト列 hash（未作成は `null`）。工程 manifest は相対パス→hash のソート済み map。ロックと期待版照合で更新を直列化し、複数ファイル更新は pending を残して途中失敗を検出する。
- 書き込みパス: workspace 相対 POSIX パスのみ。絶対パス・`..`・symlink・秘密ファイル・制御設定は拒否。通常タスクは `.git/`・`.github/`・`.vscode/` を変更不可。

## 6. 保存先と案件構成

| 保存先 | 内容 |
| --- | --- |
| `docs/spec/current/` | 全体仕様の候補原本（現状: requirements/ と design/ に common・development-verification・specification-management・tool-integration・workflow-orchestration） |
| `docs/spec/changes/CHG-0001/` | change.md、工程差分、tasks.json、traceability.json、verification/ |
| `docs/scratchpad/CHG-0001/` | state.json、operations.json、pending/、overview.md |
| `docs/idea/` | 初期アイデア（intial-idea.md） |

## 7. 利用の流れ

1. `sdd-orchestrator` を選び「新しい仕組みを考えたい」等と依頼 → change-intake で案件登録
2. 壁打ち → 要件定義 → 外部設計 → 内部設計：各工程で成果物一式を作り、承認者の承認を版に対して記録
3. タスク分解・整合性確認（追加承認なし）
4. 開発（TDD）・検証・独立レビュー → 技術責任者が開発完了を承認
5. 中断時は workflow-status / workflow-resume で状況確認・再開
