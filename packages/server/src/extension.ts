import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { ApplicationError, createCoreMaskPolicyRegistry } from "@xecms/application";
import { PostgresAuthorizationStore, PostgresIdentityRealmStore } from "@xecms/database";
import type { ServerExtension, ServerExtensionContext } from "@xecms/server";
import { AdminAppApplicationService, AdminAppRuntimeApplicationService } from "./admin-apps.js";
import { CatalogAdminAppDependencyResolver } from "./admin-app-dependencies.js";
import { PostgresAdminAppStore } from "./postgres-admin-apps.js";
import { registerAdminAppRoutes } from "./admin-app-routes.js";
import { registerAdminAppRuntimeRoutes } from "./admin-app-runtime-routes.js";

async function register(context: ServerExtensionContext): Promise<void> {
  const { database, workspaceId } = context;
  const store = new PostgresAdminAppStore(database.pool, database.schema);
  const realms = new PostgresIdentityRealmStore(database.pool, database.schema);
  const authorization = new PostgresAuthorizationStore(database.pool, database.schema);
  const dependencies = new CatalogAdminAppDependencyResolver({
    getActiveSchema: async (requestedWorkspace) => requestedWorkspace === workspaceId ? context.getActiveSchema() : null,
    getRealm: async (requestedWorkspace, realmId) => {
      const realm = await realms.getRealmById(realmId);
      return realm?.workspaceId === requestedWorkspace ? realm : null;
    },
    getAuthorization: async (requestedWorkspace, realmId) => {
      const realm = await realms.getRealmById(realmId);
      if (realm === null || realm.workspaceId !== requestedWorkspace) return null;
      const policy = await authorization.loadPolicy(realmId);
      return policy === null ? null : {
        realmId, revision: policy.revision,
        permissionKeys: new Set(policy.permissions.map(({ key }) => key)),
        resourceIds: new Set(policy.resources.map(({ id }) => id)),
      };
    },
    getPlugin: context.getPlugin,
  });
  const adminApps = new AdminAppApplicationService(store, dependencies, {
    now: () => new Date().toISOString(),
    newAppId: () => `aap_${randomUUID()}`,
    newRevisionId: () => `aar_${randomUUID()}`,
  });
  const runtime = new AdminAppRuntimeApplicationService(store, dependencies, () => new Date().toISOString());
  registerAdminAppRoutes({ app: context.app, adminApps, requireActor: context.requireActor, reauthenticate: context.reauthenticate });
  registerAdminAppRuntimeRoutes({
    app: context.app, workspaceId, runtime, authorization: context.authorization,
    maskPolicies: createCoreMaskPolicyRegistry(),
    authenticate: async (request, audience, csrf) => {
      try {
        return await context.authenticateAudience(request, audience, csrf);
      } catch (error) {
        // Preserve the existing App Runtime error contract across extraction.
        if (error instanceof ApplicationError && ["EXTENSION_SESSION_REQUIRED", "EXTENSION_AUDIENCE_UNAVAILABLE"].includes(error.code)) {
          throw new ApplicationError(error.code === "EXTENSION_SESSION_REQUIRED" ? "ADMIN_APP_RUNTIME_SESSION_REQUIRED" : "ADMIN_APP_AUDIENCE_UNAVAILABLE",
            error.status, error.message, error.options);
        }
        throw error;
      }
    },
    getActiveSchema: context.getActiveSchema,
    data: context.content,
  });
}

const require = createRequire(import.meta.url);

/** Optional builder product: install and configure explicitly to mount its API and UI. */
export const appBuilderExtension: ServerExtension = {
  id: "app-builder",
  name: "XeCMS 업무 화면 빌더",
  register,
  rawBodyRoutes: [{ method: "POST", path: "/api/admin-apps/runtime/:appKey/media" }],
  admin: {
    distDirectory: resolve(dirname(require.resolve("@xecms/app-builder-admin/package.json")), "dist"),
    assetPrefix: "/extensions/app-builder/",
    spaRoutes: ["/admin/apps", "/admin/apps/*", "/admin-apps/:appId/screens", "/apps/:appKey", "/apps/:appKey/*"],
    href: `${process.env["XECMS_BUILDER_ORIGIN"] ?? ""}/admin/apps`,
    label: "운영 앱",
  },
};

export default appBuilderExtension;
