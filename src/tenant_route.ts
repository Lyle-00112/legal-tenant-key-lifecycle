import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { InfraiError } from "./infrai_control_plane.js";
import { tenantProvisionBody } from "./tenant_access.js";
import { TenantLifecycle } from "./tenant_lifecycle.js";

const lifecycle = new TenantLifecycle();

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function jsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/tenants") {
      const parsed = tenantProvisionBody.safeParse(await jsonBody(request));
      if (!parsed.success) {
        send(response, 400, { error: "Invalid tenant request", issues: parsed.error.issues });
        return;
      }
      send(response, 201, await lifecycle.provision(parsed.data));
      return;
    }

    const match = request.url?.match(/^\/tenants\/([^/]+)$/);
    if (request.method === "DELETE" && match) {
      send(response, 200, await lifecycle.offboard(decodeURIComponent(match[1])));
      return;
    }
    send(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      send(response, error.status, { error: error.detail });
      return;
    }
    const message = error instanceof Error ? error.message : "Request failed";
    send(response, 500, { error: message });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Tenant lifecycle service listening on http://localhost:${port}`));
