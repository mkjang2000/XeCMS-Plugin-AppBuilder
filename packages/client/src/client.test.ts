import { describe, expect, it, vi } from "vitest";
import { createXeCmsClient, XeCmsApiError } from "@xecms/client";
import { withAppBuilder } from "./index.js";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

describe("App Builder client extension", () => {
  it("shares the engine session, base URL and CSRF state without adding builder methods to the engine", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ user: { id: "owner", username: "owner" }, csrfToken: "csrf-shared" }))
      .mockResolvedValueOnce(json({ app: { id: "app_1" }, draft: { draftVersion: 1 } }));
    const engine = createXeCmsClient({ baseUrl: "https://cms.example/api", fetch });
    const builder = withAppBuilder(engine);
    expect("adminApps" in engine).toBe(false);
    await engine.auth.getSession();
    await builder.adminApps.create({ manifest: { name: "Orders" } });
    expect(fetch.mock.calls[1]?.[0]).toBe("https://cms.example/api/admin-apps");
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get("x-csrf-token")).toBe("csrf-shared");
    expect(fetch.mock.calls[1]?.[1]?.credentials).toBe("same-origin");
  });

  it("invalidates shared session state when the builder receives an authentication failure", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ user: { id: "owner", username: "owner" }, csrfToken: "expired" }))
      .mockResolvedValueOnce(json({ type: "about:blank", title: "Expired", status: 401,
        detail: "Session expired", code: "SESSION_EXPIRED", requestId: "req-expired" }, 401));
    const engine = createXeCmsClient({ fetch });
    const builder = withAppBuilder(engine);
    await engine.auth.getSession();
    await expect(builder.adminApps.list()).rejects.toBeInstanceOf(XeCmsApiError);
    await expect(engine.auth.logout()).rejects.toThrow("A session must be loaded");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
