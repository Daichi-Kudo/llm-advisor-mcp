---
name: llm-advisor
description: Use current LLM/VLM pricing, benchmarks, provider slugs, and model recommendations from llm-advisor-mcp. Trigger this skill when choosing an AI model, comparing models, checking provider prices, estimating API spend, finding current model releases, or mapping model IDs across OpenRouter, Bedrock, Vertex AI, Groq, Together, Fireworks, DeepInfra, Azure, Google, Replicate, and Hugging Face.
---

# LLM Advisor

Use the standalone CLI when MCP tools are not already available in the current client. If the `llm-advisor-mcp` server is installed as MCP, call those tools directly instead.

## CLI

Run commands through npm without installing the MCP server in a client:

```bash
npx -y --package llm-advisor-mcp llm-advisor top coding --limit 5
```

For exact MCP parity, use `run` with the MCP tool name and JSON arguments:

```bash
npx -y --package llm-advisor-mcp llm-advisor run list_top_models --json '{"category":"coding","limit":5,"require_tools":true}'
```

Common commands:

- `llm-advisor info <model>`
- `llm-advisor top <category> --limit 10`
- `llm-advisor compare <model> <model> [model...]`
- `llm-advisor recommend <use_case> --max-input-price 3 --require-tools`
- `llm-advisor search <query> --category coding`
- `llm-advisor providers --provider anthropic`
- `llm-advisor estimate <model> --input-tokens 10000 --output-tokens 2000 --monthly-calls 30000`
- `llm-advisor new-models --max-age-days 90`
- `llm-advisor slugs --model claude --provider bedrock`
- `llm-advisor compare-providers <model>`

## MCP Tool Names

Use these names with MCP clients or `llm-advisor run`:

- `get_model_info`
- `list_top_models`
- `compare_models`
- `recommend_model`
- `search_models`
- `list_providers`
- `estimate_cost`
- `list_new_models`
- `list_model_slugs`
- `compare_providers`

Prefer `run` for advanced filters because it accepts the exact MCP JSON schema. Prefer short commands for quick terminal use.

## Response Practice

- Keep the command output intact when the user asks for current model data.
- Say that upstream data can lag when release dates, prices, or benchmarks look odd.
- Do not guess current prices or rankings from memory. Run the tool.
