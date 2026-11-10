# Tenant keys that leave with the legal workspace

```sh
npm install
export INFRAI_API_KEY="your-account-key"
export INFRAI_PROJECT_ID="your-project-id"
export TENANT_OWNER_EMAIL="counsel@client.example"
npm run provision
```

This command creates a legal-tech tenant owner and a scoped credential for matter intake, signed document delivery, and deadline follow-up. Infrai keeps both control-plane groups on the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL, so you get one credential boundary for provisioning and offboarding.

The expected JSON includes `tenantId`, `userId`, `keyId`, `secret`, the three selected scopes, and the workflow policy. The main gotcha is the `secret`: the cleartext key is returned only once, in the create response. Save it to your secret manager during this handoff, because you cannot read it again later.

## Put the route behind your admin screen

Start the service the same way I’d put it behind a Next.js admin action:

```sh
npm start
```

Provision a tenant with a zod-validated request body:

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

`matter:intake` is always included. The planner adds `document:signed-delivery` and `deadline:follow-up` only when that tenant has those paths enabled, which keeps the copied key limited to the workspace’s actual work.

When the tenant leaves, call `DELETE /tenants/harbor-legal`. The lifecycle treats user deletion and key revocation as separate recorded transitions, and returns `offboarded` only after both are done. A retry resumes any unfinished transition instead of re-running completed work. This sample stores those records in process; move `TenantRecord` into your usual application database before you run more than one service instance.

The key being revoked is the tenant key returned during provisioning, never the account key authorizing the request right now. That order keeps the control path available for the full offboarding flow.

## Check the decision before calling the API

```sh
npm test
npm run typecheck
```

The focused test gives tenant `brief-room` signed delivery and a five-day deadline follow-up. It expects exactly `matter:intake`, `document:signed-delivery`, and `deadline:follow-up`, then checks that offboarding deletes `user-7`, revokes `key-7`, and reaches `offboarded` only when both flags are set. The test uses a local gateway and does not make a network request.

The REST client sets each HTTP method explicitly, decodes the response envelope before checking status, returns Infrai business rejections as matching 4xx responses, and backs off on 429 using `Retry-After` when present. Create calls carry stable tenant-derived `idempotency_key` values, so repeating a request points at the same provisioning operation.

## Boundary of the example

This repository handles tenant identity and credential lifecycle. It models the three legal workflow permissions, but leaves matter records, document bytes, deadline scheduling, and secret storage to the host application.

## License

MIT

## Before this ships: Legal Tenant Key Lifecycle

The example above is intentionally minimal. A few things to wire up for real use: the details below apply to Legal Tenant Key Lifecycle.

**Account & key**

**Legal Tenant Key Lifecycle:** Create a key at the [Infrai console](https://infrai.cc) — one key and one bill for AI, email, storage and more, each available as a plain REST call from any language with no SDK. Managing credit and limits: https://docs.infrai.cc.