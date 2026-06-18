# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Fixed
- Corrected ranking/filtering edge cases: filters now apply before limiting, open-source classification no longer labels proprietary Gemini models as open-source, benchmark/context formatting preserves explicit zero values, and model ordering is deterministic for equal scores.
- Standardized cost-performance scoring on a single blended token-price formula across list and recommendation tools.
- Hardened MCP tool protocol handling with strict calendar-date validation, non-empty model-query schemas, escaped external Markdown fields, and a package override for the dev-only `esbuild` audit advisory.
- Fixed distribution hygiene by keeping the package root non-importable, removing CLI-only declaration output, validating built package artifacts before pack smoke tests, and relying on the `files` allowlist instead of `.npmignore`.
- Fixed package safety gates so builds run `tsc --noEmit`, publishes run tests before bundling, npm engine requirements include the lockfile-compatible npm floor, Docker installs CA certificates explicitly, and Grok 1.5 is no longer classified as open-source.

### Changed
- Migrated tool registration to `registerTool` with read-only/idempotent MCP annotations and versioned descriptions for better client compatibility.
- Raised the published MCP SDK dependency floor to `^1.29.0` to match the lockfile and modern `registerTool` API usage.
- Limited live data-source smoke checks to push builds so pull requests still verify MCP/package protocol behavior without being blocked by upstream outages.

### Added
- Added regression tests for filtering, cache cloning/freshness, fetcher parser helpers, registry mutation isolation, formatting/schema edge cases, and MCP metadata.
- Added coverage for HTTP response byte limits, registry top-model clone isolation, negative price formatting, Grok open-source classification, cache boundary behavior, and MCP registry metadata constraints.
- Added `npm run smoke:mcp` for a stdio MCP client smoke test that validates tool discovery, annotations, server metadata, and a live tool call.
- Added `npm run smoke:package` to pack, install, and verify the published binary layout before release.

## [0.4.5] - 2026-06-17

### Changed
- Documentation / metadata only (no code change): aligned README badges and model count with reality (TypeScript 5.9, OpenRouter 300+), and `package.json` `author` now links to https://cognisant.io. Republished so npm and the MCP Registry reflect the updated metadata.

## [0.4.4] - 2026-06-17

### Fixed
- **VLM benchmark matching mis-attributed scores to the wrong models.** Open research models carrying the "gpt" stem (`PandaGPT`, `ShareGPT4V`, `MiniGPT`) collapsed onto `openai/gpt-chat-latest`, and `DeepSeek-VL` / `Phi-4-MultiModal` matched their non-vision base models. Substring matching now requires both keys ≥6 chars, plus a vision-token guard so a VL/vision model can't match a non-vision base. `GPT-4o` now correctly attributes to `openai/gpt-4o-*`. All retained VLM matches are now correct (+4 tests, 55 total).

### Added
- Glama listing badge in both READMEs (server is live at glama.ai).

### Changed
- Dev tooling: vitest 3→4, @types/node 22→25, tsup floor →8.5.1 (npm audit high advisories 6→2; the remaining 2 are dev-only esbuild advisories not reachable in this project). TypeScript stays on 5 (6 breaks tsup's `.d.ts` generation); zod stays on 3 (the MCP SDK requires zod 3).

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
