# コマンドと操作のリファレンス

ランナーのコマンド、request の JSON、response の読み方を、トピックと操作ごとのファイルに分けてまとめています。**必要なファイルだけを読んでください。** 全部を読む必要はありません。

| 読む人 | 読む場面 |
| --- | --- |
| 手動利用を選んだ人 | 窓口が示したコマンドを実行する前に、何が記録されるかを確かめる |
| 導入・管理する人 | 導入、有効化、方式の切り替え、障害時の復旧 |
| エージェント | request を組み立てる（窓口・工程担当） |

自動記録（既定）で使う人は、リファレンスを読まなくても対話だけで進められます。利用の流れは [ユーザーガイド](../user_guide.md)、導入と管理は [導入・管理ガイド](../README.md) を参照してください。

形式の正本は JSON Schema（[共通](../schemas/runtime.schema.json)、[操作](../schemas/operations.schema.json)）です。リファレンスは人が読むための説明で、Schema と食い違う場合は Schema が優先します。

## どのファイルを読むか

| 知りたいこと | ファイル |
| --- | --- |
| どの場面でどのコマンドを使うか、コマンドの形 | [commands.md](commands.md) |
| request の共通項目、人の回答（`human`）、response、エラーと対処 | [request.md](request.md) |
| 案件の状況（状況確認・記録の一覧） | [workflow.status.md](operations/workflow.status.md) |
| 1つの操作の項目・例・前提・確認すること | `operations/<操作名>.md`（下の早見表から選ぶ） |
| 窓口が対話で判断を得て記録する手順、記録の方式 | [dialogue.md](dialogue.md) |
| 手動利用で実行前に確かめること | [manual-checklist.md](manual-checklist.md) |
| 保存先、版、`tasks.json`・`traceability.json` の形式 | [files.md](files.md) |

エージェントは、作業に必要な操作のファイルだけを読みます。たとえば質問に回答を記録するなら [dialogue.md](dialogue.md) と [question.record_answer.md](operations/question.record_answer.md) で足ります。共通項目の詳細やエラーの意味が必要になったときだけ [request.md](request.md) を読みます。

## 操作の早見表

| 操作 | 何をするか | 呼べる役割 | `operationId` | 状態を変えるか |
| --- | --- | --- | --- | --- |
| [`change.register`](operations/change.register.md) | 案件の登録、Git 情報の結び付け | 窓口 | 必須 | 変える |
| [`scratchpad.read`](operations/scratchpad.read.md) | 状態・Scratchpad と版の読み取り | 全員 | 不要 | 変えない |
| [`revision.read`](operations/revision.read.md) | 指定したファイルの版だけの読み取り | 全員 | 不要 | 変えない |
| [`workflow.status`](operations/workflow.status.md) | 状況の集計（工程・質問・承認待ち・承認の古さ・タスク・記録の一覧） | 全員 | 不要 | 変えない |
| [`scratchpad.update`](operations/scratchpad.update.md) | 案件の Scratchpad の文書、引き継ぎの更新 | 窓口、工程担当 | 不要 | 変える |
| [`document.update`](operations/document.update.md) | 仕様・変更記録・コードの更新（差分または全文） | 窓口（`docs/` のみ）、工程担当 | 不要 | 変える |
| [`question.open`](operations/question.open.md) | 質問の登録 | 窓口 | 必須 | 変える |
| [`question.record_answer`](operations/question.record_answer.md) | 回答の記録 | 窓口 | 必須 | 変える |
| [`decision.record`](operations/decision.record.md) | 決定の記録 | 窓口 | 必須 | 変える |
| [`permission.record`](operations/permission.record.md) | 操作許可の記録 | 窓口 | 必須 | 変える |
| [`approval.request`](operations/approval.request.md) | 工程の承認依頼（対象の版を固定） | 窓口 | 必須 | 変える |
| [`approval.record`](operations/approval.record.md) | 工程承認の記録 | 窓口 | 必須 | 変える |
| [`workflow.transition`](operations/workflow.transition.md) | 作業再開・中断・再開・差し戻し・次工程 | 窓口 | 必須 | 変える |
| [`traceability.validate`](operations/traceability.validate.md) | 追跡表の参照検査 | 全員 | 不要 | 変えない |
| [`verification.run`](operations/verification.run.md) | 隔離環境での自動検証 | 窓口、実装担当 | 不要 | 変える |
| [`verification.record`](operations/verification.record.md) | 手動検証・レビュー結果の記録 | 窓口 | 不要 | 変える |
| [`git.inspect`](operations/git.inspect.md) | ブランチ・HEAD・変更状況の読み取り | 全員 | 不要 | 変えない |
| [`integration.record`](operations/integration.record.md) | 人が取り込んだ後の確認と記録 | 窓口 | 必須 | 変える |
| [`recover`](operations/recover.md) | 途中で止まった更新の調査・復旧 | 窓口 | 不要 | `apply: true` のとき変える |
| [`doctor`](operations/doctor.md) | 環境・記録の方式の表示 | 全員 | 不要 | 変えない |

状態を変える操作には共通の前提があります。`expectedRevisions` に `state.json` の現在版があること、`branch` が案件と一致すること、`pending/` に途中の更新が残っていないこと、案件が完了（`completed`）していないことです。完了後に使えるのは `integration.record` だけです。



工程（`phase`）の値は `ideation`（壁打ち）、`requirements`（要求定義）、`external-design`（外部設計）、`internal-design`（内部設計）、`task-planning`（タスク分解）、`development`（開発）です。
