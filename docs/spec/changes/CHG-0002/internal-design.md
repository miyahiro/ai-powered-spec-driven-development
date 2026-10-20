# 内部設計の変更（CHG-0002）

状態: 内部設計ドラフト（案。工程承認済みではない）。
入力・出所: [requirements.md](requirements.md)、[external-design.md](external-design.md)、基点の設計書（コミット `4146b36` の [docs/spec/current/design/](../../current/design/README.md)）、[ランナー利用方法](../../../../.github/sdd/README.md)。

## 変更した設計

| 文書 | 設計 ID | 種別 | 内容 |
| --- | --- | --- | --- |
| README.md | DES-COM-003 | 変更 | 回答を対話で取得し DES-COM-008 で記録 |
| README.md | DES-COM-008 | 追加 | 対話による状態遷移の全体方針。全体図に人の回答から記録・遷移への流れを追加 |
| workflow-orchestration.md | DES-WF-001 | 変更 | 工程承認の記録に続けて窓口が `advance` を自動で呼ぶ。pause・resume・return は対話で確認した依頼を人の回答として記録 |
| workflow-orchestration.md | DES-WF-003 | 変更 | `workflow-status` の出力に記録の方式と自動記録の一覧を追加 |
| workflow-orchestration.md | DES-WF-005 | 追加 | 窓口が request を組み立てて実行・確認する手順、`human` の記録項目、エラー・結果不明時の扱い、追記による訂正 |
| tool-integration.md | DES-TOOL-002、DES-TOOL-006 | 変更 | 対話の回答の記録内容の参照、手順 5 を自動記録の利用へ |
| tool-integration.md | DES-TOOL-007 | 追加 | 自動記録と手動利用の判定条件（`mode`・`hostChecks`・execute・`doctor`）、切り替え、人による有効化 |
| specification-management.md | DES-SPEC-004 | 変更 | 承認の記録順を対話での提示・取得と、前提を満たした移行まで |
| development-verification.md | DES-DEV-005 | 変更 | AC-WF-011〜016、AC-TOOL-011 の確認方法を追加 |
| tool-integration.md | DES-TOOL-003、DES-TOOL-007 | 変更 | request の引数に単一引用符で囲んだ1行の JSON を追加。`profile.json` を読み取り範囲に含め、方式の判定に使う（宮下さんの 2026-10-20 の確認回答） |

ランナーの操作契約・状態の形式は変更しない。新しい書き込み経路は作らない。ガードとランナーは request 引数の形を1つ追加する。

## 判断根拠

- 既存ランナーを再利用する理由: 期待版・操作 ID・復旧・形式検証を保てる（idea.md の候補 1）。状態ファイルの直接編集案（候補 2）はこれらを失うため採用しない。
- 承認後の `advance` を自動にする理由: REQ-WF-013。承認と移行の操作は分けたまま、呼び出しだけを窓口が続けて行う。移行の前提検査はランナーが従来どおり行う。

## 未確定事項

| 事項 | 扱い | 確認期限の工程 |
| --- | --- | --- |
| idea.md の質問 4: 管理下の経路の具体形（実際のツール ID・呼び出し方式） | ホストでの実測後に確定する。現行の候補は DES-TOOL-003 のまま | 内部設計の承認前 |
| 誤った記録の取り消し専用操作の要否 | 既存の `return` と新しい記録で訂正し、不足があれば実機運用で確認する | 開発 |

## 影響

宮下さんの依頼（2026-10-20）により、`.github/` 配下（共通 instructions、窓口と工程担当の agent、受付・質問・工程引き継ぎ・状況確認・再開の skill、`bin/guard.mjs`・`bin/sddctl.mjs`・`lib/runtime.mjs`・テスト・`profile.json` の readRoots、`README.md`・`user_guide.md`）とルートの README.md を本設計へ合わせて更新した。agent の `tools` は変えず、execute は人が有効化の確認後に追加する。制御設定の変更のため、人の差分確認が必要。

## 追加の変更（2026-10-20、手動利用を希望者だけに）

| 文書 | 設計 ID | 内容 |
| --- | --- | --- |
| README.md | DES-COM-008 | 自動記録を既定、導入時1回の確認と有効化、確認前は停止、手動は人の選択時だけ |
| tool-integration.md | DES-TOOL-001、DES-TOOL-003、DES-TOOL-006、DES-TOOL-007 | `profile.json` の `recordingDefault`、`doctor` の `recording`（`automatic` / `manual` / `setup-required`）、人が実行する `bin/setup.mjs`（status / enable / disable / default） |
| workflow-orchestration.md | DES-WF-001、DES-WF-005 | 記録の方式に確認待ちを追加し、手動利用は人の選択時だけ |
| development-verification.md | DES-DEV-005 | AC-WF-015、AC-TOOL-011 の確認方法 |

実装: `lib/setup.mjs`・`bin/setup.mjs` を追加し、`doctor` に記録の方式を加えた。`profile.json` に `recordingDefault: automatic` を追加。配布設定のテストは、profile の確認状況と agent の execute の有無が一致するかを検査する形に変えた。agent・skill・共通 instructions・README・user_guide を合わせて更新した。

判断根拠: execute を確認前の配布設定に含めない。hook が動かない環境で execute があると AI のコマンド実行を拒否できないため。代わりに有効化を1コマンドにして、人の手間を導入時の1回に限った。`setup.mjs` は `sddctl` の固定の起動形と異なるためガードが拒否し、AI は実行できない。

## 追加の変更（2026-10-20、ドキュメントの整理）

| 文書 | 設計 ID | 内容 |
| --- | --- | --- |
| tool-integration.md | DES-TOOL-001、DES-TOOL-006 | `.github/sdd/` の文書を、導入・管理ガイド（README.md）、ユーザーガイド（user_guide.md）、コマンドと操作のリファレンス（reference.md）に分ける。リファレンスを `readRoots` に含める |
| development-verification.md | DES-DEV-005 | AC-COM-009 の確認方法 |

実装: reference.md を新規作成した（場面別のコマンド、request の共通項目、human、response、エラー、18操作の説明、対話による記録の手順、手動利用のチェックリスト、ファイルと版）。README.md と user_guide.md は作業の順に書き直した。agent・skill からの仕様の参照先を reference.md に変えた。`npm test` に、全操作の記載と文書内リンクのアンカーの検査を追加した。
