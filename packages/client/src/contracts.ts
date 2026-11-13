import type { AdminAppManifest, AdminAppManifestDiff } from "@xecms/admin-apps";
import type { CollectionSummaryDto, JsonValue } from "@xecms/contracts";

export interface AdminAppDto {
  readonly id:string; readonly workspaceId:string; readonly manifestId:string;
  readonly key:string; readonly name:string;
  readonly audience:{readonly type:"system"}|{readonly type:"content-realm";readonly realmId:string};
  readonly status:"active"|"archived"; readonly activeRevisionId:string|null;
  readonly routeVersion:number; readonly createdAt:string;
  readonly createdByIdentityId:string; readonly createdBySubjectId:string;
  readonly updatedAt:string; readonly updatedByIdentityId:string; readonly updatedBySubjectId:string;
  readonly archivedAt?:string; readonly archivedByIdentityId?:string;
  readonly archivedBySubjectId?:string;
}
export interface AdminAppDraftDto {
  readonly appId:string; readonly workspaceId:string; readonly baseRevisionId:string|null;
  readonly draftVersion:number; readonly desiredKey:string; readonly manifest:AdminAppManifest;
  readonly manifestHash:string; readonly createdAt:string; readonly createdByIdentityId:string;
  readonly createdBySubjectId:string; readonly updatedAt:string;
  readonly updatedByIdentityId:string; readonly updatedBySubjectId:string;
}
export interface AdminAppDependencyDto {
  readonly kind:string; readonly id:string; readonly fingerprint?:string;
  readonly metadata?:Readonly<Record<string,unknown>>;
}
export interface AdminAppRevisionDto {
  readonly id:string; readonly appId:string; readonly workspaceId:string; readonly sequence:number;
  readonly parentRevisionId:string|null; readonly manifest:AdminAppManifest;
  readonly manifestHash:string; readonly dependencies:readonly AdminAppDependencyDto[];
  readonly createdAt:string; readonly createdByIdentityId:string; readonly createdBySubjectId:string;
}
export interface AdminAppListDto { readonly items:readonly AdminAppDto[]; }
export interface AdminAppRevisionListDto { readonly items:readonly AdminAppRevisionDto[]; }
export interface AdminAppDraftEnvelopeDto { readonly app:AdminAppDto; readonly draft:AdminAppDraftDto; }
export interface AdminAppPreviewBlockerDto { readonly code:string; readonly message:string;
  readonly path?:readonly (string|number)[]; readonly details?:Readonly<Record<string,unknown>>; }
export interface AdminAppPreviewDto {
  readonly appId:string; readonly activeRevisionId:string|null; readonly routeVersion:number;
  readonly draftVersion:number; readonly manifestHash:string; readonly planId:string;
  readonly diff:AdminAppManifestDiff|null; readonly dependencies:readonly AdminAppDependencyDto[];
  readonly blockers:readonly AdminAppPreviewBlockerDto[];
}
export interface AdminAppHealthDto {
  readonly activeRevisionId:string|null;
  readonly state:"not-applied"|"healthy"|"degraded";
  readonly checkedAt:string;
  readonly blockers:readonly AdminAppPreviewBlockerDto[];
}
export interface AdminAppActivationDto { readonly app:AdminAppDto; readonly revision:AdminAppRevisionDto; }
export interface AdminAppManifestArtifactDto { readonly format:"xecms.admin-app-export";
  readonly formatVersion:1; readonly appId:string; readonly revisionId:string|null;
  readonly manifest:AdminAppManifest; readonly serialized:string; readonly hash:string; }
export interface CreateAdminAppRequest { readonly manifest:unknown; }
export interface CreateAdminAppDraftRequest { readonly expectedRouteVersion:number; }
export interface SaveAdminAppDraftRequest { readonly expectedDraftVersion:number;
  readonly expectedBaseRevisionId:string|null; readonly manifest:unknown; }
export interface AdminAppPreviewRequest { readonly expectedActiveRevisionId:string|null;
  readonly expectedRouteVersion:number; readonly expectedDraftVersion:number; }
export interface ApplyAdminAppRequest extends AdminAppPreviewRequest { readonly planId:string; }
export interface RollbackAdminAppRequest { readonly targetRevisionId:string;
  readonly expectedActiveRevisionId:string; readonly expectedRouteVersion:number; }
export interface SetAdminAppStatusRequest { readonly expectedRouteVersion:number;
  readonly currentPassword:string; }
export interface DeleteAdminAppRequest { readonly expectedRouteVersion:number;
  readonly currentPassword:string; }
export interface ImportAdminAppRequest { readonly appId?:string; readonly expectedRouteVersion?:number;
  readonly expectedDraftVersion?:number|null; readonly expectedBaseRevisionId?:string|null;
  readonly manifest:unknown; }

export interface AdminAppRuntimeAccessProfileDto {
  readonly appAllowed:boolean;
  readonly pages:Readonly<Record<string,boolean>>;
  readonly pageUnmasked:Readonly<Record<string,boolean>>;
  readonly actions:Readonly<Record<string,boolean>>;
  readonly permissions:Readonly<Record<string,boolean>>;
  readonly readableFields:Readonly<Record<string,readonly string[]|null>>;
  readonly writableFields:Readonly<Record<string,readonly string[]|null>>;
  readonly policyRevision:number;
}
export interface AdminAppRuntimeSchemaDto {
  readonly revisionId:string;
  readonly collections:readonly CollectionSummaryDto[];
}
export interface AdminAppRuntimeUserDto {
  readonly identityId:string;
  readonly subjectId:string;
  readonly displayName:string;
  readonly realmId:string;
  readonly realmKey?:string;
}
export interface AdminAppRuntimeDependencyHealthDto {
  readonly healthy:boolean;
  readonly checkedAt:string;
  readonly blockers:readonly AdminAppPreviewBlockerDto[];
}
export interface AdminAppRuntimeDto {
  readonly app:AdminAppDto;
  readonly revisionId:string;
  readonly manifest:AdminAppManifest;
  readonly schema:AdminAppRuntimeSchemaDto;
  readonly user:AdminAppRuntimeUserDto;
  readonly access:AdminAppRuntimeAccessProfileDto;
  readonly dependencyHealth:AdminAppRuntimeDependencyHealthDto;
}

export interface ComposedQueryRequest {
  /** Page State values bound to the Data Source parameters (parameterId -> value). */
  readonly parameters?: Readonly<Record<string, JsonValue>>;
  readonly cursor?: string;
}
export interface ComposedQueryRowDto {
  readonly id: string;
  /** Masked, access-filtered Field values (fieldName -> value). */
  readonly data: Readonly<Record<string, unknown>>;
}
export interface ComposedQueryResultDto {
  readonly items: readonly ComposedQueryRowDto[];
  readonly hasNextPage: boolean;
  readonly nextCursor?: string;
}
export interface ComposedAggregateRequest {
  /** Page State values bound to the Data Source parameters (parameterId -> value). */
  readonly parameters?: Readonly<Record<string, JsonValue>>;
}
export interface ComposedAggregateGroupDto {
  /** The group key value (Field/system value the rows were grouped by). */
  readonly group: string | number | boolean | null;
  /** The measure result for the group (count / sum / avg). */
  readonly value: number;
}
export interface ComposedAggregateResultDto {
  readonly groups: readonly ComposedAggregateGroupDto[];
  /** True when the authorized scan hit its bound before aggregating every match. */
  readonly truncated: boolean;
}
export interface ComposedDocumentRequest {
  readonly documentId: string;
  readonly collectionId: string;
}
export interface ComposedDocumentDto {
  readonly id: string;
  readonly version?: number;
  /** Masked, access-filtered Field values (fieldName -> value). */
  readonly data: Readonly<Record<string, unknown>>;
}

