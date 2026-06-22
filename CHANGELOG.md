# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-06-19

### Added
- **6 new tools** (4→10): `search_models` (free-text search), `list_providers` (provider browser), `estimate_cost` (budget calculator), `list_new_models` (recent releases feed), `list_model_slugs` (provider slug lookup), `compare_providers` (same model across providers)
- **BFCL V4 agentic benchmark** — 109+ models with function-calling accuracy scores, percentile ranks
- **Speed/latency data** — 40+ measured models + heuristic estimates for ALL models based on pricing and family
- **Quality Index** — `quality` category in `list_top_models` using `getOverallBenchmarkScore()` (0-100 composite)
- **Streamable HTTP transport** — set `MCP_HTTP_PORT` or `PORT` env var for remote server mode with `/health` endpoint
- **Cost estimates** in `get_model_info` — per-call costs for typical/large/monthly usage patterns
- **Filter parity** — `max_input_price`, `max_output_price`, `require_vision`, `require_tools`, `require_open_source` on `list_top_models`
- **README.zh.md** — full Chinese translation of all documentation
- **README.ja.md** — fully rewritten to match v0.5 feature set
- **New Model Detection** section in all 3 READMEs documenting which data auto-detects new models

### Changed
- `list_top_models("speed")` now ranks by actual tok/s data instead of price proxy. Falls back to heuristic estimate when measured data is unavailable
- Tool count: 4 → 10, data sources: 5 → 7, percentile categories: 5 → 7
- `server.json` updated to v0.5.0 with HTTP transport annotation

### Fixed
- PR #2 Codex review findings (all 5): Perplexity/Inception open-source misclassification, coding composite ranking Arena-only models, package root import side effects, no-live smoke warmup
- Speed category now correctly uses measured speed data, not price proxy
- Unescaped model IDs in search, new-models, and providers table outputs
- Raw price formatting in search.ts replaced with `fmtPrice()` utility
- Percentiles JSDoc corrected from "five" to "seven" categories
- Unused `stdioTransport` variable removed

## [0.4.5] - 2026-06-17

### Changed
- Documentation / metadata only (no code change): aligned README badges and model count with reality (TypeScript 5.9, OpenRouter 300+), and `package.json` `author` now links to https://cognisant.io. Republished so npm and the MCP Registry reflect the updated metadata.

## [0.4.4] - 2026-06-17

### Fixed
- **VLM benchmark matching mis-attributed scores to the wrong models.** Open research models carrying the "gpt" stem (`PandaGPT`, `ShareGPT4V`, `MiniGPT`) collapsed onto `openai/gpt-chat-latest`, and `DeepSeek-VL` / `Phi-4-MultiModal` matched their non-vision base models. Substring matching now requires both keys ≥6 chars, plus a vision-token guard so a VL/vision model can't match a non-vision base. `GPT-4o` now correctly attributes to `openai/gpt-4o-*`. All retained VLM matches are now correct (+4 tests, 55 total).

### Added
- Glama listing badge in both READMEs (server is live at glama.ai).

### Changed
- Dev tooling: vitest 3→4, @types/node 22→25, tsup floor →8.5.1

## [0.4.3] - 2026-06-17

### Fixed
- **VLM benchmarks silently dropped to empty since ~2026-04-16.** TLS cert expiry. Switched to `cdn.opencompass.org.cn/assets/OpenVLM.json`.

### Added
- `npm run smoke` — live health check of all 5 data sources.

## [0.4.2] - 2026-02-25

### Added
- Registered to Official MCP Registry, Dockerfile, GitHub Release

## [0.4.1] - 2026-02-25

### Changed
- Rewrote README, added Japanese, CI workflow, package metadata

## [0.4.0] - 2026-02-25

### Added
- Release dates, freshness scoring, 8 new tests

## [0.3.1] - 2026-02-24

### Fixed
- OpenRouter meta-model filtering, fuzzy matching improvements

## [0.3.0] - 2026-02-24

### Added
- VLM benchmarks, Aider Polyglot, percentile ranks, 43 tests

## [0.2.0] - 2026-02-23

### Added
- `compare_models`, `recommend_model`, SWE-bench, Arena Elo

## [0.1.0] - 2026-02-23

### Added
- Initial release: `get_model_info`, `list_top_models`, OpenRouter integration
