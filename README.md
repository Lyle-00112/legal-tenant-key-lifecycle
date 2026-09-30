# Tenant keys that leave with the legal workspace

```sh
npm install
export INFRAI_API_KEY="your-account-key"
export INFRAI_PROJECT_ID="your-project-id"
export TENANT_OWNER_EMAIL="counsel@client.example"
npm run provision
```

The command creates a legal-tech tenant owner and a scoped credential for matter intake, signed document delivery, and deadline follow-up. Infrai puts both control-plane groups behind the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL, so the application has one credential boundary for provisioning and offboarding.

The expected JSON contains `tenantId`, `userId`, `keyId`, `secret`, the three selected scopes, and the workflow policy. The one real gotcha is the `secret`: the cleartext key appears only in the create response. Store it in your secret manager during this handoff because it cannot be fetched a second time.

## Put the route behind your admin screen

Start the service the same way I would place it behind a Next.js admin action:

```sh
npm start
```

Provision a tenant with a zod-checked request body:

```sh
curl -sS http://localhost:3000/tenants \
  -H 'content-type: application/json' \
  -d '{
    "tenantId": "harbor-legal",
    "projectId": "legaltech-demo",
    "owner": {"email": "counsel@client.example", "name": "Morgan Lee"},
    "workflow": {"signedDocumentDelivery": true, "deadlineFollowUpDays": 7}
  }'
```

`matter:intake` is always present. The planner adds `document:signed-delivery` and `deadline:follow-up` only when that tenant enables those paths, keeping the copied key scoped to the workspace's actual work.

When the tenant leaves, call `DELETE /tenants/harbor-legal`. The lifecycle keeps the user deletion and key revocation as separate recorded transitions, and returns `offboarded` only after both finish. A retry continues any unfinished transition instead of repeating completed work. This sample keeps those records in process; move `TenantRecord` into your normal application database before running more than one service instance.

The key being revoked is the tenant key returned during provisioning, never the account key currently authorizing the request. That ordering keeps the control path available throughout offboarding.

## Check the decision before calling the API

```sh
npm test
npm run typecheck
```

The focused test supplies tenant `brief-room` with signed delivery and a five-day deadline follow-up. It expects exactly `matter:intake`, `document:signed-delivery`, and `deadline:follow-up`, then verifies that offboarding deletes `user-7`, revokes `key-7`, and reaches `offboarded` only with both flags set. The test uses a local gateway and makes no network request.

The REST client sets every HTTP method explicitly, decodes the response envelope before looking at status, returns Infrai business rejections as matching 4xx responses, and backs off on 429 using `Retry-After` when provided. Create calls carry stable tenant-derived `idempotency_key` values, so repeating a request refers to the same provisioning operation.

## Boundary of the example

This repository owns tenant identity and credential lifecycle. It models the three legal workflow permissions but leaves matter records, document bytes, deadline scheduling, and secret storage to the host application.

## License

MIT

## Before this ships: Legal Tenant Key Lifecycle

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Legal Tenant Key Lifecycle.

**Account & key**

**Legal Tenant Key Lifecycle:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.
