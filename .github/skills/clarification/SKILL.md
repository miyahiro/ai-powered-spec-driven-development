---
name: clarification
description: "未解決の前提、選択肢、設計上の疑問、人の回答を整理するときに使う。現在必要な質問と後工程の質問を分け、期限・影響・反映先を記録する。"
user-invocable: true
---

# 質問と回答

入力: 疑問、対象案件・工程、根拠資料と対象版。質問整理に前工程承認は不要。使う操作は [`question.open`](../../sdd/reference/operations/question.open.md)、[`question.record_answer`](../../sdd/reference/operations/question.record_answer.md)、[`decision.record`](../../sdd/reference/operations/decision.record.md)。

1. 既存の質問・回答・判断を読み、重複を避ける。今決めないと何ができないかを特定する。
2. 質問文、選択肢、推奨と理由、回答による影響、確認期限の工程を短く示す。答えがなくてもできる作業を分ける。
3. 窓口が [対話による記録](../../sdd/reference/dialogue.md) に従い `question.open` を操作 ID 付きで記録し、質問 ID と阻害の有無を示して回答を求める。担当は質問案だけを返す。現在不要な後工程質問で壁打ちを止めない。
4. 人の回答は要旨を示して確かめ、要旨・回答者・時刻・出所（対話）を窓口が `question.record_answer` で記録して報告する。人にコマンドを求めない。回答が曖昧なら補足確認し、承認・許可へ転用しない。
5. 要件・設計・タスクへの反映案と影響する承認を確認する。実際に反映済みの資料だけを `reflectedIn` に記録して resolved にする。回答保存だけなら answered のまま。
6. 判断は根拠・関連質問・参照を `decision.record` へ、文書変更は許可された `document.update` へ分ける。必須質問が解消したら窓口が状態を再照合し、阻害中なら人の指示を待たずに `workflow.transition` の `activate` で作業へ戻す。

停止: 回答が曖昧、対象版が不明、必要な範囲変更・再承認の扱いが未確定。秘密値・資格情報は質問ツールへ入力させない。

出力: 質問と推奨、影響・期限、人の回答出所、記録した内容と新版（手動利用なら人が実行するコマンド）、反映案または確認済み反映先、残る質問、次操作。