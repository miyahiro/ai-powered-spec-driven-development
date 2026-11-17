---
id: CHG-0007
title: sdd を使った開発を案内するガイド機能を加える
kind: new
size: standard
phase: done
state: done
approvers: 宮下 洋
branch: change/CHG-0007
---

# CHG-0007 sdd を使った開発を案内するガイド機能を加える

## 目的と範囲

- 目的: sdd のエージェントとスキルで開発する利用者が、次に何をすればよいか・使い方・全体の流れで迷わないようにする
- 対象: スキル `sdd-guide`（使い方の回答、次の作業の案内、初めての人の伴走、工程に沿わない依頼での工程の説明）と窓口の依頼表、関係するガイドの記載
- 対象外: ガイドによる編集と工程の実行、ユーザーガイドの内容の写し、練習用の案件、ガイド専用のエージェント

## 質問

| ID | 質問 | 選択肢・推奨 | 期限 | 状態 | 回答 |
| --- | --- | --- | --- | --- | --- |
| Q-1 | 初めての人の伴走を、会話の中だけにするか、`status.md` に記録して続けるか | `status.md` に記録（推奨）/ 会話の中だけ | requirements | resolved | `status.md` に記録し、会話や担当が変わっても続ける |
| Q-2 | 窓口がガイドを提案する「迷っていそう」の条件 | 案件がない・依頼が依頼表に当てはまらないときだけ（推奨）/ それ以外も含める | requirements | resolved | 窓口が工程に沿わない依頼（壁打ち・要件をしていないのに「開発して」など）を受けたら、すぐには作業せず、sdd の工程の流れと今どこから始めるべきかを説明し、正しい工程から始めることを勧める |
| Q-3 | ユーザーガイドに答えがない質問の扱い | 導入・管理ガイドと共通ルールまで見て、なければ分からないと伝える（推奨）/ すぐ分からないと伝える | requirements | resolved | まずユーザーガイドだけを見て、答えがなければ分からないと伝える。さらに詳しく見て答えるよう頼まれたら、関係する文書まで見て答える |
| Q-4 | 整合のため、編集範囲外の設計文書（specification-management.md の DES-SPEC-003、tool-integration.md の DES-TOOL-003 とスキル数、development-verification.md の DES-DEV-004）も設計の工程で直すか | 設計の工程で直し同じ承認に含める（推奨）/ 実装の工程で直す | design | resolved | 設計の工程で直し、設計の承認に含める |
| Q-5 | 検査スクリプトで status.md の `guide` を検査し要約に出すか | 検査して要約に出す（推奨）/ スクリプトは変えず窓口が status.md を読む | design | resolved | 検査して要約に出す |
| Q-6 | ユーザーガイドに依頼の例がない区切り（受付の後・壁打ちの合意の後・完了）をどうするか（深掘り） | 実装でユーザーガイドに足す（推奨）/ 足さない | design | resolved | ユーザーガイドが区切りごとの依頼の例を持つ（DES-WF-007 配置と参照）。今ない例は実装で足す |
| Q-7 | 今のブランチに案件がないときの工程の説明で、進行中の案件を示すか（深掘り） | 候補も示す（推奨）/ 受付だけ案内 | design | resolved | 候補も示す（DES-WF-007 工程に沿わない依頼） |
| Q-8 | 案件がないときの手引きの後の受付で、`guide: on` を入れる役割（深掘り） | 受付スキルに1文足す（推奨）/ 窓口に任せる | design | resolved | 受付が `guide: on` を入れる（DES-WF-007 受付での伴走の開始） |
| Q-9 | 軽量の案件で前の工程の承認がない依頼も同じ扱いにするか（深掘り） | 同じ扱い（推奨）/ 標準だけ | design | resolved | 同じ扱い（DES-WF-007 工程に沿わない依頼） |
| Q-10 | marketplace.json（0.6.1）と plugin.json・package.json（0.6.0）の版の不一致をどうするか（実装） | この案件で 0.7.0 に揃える（推奨）/ 0.6.1 に揃える / 別の案件で直す | implementation | resolved | この案件で 0.7.0 に揃える（README の導入例のタグも合わせる） |
| Q-11 | sdd-spec-check/SKILL.md の要約の項目に「手引き」を足すか（実装） | 足す（推奨）/ 足さない | implementation | resolved | 足す |
| Q-12 | 進行中の案件の status.md が案件のブランチにしかなく、別のブランチから候補として示せない（TASK-8 の3回目、AC-WF-016） | この案件で設計を直し承認し直す（推奨）/ 制約として残す | design | resolved | この案件で設計を直し、設計を承認し直してから実装する |

## 承認

| 工程 | 日時 | 承認者 | 対象 |
| --- | --- | --- | --- |
| requirements | 2026-11-17 | 宮下 洋 | docs/spec/current/requirements/workflow-orchestration.md, docs/spec/current/requirements/README.md, docs/spec/changes/CHG-0007/idea.md |
| design | 2026-11-17 | 宮下 洋 | docs/spec/current/design/workflow-orchestration.md, docs/spec/current/design/README.md, docs/spec/current/design/specification-management.md, docs/spec/current/design/tool-integration.md, docs/spec/current/design/development-verification.md |
| design | 2026-11-17 | 宮下 洋 | docs/spec/current/design/workflow-orchestration.md, docs/spec/current/design/tool-integration.md, docs/spec/current/design/development-verification.md |
| completion | 2026-11-17 | 宮下 洋 | plugins/sdd/skills/sdd-guide/SKILL.md, plugins/sdd/com.github.copilot/agents/sdd-orchestrator.agent.md, plugins/sdd/skills/sdd-change-intake/SKILL.md, plugins/sdd/skills/sdd-spec-check/SKILL.md, plugins/sdd/skills/sdd-spec-check/scripts/check.mjs, plugins/sdd/skills/sdd-workflow-status/SKILL.md, plugins/sdd/user_guide.md, plugins/sdd/README.md, plugins/sdd/plugin.json, package.json, .github/plugin/marketplace.json, test/check.test.mjs, test/customization.test.mjs, test/repository-edition.test.mjs, docs/spec/changes/CHG-0007/tasks.md |

## 次の作業

- 人が行う: change/CHG-0007 の push、main への PR とマージ、配布する版のタグ v0.7.0 の付与と push
- 未確認の試行（tasks.md の TASK-8 の判定）は、必要なら別の案件で確かめる
