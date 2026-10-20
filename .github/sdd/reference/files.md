# ファイルと版

| 保存先 | 内容 |
| --- | --- |
| `docs/spec/current/` | 全体仕様の原本候補（要求・設計。ADR は `design/decisions/`）。既定ブランチへの取り込み・本番反映とは別 |
| `docs/spec/changes/<changeId>/` | 変更記録（`change.md`、工程ごとの差分）、`tasks.json`、`traceability.json`、`verification/`、`decisions/`（ADR 案） |
| `docs/scratchpad/<changeId>/` | `state.json`（状態・質問・決定・承認・許可）、`operations.json`（操作 ID と結果）、`pending/`（更新ごとの復旧情報）、`overview.md`（人向けの概要）、`status.json`（ランナーが書き出す状況の要約。[workflow.status](operations/workflow.status.md)） |
| `.github/sdd/.lock/` | 更新中だけ作られるロック。Git 管理外 |

- **版（revision）:** ファイルの正確なバイト列の `sha256:<64桁>` です。未作成は `null`。
- **工程の版（manifest）:** 対象ファイルの相対パスと版を並べたものから計算します。フォルダを対象にすると、ファイルの追加・削除も検出します。状態・質問・承認の記録は対象に含めません。
- **パス:** workspace からの相対パス（`/` 区切り）だけです。絶対パス、`..`、`.`、空の要素、symlink、秘密ファイル、`.git/`・`.github/`・`.vscode/` への書き込みは拒否されます。
- **更新の直列化:** 更新は workspace で1つのロックと期待版の照合で直列化します。ファイルごとの置き換えは原子的ですが、複数ファイルの更新全体は原子的ではありません。書き込む前に `pending/` へ復旧情報を保存し、途中の更新が残っている間は次の更新・工程移行を止めます。人の手動編集を排他する仕組みではありません。
- **tasks.json:** `schemaVersion: 1` と `tasks`。タスクは `TASK-0001` 形式で、必須項目は id / title / type（`behavior` / `documentation` / `setup`）/ requirementIds / designIds / acceptanceIds / dependsOn / inputs / assignee / editPaths / verification（method / environment、任意で profile / reviewer / procedure）/ completionCriteria / status（`pending` / `active` / `blocked` / `verified` / `obsolete`）/ evidence / review。`behavior` の検証方法は `tdd`。
- **traceability.json:** `schemaVersion: 1` と `links`。各 link は requirementId / designIds / acceptanceIds / taskIds / testRefs / evidenceRefs。testRefs / evidenceRefs は相対パスと任意の `#識別子`。
