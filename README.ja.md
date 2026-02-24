# llm-advisor-mcp

[![npm version](https://img.shields.io/npm/v/llm-advisor-mcp)](https://www.npmjs.com/package/llm-advisor-mcp)
[![npm downloads](https://img.shields.io/npm/dm/llm-advisor-mcp)](https://www.npmjs.com/package/llm-advisor-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](README.md) | **日本語**

**AIアシスタントにLLM/VLMの最新データを与えるMCPサーバー。**

LLMには知識カットオフがある。「今一番いいコーディングモデルは？」と聞いても、最新データでは答えられない。このMCPがリアルタイムの価格・ベンチマーク・性能データを直接提供することで、その問題を解決する。

**APIキー不要。無料。オープンソース。**

```
あなた: 「コーディングに最適なモデルは？」
Claude: [llm-advisor-mcp から最新データを取得]
       → 「SWE-benchスコアと価格を考慮すると、現時点では...」
```

### 既存MCPとの違い

| 特徴 | llm-advisor-mcp | 一般的なMCP |
|------|-----------------|-------------|
| トークン消費 | ~300トークン（Markdownテーブル） | ~3,000トークン（生JSON） |
| ベンチマーク | 5ソース統合（SWE-bench, Arena Elo, VLM, Aider） | 単一ソース |
| レコメンド | ユースケース+予算+要件→Top3 | なし |
| モデル比較 | 2-5モデル横並び、最優値ハイライト | なし |
| セットアップ | ゼロ設定（APIキー不要） | APIキー必要な場合あり |

---

## ユースケース

- **「今一番いいコーディングモデルは？」** — `list_top_models` でカテゴリ `coding` を指定
- **「Claude vs GPT vs Gemini を比較して」** — `compare_models` で横並び比較
- **「1Mコンテキストで安いモデルを探して」** — `recommend_model` で予算制約付き推薦
- **「このモデルのベンチマークは？」** — `get_model_info` でパーセンタイルランク付き詳細取得

---

## インストール

### Claude Code

```bash
claude mcp add llm-advisor -- npx -y llm-advisor-mcp
```

### Claude Code (Windows)

```bash
claude mcp add llm-advisor -- cmd /c npx -y llm-advisor-mcp
```

### Claude Desktop / Cursor / Windsurf

MCP設定ファイルに以下を追加する:

```json
{
  "mcpServers": {
    "llm-advisor": {
      "command": "npx",
      "args": ["-y", "llm-advisor-mcp"]
    }
  }
}
```

30秒で完了。追加後すぐに使える。

### 対応クライアント

| クライアント | 対応 | インストール方法 |
|-------------|------|-----------------|
| Claude Code | Yes | `claude mcp add` |
| Claude Desktop | Yes | JSON設定 |
| Cursor | Yes | JSON設定 |
| Windsurf | Yes | JSON設定 |
| その他MCPクライアント | Yes | stdio transport |

---

## ツール一覧

### 1. `get_model_info` — モデル詳細情報

特定モデルの価格・ベンチマーク・パーセンタイルランク・機能・APIコード例を取得する。

**パラメータ:**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `model` | string | Yes | モデルIDまたは部分名（例: `"claude-sonnet-4.6"`, `"gpt-5.2"`） |
| `include_api_example` | boolean | No | APIコード例を含める（デフォルト: true） |
| `api_format` | string | No | `openai_sdk` / `curl` / `python_requests`（デフォルト: `openai_sdk`） |

**出力例:**

```
## anthropic/claude-opus-4.6

**Provider**: anthropic | **Modality**: text+image→text | **Released**: 2026-01-27

### Pricing
| Metric | Value |
|--------|-------|
| Input | $5.00 /1M tok |
| Output | $25.00 /1M tok |
| Cache Read | $0.50 /1M tok |
| Context | 1M |
| Max Output | 128K |

### Benchmarks
| Benchmark | Score |
|-----------|-------|
| SWE-bench Verified | 75.6% |
| Aider Polyglot | 82.0% |
| Arena Elo | 1504 |
| MMMU | 78.3% |

### Percentile Ranks
| Category | Percentile |
|----------|------------|
| Coding | P97 |
| General | P98 |
| Vision | P92 |

**Capabilities**: Tools, Reasoning, Vision
```

---

### 2. `list_top_models` — カテゴリ別ランキング

指定カテゴリのトップモデルをランキング表示する。リリース日・価格・コンテキスト長を一覧で確認できる。

**パラメータ:**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `category` | string | Yes | `coding` / `math` / `vision` / `general` / `cost-effective` / `open-source` / `speed` / `context-window` / `reasoning` |
| `limit` | number | No | 表示件数 1-20（デフォルト: 10） |
| `min_context` | number | No | 最小コンテキストウィンドウ（トークン数） |
| `min_release_date` | string | No | 最小リリース日（`YYYY-MM-DD`）。古いモデルを除外する |

**出力例:**

```
## Top 5: coding

| # | Model | Key Score | Input $/1M | Output $/1M | Context | Released |
|------|------|------|------|------|------|------|
| 1 | anthropic/claude-opus-4.5 | SWE 79.2% | $5.00 | $25.00 | 200K | 2026-01-10 |
| 2 | google/gemini-3-pro-preview | SWE 77.4% | $2.00 | $12.00 | 1M | 2026-01-22 |
| 3 | anthropic/claude-sonnet-4 | SWE 76.8% | $3.00 | $15.00 | 1M | 2025-10-15 |
| 4 | openai/o3 | SWE 75.8% | $10.00 | $40.00 | 200K | 2025-12-04 |
| 5 | anthropic/claude-opus-4.6 | SWE 75.6% | $5.00 | $25.00 | 1M | 2026-01-27 |

**Data freshness**: 2026-02-25T10:30:00Z (5min ago)
```

---

### 3. `compare_models` — モデル横並び比較

2-5モデルを横並びで比較する。ベンチマーク・価格・機能の最優値を**太字**でハイライトする。

**パラメータ:**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `models` | string[] | Yes | 2-5個のモデルIDまたは部分名 |

**出力例:**

```
## Model Comparison (3 models)

| | **anthropic/claude-opus-4.6** | **openai/gpt-5.2** | **google/gemini-3-pro** |
|------|------|------|------|
| Input $/1M | $5.00 | $2.00 | **$1.25** |
| Output $/1M | $25.00 | $8.00 | **$5.00** |
| Context | **1M** | 128K | **1M** |
| Max Output | **128K** | 64K | 65K |
| SWE-bench | 75.6% | 72.3% | **77.4%** |
| Arena Elo | **1504** | 1480 | 1500 |
| Vision | Yes | Yes | Yes |
| Tools | Yes | Yes | Yes |
| Reasoning | Yes | No | Yes |
| Open Source | No | No | No |
| Released | 2026-01-27 | 2025-11-18 | 2026-01-22 |

**Data freshness**: 2026-02-25T10:30:00Z (5min ago)
```

---

### 4. `recommend_model` — パーソナライズドレコメンド

ユースケース・予算・要件からTop3モデルを推薦する。スコアリングはベンチマーク加重+価格+機能ボーナス+鮮度ボーナス（3ヶ月以内+3, 6ヶ月以内+1）で算出される。

**パラメータ:**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `use_case` | string | Yes | `coding` / `math` / `general` / `vision` / `creative` / `reasoning` / `cost-effective` |
| `max_input_price` | number | No | 入力価格上限（USD/1Mトークン） |
| `max_output_price` | number | No | 出力価格上限（USD/1Mトークン） |
| `min_context` | number | No | 最小コンテキストウィンドウ（トークン数） |
| `require_vision` | boolean | No | 画像入力対応を必須にする |
| `require_tools` | boolean | No | ツール呼び出し対応を必須にする |
| `require_open_source` | boolean | No | オープンソースライセンスを必須にする |
| `min_release_date` | string | No | 最小リリース日（`YYYY-MM-DD`） |

**出力例:**

```
## Recommended for: coding

### 1. anthropic/claude-sonnet-4.6 (score: 78)
Input: $3.00/1M | Output: $15.00/1M | Context: 1M | Released: 2026-01-27
Benchmarks: SWE-bench: 72.1%, Aider: 79.5%, Arena: 1467
Strengths: reasoning, tools, vision, 1M+ context

### 2. google/gemini-3-flash (score: 74)
Input: $0.50/1M | Output: $3.00/1M | Context: 1M | Released: 2026-02-01
Benchmarks: SWE-bench: 75.8%, Arena: 1473
Strengths: tools, vision, 1M+ context

### 3. openai/gpt-5.1-mini (score: 71)
Input: $0.30/1M | Output: $1.20/1M | Context: 128K | Released: 2025-12-10
Benchmarks: SWE-bench: 68.2%, Arena: 1445
Strengths: tools, vision

**Data freshness**: 2026-02-25T10:30:00Z (5min ago)
```

---

## データソース

全データはリアルタイムで取得される。認証不要、全て無料のパブリックAPIを使用する。

| ソース | データ内容 | モデル数 | 認証 |
|--------|-----------|---------|------|
| [OpenRouter](https://openrouter.ai/api/v1/models) | 価格、コンテキスト長、モダリティ、リリース日 | 336+ | 不要 |
| [SWE-bench](https://github.com/SWE-bench/swe-bench.github.io) | コーディングベンチマーク（Verified leaderboard） | 40+ | 不要 |
| [LM Arena](https://arena.ai) | 人間選好Eloレーティング | 314+ | 不要 |
| [OpenCompass VLM](https://opencompass.org.cn) | ビジョンベンチマーク（MMMU, MMBench, OCRBench, AI2D, MathVista） | 284+ | 不要 |
| [Aider Polyglot](https://aider.chat/docs/leaderboards/) | 多言語コーディングパスレート | 63+ | 不要 |

---

## コンテキストコスト

MCPツールの応答はLLMのコンテキストウィンドウを消費する。llm-advisor-mcpはMarkdownテーブル出力によりトークン消費を最小化している。

| 項目 | トークン数 |
|------|-----------|
| ツール定義（4ツール合計） | ~1,000 |
| `get_model_info` 応答 | ~300 |
| `list_top_models` 応答 | ~250 |
| `compare_models` 応答 | ~400 |
| `recommend_model` 応答 | ~350 |

参考: 生JSONで同等データを返す場合は~3,000トークン消費する。約10倍の差がある。

---

## アーキテクチャ

```
┌─────────────────────────────────────────────┐
│              MCP Client (Claude等)           │
└──────────────────┬──────────────────────────┘
                   │ MCP Protocol (stdio)
┌──────────────────▼──────────────────────────┐
│            llm-advisor-mcp                   │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Tools                                 │  │
│  │  get_model_info | list_top_models      │  │
│  │  compare_models | recommend_model      │  │
│  └────────────┬───────────────────────────┘  │
│               │                              │
│  ┌────────────▼───────────────────────────┐  │
│  │  Model Registry                        │  │
│  │  - クロスソース名前正規化              │  │
│  │  - 5カテゴリ パーセンタイル計算         │  │
│  │  - インメモリキャッシュ                │  │
│  │    (価格: 1時間TTL / ベンチマーク: 6時間)│  │
│  └────────────┬───────────────────────────┘  │
│               │                              │
│  ┌────────────▼───────────────────────────┐  │
│  │  Data Sources (5 fetchers)             │  │
│  │  OpenRouter | SWE-bench | LM Arena     │  │
│  │  OpenCompass VLM | Aider Polyglot      │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

- **TypeScript / ESM** — 単一エントリポイント
- **ランタイム依存**: `@modelcontextprotocol/sdk` + `zod` のみ
- **キャッシュ戦略**: 価格データは1時間、ベンチマークは6時間のTTLでインメモリキャッシュ
- **名前正規化**: 異なるソース間のモデルID不一致（`claude-3-5-sonnet` vs `claude-3.5-sonnet`等）を自動解決
- **スコアリング**: ユースケース別ベンチマーク加重 + 価格逆比例スコア + 機能ボーナス + 鮮度ボーナス

---

## ロードマップ

| バージョン | 内容 |
|-----------|------|
| v0.1 | `get_model_info` + `list_top_models`（OpenRouterのみ） |
| v0.2 | `compare_models` + `recommend_model` + SWE-bench + Arena Elo統合 |
| v0.3 | VLMベンチマーク（MMMU, MMBench, OCRBench, AI2D, MathVista）+ Aider Polyglot + パーセンタイルランク + 43テスト |
| **v0.4**（現在）| リリース日の表示・フィルタ・鮮度スコアリング + 51テスト |
| v1.0 | コミュニティ貢献、GitHub Actionsによる週次静的データ更新 |

---

## 開発

### 前提条件

- Node.js >= 18

### セットアップ

```bash
git clone https://github.com/Daichi-Kudo/llm-advisor-mcp.git
cd llm-advisor-mcp
npm install
```

### ビルド・テスト

```bash
npm run build          # TypeScriptコンパイル（tsup）
npm run dev            # 開発用サーバー起動（tsx）
npm test               # テスト実行（vitest, 51テスト）
npm run test:watch     # テストウォッチモード
```

### 貢献方法

1. リポジトリをforkする
2. フィーチャーブランチを作成する（`git checkout -b feature/new-benchmark`）
3. テストを追加する
4. PRを送る

新しいベンチマークソースの追加は特に歓迎する。`src/data/` にfetcherを追加し、`src/data/registry.ts` で統合する。

---

## ライセンス

[MIT](LICENSE) - Cognisant LLC
