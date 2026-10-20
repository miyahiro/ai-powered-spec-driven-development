# change.register

新しい案件を登録します。登録済みでブランチが未登録の案件には、Git 情報を後から結び付けます。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。`expectedRevisions` には `state.json` の現在版が必要。結果とエラーの読み方は [response・エラー](../request.md#response-の読み方)。

- 使う場面: 受付で内容を確認したとき。人が Git のブランチと最初のコミットを用意したとき。
- 前提: 新規なら `state.json` の期待版を `null` にする。結び付けでは、種別・目的・範囲・承認役割を登録時と同じにする。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `kind` | 必須 | `new`（新規）/ `enhancement`（改善）/ `fix`（修正） |
| `purpose` | 必須 | 目的 |
| `scope` | 必須 | `{ "in": [対象], "out": [対象外] }` |
| `actors` | 必須 | `{ "customer": 発注者の名前, "technicalLead": 技術責任者の名前 }`。同じ人でもよい |
| `git` | 必須 | `{ "defaultBranch", "branch", "baseCommit" }`。未準備はすべて `null`。`branch` は request の `branch` と同じ値。`baseCommit` は40〜64桁の16進 |

```json
{
  "schemaVersion": 1, "operation": "change.register", "operationId": "register-CHG-0001-1",
  "role": "orchestrator", "changeId": "CHG-0001", "branch": null,
  "expectedRevisions": { "docs/scratchpad/CHG-0001/state.json": null },
  "payload": {
    "kind": "new", "purpose": "社内の問い合わせ対応状況を共有する",
    "scope": { "in": ["問い合わせの登録・検索"], "out": ["外部サービスとの連携"] },
    "actors": { "customer": "山田", "technicalLead": "佐藤" },
    "git": { "defaultBranch": null, "branch": null, "baseCommit": null }
  }
}
```

- 結果: `docs/scratchpad/CHG-0001/state.json` を作成する（工程 `ideation`、状態 `draft`）。Git の初期化・ブランチ作成はしない。
- 主なエラー: 既存案件の内容を変えようとした（`CONFLICT`）。登録したブランチ・コミットが実在しない（`BRANCH_MISMATCH`）。
- 手動利用で確認すること: ID が既存案件と重ならないか。目的・範囲・承認役割が対話で合意した内容か。
