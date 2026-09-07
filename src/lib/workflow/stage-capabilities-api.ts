import { z } from "zod";
import {
  stageCapabilitiesSchema,
  type StageCapabilities,
} from "@/lib/workflow/stage-capabilities";
import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";

/** Partial capabilities accepted from admin forms / APIs. */
export const stageCapabilitiesInputSchema = stageCapabilitiesSchema.partial();

export type StageCapabilitiesInput = z.infer<typeof stageCapabilitiesInputSchema>;

export function buildCapabilitiesForWrite(input: {
  isApproval?: boolean;
  isFileRequired?: boolean;
  isCorrectionAllowed?: boolean;
  capabilities?: Partial<StageCapabilities> | null;
  code?: string;
}): StageCapabilities {
  const behavior = resolveStageBehavior({
    code: input.code ?? "CUSTOM",
    isApproval: input.isApproval,
    isFileRequired: input.isFileRequired,
    isCorrectionAllowed: input.isCorrectionAllowed,
    capabilities: input.capabilities,
  });
  return behavior.capabilities;
}

export function syncColumnFlagsFromCapabilities(caps: StageCapabilities) {
  return {
    isApproval: caps.isApproval,
    isFileRequired: caps.requiresFile,
    isCorrectionAllowed: caps.isCorrectionAllowed,
  };
}

export const subProcessCreateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  sequence: z.number().int().positive(),
  defaultRoleId: z.number().int().positive().optional(),
  isApproval: z.boolean().optional(),
  isFileRequired: z.boolean().optional(),
  isCorrectionAllowed: z.boolean().optional(),
  capabilities: stageCapabilitiesInputSchema.optional(),
});

export type SubProcessCreateBody = z.infer<typeof subProcessCreateSchema>;

export const subProcessPatchSchema = z.object({
  name: z.string().min(1).optional(),
  sequence: z.number().int().positive().optional(),
  defaultRoleId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
  isApproval: z.boolean().optional(),
  isFileRequired: z.boolean().optional(),
  isCorrectionAllowed: z.boolean().optional(),
  capabilities: stageCapabilitiesInputSchema.optional().nullable(),
});

export type SubProcessPatchBody = z.infer<typeof subProcessPatchSchema>;
