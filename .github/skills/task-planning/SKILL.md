---
name: task-planning
description: "承認済み内部設計と変更影響・整合性指摘から依存順タスク、編集範囲、完了条件、検証計画、追跡表を作りたいときに使う。"
user-invocable: true
---

# タスク分解と検証計画

入力: 現在版の承認済み設計、要件・受入条件、影響分析、整合性指摘、許可範囲。[JSON Schema と操作](../../sdd/README.md) を読む。

1. 内部設計までの承認・入力版を確認する。新しい要求や必須の設計不足があれば差し戻し案を返す。
2. `tasks.json` に `schemaVersion: 1` と `tasks` を置く。タスクは `TASK-0001` 形式。必須項目は id / title / type / requirementIds / designIds / acceptanceIds / dependsOn / inputs / assignee / editPaths / verification / completionCriteria / status / evidence / review。
3. type は behavior / documentation / setup。新規は pending、証跡・レビューは空配列。循環・不明な依存を作らず、各タスクを局所的に実装・検証できる大きさにする。inputs は入力パスと正確な SHA-256。
4. behavior は verification.method を tdd にする。その他は適切な文書・型・構築の確認。environment、必要な profile または手動 procedure、期待する結果、独立レビューを計画する。未確認環境を利用可能としない。
5. `traceability.json` に schemaVersion と links を置く。各 link の requirementId / designIds / acceptanceIds / taskIds / testRefs / evidenceRefs を原本へ対応付ける。全受入条件に検証方法・環境・期待結果を割り当てる。
6. 必須の整合性指摘を解消し、窓口へ成果物案または確認済み新版を返す。タスク分解に新しい人の承認工程を追加しない。タスク完了を担当が確定しない。

停止: 要件・設計・検証判断不足、新要件が必要、版不一致、競合、必須指摘未解消。

出力: タスク・依存順・編集範囲、追跡表、受入条件ごとの検証計画、未検証環境、質問、入力版、新版または案、次操作。