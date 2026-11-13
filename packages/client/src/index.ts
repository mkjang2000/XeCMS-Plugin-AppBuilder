import { createXeCmsClient, type XeCmsClient, type XeCmsClientOptions } from "@xecms/client";
import {
  type AdminAppDto,
  type AdminAppListDto,
  type AdminAppDraftDto,
  type AdminAppDraftEnvelopeDto,
  type AdminAppHealthDto,
  type AdminAppRevisionListDto,
  type AdminAppPreviewDto,
  type AdminAppActivationDto,
  type AdminAppManifestArtifactDto,
  type CreateAdminAppRequest,
  type CreateAdminAppDraftRequest,
  type SaveAdminAppDraftRequest,
  type AdminAppPreviewRequest,
  type ApplyAdminAppRequest,
  type RollbackAdminAppRequest,
  type SetAdminAppStatusRequest,
  type DeleteAdminAppRequest,
  type ImportAdminAppRequest,
} from "./contracts.js";

export * from "@xecms/client";
export * from "./contracts.js";

export interface AdminAppsClient {
    list(includeArchived?: boolean): Promise<AdminAppListDto>;
    get(appId: string): Promise<AdminAppDto>;
    health(appId: string): Promise<AdminAppHealthDto>;
    create(input: CreateAdminAppRequest): Promise<AdminAppDraftEnvelopeDto>;
    getDraft(appId: string): Promise<AdminAppDraftDto | null>;
    createDraft(appId: string, input: CreateAdminAppDraftRequest): Promise<AdminAppDraftDto>;
    saveDraft(appId: string, input: SaveAdminAppDraftRequest): Promise<AdminAppDraftDto>;
    discardDraft(appId: string, expectedDraftVersion: number): Promise<void>;
    validate(manifest: unknown): Promise<{
      readonly manifest: unknown; readonly serialized: string; readonly hash: string;
      readonly resolution: { readonly dependencies: readonly unknown[]; readonly blockers: readonly { readonly code: string; readonly message: string }[] };
    }>;
    preview(appId: string, input: AdminAppPreviewRequest): Promise<AdminAppPreviewDto>;
    apply(appId: string, input: ApplyAdminAppRequest): Promise<AdminAppActivationDto>;
    revisions(appId: string): Promise<AdminAppRevisionListDto>;
    rollback(appId: string, input: RollbackAdminAppRequest): Promise<AdminAppActivationDto>;
    archive(appId: string, input: SetAdminAppStatusRequest): Promise<AdminAppDto>;
    reactivate(appId: string, input: SetAdminAppStatusRequest): Promise<AdminAppDto>;
    delete(appId: string, input: DeleteAdminAppRequest): Promise<void>;
    exportManifest(appId: string, revisionId?: string): Promise<AdminAppManifestArtifactDto>;
    importManifest(input: ImportAdminAppRequest): Promise<AdminAppDraftEnvelopeDto>;
}

export type AppBuilderClient = XeCmsClient & { readonly adminApps: AdminAppsClient };

/** Extend an engine client so both APIs share session and CSRF state. */
export function withAppBuilder(client: XeCmsClient): AppBuilderClient {
  const { request } = client.transport;
  const json = (value: unknown): string => JSON.stringify(value);
  return {
    ...client,
    adminApps: {
      list: (includeArchived = false) => request<AdminAppListDto>(
        `/admin-apps${includeArchived ? "?includeArchived=true" : ""}`,
      ),
      get: (appId) => request<AdminAppDto>(`/admin-apps/${encodeURIComponent(appId)}`),
      health: (appId) => request<AdminAppHealthDto>(`/admin-apps/${encodeURIComponent(appId)}/health`),
      create: (input) => request<AdminAppDraftEnvelopeDto>("/admin-apps", {
        method: "POST", body: json(input), csrf: true,
      }),
      getDraft: (appId) => request<AdminAppDraftDto | null>(`/admin-apps/${encodeURIComponent(appId)}/draft`),
      createDraft: (appId, input) => request<AdminAppDraftDto>(`/admin-apps/${encodeURIComponent(appId)}/draft`, {
        method: "POST", body: json(input), csrf: true,
      }),
      saveDraft: (appId, input) => request<AdminAppDraftDto>(`/admin-apps/${encodeURIComponent(appId)}/draft`, {
        method: "PUT", body: json(input), csrf: true,
      }),
      discardDraft: (appId, expectedDraftVersion) => request<void>(`/admin-apps/${encodeURIComponent(appId)}/draft`, {
        method: "DELETE", body: json({ expectedDraftVersion }), csrf: true,
      }),
      validate: (manifest) => request("/admin-apps/validate", {
        method: "POST", body: json({ manifest }),
      }),
      preview: (appId, input) => request<AdminAppPreviewDto>(`/admin-apps/${encodeURIComponent(appId)}/preview`, {
        method: "POST", body: json(input), csrf: true,
      }),
      apply: (appId, input) => request<AdminAppActivationDto>(`/admin-apps/${encodeURIComponent(appId)}/apply`, {
        method: "POST", body: json(input), csrf: true,
      }),
      revisions: (appId) => request<AdminAppRevisionListDto>(`/admin-apps/${encodeURIComponent(appId)}/revisions`),
      rollback: (appId, input) => request<AdminAppActivationDto>(`/admin-apps/${encodeURIComponent(appId)}/rollback`, {
        method: "POST", body: json(input), csrf: true,
      }),
      archive: (appId, input) => request<AdminAppDto>(`/admin-apps/${encodeURIComponent(appId)}/archive`, {
        method: "POST", body: json(input), csrf: true,
      }),
      reactivate: (appId, input) => request<AdminAppDto>(`/admin-apps/${encodeURIComponent(appId)}/reactivate`, {
        method: "POST", body: json(input), csrf: true,
      }),
      delete: (appId, input) => request<void>(`/admin-apps/${encodeURIComponent(appId)}`, {
        method: "DELETE", body: json(input), csrf: true,
      }),
      exportManifest: (appId, revisionId) => request<AdminAppManifestArtifactDto>(
        `/admin-apps/${encodeURIComponent(appId)}/export${revisionId === undefined ? "" : `?revisionId=${encodeURIComponent(revisionId)}`}`,
      ),
      importManifest: (input) => request<AdminAppDraftEnvelopeDto>("/admin-apps/import", {
        method: "PUT", body: json(input), csrf: true,
      }),
    },
  };
}

export function createAppBuilderClient(options: XeCmsClientOptions = {}): AppBuilderClient {
  return withAppBuilder(createXeCmsClient(options));
}
