# request・response の共通仕様

## request の共通項目

```json
{
  "schemaVersion": 1,
  "operation": "question.open",
  "operationId": "question-open-CHG-0001-1",
  "role": "orchestrator",
  "changeId": "CHG-0001",
  "branch": "change/CHG-0001",
  "expectedRevisions": { "docs/scratchpad/CHG-0001/state.json": "sha256:<64桁>" },
  "payload": { }
}
```

| 項目 | 必須 | 内容 | 値の取り方 |
| --- | --- | --- | --- |
| `schemaVersion` | 必須 | 常に `1` | 固定 |
| `operation` | 必須 | 操作名。[早見表](README.md#操作の早見表) の20種類 | 場面から選ぶ |
| `operationId` | 操作による | 再送しても二重に記録しないための ID。英数字・`_`・`-` で100文字以内 | 窓口専用の操作（`recover` を除く）で必須。新しい操作には新しい ID、同じ操作の再送には同じ ID と同じ入力 |
| `role` | 必須 | 実行する役割。`orchestrator` / `ideation` / `requirements` / `external-design` / `internal-design` / `task-planner` / `implementer` / `reviewer` | 自動記録では、実行する agent の役割と一致しなければガードが拒否する |
| `changeId` | 必須 | 案件 ID。`CHG-0001` 形式 | 受付で決めた ID |
| `branch` | 必須 | 案件に登録したブランチ名。Git 未登録の間は `null` | `state.json` の `git.branch` と同じ値。違うと `BRANCH_MISMATCH` |
| `expectedRevisions` | 必須 | 書き換える前のファイルの版。未作成は `null` | 状態を変える操作では必ず `state.json` の現在版を入れる。文書・証跡を書く操作では、その対象ファイルの現在版も入れる。`state.json` の版は [`scratchpad.read`](operations/scratchpad.read.md)、文書の版は [`revision.read`](operations/revision.read.md) で取る |
| `payload` | 必須 | 操作ごとの内容 | [操作ごとの説明](README.md#操作の早見表) |

読み取りだけの操作（`scratchpad.read`、`revision.read`、`workflow.status`、`traceability.validate`、`git.inspect`、`doctor`）と `recover` は、`expectedRevisions` を `{}` にできます。

同じ `operationId` を同じ入力で再送すると、保存済みの結果が `replayed: true` 付きで返り、二重に記録されません。入力の項目の順序が違うだけなら同じ入力として扱います。同じ ID で内容が違うと `CONFLICT` です。

## 人の回答（human）

質問への回答、承認、許可、中断・再開・差し戻し、取り込み、復旧の許可には、人の回答を `human` として付けます。

```json
{
  "actor": "山田",
  "answer": "この工程を承認します",
  "source": "Copilot Chat の対話（CHG-0001 requirements の承認依頼への回答）",
  "timestamp": "2026-10-20T03:15:00Z",
  "recordedBy": "sdd-orchestrator"
}
```

| 項目 | 必須 | 内容 |
| --- | --- | --- |
| `actor` | 必須 | 回答した人。承認では、受付で登録した発注者・技術責任者の名前と一致すること |
| `answer` | 必須 | 回答の要旨。承認・許可は次の定型だけ |
| `source` | 必須 | 回答の出所。対話・確認文書などの識別情報。秘密や token 付き URL は書かない |
| `timestamp` | 必須 | 回答を確認した UTC 時刻。`YYYY-MM-DDThh:mm:ssZ` |
| `recordedBy` | 任意 | 代わりに記録した者。対話では `sdd-orchestrator` |

| 用途 | 受け付ける `answer`（末尾の「。」「.」「!」は可） |
| --- | --- |
| 工程承認（`judgment: approved`） | `承認します`、`この工程を承認します`、`工程一式を承認します`、`approve`、`approved` |
| 操作許可・復旧の許可 | `許可します`、`この操作を許可します`、`文書の編集を許可します`、`更新を許可します`、`編集を許可します`、`検証を許可します`、`復旧を許可します`、`記録を許可します`、`マージを許可します`、`allow`、`authorized`、`permission granted` |
| 質問への回答、中断・再開・差し戻し、取り込み | 自由な要旨（「続けて」は承認・許可にならない） |

これは人の回答を運用上記録するもので、本人認証や電子署名ではありません。

## response の読み方

成功:

```json
{
  "status": "ok",
  "operationId": "question-open-CHG-0001-1",
  "result": { "questionId": "Q-0001" },
  "revisions": { "docs/scratchpad/CHG-0001/state.json": "sha256:<新しい版>" }
}
```

| 項目 | 内容 |
| --- | --- |
| `status` | `ok` のときだけ成功。`error` は失敗 |
| `operationId` | request の `operationId`（なければ `null`） |
| `result` | 操作ごとの結果（質問 ID、manifest など） |
| `revisions` | 書き込んだファイルの新しい版。次の request の `expectedRevisions` に使う |
| `replayed` | `true` なら再送で、保存済みの結果を返しただけ |

失敗:

```json
{
  "status": "error",
  "error": { "code": "CONFLICT", "message": "Supply the current state revision, or null for a new case.", "nextAction": "Inspect the input and pending updates before retrying." }
}
```

`status` が `ok` でも、`traceability.validate` の `result.valid` が `false` なら参照の不備が残っています。

## エラーと対処

| code | 主な原因 | 対処 |
| --- | --- | --- |
| `CONFLICT` | `expectedRevisions` が古い。誰かが先に更新した、手で編集した。ロックが残っている。同じ `operationId` で内容が違う | `scratchpad.read` で最新の版を取り直す。人の変更は消さない。ロックは実行中の操作がないことを確かめてから外す |
| `OUT_OF_SCOPE` | 役割に許されない操作、範囲外のパス、制御設定・秘密ファイル、別案件、中断中・承認待ちの文書更新 | 役割・対象・状態を確かめる。必要なら範囲を合意し直す |
| `BRANCH_MISMATCH` | request の `branch` や作業中のブランチが案件と違う。Git 準備前に工程を進めようとした | 正しいブランチに切り替える、または Git 情報を [`change.register`](operations/change.register.md) で結び付ける |
| `INVALID_FORMAT` | JSON の形・必須項目・値の形式が違う。未登録の案件。参照先が存在しない | message を読み、項目を直す。内容を変えるなら新しい `operationId` にする |
| `APPROVAL_REQUIRED` | 期限が来た未解決の質問、前工程の承認がない・古い、承認の回答が定型でない、承認役割が違う、必須の証跡・レビュー不足 | 質問の解消、再承認、正しい役割の人の定型回答など、message の不足を満たす |
| `PERMISSION_REQUIRED` | 必要な許可が記録されていない。許可の回答が定型でない | 対象・範囲を示して [`permission.record`](operations/permission.record.md) で許可を記録する |
| `ENVIRONMENT_UNSUPPORTED` | 隔離検証の環境が確認されていない・起動できない | 手動検証に切り替える。隔離なしで再実行しない |
| `INCOMPLETE_UPDATE` | 前の更新が途中で止まり、`pending/` が残っている | [`recover`](operations/recover.md) を `apply: false` で調べる |
