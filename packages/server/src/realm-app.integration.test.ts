import { appBuilderExtension } from "./extension.js";
import { randomUUID } from "node:crypto";

import { PostgresDatabase, qualifiedName, quoteIdentifier } from "@xecms/database";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";

import { loadServerConfig } from "@xecms/server";
import {
  bootstrapTestOwner,
  TEST_OWNER_PASSWORD,
  TEST_OWNER_USERNAME,
} from "./test-support.js";
import { buildServer, type XeCmsServer } from "@xecms/server";

const RUN = process.env["XECMS_RUN_POSTGRES_TESTS"] === "true";
const DATABASE_URL = process.env["XECMS_TEST_DATABASE_URL"]
  ?? process.env["XECMS_E2E_DATABASE_URL"]
  ?? process.env["DATABASE_URL"]
  ?? "postgresql://xecms:xecms@127.0.0.1:55432/xecms_e2e";
const ORIGIN = "http://127.0.0.1:3199";

interface Session { readonly cookie: string; readonly csrfToken: string }
interface Realm {
  readonly realmId: string;
  readonly realmKey: string;
  readonly name: string;
  readonly status: "provisioning" | "active" | "disabled";
  readonly profileCollectionId?: string;
  readonly revision: number;
  readonly authentication: {
    readonly acceptSystemIdentities: boolean;
    readonly provisioning: "explicit" | "jit";
    readonly registration: "closed" | "open";
    readonly defaultRoleIds: readonly string[];
  };
}
interface Membership {
  readonly membershipId: string;
  readonly subjectId: string;
  readonly status: "pending" | "active" | "suspended";
  readonly revision: number;
  readonly realmAdministrator?: boolean;
}
interface Policy {
  readonly revision: number;
  readonly roles: readonly { readonly id: string; readonly name: string; readonly levelId: string }[];
  readonly resources: readonly { readonly id: string; readonly name: string; readonly type: string }[];
  readonly bindings: readonly { readonly id: string; readonly subjectId: string }[];
}
interface OwnerStatus {
  readonly realmId: string;
  readonly status: "healthy" | "ownerless" | "invalid";
  readonly policyRevision: number;
  readonly owner?: {
    readonly membershipId: string;
    readonly subjectId: string;
    readonly primaryIdentifier: string;
  };
}

const { admin: _adminAssets, ...apiOnlyBuilder } = appBuilderExtension;

describe.runIf(RUN)("Builder Content Realm acceptance", () => {
  it("enforces Content Realm sessions and app-specific grants", async () => {
    const schema = `xecms_m4a_${randomUUID().replaceAll("-", "_")}`;
    const database = new PostgresDatabase({ connectionString: DATABASE_URL, schema, maxConnections: 6 });
    const config = loadServerConfig({
      NODE_ENV: "development",
      DATABASE_URL,
      XECMS_DB_SCHEMA: schema,
      XECMS_SESSION_SECRET: "m4a-integration-session-secret-0123456789",
      XECMS_ADMIN_ORIGINS: ORIGIN,
      XECMS_CONTENT_ORIGINS: ORIGIN,
      XECMS_ADMIN_DIST: "/definitely/not/a/built/admin",
    });
    let server: XeCmsServer | undefined;
    try {
      server = await buildServer({ database, config, logger: false, extensions: [apiOnlyBuilder] });
      await bootstrapTestOwner(server);
      const owner = await loginAdmin(server);
      const createdRealm = await adminJson<Realm>(server, owner, "POST", "/api/identity-realms", {
        key: "community",
        name: "Community",
        acceptSystemIdentities: true,
        provisioning: "explicit",
        registration: "open",
        defaultRoleIds: [],
      }, 201);
      let realm = await adminJson<Realm>(
        server,
        owner,
        "POST",
        `/api/identity-realms/${createdRealm.realmId}/profile-schema`,
        {
          collectionName: "members",
          collectionLabel: "Members",
          identifierFieldName: "memberEmail",
          includeDisplayName: true,
        },
        200,
      );
      expect(realm.status).toBe("active");
      expect(realm.profileCollectionId).toMatch(/^col_/);
      const repeatedSetup = await adminJson<Realm>(
        server,
        owner,
        "POST",
        `/api/identity-realms/${createdRealm.realmId}/profile-schema`,
        {
          collectionName: "members",
          collectionLabel: "Members",
          identifierFieldName: "memberEmail",
          includeDisplayName: true,
        },
        200,
      );
      expect(repeatedSetup.profileCollectionId).toBe(realm.profileCollectionId);
      await adminJson<Realm>(
        server,
        owner,
        "POST",
        `/api/identity-realms/${createdRealm.realmId}/profile-fields`,
        { name: "nickname", label: "Nickname", type: "text" },
        200,
      );
      await applyArticleSchema(server, owner);
      realm = await getJson<Realm>(server, "/api/identity-realms/" + createdRealm.realmId, owner.cookie);

      const contentAdministratorRoleId = `authorization:${realm.realmId}:role:content-administrator`;
      realm = await updateRealm(server, owner, realm, [contentAdministratorRoleId]);
      const identities = await getJson<{ readonly items: readonly { readonly globalIdentityId: string; readonly primaryIdentifier: string }[] }>(server, "/api/global-identities", owner.cookie);
      const adminIdentity = identities.items.find(({ primaryIdentifier }) => primaryIdentifier === "admin");
      expect(adminIdentity).toBeDefined();
      const adminMembership = await adminJson<Membership>(
        server,
        owner,
        "POST",
        `/api/identity-realms/${realm.realmId}/memberships`,
        { globalIdentityId: adminIdentity!.globalIdentityId, profile: { displayName: "Realm Admin" }, password: TEST_OWNER_PASSWORD },
        201,
      );
      expect(adminMembership.status).toBe("active");
      realm = await getJson<Realm>(server, `/api/identity-realms/${realm.realmId}`, owner.cookie);
      await updateRealm(server, owner, realm, []);

      const signup = await contentJson<{ readonly subjectId: string; readonly csrfToken: string }>(
        server,
        undefined,
        "POST",
        "/api/content-realms/community/signup",
        { identifier: "member@example.test", password: "Member-password-2026!", profile: { displayName: "Member" } },
        201,
      );
      const member = { cookie: signup.cookie, csrfToken: signup.body.csrfToken };
      const denied = await contentRequest(server, member, "GET", "/api/content-realms/community/collections/col_articles/documents");
      expect(denied.statusCode).toBe(403);

      let policy = await getJson<Policy>(server, `/api/identity-realms/${realm.realmId}/authorization/policy`, owner.cookie);
      const editor = policy.roles.find(({ name }) => name === "Editor");
      const articles = policy.resources.find(({ name, type }) => name === "articles" && type === "collection");
      expect(editor).toBeDefined();
      expect(articles).toBeDefined();
      policy = await adminJson<Policy>(server, owner, "POST", `/api/identity-realms/${realm.realmId}/authorization/bindings`, {
        expectedPolicyRevision: policy.revision,
        subjectId: signup.body.subjectId,
        roleId: editor!.id,
        resourceId: articles!.id,
        propagation: "self-and-children",
      }, 201);
      const editorBinding = policy.bindings.find(({ subjectId }) => subjectId === signup.body.subjectId);
      expect(editorBinding).toBeDefined();

      const created = await contentJson<{ readonly id: string; readonly version: number; readonly data: Readonly<Record<string, unknown>> }>(
        server, member, "POST", "/api/content-realms/community/collections/col_articles/documents",
        { data: { title: "Realm article", body: "Only the Community grant authorizes this." } }, 201,
      );
      expect(created.body.data["title"]).toBe("Realm article");

      // Entitlement gate: the newly created realm is under enforcement, and its
      // reconciled ceilings preserve access — the member's create above (and the
      // update below) succeed under the gate, and a full-allow ceiling exists for
      // the accessed collection.
      const enforcementRow = await database.pool.query<{ readonly state: string }>(
        `SELECT state FROM ${qualifiedName(schema, "_xecms_realm_entitlement_enforcement")} WHERE realm_id = $1`,
        [realm.realmId],
      );
      expect(enforcementRow.rows[0]?.state).toBe("enforced");
      const entitlementRow = await database.pool.query<{ readonly actions: readonly string[] }>(
        `SELECT actions FROM ${qualifiedName(schema, "_xecms_realm_collection_entitlements")}
          WHERE realm_id = $1 AND collection_id = 'col_articles'`,
        [realm.realmId],
      );
      expect(entitlementRow.rows[0]?.actions).toEqual(expect.arrayContaining(["read", "create", "update"]));

      const updated = await contentJson<{ readonly version: number; readonly data: Readonly<Record<string, unknown>> }>(
        server, member, "PATCH", `/api/content-realms/community/collections/col_articles/documents/${created.body.id}`,
        { expectedVersion: created.body.version, data: { title: "Updated realm article", body: "Scoped update" } }, 200,
      );
      expect(updated.body.version).toBe(created.body.version + 1);

      const contentAppManifest = {
        format: "xecms.admin-app",
        formatVersion: 1,
        id: "community-operations",
        name: "Community Operations",
        key: "community-operations",
        audience: { type: "content-realm", realmId: realm.realmId },
        navigation: [{ id: "articles-nav", label: "Articles", pageId: "articles" }],
        pages: [{
          id: "articles",
          type: "collection-list",
          collectionId: "col_articles",
          title: "Articles",
          columns: [
            { id: "title", field: { kind: "data", fieldId: "fld_article_title" }, label: "Title" },
            { id: "updated", field: { kind: "system", field: "updatedAt" }, label: "Updated" },
          ],
        }],
        startPageId: "articles",
      };
      const appDraft = await adminJson<{ readonly app: { readonly id: string }; readonly draft: { readonly draftVersion: number } }>(
        server, owner, "POST", "/api/admin-apps", { manifest: contentAppManifest }, 201,
      );
      const appPreview = await adminJson<{ readonly planId: string }>(
        server, owner, "POST", `/api/admin-apps/${appDraft.app.id}/preview`, {
          expectedActiveRevisionId: null, expectedRouteVersion: 1,
          expectedDraftVersion: appDraft.draft.draftVersion,
        }, 200,
      );
      await adminJson(server, owner, "POST", `/api/admin-apps/${appDraft.app.id}/apply`, {
        expectedActiveRevisionId: null, expectedRouteVersion: 1,
        expectedDraftVersion: appDraft.draft.draftVersion, planId: appPreview.planId,
      }, 200);
      policy = await getJson<Policy>(server, `/api/identity-realms/${realm.realmId}/authorization/policy`, owner.cookie);
      const appResource = policy.resources.find(({ id }) => id === `resource:admin-app:${appDraft.app.id}`);
      expect(appResource).toBeDefined();
      const deniedRuntime = await contentRequest(
        server, member, "GET", "/api/admin-apps/runtime/community-operations",
      );
      expect(deniedRuntime.statusCode, deniedRuntime.body).toBe(403);
      expect(deniedRuntime.json()).toMatchObject({
        code: "ADMIN_APP_ACCESS_DENIED",
        details: {
          audience: {
            type: "content-realm",
            realmId: realm.realmId,
            realmKey: "community",
            name: "Community",
          },
        },
      });
      policy = await adminJson<Policy>(server, owner, "POST", `/api/identity-realms/${realm.realmId}/authorization/roles`, {
        expectedPolicyRevision: policy.revision,
        name: "Admin App User",
        levelId: editor!.levelId,
        permissions: ["admin-app.access"],
        delegatablePermissions: [],
      }, 201);
      const appUserRole = policy.roles.find(({ name }) => name === "Admin App User");
      expect(appUserRole).toBeDefined();
      policy = await adminJson<Policy>(server, owner, "POST", `/api/identity-realms/${realm.realmId}/authorization/bindings`, {
        expectedPolicyRevision: policy.revision,
        subjectId: signup.body.subjectId,
        roleId: appUserRole!.id,
        resourceId: appResource!.id,
        propagation: "self",
      }, 201);
      const contentRuntime = await contentRequest(
        server, member, "GET", "/api/admin-apps/runtime/community-operations",
      );
      expect(contentRuntime.statusCode, contentRuntime.body).toBe(200);
      expect(contentRuntime.json()).toMatchObject({
        manifest: { id: "community-operations", audience: { realmId: realm.realmId } },
        user: { realmId: realm.realmId, realmKey: "community", subjectId: signup.body.subjectId },
        access: { appAllowed: true, pages: { articles: true } },
      });
      const wrongAudience = await server.app.inject({
        method: "GET",
        url: "/api/admin-apps/runtime/community-operations",
        headers: { cookie: owner.cookie, origin: ORIGIN },
      });
      expect(wrongAudience.statusCode).toBe(401);
      expect(wrongAudience.json().details.audience).toMatchObject({
        type: "content-realm", realmKey: "community",
      });

    } finally {
      await server?.close();
      await database.pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`).catch(() => undefined);
      await database.close();
    }
  }, 30_000);
});

async function loginAdmin(server: XeCmsServer): Promise<Session> {
  const response = await server.app.inject({ method: "POST", url: "/api/auth/login", headers: { origin: ORIGIN }, payload: { username: TEST_OWNER_USERNAME, password: TEST_OWNER_PASSWORD } });
  expect(response.statusCode, response.body).toBe(200);
  return { cookie: String(response.headers["set-cookie"]).split(";", 1)[0]!, csrfToken: response.json().csrfToken as string };
}

async function applyArticleSchema(server: XeCmsServer, owner: Session): Promise<void> {
  const active = await getJson<{
    readonly revisionId: string;
    readonly schema: {
      readonly format: "xecms.schema";
      readonly formatVersion: 1;
      readonly collections: readonly Readonly<Record<string, unknown>>[];
    };
  }>(server, "/api/schema", owner.cookie);
  const profile = active.schema.collections.find(({ name }) => name === "members");
  expect(profile).toMatchObject({
    name: "members",
    fields: expect.arrayContaining([
      expect.objectContaining({ name: "memberEmail", required: true, unique: true }),
      expect.objectContaining({ name: "nickname", label: "Nickname", type: "text" }),
    ]),
  });
  const profileFields = profile?.["fields"];
  expect(Array.isArray(profileFields)).toBe(true);
  const nickname = (profileFields as readonly Readonly<Record<string, unknown>>[])
    .find(({ name }) => name === "nickname");
  expect(nickname).not.toHaveProperty("required");
  const imported = await adminRequest(server, owner, "PUT", "/api/schema/manifest", {
    baseRevisionId: active.revisionId,
    expectedDraftVersion: null,
    schema: {
      format: "xecms.schema", formatVersion: 1,
      collections: [
        ...active.schema.collections,
        {
          id: "col_articles", name: "articles", label: "Articles",
          fields: [
            { id: "fld_article_title", name: "title", label: "Title", type: "text", required: true },
            { id: "fld_article_body", name: "body", label: "Body", type: "textarea", required: true },
          ],
        },
      ],
    },
  });
  expect(imported.statusCode, imported.body).toBe(200);
  const preview = await adminRequest(server, owner, "POST", "/api/schema/preview", { expectedDraftVersion: imported.json().draftVersion });
  expect(preview.statusCode, preview.body).toBe(200);
  const applied = await adminRequest(server, owner, "POST", "/api/schema/apply", {
    planId: preview.json().planId,
    expectedRevisionId: active.revisionId,
    expectedDraftVersion: imported.json().draftVersion,
    approveDestructive: false,
  });
  expect(applied.statusCode, applied.body).toBe(200);
}

async function updateRealm(server: XeCmsServer, owner: Session, realm: Realm, defaultRoleIds: readonly string[]): Promise<Realm> {
  return adminJson<Realm>(server, owner, "PATCH", `/api/identity-realms/${realm.realmId}`, {
    expectedRevision: realm.revision,
    name: realm.name,
    status: "active",
    acceptSystemIdentities: true,
    provisioning: "explicit",
    registration: "open",
    defaultRoleIds,
  }, 200);
}

async function getJson<T>(server: XeCmsServer, url: string, cookie: string): Promise<T> {
  const response = await server.app.inject({ method: "GET", url, headers: { cookie, origin: ORIGIN } });
  expect(response.statusCode, response.body).toBe(200);
  return response.json() as T;
}

async function adminJson<T = unknown>(server: XeCmsServer, session: Session, method: "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload: Readonly<Record<string, unknown>>, expected: number): Promise<T> {
  const response = await adminRequest(server, session, method, url, payload);
  expect(response.statusCode, response.body).toBe(expected);
  return response.json() as T;
}

function adminRequest(server: XeCmsServer, session: Session, method: "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload: Readonly<Record<string, unknown>>): Promise<LightMyRequestResponse> {
  return server.app.inject({ method, url, headers: { cookie: session.cookie, "x-csrf-token": session.csrfToken, origin: ORIGIN }, payload });
}

async function contentJson<T>(server: XeCmsServer, session: Session | undefined, method: "POST" | "PATCH", url: string, payload: Readonly<Record<string, unknown>>, expected: number): Promise<{ readonly body: T; readonly cookie: string }> {
  const response = await contentRequest(server, session, method, url, payload);
  expect(response.statusCode, response.body).toBe(expected);
  const setCookie = response.headers["set-cookie"];
  const issued = (Array.isArray(setCookie) ? setCookie : setCookie === undefined ? [] : [setCookie])
    .map((value) => String(value).split(";", 1)[0]!)
    .join("; ");
  return { body: response.json() as T, cookie: issued || session?.cookie || "" };
}

function contentRequest(server: XeCmsServer, session: Session | undefined, method: "GET" | "POST" | "PATCH", url: string, payload?: Readonly<Record<string, unknown>>): Promise<LightMyRequestResponse> {
  return server.app.inject({
    method, url,
    headers: {
      origin: ORIGIN,
      ...(session === undefined ? {} : { cookie: session.cookie, "x-csrf-token": session.csrfToken }),
    },
    ...(payload === undefined ? {} : { payload }),
  });
}
