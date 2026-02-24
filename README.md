# llm-advisor-mcp

MCP server for LLM/VLM model selection — real-time benchmarks, pricing, and recommendations with low-token output.

**No API key required. Free. Open source.**

## Why?

LLMs like Claude and Gemini have knowledge cutoffs. When you ask "what's the best model for coding right now?", they can't answer with current data. This MCP fixes that by providing real-time model information directly to your AI assistant.

**Key differentiators** vs existing MCPs:
- **Low-token output** — Markdown tables, not raw JSON (~300 tokens vs ~3000)
- **API usage examples** — Ready-to-use code in Python/curl
- **Category rankings** — coding, math, vision, cost-effective, reasoning, and more
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

**Example**: "What are Claude Sonnet 4.6's specs and pricing?"

```
## anthropic/claude-sonnet-4.6

**Provider**: anthropic | **Modality**: text+image→text

### Pricing
| Metric | Value |
|--------|-------|
| Input | $3.00 /1M tok |
| Output | $15.00 /1M tok |
| Cache Read | $0.30 /1M tok |
| Context | 1M |
| Max Output | 128K |

**Capabilities**: Tools, Reasoning, Vision
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `model` | string | Yes | Model ID or partial name |
| `include_api_example` | boolean | No | Include code example (default: true) |
| `api_format` | string | No | `openai_sdk`, `curl`, or `python_requests` |

### `list_top_models`

List top models for a category.

**Example**: "Show me the top 5 vision models"

```
## Top 5: vision

| # | Model | Key Score | Input $/1M | Output $/1M | Context |
|---|-------|-----------|-----------|------------|---------|
| 1 | google/gemini-3.1-pro-preview | vision | $2.00 | $12.00 | 1M |
| 2 | anthropic/claude-sonnet-4.6 | vision | $3.00 | $15.00 | 1M |
| 3 | qwen/qwen3.5-plus | vision | $0.40 | $2.40 | 1M |
| ...
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | string | Yes | `coding`, `math`, `vision`, `general`, `cost-effective`, `open-source`, `speed`, `context-window`, `reasoning` |
| `limit` | number | No | 1-20 (default: 10) |
| `min_context` | number | No | Minimum context window |

## Data Sources

All data is fetched in real-time from free, public APIs:

| Source | Data | Auth |
|--------|------|------|
| [OpenRouter](https://openrouter.ai/api/v1/models) | 336+ models: pricing, context, modalities | None |

**Planned** (v0.2+): SWE-bench, Chatbot Arena Elo, OpenVLM benchmarks, Aider Polyglot.

## Roadmap

- **v0.1** (current): `get_model_info` + `list_top_models` via OpenRouter
- **v0.2**: `compare_models` + `recommend_model` + SWE-bench + Arena Elo integration
- **v0.3**: VLM benchmarks + percentile ranks + API usage examples for vision
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
