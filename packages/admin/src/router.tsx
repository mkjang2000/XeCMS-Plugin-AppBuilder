import { createBrowserRouter, Link, Outlet, redirectDocument, useRouteError } from "react-router";
import { Callout, LoadingIndicator } from "@xecms/ui";
import { xecmsClient } from "./xecms-client.js";

function BuilderShell() {
  return <div className="builder-studio">
    <header className="builder-studio-header">
      <Link to="/admin/apps">XeCMS · 업무 화면 빌더</Link>
      <a href={import.meta.env.VITE_XECMS_ADMIN_URL ?? "/admin"}>엔진 관리 UI</a>
    </header>
    <main className="builder-studio-main"><Outlet /></main>
  </div>;
}

function BuilderError() {
  const error = useRouteError();
  return <main className="builder-studio-main"><Callout tone="error">
    {error instanceof Error ? error.message : "업무 화면을 열 수 없습니다."}
  </Callout><a href={import.meta.env.VITE_XECMS_ADMIN_URL ?? "/admin"}>엔진 관리 UI로 돌아가기</a></main>;
}

async function requireSession() {
  const bootstrap = await xecmsClient.auth.getBootstrapStatus();
  const engineUrl = import.meta.env.VITE_XECMS_ADMIN_URL;
  const enginePath = (path: string) => engineUrl === undefined ? path : new URL(path, engineUrl).href;
  if (bootstrap.required) throw redirectDocument(enginePath("/admin/setup"));
  const session = await xecmsClient.auth.getSession();
  if (session.user === null) throw redirectDocument(enginePath("/admin/login"));
  if (session.passwordChangeRequired) throw redirectDocument(enginePath("/admin/password-change"));
  if (bootstrap.templateRequired || session.schema?.revisionId == null) throw redirectDocument(enginePath("/admin/setup"));
  return session;
}

export function createBuilderRouter() {
  return createBrowserRouter([
    {
      path: "/admin/apps",
      loader: requireSession,
      element: <BuilderShell />,
      errorElement: <BuilderError />,
      hydrateFallbackElement: <LoadingIndicator label="빌더를 불러오는 중" />,
      children: [
        { index: true, lazy: async () => ({ Component: (await import("./pages/admin-app-pages.js")).AdminAppListPage }) },
        { path: "new", lazy: async () => ({ Component: (await import("./pages/admin-app-pages.js")).AdminAppCreatePage }) },
        { path: ":appId", lazy: async () => ({ Component: (await import("./pages/admin-app-pages.js")).AdminAppBuilderPage }) },
      ],
    },
    {
      path: "/admin-apps/:appId/screens",
      loader: requireSession,
      lazy: async () => ({ Component: (await import("./pages/composed-screen-editor-page.js")).ComposedScreenEditorPage }),
      errorElement: <BuilderError />,
    },
    {
      path: "/apps/:appKey/*",
      lazy: async () => ({ Component: (await import("./pages/admin-runtime-page.js")).AdminRuntimePage }),
      errorElement: <BuilderError />,
    },
    { path: "*", element: <main className="builder-studio-main"><p>화면을 찾을 수 없습니다.</p><Link to="/admin/apps">업무 화면 빌더</Link></main> },
  ]);
}
