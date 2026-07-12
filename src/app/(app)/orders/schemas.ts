import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v.length ? v : undefined))
  .optional();

const money = z.coerce.number().min(0).max(999_999_999).default(0);

export const createOrderFormSchema = z.object({
  customerName: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "Customer name is required.").max(200)),
  customerAddress: optionalTrimmedString,
  customerPhone: optionalTrimmedString,
  notes: optionalTrimmedString,
  lineItems: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.coerce.number().int().positive("Quantity must be positive.").max(1_000_000_000),
      })
    )
    .min(1, "Add at least one item."),
});

export type CreateOrderInput = z.infer<typeof createOrderFormSchema>;

export const assignDriverFormSchema = z.object({
  driverId: z.string().min(1).nullable(),
});

export type AssignDriverInput = z.infer<typeof assignDriverFormSchema>;

export const deliverOrderFormSchema = z.object({
  payments: z.array(
    z.object({
      lineItemId: z.string().min(1),
      cashAmount: money,
      interacAmount: money,
    })
  ),
});

export type DeliverOrderInput = z.infer<typeof deliverOrderFormSchema>;
