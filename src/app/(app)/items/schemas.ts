import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v.length ? v : undefined))
  .optional();

const money = z.coerce.number().min(0).max(999_999_999).default(0);

export const itemFormSchema = z.object({
  name: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "Item name is required.").max(200)),
  category: optionalTrimmedString,
  description: optionalTrimmedString,
  location: optionalTrimmedString,
  minStock: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  customFields: optionalTrimmedString,
  unitCost: money,
  unitPrice: money,
});

export const createItemFormSchema = itemFormSchema.extend({
  initialQuantity: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
});

export const movementFormSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("RECEIVE"),
    amount: z.coerce.number().int().positive("Enter a positive quantity to receive.").max(1_000_000_000),
    unitCost: money.optional(),
    reason: optionalTrimmedString,
  }),
  z.object({
    type: z.literal("REMOVE"),
    amount: z.coerce.number().int().positive("Enter a positive quantity to remove.").max(1_000_000_000),
    cashAmount: money,
    interacAmount: money,
    reason: optionalTrimmedString,
  }),
  z.object({
    type: z.literal("ADJUST"),
    counted: z.coerce.number().int().min(0).max(1_000_000_000),
    reason: optionalTrimmedString,
  }),
]);

export type MovementFormInput = z.infer<typeof movementFormSchema>;

export function parseCustomFields(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const entries: [string, string][] = [];
  const seen = new Set<string>();
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    entries.push([key, value]);
  }
  return entries.length ? Object.fromEntries(entries) : undefined;
}
