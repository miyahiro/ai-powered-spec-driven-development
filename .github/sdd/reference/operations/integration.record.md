# integration.record

人がマージ等で取り込んだ後に、取り込み先のブランチ・コミットと承認済みの内容が一致することを確かめて記録します。マージそのものはしません。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

- 前提: 開発完了（`completed`）で、開発完了の承認があること。`merge` の許可があること。取り込み先のブランチに切り替え、HEAD が取り込みのコミットであること。request の `branch` も取り込み先にする。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `branch` | 必須 | 取り込み先のブランチ |
| `commit` | 必須 | 取り込みのコミット（40〜64桁の16進） |
| `human` | 必須 | 取り込んだ人の回答 |

- 結果: 承認済みの全工程のファイルがコミットの内容と一致すれば記録する。本番反映は記録しない。
