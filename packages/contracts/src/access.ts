import { z } from "zod";
import { CAPABILITIES, ROLES } from "./roles";

/** Access-management inputs (SEC-004, SEC-011). */
export const roleSchema = z.enum(ROLES);
export const capabilitySchema = z.enum(CAPABILITIES);

export const updateUserRolesSchema = z.object({
  userId: z.uuid(),
  roles: z.array(roleSchema).min(1, "validation.rolesRequired").max(ROLES.length),
});

export const setUserStatusSchema = z.object({
  userId: z.uuid(),
  disabled: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

export const matrixChangesSchema = z.object({
  changes: z
    .array(z.object({ role: roleSchema, capability: capabilitySchema, granted: z.boolean() }))
    .min(1)
    .max(ROLES.length * CAPABILITIES.length),
});

export const USER_STATUS_FILTERS = ["all", "active", "disabled", "noMfa"] as const;

export const userQuerySchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  role: roleSchema.optional().catch(undefined),
  status: z.enum(USER_STATUS_FILTERS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});
export type UserQuery = z.infer<typeof userQuerySchema>;
