# Copilot 接続・更新・実行制御設計

状態: 設計ドラフト。入力: [ツール要求](../requirements/tool-integration.md)、[共通要求](../requirements/common.md)。保存形式: [状態設計](specification-management.md)。

## DES-TOOL-001 環境と構成

初期対象を Linux 上の VS Code Local セッションとする。Remote Development では拡張ホスト側の Linux を実行環境とする。Agent Host・Copilot CLI・cloud・他モデル提供者の harness は同じ設定で対応したとは扱わない。

| 項目 | 設計での選択・確認状況 |
| --- | --- |
| OS | Ubuntu 24.04 系を初期の動作確認対象とする。他 OS の実行アダプターは追加しない |
| VS Code | 1.141.0 を初期の環境候補とする。2026-10-13 に現在環境で `code --version` の表示を確認した。機能の動作確認は未実施 |
| Copilot | Local の Chat、custom agents、agent skills、agent-scoped hooks が利用可能な構成を対象とする。Copilot の版は導入時に実際の情報を記録して固定する。現在の拡張一覧から独立した Copilot Chat の版は特定できておらず、未確認とする |
| Node.js | 24系 LTS。現在環境の v24.21.0 を初期候補とし、補助機能は Node.js ESM で実装する |
| Git | 現在環境の 2.55.0 を初期候補とする。読み取りと人による書き込みを分ける |
| 構造化データ検証 | JSON Schema Draft 2020-12 と Ajv 8系を採用し、実装時の依存 lockfile で版を固定する |
| プロセス隔離 | Linux の bubblewrap を検証用の候補とする。必要な namespace とファイル・ネットワーク制限が実際に有効か機能確認する。インストールや実行試験は今回は行わない |
| モデル | 選択中のモデルを利用し、特定モデルへ固定しない |
| Spec Kit / MCP / GitHub 拡張 | 必須にしない。専用 MCP は初期構成に追加せず、MCP 連携は検証対象外 |

番号だけで互換性を推定せず、`doctor` で設定の発見、tools 制限、Local hook の拒否、runner 起動、形式検査、検証用隔離を確認する。未対応版・未確認の機能は自動操作を有効にしない。実装時に実測した組合せを互換表へ追記する。本設計は上表を検証済みの互換表とは呼ばない。

配布の主な設定数は、共通 instructions 1、agent 8、SKILL.md 15、runtime profile 1 とする。hook は書き込み権限を持つ7 agent の frontmatter に各1つの `PreToolUse` を宣言し、処理本体を共通化する。読み取り専用 reviewer は `read` / `search` だけを持ち、書き込み用 hook・execute は付けない。

```text
.github/
  copilot-instructions.md
  agents/sdd-*.agent.md                 # 8役割
  skills/<name>/SKILL.md                # 15手順
  skills/<name>/assets/                 # 必要な工程テンプレートだけ
  sdd/
    profile.json                       # 環境・ツール対応表・許可プロファイル
    package.json
    package-lock.json
    schemas/                           # 状態・操作・タスク・追跡表のJSON Schema
    bin/sddctl.mjs                      # 管理下の更新・照合・検証runner
    bin/guard.mjs                       # Local PreToolUse の制約確認
```

これは将来の実装配置であり、今回の作成対象ではない。短い共通 instructions は質問・承認・出所・既存変更の保護を定め、各スキルへの用途別参照を持つ。形式定義を15スキルへ複製しない。専用 UI・VS Code 拡張・更新サーバーは作らない。

## DES-TOOL-002 操作インターフェース

操作能力は MCP ツールではなく `sddctl` の JSON request / response へ対応付ける。Copilot 固有のツール呼び出しを変えてもこの契約を再利用できるようにする。

| 操作 | 入力・結果 | 副作用・前提 |
| --- | --- | --- |
| `change.register` | 変更 ID・種別・役割・Git 情報から登録結果 | 案件状態を作成。Git 未準備は `null`。Git ブランチは作らない |
| `scratchpad.read` | 案件・相対パスから内容と版 | 読み取りだけ。status とレビューでは既存の読み取りツールも利用可 |
| `scratchpad.update` | 対象・期待版・差分から変更内容と新版 | 許可範囲、ブランチ、更新ロックを確認。通常の差分は操作 ID 不要 |
| `question.open` | 質問・期限・影響・操作 ID から質問 ID | 永続的な二重登録防止 |
| `question.record_answer` | 質問 ID・人の回答・出所・操作 ID | 回答を保存。承認・正式仕様の反映を自動完了しない |
| `decision.record` | 根拠・関連質問・成果物参照・操作 ID | 判断を保存。無根拠の既定値を採用しない |
| `approval.request` | 工程・対象集合・対象版・役割 | 承認待ちと依頼内容を作成。人の承認回答ではない |
| `workflow.transition` | 現在・次工程、期待版、操作 ID | 必須質問・成果物・工程承認・許可を検査して移行 |
| `traceability.validate` | 対象集合・追跡表 | 参照切れ等を返す読み取り検査。意味の適合は人・レビュー担当が判断 |

追加の内部操作は `document.update`、`approval.record`、`permission.record`、`verification.run`、`verification.record`、`git.inspect`、`integration.record`、`recover`、`doctor` とする。文書・コード編集も `document.update` へ通し、組み込みの編集ツールによる版検査の迂回を許可しない。`approval.record` と `permission.record` は人の回答出所を必須とし、回答記録の真正性は運用上の合意として扱う。

request の共通項目は `schemaVersion`, `operation`, `role`, `changeId`, `branch`, `expectedRevisions`, `payload`、再送する登録操作には `operationId` とする。Git 準備前の受付・壁打ちは `branch: null` を認めるが、正式管理中のブランチ不一致は拒否する。操作ごとに JSON Schema と許可された担当を定義し、任意のファイル書き込み・シェル実行を payload の文字列から展開しない。

response は `status`、操作 ID、結果・変更一覧・新版、証跡参照、エラー種別、再開方法を持つ。エラーは `CONFLICT` / `OUT_OF_SCOPE` / `BRANCH_MISMATCH` / `INVALID_FORMAT` / `APPROVAL_REQUIRED` / `PERMISSION_REQUIRED` / `ENVIRONMENT_UNSUPPORTED` / `INCOMPLETE_UPDATE` に区別する。結果不明を成功へ変換しない。

担当別の制約はガードと runner の両方で確認する。工程担当は該当文書だけ、実装担当はタスクのコード・テストだけ、共有状態・回答・承認・許可の記録はオーケストレーターだけとする。role はモデルが自由に選ぶ権限ではなく、agent に固定した hook の role と request が一致する場合だけ受け付ける。

## DES-TOOL-003 Local 操作ガード

必要性は、指示文だけでは任意の terminal・編集・外部操作を拒否できず、管理下の更新を迂回できてしまうことにある。ガードは対象 agent のツール呼び出し直前だけに適用し、会話送信・終了・毎ターンの検査 hook は追加しない。

ガードは Local の stdin JSON の `tool_name`, `tool_input`, `tool_use_id` を読み、実際のツール ID・入力形式と `profile.json` の対応表で判定する。別 harness の payload を Local として解釈しない。未知の操作・形式を安全だと推定しない。

| ツール種別 | 判定 |
| --- | --- |
| 既知の読み取り・検索 | ホストの workspace 制限と許可された読み取り範囲を使用。許可範囲外・未知のパスの取得は拒否 |
| 質問・担当呼び出し | オーケストレーターの定義済み担当だけ。質問の回答は承認・操作許可と区別 |
| 組み込み編集・外部書き込み・Git 書き込み | 自動呼び出しを拒否。編集は runner、外部操作は人へ案内 |
| Terminal | `doctor` が生成した固定の Node 実行パスと runner パスによる起動形だけ許可。自由な shell、別実行形式、入力注入・別 terminal へのコマンド送信は拒否 |
| ブラウザーや追加ツール | 初期の自動権限には含めない。隔離された検証プロファイルまたは人のテスト環境確認で代替 |

Terminal の request は UTF-8 JSON を base64url で1引数にした形とし、秘密値は含めない。ガードは一般的なシェル構文解析を実装せず、信頼したパスから生成した起動文字列と base64url 引数の形を照合する。コマンド連結・追加引数・環境変数付与・改行・入出力リダイレクトは受け付けない。runner は JSON を再検証し、子プロセスを `spawn` の引数配列と `shell: false` で実行する。

Local hook の拒否は `hookSpecificOutput.permissionDecision: deny` を返す。入力不正・例外は終了コード `2` の阻害として返し、警告だけで継続する終了コードへ落とさない。想定処理は短い形式・範囲検査だけとし、テストや長い解析は hook 内で実行しない。

hook 未発見・無効化・起動失敗・タイムアウトは、ホストの仕様次第で非阻害となる可能性がある。hook 単体を fail-closed の基盤だと断言しない。初期のツール構成は読み取り専用とし、`doctor` と人の確認で拒否と runner 起動を確認した環境だけ管理下の execute を有効にする。故障時に拒否を保証できない環境では execute を外し、編集・検証を人に依頼する。ホストの Allow All や sandbox 外への自動再試行を利用しない。

`.github/sdd/`、agent・hook・instructions、`.vscode/`、秘密ファイル、Git 設定を通常タスクの編集範囲から除外する。信頼した制御設定の変更は人の差分確認を伴う別操作とする。runner 自体をモデルの変更で迂回できる状態を対応済みにしない。手動操作や別の通常 agent、OS 上の別プロセスまで本ガードが制御するとは主張しない。

## DES-TOOL-004 ファイルと検証の制約

許可範囲は `editPaths` / `readPaths` / `outputPaths` と検証プロファイルへ分ける。ファイルパスは正規化だけでなく `realpath` と親ディレクトリの実体を確認し、symlink による範囲外参照・書き込みを拒否する。新規ファイルは最寄りの既存親を照合する。管理下の書き込み中に親やファイルの実体が変わった疑いがあれば停止する。

更新は状態設計の期待版照合・ロック・ファイル単位の置換・途中更新記録に従う。短時間のロックは workspace に1つとし、複数案件でも同じ共有ファイルを同時に更新しない。ロックは一時的なローカルファイル、復旧情報は Git 管理可能な案件ファイルとする。ロック残留を時刻だけで自動削除せず、実行中操作を確認して復旧する。

検証プロファイルは、実行ファイル、引数配列、作業ディレクトリ、読み取り範囲、生成先、必要な非秘密の環境変数、対象版を持つ。合意済みプロファイルの反復実行は再許可を求めない。新しいコマンド・生成先・ネットワーク等は範囲変更として確認する。

テストコードや package scripts は任意の子プロセスを起動し得るため、コマンド名の許可リストだけで範囲外操作を防いだとは扱わない。検証 worker は bubblewrap による mount・network・process namespace 内で、必要な toolchain・ソース・依存を読み取り専用、合意した生成先だけを書き込み可能にする。ホーム・秘密ファイル・Docker socket・Git 書き込み先・制御設定は露出させず、環境変数は必要なものだけ渡す。外部ネットワークは無効、sandbox 外での自動再試行は行わない。

UI/E2E は隔離 worker 内のテスト用サーバーとブラウザーを同じ検証環境で動かすプロファイルとし、実サービスの購入・送信を試さない。loopback、ブラウザー依存、必要な生成先を確認できなければ人のテスト環境確認に切り替え、未実施を成功としない。依存取得や外部テストサービスが必要な場合も人に案内し、本番資格情報を worker へ渡さない。

この制約は endpoint 全体のセキュリティ境界ではない。信頼した toolchain・設定と管理下の経路を前提とし、一般の手動編集を排他したとは扱わない。対応環境での制限が確認できなければ、その自動検証経路だけを無効にする。

## DES-TOOL-005 Git・秘密情報・復旧

Git の自動操作は `git.inspect` の状態・ブランチ・コミット・差分の読み取りへ限定する。許可した引数配列だけを使用し、不要な hooks・外部 diff・pager・fsmonitor 等を起動しない。Git 初期化・コミット・ブランチ作成・push・PR・マージ・本番反映は、対象と操作を示して人の許可を記録し、人の操作を案内する。開発完了承認を Git 許可に変換しない。

マージ前には候補原本・変更記録・実装・テストと取り込み先原本の変更を照合し、必要な再検証と再承認を確認する。人の取り込み後に原本と実装が同じ変更として含まれたこと、実際の取り込み先ブランチ・コミットを確認して `integration.record` に残す。取り込みの確認だけは登録された取り込み先を許可対象にし、変更ブランチ不一致で記録不能にならないよう区別する。

出力は生の stdout/stderr 全文を常時保存しない。秘密ファイルの取得を除外し、値の代わりに項目名・設定有無を記録する。既知の秘密値、資格情報フィールド、token 等の形式は出力時・保存前にマスクし、保護対象を含む疑いのある結果は保存しない。未知の秘密を完全検出できるとは主張せず、許可した非秘密の入力だけを worker に渡す。承認回答の出所は会話や文書の識別情報と必要な要旨とし、アクセス token 付き URL を保存しない。

中断・結果不明は `recover` で成果物・期待版・復旧情報・操作 ID を照合する。同じ登録操作を再実行する前に適用済みを確認し、部分更新や手動変更が残れば停止する。MCP 固有の障害試験ではなく、ローカル更新の中断として検証する。

## DES-TOOL-006 導入と利用確認

1. 導入先へ共通 instructions、8 agent、15 skill、runtime をコピーする。既存ファイルがあれば差分を確認し、別の案件情報はコピーしない。
2. runtime の lockfile に基づいて依存を準備し、環境とツール対応表を確認する。システム依存の追加が必要なら人に操作を案内する。
3. 読み取り専用の構成から開始し、Local、Workspace Trust、custom agents・skills の発見、hooks の実行、既知の操作の拒否を確認する。
4. `doctor` でローカル更新と検証の対応可否を返す。機能ごとに `available` / `manual-only` / `unsupported` と理由を記録する。
5. 対応が確認できた管理下の操作だけを有効にし、合意した案件・範囲内で利用する。更新時も差分確認と必要な機能確認だけを行う。

導入先の既存 instructions は無条件に置換せず、共通ルールの衝突だけを確認する。自動アップデーター、詳細な配布方式比較、複数 OS 用インストーラーは作らない。補助機能を利用できない場合は会話・状況確認・人への案内を継続できるが、利用不可の自動操作を成功したとは表示しない。

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
| NFR-TOOL-001 | DES-TOOL-003、DES-TOOL-004。ホスト制限と未対応経路の無効化。 |
| NFR-TOOL-002 | DES-TOOL-005。結果・秘密のマスク・ファイルからの復元。 |

## 根拠と実装前の確認

参照日: 2026-10-13。

- [Custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents): roles、tools、agent-scoped hooks。
- [Agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills): workspace の発見と用途別読み込み。
- [Agent hooks](https://code.visualstudio.com/docs/copilot/customization/hooks)、[Local hooks reference](https://code.visualstudio.com/docs/agents/reference/hooks-reference): Local の payload・拒否・終了コードと harness の違い。
- [Agent sandboxing](https://code.visualstudio.com/docs/agents/run/agent-sandboxing): Agent Host の設定は Local と同等とは扱わない。
- [Security](https://code.visualstudio.com/docs/copilot/security): 指示・許可・sandbox の責務と制約。

実装前の確認事項は、利用可能な Copilot 構成の版、Local の実際の tool ID と schema、hook 故障時のホスト動作、Linux 隔離機能である。設計候補は上記の通りだが、満たせない制約があれば自動経路を無効にし、人へ代替案を提示する。要求や許可範囲を黙って弱めない。