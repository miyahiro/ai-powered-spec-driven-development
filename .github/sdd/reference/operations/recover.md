# recover

更新が途中で止まったとき（`pending/` が残っているとき）に、調べて直します。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。この操作の `expectedRevisions` は `{}` でよい。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `apply` | 任意 | `false` または省略で調べるだけ。`true` で残りを適用する |
| `human` | `apply: true` で必須 | 人の定型の許可（例: `復旧を許可します`） |

- 使い方: まず `apply: false` で調べ、`result` の各ジャーナルの `remaining`（まだ適用されていないファイル）を確かめる。人の別の変更が見つかった場合は `CONFLICT` で止まるので、消さずに差分を確かめる。問題がなければ人が許可して `apply: true` を実行する。
- 前提: 登録済みのブランチがある案件では、そのブランチで実行すること。

```json
{ "schemaVersion": 1, "operation": "recover", "role": "orchestrator", "changeId": "CHG-0001", "branch": "change/CHG-0001", "expectedRevisions": {}, "payload": { "apply": false } }
```
