# STATUS — llm-advisor-mcp

> Last updated: 2026-06-19

## Current Version

**v0.4.5** — live on npm + MCP Registry (latest). Traction: ~237 DL/last-30d, ~68/last-7d, slowly rising.

## What This Is

MCP server giving AI assistants real-time LLM/VLM knowledge — pricing, benchmarks, recommendations from 5 public sources. Zero config, no API keys.

## Architecture

- TypeScript + ESM, `tsup` build, `vitest` (66 tests)
- 4 tools: `get_model_info`, `list_top_models`, `compare_models`, `recommend_model`
- 5 fetchers: OpenRouter, SWE-bench, LM Arena, OpenCompass VLM, Aider Polyglot
- In-memory TTL cache (1h pricing, 6h benchmarks); cross-source name normalization + composite benchmark scoring + percentile ranks
- Tool registration uses MCP `registerTool` with read-only/idempotent annotations and versioned metadata from `src/metadata.ts`
- `npm run smoke` — live health check of all 5 sources (exits non-zero if any returns 0 rows)
- `npm run smoke:mcp` — stdio MCP smoke test for server metadata, tool discovery, annotations, and optional live call
- `npm run smoke:package` — pack/install smoke test for the published binary layout

## Data Sources (all 5 live, verified 2026-06-17)

- **VLM**: host moved to `cdn.opencompass.org.cn` (old `openxlab.space` cert expired 2026-04-16 → silently zeroed vision scores ~2mo until v0.4.3). **Upstream VLM data frozen at 2025-09-17** → only ~10 current models match. Matching tightened in v0.4.4 (no more open-model→commercial mis-attribution).
- **LM Arena**: primary scrapes `arena.ai` RSC; HF mirror fallback.

## Distribution

- **Listed**: Official MCP Registry (0.4.5), Glama, mcpservers.org, PulseMCP, awesome-mcp-servers (PR #2371 merged 3/23), MCP Marketplace.
- **Outstanding**: mcp.so (issue `chatmcp/mcpso#555` OPEN, low pri); MCPMarket (status unknown — manual browser check).
- npm author now links to cognisant.io (backlink for domain authority).

## Next Steps

1. (任意) 宣伝: cognisant.io blog + LinkedIn 投稿（canonical連携で会社ドメイン/個人ブランド育成）→ HN/Reddit/X（`drafts/` 流用）。ネタ: TLS失効の静かな障害 / 照合バグ。
2. (任意) GitHub About→Website を cognisant.io に / MCPMarket 手動確認 / mcp.so #555 bump。
3. (保留) メジャー依存: TS6（tsup DTS破壊）・zod4（SDK が zod3 依存）。
4. 🔐 チャットに露出した npm トークン2つの revoke（未対応）。

## Technical Notes

- **Publish auth** は [[publish-workflow]] memory 参照（npm=pepk/Automationトークン、Registry JWT は <1h で失効→直前に `mcp-publisher login github`、push は `github-switch pepk`）。
- MCP Registry: case-sensitive naming (`io.github.Daichi-Kudo/*`), description ≤100 chars.
- OpenRouter meta-models filtered (negative pricing). Fuzzy match: exact → provider-stripped → substring (両側≥6字 + vision-token guard)。

## SSOT参照

| 場所 | 内容 |
|------|------|
| `CHANGELOG.md` | バージョン別の変更履歴（0.1.0〜0.4.5） |
| `README.md` / `README.ja.md` | 利用者向けドキュメント（EN/JA） |
| auto memory `[[publish-workflow]]` | npm/Registry 公開手順の落とし穴 |
| auto memory `[[llm-advisor-data-sources]]` | 5データ源の脆さ・健全性チェック |
