/**
 * Static data for locally-runnable Ollama models.
 *
 * These models can be run locally via Ollama (ollama.com) and have
 * different pricing (free/self-hosted) and comparison dimensions
 * than API-based models.
 *
 * Hardware requirements reference:
 * - 4B: ~3GB VRAM, runs on most Macs/GPUs
 * - 8B: ~6GB VRAM, runs on M-series Macs, RTX 3060+
 * - 35B: ~20GB VRAM, runs on RTX 3090/4090, M-series Max/Ultra
 * - 70B: ~40GB VRAM, runs on multi-GPU setups
 * - 120B+: requires multi-GPU or cloud GPU
 *
 * Data sourced from Ollama model library, OpenRouter community benchmarks,
 * and independent benchmarking. Updated with each release.
 */
export interface OllamaModel {
  name: string;
  parameterSize: string;
  minVramGb: number;
  /** Recommended hardware tier */
  hardwareTier: "mac" | "consumer-gpu" | "pro-gpu" | "multi-gpu";
  /** Quality score 0-100 (approximate, from public benchmarks) */
  qualityScore: number;
  /** Coding capability 0-100 */
  codingScore: number;
  /** Reasoning capability 0-100 */
  reasoningScore: number;
  /** Context length supported */
  contextLength: number;
  /** Notes */
  notes: string;
}

const OLLAMA_MODELS: OllamaModel[] = [
  // ── Frontier local models ──────────────────────────
  { name: "Qwen3.5 122B", parameterSize: "122B", minVramGb: 68, hardwareTier: "multi-gpu", qualityScore: 42, codingScore: 45, reasoningScore: 48, contextLength: 131072, notes: "Best open-weight for agentic tasks; strong tool use" },
  { name: "DeepSeek V4 Pro", parameterSize: "Unkn", minVramGb: 80, hardwareTier: "multi-gpu", qualityScore: 44, codingScore: 50, reasoningScore: 46, contextLength: 131072, notes: "1.6T MoE; strong coding but requires massive hardware" },
  { name: "Qwen3.7 Max", parameterSize: "397B", minVramGb: 100, hardwareTier: "multi-gpu", qualityScore: 46, codingScore: 48, reasoningScore: 50, contextLength: 262144, notes: "397B MoE; top-tier open-weight reasoning" },

  // ── Large local models ─────────────────────────────
  { name: "Qwen3 235B", parameterSize: "235B", minVramGb: 48, hardwareTier: "pro-gpu", qualityScore: 40, codingScore: 42, reasoningScore: 44, contextLength: 131072, notes: "Strong MoE; runs on 2x RTX 3090" },
  { name: "Llama 4 Maverick", parameterSize: "17B", minVramGb: 24, hardwareTier: "pro-gpu", qualityScore: 38, codingScore: 40, reasoningScore: 36, contextLength: 131072, notes: "17B MoE; excellent coding; requires decent GPU" },
  { name: "Kimi K2.6", parameterSize: "Unkn", minVramGb: 80, hardwareTier: "multi-gpu", qualityScore: 43, codingScore: 44, reasoningScore: 46, contextLength: 262144, notes: "Moonshot's best open model; long context" },

  // ── Mid-size local models ──────────────────────────
  { name: "Qwen3.5 32B", parameterSize: "32B", minVramGb: 20, hardwareTier: "pro-gpu", qualityScore: 36, codingScore: 38, reasoningScore: 40, contextLength: 131072, notes: "Excellent for its size; runs on single RTX 3090" },
  { name: "DeepSeek V3.2 0324", parameterSize: "671B", minVramGb: 48, hardwareTier: "pro-gpu", qualityScore: 39, codingScore: 42, reasoningScore: 40, contextLength: 128000, notes: "MoE; ~37B active params; strong for its active size" },
  { name: "Mistral Small 4", parameterSize: "24B", minVramGb: 14, hardwareTier: "consumer-gpu", qualityScore: 32, codingScore: 34, reasoningScore: 33, contextLength: 131072, notes: "Good for its size; runs on RTX 4070+; multilingual" },
  { name: "Qwen3.5 14B", parameterSize: "14B", minVramGb: 10, hardwareTier: "consumer-gpu", qualityScore: 30, codingScore: 32, reasoningScore: 33, contextLength: 131072, notes: "Strong value; runs on RTX 3060 12GB" },
  { name: "Llama 4 Scout", parameterSize: "17B", minVramGb: 12, hardwareTier: "consumer-gpu", qualityScore: 28, codingScore: 30, reasoningScore: 28, contextLength: 131072, notes: "17B MoE; runs on consumer GPUs; strong long context" },

  // ── Small local models ─────────────────────────────
  { name: "Qwen3.5 8B", parameterSize: "8B", minVramGb: 6, hardwareTier: "mac", qualityScore: 25, codingScore: 27, reasoningScore: 26, contextLength: 65536, notes: "Excellent for its size; runs on M-series Macs" },
  { name: "Llama 4.2 8B", parameterSize: "8B", minVramGb: 6, hardwareTier: "mac", qualityScore: 24, codingScore: 25, reasoningScore: 24, contextLength: 65536, notes: "Solid 8B; runs on any M-series Mac" },
  { name: "Mistral 7B", parameterSize: "7B", minVramGb: 5, hardwareTier: "mac", qualityScore: 22, codingScore: 23, reasoningScore: 22, contextLength: 32768, notes: "Classic; tiny footprint; fast on any hardware" },
  { name: "Phi-4 14B", parameterSize: "14B", minVramGb: 8, hardwareTier: "consumer-gpu", qualityScore: 28, codingScore: 30, reasoningScore: 29, contextLength: 16384, notes: "Microsoft's best open model; strong reasoning for size" },
  { name: "Gemma 3 27B", parameterSize: "27B", minVramGb: 16, hardwareTier: "consumer-gpu", qualityScore: 31, codingScore: 30, reasoningScore: 33, contextLength: 131072, notes: "Google's open model; strong math; runs on RTX 4080" },
  { name: "Qwen3.5 4B", parameterSize: "4B", minVramGb: 3, hardwareTier: "mac", qualityScore: 18, codingScore: 19, reasoningScore: 20, contextLength: 32768, notes: "Tiny but capable; runs on any Mac with 8GB RAM" },

  // ── Vision-capable local models ────────────────────
  { name: "Qwen3.6 Vision 35B", parameterSize: "35B", minVramGb: 24, hardwareTier: "pro-gpu", qualityScore: 34, codingScore: 35, reasoningScore: 36, contextLength: 131072, notes: "Best local VLM; strong vision and reasoning" },
  { name: "Qwen3 VL 32B", parameterSize: "32B", minVramGb: 22, hardwareTier: "pro-gpu", qualityScore: 32, codingScore: 33, reasoningScore: 34, contextLength: 131072, notes: "Vision-language; good OCR and document understanding" },
  { name: "LLaVA 1.6 34B", parameterSize: "34B", minVramGb: 24, hardwareTier: "pro-gpu", qualityScore: 28, codingScore: 25, reasoningScore: 30, contextLength: 4096, notes: "Popular open VLM; strong general vision tasks" },
];

export function getOllamaModels(): OllamaModel[] {
  return OLLAMA_MODELS;
}

export function getHardwareTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    mac: "Mac (M-series)",
    "consumer-gpu": "Consumer GPU (RTX 3060-4080)",
    "pro-gpu": "Pro GPU (RTX 3090/4090)",
    "multi-gpu": "Multi-GPU / Cloud",
  };
  return labels[tier] ?? tier;
}
