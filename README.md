# llm-advisor-mcp

[![npm version](https://img.shields.io/npm/v/llm-advisor-mcp)](https://www.npmjs.com/package/llm-advisor-mcp)
[![npm downloads](https://img.shields.io/npm/dm/llm-advisor-mcp)](https://www.npmjs.com/package/llm-advisor-mcp)
[![CI](https://github.com/Daichi-Kudo/llm-advisor-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Daichi-Kudo/llm-advisor-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**English** | [日本語](README.ja.md)

**Give your AI assistant real-time LLM/VLM knowledge.** Pricing, benchmarks, and recommendations — updated every hour, not every training cycle.

LLMs have knowledge cutoffs. Ask Claude "what's the best coding model right now?" and it cannot answer with current data. This MCP server fixes that by feeding live model intelligence directly into your AI assistant's context window.

- **Zero config** — No API keys, no registration. One command to install.
- **Low token** — Compact Markdown tables (~300 tokens), not raw JSON (~3,000 tokens). Your context window matters.
- **5 benchmark sources** — SWE-bench, LM Arena Elo, OpenCompass VLM, Aider Polyglot, and OpenRouter pricing merged into one unified view.

---

## Use Cases

- **"What's the best coding model right now?"** — `list_top_models` with category `coding`
- **"Compare Claude vs GPT vs Gemini"** — `compare_models` with side-by-side table
- **"Find a cheap model with 1M context"** — `recommend_model` with budget constraints
- **"What benchmarks does model X have?"** — `get_model_info` with percentile ranks

---

## Quick Start

### Claude Code

```bash
claude mcp add llm-advisor -- npx -y llm-advisor-mcp
```

### Claude Code (Windows)

```bash
claude mcp add llm-advisor -- cmd /c npx -y llm-advisor-mcp
```

### Claude Desktop / Cursor / Windsurf

Add to your MCP configuration file:

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

That is it. No API keys, no `.env` files.

### Compatible Clients

| Client | Supported | Install Method |
|--------|-----------|----------------|
| Claude Code | Yes | `claude mcp add` |
| Claude Desktop | Yes | JSON config |
| Cursor | Yes | JSON config |
| Windsurf | Yes | JSON config |
| Any MCP client | Yes | stdio transport |

---

## Tools

### `get_model_info`

Detailed specs for a specific model: pricing, benchmarks, percentile ranks, capabilities, and a ready-to-use API code example.

**Parameters**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `model` | string | Yes | — | Model ID or partial name (e.g. `"claude-sonnet-4"`, `"gpt-5"`) |
| `include_api_example` | boolean | No | `true` | Include a ready-to-use code snippet |
| `api_format` | enum | No | `openai_sdk` | `openai_sdk`, `curl`, or `python_requests` |

**Example output**

```
## anthropic/claude-sonnet-4

**Provider**: anthropic | **Modality**: text+image→text | **Released**: 2025-06-25

### Pricing
| Metric | Value |
|--------|-------|
| Input | $3.00 /1M tok |
| Output | $15.00 /1M tok |
| Cache Read | $0.30 /1M tok |
| Context | 200K |
| Max Output | 64K |

### Benchmarks
| Benchmark | Score |
|-----------|-------|
| SWE-bench Verified | 76.8% |
| Aider Polyglot | 72.1% |
| Arena Elo | 1467 |
| MMMU | 76.0% |

### Percentile Ranks
| Category | Percentile |
|----------|------------|
| Coding | P96 |
| General | P95 |
| Vision | P90 |

**Capabilities**: Tools, Reasoning, Vision

### API Example (openai_sdk)
```python
from openai import OpenAI
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="<OPENROUTER_API_KEY>",
)
response = client.chat.completions.create(
    model="anthropic/claude-sonnet-4",
    messages=[{"role": "user", "content": "Hello"}],
)
```
```

---

### `list_top_models`

Top-ranked models for a category. Includes release dates for freshness awareness.

**Parameters**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `category` | enum | Yes | — | `coding`, `math`, `vision`, `general`, `cost-effective`, `open-source`, `speed`, `context-window`, `reasoning` |
| `limit` | number | No | `10` | Number of results (1-20) |
| `min_context` | number | No | — | Minimum context window in tokens |
| `min_release_date` | string | No | — | `YYYY-MM-DD`. Excludes models released before this date |

**Example output**

```
## Top 5: coding

| # | Model | Key Score | Input $/1M | Output $/1M | Context | Released |
|------|------|------|------|------|------|------|
| 1 | openai/o3-pro | SWE 79.5% | $20.00 | $80.00 | 200K | 2025-06-10 |
| 2 | anthropic/claude-sonnet-4 | SWE 76.8% | $3.00 | $15.00 | 200K | 2025-06-25 |
| 3 | google/gemini-2.5-pro | SWE 75.2% | $1.25 | $10.00 | 1M | 2025-03-25 |
| 4 | openai/o4-mini | SWE 73.6% | $1.10 | $4.40 | 200K | 2025-04-16 |
| 5 | anthropic/claude-opus-4 | SWE 72.5% | $15.00 | $75.00 | 200K | 2025-05-22 |
```

---

### `compare_models`

Side-by-side comparison for 2-5 models. Best values are **bolded** automatically. Includes a `Released` row so you can spot outdated models at a glance.

**Parameters**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `models` | string[] | Yes | — | 2-5 model IDs or partial names |

**Example output**

```
## Model Comparison (3 models)

| | **anthropic/claude-sonnet-4** | **openai/gpt-4.1** | **google/gemini-2.5-pro** |
|------|------|------|------|
| Input $/1M | $3.00 | **$2.00** | $1.25 |
| Output $/1M | $15.00 | $8.00 | **$5.00** |
| Context | 200K | 1M | **1M** |
| Max Output | 64K | 32K | **65K** |
| SWE-bench | **76.8%** | 55.0% | 75.2% |
| Aider Polyglot | **72.1%** | 65.3% | 71.8% |
| Arena Elo | 1467 | **1492** | 1445 |
| Vision | Yes | Yes | Yes |
| Tools | Yes | Yes | Yes |
| Reasoning | Yes | No | Yes |
| Open Source | No | No | No |
| Released | 2025-06-25 | **2025-04-14** | 2025-03-25 |
```

---

### `recommend_model`

Personalized top-3 recommendations. Scores combine weighted benchmarks, pricing, capability bonuses, and a freshness bonus (+3 points for models released within 3 months, +1 within 6 months).

**Parameters**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `use_case` | enum | Yes | — | `coding`, `math`, `general`, `vision`, `creative`, `reasoning`, `cost-effective` |
| `max_input_price` | number | No | — | Max input price (USD/1M tokens) |
| `max_output_price` | number | No | — | Max output price (USD/1M tokens) |
| `min_context` | number | No | — | Minimum context window in tokens |
| `require_vision` | boolean | No | — | Require image input support |
| `require_tools` | boolean | No | — | Require tool/function calling support |
| `require_open_source` | boolean | No | — | Require open-source license |
| `min_release_date` | string | No | — | `YYYY-MM-DD`. Excludes older models |

**Example output**

```
## Recommended for: coding

### 1. anthropic/claude-sonnet-4 (score: 78)
Input: $3.00/1M | Output: $15.00/1M | Context: 200K | Released: 2025-06-25
Benchmarks: SWE-bench: 76.8%, Aider: 72.1%, Arena: 1467
Strengths: reasoning, tools, vision

### 2. google/gemini-2.5-flash (score: 74)
Input: $0.15/1M | Output: $0.60/1M | Context: 1M | Released: 2025-05-20
Benchmarks: SWE-bench: 62.9%, Arena: 1445
Strengths: tools, vision, 1M+ context

### 3. openai/o4-mini (score: 71)
Input: $1.10/1M | Output: $4.40/1M | Context: 200K | Released: 2025-04-16
Benchmarks: SWE-bench: 73.6%, Arena: 1430
Strengths: reasoning, tools
```

---

## Data Sources

All data is fetched in real time from free, public APIs. No authentication required.

| Source | Data | Models | Cache TTL |
|--------|------|--------|-----------|
| [OpenRouter](https://openrouter.ai/api/v1/models) | Pricing, context lengths, modalities, release dates | 336+ | 1 hour |
| [SWE-bench](https://github.com/SWE-bench/swe-bench.github.io) | Coding benchmark (Verified leaderboard) | 30+ | 6 hours |
| [LM Arena](https://lmarena.ai) | Human preference Elo ratings | 314+ | 6 hours |
| [OpenCompass VLM](https://opencompass.org.cn) | Vision benchmarks: MMMU, MMBench, OCRBench, AI2D, MathVista | 284+ | 6 hours |
| [Aider Polyglot](https://aider.chat/docs/leaderboards/) | Multi-language coding pass rate | 63+ | 6 hours |

---

## Context Cost

MCP tool definitions and responses consume your LLM's context window. This server is designed to be lean:

| Component | Tokens |
|-----------|--------|
| All 4 tool definitions | ~1,000 |
| Typical tool response | ~250-400 |

For comparison, most MCP servers that return raw JSON consume 3,000-10,000 tokens per response. Every response from llm-advisor-mcp is pre-formatted Markdown, keeping context costs roughly 10x lower.

---

## Architecture

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
│  │ (4 tools)│──│ (unified) │──│ (in-memory)│  │
│  └─────────┘  └───────────┘  └────────────┘  │
│                     │                         │
│        ┌────────────┼────────────┐            │
│        ▼            ▼            ▼            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Normalizer│ │Percentile│ │ Fetchers │      │
│  │(slug map)│ │ (5 cats) │ │(5 sources│      │
│  └──────────┘ └──────────┘ └──────────┘      │
└──────────────────────────────────────────────┘
           │           │           │
     OpenRouter    SWE-bench    Arena / VLM / Aider
```

- **TypeScript + ESM** — Single entry point, `tsup` build
- **In-memory cache** — TTL-based (1h pricing, 6h benchmarks), stale-while-revalidate
- **Cross-source normalization** — Maps inconsistent model names (e.g. `Claude 3.5 Sonnet` vs `anthropic/claude-3.5-sonnet`) to canonical IDs
- **Percentile computation** — Ranks across 5 categories (coding, math, general, vision, cost efficiency)
- **Freshness scoring** — Recommendation algorithm gives a bonus to recently released models (+3 for <=3mo, +1 for <=6mo)
- **Zero runtime deps** beyond `@modelcontextprotocol/sdk` and `zod`

---

## Roadmap

| Version | Status | Highlights |
|---------|--------|------------|
| v0.1 | Done | `get_model_info` + `list_top_models` via OpenRouter |
| v0.2 | Done | `compare_models` + `recommend_model` + SWE-bench + Arena Elo |
| v0.3 | Done | VLM benchmarks (MMMU, MMBench, OCRBench, AI2D, MathVista) + Aider Polyglot + percentile ranks + 43 tests |
| v0.4 | **Current** | Release date display, date-based filtering, freshness scoring in recommendations + 51 tests |
| v1.0 | Planned | Community contributions, weekly static data snapshots via GitHub Actions |

---

## Development

```bash
git clone https://github.com/Daichi-Kudo/llm-advisor-mcp.git
cd llm-advisor-mcp
npm install
npm run build       # Build with tsup
npm run dev         # Run with tsx (hot reload)
npm test            # Run 51 unit tests (vitest)
npm run test:watch  # Watch mode
```

### Project structure

```
src/
  index.ts              # Server entry point
  types.ts              # Shared type definitions
  tools/
    model-info.ts       # get_model_info tool
    list-top.ts         # list_top_models tool
    compare.ts          # compare_models tool
    recommend.ts        # recommend_model tool
    formatters.ts       # Markdown output formatters
  data/
    registry.ts         # Unified model registry
    cache.ts            # In-memory TTL cache
    normalizer.ts       # Cross-source name normalization
    percentiles.ts      # Percentile rank computation
    fetchers/
      openrouter.ts     # OpenRouter API
      swe-bench.ts      # SWE-bench leaderboard
      arena.ts          # LM Arena Elo ratings
      vlm-leaderboard.ts # OpenCompass VLM benchmarks
      aider.ts          # Aider Polyglot scores
    static/
      api-examples.ts   # API code snippet templates
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Run `npm test` to verify all 51 tests pass
5. Submit a pull request

---

## License

[MIT](LICENSE) -- Cognisant LLC
