# Project Structure

## Overview
- Project: XeCMS Plugin AppBuilder 0.6.0
- Purpose: Optional business screen designer and runtime for XeCMS
- Runtime: Node.js >=22.22.0; TypeScript, React, Fastify; pnpm 10.30.1
- Engine: Exact published API package versions; temporary validated artifacts while 0.6.0 is unpublished
- Build: pnpm build
- Run: pnpm dev / pnpm start
- Test: pnpm check / pnpm verify

## Managed structure
```text
packages/
  model/    @xecms/admin-apps manifest, compiler and validation
  runtime/  @xecms/admin-runtime React runtime and data access
  client/   @xecms/app-builder-client REST client and DTOs
  server/   @xecms/app-builder-server services, stores and routes
  admin/    @xecms/app-builder-admin standalone Studio SPA
scripts/    engine bootstrap, build hygiene, standalone host and verification
tests/e2e/  preserved builder browser journeys and bootstrap fixture
.github/workflows/ci.yml
engine-source.json  pinned engine source fallback for prerelease bootstrap
tsconfig*.json / vitest.config.ts / playwright.config.ts
docker-compose.yml
```

## Execution flow
Builder Studio → builder client → optional server extension → public engine context → engine database.
The engine package supplies CMS Studio and core APIs; this repository never imports engine source files.

## Generated local state
.engine-artifacts/, .engine-source/, .pnpmfile.cjs and pnpm-lock.yaml are ignored during prerelease bootstrap. Build output and node_modules are not source. Package tarballs retain exact engine versions and never include local overrides. Development plans and reviews are maintained separately in the private XeCMS-Docs repository.
