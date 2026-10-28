# 仕様・成果物・状態ファイル設計

入力: [仕様管理要件](../requirements/specification-management.md)。工程: [ワークフロー設計](workflow-orchestration.md)。

## DES-SPEC-001 配置

```text
docs/
  spec/
    current/                      # 原本（変更ブランチで直接更新する）
      requirements/               # 機能ごとの要件・共通要件
      design/                     # 外部設計・内部設計
        decisions/                # 採用済みの ADR（ADR-0001-<題>.md）
    changes/<変更ID>/             # 変更記録
      status.md                   # 状態ファイル（必須）
      tasks.md                    # タスク一覧（実装の工程から）
      idea.md                     # 壁打ちの結果（必要な場合）
      outline.md                  # 軽量の設計の要点
      note.md                     # 作業メモ（必要な場合。DES-WF-005）
      decisions/                  # ADR 案（推奨・任意）
```

- 原本の変更は Git の差分で追う。変更記録に原本の写しや差分の複製を作らない。
- 変更 ID は `CHG-0001` 形式の連番とし、`docs/spec/changes/` の既存の番号と重ならないものを選ぶ。
- 完了した案件の変更記録は、後の変更に合わせて書き換えない。
- 必要な文書だけを作る。空の文書や、すべての章の記入を求めない。

## DES-SPEC-002 成果物の作成規約

| 工程 | 含める項目 | 置き場所 |
| --- | --- | --- |
| 壁打ち | 課題・利用者・価値・候補の比較・採否・範囲・対象外 | `idea.md` |
| 要件 | 目的・シナリオ・機能要件・業務ルール・非機能要件・受入条件と ID | 原本 `requirements/` の機能ごとの文書 |
| 要点（軽量） | 原本の要件の変更（差分）＋設計の要点（変える箇所、方針、テストの方針）を数行 | 原本＋`outline.md` |
| 外部設計 | UI の状態・操作・入力・権限・エラー、帳票、外部連携の契約。不要なら省略の理由1行 | 原本 `design/<機能>.md` の「外部設計」の部 |
| 内部設計 | 業務モデル・構成・データ・処理・エラー・認証認可・共通機能・運用・テスト・技術判断のうち必要なもの | 原本 `design/<機能>.md` の「内部設計」の部 |

- 設計文書は要件の機能文書と同じ単位・同じファイル名とし、外部設計と内部設計を1つの文書の部に分けて書く。
- 要件 ID は `REQ-<機能>-001` 等、設計 ID は `DES-<機能>-001`（`<機能>` は英大文字の略号）とし、設計には対応する要件 ID を書く。既存の ID は変えない。
- 新規の支援先アプリでは、DDD の5層（プレゼンテーション・コントローラー・アプリケーション・ドメイン・インフラストラクチャ）を標準とし、ドメインを他の層や DB・Web フレームワークに依存させない。既存の構成では、適用する範囲と例外を人と合意して書く。
- テンプレートは各スキルの `templates/` にあり、新しい文書を作るときだけ読む。既存の文書は今の章立てに合わせて差分で直す。

## DES-SPEC-003 状態ファイル（status.md）

案件の状態は `docs/spec/changes/<変更ID>/status.md` 1枚に書く。人が読み書きでき、検査スクリプトが形式を確かめる。テンプレートは `sdd-change-intake/templates/status.md`。

```markdown
---
id: CHG-0001
title: 問い合わせ一覧の初期表示
kind: enhancement
size: light
phase: outline
state: active
approvers: 宮下
branch: change/CHG-0001
---

# CHG-0001 問い合わせ一覧の初期表示

## 目的と範囲

- 目的: …
- 対象: …
- 対象外: …

## 質問

| ID | 質問 | 選択肢・推奨 | 期限 | 状態 | 回答 |
| --- | --- | --- | --- | --- | --- |
| Q-1 | 完了済みを含める操作は何にするか | 切り替えボタン（推奨）/ 検索条件 | outline | open | |

## 承認

| 工程 | 日時 | 承認者 | 対象 |
| --- | --- | --- | --- |

## 次の作業

- …
```

| 項目 | 値 |
| --- | --- |
| `id` | `CHG-` と4桁以上の数字。フォルダ名と同じ |
| `kind` | `new` / `enhancement` / `fix` |
| `size` | `standard` / `light` |
| `phase` | 標準: `ideation` / `requirements` / `design` / `implementation` / `done`。軽量: `outline` / `implementation` / `done` |
| `state` | `active` / `waiting-approval` / `blocked` / `paused` / `done` |
| `approvers` | 承認者の名前。複数なら `、` か `,` で区切る |
| `branch` | 案件のブランチ。未作成なら空 |
| 質問の `期限` | 工程の値（`completion` も可） |
| 質問の `状態` | `open`（未解決）/ `resolved`（回答を成果物へ反映済み） |
| 承認の `工程` | 標準: `requirements` / `design` / `completion`。軽量: `outline` / `completion` |
| 承認の `対象` | 承認したパス（フォルダ可）を `,` で区切る。`status.md` 自身は含めない |

- 期限が現在の工程まで来ている `open` の質問は、その工程の承認を止める。
- 承認の記録は表の行とコミット（DES-WF-004）の両方に残る。本人認証や改ざん防止の仕組みではない。
- 秘密の値は書かない。

## DES-SPEC-004 タスク一覧（tasks.md）

`docs/spec/changes/<変更ID>/tasks.md` に表で書く。テンプレートは `sdd-task-planning/templates/tasks.md`。

```markdown
| ID | 内容 | 要件・受入条件 | 設計 | 確認方法 | 状態 | 結果 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-1 | 一覧の初期表示を未完了だけにする。範囲: src/inquiry/list/ | REQ-INQ-003、AC-INQ-005 | DES-INQ-004 | TDD（npm test） | done | npm test 成功（a1b2c3d） |
```

- `状態` は `todo` / `doing` / `done` / `blocked` / `dropped`。
- `結果` には、自動のテストなら実行したコマンドと結果の要点とコミットを、手動の確認なら手順と観測した結果を書く。未実施は「未実施」と書く。
- レビューの指摘への対応もタスクとして追加する。

## DES-SPEC-005 設計判断記録（ADR）

- 後から変えにくい判断（構成・境界・データ方式・依存ライブラリなど）を ADR として残すことを推奨する。必須ではない。
- 案件中は `docs/spec/changes/<変更ID>/decisions/ADR-TMP-01-<題>.md` に案として書き、設計の承認の対象に含める。
- 設計の承認後、窓口が `docs/spec/current/design/decisions/ADR-0001-<題>.md` へ正式な番号で移し、状態を Accepted にする。移したものは書き換えず、変えるときは新しい ADR で置き換える。
- テンプレートは `sdd-ddd-internal-design/templates/adr.md`。

## 要件との対応

| 要件 | 設計 |
| --- | --- |
| REQ-SPEC-001 | DES-SPEC-002（`idea.md`）。 |
| REQ-SPEC-002 | DES-SPEC-002。 |
| REQ-SPEC-003 | DES-SPEC-001、DES-SPEC-002。 |
| REQ-SPEC-004 | DES-SPEC-002。 |
| REQ-SPEC-005 | DES-SPEC-002。 |
| REQ-SPEC-006 | DES-SPEC-002。 |
| REQ-SPEC-007 | DES-SPEC-005。 |
| REQ-SPEC-008 | DES-SPEC-001。 |
| REQ-SPEC-009 | DES-WF-003（`sdd-change-impact-analysis`）、DES-SPEC-003（理由の記録）。 |
| REQ-SPEC-010 | DES-TOOL-003。 |
| NFR-SPEC-001 | DES-SPEC-001。 |
| NFR-SPEC-002 | DES-SPEC-001、DES-SPEC-002。 |
