import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import { MCP_REGISTRY_NAME, SERVER_VERSION } from "../metadata.js";
import { ensureRegistryLoaded } from "./schemas.js";
import { buildMarkdownTable, freshnessFooter } from "./formatters.js";

/**
 * Provider slug generator.
 *
 * Uses known mappings for popular models AND auto-generates slugs for ANY
 * model based on provider-specific naming conventions. This ensures every
 * model in the registry gets at least estimated slug data — new models are
 * auto-detected without requiring code updates.
 */
export interface ProviderSlug {
  model: string;
  openrouter: string;
  bedrock?: string;
  vertexAi?: string;
  groq?: string;
  together?: string;
  fireworks?: string;
  deepinfra?: string;
  cerebras?: string;
  sambanova?: string;
  google?: string;
  azure?: string;
  replicate?: string;
  huggingface?: string;
}

export type ProviderKey = keyof Omit<ProviderSlug, "model" | "openrouter">;

/**
 * Known exact slug mappings for models with non-standard slug formats.
 * Models whose slugs follow standard patterns are auto-generated below.
 */
const KNOWN_SLUGS: ProviderSlug[] = [
  { model: "Claude Opus 4.8", openrouter: "anthropic/claude-opus-4.8", bedrock: "anthropic.claude-opus-4-8-20250522", vertexAi: "claude-opus-4-8@20250522" },
  { model: "Claude Sonnet 4.6", openrouter: "anthropic/claude-sonnet-4.6", bedrock: "anthropic.claude-sonnet-4-6-20250522", vertexAi: "claude-sonnet-4-6@20250522" },
  { model: "Claude Haiku 4.5", openrouter: "anthropic/claude-haiku-4.5", bedrock: "anthropic.claude-haiku-4-5-20250522", vertexAi: "claude-haiku-4-5@20250522" },
  { model: "GPT-5.5", openrouter: "openai/gpt-5.5", azure: "gpt-5-5" },
  { model: "GPT-4.1", openrouter: "openai/gpt-4.1", bedrock: "openai.gpt-4-1", azure: "gpt-4-1" },
  { model: "Gemini 3.1 Pro", openrouter: "google/gemini-3.1-pro", google: "gemini-3.1-pro", groq: "gemini-3.1-pro", vertexAi: "gemini-3.1-pro" },
  { model: "Gemini 3 Flash", openrouter: "google/gemini-3-flash", google: "gemini-3-flash", vertexAi: "gemini-3-flash" },
  { model: "Gemini 2.5 Pro", openrouter: "google/gemini-2.5-pro", google: "gemini-2.5-pro", vertexAi: "gemini-2.5-pro" },
  { model: "Gemini 2.5 Flash", openrouter: "google/gemini-2.5-flash", google: "gemini-2.5-flash", vertexAi: "gemini-2.5-flash" },
  { model: "DeepSeek V4 Pro", openrouter: "deepseek/deepseek-v4-pro", fireworks: "deepseek-v4-pro", together: "deepseek-ai/DeepSeek-V4-Pro" },
  { model: "DeepSeek V4 Flash", openrouter: "deepseek/deepseek-v4-flash", deepinfra: "DeepSeek-V4-Flash", fireworks: "deepseek-v4-flash" },
  { model: "Llama 4 Maverick", openrouter: "meta-llama/llama-4-maverick", groq: "llama-4-maverick", together: "meta-llama/Llama-4-Maverick-17B-128E-Instruct", fireworks: "llama-v4-maverick", vertexAi: "llama-4-maverick" },
  { model: "Llama 4 Scout", openrouter: "meta-llama/llama-4-scout", groq: "llama-4-scout", together: "meta-llama/Llama-4-Scout-17B-16E-Instruct" },
];

/**
 * Generate provider slugs for ANY model using naming heuristics.
 * This is the key to auto-detecting new models — every model gets
 * estimated slug data even without an explicit mapping.
 */
function generateSlug(modelId: string): ProviderSlug {
  const displayName = modelId.split("/").pop() ?? modelId;
  const [provider, ...rest] = modelId.split("/");
  const modelName = rest.join("-");

  const slug: ProviderSlug = {
    model: displayName.charAt(0).toUpperCase() + displayName.slice(1),
    openrouter: modelId,
  };

  // Bedrock: only for providers known to be on Bedrock
  if (["anthropic", "openai"].includes(provider)) {
    slug.bedrock = provider === "anthropic"
      ? `anthropic.${modelName.replace(/-20\d{6}/g, "").replace(/-thinking.*$/, "")}`
      : `openai.${modelName.replace(/-20\d{6}/g, "").replace(/-thinking.*$/, "")}`;
  }

  // Groq: model name without provider prefix (most use the same slug)
  slug.groq = modelName;

  // Together: Organization/Model-Name
  const org = provider === "meta-llama" ? "meta-llama" :
    provider === "deepseek" ? "deepseek-ai" : provider;
  slug.together = `${org}/${toTitleCase(modelName)}`;

  // Fireworks: model-name (lowercase, stripped of version dates)
  slug.fireworks = modelName.replace(/-20\d{6}/g, "").replace(/-latest$/, "");

  // DeepInfra: Model-Name
  slug.deepinfra = toTitleCase(modelName);

  // Vertex AI: provider-prefixed model name with @version format
  const cleanName = modelName.replace(/-20\d{6}/g, "").replace(/-latest$/, "").replace(/-thinking.*$/, "");
  if (["anthropic", "google", "meta-llama", "mistralai"].includes(provider)) {
    slug.vertexAi = provider === "google"
      ? cleanName
      : `${cleanName}`;
  }

  // Replicate: owner/model-name (lowercase)
  slug.replicate = `${provider}/${modelName.replace(/-20\d{6}/g, "").replace(/-thinking.*$/, "").toLowerCase()}`;

  // HuggingFace: provider/model-name
  slug.huggingface = `${provider}/${cleanName}`;

  // Google AI Studio: model-name
  if (provider === "google") slug.google = modelName;

  // Azure OpenAI: model-name
  if (provider === "openai") slug.azure = modelName.replace(/-20\d{6}/g, "");

  return slug;
}

function toTitleCase(s: string): string {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("-");
}

/**
 * Get slugs for ALL models in the registry.
 * Uses known mappings where available, auto-generates for the rest.
 */
function getAllSlugs(allModelIds: string[]): ProviderSlug[] {
  const slugMap = new Map<string, ProviderSlug>();

  for (const known of KNOWN_SLUGS) {
    slugMap.set(known.openrouter, known);
  }

  for (const id of allModelIds) {
    if (!slugMap.has(id)) {
      slugMap.set(id, generateSlug(id));
    }
  }

  return Array.from(slugMap.values());
}

const ALL_PROVIDER_KEYS: ProviderKey[] = [
  "bedrock", "vertexAi", "groq", "together", "fireworks", "deepinfra",
  "cerebras", "sambanova", "google", "azure", "replicate", "huggingface",
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
        `Look up provider-specific model slugs/IDs for ANY model (llm-advisor ${SERVER_VERSION}, MCP registry ${MCP_REGISTRY_NAME}). ` +
        "Returns the OpenRouter ID along with provider-specific identifiers for Bedrock, Groq, Together, Fireworks, etc. " +
        "New models are auto-detected using naming heuristics. " +
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

      // Dynamically generate slugs for ALL models in the registry
      const allModelIds = registry.getAllModels().map((m) => m.id);
      const allSlugs = getAllSlugs(allModelIds);

      let filtered = allSlugs;

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
        filtered = filtered.filter((s) =>
          ALL_PROVIDER_KEYS.some((k) => p.includes(k) && s[k])
        );
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

      const output = formatSlugsList(filtered, filtered.length);

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}

function formatSlugsList(
  slugs: ProviderSlug[],
  totalCount: number
): string {
  const lines: string[] = [];
  lines.push(`## Model Slugs (${totalCount} models)`);
  lines.push("");

  const activeProviders = ALL_PROVIDER_KEYS.filter((k) =>
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
