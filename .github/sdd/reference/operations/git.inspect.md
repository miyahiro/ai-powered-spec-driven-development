# git.inspect

現在のブランチ、HEAD のコミット、変更状況（`git status --short`、秘密はマスク）を読み取ります。書き込みはしません。payload は `{}` です。

共通の項目（`schemaVersion`・`role`・`changeId`・`branch` など）は [request の共通項目](../request.md#request-の共通項目) を参照。この操作の `expectedRevisions` は `{}` でよい。

- 結果: `{ "branch", "head", "changes" }`。Git がない場合は `unavailable: true`。workspace がリポジトリのルートでなければ `BRANCH_MISMATCH`。
