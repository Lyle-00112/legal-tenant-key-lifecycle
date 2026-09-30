import { tenantProvisionBody } from "../src/tenant_access.js";
import { TenantLifecycle } from "../src/tenant_lifecycle.js";

const input = tenantProvisionBody.parse({
  tenantId: process.env.TENANT_ID ?? "harbor-legal",
  projectId: process.env.INFRAI_PROJECT_ID ?? "legaltech-demo",
  owner: {
    email: process.env.TENANT_OWNER_EMAIL ?? "owner@example.com",
    name: process.env.TENANT_OWNER_NAME ?? "Morgan Lee",
  },
  workflow: {
    signedDocumentDelivery: true,
    deadlineFollowUpDays: 7,
  },
});

const credential = await new TenantLifecycle().provision(input);
console.log(JSON.stringify(credential, null, 2));
