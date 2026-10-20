# 対話による記録と遷移

窓口（`sdd-orchestrator`）が人の判断を記録するときの手順です。人は request・操作 ID・期待版・コマンドを扱いません。

1. 判断が必要な対象を示す。承認なら工程、対象一覧、manifest の版（短縮表記）、前工程の版、承認役割。許可なら操作、対象、編集・読み取り・生成先、削除可否。
2. 人の回答を得る。承認・許可は [定型](request.md#人の回答human) だけを記録する。条件付き・疑問・保留・「続けて」・対象を示す前の回答は聞き直す。質問への回答は要旨を示して確かめる。
3. `scratchpad.read` で現在の版を取り、示した版が現在版か照合する。変わっていれば旧版への回答として記録せず、示し直す。
4. request を組み立てて実行し、response の `status` と新しい版を確認する（手動利用では人が実行し、結果を貼ってもらう）。文書の版を確かめるときは、文書を読まずに [`revision.read`](operations/revision.read.md) を使う。
5. 記録した内容、回答の要旨、回答者、時刻、出所、新しい状態と版を報告する。

| 契機 | 窓口が呼ぶ操作 |
| --- | --- |
| 未確定事項の発見 | `question.open` |
| 質問への回答 | `question.record_answer`、反映後に `reflectedIn` 付き、必要なら `decision.record` |
| 阻害の解消 | `workflow.transition` の `activate` |
| 工程成果物の完成 | `approval.request` |
| 定型の承認回答 | `approval.record`、続けて `workflow.transition` の `advance`（前提不足なら移行せず理由を示す） |
| 定型の許可回答 | `permission.record`（示した範囲だけ） |
| 中断・再開・差し戻しの依頼 | `workflow.transition` の `pause` / `resume` / `return` |
| Git 操作・マージ・本番反映 | 自動化しない。許可を記録して人の操作を案内し、取り込み後に `integration.record` |

`human` は、`actor` に登録した発注者・技術責任者の名前、`answer` に定型回答の要旨、`source` に「Copilot Chat の対話」と変更 ID・工程・対象、`timestamp` に回答を確認した UTC 時刻、`recordedBy` に `sdd-orchestrator` を入れます。会話全文・秘密値は保存しません。1回の発話に複数の判断があれば、1件ずつ確認・記録します。

エラーは種別と `nextAction` を示して止めます。内容を変えた再実行は人の確認を取り直し、新しい操作 ID で行います。結果がわからないときは `recover` で先に調べ、同じ操作 ID・同じ入力でだけ再送します。承認・許可は追記のみで、誤った記録は書き換えません。人の確認を得て、`return` や新しい回答・決定の記録で正します。

### 記録の方式

既定は自動記録です。上から順に当てはまる方式を使います（`doctor` の `recording` と同じ判定）。

| 方式 | 条件 | 動作 |
| --- | --- | --- |
| 手動利用（`manual`） | 人がその会話で手動を選んだ、または `profile.json` の `recordingDefault` が `manual` | 窓口が1行のコマンドと説明を示し、人が実行して結果（response）を貼る。窓口はその `status` と `revisions` で確かめて報告する |
| 自動記録（`automatic`） | `mode: managed`、`hostChecks.localHooks` / `failureDenies` が true、窓口と6工程担当の tools に execute がある | 窓口・担当がランナーを同期実行する |
| 確認待ち（`setup-required`） | 上記のどちらでもない（導入直後を含む） | 記録しない。有効化の手順（[README](../README.md#2-自動記録を有効にする導入時に1回)）と、手動利用を選べることを示す。読み取り・壁打ち・質問整理・レビューは続けられる。状況確認は要約ファイル `status.json` を読む |

窓口は会話の開始・再開時と最初の記録の前に、`profile.json` と自分の tools（execute があれば `doctor` も）で方式を確かめ、応答に示します。会話中の手動の選択は状態ファイルへ保存せず、その会話だけに適用します。「自動で進めて」と頼まれれば、確認済みなら自動記録へ戻ります。自動記録中にガードの想定外の拒否や `ENVIRONMENT_UNSUPPORTED` が起きたら、確認待ちとして記録を止めます。人の実行前に記録済み・遷移済みとは表示しません。AI は `profile.json`・agent を変更できず、`setup.mjs` も実行できません。
