import { z } from "zod";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Strict calendar-date schema for tool inputs that accept YYYY-MM-DD filters. */
export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_RE, "Expected date in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Expected a valid calendar date in YYYY-MM-DD format");
