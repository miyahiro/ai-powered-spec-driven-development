---
name: sdd-requirements-definition
description: "要件定義（機能別の要件・業務ルール・非機能要件・受入条件）を作るとき、軽量の案件で要件と設計の要点をまとめるときに使う。"
user-invocable: true
---

# 要件定義と要点

入力: 変更 ID、`status.md` の目的と範囲（標準では `idea.md` も）、既存の原本。

## 標準（phase: requirements）

1. `idea.md` の「提供する機能の概要」（ない場合は `status.md` の範囲）から、今回の機能ごとに影響する原本の文書を探し、関係する節だけを読む。新しい機能なら `docs/spec/current/requirements/<機能>.md` を作る（作るときだけ [テンプレート](templates/feature-requirements.md) を読む）。
2. 利用者・目的、シナリオ、機能要件、業務ルール、非機能要件、受入条件を書く。ID は `REQ-<機能>-001`・`NFR-<機能>-001`・`AC-<機能>-001` 形式で、既存の ID は変えない。各要件を受入条件の「対象」に入れる。機能の概要の各行を1つ以上の機能要件に具体化し、将来の候補・未採用案・未決事項を確定した要件にしない。`idea.md` の未解決質問は引き継いで扱う。
3. 必要な数値・権限・失敗時の動きを推測しない。決まらないことは質問にする。
4. 既存の文書は差分で直す。[sdd-spec-check](../sdd-spec-check/SKILL.md)（変更 ID 付き）でエラーがないことを確かめ、[sdd-phase-approval](../sdd-phase-approval/SKILL.md) で承認を求める。

## 軽量（phase: outline）

1. 変える原本の要件を、関係する節だけ読んで差分で直す（受入条件も）。仕様を変えない修正なら、その理由を `status.md` に書く。
2. 設計の要点を `docs/spec/changes/<ID>/outline.md` に数行で書く（作るときだけ [テンプレート](templates/outline.md) を読む）。
3. 検査スクリプトでエラーがないことを確かめ、原本の変更と `outline.md` をまとめて承認を求める。

停止: 必要な業務判断・範囲・受入の基準が決まらない。

出力: 追加・変更した要件と受入条件の ID、変更したファイル、質問、次の作業。
