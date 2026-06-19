import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import { MCP_REGISTRY_NAME, SERVER_VERSION } from "../metadata.js";
import { ensureRegistryLoaded } from "./schemas.js";
import { buildMarkdownTable, freshnessFooter } from "./formatters.js";

/**
 * Static mapping of OpenRouter model IDs to their provider-specific slugs.
 * Useful for users who deploy models on different backends (Bedrock, Groq, etc.)
 * and need to know the provider-specific model identifier.
 */
interface ProviderSlug {
  model: string;
  openrouter: string;
  bedrock?: string;
  groq?: string;
  together?: string;
  fireworks?: string;
  deepinfra?: string;
  cerebras?: string;
  sambanova?: string;
  google?: string;
  azure?: string;
}

const PROVIDER_SLUGS: ProviderSlug[] = [
  { model: "Claude Opus 4.8", openrouter: "anthropic/claude-opus-4.8", bedrock: "anthropic.claude-opus-4-8-20250522" },
  { model: "Claude Sonnet 4.6", openrouter: "anthropic/claude-sonnet-4.6", bedrock: "anthropic.claude-sonnet-4-6-20250522" },
  { model: "Claude Haiku 4.5", openrouter: "anthropic/claude-haiku-4.5", bedrock: "anthropic.claude-haiku-4-5-20250522" },
  { model: "Claude Opus 4.6", openrouter: "anthropic/claude-opus-4.6" },
  { model: "Claude Sonnet 4.5", openrouter: "anthropic/claude-sonnet-4.5" },
  { model: "GPT-5.5", openrouter: "openai/gpt-5.5", azure: "gpt-5-5" },
  { model: "GPT-5.4", openrouter: "openai/gpt-5.4" },
  { model: "GPT-5-mini", openrouter: "openai/gpt-5-mini" },
  { model: "GPT-4.1", openrouter: "openai/gpt-4.1", bedrock: "openai.gpt-4-1", azure: "gpt-4-1" },
  { model: "o3", openrouter: "openai/o3" },
  { model: "o4-mini", openrouter: "openai/o4-mini" },
  { model: "Gemini 3.1 Pro", openrouter: "google/gemini-3.1-pro", google: "gemini-3.1-pro", groq: "gemini-3.1-pro" },
  { model: "Gemini 3 Flash", openrouter: "google/gemini-3-flash", google: "gemini-3-flash" },
  { model: "Gemini 2.5 Pro", openrouter: "google/gemini-2.5-pro", google: "gemini-2.5-pro" },
  { model: "Gemini 2.5 Flash", openrouter: "google/gemini-2.5-flash", google: "gemini-2.5-flash" },
  { model: "DeepSeek V4 Pro", openrouter: "deepseek/deepseek-v4-pro", fireworks: "deepseek-v4-pro", together: "deepseek-ai/DeepSeek-V4-Pro" },
  { model: "DeepSeek V4 Flash", openrouter: "deepseek/deepseek-v4-flash", deepinfra: "DeepSeek-V4-Flash", fireworks: "deepseek-v4-flash" },
  { model: "DeepSeek Chat", openrouter: "deepseek/deepseek-chat", groq: "deepseek-r1-distill-llama-70b" },
  { model: "Llama 4 Maverick", openrouter: "meta-llama/llama-4-maverick", groq: "llama-4-maverick", together: "meta-llama/Llama-4-Maverick-17B-128E-Instruct", fireworks: "llama-v4-maverick" },
  { model: "Llama 4 Scout", openrouter: "meta-llama/llama-4-scout", groq: "llama-4-scout", together: "meta-llama/Llama-4-Scout-17B-16E-Instruct" },
  { model: "Mistral Large", openrouter: "mistralai/mistral-large", groq: "mistral-large-2407" },
  { model: "Grok 4", openrouter: "x-ai/grok-4" },
  { model: "Grok 4 Fast", openrouter: "x-ai/grok-4-fast" },
  { model: "GLM-5.2", openrouter: "z-ai/glm-5.2" },
  { model: "GLM-4.7 Flash", openrouter: "z-ai/glm-4.7-flash" },
  { model: "Qwen 3.5 Plus", openrouter: "qwen/qwen-3.5-plus", together: "Qwen/Qwen3.5-Plus" },
  { model: "Qwen 3.7 Max", openrouter: "qwen/qwen-3.7-max" },
  { model: "Phi-4", openrouter: "microsoft/phi-4", azure: "Phi-4" },
  { model: "Kimi K2.6", openrouter: "moonshot/kimi-k2.6" },
  { model: "Kimi K2.5", openrouter: "moonshot/kimi-k2.5" },
];

export function registerSlugsTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.registerTool(
    "list_model_slugs",
    {
      title: "List model slugs",
      description:
        `Look up provider-specific model slugs/IDs for popular models (llm-advisor ${SERVER_VERSION}, MCP registry ${MCP_REGISTRY_NAME}). ` +
        "Returns the OpenRouter ID along with provider-specific identifiers for Bedrock, Groq, Together, Fireworks, etc. " +
        "Optionally filter by model name or provider. " +
        "Returns a compact Markdown table (~200-400 tokens).",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        model: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe(
            'Filter by model name (e.g., "claude", "gpt", "gemini")'
          ),
        provider: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe(
            'Filter by target provider slug type (e.g., "bedrock", "groq", "together", "fireworks")'
          ),
      },
    },
    async ({ model: modelFilter, provider: providerFilter }) => {
      const loadError = await ensureRegistryLoaded(registry);
      if (loadError) return loadError;

      let filtered = PROVIDER_SLUGS;

      if (modelFilter) {
        const q = modelFilter.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            s.model.toLowerCase().includes(q) ||
            s.openrouter.toLowerCase().includes(q)
        );
      }

      if (providerFilter) {
        const p = providerFilter.toLowerCase();
        // Only show rows that have a slug for the requested provider
        filtered = filtered.filter((s) => {
          const keys = ["bedrock", "groq", "together", "fireworks", "deepinfra", "cerebras", "sambanova", "google", "azure"] as const;
          return keys.some((k) => p.includes(k) && s[k as keyof typeof s]);
        });
      }

      if (filtered.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No slug mappings found${modelFilter ? ` for "${modelFilter}"` : ""}${providerFilter ? ` with provider "${providerFilter}"` : ""}.`,
            },
          ],
        };
      }

      const output = formatSlugsList(filtered, modelFilter, providerFilter);

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}

function formatSlugsList(
  slugs: ProviderSlug[],
  modelFilter?: string,
  providerFilter?: string
): string {
  const lines: string[] = [];
  lines.push(`## Model Slugs (${slugs.length} models)`);
  lines.push("");

  // Collect all non-OpenRouter provider columns that have data
  const providerKeys: (keyof ProviderSlug)[] = [
    "bedrock", "groq", "together", "fireworks", "deepinfra",
    "cerebras", "sambanova", "google", "azure",
  ];
  const activeProviders = providerKeys.filter((k) =>
    slugs.some((s) => s[k])
  );

  const headers = ["Model", "OpenRouter", ...activeProviders.map(capitalize)];
  const rows = slugs.map((s) => {
    const row: string[] = [s.model, s.openrouter];
    for (const k of activeProviders) {
      row.push(s[k] ?? "—");
    }
    return row;
  });

  lines.push(buildMarkdownTable(headers, rows, rows.length));
  return lines.join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
