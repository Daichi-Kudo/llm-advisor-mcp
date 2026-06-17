# STATUS — llm-advisor-mcp

> Last updated: 2026-06-17

## Current Version

**v0.4.4** (published to npm + MCP Registry on 2026-06-17)

> v0.4.3: fixed dead VLM data source (see Data Source Health). v0.4.4: fixed VLM match mis-attribution + Glama badge + dev-dep bumps.
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

### Listed (verified 2026-06-17 by audit)
- **Official MCP Registry**: `io.github.Daichi-Kudo/llm-advisor` — **v0.4.3 active/latest** ✅
- **Glama**: ✅ LISTED — https://glama.ai/mcp/servers/Daichi-Kudo/llm-advisor-mcp（3月は未掲載→現在ライブ）
- **mcpservers.org**: ✅ LISTED — https://mcpservers.org/servers/daichi-kudo/llm-advisor-mcp
- **PulseMCP**: ✅ LISTED — https://www.pulsemcp.com/servers/daichi-kudo-llm-advisor（Official Registry から自動連携）
- **punkpeye/awesome-mcp-servers**: ✅ PR #2371 **MERGED 2026-03-23**（README の Data Science Tools に掲載）
- **MCP Marketplace**: ✅ LISTED — https://mcp-marketplace.io/server/io-github-daichi-kudo-llm-advisor（表示は **v0.4.2**、1版遅れ・自動更新待ち）
- **GitHub / npm / CI / Dockerfile**: 12 topics, bilingual README, Node 18/20/22 CI, multi-stage Dockerfile

### Outstanding
- **mcp.so**: ⏳ PENDING — 投稿 issue `chatmcp/mcpso#555` が OPEN。Official Registry の下流なので自動取り込みの可能性、なければ issue を bump。優先度低。
- **MCPMarket** (mcpmarket.com): ❓ UNKNOWN — 監査時に 429 でフェッチ不可。ブラウザでの手動確認が必要。
- **Glama バッジ**: README に未追加（掲載はライブ済み）。任意の仕上げ。

### Promotional Content
- `drafts/` に dev.to / Reddit / X ドラフト作成済み（未投稿）

## Next Steps
1. ✅ v0.4.3 公開済み（npm + MCP Registry、2026-06-17）。コミット+タグ `v0.4.3` 済み
2. ✅ 掲載棚卸し完了（6 LISTED / mcp.so のみ pending / MCPMarket 要手動確認）
3. ✅ v0.4.4 公開済み（VLM照合の正確性fix + Glama badge + dev依存bump vitest4/@types/node25、監査 6→2）
4. (任意) README に Glama バッジ追加、MCPMarket 手動確認、mcp.so #555 bump
5. (任意) dev.to / Reddit / X 露出拡大（`drafts/` 未投稿）
6. (保留) TS6（tsup DTS 破壊）・zod4（SDK 依存）のメジャー更新

## Technical Notes

- MCP Registry: **case-sensitive** naming (`io.github.Daichi-Kudo/*`), description **100 chars max**
- OpenRouter meta-models (`openrouter/*`) → negative pricing → filtered
- Fuzzy match: exact → provider-stripped → shortest-ID-first contains
