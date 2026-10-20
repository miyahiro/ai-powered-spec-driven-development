---
name: workflow-resume
description: "続きから再開して、セッション中断・結果不明から復帰したいときに使う。保存状態、ブランチ、版、許可、質問と証跡を照合する。"
user-invocable: true
---

# 再開

入力: 案件 ID、保存状態と関連成果物、現在の作業環境。使う操作は [`workflow.status`](../../sdd/reference/operations/workflow.status.md)、[`scratchpad.read`](../../sdd/reference/operations/scratchpad.read.md)、[`recover`](../../sdd/reference/operations/recover.md)、[`workflow.transition`](../../sdd/reference/operations/workflow.transition.md)。

1. `workflow.status` を1回呼び、工程・状態、ブランチの一致、承認後に変わった工程、途中の更新、許可の範囲、必須の質問、未検証のタスクを確かめる。個別のファイルは、要約で不一致が見つかった項目だけ読む。ランナーを実行できない間は要約ファイル `status.json` を読み、最後の記録の時点の状況であると示す。会話の記憶より保存された記録を優先する。
2. 要約に不一致（ブランチの違い、`staleApprovals`、`pendingUpdates`、期限の来た質問）がないかを照合する。将来質問だけなら現在作業を止めない。
3. pending があれば窓口が `recover` を `apply: false` で調べ、適用済み・残り・手動変更を確認する。復旧を明示許可した人の回答がなければ適用しない。残留ロックを時間だけで削除しない。
4. 登録操作を再送する場合は同じ操作 ID と同じ入力を使う。入力を変更するなら新 ID を使い、旧操作の結果を先に照合する。
5. 記録の方式を確かめて示す。不一致がなければ、人の再開の依頼を回答として窓口が [対話による記録](../../sdd/reference/dialogue.md) に従い `workflow.transition` の `resume` を記録する。必須質問を解消して再作業する場合は `activate` を使う。窓口が引き継ぎを別操作で更新する。

停止: ブランチ・版・許可・必須質問の不一致、部分更新、古い検証証跡。編集競合は人の変更を残し、差分の統合を質問する。

出力: 記録の方式、最後の確定地点、再開可能な作業、不一致、未完了操作、必要な人の対応、再開後の確認済み新版。手動利用では人が実行するコマンドを示し、実行と結果確認の前に再開を記録済みとは呼ばない。