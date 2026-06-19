# llm-advisor-mcp

[![npm version](https://img.shields.io/npm/v/llm-advisor-mcp)](https://www.npmjs.com/package/llm-advisor-mcp)
[![npm downloads](https://img.shields.io/npm/dm/llm-advisor-mcp)](https://www.npmjs.com/package/llm-advisor-mcp)
[![CI](https://github.com/Daichi-Kudo/llm-advisor-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Daichi-Kudo/llm-advisor-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 20.19](https://img.shields.io/badge/node-%3E%3D20.19-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[![Glama MCP server](https://glama.ai/mcp/servers/Daichi-Kudo/llm-advisor-mcp/badge)](https://glama.ai/mcp/servers/Daichi-Kudo/llm-advisor-mcp)

[English](README.md) | **日本語** | [中文](README.zh.md)

**AIアシスタントにLLM/VLMのリアルタイム知識を与えます。** 価格、ベンチマーク、レコメンドを毎時間更新します（データ鮮度は上流ソースに依存）。学習サイクルを待つ必要はありません。

LLMには知識カットオフがある。Claudeに「今一番いいコーディングモデルは？」と聞いても、最新データでは答えられない。このMCPサーバーは、ライブなモデル情報をAIアシスタントのコンテキストへ直接渡すことで、その問題を解決する。

- **ゼロ設定** — APIキーも登録も不要。1コマンドでインストール。
- **低トークン** — 生JSON（約3,000トークン）ではなく、コンパクトなMarkdownテーブル（約300トークン）。コンテキストウィンドウを節約。
- **7+のライブデータソース** — OpenRouterの価格/メタデータ、SWE-bench、LM Arena Elo、OpenCompass VLM、Aider Polyglot、BFCL V4エージェントベンチマーク、静的スピード/レイテンシデータを統合ビューに集約。

---

## ユースケース

- **「今一番いいコーディングモデルは？」** — `list_top_models` でカテゴリ `coding` を指定
- **「Claude vs GPT vs Gemini を比較して」** — `compare_models` で横並び比較
- **「1Mコンテキストで安いモデルを探して」** — `recommend_model` で予算制約付き推薦
- **「このモデルのベンチマークは？」** — `get_model_info` でパーセンタイルランク付き詳細取得
- **「$2/1M以下のビジョンモデルを探して」** — `search_models` で自然言語検索
- **「Anthropicはどんなモデルがある？」** — `list_providers` でプロバイダ別表示
- **「100Kコールのコストは？」** — `estimate_cost` で月間見積もり

---

## クイックスタート

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

これだけです。APIキーも `.env` ファイルも不要。

### 対応クライアント

| クライアント | 対応 | インストール方法 |
|-------------|------|-----------------|
| Claude Code | Yes | `claude mcp add` |
| Claude Desktop | Yes | JSON設定 |
| Cursor | Yes | JSON設定 |
| Windsurf | Yes | JSON設定 |
| その他MCPクライアント | Yes | stdio transport |

---

## ツール

### `get_model_info`

特定モデルの詳細仕様を取得する: 価格、ベンチマーク、パーセンタイルランク、機能、すぐ使えるAPIコード例、コスト見積もり。

**パラメータ**

| 名前 | 型 | 必須 | デフォルト | 説明 |
|------|------|------|------------|------|
| `model` | string | Yes | — | モデルIDまたは部分名（例: `"claude-sonnet-4"`, `"gpt-5"`） |
| `include_api_example` | boolean | No | `true` | すぐ使えるコード例を含める |
| `api_format` | enum | No | `openai_sdk` | `openai_sdk`、`curl`、`python_requests` のいずれか |
| `include_cost_estimate` | boolean | No | `true` | 一般的な使用パターンのコスト見積もりを含める |

### `list_top_models`

カテゴリ別トップモデルを表示する。鮮度を把握できるようリリース日も含む。`recommend_model` と同じ価格/機能フィルタに対応。

| 名前 | 型 | 必須 | デフォルト | 説明 |
|------|------|------|------------|------|
| `category` | enum | Yes | — | `coding`, `math`, `vision`, `general`, `cost-effective`, `open-source`, `speed`, `context-window`, `reasoning`, `quality` |
| `limit` | number | No | `10` | 表示件数（1-20） |
| `min_context` | number | No | — | 最小コンテキストウィンドウ（トークン数） |
| `min_release_date` | string | No | — | `YYYY-MM-DD`。この日付より前にリリースされたモデルを除外 |
| `max_input_price` | number | No | — | 入力価格上限（USD/1M tokens） |
| `max_output_price` | number | No | — | 出力価格上限（USD/1M tokens） |
| `require_vision` | boolean | No | — | 画像入力対応を必須にする |
| `require_tools` | boolean | No | — | ツール/関数呼び出し対応を必須にする |
| `require_open_source` | boolean | No | — | オープンソースライセンスを必須にする |

### `compare_models`

2〜5個のモデルを横並び比較する。最良値は自動で**太字**表示される。

| 名前 | 型 | 必須 | デフォルト | 説明 |
|------|------|------|------------|------|
| `models` | string[] | Yes | — | 2〜5個のモデルIDまたは部分名 |

### `recommend_model`

パーソナライズされたTop3レコメンドを返す。

| 名前 | 型 | 必須 | デフォルト | 説明 |
|------|------|------|------------|------|
| `use_case` | enum | Yes | — | `coding`, `math`, `general`, `vision`, `creative`, `reasoning`, `cost-effective` |
| `max_input_price` | number | No | — | 入力価格上限（USD/1M tokens） |
| `max_output_price` | number | No | — | 出力価格上限（USD/1M tokens） |
| `min_context` | number | No | — | 最小コンテキストウィンドウ（トークン数） |
| `require_vision` | boolean | No | — | 画像入力対応を必須にする |
| `require_tools` | boolean | No | — | ツール/関数呼び出し対応を必須にする |
| `require_open_source` | boolean | No | — | オープンソースライセンスを必須にする |
| `min_release_date` | string | No | — | `YYYY-MM-DD`。古いモデルを除外 |

### `search_models`

モデル名、プロバイダ、自然言語クエリでモデルを検索。テキスト関連性でランク付けされ、オプションのカテゴリ別タイブレークと価格/機能フィルタ付き。

| 名前 | 型 | 必須 | デフォルト | 説明 |
|------|------|------|------------|------|
| `query` | string | Yes | — | 検索クエリ（例: `"cheap vision model"`, `"claude"`） |
| `category` | enum | No | — | 結果をランク付けするカテゴリ |
| `limit` | number | No | `10` | 表示件数（1-20） |
| フィルタ | various | No | — | `max_input_price`, `max_output_price`, `min_context`, `require_vision`, `require_tools`, `require_open_source` |

### `list_providers`

全LLM/VLMプロバイダをモデル数、価格帯、最安モデルとともに表示。プロバイダ名でフィルタ可能。

| 名前 | 型 | 必須 | デフォルト | 説明 |
|------|------|------|------------|------|
| `provider` | string | No | — | プロバイダ名でフィルタ（例: `"anthropic"`, `"openai"`） |

### `list_model_slugs`

プロバイダ固有のモデル識別子を検索。モデル名を指定すると、OpenRouter IDに加えてBedrock、Groq、Together、Fireworks、DeepInfraなどのスラグを返す。

| 名前 | 型 | 必須 | デフォルト | 説明 |
|------|------|------|------------|------|
| `model` | string | No | — | モデル名でフィルタ（例: `"claude"`, `"gpt"`） |
| `provider` | string | No | — | 対象プロバイダでフィルタ（例: `"bedrock"`, `"groq"`） |

### `estimate_cost`

任意のモデルのAPIコストを見積もる。入出力トークン数と月間コール数を指定して月間予算を計算。

| 名前 | 型 | 必須 | デフォルト | 説明 |
|------|------|------|------------|------|
| `model` | string | Yes | — | モデルIDまたは部分名 |
| `input_tokens` | number | No | `10000` | 1コールあたりの平均入力トークン数 |
| `output_tokens` | number | No | `2000` | 1コールあたりの平均出力トークン数 |
| `monthly_calls` | number | No | — | 月間見積もりAPIコール数 |

### `list_new_models`

最近リリースされたモデルを表示。リリース日でフィルタ可能。

| 名前 | 型 | 必須 | デフォルト | 説明 |
|------|------|------|------------|------|
| `max_age_days` | number | No | `90` | 最大経過日数 |
| `limit` | number | No | `10` | 表示件数 |
| フィルタ | various | No | — | `min_context`, `max_input_price`, `max_output_price` |

---

## データソース

全データは無料のパブリックAPIからリアルタイムに取得される。認証不要。

| ソース | データ内容 | モデル数 | Cache TTL |
|--------|-----------|---------|-----------|
| [OpenRouter](https://openrouter.ai/api/v1/models) | 価格、コンテキスト長、モダリティ、リリース日 | 300+ | 1時間 |
| [SWE-bench](https://github.com/SWE-bench/swe-bench.github.io) | コーディングベンチマーク（Verified leaderboard） | 30+ | 6時間 |
| [LM Arena](https://lmarena.ai) | 人間選好Eloレーティング | 314+ | 6時間 |
| [OpenCompass VLM](https://opencompass.org.cn) | ビジョンベンチマーク: MMMU, MMBench, OCRBench, AI2D, MathVista | 284+ | 6時間 |
| [Aider Polyglot](https://aider.chat/docs/leaderboards/) | 多言語コーディングパスレート | 63+ | 6時間 |
| [BFCL V4](https://gorilla.cs.berkeley.edu/leaderboard.html) | エージェント関数呼び出しベンチマーク | 109+ | 6時間 |
| [静的スピードデータ](https://whatllm.org) | 出力トークン/秒とTime-to-First-Token | 26+ | 24時間 |

---

## 新モデル検出について

新モデルがリリースされたとき、各データソースで異なる速度で反映されます：

| データ | ソース | 自動検出？ | 遅延 |
|--------|--------|-----------|------|
| 価格、コンテキスト、モダリティ、リリース日 | OpenRouter（ライブ） | ✅ はい — OpenRouter APIに存在する全モデルを取得 | ≤1時間 |
| 機能（ツール、視覚、推論） | OpenRouter（ライブ） | ✅ はい — `supported_parameters` から判定 | ≤1時間 |
| SWE-benchスコア | SWE-bench（ライブ） | ✅ はい — ベンチマークがモデルを追加すれば反映 | ≤6時間 |
| Arena Elo | LM Arena（ライブ） | ✅ はい — Arenaがモデルを追加すれば反映 | ≤6時間 |
| VLMベンチマーク | OpenCompass（ライブ） | ✅ はい — OpenCompassがモデルを追加すれば反映 | ≤6時間 |
| Aider Polyglot通過率 | Aider（ライブ） | ✅ はい — Aiderがモデルを追加すれば反映 | ≤6時間 |
| BFCL V4エージェントスコア | BFCL（ライブ） | ✅ はい — BFCLがモデルを追加すれば反映 | ≤6時間 |
| 出力速度（tok/s） | 静的データ + ヒューリスティック推定 | ✅ はい — 40+モデルは実測、**それ以外はすべて**価格とファミリー名から推定 | ≤1時間 |
| Time-to-First-Token | 静的データ + ヒューリスティック推定 | ✅ はい — 同上、全モデルで動作 | ≤1時間 |
| プロバイダスラグ | 静的データ（内蔵） | ❌ いいえ — 30モデルがハードコード済み | 次回リリース |
| プロバイダ別価格比較 | 静的データ（内蔵） | ❌ いいえ — 30モデルがハードコード済み | 次回リリース |

**まとめ：** 新モデルの価格、機能、ベンチマークスコア、**速度推定値**はすべて数時間以内に自動反映されます。プロバイダスラグとプロバイダ別価格比較のみ次回リリースまで遅れる可能性があります。静的データファイルへの貢献はいつでも歓迎します。

---

## コンテキストコスト

| 項目 | トークン数 |
|------|-----------|
| 9つのツール定義すべて | ~2,500 |
| 典型的なツール応答 | ~250-400 |

---

## アーキテクチャ

```
┌──────────────────────────────────────────────┐
│              MCP Client (Claude, etc.)        │
└──────────┬───────────────────────────────────┘
           │ stdio (JSON-RPC)
┌──────────▼───────────────────────────────────┐
│            llm-advisor-mcp server             │
│                                               │
│  ┌─────────┐  ┌───────────┐  ┌────────────┐  │
│  │  Tools   │  │ Registry  │  │   Cache    │  │
│  │ (10 tools)│──│ (unified) │──│ (in-memory)│  │
│  └──────────┘  └────────────┘  └────────────┘  │
│                     │                         │
│        ┌────────────┼────────────┐            │
│        ▼            ▼            ▼            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Normalizer│ │Percentile│ │ Fetchers │      │
│  │(slug map)│ │ (7 cats) │ │(7 sources│      │
│  └──────────┘ └──────────┘ └──────────┘      │
└──────────────────────────────────────────────┘
           │           │           │
     OpenRouter    SWE-bench    Arena / VLM / Aider
                                BFCL / Speed
```

- **TypeScript + ESM** — 単一エントリポイント、`tsup` ビルド
- **インメモリキャッシュ** — TTLベース（価格1時間、ベンチマーク6時間）、stale-while-revalidate
- **クロスソース正規化** — ソース間で揺れるモデル名を正規IDへ対応付け
- **パーセンタイル計算** — 7カテゴリ（coding, math, general, vision, cost efficiency, speed, agentic）で順位付け
- **鮮度スコアリング** — レコメンドアルゴリズムが最近リリースされたモデルへボーナスを付与
- **ランタイム依存は最小限** — `@modelcontextprotocol/sdk` と `zod` のみ

---

## ロードマップ

| バージョン | 状態 | ハイライト |
|-----------|------|------------|
| v0.1 | Done | `get_model_info` + `list_top_models`（OpenRouter） |
| v0.2 | Done | `compare_models` + `recommend_model` + SWE-bench + Arena Elo |
| v0.3 | Done | VLMベンチマーク + Aider Polyglot + パーセンタイルランク + 43テスト |
| v0.4 | Done | リリース日フィルタ、鮮度スコアリング、複合ベンチマークスコア + 126テスト |
| v0.5 | **Current** | `search_models`, `list_providers`, `estimate_cost`, `list_new_models`, `list_model_slugs`、BFCL V4、スピードデータ、品質指数 + **9ツール、7データソース** |
| v1.0 | Planned | コミュニティ貢献、週次データスナップショット |

---

## 開発

```bash
git clone https://github.com/Daichi-Kudo/llm-advisor-mcp.git
cd llm-advisor-mcp
npm install
npm run build
npm run dev         # tsxで実行（ホットリロード）
npm test            # 126個のユニットテストを実行
```

### プロジェクト構成

```
src/
  index.ts              # サーバーエントリポイント
  types.ts              # 型定義
  tools/                # 9つのツール
    model-info.ts       # get_model_info
    list-top.ts         # list_top_models
    compare.ts          # compare_models
    recommend.ts        # recommend_model
    search.ts           # search_models
    providers.ts        # list_providers
    estimate.ts         # estimate_cost
    new-models.ts       # list_new_models
    slugs.ts            # list_model_slugs
    formatters.ts       # Markdown出力フォーマッタ
  data/
    registry.ts         # 統合モデルレジストリ
    cache.ts            # インメモリTTLキャッシュ
    normalizer.ts       # クロスソース名正規化
    percentiles.ts      # パーセンタイル計算（7カテゴリ）
    fetchers/           # 7つのデータフェッチャー
      openrouter.ts     # OpenRouter API
      swe-bench.ts      # SWE-bench
      arena.ts          # LM Arena Elo
      vlm-leaderboard.ts # OpenCompass VLM
      aider.ts          # Aider Polyglot
      bfcl.ts           # BFCL V4（エージェントベンチマーク）
      speed.ts          # 静的スピード/レイテンシデータ
    static/
      api-examples.ts   # APIコードスニペットテンプレート
```

---

## ライセンス

[MIT](LICENSE) — [Cognisant LLC](https://cognisant.io) が開発
