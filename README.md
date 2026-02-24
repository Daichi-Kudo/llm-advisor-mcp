# llm-advisor-mcp

MCP server for LLM/VLM model selection — real-time benchmarks, pricing, and recommendations with low-token output.

**No API key required. Free. Open source.**

## Why?

LLMs like Claude and Gemini have knowledge cutoffs. When you ask "what's the best model for coding right now?", they can't answer with current data. This MCP fixes that by providing real-time model information directly to your AI assistant.

**Key differentiators** vs existing MCPs:
- **Low-token output** — Markdown tables, not raw JSON (~300 tokens vs ~3000)
- **Multi-source benchmarks** — SWE-bench + Arena Elo + VLM (MMMU, MMBench) + Aider Polyglot, merged into one view
- **Personalized recommendations** — Use case + budget + requirements → Top 3 picks
- **Side-by-side comparison** — Compare 2-5 models with best-value highlighting
- **API usage examples** — Ready-to-use code in Python/curl
- **Zero config** — No API keys, no registration, just install and use

## Install

### Claude Code

```bash
claude mcp add llm-advisor -- npx -y llm-advisor-mcp
```

### Claude Desktop / Cursor / Windsurf

Add to your MCP settings:

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

### Windows (Claude Code)

```bash
claude mcp add llm-advisor -- cmd /c npx -y llm-advisor-mcp
```

## Tools

### `get_model_info`

Get detailed info about a specific model.

**Example**: "What are Claude Opus 4.6's specs and pricing?"

```
## anthropic/claude-opus-4.6

**Provider**: anthropic | **Modality**: text+image→text

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

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `model` | string | Yes | Model ID or partial name |
| `include_api_example` | boolean | No | Include code example (default: true) |
| `api_format` | string | No | `openai_sdk`, `curl`, or `python_requests` |

### `list_top_models`

List top models for a category, ranked by relevant benchmarks.

**Example**: "Show me the top 5 coding models"

```
## Top 5: coding

| # | Model | Key Score | Input $/1M | Output $/1M | Context |
|---|-------|-----------|-----------|------------|---------|
| 1 | anthropic/claude-opus-4.5 | SWE 79.2% | $5.00 | $25.00 | 200K |
| 2 | google/gemini-3-pro-preview | SWE 77.4% | $2.00 | $12.00 | 1M |
| 3 | anthropic/claude-sonnet-4 | SWE 76.8% | $3.00 | $15.00 | 1M |
| ...
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | string | Yes | `coding`, `math`, `vision`, `general`, `cost-effective`, `open-source`, `speed`, `context-window`, `reasoning` |
| `limit` | number | No | 1-20 (default: 10) |
| `min_context` | number | No | Minimum context window |

### `compare_models`

Compare 2-5 models side-by-side with best-value highlighting.

**Example**: "Compare Claude Opus 4.6, GPT-5.2, and Gemini 3 Pro"

```
## Model Comparison (3 models)

| | **anthropic/claude-opus-4.6** | **openai/gpt-5.2** | **google/gemini-3-pro** |
|------|------|------|------|
| Input $/1M | $5.00 | $2.00 | **$1.25** |
| Output $/1M | $25.00 | $8.00 | **$5.00** |
| Context | **1M** | 128K | **1M** |
| SWE-bench | 75.6% | 72.3% | **77.4%** |
| Arena Elo | **1504** | 1480 | 1500 |
| Vision | Yes | Yes | Yes |
| Reasoning | Yes | No | Yes |
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `models` | string[] | Yes | 2-5 model IDs or partial names |

### `recommend_model`

Get personalized recommendations based on use case, budget, and requirements.

**Example**: "Recommend a coding model under $3/1M input"

```
## Recommended for: coding

### 1. anthropic/claude-sonnet-4.6 (score: 78)
Input: $3.00/1M | Output: $15.00/1M | Context: 1M
Benchmarks: SWE-bench: 72.1%, Arena: 1467
Strengths: reasoning, tools, vision, 1M+ context

### 2. google/gemini-3-flash (score: 74)
Input: $0.50/1M | Output: $3.00/1M | Context: 1M
Benchmarks: SWE-bench: 75.8%, Arena: 1473
Strengths: tools, vision, 1M+ context

### 3. ...
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `use_case` | string | Yes | `coding`, `math`, `general`, `vision`, `creative`, `reasoning`, `cost-effective` |
| `max_input_price` | number | No | Max input price (USD/1M tokens) |
| `max_output_price` | number | No | Max output price (USD/1M tokens) |
| `min_context` | number | No | Minimum context window |
| `require_vision` | boolean | No | Require vision support |
| `require_tools` | boolean | No | Require tool calling |
| `require_open_source` | boolean | No | Require open-source license |

## Data Sources

All data is fetched in real-time from free, public APIs:

| Source | Data | Auth |
|--------|------|------|
| [OpenRouter](https://openrouter.ai/api/v1/models) | 336+ models: pricing, context, modalities | None |
| [SWE-bench](https://github.com/SWE-bench/swe-bench.github.io) | Coding benchmark (Verified leaderboard) | None |
| [LM Arena](https://arena.ai) | Human preference Elo ratings (314+ models) | None |
| [OpenCompass VLM](https://opencompass.org.cn) | Vision benchmarks: MMMU, MMBench, OCRBench, AI2D, MathVista (284+ models) | None |
| [Aider Polyglot](https://aider.chat/docs/leaderboards/) | Coding benchmark: multi-language pass rate (63+ models) | None |

## Roadmap

- **v0.1**: `get_model_info` + `list_top_models` via OpenRouter
- **v0.2**: `compare_models` + `recommend_model` + SWE-bench + Arena Elo integration
- **v0.3** (current): VLM benchmarks (MMMU, MMBench, OCRBench, AI2D, MathVista) + Aider Polyglot + percentile ranks + 43 unit tests
- **v1.0**: Community contributions, weekly static data refresh via GitHub Actions

## Development

```bash
npm install
npm run build
npm run dev     # Run with tsx (for development)
npm test        # Run tests
```

## License

MIT
