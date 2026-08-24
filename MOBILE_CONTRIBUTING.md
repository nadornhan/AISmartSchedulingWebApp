# Mobile Development Contribution Guide

This guide defines how contributors should build and review the mobile version of AI Smart Scheduling. It complements the repository's main [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Architecture Decision

The mobile application reuses the existing Next.js and Tailwind CSS frontend. Capacitor packages the exported web application inside native Android and iOS shells.

```text
frontend/web (Next.js + React + Tailwind)
             |
             | next build
             v
frontend/web/out (static web assets)
             |
             | cap sync
             v
Android / iOS Capacitor shells
             |
             | HTTPS + Bearer JWT
             v
FastAPI backend -> SQLAlchemy/Alembic -> PostgreSQL
```

The browser and mobile applications share feature components, API clients, types, validation, and business rules. Mobile-specific code should be limited to responsive presentation, native lifecycle behaviour, and native capability adapters.

## Source-of-Truth Rules

- Develop mobile UI in `frontend/web`, not in a second React Native UI.
- Use Tailwind responsive utilities for layouts shared between browser and mobile.
- Create a mobile-specific component only when its interaction is materially different from desktop.
- Keep FastAPI as the only application-data gateway. Mobile code must not connect directly to PostgreSQL or Supabase.
- Keep native functionality behind TypeScript adapters with browser-safe fallbacks.
- Do not implement the same feature independently in Expo and Capacitor.
- Keep `frontend/mobile` parked during the Capacitor proof of concept. Remove or archive it only after the team formally accepts Capacitor.

## Intended Repository Layout

```text
frontend/
  web/
    app/                    Next.js routes
    components/             Shared and responsive feature UI
    lib/                    API clients and platform-neutral services
    public/                 Web and shared static assets
    out/                    Generated static export; do not hand-edit
    capacitor.config.ts     Capacitor application configuration
    android/                Versioned Android native project
    ios/                    Versioned iOS native project
  mobile/                   Existing Expo scaffold; parked while Capacitor is evaluated

backend/
  api/                      FastAPI application and tests

packages/
  shared/                   Shared TypeScript contracts and constants
```

Generated build directories such as `out/`, `.next/`, Android build output, and Xcode derived data must not be committed. Native project source and configuration may be committed once the proof of concept is accepted.

## Three-Person Ownership Model

### Contributor 1 — Responsive UI

Primary scope:

- `frontend/web/app/`
- `frontend/web/components/`
- Tailwind and shared layout styles
- Mobile navigation, safe areas, touch targets, keyboard-safe forms, and responsive feature views

Suggested branch: `feature/mobile-responsive-ui`

### Contributor 2 — Capacitor and Native Shells

Primary scope:

- `frontend/web/capacitor.config.ts`
- `frontend/web/android/`
- `frontend/web/ios/`
- Capacitor scripts and plugins
- App lifecycle, Android back behaviour, deep links, icons, splash screens, signing, and native builds

Suggested branch: `feature/capacitor-native-shell`

### Contributor 3 — API, Authentication, and Quality

Primary scope:

- `frontend/web/lib/`
- `backend/api/`
- Environment-specific API configuration
- CORS, token storage, session expiry, offline/error handling, integration tests, and device test evidence

Suggested branch: `feature/mobile-api-auth`

All three branches should integrate regularly through `feature/capacitor-mobile` before merging into `develop`.

## Dependency Contracts

The team must agree on these contracts before parallel implementation:

| Contract | Decision |
| --- | --- |
| Mobile UI source | `frontend/web` |
| Web build output | `frontend/web/out` |
| Native wrapper | Capacitor |
| First proof-of-concept platform | Android |
| API environment variable | `NEXT_PUBLIC_API_URL` |
| Backend protocol outside local development | HTTPS |
| Application data path | Mobile/Web -> FastAPI -> PostgreSQL |
| Integration branch | `feature/capacitor-mobile` |

Changes to these contracts require team agreement because they can block the other workstreams.

## Responsive UI Guidelines

Design mobile-first, then enhance the layout at larger breakpoints.

### Before Starting Mobile UI

Responsive UI development does **not** need to wait for Capacitor, Android Studio, the generated Android project, native plugins, signing, or store configuration. Contributors can build and review the mobile UI immediately in `frontend/web` using browser responsive-device tools.

Before feature UI work begins, the team only needs to confirm:

- Mobile UI remains in `frontend/web`.
- `frontend/mobile` remains parked during the Capacitor proof of concept.
- The UI contributor works from `feature/mobile-responsive-ui` and integrates through `feature/capacitor-mobile`.
- Existing Tailwind breakpoints remain the shared responsive system.
- UI is verified at 360, 390, 430, and 768 pixels plus desktop.
- The team agrees on the shared mobile shell: navigation pattern, mobile header, content spacing, safe-area behaviour, modal behaviour, and software-keyboard expectations.
- The current desktop experience is recorded as a regression baseline.

The initial workstreams should proceed in parallel:

```text
Contributor 1: shared responsive shell and mobile navigation
Contributor 2: Next.js static export and Android Capacitor proof of concept
Contributor 3: API environments, CORS, and token-storage abstraction
```

The UI contributor should implement the visual navigation and responsive layout in the browser first. Contributor 2 later connects native Android back-button and lifecycle behaviour to that agreed navigation contract.

Build the shared mobile foundation before adapting individual feature pages:

```text
Shared mobile shell and navigation
    -> mobile header, spacing, and safe areas
    -> shared modals and keyboard-safe forms
    -> Dashboard
    -> Task Management
    -> Calendar
    -> Priority and Focus
    -> Profile, Settings, and Notifications
```

Individual feature pages must not introduce independent mobile navigation, shell, spacing, or modal systems.

```tsx
<section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
  {/* Shared cards */}
</section>
```

Use separate views when shrinking the desktop view would create a poor touch experience.

```tsx
<>
  <MobileAgenda className="lg:hidden" />
  <DesktopCalendar className="hidden lg:block" />
</>
```

Every mobile UI contribution must follow these rules:

- Support viewport widths of at least 360, 390, and 430 pixels.
- Avoid page-level horizontal scrolling.
- Do not depend on hover to expose required actions.
- Use comfortable touch targets, approximately 44–48 pixels where practical.
- Respect safe-area insets around notches and home indicators.
- Use `dvh` carefully for full-height experiences and test browser/WebView resizing.
- Keep primary form actions visible when the software keyboard is open.
- Provide mobile alternatives for dense tables, boards, calendar grids, and drag-only interactions.
- Preserve keyboard navigation, focus visibility, accessible names, contrast, and reduced-motion behaviour.

Feature-specific expectations:

- **Navigation:** replace the persistent desktop sidebar with a drawer or bottom navigation on small screens.
- **Tasks:** render compact cards or stacked rows; keep all actions touch-accessible.
- **Calendar:** provide an agenda/day experience when the month grid is too dense.
- **Priority:** stack columns or use deliberate horizontal paging instead of four compressed columns.
- **Focus:** persist timer timestamps across background/resume and test audio lifecycle.
- **Forest 3D:** profile WebGL memory and frame rate; provide a reduced-motion or 2D fallback.
- **Modals:** support small screens, internal scrolling, safe areas, and the software keyboard.

## Next.js Static Export Guidelines

Capacitor requires a built asset directory containing `index.html`. The intended Next.js configuration is:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
```

If `next/image` is introduced, confirm static-export compatibility and configure an appropriate loader or `images.unoptimized`.

Do not introduce request-time Next.js features without discussing their effect on Capacitor. Potential blockers include:

- Server Actions
- request-dependent Route Handlers
- middleware, rewrites, redirects, or request headers
- cookies that require a Next.js server
- dynamic routes without statically generated parameters
- default server-side image optimisation

All application data that changes at runtime should continue to be fetched client-side from FastAPI.

## Capacitor Workflow

Run Capacitor commands from `frontend/web`.

Initial setup:

```powershell
cd frontend/web
corepack pnpm add @capacitor/core @capacitor/android @capacitor/ios
corepack pnpm add -D @capacitor/cli
corepack pnpm exec cap init "AI Smart Scheduling" "com.yourcompany.aischeduling"
```

The application ID above is a placeholder. Agree on the permanent reverse-domain identifier before generating release projects.

Expected configuration:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.aischeduling',
  appName: 'AI Smart Scheduling',
  webDir: 'out',
  loggingBehavior: 'debug',
};

export default config;
```

Normal development loop:

```powershell
corepack pnpm build
corepack pnpm exec cap sync
corepack pnpm exec cap run android
```

Use `cap open android` or `cap open ios` when work requires Android Studio or Xcode. iOS builds and signing require macOS and Xcode.

Never configure a production build to load a remote development server. Production packages should contain the reviewed static assets from `out/`.

## API and Environment Guidelines

`localhost` inside a phone or emulator does not normally refer to the computer running FastAPI.

Use explicit environments:

```text
Browser local:       http://localhost:8000
Android emulator:    http://10.0.2.2:8000       (debug only)
Physical device dev: reachable LAN/HTTPS endpoint
Staging:             https://api-staging.example.com
Production:          https://api.example.com
```

- Do not commit real secrets or production credentials.
- Do not ship a release build that falls back silently to `localhost`.
- Use HTTPS for staging and production.
- Configure FastAPI CORS through an explicit environment-driven allowlist.
- Observe the actual WebView `Origin` header during the proof of concept before finalising CORS entries.
- Do not replace the CORS allowlist with `*` for convenience.
- Keep environment-specific values outside feature components.

## Authentication and Storage

The existing browser client stores its JWT in `localStorage`. Before production mobile release, API helpers should depend on an asynchronous token-store interface:

```ts
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}
```

Expected implementations:

- Browser: local web storage, subject to the existing security model.
- Native: a reviewed secure-storage implementation backed by iOS Keychain and Android Keystore.

Rules:

- Never log access tokens, refresh tokens, passwords, or authorization headers.
- Logout must clear all protected local state.
- Handle token expiry consistently across browser and native builds.
- Decide refresh-token behaviour with the backend team before implementing it locally.
- Deep links and notification routes must validate both authentication state and destination.

## Native Plugin Guidelines

Do not call Capacitor plugins directly throughout feature components. Add a platform adapter under `frontend/web/lib/platform/` and expose the smallest capability required.

```text
Feature component
      |
      v
Platform service interface
      |------------------|
      v                  v
Browser fallback     Capacitor plugin
```

Before adding a plugin:

- Confirm the feature cannot be implemented adequately with existing web APIs.
- Check maintenance status and compatibility with the repository's Capacitor version.
- Document Android/iOS permissions and privacy disclosures.
- Define behaviour when permission is denied or the plugin is unavailable.
- Add browser-safe behaviour so the normal web application still works.
- Test lifecycle, background/resume, and failure cases on physical devices.

Keep `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`, and official plugins on compatible versions.

## Delivery Milestones, Checkpoints, and Tasks

Mobile development must follow the milestones below. Do not treat the mobile project as an unordered collection of page-building issues. Foundation tasks establish contracts used by UI, API, authentication, and native work, while checkpoint reviews determine whether the team is ready to continue.

```text
Architecture
    -> Capacitor Android proof of concept
    -> API and authentication foundation
    -> Shared mobile shell
    -> Core product flows
    -> Native capabilities
    -> Secondary screens
    -> QA and release
```

### Checkpoint 0 — Architecture Ready

**Purpose:** remove ambiguity before implementation and ensure all three contributors are building toward the same application.

Tasks:

- `[MOBILE][ARCH] Confirm shared Next.js/Tailwind and Capacitor architecture`
- `[MOBILE][ARCH] Confirm mobile source paths and ownership boundaries`
- `[MOBILE][ARCH] Choose permanent application ID and display name`
- `[MOBILE][ARCH] Confirm development, staging, and production API strategy`
- `[MOBILE][DESIGN] Approve the mobile shell and core-flow designs`

Required decisions:

```text
UI source:              frontend/web
Static build output:    frontend/web/out
Native wrapper:         Capacitor
First native platform:  Android
Backend:                FastAPI
Integration branch:     feature/capacitor-mobile
```

Checkpoint passes when:

- The three contributors agree on the contracts above.
- The mobile shell and first core flow have sufficient design direction to start.
- Each initial issue has an owner, dependency list, and acceptance criteria.
- The team agrees not to implement a separate UI in `frontend/mobile`.

### Checkpoint 1 — Android Proof of Concept

**Primary owner:** Contributor 2 — Capacitor and Native Shells  
**Supporting owner:** Contributor 3 — API, Authentication, and Quality

Tasks:

- `[MOBILE][CAPACITOR] Validate Next.js static export`
- `[MOBILE][CAPACITOR] Create Android Capacitor proof of concept`
- `[MOBILE][CAPACITOR] Add mobile build, sync, run, and open scripts`
- `[MOBILE][API] Connect Android development build to FastAPI`
- `[MOBILE][QA] Record Android proof-of-concept smoke-test evidence`

Checkpoint passes when a clean checkout can:

1. Build `frontend/web` successfully.
2. Produce `frontend/web/out` with an `index.html` entry point.
3. Run `cap sync` without errors.
4. Launch bundled assets in an Android emulator.
5. Reach a non-`localhost` FastAPI endpoint.
6. Complete login and one authenticated task request.

Do not begin broad plugin integration before this checkpoint passes.

### Checkpoint 2 — API and Authentication Foundation

**Primary owner:** Contributor 3 — API, Authentication, and Quality  
**Supporting owner:** Contributor 2 — Capacitor and Native Shells

Tasks:

- `[MOBILE][API] Configure development, staging, and production API environments`
- `[MOBILE][API] Configure explicit FastAPI CORS origins for web and Capacitor`
- `[MOBILE][AUTH] Introduce asynchronous platform-neutral token storage`
- `[MOBILE][AUTH] Define native secure-storage implementation`
- `[MOBILE][AUTH] Handle session expiry and logout cleanup`
- `[MOBILE][API] Standardise offline, timeout, 401, 403, and 500 behaviour`

Checkpoint passes when:

- Release builds cannot silently fall back to `localhost`.
- Browser and Android builds use the same API client contract.
- Tokens are not logged or exposed in errors.
- Login, restart, token expiry, and logout have documented behaviour.
- CORS permits only approved origins.
- Error and offline states can be triggered and verified consistently.

### Checkpoint 3 — Shared Mobile UI Foundation

**Primary owner:** Contributor 1 — Responsive UI  
**Supporting owner:** Contributor 2 — Capacitor and Native Shells

Tasks:

- `[MOBILE][UI] Implement responsive shell and mobile navigation`
- `[MOBILE][UI] Define mobile spacing, safe-area, and viewport standards`
- `[MOBILE][UI] Make shared modals and forms keyboard-safe`
- `[MOBILE][UI] Standardise loading, empty, error, and offline states`
- `[MOBILE][UI] Remove hover-only access to required actions`
- `[MOBILE][NATIVE] Implement Android back-button navigation contract`

Checkpoint passes when:

- Every existing core route is reachable from the mobile navigation.
- The shell works at 360, 390, and 430 pixel widths.
- There is no page-level horizontal scrolling.
- Primary actions remain usable with the software keyboard open.
- Required actions do not depend on hover.
- Android back behaviour is predictable and does not exit unexpectedly.
- Desktop navigation and layouts still work.

Feature-page issues should not independently create their own mobile shell, header, navigation, spacing system, or modal primitives.

### Checkpoint 4 — Core Product Flows

**Primary owner:** Contributor 1 — Responsive UI  
**Supporting owners:** Contributors 2 and 3 for native and API dependencies

Tasks should use **adapt** rather than **build**, because the implementation reuses the existing Next.js features:

- `[MOBILE][UI] Adapt Home Dashboard for mobile`
- `[MOBILE][UI] Adapt Task Management for mobile`
- `[MOBILE][UI] Adapt Calendar and agenda flows for mobile`
- `[MOBILE][UI] Adapt Priority view for mobile`
- `[MOBILE][UI] Adapt Focus mode for mobile lifecycle`
- `[MOBILE][PERF] Validate Forest 3D performance and fallback`

Checkpoint passes when users can complete these flows on an Android device:

1. Register or log in.
2. View the dashboard.
3. Create, update, complete, and delete a task.
4. View and modify calendar scheduling.
5. Use the priority workflow.
6. Start, background, resume, and finish a focus session.
7. Navigate away and return without losing valid state.

Each feature issue must include phone-width evidence and a desktop regression result.

### Checkpoint 5 — Native Capabilities

**Primary owner:** Contributor 2 — Capacitor and Native Shells  
**Supporting owners:** Contributors 1 and 3 where UI or backend support is required

Tasks:

- `[MOBILE][NATIVE] Handle app background and resume lifecycle`
- `[MOBILE][NATIVE] Configure splash screen, status bar, and app icons`
- `[MOBILE][NATIVE] Add local notifications for supported reminders`
- `[MOBILE][NATIVE] Configure authenticated deep links`
- `[MOBILE][NATIVE] Add haptics only where product-approved`
- `[MOBILE][AUTH] Enable secure native token storage`

Checkpoint passes when:

- Every plugin has a documented purpose and browser fallback.
- Permission requests occur in context and denial does not break core use.
- Android permissions and privacy implications are documented.
- Deep links validate route and authentication state.
- Background/resume behaviour is correct for timers and sessions.
- No development logging or sensitive values are present in release configuration.

### Checkpoint 6 — Secondary Screens

**Primary owner:** Contributor 1 — Responsive UI  
**Supporting owner:** Contributor 3 — API, Authentication, and Quality

Tasks:

- `[MOBILE][UI] Adapt Profile for mobile`
- `[MOBILE][UI] Adapt Settings for mobile`
- `[MOBILE][UI] Adapt Notifications UI for mobile`
- `[MOBILE][UI] Complete remaining responsive feature polish`

These tasks follow the core flows unless a secondary screen is required for authentication, permissions, or testing. A notification page and notification delivery are separate concerns: notification delivery belongs to the native-capabilities milestone.

Checkpoint passes when:

- Secondary screens follow the shared shell and component standards.
- Profile and settings changes persist through the existing FastAPI contracts.
- Notification preferences and notification delivery have distinct tests.
- The browser experience has not regressed.

### Checkpoint 7 — QA and Release Readiness

**Primary owner:** Contributor 3 — API, Authentication, and Quality  
**Supporting owners:** all contributors

Do not use one oversized issue such as `Complete Capacitor Integration and Mobile Testing`. Split verification and release work into reviewable tasks:

- `[MOBILE][QA] Run responsive browser regression`
- `[MOBILE][QA] Test core flows on a physical Android device`
- `[MOBILE][QA] Test offline, slow network, API errors, and session expiry`
- `[MOBILE][QA] Run accessibility review on core mobile flows`
- `[MOBILE][PERF] Profile startup, navigation, Focus audio, and Forest 3D`
- `[MOBILE][RELEASE] Prepare signed Android internal build`
- `[MOBILE][IOS] Create and validate iOS project on macOS`
- `[MOBILE][RELEASE] Complete store privacy, permissions, icons, and metadata`

Checkpoint passes when:

- All automated repository checks pass from a clean checkout.
- Core flows pass on a physical Android device.
- iOS has been validated on a simulator and physical device before iOS release.
- No production build contains localhost URLs, secrets, debug server configuration, or verbose sensitive logs.
- Accessibility, network failure, session expiry, and lifecycle scenarios pass.
- Signing, versioning, privacy disclosures, and store assets are complete.
- Known limitations have owners and are not release-blocking.

### Task Dependency Rules

Use explicit issue dependencies instead of relying on list order.

```text
Static export
    -> Android proof of concept
        -> Android device testing

API environments + CORS
    -> Android API connectivity
        -> Login and authenticated feature testing

Shared mobile shell
    -> Dashboard / Tasks / Calendar / Priority / Focus
        -> Profile / Settings / Notifications UI

TokenStore interface
    -> Native secure storage
        -> Session and deep-link release testing
```

An issue that is blocked should identify:

- `Blocked by`: issue number or contract decision.
- `Unblocks`: downstream issues or contributor.
- `Temporary work available`: work that can proceed without the dependency.
- `Expected handoff`: branch, interface, build, design, or test evidence required.

### Required Issue Template

Every mobile implementation issue should contain:

```markdown
## Outcome
Describe the user-visible or architectural result.

## Owner and Scope
- Owner:
- Expected files:
- Out-of-scope files:

## Dependencies
- Blocked by:
- Unblocks:

## Requirements
- Requirement 1
- Requirement 2

## Acceptance Criteria
- [ ] Works at 360, 390, and 430 px where UI is affected
- [ ] Works in the Android Capacitor build where native behaviour is affected
- [ ] Loading, empty, error, offline, or permission-denied states are covered where relevant
- [ ] Desktop browser regression checked
- [ ] No secrets, localhost release fallback, or sensitive logs added

## Verification Evidence
- Browser/device and OS:
- Screenshots or recording:
- Commands/tests run:
- Known limitations:
```

### Weekly Team Checkpoint

Hold a short checkpoint at least twice per week. Each contributor reports:

```text
Completed:
Next checkpoint task:
Blocked by:
Unblocks:
Contract changed:
Evidence or branch ready for handoff:
```

The checkpoint is for resolving dependencies, not reporting activity volume. Architecture research counts as progress only when it produces a decision, interface, test result, documented risk, or handoff that enables implementation.

## Git and Pull Request Workflow

Start from the latest integration branch:

```powershell
git fetch origin
git checkout feature/capacitor-mobile
git pull origin feature/capacitor-mobile
git checkout -b feature/mobile-responsive-ui
```

Use small pull requests with one clear outcome. Recommended sequence:

1. Static-export compatibility.
2. Android Capacitor proof of concept.
3. Platform abstraction and authentication storage.
4. Feature-owned responsive/mobile adaptations.
5. iOS project and release workflow.

Avoid unrelated formatting or feature rewrites in infrastructure pull requests. Do not commit generated build output, signing keys, provisioning profiles, local SDK paths, `.env` files, or device-specific IDE state.

Commit examples:

```text
feat(mobile): add responsive dashboard navigation
feat(capacitor): add Android native shell
fix(auth): support asynchronous native token storage
test(mobile): add API failure and session expiry coverage
docs(mobile): document Android development workflow
```

## Required Checks

Run the repository checks relevant to the change:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm --filter @ai-smart-scheduling/web build
corepack pnpm format:check
backend/api/.venv/Scripts/python -m pytest backend/api/tests
```

For changes affecting native delivery:

```powershell
cd frontend/web
corepack pnpm exec cap sync
corepack pnpm exec cap run android
```

A mobile pull request should include:

- Summary of the user-visible and architectural change.
- Screenshots or a short recording at relevant phone widths.
- Device/emulator model and OS/API version tested.
- Browser regression result.
- API environment used, without exposing secrets.
- Permission, privacy, CORS, authentication, or migration impact.
- Known limitations and follow-up issues.

## Minimum Test Matrix

| Area | Required coverage |
| --- | --- |
| Responsive browser | 360, 390, 430, 768 pixels and desktop regression |
| Android | Current emulator and one physical mid-range device before release |
| iOS | Current simulator and one physical iPhone before release |
| Network | Offline launch, slow response, timeout, 401, 403, and 500 |
| Session | Fresh login, app restart, token expiry, logout, and protected deep link |
| Accessibility | Focus order, labels, contrast, touch targets, dynamic text, reduced motion |
| Performance | Cold start, route navigation, calendar, focus lifecycle, and Forest 3D |

## Definition of Done

A mobile contribution is complete when:

- The shared web build still works and passes its checks.
- Static export succeeds from a clean checkout.
- `cap sync` succeeds without uncommitted generated surprises.
- The changed flow works at phone width without hover or horizontal page scrolling.
- Loading, empty, error, offline, expired-session, and permission-denied states are handled where relevant.
- The change has been tested on the stated browser/device matrix.
- No secret, signing material, local machine path, development URL, or sensitive log is included.
- Architecture or operating changes are documented.
- Another contributor can build and verify the change using the pull-request instructions.

## Proof-of-Concept Exit Gate

The team should accept Capacitor only after a clean checkout can:

1. Export the Next.js application successfully.
2. Sync the exported assets into Android.
3. Launch the bundled application on an emulator and physical device.
4. Reach a non-`localhost` FastAPI endpoint.
5. Complete login and task CRUD.
6. Navigate every core route at phone width.
7. Background and resume the application without corrupting focus/session state.
8. Demonstrate that remaining UX and performance issues are understood, estimated, and owned.

Until this gate passes, avoid broad native plugin adoption or irreversible removal of the Expo scaffold.
