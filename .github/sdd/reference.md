# コマンドと操作のリファレンス

ランナーのコマンド、request の JSON、response の読み方をまとめたリファレンスです。

| 読む人 | 読む場面 |
| --- | --- |
| 手動利用を選んだ人 | 窓口が示したコマンドを実行する前に、何が記録されるかを確かめる |
| 導入・管理する人 | 導入、有効化、方式の切り替え、障害時の復旧 |
| エージェント | request を組み立てる（窓口・工程担当） |

自動記録（既定）で使う人は、このリファレンスを読まなくても対話だけで進められます。利用の流れは [ユーザーガイド](user_guide.md)、導入と管理は [README](README.md) を参照してください。

形式の正本は JSON Schema（[共通](schemas/runtime.schema.json)、[操作](schemas/operations.schema.json)）です。本書は人が読むための説明で、Schema と食い違う場合は Schema が優先します。

## 目次

- [場面別のコマンド](#場面別のコマンド)
- [コマンドの形](#コマンドの形)
- [request の共通項目](#request-の共通項目)
- [人の回答（human）](#人の回答human)
- [response の読み方](#response-の読み方)
- [エラーと対処](#エラーと対処)
- [操作の早見表](#操作の早見表)
- [操作ごとの説明](#操作ごとの説明)
- [対話による記録と遷移](#対話による記録と遷移)
- [手動利用の確認チェックリスト](#手動利用の確認チェックリスト)
- [ファイルと版](#ファイルと版)

## 場面別のコマンド

コマンドはすべて workspace のルートで実行します。

| 場面 | 実行する人 | コマンド |
| --- | --- | --- |
| 導入直後に依存を入れる | 導入する人 | `npm ci --prefix .github/sdd --ignore-scripts --no-audit --no-fund` |
| 配布物と設定を検査する | 導入する人 | `npm test --prefix .github/sdd` |
| 環境と記録の方式を確かめる | 導入・管理する人 | `node .github/sdd/bin/sddctl.mjs doctor` |
| 自動記録の状態を見る | 導入・管理する人 | `node .github/sdd/bin/setup.mjs status` |
| ホストの確認後、自動記録を有効にする（導入時に1回） | 導入する人 | `node .github/sdd/bin/setup.mjs enable --confirm-host-checks --note "<確認した環境>"` |
| VS Code・Copilot・設定を更新したので確認し直す | 管理する人 | `node .github/sdd/bin/setup.mjs disable` → 再確認 → `enable` |
| workspace の既定を手動利用にする／戻す | 管理する人 | `node .github/sdd/bin/setup.mjs default manual` ／ `default automatic` |
| 手動利用で、窓口が示した操作を実行する | 手動利用を選んだ人 | `node .github/sdd/bin/sddctl.mjs '<1行のJSON>'`（窓口が示したものをそのまま） |
| 自分で書いた request ファイルを実行する | 管理する人 | `node .github/sdd/bin/sddctl.mjs "$(node .github/sdd/bin/sddctl.mjs encode request.json)"` |
| 途中で止まった更新を調べる・直す | 管理する人 | [`recover`](#recover) を `apply: false` → 許可して `apply: true` |
| 更新ロックが残っている | 管理する人 | 実行中の操作がないことを確かめてから `rmdir .github/sdd/.lock` |

`setup.mjs` は人だけが実行できます。エージェントからの起動はガードが拒否します。

## コマンドの形

### sddctl.mjs

```sh
node .github/sdd/bin/sddctl.mjs doctor
node .github/sdd/bin/sddctl.mjs encode <request.json>
node .github/sdd/bin/sddctl.mjs '<1行のJSON>'
node .github/sdd/bin/sddctl.mjs <JSONのbase64url>
```

| 形 | 用途 |
| --- | --- |
| `doctor` | 環境・記録の方式・固定の起動形（`commandPrefix`）を表示する。`{"operation":"doctor"}` の request と同じ結果 |
| `encode <file>` | JSON ファイルを base64url に変換して表示する。実行はしない |
| `'<1行のJSON>'` | request を実行する。単一引用符で囲み、JSON 内の改行は `\n`、単一引用符は `\u0027` で書く。生の `'`・改行・制御文字を含めると拒否される |
| `<base64url>` | request を実行する。長い request を人が手で扱うときに使う |

引数は1つだけです。追加の引数、`;`、リダイレクト、改行を付けると拒否されます。失敗すると終了コード 1 で、response の `status` は `error` になります。

自動記録では、エージェントは `doctor` が返す `commandPrefix`（実体の Node と runner のパス）の直後に上記のどちらかの request だけを続けます。これ以外の起動はガードが拒否します。

### setup.mjs

| コマンド | 内容 |
| --- | --- |
| `status` | `recording`（`automatic` / `manual` / `setup-required`）、`recordingDefault`、`hostChecked`、`executeEnabled` を表示する |
| `enable --confirm-host-checks [--note <text>]` | ホストの確認を終えた人が実行する。`profile.json` を `mode: managed`、`hostChecks` の2項目を true にし、確認日時とメモを記録する。窓口と6工程担当の `tools` に `execute` を追加する（reviewer には追加しない） |
| `disable` | `mode: read-only` に戻し、`hostChecks` を false、`execute` を外す |
| `default automatic` / `default manual` | workspace の既定の記録方式を変える |

出力は `{ "status": "ok", "changed": [変更したファイル], "result": { status と同じ内容 } }` です。

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
| `operation` | 必須 | 操作名。[早見表](#操作の早見表) の18種類 | 場面から選ぶ |
| `operationId` | 操作による | 再送しても二重に記録しないための ID。英数字・`_`・`-` で100文字以内 | 窓口専用の操作（`recover` を除く）で必須。新しい操作には新しい ID、同じ操作の再送には同じ ID と同じ入力 |
| `role` | 必須 | 実行する役割。`orchestrator` / `ideation` / `requirements` / `external-design` / `internal-design` / `task-planner` / `implementer` / `reviewer` | 自動記録では、実行する agent の役割と一致しなければガードが拒否する |
| `changeId` | 必須 | 案件 ID。`CHG-0001` 形式 | 受付で決めた ID |
| `branch` | 必須 | 案件に登録したブランチ名。Git 未登録の間は `null` | `state.json` の `git.branch` と同じ値。違うと `BRANCH_MISMATCH` |
| `expectedRevisions` | 必須 | 書き換える前のファイルの版。未作成は `null` | 状態を変える操作では必ず `state.json` の現在版を入れる。文書・証跡を書く操作では、その対象ファイルの現在版も入れる。版は [`scratchpad.read`](#scratchpadread) の `revisions` で取る |
| `payload` | 必須 | 操作ごとの内容 | [操作ごとの説明](#操作ごとの説明) |

読み取りだけの操作（`scratchpad.read`、`traceability.validate`、`git.inspect`、`doctor`）と `recover` は、`expectedRevisions` を `{}` にできます。

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
| `BRANCH_MISMATCH` | request の `branch` や作業中のブランチが案件と違う。Git 準備前に工程を進めようとした | 正しいブランチに切り替える、または Git 情報を [`change.register`](#changeregister) で結び付ける |
| `INVALID_FORMAT` | JSON の形・必須項目・値の形式が違う。未登録の案件。参照先が存在しない | message を読み、項目を直す。内容を変えるなら新しい `operationId` にする |
| `APPROVAL_REQUIRED` | 期限が来た未解決の質問、前工程の承認がない・古い、承認の回答が定型でない、承認役割が違う、必須の証跡・レビュー不足 | 質問の解消、再承認、正しい役割の人の定型回答など、message の不足を満たす |
| `PERMISSION_REQUIRED` | 必要な許可が記録されていない。許可の回答が定型でない | 対象・範囲を示して [`permission.record`](#permissionrecord) で許可を記録する |
| `ENVIRONMENT_UNSUPPORTED` | 隔離検証の環境が確認されていない・起動できない | 手動検証に切り替える。隔離なしで再実行しない |
| `INCOMPLETE_UPDATE` | 前の更新が途中で止まり、`pending/` が残っている | [`recover`](#recover) を `apply: false` で調べる |

## 操作の早見表

| 操作 | 何をするか | 呼べる役割 | `operationId` | 状態を変えるか |
| --- | --- | --- | --- | --- |
| [`change.register`](#changeregister) | 案件の登録、Git 情報の結び付け | 窓口 | 必須 | 変える |
| [`scratchpad.read`](#scratchpadread) | 状態・Scratchpad と版の読み取り | 全員 | 不要 | 変えない |
| [`scratchpad.update`](#scratchpadupdate) | 案件の Scratchpad の文書、引き継ぎの更新 | 窓口、工程担当 | 不要 | 変える |
| [`document.update`](#documentupdate) | 仕様・変更記録・コードの更新 | 窓口（`docs/` のみ）、工程担当 | 不要 | 変える |
| [`question.open`](#questionopen) | 質問の登録 | 窓口 | 必須 | 変える |
| [`question.record_answer`](#questionrecord_answer) | 回答の記録 | 窓口 | 必須 | 変える |
| [`decision.record`](#decisionrecord) | 決定の記録 | 窓口 | 必須 | 変える |
| [`permission.record`](#permissionrecord) | 操作許可の記録 | 窓口 | 必須 | 変える |
| [`approval.request`](#approvalrequest) | 工程の承認依頼（対象の版を固定） | 窓口 | 必須 | 変える |
| [`approval.record`](#approvalrecord) | 工程承認の記録 | 窓口 | 必須 | 変える |
| [`workflow.transition`](#workflowtransition) | 作業再開・中断・再開・差し戻し・次工程 | 窓口 | 必須 | 変える |
| [`traceability.validate`](#traceabilityvalidate) | 追跡表の参照検査 | 全員 | 不要 | 変えない |
| [`verification.run`](#verificationrun) | 隔離環境での自動検証 | 窓口、実装担当 | 不要 | 変える |
| [`verification.record`](#verificationrecord) | 手動検証・レビュー結果の記録 | 窓口 | 不要 | 変える |
| [`git.inspect`](#gitinspect) | ブランチ・HEAD・変更状況の読み取り | 全員 | 不要 | 変えない |
| [`integration.record`](#integrationrecord) | 人が取り込んだ後の確認と記録 | 窓口 | 必須 | 変える |
| [`recover`](#recover) | 途中で止まった更新の調査・復旧 | 窓口 | 不要 | `apply: true` のとき変える |
| [`doctor`](#doctor) | 環境・記録の方式の表示 | 全員 | 不要 | 変えない |

状態を変える操作には共通の前提があります。`expectedRevisions` に `state.json` の現在版があること、`branch` が案件と一致すること、`pending/` に途中の更新が残っていないこと、案件が完了（`completed`）していないことです。完了後に使えるのは `integration.record` だけです。

## 操作ごとの説明

工程（`phase`）の値は `ideation`（壁打ち）、`requirements`（要求定義）、`external-design`（外部設計）、`internal-design`（内部設計）、`task-planning`（タスク分解）、`development`（開発）です。

### change.register

新しい案件を登録します。登録済みでブランチが未登録の案件には、Git 情報を後から結び付けます。

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

### scratchpad.read

案件の状態（`state.json`）、または案件の Scratchpad 内のファイルと、その版を読みます。書き込みはしません。

- 使う場面: 次の request の `expectedRevisions` を取るとき。状況を確認するとき。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `path` | 任意 | `docs/scratchpad/<changeId>/` 配下のファイル。省略すると `state.json` |

```json
{ "schemaVersion": 1, "operation": "scratchpad.read", "role": "orchestrator", "changeId": "CHG-0001", "branch": null, "expectedRevisions": {}, "payload": {} }
```

- 結果: `result` に状態（またはファイルの内容）、`revisions` に `{ パス: 現在の版 }`。
- 主なエラー: 未登録の案件、別案件のパス（`OUT_OF_SCOPE`）。

### scratchpad.update

案件の Scratchpad 内の文書（`overview.md` など）を更新します。窓口は共有の引き継ぎ（次の作業と理由）も更新できます。

- 使う場面: 検討メモや人向けの概要を残すとき。引き継ぎを更新するとき。
- 前提: 更新先を含む `scratchpad.update` の許可が記録されていること（[`permission.record`](#permissionrecord)）。`state.json`・`operations.json`・`pending/` は更新できない。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `updates` | どちらか必須 | `[{ "path": パス, "content": 新しい全文 }]`。パスは `docs/scratchpad/<changeId>/` 配下。`content: null` は削除（削除の許可が必要） |
| `handoff` | どちらか必須 | `{ "nextAction": 次の作業, "reason": 理由 }`。窓口だけ |

`expectedRevisions` には `state.json` と、更新する各ファイルの現在版（新規は `null`）を入れます。

- 結果: 新しい版。状態が `approved` なら `active` に戻る。
- 主なエラー: 許可がない（`PERMISSION_REQUIRED`）、中断中・承認待ち（`OUT_OF_SCOPE`）、版が古い（`CONFLICT`）。

### document.update

仕様の原本候補・変更記録・コード・テストを、全文の置き換えで更新します。

- 使う場面: 合意した文書の保存、タスクの実装。
- 前提:
  - `document.update` の許可に更新先が含まれること。工程担当は、許可の `phase` が現在工程で `roles` に自分が含まれること。
  - 窓口は `docs/` 配下だけを更新できる。工程担当は、自分の工程が現在工程で、前工程の承認が最新であること。設計系の担当は `docs/` 配下だけ。
  - 実装担当は、依存が完了した実行可能なタスクの `editPaths` だけを更新できる。
  - 中断中・承認待ちでは更新できない。他の案件の変更記録、`verification/*.json`、状態ファイル、`.github/` 等の制御設定・秘密ファイルは更新できない。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `updates` | 必須 | `[{ "path": パス, "content": 新しい全文 }]`。`content: null` は削除（`allowDelete: true` の許可が必要） |

```json
{
  "schemaVersion": 1, "operation": "document.update", "role": "requirements",
  "changeId": "CHG-0001", "branch": "change/CHG-0001",
  "expectedRevisions": { "docs/scratchpad/CHG-0001/state.json": "sha256:<64桁>", "docs/spec/current/requirements/inquiry.md": null },
  "payload": { "updates": [{ "path": "docs/spec/current/requirements/inquiry.md", "content": "# 問い合わせ管理の要求\n..." }] }
}
```

- 結果: 各ファイルの新しい版。`tasks.json`・`traceability.json` は形式を検査する。状態が `approved` なら `active` に戻る（承認後の変更は再承認が必要）。
- 手動利用で確認すること: 更新先が合意した範囲か。`content` が全文であり、残すべき内容を消していないか。

### question.open

質問を登録します。

- 使う場面: 決められない前提が見つかったとき。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `text` | 必須 | 質問文 |
| `options` | 必須 | 選択肢の配列（空でもよい） |
| `recommendation` | 必須 | 推奨と理由（空文字でもよい） |
| `impact` | 必須 | 未確定のときの影響の配列 |
| `duePhase` | 必須 | いつまでに決めるか（工程） |

```json
{
  "schemaVersion": 1, "operation": "question.open", "operationId": "question-open-CHG-0001-1",
  "role": "orchestrator", "changeId": "CHG-0001", "branch": null,
  "expectedRevisions": { "docs/scratchpad/CHG-0001/state.json": "sha256:<64桁>" },
  "payload": { "text": "問い合わせの保存期間は何年か", "options": ["1年", "3年"], "recommendation": "3年。監査要件に合わせるため", "impact": ["データ保持の要件"], "duePhase": "requirements" }
}
```

- 結果: `result.questionId`（`Q-0001` から連番）。`duePhase` が現在工程以前なら、状態は `blocked`（阻害）になる。

### question.record_answer

質問への人の回答を記録します。

- 使う場面: 人が質問に答えたとき。回答を正式な文書へ反映したとき。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `questionId` | 必須 | `Q-0001` など |
| `human` | 必須 | 人の回答（[human](#人の回答human)） |
| `reflectedIn` | 任意 | 回答を反映した文書のパスの配列。実在するファイルだけ |

- 結果: `reflectedIn` があれば質問は `resolved`（解決）、なければ `answered`（回答のみ）。回答の記録だけでは承認・許可にならない。
- 手動利用で確認すること: `answer` の要旨が自分の回答どおりか。`reflectedIn` の文書に実際に反映されているか。

### decision.record

質問への回答などから決まった運用上の決定を記録します。内部設計の ADR とは別のものです。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `text` | 必須 | 決定の内容 |
| `rationale` | 必須 | 根拠 |
| `questionIds` | 必須 | 関連する質問 ID の配列（登録済みのものだけ） |
| `references` | 必須 | 関連する文書のパスの配列（実在するものだけ） |

- 結果: `result.decisionId`（`DEC-0001` から連番）。

### permission.record

人の操作許可を記録します。工程承認とは別のものです。

- 使う場面: 文書の編集、検証の実行、取り込みの記録などを始める前。

| payload.permission | 必須 | 内容 |
| --- | --- | --- |
| `operations` | 必須 | 許可する操作。例: `document.update`、`scratchpad.update`、`verification.run`、`verification.record`、`merge`（取り込みの記録） |
| `editPaths` | 必須 | 編集してよいパス（前方一致）の配列 |
| `readPaths` | 必須 | 検証で読み取ってよいパスの配列 |
| `outputPaths` | 必須 | 検証で生成してよいパスの配列 |
| `profiles` | 必須 | 使ってよい検証プロファイル名の配列 |
| `allowDelete` | 必須 | 削除を許すか |
| `human` | 必須 | 人の許可の回答（定型） |
| `phase` | 任意 | 工程担当に与える場合の工程 |
| `roles` | 任意 | 工程担当に与える場合の役割の配列。`reviewer` は不可。`phase`・`roles` がない許可は窓口だけが使える |

```json
{
  "schemaVersion": 1, "operation": "permission.record", "operationId": "permission-CHG-0001-1",
  "role": "orchestrator", "changeId": "CHG-0001", "branch": null,
  "expectedRevisions": { "docs/scratchpad/CHG-0001/state.json": "sha256:<64桁>" },
  "payload": { "permission": {
    "operations": ["document.update"], "editPaths": ["docs/spec/changes/CHG-0001/idea.md"],
    "readPaths": [], "outputPaths": [], "profiles": [], "allowDelete": false,
    "phase": "ideation", "roles": ["ideation"],
    "human": { "actor": "山田", "answer": "許可します", "source": "Copilot Chat の対話（CHG-0001 アイデア文書の編集許可）", "timestamp": "2026-10-20T01:00:00Z", "recordedBy": "sdd-orchestrator" }
  } }
}
```

- 結果: 許可を追記する（書き換え・削除はしない）。同じ範囲の作業には何度でも使える。
- 手動利用で確認すること: 対象・範囲・削除の可否が、対話で合意したとおりか。広すぎるパスになっていないか。

### approval.request

工程の成果物一式の版（manifest）を作り、承認待ちにします。人に承認を依頼するための操作で、承認そのものではありません。

- 使う場面: 工程の成果物がそろったとき（タスク分解では使わない）。
- 前提: 中断中でない。期限が現在工程までの質問が解決している。前工程の承認が最新。開発工程では全タスクの検証と独立レビューが済んでいる。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `roots` | 必須 | 承認対象のフォルダ・ファイルの配列。`docs/spec/current/` か案件の変更記録の配下（開発工程はコード・テストも可）。要求定義では `docs/spec/current/requirements` を必ず含める |
| `disposition` | 任意 | 変更なし・対象外の工程で使う。`{ "kind": "unchanged" または "not-applicable", "rationale": 理由, "referenceRevision": 参照した版, "human": 人の回答 }` |

- 結果: `result.phase`、`result.manifest`（対象ファイルごとの版と全体の `revision`）、`result.requiredActor`（承認する人）。状態は `awaiting-approval`（承認待ち）。壁打ち・要求定義・外部設計は発注者、内部設計・開発は技術責任者が承認する。
- 手動利用で確認すること: `roots` に承認してほしい文書がすべて入っているか。

### approval.record

工程承認（または却下）を記録します。

- 使う場面: 承認役割の人が、示された対象に定型の回答をしたとき。
- 前提: 承認待ちであること。`revision` が `approval.request` の manifest の版と同じで、それ以降に対象が変わっていないこと。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `phase` | 必須 | 現在工程 |
| `revision` | 必須 | 承認する manifest の版（`sha256:<64桁>`） |
| `judgment` | 必須 | `approved`（承認）/ `rejected`（却下） |
| `human` | 必須 | 承認役割の人の回答。`approved` のときは定型の承認の回答 |

- 結果: 承認を追記し、状態は `approved`（却下なら `active`）。次工程への移行は [`workflow.transition`](#workflowtransition) の `advance` で行う。開発工程の承認は Git 操作・マージの許可ではない。
- 主なエラー: 古い版への承認、定型でない回答、承認役割と違う人（すべて `APPROVAL_REQUIRED`）。
- 手動利用で確認すること: `revision` が、示された承認対象の版か。`actor` が承認役割の人か。

### workflow.transition

進行状態や工程を変えます。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `action` | 必須 | 下表のどれか |
| `human` | `pause` / `resume` / `return` で必須 | 人の依頼 |
| `nextPhase` | `return` で必須 | 戻す先の工程（現在または前の工程） |

| action | 使う場面 | 前提・結果 |
| --- | --- | --- |
| `activate` | 作業を始める・阻害が解消した | `draft` / `active` / `blocked` から。期限の来た質問が解決し、前工程の承認が最新なら `active` |
| `pause` | 人が「止めて」と依頼した | 直前の状態を保存して `paused` |
| `resume` | 人が「再開して」と依頼した | `paused` から。前提と質問を再照合して直前の状態に戻す |
| `return` | 人が前の工程へ戻すよう依頼した | 指定した工程を `active` にする。以前の承認は履歴として残る |
| `advance` | 工程承認の後 | 現在工程の承認（タスク分解では追跡表の検査）を確認して次の工程を `active` にする。開発以外では Git のブランチと基点の登録が必要。開発工程では完了条件を確かめて `completed` にする。工程は飛ばせない |

### traceability.validate

`tasks.json` と `traceability.json` の参照を検査します。書き込みはしません。意味の正しさはレビューで確かめます。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `specRoots` | 任意 | ID を集める仕様のパスの配列。省略すると `docs/spec/current` |

- 結果: `result.valid`、`result.findings`（`missing-id`、`missing-file`、`unmapped-requirement`、`unmapped-acceptance` と対象）、`result.semanticReviewRequired: true`。

### verification.run

隔離環境（bubblewrap）で、人が確認済みの検証プロファイルを実行し、自動の証跡を作ります。

- 前提: 開発工程。`verification.run` の許可の `profiles` にプロファイルがあり、プロファイルの読み取り先・生成先が許可の範囲内。`profile.json` のプロファイルが `isolationVerified: true`。
- `expectedRevisions` には `state.json` と、証跡ファイル `docs/spec/changes/<changeId>/verification/<id>.json` の現在版（新規は `null`）を入れる。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `id` | 必須 | 証跡 ID（英数字・`_`・`-`） |
| `profile` | 必須 | 検証プロファイル名 |
| `taskIds` | 必須 | 対象タスク ID の配列 |
| `inputRevisions` | 必須 | 検証する入力ファイルの現在版 `{ パス: 版 }` |
| `method` | 任意 | 検証方法の説明 |
| `tddStage` | 任意 | `red` / `green` / `refactor` / `not-applicable` |

- 結果: 証跡（`mode: automatic`、実際の `command` と `exitCode`）。失敗の分類は `unknown` で、意図した Red かどうかは人が手動の証跡で分類する。隔離できなければ `ENVIRONMENT_UNSUPPORTED` で、隔離なしの再実行はしない。

### verification.record

人の手動検証、またはレビューの結果を証跡として記録します。

- 前提: 窓口だけが使える。`verification.record` の許可があること。`passed` のときは入力の版が現在と一致すること。

| payload.evidence | 必須 | 内容 |
| --- | --- | --- |
| `schemaVersion` | 必須 | `1` |
| `id` | 必須 | 証跡 ID |
| `mode` | 必須 | `manual`（手動検証）/ `review`（レビュー）。`automatic` は不可 |
| `taskIds` | 必須 | 対象タスク ID |
| `inputRevisions` | 必須 | 確認した入力ファイルの版 |
| `environment` | 必須 | 確認した環境 |
| `timestamp` | 必須 | UTC 時刻 |
| `method` | 必須 | 手順 |
| `status` | 必須 | `passed` / `failed` / `not-run` / `unavailable` / `out-of-scope` |
| `result` | 必須 | 観測した結果 |
| `nextAction` | 必須 | 次の作業（なければ空文字） |
| `human` | 必須 | 確認者の回答 |
| `independent`、`reviewer` | `review` で必須 | 独立したレビューか、レビューした者 |
| `tddStage`、`failureKind` | 任意 | TDD の段階、失敗の分類（`behavior` / `environment` / `syntax` / `unknown`） |

`command` と `exitCode` は付けられません（実行していないコマンドを記録しないため）。

### git.inspect

現在のブランチ、HEAD のコミット、変更状況（`git status --short`、秘密はマスク）を読み取ります。書き込みはしません。payload は `{}` です。

- 結果: `{ "branch", "head", "changes" }`。Git がない場合は `unavailable: true`。workspace がリポジトリのルートでなければ `BRANCH_MISMATCH`。

### integration.record

人がマージ等で取り込んだ後に、取り込み先のブランチ・コミットと承認済みの内容が一致することを確かめて記録します。マージそのものはしません。

- 前提: 開発完了（`completed`）で、開発完了の承認があること。`merge` の許可があること。取り込み先のブランチに切り替え、HEAD が取り込みのコミットであること。request の `branch` も取り込み先にする。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `branch` | 必須 | 取り込み先のブランチ |
| `commit` | 必須 | 取り込みのコミット（40〜64桁の16進） |
| `human` | 必須 | 取り込んだ人の回答 |

- 結果: 承認済みの全工程のファイルがコミットの内容と一致すれば記録する。本番反映は記録しない。

### recover

更新が途中で止まったとき（`pending/` が残っているとき）に、調べて直します。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `apply` | 任意 | `false` または省略で調べるだけ。`true` で残りを適用する |
| `human` | `apply: true` で必須 | 人の定型の許可（例: `復旧を許可します`） |

- 使い方: まず `apply: false` で調べ、`result` の各ジャーナルの `remaining`（まだ適用されていないファイル）を確かめる。人の別の変更が見つかった場合は `CONFLICT` で止まるので、消さずに差分を確かめる。問題がなければ人が許可して `apply: true` を実行する。
- 前提: 登録済みのブランチがある案件では、そのブランチで実行すること。

```json
{ "schemaVersion": 1, "operation": "recover", "role": "orchestrator", "changeId": "CHG-0001", "branch": "change/CHG-0001", "expectedRevisions": {}, "payload": { "apply": false } }
```

### doctor

環境と記録の方式を表示します。payload は `{}` で、`node .github/sdd/bin/sddctl.mjs doctor` と同じ結果です。

| 結果の項目 | 内容 |
| --- | --- |
| `node`、`platform`、`harness`、`mode` | 実行環境と profile の設定 |
| `localRuntime` | `available` / `unsupported`（Node.js 24系か） |
| `automaticOperations` | `human-attested-not-independently-verified`（人が確認済みと記録）/ `manual-only` |
| `recording` | 現在の記録の方式: `automatic` / `manual` / `setup-required` |
| `recordingDefault`、`hostChecked`、`executeEnabled` | 既定の方式、ホスト確認の記録、agent の execute の有無 |
| `sandbox` | 隔離検証の状態 |
| `commandPrefix` | 自動記録で使う固定の起動形 |
| `hostVerificationRequired`、`excludedVerification` | 人が確認すべき項目、検証対象外 |

## 対話による記録と遷移

窓口（`sdd-orchestrator`）が人の判断を記録するときの手順です。人は request・操作 ID・期待版・コマンドを扱いません。

1. 判断が必要な対象を示す。承認なら工程、対象一覧、manifest の版（短縮表記）、前工程の版、承認役割。許可なら操作、対象、編集・読み取り・生成先、削除可否。
2. 人の回答を得る。承認・許可は [定型](#人の回答human) だけを記録する。条件付き・疑問・保留・「続けて」・対象を示す前の回答は聞き直す。質問への回答は要旨を示して確かめる。
3. `scratchpad.read` で現在の版を取り、示した版が現在版か照合する。変わっていれば旧版への回答として記録せず、示し直す。
4. request を組み立てて実行し、response の `status` と新しい版を確認する（手動利用では人が実行する）。
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
| 手動利用（`manual`） | 人がその会話で手動を選んだ、または `profile.json` の `recordingDefault` が `manual` | 窓口が1行のコマンドと説明を示し、人が実行する。窓口が結果を読み直して報告する |
| 自動記録（`automatic`） | `mode: managed`、`hostChecks.localHooks` / `failureDenies` が true、窓口と6工程担当の tools に execute がある | 窓口・担当がランナーを同期実行する |
| 確認待ち（`setup-required`） | 上記のどちらでもない（導入直後を含む） | 記録しない。有効化の手順（[README](README.md#2-自動記録を有効にする導入時に1回)）と、手動利用を選べることを示す。読み取り・壁打ち・質問整理・レビューは続けられる |

窓口は会話の開始・再開時と最初の記録の前に、`profile.json` と自分の tools（execute があれば `doctor` も）で方式を確かめ、応答に示します。会話中の手動の選択は状態ファイルへ保存せず、その会話だけに適用します。「自動で進めて」と頼まれれば、確認済みなら自動記録へ戻ります。自動記録中にガードの想定外の拒否や `ENVIRONMENT_UNSUPPORTED` が起きたら、確認待ちとして記録を止めます。人の実行前に記録済み・遷移済みとは表示しません。AI は `profile.json`・agent を変更できず、`setup.mjs` も実行できません。

## 手動利用の確認チェックリスト

窓口が示したコマンドを実行する前に、次を確かめてください。気になる点があれば実行せず、窓口に質問してください。

1. `operation` が、窓口の説明どおりの操作か（[早見表](#操作の早見表)）。
2. `changeId` と `branch` が、作業中の案件・ブランチか。
3. 承認・許可では、`human.actor` が回答した人（承認では登録された承認役割の人）で、`human.answer` が自分の回答の要旨か。
4. 承認では、`approval.record` の `revision` が、示された承認対象の版か。
5. 許可では、`editPaths`・`allowDelete`・`operations` が合意した範囲より広くないか。
6. 文書の更新では、更新先のパスが合意した範囲か。`content` が全文で、残すべき内容が消えていないか。
7. 秘密値・パスワード・token が含まれていないか（含まれていればランナーも拒否します）。
8. 実行後、`status` が `ok` か。`error` なら [エラーと対処](#エラーと対処) を見て、そのまま窓口に伝える。

## ファイルと版

| 保存先 | 内容 |
| --- | --- |
| `docs/spec/current/` | 全体仕様の原本候補（要求・設計。ADR は `design/decisions/`）。既定ブランチへの取り込み・本番反映とは別 |
| `docs/spec/changes/<changeId>/` | 変更記録（`change.md`、工程ごとの差分）、`tasks.json`、`traceability.json`、`verification/`、`decisions/`（ADR 案） |
| `docs/scratchpad/<changeId>/` | `state.json`（状態・質問・決定・承認・許可）、`operations.json`（操作 ID と結果）、`pending/`（更新ごとの復旧情報）、`overview.md`（人向けの概要） |
| `.github/sdd/.lock/` | 更新中だけ作られるロック。Git 管理外 |

- **版（revision）:** ファイルの正確なバイト列の `sha256:<64桁>` です。未作成は `null`。
- **工程の版（manifest）:** 対象ファイルの相対パスと版を並べたものから計算します。フォルダを対象にすると、ファイルの追加・削除も検出します。状態・質問・承認の記録は対象に含めません。
- **パス:** workspace からの相対パス（`/` 区切り）だけです。絶対パス、`..`、`.`、空の要素、symlink、秘密ファイル、`.git/`・`.github/`・`.vscode/` への書き込みは拒否されます。
- **更新の直列化:** 更新は workspace で1つのロックと期待版の照合で直列化します。ファイルごとの置き換えは原子的ですが、複数ファイルの更新全体は原子的ではありません。書き込む前に `pending/` へ復旧情報を保存し、途中の更新が残っている間は次の更新・工程移行を止めます。人の手動編集を排他する仕組みではありません。
- **tasks.json:** `schemaVersion: 1` と `tasks`。タスクは `TASK-0001` 形式で、必須項目は id / title / type（`behavior` / `documentation` / `setup`）/ requirementIds / designIds / acceptanceIds / dependsOn / inputs / assignee / editPaths / verification（method / environment、任意で profile / reviewer / procedure）/ completionCriteria / status（`pending` / `active` / `blocked` / `verified` / `obsolete`）/ evidence / review。`behavior` の検証方法は `tdd`。
- **traceability.json:** `schemaVersion: 1` と `links`。各 link は requirementId / designIds / acceptanceIds / taskIds / testRefs / evidenceRefs。testRefs / evidenceRefs は相対パスと任意の `#識別子`。
