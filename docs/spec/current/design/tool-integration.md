# Copilot 接続・更新・実行制御設計

状態: 設計ドラフト（実装結果を反映済み）。入力: [ツール要求](../requirements/tool-integration.md)、[共通要求](../requirements/common.md)。保存形式: [状態設計](specification-management.md)。

## DES-TOOL-001 環境と構成

初期対象を Linux 上の VS Code Local セッションとする。Remote Development では拡張ホスト側の Linux を実行環境とする。Agent Host・Copilot CLI・cloud・他モデル提供者の harness は同じ設定で対応したとは扱わない。

| 項目 | 設計での選択・確認状況 |
| --- | --- |
| OS | Ubuntu 24.04 系を初期の動作確認対象とする。他 OS の実行アダプターは追加しない |
| VS Code | 1.141.0 を初期の環境候補とする。2026-10-13 に現在環境で `code --version` の表示を確認した。機能の動作確認は未実施 |
| Copilot | Local の Chat、custom agents、agent skills、agent-scoped hooks が利用可能な構成を対象とする。Copilot の版は導入時に実際の情報を記録して固定する。現在の拡張一覧から独立した Copilot Chat の版は特定できておらず、未確認とする |
| Node.js | 24系 LTS。現在環境の v24.21.0 を初期候補とし、補助機能は Node.js ESM で実装する |
| Git | 現在環境の 2.55.0 を初期候補とする。読み取りと人による書き込みを分ける |
| 構造化データ検証 | JSON Schema Draft 2020-12 と Ajv 8.17.1（`yaml` 2.8.1 は設定検査用）を採用し、`package-lock.json` で固定する。Node.js は `>=24 <25` を `engines` で要求する |
| プロセス隔離 | Linux の bubblewrap を検証用の候補とする。必要な namespace とファイル・ネットワーク制限が実際に有効か機能確認する。インストールや実行試験は今回は行わない |
| モデル | 選択中のモデルを利用し、特定モデルへ固定しない |
| Spec Kit / MCP / GitHub 拡張 | 必須にしない。専用 MCP は初期構成に追加せず、MCP 連携は検証対象外 |

番号だけで互換性を推定せず、`doctor` で設定の発見、tools 制限、Local hook の拒否、runner 起動、形式検査、検証用隔離を確認する。未対応版・未確認の機能は自動操作を有効にしない。実装時に実測した組合せを互換表へ追記する。本設計は上表を検証済みの互換表とは呼ばない。

配布の主な設定数は、共通 instructions 1、agent 8、SKILL.md 15、runtime profile 1 とする。hook は reviewer を除く7 agent の frontmatter に各1つの `PreToolUse`（`node .github/sdd/bin/guard.mjs <role>`、timeout 10 秒）を宣言し、処理本体を共通化する。配布時の `tools` は read-only で、工程担当は `[read, search]`、窓口は `[read, search, agent, vscode_askQuestions]`、reviewer は `[read, search]` だけとし、reviewer には hook・execute を付けない。`execute` は導入時の確認後に人が `setup.mjs enable` で追加する（DES-TOOL-007）。

```text
.github/
  copilot-instructions.md
  agents/sdd-*.agent.md                 # 8役割
  skills/<name>/SKILL.md                # 15手順
  skills/<name>/templates/              # 必要な工程テンプレート（idea / requirements / external-design / internal-design / adr）
  sdd/
    README.md                          # 導入・管理ガイド（導入 → 有効化 → 運用 → 障害対応）
    user_guide.md                      # 利用者向けガイド（案件の開始 → 工程 → 完了）
    reference/                         # コマンドと操作のリファレンス
      README.md                        #   目次・どのファイルを読むか・操作の早見表
      commands.md, request.md, dialogue.md, manual-checklist.md, files.md
      operations/<操作名>.md            #   操作ごとの入力・例・前提・結果・確認点
    profile.json                       # 環境・ツール対応表・許可プロファイル
    package.json
    package-lock.json
    schemas/                           # runtime.schema.json（状態・タスク・証跡等）、operations.schema.json（操作の payload）
    lib/                               # runtime / store / validation / verification
    bin/sddctl.mjs                      # 管理下の更新・照合・検証runner
    bin/guard.mjs                       # Local PreToolUse の制約確認
    bin/setup.mjs                       # 人が実行する自動記録の有効化・無効化・既定の切り替え
    test/                               # ランナーと配布設定の単体テスト
```

これは実装済みの配置である（`.lock/` は実行時に作られ Git 管理しない）。短い共通 instructions は質問・承認・出所・既存変更の保護を定め、各スキルへの用途別参照を持つ。形式定義を15スキルへ複製しない。専用 UI・VS Code 拡張・更新サーバーは作らない。

## DES-TOOL-002 操作インターフェース

操作能力は MCP ツールではなく `sddctl` の JSON request / response へ対応付ける。Copilot 固有のツール呼び出しを変えてもこの契約を再利用できるようにする。

| 操作 | 入力・結果 | 副作用・前提 |
| --- | --- | --- |
| `change.register` | 変更 ID・種別・役割・Git 情報から登録結果 | 案件状態を作成。Git 未準備は `null`。Git ブランチは作らない |
| `scratchpad.read` | 案件・相対パスから内容と版 | 読み取りだけ。レビューでは既存の読み取りツールも利用可 |
| `workflow.status` | 案件と任意の `recordLimit`（0〜50）から状況の要約 | 読み取りだけ。全役割が使える。工程・状態、期限の来た質問、承認待ちと承認する人、最新の承認ごとに今の manifest を計算した承認の古さ（`staleApprovals`）、途中の更新の件数、タスクの件数と未検証の ID（最大20）、許可の範囲、取り込みの状況、作業中のブランチの一致、記録の方式、次に必要なこと、依頼時の記録の一覧を返す（`basis: live`） |
| `revision.read` | 相対パスの一覧（1〜100件）から各ファイルの版（未作成は `null`） | 読み取りだけ。内容は返さない。全役割が使える。保護対象・workspace 外は `OUT_OF_SCOPE` |
| `scratchpad.update` | 対象・期待版・差分から変更内容と新版 | 許可範囲、ブランチ、更新ロックを確認。通常の差分は操作 ID 不要 |
| `question.open` | 質問・期限・影響・操作 ID から質問 ID | 永続的な二重登録防止 |
| `question.record_answer` | 質問 ID・人の回答・出所・操作 ID | 回答を保存。承認・正式仕様の反映を自動完了しない |
| `decision.record` | 根拠・関連質問・成果物参照・操作 ID | 判断を保存。無根拠の既定値を採用しない |
| `approval.request` | 工程・対象集合・対象版・役割 | 承認待ちと依頼内容を作成。人の承認回答ではない |
| `workflow.transition` | 現在・次工程、期待版、操作 ID | 必須質問・成果物・工程承認・許可を検査して移行 |
| `traceability.validate` | 対象集合・追跡表 | 参照切れ等を返す読み取り検査。意味の適合は人・レビュー担当が判断 |

追加の内部操作は `document.update`、`approval.record`、`permission.record`、`verification.run`、`verification.record`、`git.inspect`、`integration.record`、`recover`、`doctor` とする。`document.update` の `updates` の各要素は、全文 `{path, content}` か差分 `{path, edits}` のどちらかとする。`content: null` は許可済みの削除を表す。差分の `edits` は `[{oldText, newText}]`（1〜100件）で、既存ファイルだけに使える。ランナーは期待版を照合した後、現在の内容に `edits` を上から順に適用し、各 `oldText` がその時点の内容にちょうど1か所だけ存在することを確かめる（0か所・2か所以上は `INVALID_FORMAT` で何も書き込まない）。適用して得た新内容は全文の更新と同じ検査・許可・復旧情報・置換の手順に通す。AI は既存の文書・コードの部分的な変更に差分を使い、全文は新規作成と全面改訂に限る。`scratchpad.update` は同じ形式で当該案件の Scratchpad だけを対象にし、共有 `handoff`（次作業・理由）の更新は窓口だけが行う。文書・コード編集も `document.update` へ通し、組み込みの編集ツールによる版検査の迂回を許可しない。`approval.record` と `permission.record` は人の回答出所を必須とし、回答記録の真正性は運用上の合意として扱う。

request の共通項目は `schemaVersion`（1）, `operation`, `role`, `changeId`, `branch`, `expectedRevisions`, `payload`、登録・承認・許可・移行系には `operationId` とする。全ての変更操作は `state.json` の現在版を `expectedRevisions` に含め、対象文書の現在版（未作成は `null`）も加える。Git 準備前の受付・壁打ちは `branch: null` を認めるが、正式管理中のブランチ不一致は拒否する。操作ごとに JSON Schema と許可された担当を定義し、任意のファイル書き込み・シェル実行を payload の文字列から展開しない。

response は `status`、操作 ID、結果・変更一覧・新版、証跡参照、エラー種別、再開方法を持つ。エラーは `CONFLICT` / `OUT_OF_SCOPE` / `BRANCH_MISMATCH` / `INVALID_FORMAT` / `APPROVAL_REQUIRED` / `PERMISSION_REQUIRED` / `ENVIRONMENT_UNSUPPORTED` / `INCOMPLETE_UPDATE` に区別する。結果不明を成功へ変換しない。

操作は窓口専用（`change.register`、`question.*`、`decision.record`、`approval.*`、`permission.record`、`workflow.transition`、`integration.record`、`recover`）、読み取り（`scratchpad.read`、`traceability.validate`、`git.inspect`、`doctor`）、担当にも許す文書更新・検証に分ける。reviewer は読み取り操作だけである。工程担当は自分の工程が現在工程で、前工程の承認が現行版である場合だけ `docs/` 配下の文書を更新でき、担当と工程は `ideation` / `requirements` / `external-design` / `internal-design` / `task-planner`（タスク分解）/ `implementer`（開発）に固定対応する。実装担当は依存が `verified` か `obsolete` の実行可能タスクの `editPaths` だけを編集でき、窓口は `docs/` 外のコードを編集しない。タスクの `status` は窓口だけが変更する。検証証跡は `verification/` へ `document.update` で直接書けず、`verification.record` / `verification.run` を通す。状態・操作台帳・復旧情報は文書として更新できない。

人の回答（`human`）は actor・answer・source・timestamp（UTC）を必須とし、任意で recordedBy を持つ。対話で得た回答の記録内容は [DES-WF-005](workflow-orchestration.md) に従う。承認は定型の短い肯定、操作許可は定型の短い許可だけ受け付け、自由文から意味を推測しない。回答の出所・要旨は非秘密に限る。

担当別の制約はガードと runner の両方で確認する。工程担当は該当文書だけ、実装担当はタスクのコード・テストだけ、共有状態・回答・承認・許可の記録はオーケストレーターだけとする。role はモデルが自由に選ぶ権限ではなく、agent に固定した hook の role と request が一致する場合だけ受け付ける。

## DES-TOOL-003 Local 操作ガード

必要性は、指示文だけでは任意の terminal・編集・外部操作を拒否できず、管理下の更新を迂回できてしまうことにある。ガードは対象 agent のツール呼び出し直前だけに適用し、会話送信・終了・毎ターンの検査 hook は追加しない。

ガードは Local の stdin JSON の `tool_name`, `tool_input`（`tool_use_id` は判定に使わない）を読み、実際のツール ID・入力形式と `profile.json` の対応表で判定する。`profile.json` は `mode`（`read-only` / `managed`）、`recordingDefault`（`automatic` / `manual`）、`hostChecks`（`localHooks` / `failureDenies`、任意の `confirmedAt` / `note`。人の確認結果の記録）、`readRoots`、ツールごとの `kind`（`read` / `question` / `agent` / `execute`）と `pathKeys` 等、`verificationProfiles` を持つ。初期値は read-only・両確認 false で、ツール ID は候補（`read_file`、`file_search`、`grep_search`、`semantic_search`、`run_in_terminal`、`vscode_askQuestions`、`runSubagent`）であり検証済みではない。別 harness の payload を Local として解釈しない。未知の操作・形式を安全だと推定しない。

| ツール種別 | 判定 |
| --- | --- |
| 既知の読み取り・検索 | `pathKeys` で指定した入力の範囲を `readRoots` と照合し、許可範囲外・正規形でないパス・秘密ファイル・`.git` は拒否。glob は保護ファイルの除外を確認した対応表（`protectedFilesVerified`）だけ、範囲指定できない検索は `workspaceScopeVerified` が確認済みの場合だけ許可 |
| 質問・担当呼び出し | 窓口だけ。担当呼び出しは固定の7担当名（`agentName`）に限る。質問の回答は承認・操作許可と区別 |
| 組み込み編集・外部書き込み・Git 書き込み | 自動呼び出しを拒否。編集は runner、外部操作は人へ案内 |
| Terminal | `doctor` が生成した固定の Node 実行パスと runner パスによる起動形だけ許可。自由な shell、別実行形式、入力注入・別 terminal へのコマンド送信は拒否 |
| ブラウザーや追加ツール | 初期の自動権限には含めない。隔離された検証プロファイルまたは人のテスト環境確認で代替 |

Terminal の request は1引数とし、UTF-8 JSON の base64url、または単一引用符で囲んだ1行の JSON オブジェクト（生の単一引用符・改行・制御文字を含まない。必要なら `\u0027` 等でエスケープ）のどちらかとする。秘密値は含めない。1行の JSON は、モデルが長い request を base64url へ正確に変換できないことによる失敗を避けるために認める。単一引用符の内側はシェルが解釈しないため、引用符を閉じる文字がないことを確認すれば追加の構文は入らない。起動文字列は `doctor` が返す `commandPrefix`（実体の Node パスと runner パスを単一引用符で引用し末尾に空白）にこの引数だけを続けた形で、同期の単発実行に限る（background は拒否）。ガードは request を検証し、`role` が agent の固定 role と一致しなければ拒否する。execute は `mode` が `managed` かつ両確認が true の場合だけ許可し、reviewer には常に許可しない。ガードは一般的なシェル構文解析を実装せず、信頼したパスから生成した起動文字列と引数の形を照合する。runner も同じ2つの形だけを受け付ける。コマンド連結・追加引数・環境変数付与・改行・入出力リダイレクトは受け付けない。runner は JSON を再検証し、子プロセスを `spawn` の引数配列と `shell: false` で実行する。

Local hook の拒否は `hookSpecificOutput.permissionDecision: deny` を返す。入力不正・例外は終了コード `2`（stderr に execute 無効化の案内）の阻害として返し、警告だけで継続する終了コードへ落とさない。入力は 1 MiB 以内とする。想定処理は短い形式・範囲検査だけとし、テストや長い解析は hook 内で実行しない。

hook 未発見・無効化・起動失敗・タイムアウトは、ホストの仕様次第で非阻害となる可能性がある。hook 単体を fail-closed の基盤だと断言しない。初期のツール構成は読み取り専用とし、`doctor` と人の確認で拒否と runner 起動を確認した環境だけ管理下の execute を有効にする。故障時に拒否を保証できない環境では execute を外し、編集・検証を人に依頼する。ホストの Allow All や sandbox 外への自動再試行を利用しない。

`.github/sdd/`、agent・hook・instructions、`.vscode/`、秘密ファイル、Git 設定を通常タスクの編集範囲から除外する。信頼した制御設定の変更は人の差分確認を伴う別操作とする。runner 自体をモデルの変更で迂回できる状態を対応済みにしない。手動操作や別の通常 agent、OS 上の別プロセスまで本ガードが制御するとは主張しない。

## DES-TOOL-004 ファイルと検証の制約

許可範囲は `editPaths` / `readPaths` / `outputPaths` と検証プロファイルへ分ける。ファイルパスは正規化だけでなく `realpath` と親ディレクトリの実体を確認し、symlink による範囲外参照・書き込みを拒否する。新規ファイルは最寄りの既存親を照合する。管理下の書き込み中に親やファイルの実体が変わった疑いがあれば停止する。

更新は状態設計の期待版照合・ロック・ファイル単位の置換・途中更新記録に従う。短時間のロックは workspace に1つとし、複数案件でも同じ共有ファイルを同時に更新しない。ロックは `.github/sdd/.lock/` ディレクトリ（Git 管理外）、復旧情報は Git 管理可能な案件ファイル（`pending/`）とする。ロック残留を時刻だけで自動削除せず、実行中操作がないことを人が確認して解除する。

検証プロファイルは、`executable`、`args`（配列）、`readPaths`、`outputPaths`、`network: none`、`environment`（`PATH` / `HOME` / `LANG` / `NODE_ENV` / `CI` の非秘密値だけ）、`isolationVerified`（人の実測確認）、任意の `timeoutMs`（既定 60 秒）を持つ。作業ディレクトリは worker 内の `/workspace` 固定で、読み取り・生成先は同名のパスへ mount する。対象版は実行時の `inputRevisions` で指定し、実行前後で変化すれば `CONFLICT` とする。`verification.run` は開発工程だけで使え、`verificationProfiles` は初期では空である。合意済みプロファイルの反復実行は再許可を求めない。新しいコマンド・生成先・ネットワーク等は範囲変更として確認する。

テストコードや package scripts は任意の子プロセスを起動し得るため、コマンド名の許可リストだけで範囲外操作を防いだとは扱わない。検証 worker は bubblewrap（`--unshare-all`、`--clearenv`、tmpfs の root）内で、`/usr`・`/bin`・`/lib`・`/lib64` と明示した入力を読み取り専用、合意した生成先だけを書き込み可能にする。実行ファイルは読み取り範囲内に含める。入力に symlink・特殊ファイル・ハードリンク・制御設定が含まれれば停止する。生成先は `docs/spec/` と `docs/scratchpad/` を含められず、入力と重ねない。ホーム・秘密ファイル・Docker socket・Git 書き込み先・制御設定は露出させず、環境変数は必要なものだけ渡す。外部ネットワークは無効、sandbox 外での自動再試行は行わない。

UI/E2E は隔離 worker 内のテスト用サーバーとブラウザーを同じ検証環境で動かすプロファイルとし、実サービスの購入・送信を試さない。loopback、ブラウザー依存、必要な生成先を確認できなければ人のテスト環境確認に切り替え、未実施を成功としない。依存取得や外部テストサービスが必要な場合も人に案内し、本番資格情報を worker へ渡さない。

この制約は endpoint 全体のセキュリティ境界ではない。信頼した toolchain・設定と管理下の経路を前提とし、一般の手動編集を排他したとは扱わない。対応環境での制限が確認できなければ、その自動検証経路だけを無効にする。

## DES-TOOL-005 Git・秘密情報・復旧

Git の自動操作は `git.inspect` の現在ブランチ・HEAD・変更状況（`status --short`、マスク済み）の読み取りへ限定する。許可した引数配列だけを使用し、不要な hooks・外部 diff・pager・fsmonitor 等を起動しない。Git 初期化・コミット・ブランチ作成・push・PR・マージ・本番反映は、対象と操作を示して人の許可を記録し、人の操作を案内する。開発完了承認を Git 許可に変換しない。

マージ前には候補原本・変更記録・実装・テストと取り込み先原本の変更を照合し、必要な再検証と再承認を確認する。人の取り込み後に原本と実装が同じ変更として含まれたこと、実際の取り込み先ブランチ・コミットを確認して `integration.record` に残す。取り込みの確認だけは登録された取り込み先を許可対象にし、変更ブランチ不一致で記録不能にならないよう区別する。`integration.record` は開発完了の承認後に限り、`merge` 操作の許可を必要とする。承認済みの各工程の manifest の全ファイルが、取り込みコミットの内容（`git show`）と一致することを確認する。

出力は生の stdout/stderr 全文を常時保存しない。秘密ファイルの取得を除外し、値の代わりに項目名・設定有無を記録する。既知の秘密値、資格情報フィールド、token 等の形式は出力時・保存前にマスクし、保護対象を含む疑いのある結果は保存しない。未知の秘密を完全検出できるとは主張せず、許可した非秘密の入力だけを worker に渡す。承認回答の出所は会話や文書の識別情報と必要な要旨とし、アクセス token 付き URL を保存しない。

中断・結果不明は `recover` で成果物・期待版・復旧情報・操作 ID を照合する。`apply: false` は調査だけで、`apply: true` は人の許可の回答と元の案件ブランチを必要とする。残りの更新対象が復旧情報の旧版でなければ（人の別変更があれば）停止する。同じ登録操作を再実行する前に適用済みを確認し、部分更新や手動変更が残れば停止する。MCP 固有の障害試験ではなく、ローカル更新の中断として検証する。

## DES-TOOL-006 導入と利用確認

1. 導入先へ共通 instructions、8 agent、15 skill、runtime をコピーする。既存ファイルがあれば差分を確認し、`node_modules`・`.lock/`・別の案件情報はコピーしない。
2. 人が `npm ci --prefix .github/sdd --ignore-scripts --no-audit --no-fund`、`npm test --prefix .github/sdd`、`node .github/sdd/bin/sddctl.mjs doctor` を実行して依存と環境を準備・確認し、ツール対応表を確認する。システム依存の追加が必要なら人に操作を案内する。
3. 読み取り専用の構成から開始し、Local、Workspace Trust、custom agents・skills の発見、hooks の実行、既知の操作の拒否を確認する。
4. `doctor` は Node・OS・harness・mode・実行環境の対応（`localRuntime`: `available` / `unsupported`）、自動操作の状態（`automaticOperations`: `manual-only` / `human-attested-not-independently-verified`）、記録の方式（`recording`: `automatic` / `manual` / `setup-required`、`recordingDefault`、`hostChecked`、`executeEnabled`）、隔離の状態（`sandbox`: `unsupported` / `manual-only` / `unconfirmed`）、固定の `commandPrefix`、ホスト側で確認が必要な項目、検証対象外（並行担当・MCP）を返す。`unconfirmed` は bubblewrap が起動できるだけで、隔離動作の確認済みを意味しない。
5. 3 の確認と [ランナー利用方法](../../../../.github/sdd/README.md) の有効化前の確認を終えたら、人が `node .github/sdd/bin/setup.mjs enable --confirm-host-checks` を1回実行し、対話による自動記録（DES-TOOL-007）を有効にする。確認できない場合は確認待ちのままとし、手動利用を選んで進められる。更新時も差分確認と必要な機能確認だけを行い、ホスト・設定が変わったら `disable` して再確認する。

文書は読む人ごとに分ける。導入・管理する人の手順は `.github/sdd/README.md` に導入から運用・障害対応までの順で、利用者の手順は `.github/sdd/user_guide.md` に案件の開始から完了までの順でまとめる。コマンド・request・response・エラーの説明は `.github/sdd/reference/` にまとめ、トピック別のファイルと操作ごとのファイル（`operations/<操作名>.md`）に分ける。形式の正本である JSON Schema と矛盾させない。エージェントはリファレンス全体を読まず、使う操作のファイルだけを使う直前に読む（DES-COM-009）。通常の利用者は対話だけで進められるようにし、リファレンスは手動利用と管理の作業でだけ読む。`npm test` は、Schema の全操作に操作ごとのファイルと早見表の行があることと、文書内リンクの参照先が実在することを検査する。エージェントもリファレンスを読んで request を組み立てるため、`readRoots` に含める。導入先の既存 instructions は無条件に置換せず、共通ルールの衝突だけを確認する。自動アップデーター、詳細な配布方式比較、複数 OS 用インストーラーは作らない。補助機能を利用できない場合は会話・状況確認・人への案内を継続できるが、利用不可の自動操作を成功したとは表示しない。

## DES-TOOL-007 対話による自動実行と手動利用

DES-WF-005 の自動記録は、既存の `sddctl` と DES-TOOL-003 のガードをそのまま使い、新しい書き込み経路を作らない。状態ファイル・操作台帳・復旧情報を組み込み編集や `document.update` で直接変更しない。

記録の方式は自動記録を既定とし、`profile.json` の `recordingDefault`（`automatic` / `manual`。配布時は `automatic`）で workspace の既定を持つ。実際の方式は次の順に決める。

| 方式（`doctor` の `recording`） | 条件 | 動作 |
| --- | --- | --- |
| 手動利用（`manual`） | 人がその会話で手動を選んだ、または `recordingDefault` が `manual` | 窓口が DES-TOOL-003 と同じ形の1行のコマンドと説明を示し、人が実行する。実行後に結果と版を読み直して報告する |
| 自動記録（`automatic`） | 上記に当たらず、`mode` が `managed`、`hostChecks.localHooks` と `failureDenies` が true、窓口と6工程担当の `tools` に execute がある | 窓口・工程担当が `commandPrefix` と request 引数で runner を同期実行し、response を確認する |
| 確認待ち（`setup-required`） | 上記のいずれにも当たらない（導入直後を含む） | 記録しない。有効化の手順（DES-TOOL-006）と、手動利用を選べることを示す。読み取り・壁打ち・質問整理・レビューは続けられる |

会話中の手動の選択は、その会話だけに適用し、状態ファイルへは保存しない。人が対話で自動記録へ戻すよう頼めば、確認済みの環境なら自動記録に戻る。`recordingDefault` が `manual` の workspace でも、確認済みなら会話で自動記録を選べる。

窓口は会話の開始・再開時と最初の記録の前に、`profile.json`（秘密を含まないため `readRoots` に含める）と自分の tools で方式を判定し、execute がある場合は `doctor` でも確かめて、応答に現在の方式を示す。自動記録中にガードの想定外の拒否や `ENVIRONMENT_UNSUPPORTED` で条件を満たさなくなった場合は、確認待ちとして記録を止め、理由を示す。未実行の操作を成功と表示しない。

有効化・無効化・既定の切り替えは、人が実行する `node .github/sdd/bin/setup.mjs` で行う。

| コマンド | 内容 |
| --- | --- |
| `status` | 現在の `recording`・`recordingDefault`・確認状況・execute の有無を表示 |
| `enable --confirm-host-checks [--note <確認した環境>]` | DES-TOOL-006 の確認を終えた人が実行する。`mode: managed`、`hostChecks` の2項目と確認日時・メモを記録し、窓口と6工程担当の `tools` に execute を追加する。reviewer には追加しない |
| `disable` | `mode: read-only`、`hostChecks` を false に戻し、execute を外す。ホスト・設定の変更後に再確認するまで使う |
| `default automatic` / `default manual` | `recordingDefault` を変更する |

`setup.mjs` は runner とは別のファイルで、ガードは `sddctl` の固定 `commandPrefix` 以外の起動を拒否するため、AI は実行できない。制御設定の編集も編集範囲の除外とガードで拒否する。execute は確認前の配布設定には含めない。hook が動かない環境で execute だけがあると、AI のコマンド実行を拒否できないためである。

`hostChecks` は人の確認結果の記録であり、CLI がホストの拒否を証明した値ではない。この前提は自動記録の方式でも変わらない。

## 要求との対応

| 要求 | 設計 |
| --- | --- |
| REQ-TOOL-001 | DES-TOOL-001、DES-TOOL-002、DES-TOOL-004。既存機能とローカル runner。 |
| REQ-TOOL-002 | DES-TOOL-004、DES-TOOL-005。許可済み反復と Git・外部操作の個別許可。 |
| REQ-TOOL-003 | DES-TOOL-003、DES-TOOL-004。用途別範囲・symlink・branch・worker 制限。 |
| REQ-TOOL-004 | DES-TOOL-002、DES-TOOL-004。期待版・直列化・登録操作の二重適用防止。 |
| REQ-TOOL-005 | DES-TOOL-002。結果・エラー・再開契約。 |
| REQ-TOOL-006 | DES-TOOL-002。工程承認・回答と出所の記録。 |
| REQ-TOOL-007 | DES-TOOL-005。中断照合と MCP 未導入での復旧。 |
| REQ-TOOL-008 | DES-TOOL-005。原本・実装一体の取り込み確認。 |
| REQ-TOOL-010 | DES-TOOL-002、DES-SPEC-005。差分 `edits` の適用と、全文と同じ検査・復旧。 |
| REQ-TOOL-011 | DES-TOOL-002。`revision.read`。 |
| REQ-TOOL-009 | DES-TOOL-003、DES-TOOL-007。管理下の経路だけの自動実行、導入時1回の人による確認と `setup.mjs` での有効化、確認前の停止。 |
| NFR-TOOL-001 | DES-TOOL-003、DES-TOOL-004、DES-TOOL-007。ホスト制限と未対応経路の無効化、手動利用への切り替え。 |
| NFR-COM-007 | DES-TOOL-006。読む人ごとの3文書、操作ごとに分けたリファレンス、網羅性の検査。 |
| NFR-TOOL-002 | DES-TOOL-005。結果・秘密のマスク・ファイルからの復元。 |

## 根拠と実装前の確認

参照日: 2026-10-13。

- [Custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents): roles、tools、agent-scoped hooks。
- [Agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills): workspace の発見と用途別読み込み。
- [Agent hooks](https://code.visualstudio.com/docs/copilot/customization/hooks)、[Local hooks reference](https://code.visualstudio.com/docs/agents/reference/hooks-reference): Local の payload・拒否・終了コードと harness の違い。
- [Agent sandboxing](https://code.visualstudio.com/docs/agents/run/agent-sandboxing): Agent Host の設定は Local と同等とは扱わない。
- [Security](https://code.visualstudio.com/docs/copilot/security): 指示・許可・sandbox の責務と制約。

実装は上記の設計に沿って行い、単体テスト（`npm test`）でランナー・ガード・配布設定の形式を確認した。実機での確認事項は引き続き、利用可能な Copilot 構成の版、Local の実際の tool ID と schema、hook 故障時のホスト動作、Linux 隔離機能である。bubblewrap は version 表示のみ確認し、隔離動作は未確認で自動検証プロファイルは登録していない。設計候補は上記の通りだが、満たせない制約があれば自動経路を無効にし、人へ代替案を提示する。要求や許可範囲を黙って弱めない。