import assert from "node:assert/strict";
import test from "node:test";
import { planTenantAccess, tenantProvisionBody } from "../src/tenant_access.js";
import { TenantLifecycle, type TenantGateway } from "../src/tenant_lifecycle.js";

const tenant = tenantProvisionBody.parse({
  tenantId: "brief-room",
  projectId: "project-12",
  owner: { email: "counsel@example.com", name: "Ari Counsel" },
  workflow: { signedDocumentDelivery: true, deadlineFollowUpDays: 5 },
});

test("a matter tenant receives only its selected workflow scopes", () => {
  assert.deepEqual(planTenantAccess(tenant).scopes, [
    "matter:intake",
    "document:signed-delivery",
    "deadline:follow-up",
  ]);
});

test("offboarding completes both ownership and credential transitions", async () => {
  const calls: string[] = [];
  const gateway: TenantGateway = {
    createUser: async () => ({ user_id: "user-7" }),
    createKey: async (_input, scopes) => {
      assert.deepEqual(scopes, ["matter:intake", "document:signed-delivery", "deadline:follow-up"]);
      return { key_id: "key-7", key_secret: "issued-once" };
    },
    deleteUser: async (id) => { calls.push(`delete:${id}`); },
    revokeKey: async (id) => { calls.push(`revoke:${id}`); },
  };
  const lifecycle = new TenantLifecycle(gateway);

  await lifecycle.provision(tenant);
  const result = await lifecycle.offboard(tenant.tenantId);

  assert.deepEqual(calls.sort(), ["delete:user-7", "revoke:key-7"]);
  assert.equal(result.state, "offboarded");
  assert.equal(result.userDeleted, true);
  assert.equal(result.keyRevoked, true);
});
