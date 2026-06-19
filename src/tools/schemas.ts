import { z } from "zod";
import type { ModelRegistry } from "../data/registry.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Strict calendar-date schema for tool inputs that accept YYYY-MM-DD filters. */
export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_RE, "Expected date in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Expected a valid calendar date in YYYY-MM-DD format");

export async function ensureRegistryLoaded(registry: ModelRegistry): Promise<{
  content: [{ type: "text"; text: string }];
  isError: true;
} | null> {
  try {
    await registry.ensureLoaded();
    return null;
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: "Model data is temporarily unavailable. Please retry shortly.",
        },
      ],
      isError: true,
    };
  }
}
