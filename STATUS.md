# STATUS — llm-advisor-mcp

> Last updated: 2026-06-19 (v0.5.0)

## Current Version

**v0.5.0** — live on npm + MCP Registry.

## What This Is

MCP server giving AI assistants real-time LLM/VLM knowledge — pricing, benchmarks, recommendations, provider comparison, cost estimation from 7 data sources. Zero config, no API keys.

## Architecture

- TypeScript + ESM, type-checked `tsup` build, `vitest` (126 tests)
- **10 tools**: `get_model_info`, `list_top_models`, `compare_models`, `recommend_model`, `search_models`, `list_providers`, `estimate_cost`, `list_new_models`, `list_model_slugs`, `compare_providers`
- **7 fetchers**: OpenRouter, SWE-bench, LM Arena, OpenCompass VLM, Aider Polyglot, BFCL V4, speed data
- **2 transports**: stdio (default) + Streamable HTTP (set `MCP_HTTP_PORT` or `PORT`)
- In-memory TTL cache (1h pricing, 6h benchmarks); cross-source name normalization + composite benchmark scoring + percentile ranks across 7 categories
- Tool registration uses MCP `registerTool` with read-only/idempotent annotations
- `npm run smoke` — live health check of all sources
- `npm run smoke:mcp` — stdio MCP smoke test for server metadata, tool discovery
- `npm run smoke:package` — pack/install smoke test for published binary layout

## Data Sources (all 7 live)

- OpenRouter (pricing, 300+ models)
- SWE-bench (coding, 30+)
- LM Arena (Elo, 314+)
- OpenCompass VLM (vision, 284+)
- Aider Polyglot (coding, 63+)
- BFCL V4 (agentic, 109+)
- Static speed data (tok/s + TTFT, 26+)

## Distribution

- **Listed**: Official MCP Registry, Glama, mcpservers.org, PulseMCP, awesome-mcp-servers, MCP Marketplace
- **Languages**: English, Japanese, Chinese

## v0.5.0 Highlights

- 10 tools (4 → 10, 2.5x growth from v0.4)
- Quality Index category, agentic benchmarks (BFCL V4), speed/latency data
- Provider comparison (`compare_providers`), provider slug lookup (`list_model_slugs`)
- Model search (`search_models`), provider browser (`list_providers`)
- Cost calculator (`estimate_cost`), recent models feed (`list_new_models`)
- Streamable HTTP transport for remote deployments
- 3 language READMEs (EN, JA, ZH)

## Next Steps

- Weekly static data snapshots via GitHub Actions
- Community contributions
- Per-provider pricing data expansion (more models)
