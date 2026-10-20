# scratchpad.update

案件の Scratchpad 内の文書（`overview.md` など）を更新します。窓口は共有の引き継ぎ（次の作業と理由）も更新できます。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

- 使う場面: 検討メモや人向けの概要を残すとき。引き継ぎを更新するとき。
- 前提: 更新先を含む `scratchpad.update` の許可が記録されていること（[`permission.record`](permission.record.md)）。`state.json`・`operations.json`・`pending/` は更新できない。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `updates` | どちらか必須 | [`document.update`](document.update.md) と同じ形（差分 `edits` または全文 `content`）。パスは `docs/scratchpad/<changeId>/` 配下。`content: null` は削除（削除の許可が必要） |
| `handoff` | どちらか必須 | `{ "nextAction": 次の作業, "reason": 理由 }`。窓口だけ |

`expectedRevisions` には `state.json` と、更新する各ファイルの現在版（新規は `null`）を入れます。

- 結果: 新しい版。状態が `approved` なら `active` に戻る。
- 主なエラー: 許可がない（`PERMISSION_REQUIRED`）、中断中・承認待ち（`OUT_OF_SCOPE`）、版が古い（`CONFLICT`）。
