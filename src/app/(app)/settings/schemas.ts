import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";

const nameSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, "Name is required.").max(200));

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().min(1, "Email is required.").max(320).email("Enter a valid email address."));

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200);

const permissionsSchema = z.array(z.enum(PERMISSIONS)).default([]);

export const createUserFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  permissions: permissionsSchema,
});

export const updatePermissionsFormSchema = z.object({
  permissions: permissionsSchema,
});

export const resetPasswordFormSchema = z.object({
  password: passwordSchema,
});

export const updateOwnProfileFormSchema = z.object({
  name: nameSchema,
});

export const changeOwnPasswordFormSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: passwordSchema,
});

// Phase 13c: org-level settings (AppConfig, one row per org).
export const orgSettingsFormSchema = z.object({
  businessName: z
    .string()
    .trim()
    .max(200, "Business name is too long.")
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
  defaultLowStock: z.coerce
    .number()
    .int("Enter a whole number.")
    .min(0, "Can't be negative.")
    .max(1_000_000),
});
