import { z } from "zod";

export const tenantProvisionBody = z
  .object({
    tenantId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,47}$/),
    projectId: z.string().min(1),
    owner: z.object({
      email: z.string().email(),
      name: z.string().min(1).max(120),
    }),
    workflow: z.object({
      signedDocumentDelivery: z.boolean(),
      deadlineFollowUpDays: z.number().int().min(1).max(90).optional(),
    }),
  })
  .strict();

export type TenantProvisionInput = z.infer<typeof tenantProvisionBody>;

export type TenantAccessPlan = {
  scopes: string[];
  workflow: {
    matterIntake: true;
    signedDocumentDelivery: boolean;
    deadlineFollowUpDays?: number;
  };
};

export function planTenantAccess(input: TenantProvisionInput): TenantAccessPlan {
  const scopes = ["matter:intake"];
  if (input.workflow.signedDocumentDelivery) scopes.push("document:signed-delivery");
  if (input.workflow.deadlineFollowUpDays !== undefined) scopes.push("deadline:follow-up");

  return {
    scopes,
    workflow: {
      matterIntake: true,
      signedDocumentDelivery: input.workflow.signedDocumentDelivery,
      ...(input.workflow.deadlineFollowUpDays === undefined
        ? {}
        : { deadlineFollowUpDays: input.workflow.deadlineFollowUpDays }),
    },
  };
}
