# document.update

仕様の原本候補・変更記録・コード・テストを更新します。既存のファイルの一部を直すときは **差分（`edits`）** を使い、新しいファイルや全体を書き直すときだけ全文（`content`）を使います。差分にすると、request と出力が変更箇所の分だけで済みます。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

- 使う場面: 合意した文書の保存、タスクの実装。
- 前提:
  - `document.update` の許可に更新先が含まれること。工程担当は、許可の `phase` が現在工程で `roles` に自分が含まれること。
  - 窓口は `docs/` 配下だけを更新できる。工程担当は、自分の工程が現在工程で、前工程の承認が最新であること。設計系の担当は `docs/` 配下だけ。
  - 実装担当は、依存が完了した実行可能なタスクの `editPaths` だけを更新できる。
  - 中断中・承認待ちでは更新できない。他の案件の変更記録、`verification/*.json`、状態ファイル、`.github/` 等の制御設定・秘密ファイルは更新できない。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `updates` | 必須 | 更新の配列。各要素は下表の **差分** か **全文** のどちらか一方 |

| `updates` の要素 | 内容 |
| --- | --- |
| 差分 `{ "path", "edits" }` | `edits` は `[{ "oldText": 置き換える前の文字列, "newText": 置き換えた後の文字列 }]`（1〜100件）。既存のファイルだけ。上から順に適用し、各 `oldText` はその時点の内容に **ちょうど1か所** だけ存在すること。0か所・2か所以上なら何も書き込まず `INVALID_FORMAT`。`newText` を空にすると削除になる |
| 全文 `{ "path", "content" }` | `content` に新しい全文。新規作成はこちら。`content: null` は削除（`allowDelete: true` の許可が必要） |

`oldText` は、一意に決まるよう前後の行を少し含めます。差分でも全文でも、`expectedRevisions` に対象ファイルの現在版（新規は `null`）が必要で、版が違えば `CONFLICT` になります（人の編集を上書きしません）。

```json
{
  "schemaVersion": 1, "operation": "document.update", "role": "requirements",
  "changeId": "CHG-0001", "branch": "change/CHG-0001",
  "expectedRevisions": { "docs/scratchpad/CHG-0001/state.json": "sha256:<64桁>", "docs/spec/current/requirements/inquiry.md": null },
  "payload": { "updates": [{ "path": "docs/spec/current/requirements/inquiry.md", "content": "# 問い合わせ管理の要求\n..." }] }
}
```

差分の例（既存の文書の1行を直す）:

```json
{
  "schemaVersion": 1, "operation": "document.update", "role": "requirements",
  "changeId": "CHG-0001", "branch": "change/CHG-0001",
  "expectedRevisions": { "docs/scratchpad/CHG-0001/state.json": "sha256:<64桁>", "docs/spec/current/requirements/inquiry.md": "sha256:<64桁>" },
  "payload": { "updates": [{ "path": "docs/spec/current/requirements/inquiry.md", "edits": [
    { "oldText": "| REQ-INQ-003 | 保存期間は1年とする。 |", "newText": "| REQ-INQ-003 | 保存期間は3年とする。 |" }
  ] }] }
}
```

- 結果: `revisions` に各ファイルの新しい版。担当はこの版を窓口へ返す。`tasks.json`・`traceability.json` は形式を検査する。状態が `approved` なら `active` に戻る（承認後の変更は再承認が必要）。
- 手動利用で確認すること: 更新先が合意した範囲か。差分では `oldText` と `newText` の違いが合意した変更か。全文では、残すべき内容を消していないか。
