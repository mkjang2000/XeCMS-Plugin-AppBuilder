# @xecms/app-builder-client

선택 설치하는 [업무 화면 빌더](../../README.md)의 REST 계약과 클라이언트입니다.
엔진 클라이언트의 콘텐츠·인증 API와 같은 세션/CSRF transport를 사용합니다.

```ts
import { createXeCmsClient } from "@xecms/client";
import { withAppBuilder } from "@xecms/app-builder-client";

const engine = createXeCmsClient();
const builder = withAppBuilder(engine);
await engine.auth.getSession();
const apps = await builder.adminApps.list();
```

`createAppBuilderClient(options)`로 엔진 클라이언트와 빌더 API를 함께 만들 수도 있습니다.
기존 `@xecms/client`의 `adminApps`는 이 패키지로 이동했습니다. 일반 엔진 API의 경로와
인증 동작은 유지합니다.
