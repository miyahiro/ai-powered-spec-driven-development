# doctor

環境と記録の方式を表示します。payload は `{}` で、`node .github/sdd/bin/sddctl.mjs doctor` と同じ結果です。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。この操作の `expectedRevisions` は `{}` でよい。

| 結果の項目 | 内容 |
| --- | --- |
| `node`、`platform`、`harness`、`mode` | 実行環境と profile の設定 |
| `localRuntime` | `available` / `unsupported`（Node.js 24系か） |
| `automaticOperations` | `human-attested-not-independently-verified`（人が確認済みと記録）/ `manual-only` |
| `recording` | 現在の記録の方式: `automatic` / `manual` / `setup-required` |
| `recordingDefault`、`hostChecked`、`executeEnabled` | 既定の方式、ホスト確認の記録、agent の execute の有無 |
| `sandbox` | 隔離検証の状態 |
| `commandPrefix` | 自動記録で使う固定の起動形 |
| `hostVerificationRequired`、`excludedVerification` | 人が確認すべき項目、検証対象外 |
