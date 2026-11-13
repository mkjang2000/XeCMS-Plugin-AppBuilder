# @xecms/app-builder-admin

선택 설치하는 [업무 화면 빌더](../../README.md)의 독립 관리 화면 번들입니다.
엔진 관리 UI와 별도로 빌드하며 `/extensions/app-builder/`에서 정적 자원을 제공합니다.

- `/admin/apps` — 앱 목록·생성·설정
- `/admin-apps/:appId/screens` — 화면 편집기
- `/apps/:appKey/*` — 업무 화면 실행

저장된 앱 URL과 데이터 형식을 유지합니다. 엔진 관리 UI에서 제공하는 확장 링크로
이 번들에 이동하며, 기본 엔진 설치에는 편집기와 차트 런타임이 포함되지 않습니다.
