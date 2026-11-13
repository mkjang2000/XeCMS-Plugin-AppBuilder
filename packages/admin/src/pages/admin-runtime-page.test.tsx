// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminRuntimePage } from "./admin-runtime-page.js";

vi.mock("../xecms-client.js", async () => {
  const { createAppBuilderClient } = await import("@xecms/app-builder-client");
  return { xecmsClient: createAppBuilderClient({ fetch: (...args) => globalThis.fetch(...args) }) };
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("runtime account switching", () => {
  it("uses a denied runtime's audience to log out only that realm and show its login form", async () => {
    const audience = { type: "content-realm", realmId: "realm_alpha", realmKey: "alpha", name: "App Alpha" };
    let loggedOut = false;
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/admin-apps/runtime/realm-console") {
        const status = loggedOut ? 401 : 403;
        return Response.json({
          type: "about:blank",
          title: loggedOut ? "Session required" : "Access denied",
          status,
          code: loggedOut ? "ADMIN_APP_SESSION_REQUIRED" : "ADMIN_APP_ACCESS_DENIED",
          detail: loggedOut ? "로그인이 필요합니다." : "App 접근 권한이 없습니다.",
          details: { audience },
        }, { status });
      }
      if (path === "/api/content-realms/alpha/session") {
        return Response.json({ authenticated: true, csrfToken: "alpha-csrf" });
      }
      if (path === "/api/content-realms/alpha/logout") {
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("x-csrf-token")).toBe("alpha-csrf");
        loggedOut = true;
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/apps/realm-console"]}>
        <Routes><Route path="/apps/:appKey/*" element={<AdminRuntimePage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "App 접근 권한이 없습니다" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "로그아웃 후 다른 계정으로 로그인" }));
    expect(await screen.findByRole("heading", { name: "App Alpha 로그인" })).not.toBeNull();
    expect(screen.getByLabelText("식별자")).not.toBeNull();
    expect(fetch.mock.calls.map(([path]) => String(path))).toEqual([
      "/api/admin-apps/runtime/realm-console",
      "/api/content-realms/alpha/session",
      "/api/content-realms/alpha/logout",
      "/api/admin-apps/runtime/realm-console",
    ]);
  });
});
