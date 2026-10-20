# コマンド

## 場面別のコマンド

コマンドはすべて workspace のルートで実行します。

| 場面 | 実行する人 | コマンド |
| --- | --- | --- |
| 導入直後に依存を入れる | 導入する人 | `npm ci --prefix .github/sdd --ignore-scripts --no-audit --no-fund` |
| 配布物と設定を検査する | 導入する人 | `npm test --prefix .github/sdd` |
| 環境と記録の方式を確かめる | 導入・管理する人 | `node .github/sdd/bin/sddctl.mjs doctor` |
| 自動記録の状態を見る | 導入・管理する人 | `node .github/sdd/bin/setup.mjs status` |
| ホストの確認後、自動記録を有効にする（導入時に1回） | 導入する人 | `node .github/sdd/bin/setup.mjs enable --confirm-host-checks --note "<確認した環境>"` |
| VS Code・Copilot・設定を更新したので確認し直す | 管理する人 | `node .github/sdd/bin/setup.mjs disable` → 再確認 → `enable` |
| workspace の既定を手動利用にする／戻す | 管理する人 | `node .github/sdd/bin/setup.mjs default manual` ／ `default automatic` |
| 手動利用で、窓口が示した操作を実行する | 手動利用を選んだ人 | `node .github/sdd/bin/sddctl.mjs '<1行のJSON>'`（窓口が示したものをそのまま） |
| 自分で書いた request ファイルを実行する | 管理する人 | `node .github/sdd/bin/sddctl.mjs "$(node .github/sdd/bin/sddctl.mjs encode request.json)"` |
| 途中で止まった更新を調べる・直す | 管理する人 | [`recover`](operations/recover.md) を `apply: false` → 許可して `apply: true` |
| 更新ロックが残っている | 管理する人 | 実行中の操作がないことを確かめてから `rmdir .github/sdd/.lock` |

`setup.mjs` は人だけが実行できます。エージェントからの起動はガードが拒否します。

## コマンドの形

### sddctl.mjs

```sh
node .github/sdd/bin/sddctl.mjs doctor
node .github/sdd/bin/sddctl.mjs encode <request.json>
node .github/sdd/bin/sddctl.mjs '<1行のJSON>'
node .github/sdd/bin/sddctl.mjs <JSONのbase64url>
```

| 形 | 用途 |
| --- | --- |
| `doctor` | 環境・記録の方式・固定の起動形（`commandPrefix`）を表示する。`{"operation":"doctor"}` の request と同じ結果 |
| `encode <file>` | JSON ファイルを base64url に変換して表示する。実行はしない |
| `'<1行のJSON>'` | request を実行する。単一引用符で囲み、JSON 内の改行は `\n`、単一引用符は `\u0027` で書く。生の `'`・改行・制御文字を含めると拒否される |
| `<base64url>` | request を実行する。長い request を人が手で扱うときに使う |

引数は1つだけです。追加の引数、`;`、リダイレクト、改行を付けると拒否されます。失敗すると終了コード 1 で、response の `status` は `error` になります。

自動記録では、エージェントは `doctor` が返す `commandPrefix`（実体の Node と runner のパス）の直後に上記のどちらかの request だけを続けます。これ以外の起動はガードが拒否します。

### setup.mjs

| コマンド | 内容 |
| --- | --- |
| `status` | `recording`（`automatic` / `manual` / `setup-required`）、`recordingDefault`、`hostChecked`、`executeEnabled` を表示する |
| `enable --confirm-host-checks [--note <text>]` | ホストの確認を終えた人が実行する。`profile.json` を `mode: managed`、`hostChecks` の2項目を true にし、確認日時とメモを記録する。窓口と6工程担当の `tools` に `execute` を追加する（reviewer には追加しない） |
| `disable` | `mode: read-only` に戻し、`hostChecks` を false、`execute` を外す |
| `default automatic` / `default manual` | workspace の既定の記録方式を変える |

出力は `{ "status": "ok", "changed": [変更したファイル], "result": { status と同じ内容 } }` です。
