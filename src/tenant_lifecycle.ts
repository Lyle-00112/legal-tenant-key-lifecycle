import { infrai, type CreatedKey, type CreatedUser } from "./infrai_control_plane.js";
import { planTenantAccess, type TenantProvisionInput } from "./tenant_access.js";

export type TenantRecord = {
  tenantId: string;
  userId: string;
  keyId: string;
  state: "active" | "offboarding" | "offboarded";
  userDeleted: boolean;
  keyRevoked: boolean;
};

export type TenantCredential = {
  tenantId: string;
  userId: string;
  keyId: string;
  secret: string;
  scopes: string[];
  workflow: ReturnType<typeof planTenantAccess>["workflow"];
};

export type TenantGateway = {
  createUser(input: TenantProvisionInput): Promise<CreatedUser>;
  createKey(input: TenantProvisionInput, scopes: string[]): Promise<CreatedKey>;
  deleteUser(userId: string): Promise<unknown>;
  revokeKey(keyId: string): Promise<unknown>;
};

export const liveTenantGateway: TenantGateway = {
  createUser: (input) =>
    infrai.auth.user.create({
      email: input.owner.email,
      name: input.owner.name,
      metadata: { tenant_id: input.tenantId, role: "legal_tenant_owner" },
      idempotency_key: `tenant:${input.tenantId}:owner`,
    }),
  createKey: (input, scopes) =>
    infrai.account.keys.create({
      project_id: input.projectId,
      name: `${input.tenantId} legal workflows`,
      scopes,
      idempotency_key: `tenant:${input.tenantId}:key`,
    }),
  deleteUser: (userId) => infrai.auth.user.delete(userId),
  revokeKey: (keyId) => infrai.account.keys.revoke(keyId),
};

export class TenantLifecycle {
  private readonly records = new Map<string, TenantRecord>();
  private readonly gateway: TenantGateway;

  constructor(gateway: TenantGateway = liveTenantGateway) {
    this.gateway = gateway;
  }

  async provision(input: TenantProvisionInput): Promise<TenantCredential> {
    if (this.records.has(input.tenantId)) throw new Error("Tenant is already provisioned");
    const plan = planTenantAccess(input);
    const user = await this.gateway.createUser(input);
    let createdKey: CreatedKey;
    try {
      createdKey = await this.gateway.createKey(input, plan.scopes);
    } catch (error) {
      await this.gateway.deleteUser(user.user_id);
      throw error;
    }

    this.records.set(input.tenantId, {
      tenantId: input.tenantId,
      userId: user.user_id,
      keyId: createdKey.key_id,
      state: "active",
      userDeleted: false,
      keyRevoked: false,
    });
    return {
      tenantId: input.tenantId,
      userId: user.user_id,
      keyId: createdKey.key_id,
      secret: createdKey.key_secret,
      scopes: plan.scopes,
      workflow: plan.workflow,
    };
  }

  async offboard(tenantId: string): Promise<TenantRecord> {
    const record = this.records.get(tenantId);
    if (!record) throw new Error("Tenant is not provisioned in this process");
    record.state = "offboarding";

    const jobs: Promise<void>[] = [];
    if (!record.userDeleted) {
      jobs.push(this.gateway.deleteUser(record.userId).then(() => { record.userDeleted = true; }));
    }
    if (!record.keyRevoked) {
      jobs.push(this.gateway.revokeKey(record.keyId).then(() => { record.keyRevoked = true; }));
    }
    const results = await Promise.allSettled(jobs);
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") throw rejected.reason;

    record.state = "offboarded";
    return { ...record };
  }
}
