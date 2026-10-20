# workflow.status

ランナーが案件の状況を集計し、短い要約を返します。読み取りだけで、書き込みはしません。状況確認では、案件のファイルを読む代わりにこの操作を1回呼びます。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。この操作の `expectedRevisions` は `{}` でよい。

- 使う場面: 「状況を教えて」「記録を見せて」、再開の前の確認。
- 呼べる役割: 全員（reviewer を含む）。
- 前提: 自動記録の環境（ランナーを実行できること）。確認待ちの間は、代わりに要約ファイル `docs/scratchpad/<changeId>/status.json` を読む（下記）。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `recordLimit` | 任意 | 記録の一覧を新しい順に何件返すか（0〜50）。省略または 0 なら一覧を返さない。「記録を見せて」のときだけ指定する |

```json
{ "schemaVersion": 1, "operation": "workflow.status", "role": "orchestrator", "changeId": "CHG-0001", "branch": "change/CHG-0001", "expectedRevisions": {}, "payload": {} }
```

| 結果の項目 | 内容 |
| --- | --- |
| `phase`、`status`、`resumeStatus` | 工程、進行状態、中断前の状態 |
| `questions.due` | 期限が現在工程までの未解決の質問（ID・質問文・期限・状態） |
| `questions.later` | 後の工程で決める未解決の質問の件数 |
| `awaitingApproval` | 承認待ちなら、工程・版・承認する人・対象の roots・ファイル数・依頼後に対象が変わっていないか（`current`） |
| `approvals`、`staleApprovals` | 工程ごとの最新の承認と、承認後に成果物が変わった工程（再承認が必要） |
| `permissions` | 記録済みの許可の範囲（操作・編集先・削除可否・担当用の工程と役割） |
| `pendingUpdates` | 途中で止まった更新の件数（1以上なら [`recover`](recover.md)） |
| `tasks` | 状態ごとのタスク件数と、未検証のタスク ID（最大20件） |
| `integration` | 開発完了の承認、取り込みの記録、本番反映の記録の有無 |
| `git` | 登録したブランチと基点、作業中のブランチ（`currentBranch`）と一致するか（`branchMatches`） |
| `recording` | 記録の方式（`automatic` / `manual` / `setup-required`） |
| `lastOperation`、`nextAction` | 最後に確定した操作、次に必要なこと |
| `records` | `recordLimit` を指定したときの記録の一覧（回答・承認・許可。回答者・回答の要旨・時刻・出所・記録者を含む） |
| `basis` | `live`（今のファイルから集計した） |

承認の古さ（`staleApprovals`）は、承認した対象ファイルの今の版から計算します。手で編集された変化も検出されます。

## 確認待ちの間: 要約ファイル

ランナーは状態を変える操作のたびに、同じ形の要約を `docs/scratchpad/<changeId>/status.json` に書き出します。確認待ちでランナーを実行できない間は、このファイルだけを読み取りツールで読みます。

- `basis` は `last-recorded-operation`、`generatedAt` は書き出した時刻です。
- 最後の記録の時点の内容です。その後の手での編集による承認の古さや、作業中のブランチは含みません。答えるときは「最後の記録（`generatedAt`）の時点の状況」と明示します。
- 記録の一覧は直近10件までを含みます。
- このファイルはランナーだけが書きます。文書の更新では書き換えられず、工程の承認の対象にも含まれません。
