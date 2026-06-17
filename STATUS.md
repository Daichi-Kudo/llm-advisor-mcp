# STATUS — llm-advisor-mcp

> Last updated: 2026-06-17

## Current Version

**v0.4.3** (published to npm + MCP Registry on 2026-06-17)

> v0.4.3 fixes a dead VLM data source (see Data Source Health).
> Traction: ~237 downloads/last-30d, ~68/last-7d, slowly rising (as of 2026-06-17).

## What This Is

MCP server that gives AI assistants real-time LLM/VLM knowledge — pricing, benchmarks, recommendations from 5 public data sources. Zero config, no API keys.

## Architecture

- TypeScript + ESM, `tsup` build, `vitest` test (51 tests)
- 4 tools: `get_model_info`, `list_top_models`, `compare_models`, `recommend_model`
- 5 data fetchers: OpenRouter, SWE-bench, LM Arena, OpenCompass VLM, Aider Polyglot
- In-memory TTL cache (1h pricing, 6h benchmarks)
- Cross-source model name normalization + percentile ranking

## Data Source Health (verified 2026-06-17 via `npm run smoke`)

| Source | Status | Coverage |
|--------|--------|----------|
| OpenRouter | ✅ live | 307 models |
| LM Arena (arena.ai RSC scrape) | ✅ primary path healthy | 147 w/ Elo |
| SWE-bench | ✅ live | 40 |
| Aider Polyglot | ✅ live | 27 |
| OpenCompass VLM | ✅ **fixed in v0.4.3** | 12 w/ MMMU |

- VLM source was **dead ~2026-04-16 → 2026-06-17**: `opencompass.openxlab.space` TLS cert expired, fetch threw, vision scores silently degraded to empty (graceful `.catch(() => new Map())`). Switched to `cdn.opencompass.org.cn` (byte-identical data, valid cert).
- VLM upstream data is frozen at 2025-09-17 (OpenCompass-side, both hosts identical). Only ~12 OpenRouter models name-match the VLM table — low match rate is pre-existing (normalizer), a candidate for future improvement, not a regression.
- `npm run smoke` added to surface silent source death immediately (exits non-zero if any source returns 0 rows).

## Discoverability / Distribution

### Done
- **GitHub**: 12 topics 設定済み, CI badge, bilingual README (EN + JA)
- **npm**: 18 keywords, optimized description, homepage/repository/bugs fields
- **GitHub Actions CI**: Node 18/20/22 matrix, passing
- **Official MCP Registry**: `io.github.Daichi-Kudo/llm-advisor` published
- **GitHub Release**: v0.4.2 published
- **Dockerfile**: multi-stage build, node:22-alpine (181MB)
- **MCP Marketplace**: 掲載済み (https://mcp-marketplace.io/server/io-github-daichi-kudo-llm-advisor)
- **punkpeye/awesome-mcp-servers**: PR #2371 submitted (Data Science Tools section)
- **mcp.so**: Issue #555 submitted
- **mcpservers.org**: Web form submitted (free listing, category: development)
- **MCPMarket**: Web form submitted

### Pending / Blocked
> ⚠️ 以下は 2026-03-02 時点の状態。3.5ヶ月未確認 — 各掲載の現況は再チェックが必要。
- **Glama**: 2/26 に Add Server フォームでサブミット済み → 4日経過、未掲載。frank@glama.ai にフォローアップメール送信済み (3/2)
- **awesome-mcp-servers PR #2371**: Glama 掲載後に `[glama]` リンク追加が必要 → Glama 待ち
- mcp.so Issue #555 → 処理待ち
- mcpservers.org → メール承認待ち (daichi@cognisant.io)
- MCPMarket → レビュー待ち
- PulseMCP → Official Registry から週次自動連携で掲載予定

### Promotional Content
- `drafts/` に dev.to / Reddit / X ドラフト作成済み（未投稿）

## Next Steps
1. ✅ v0.4.3 公開済み（npm + MCP Registry、2026-06-17）。git コミット / タグ `v0.4.3` は未実施
2. ディレクトリ掲載の現況棚卸し（Glama / mcp.so / mcpservers.org / MCPMarket / awesome PR #2371）— 3.5ヶ月未確認
3. dev.to / Reddit / X での露出拡大（`drafts/` に未投稿ドラフトあり）
4. (任意) VLM の name-match 改善、メジャー依存更新（zod4 / TS6 / vitest4）

## Technical Notes

- MCP Registry: **case-sensitive** naming (`io.github.Daichi-Kudo/*`), description **100 chars max**
- OpenRouter meta-models (`openrouter/*`) → negative pricing → filtered
- Fuzzy match: exact → provider-stripped → shortest-ID-first contains
