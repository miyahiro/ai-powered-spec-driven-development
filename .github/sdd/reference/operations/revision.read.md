# revision.read

指定したファイルの版（`sha256:<64桁>`、未作成は `null`）だけを返します。内容は返さず、書き込みもしません。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。この操作の `expectedRevisions` は `{}` でよい。

- 使う場面: 担当が返した成果物の版を、窓口が文書を読み直さずに照合するとき。次の request の `expectedRevisions` に入れる文書の版を取るとき。
- 呼べる役割: 全員（reviewer を含む）。

| payload | 必須 | 内容 |
| --- | --- | --- |
| `paths` | 必須 | workspace 相対のパスの配列（1〜100件、重複なし）。制御設定（`.git/`・`.github/`・`.vscode/`）、秘密ファイル、workspace 外、symlink は `OUT_OF_SCOPE` |

```json
{ "schemaVersion": 1, "operation": "revision.read", "role": "orchestrator", "changeId": "CHG-0001", "branch": "change/CHG-0001", "expectedRevisions": {}, "payload": { "paths": ["docs/spec/current/requirements/inquiry.md"] } }
```

- 結果: `result` に `{ パス: 版 }`。
- 照合のしかた: 担当の返却に書かれた版と一致すれば、成果物は返却どおりに保存されている。一致しなければ、担当の報告と実ファイルが食い違っているので、返却を採用せずに差分を確かめる。版の一致は内容が正しいことの確認ではない。内容の確認はレビュー担当と人が行う。
