# Changelog

All notable changes to this project will be documented in this file.

## [0.4.2] - 2026-02-25

### Added
- Registered to Official MCP Registry (`io.github.Daichi-Kudo/llm-advisor`)
- `mcpName` field in package.json for registry namespace

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
