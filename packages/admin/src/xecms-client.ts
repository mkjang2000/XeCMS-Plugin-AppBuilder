import { createAppBuilderClient } from "@xecms/app-builder-client";

// One client keeps the builder and engine requests on the same CSRF store.
export const xecmsClient = createAppBuilderClient();
