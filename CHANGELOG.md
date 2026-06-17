# Changelog

All notable changes to this project will be documented in this file.

## [0.4.3] - 2026-06-17

### Fixed
- **VLM benchmarks silently dropped to empty since ~2026-04-16.** The OpenCompass data host (`opencompass.openxlab.space`) let its TLS certificate expire (notAfter 2026-04-16), so the fetch threw and — because benchmark enrichment degrades gracefully — all vision scores (MMMU, MMBench, OCRBench, AI2D, MathVista) silently vanished from `get_model_info`, `list_top_models`, `compare_models`, and `recommend_model`. Switched the source to `cdn.opencompass.org.cn/assets/OpenVLM.json` (byte-identical data, valid cert).

### Added
- `npm run smoke` — live smoke test that hits all 5 data sources and exits non-zero if any returns zero rows, so a silently-dead source surfaces immediately.

### Changed
- Bumped `@modelcontextprotocol/sdk` 1.27 → 1.29 and dev tooling (tsx, vitest) within existing semver ranges. No API changes; 51 tests still green.

### Known limitations
- OpenCompass's upstream VLM data is itself frozen at 2025-09-17, so vision scores reflect models available up to that date.

## [0.4.2] - 2026-02-25

### Added
- Registered to Official MCP Registry (`io.github.Daichi-Kudo/llm-advisor`)
- `mcpName` field in package.json for registry namespace
- Dockerfile for containerized deployment (multi-stage build, node:22-alpine)
- GitHub Release v0.4.2

## [0.4.1] - 2026-02-25

### Changed
- Rewrote README.md with badges, use cases, compatible clients table, architecture diagram
- Added README.ja.md (Japanese)
- Added GitHub Actions CI workflow (Node 18/20/22 matrix)
- Optimized package.json: description, keywords (12→18), added homepage/repository/bugs
- Set 12 GitHub repository topics for discoverability
- Submitted to 4 MCP directories (mcp.so, mcpservers.org, MCPMarket, awesome-mcp-servers PR)

## [0.4.0] - 2026-02-25

### Added
- Release date display in `get_model_info`, `list_top_models`, `compare_models`, `recommend_model`
- `min_release_date` filter parameter for `list_top_models` and `recommend_model`
- Freshness scoring in `recommend_model` (+3 points for ≤3 months, +1 for ≤6 months)
- 8 new tests (freshness + formatters release date) — total 51 tests

## [0.3.1] - 2026-02-24

### Fixed
- Filtered OpenRouter meta-models (`openrouter/auto`, `openrouter/bodybuilder`) with negative pricing that broke recommend_model scoring
- Improved fuzzy model matching: `gpt-4o` now correctly resolves to base model instead of `gpt-4o-audio-preview`

## [0.3.0] - 2026-02-24

### Added
- VLM benchmarks from OpenCompass: MMMU, MMBench, OCRBench, AI2D, MathVista (284+ models)
- Aider Polyglot coding benchmark (63+ models)
- Percentile rank computation across 5 categories (coding, math, general, vision, cost efficiency)
- 43 unit tests covering normalizer, formatters, percentiles

## [0.2.0] - 2026-02-23

### Added
- `compare_models` tool — side-by-side comparison for 2-5 models with best-value highlighting
- `recommend_model` tool — personalized top-3 recommendations based on use case, budget, requirements
- SWE-bench Verified leaderboard integration
- LM Arena Elo ratings integration

## [0.1.0] - 2026-02-23

### Added
- Initial release
- `get_model_info` tool — detailed model specs, pricing, benchmarks, API code examples
- `list_top_models` tool — category-based ranking (coding, math, vision, general, etc.)
- OpenRouter API integration (336+ models, pricing, context lengths, modalities)
- In-memory TTL cache (1h pricing, 6h benchmarks)
- Cross-source model name normalization
