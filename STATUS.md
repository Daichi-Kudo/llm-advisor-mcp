# STATUS — llm-advisor-mcp

> Last updated: 2026-02-25

## Current Version

**v0.4.2** (npm published, MCP Registry published)

## What This Is

MCP server that gives AI assistants real-time LLM/VLM knowledge — pricing, benchmarks, recommendations from 5 public data sources. Zero config, no API keys.

## Architecture

- TypeScript + ESM, `tsup` build, `vitest` test (51 tests)
- 4 tools: `get_model_info`, `list_top_models`, `compare_models`, `recommend_model`
- 5 data fetchers: OpenRouter, SWE-bench, LM Arena, OpenCompass VLM, Aider Polyglot
- In-memory TTL cache (1h pricing, 6h benchmarks)
- Cross-source model name normalization + percentile ranking

## Completed (v0.1–v0.4)

| Version | Highlights |
|---------|------------|
| v0.1 | `get_model_info` + `list_top_models` via OpenRouter |
| v0.2 | `compare_models` + `recommend_model` + SWE-bench + Arena Elo |
| v0.3 | VLM benchmarks + Aider Polyglot + percentile ranks + 43 tests |
| v0.3.1 | Bug fix: OpenRouter meta-models (negative pricing), fuzzy match precision |
| v0.3.2 | (skipped — published as v0.3.1) |
| v0.4.0 | Release date display, `min_release_date` filter, freshness scoring (+3/+1) + 51 tests |
| v0.4.1 | npm metadata optimization (description, keywords 18個, homepage/repo/bugs) |
| v0.4.2 | Official MCP Registry 登録 (`io.github.Daichi-Kudo/llm-advisor`), mcpName field 追加 |

## Discoverability / Distribution

### Done
- **GitHub**: 12 topics 設定済み, CI badge, bilingual README (EN + JA)
- **npm**: 18 keywords, optimized description, homepage/repository/bugs fields
- **GitHub Actions CI**: Node 18/20/22 matrix, passing
- **Official MCP Registry**: `io.github.Daichi-Kudo/llm-advisor` published
- **punkpeye/awesome-mcp-servers**: PR #2371 submitted (Data Science Tools section)
- **mcp.so**: Issue #555 submitted
- **mcpservers.org**: Web form submitted (free listing, category: development)
- **MCPMarket**: Web form submitted

### Pending Approval
- punkpeye/awesome-mcp-servers PR #2371 → メンテナーレビュー待ち
- mcp.so Issue #555 → 処理待ち
- mcpservers.org → メール承認待ち (daichi@cognisant.io)
- MCPMarket → レビュー待ち
- PulseMCP → Official Registry から週次自動連携で掲載予定

### Promotional Content (drafts/ ディレクトリ、未投稿)
- `drafts/devto-article.md` — dev.to 記事ドラフト (EN, ~1,100 words)
- `drafts/reddit-post.md` — Reddit 投稿ドラフト (r/ClaudeAI + r/LocalLLaMA)
- `drafts/x-thread.md` — X/Twitter スレッドドラフト (7ツイート版 + 5ツイート版)

## Planned (v1.0)

- Community contributions workflow
- GitHub Actions による週次静的データスナップショット
- dev.to / Reddit / X での露出拡大（ドラフト作成済み）

## Key Accounts / Credentials

- **npm**: `llm-advisor-mcp` (Cognisant LLC)
- **GitHub**: `Daichi-Kudo/llm-advisor-mcp`
- **MCP Registry**: `io.github.Daichi-Kudo/llm-advisor` (GitHub auth via mcp-publisher)
- **mcpservers.org contact**: daichi@cognisant.io

## Technical Notes

- MCP SDK v1.12.0+ uses **newline-delimited JSON** (not LSP Content-Length headers) for stdio
- OpenRouter meta-models (`openrouter/*`) have negative pricing → filtered in `openrouter.ts`
- Fuzzy model matching: exact → provider-stripped exact → shortest-ID-first contains
- `metadata.releaseDate` from OpenRouter `created` field — 100% coverage
- MCP Registry naming: **case-sensitive** (`io.github.Daichi-Kudo/*` not `io.github.daichi-kudo/*`)
- MCP Registry description: **100 chars max**
- `mcp-publisher.exe` は .gitignore 済み、必要時は GitHub releases から再取得
