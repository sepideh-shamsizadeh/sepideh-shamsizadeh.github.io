import { DurableObject } from "cloudflare:workers";
import { Ledger } from "./ledger.mjs";
import { allowedOrigin, handle, reply } from "./service.mjs";

export class Coach extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const storage = ctx.storage;
      this.ledger = new Ledger((query, ...bindings) => storage.sql.exec(query, ...bindings).toArray(),
        callback => storage.transactionSync(callback));
    });
  }

  async fetch(request) {
    try {
      return await handle(request, this.env, this.ledger);
    } catch {
      return reply(503, { error: "unavailable" }, allowedOrigin(request, this.env));
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const origin = allowedOrigin(request, env);
    if (!origin) return reply(403, { error: "origin" });
    if (request.method === "OPTIONS") return reply(204, null, origin);
    try {
      const id = env.COACH.idFromName(env.COACH_MODE === "mock" ? "mock-v1" : "owner-v1");
      const pending = env.COACH.get(id).fetch(request);
      ctx.waitUntil(pending.then(() => {}, () => {}));
      return await pending;
    } catch {
      return reply(503, { error: "unavailable" }, origin);
    }
  }
};
