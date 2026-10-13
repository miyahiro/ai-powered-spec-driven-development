# スペック駆動開発アシスタント

8エージェント、15スキル、ローカル状態管理ランナーを他のプロジェクトへ持ち込める構成。初期設定は読み取り専用で、操作ガードや隔離が未確認の環境の自動操作を有効にしない。

開発を進める利用者向けの手順・工程ごとの依頼例・承認と操作許可・中断と再開は [ユーザーガイド](user_guide.md) を参照してください。本 README は導入とランナーの設定・操作契約を説明します。

## 導入と開始

導入先の `.github/copilot-instructions.md`、`.github/agents/`、`.github/skills/`、`.github/sdd/` へ配置する。既存設定がある場合は差分とルールの衝突を確認し、無条件に上書きしない。`node_modules`、ロックディレクトリ、元プロジェクトの案件・Scratchpad は配布しない。

workspace のルートで、人が次を実行する。Node.js 24系が必要。

```sh
npm ci --prefix .github/sdd --ignore-scripts --no-audit --no-fund
npm test --prefix .github/sdd
node .github/sdd/bin/sddctl.mjs doctor
```

VS Code Local で Workspace Trust、custom agents と agent skills が利用できることを確認する。通常は `sdd-orchestrator` を選び「新しい仕組みを考えたい」と依頼する。スキルは `/change-intake`、`/workflow-status` 等で直接指定できる。スキルの発見・実際のツール ID・hook 動作は導入先で確認する。

初期は担当から文書案・差分・JSON 操作案を受け取り、人がランナーを実行する。案を保存済みとは扱わない。読み取りツールが拒否されたら許可範囲と実際の Local 入力を確認し、未知のツールを広く許可する回避をしない。

## 構成

| エージェント | 担当 |
| --- | --- |
| sdd-orchestrator | 受付・状態・回答・承認・許可・引き継ぎの窓口 |
| sdd-ideation | 壁打ちと範囲 |
| sdd-requirements | 機能別要件・非機能・受入条件 |
| sdd-external-design | 利用者・外部システムに見える動作 |
| sdd-internal-design | DDD・構成・データ・処理・運用・検証 |
| sdd-task-planner | 依存順タスク・検証計画・追跡表 |
| sdd-implementer | 指定タスクの実装・TDD・検証 |
| sdd-reviewer | 読み取り専用の独立レビュー |

窓口だけを通常の選択対象とし、必要な担当へ直列に委任する。担当呼び出し不可なら手順は役割切り替えで続けられるが独立確認とは表示しない。独立レビューは別の人の確認でも代替できる。

スキルは受付・状況・再開・質問・引き継ぎ、壁打ち・要求・外部設計・内部設計、影響分析・原本更新・整合性レビュー・タスク分解・TDD・検証とレビューの15種類。[共通ルール](../copilot-instructions.md) と各 SKILL.md の開始条件を守る。

## 保存先と版

| 保存先 | 役割 |
| --- | --- |
| `docs/spec/current/` | 全体仕様の候補原本。既定ブランチへの取り込み・本番反映は別 |
| `docs/spec/changes/CHG-0001/` | change.md、工程差分、tasks.json、traceability.json、verification/ |
| `docs/scratchpad/CHG-0001/` | state.json、operations.json、pending/、人向け overview.md |

案件番号をパスへ使用し、任意のブランチ名をパスにしない。ランナーの書き込みは workspace 相対 POSIX パスだけ。絶対パス、`..`、`.`、空のパス成分、symlink、秘密ファイル、制御設定への書き込みを拒否する。通常タスクは `.git/`、`.github/`、`.vscode/` を変更できない。

ファイルの revision は正確なバイト列の `sha256:<64桁>`。未作成は `null`。工程 manifest は相対パスとファイル hash のソート済み map から計算する。フォルダ roots によりファイル追加・削除も検出する。状態・質問・承認記録は承認対象に含めない。外部設計と内部設計は別の成果物集合を選ぶ。新規プロジェクトでは `design/external/` と `design/internal/` に分けると後工程の追加を前工程の変更と混同しにくい。

短時間の workspace 共通ロックと期待版照合で更新を直列化する。各ファイルの置換は原子的だが複数ファイル全体は原子的ではない。置換前に pending を保存し、途中更新が残る間は新しい更新・工程移行を止める。人の手動編集を排他する仕組みではない。

## 人がランナーを操作する

JSON request を人が確認して準備し、UTF-8 JSON の base64url を1引数に渡す。以下の `request.json` は利用者が準備する入力ファイルの例で、配布する案件データではない。

```sh
node .github/sdd/bin/sddctl.mjs encode request.json
node .github/sdd/bin/sddctl.mjs "$(node .github/sdd/bin/sddctl.mjs encode request.json)"
```

上記の command substitution は人の手動利用専用。エージェントの管理下 execute は `doctor` が返す固定 `commandPrefix` と base64url だけを結合する。一般の shell、追加引数、改行、リダイレクト、別 terminal への入力を許可しない。

初期受付の request 例。役割名は例であり、実際の人と目的・範囲を確認して置き換える。

```json
{
  "schemaVersion": 1,
  "operation": "change.register",
  "operationId": "register-CHG-0001-1",
  "role": "orchestrator",
  "changeId": "CHG-0001",
  "branch": null,
  "expectedRevisions": { "docs/scratchpad/CHG-0001/state.json": null },
  "payload": {
    "kind": "new",
    "purpose": "合意した目的",
    "scope": { "in": ["対象範囲"], "out": ["対象外"] },
    "actors": { "customer": "発注者", "technicalLead": "技術責任者" },
    "git": { "defaultBranch": null, "branch": null, "baseCommit": null }
  }
}
```

Git 未準備の受付・壁打ちは可能。正式管理へ進む前に人が許可済みの Git 準備を行い、同じ案件に実際の branch、defaultBranch、baseCommit を新しい操作 ID で登録する。ランナーは Git 初期化・ブランチ作成をしない。

すべての mutation には state.json の現在版が必要。`scratchpad.read` で状態と版を取得できる。対象を変更する操作は、対象ファイルの現在版または未作成の `null` も expectedRevisions に追加する。

## 操作契約

共通項目は schemaVersion、operation、role、changeId、branch、expectedRevisions、payload。形式定義は [共通 Schema](schemas/runtime.schema.json) と [操作 Schema](schemas/operations.schema.json)。操作 ID が必要な登録・承認・許可・移行は、同じ ID・同じ入力を再送すると永続保存した結果を返す。キー順の違いは同じ入力として扱う。内容を変えるなら新 ID を使う。

| operation | payload と用途 |
| --- | --- |
| change.register | kind / purpose / scope / actors / git。新規受付、または未登録 Git 情報を結び付ける |
| scratchpad.read | 任意の path。省略で state と revision |
| scratchpad.update | updates と任意の handoff。共有 handoff は窓口だけ |
| document.update | updates: [{path, content}]。content: null は許可済み削除 |
| question.open | text / options / recommendation / impact / duePhase |
| question.record_answer | questionId / human、任意の reflectedIn。実際の反映先がなければ answered |
| decision.record | text / rationale / questionIds / references |
| permission.record | permission: operations / editPaths / readPaths / outputPaths / profiles / allowDelete / human、担当用 phase / roles |
| approval.request | roots、任意の disposition。工程の成果物集合と入力版を作成 |
| approval.record | phase / revision / judgment / human |
| workflow.transition | action: activate / pause / resume / return / advance。pause / resume / return は human、return は nextPhase |
| traceability.validate | 任意の specRoots。参照・要求と受入条件の網羅を確認。意味の適合はレビュー |
| verification.run | id / profile / taskIds / inputRevisions、任意の method / tddStage |
| verification.record | evidence。人の手動確認・レビュー結果の記録 |
| git.inspect | 空の payload。ブランチ・HEAD・変更状況だけ |
| integration.record | branch / commit / human。人の取り込み後の一体反映確認 |
| recover | apply: false で調査。apply: true には明示許可の human |
| doctor | 空の payload。直接 CLI の doctor でも利用可能 |

human は actor / answer / source / timestamp（UTC ISO時刻）、任意の recordedBy。会話や確認文書の識別情報と必要な回答要旨だけを保存する。認証・電子署名ではなく、人の回答を運用上合意して記録する。「続けて」、疑問、保留を承認としない。肯定の要旨は「承認します」「この工程を承認します」「工程一式を承認します」、操作許可は「許可します」「この操作を許可します」等の短い定型で記録する。自由文からの意味の推測をせず、曖昧なら人に確認する。

permission 例の要点: operations に `document.update`、editPaths に当該要件文書、phase に `requirements`、roles に `requirements` を含めると担当にその工程・範囲だけを与える。roles / phase がない許可は窓口だけに使用する。reviewer に書き込み許可は付けられない。削除・検証プロファイル・生成先・Git 操作は別の項目として合意する。通常の合意済み反復作業に再許可を要求しない。

response は status、結果・対象新版、operationId、エラーと nextAction を返す。`CONFLICT`、`OUT_OF_SCOPE`、`BRANCH_MISMATCH`、`INVALID_FORMAT`、`APPROVAL_REQUIRED`、`PERMISSION_REQUIRED`、`ENVIRONMENT_UNSUPPORTED`、`INCOMPLETE_UPDATE` を成功へ読み替えない。traceability の status が ok でも result.valid が false なら参照不備が残る。

## 工程と証跡

工程は ideation → requirements → external-design → internal-design → task-planning → development。進行状態とは別。発注者が最初の3工程、技術責任者が内部設計と開発完了を承認する。タスク分解には追加の承認を作らない。変更なし・対象外は disposition に kind / rationale / referenceRevision / human を記録したうえで通常の工程承認を行う。

質問は期限が現在工程までの unresolved だけを阻害とする。回答だけを保存して正式仕様へ反映済みとはしない。阻害を解消したら activate、差し戻しは return、中断は pause、再開は resume を窓口が使う。

tasks.json は schemaVersion と tasks、traceability.json は schemaVersion と links を持つ。ID は `TASK-0001`、`REQ-EXAMPLE-001`、`NFR-EXAMPLE-001`、`AC-EXAMPLE-001`、`DES-EXAMPLE-001` 形式。既存 ID を安定して維持する。testRefs / evidenceRefs は相対パスと任意の `#識別子`。形式検査だけでは意味の適合を保証しない。

証跡は対象タスク、入力ファイルの hash、環境、時刻、方法、観測結果、status、次操作を持つ。管理上の state・operations・証跡自身のように記録操作で変わるファイルを検証入力に含めない。

- automatic: 実際の runner 実行から command / exitCode を作成する。
- manual: 人の手順・観測・回答出所。実行していない command / exitCode を作らない。
- review: 別の担当または人の independent / reviewer と指摘・結果・入力版を記録する。窓口だけが合意した記録を保存する。

TDD の Red / Green は当時の履歴を残し、完了の証明は現在版の Refactor 後検証と独立レビューで行う。自動失敗は unknown とし、意図した振る舞いの Red かを人が観測・分類した手動証跡を別 ID で残す。環境・構文の失敗を Red としない。documentation / setup は適切な検証を選ぶ。必須の未実施・環境不可を成功としない。

窓口が verified を記録する際も証跡を検査する。開発完了には全必須タスクの検証・独立レビュー・受入条件との対応と技術責任者承認が必要。開発完了承認は merge 許可ではない。許可された人の取り込み後に branch / commit と承認対象の正確なバイト列を照合し、integration.record を残す。production は取り込みから推定しない。

## 自動操作を有効にする前に

1. Local で設定の発見、実際の tool ID・入力 schema、役割別 tools と委任制約を確認する。profile.json の tools は候補名であって検証済み対応表ではない。
2. readRoots と pathKeys を実測に合わせる。検索の glob は保護ファイルが取得されないことを確認した mapping にだけ protectedFilesVerified: true を設定する。スコープ指定できない検索は workspaceScopeVerified を実測確認するまで無効。
3. 各 agent の固定役割 hook が未知操作・組み込み編集・自由な terminal・役割詐称を拒否することを確認する。hook 不在・故障・タイムアウト時もホストが阻害できることを人が確認する。拒否を保証できなければ execute を追加しない。
4. 確認結果・VS Code / Copilot の実際の版と日付を導入先で記録し、人が profile の hostChecks.localHooks / failureDenies を true、mode を managed にする。フラグは人の確認結果の記録であり CLI がホストを証明した値ではない。
5. 対応確認済みの7担当の tools だけに execute を追加する。edit / web は追加しない。reviewer は read / search のまま。既存のテストは読み取り専用配布設定を検査するため、この変更後は配布設定用の検査をそのまま運用設定の合否とは扱わない。
6. doctor が返す実体 Node / runner パスと1つの base64url 引数だけを使う。未知のツール、別 harness、ホストの Allow All、別 terminal 入力で迂回しない。設定更新時は必要な機能だけ再確認する。

agent-scoped hook だけでホスト全体を fail-closed にできるとは主張しない。人の手動操作、別の通常 agent、OS 上の別プロセスは制御対象外。本人認証・改ざん防止基盤は実装しない。control 設定の変更は人が別途差分確認する。

## 隔離検証

自動検証は Linux の bubblewrap と人が実測確認したプロファイルだけ。`verificationProfiles` は初期では空。検証 worker の起動試験・namespace 制限確認は今回実施していない。

各 profile の項目: executable（workspace 内の実行可能ファイル）、args（配列）、readPaths、outputPaths、network: none、environment（PATH / HOME / LANG / NODE_ENV / CI の非秘密値だけ）、isolationVerified、任意の timeoutMs。作業ディレクトリは `/workspace` 固定。readPaths と outputPaths は同名の worker 内パスへマウントされる。必要な実行 wrapper と生成先は人が事前に準備する。

toolchain の `/usr`、`/bin`、`/lib`、`/lib64` と明示した入力だけを読み取り専用、生成先だけを書き込み可能にする。ホーム・秘密・Git・制御設定・socket を露出せず、外部ネットワークを無効にする。入力ディレクトリ内に symlink・秘密ファイル・制御設定等がある場合も停止する。依存は必要な非秘密の実体パスを選び、一般の node_modules 全体を安全だと推定しない。

生成先は既存の専用ディレクトリとし、仕様・状態・検証入力を書き込める範囲にしない。コード・依存変更はタスク編集、検証は生成物だけを作る。profile は対象・読み取り・生成先・許可と一緒に確認する。新しい command / mounts / network は範囲変更。隔離失敗の自動再試行・非隔離フォールバックをしない。

UI/E2E は worker 内のテスト用サーバーとブラウザーを同じプロファイルに含める。loopback・依存・生成先を確認できなければ手動検証へ切り替える。実サービスへの購入・送信、本番資格情報を使った検証は行わない。依存取得・システム依存追加は人へ案内する。

## 復旧

pending があれば通常更新を停止し、recover の apply: false で調査する。残るファイルが期待版または適用予定版と一致する場合だけ、人の明示許可で apply: true を行う。人の別変更が見つかれば消さず、差分統合と復旧判断を依頼する。

`.github/sdd/.lock/` が残っている場合は、実行中操作がないことを人が確認してから解除する。ランナーは時刻だけで解除しない。復旧ジャーナルの内容は非秘密の適用予定内容。完了後に内容を除き、版・パスの履歴を残す。

## 確認状況

| 項目 | 状態 |
| --- | --- |
| Ubuntu 24.04 / Node.js v24.21.0 | ローカル runner の単体テスト実行環境 |
| 8 agent / 15 skill | YAML・名前・用途・権限・ローカル参照を自動検査 |
| 状態・工程・期待版・操作 ID・復旧 | ローカルテストで確認。全受入条件の実機検証済みとは扱わない |
| VS Code 1.141.0 / Copilot Local | 設定候補。実際の発見・hook 故障時制御・ツール対応は未確認 |
| bubblewrap 0.9.0 | version 表示のみ。隔離動作未確認、自動プロファイルなし |
| 並行担当 / MCP 連携 | 合意どおり検証対象外 |

`npm test` はローカル機能・否定ケースと設定の形式検査。Copilot の実セッション・隔離 worker・全ワークフローの実機受入試験を代替しない。未確認の自動経路は無効のまま使用する。