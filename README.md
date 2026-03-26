# BMW Teams Angular Tab

An Angular 21 application running as a Microsoft Teams tab, authenticated via the **OAuth 2.0 Authorization Code flow with PKCE** through the Teams popup auth pattern.

> **This solution is IdP-agnostic.** It works with any standards-compliant OIDC provider — Keycloak, Okta, Auth0, PingFederate, AWS Cognito, Google Identity Platform, and others. Microsoft Entra ID is used throughout this documentation purely as a concrete example. To switch providers, only the `environment.oidc` block needs to change.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [SDKs & Dependencies](#sdks--dependencies)
3. [Authentication Flow — Step by Step](#authentication-flow--step-by-step)
4. [Call Flow Diagram](#call-flow-diagram)
5. [Token Lifecycle & Silent Renewal](#token-lifecycle--silent-renewal)
6. [Route Structure](#route-structure)
7. [Key Source Files](#key-source-files)
8. [Teams App Manifest](#teams-app-manifest)
9. [Environment Configuration](#environment-configuration)
10. [Local Development](#local-development)
11. [Security Notes](#security-notes)

---

## Architecture Overview

Teams renders the app inside an **iframe**. The iframe cannot open native browser popups directly — instead, the Teams JS SDK proxies popup windows on behalf of the tab through `authentication.authenticate()`. This is the Teams popup auth pattern.

Authentication is entirely **client-side** (SPA / public client):

- No client secret — PKCE replaces it for public clients, as required by the OAuth 2.0 Security BCP for SPAs.
- Tokens are stored in **`sessionStorage`** (never `localStorage`) to prevent cross-tab leakage.
- The Identity Provider (IdP) is **configurable** — any OIDC-compliant provider works. Entra ID is the example used here.

```
┌─────────────────────────────────────────────────┐
│                 Microsoft Teams                 │
│  ┌───────────────────────────────────────────┐  │
│  │           Main Tab (iframe)               │  │
│  │   Angular app @ /home                     │  │
│  │   AuthService · AuthGuard · Interceptor   │  │
│  └──────────────┬────────────────────────────┘  │
│                 │ authentication.authenticate() │
│  ┌──────────────▼────────────────────────────┐  │
│  │          Popup Window                     │  │
│  │  1. /auth-start  →  IdP login page        │  │
│  │  2. IdP          →  /auth-end (redirect)  │  │
│  │  3. /auth-end    →  notifySuccess(token)  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## SDKs & Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@microsoft/teams-js` | `^2.50.0` | Teams SDK v2 — SDK init, popup auth, theme, context |
| `oidc-client-ts` | `^3.5.0` | PKCE code generation, OIDC discovery, token exchange, silent renew |
| `@angular/core` | `^21.2.0` | Application framework |
| `@angular/router` | `^21.2.0` | SPA routing (`/home`, `/auth-start`, `/auth-end`, `/tab-config`) |
| `rxjs` | `~7.8.0` | Reactive auth state via `BehaviorSubject<User \| null>` |

### Teams JS SDK v2 API surface used

| Import path | Symbols used |
|---|---|
| `@microsoft/teams-js` → `app` | `app.initialize()`, `app.getContext()`, `app.registerOnThemeChangeHandler()` |
| `@microsoft/teams-js` → `authentication` | `authentication.authenticate()`, `authentication.notifySuccess()`, `authentication.notifyFailure()` |
| `@microsoft/teams-js` → `pages` | `pages.config.setValidityState()`, `pages.config.setConfig()`, `pages.config.registerOnSaveHandler()` |

---

## Authentication Flow — Step by Step

### Phase 1 — App Bootstrap (`APP_INITIALIZER`)

Before Angular renders any route, `app.config.ts` runs an `APP_INITIALIZER`:

1. Calls `app.initialize()` from `@microsoft/teams-js` — registers the tab with the Teams host.
2. Calls `ThemeService.initialize()` — reads `app.getContext()` for the current theme (`default` | `dark` | `contrast`) and applies a CSS class on `<body>`. Registers `registerOnThemeChangeHandler` for live theme switching.
3. If running outside Teams (plain browser), the `try/catch` silently continues — this enables local development without Teams.

### Phase 2 — Route Navigation & Guard

When the user navigates to `/home`, `authGuard` (`CanActivateFn`) runs:

1. Calls `AuthService.ensureAuthenticated()`.
2. If a valid non-expired `User` exists in `sessionStorage` → resolves immediately, no network call.
3. If an expired user with a `refresh_token` exists → attempts `UserManager.signinSilent()` (token refresh via the IdP's token endpoint, discovered from `authority`). On success, resolved with the renewed token.
4. If no user or silent renew fails → triggers **Teams popup auth** (Phase 3).
5. If the popup throws (e.g. user closes it) → the guard still returns `true`; `HomeComponent` shows the "Sign in" button as fallback.

> **Why not call `signinSilent()` unconditionally?**  
> `oidc-client-ts`'s silent renew opens a hidden iframe. Inside Teams (which is already an iframe), this nested iframe either hangs or times out — preventing the popup from ever firing. The app only calls `signinSilent()` when a `refresh_token` is already available.

### Phase 3 — Teams Popup Auth

`AuthService.loginViaTeamsPopup()` calls:

```typescript
authentication.authenticate({
  url: `${window.location.origin}/auth-start`,
  width: 600,
  height: 535,
  successCallback: (result) => { /* deserialise User, update BehaviorSubject */ },
  failureCallback: (reason) => { /* reject promise */ },
});
```

Teams opens a **real browser popup window** (not an iframe) and loads `/auth-start`.

### Phase 4 — `/auth-start` (Popup Window)

`AuthStartComponent` runs inside the popup. It **must not** import or use the Teams SDK — the popup is a standalone browser window with no Teams context.

1. Creates a fresh `UserManager` with the same OIDC settings.
2. Calls `manager.signinRedirect()` — `oidc-client-ts` first fetches the IdP's OpenID Connect discovery document (`{authority}/.well-known/openid-configuration`) to locate the authorization endpoint, then generates a **PKCE `code_verifier`** and `code_challenge`, stores state in `sessionStorage`, and immediately redirects the popup:

```
{authority}/authorize          ← resolved from OIDC discovery
  ?client_id={clientId}
  &response_type=code
  &response_mode=query
  &redirect_uri=https://{host}/auth-end
  &scope=openid profile email offline_access
  &code_challenge=<PKCE>
  &code_challenge_method=S256
  &state=<opaque>
  &nonce=<random>
```

The popup navigates away to the IdP's hosted login page. The exact URL is discovered automatically — no hardcoded endpoint paths required.

### Phase 5 — User Logs In at the IdP

The user authenticates interactively at the IdP's hosted login page. The IdP validates credentials (MFA, session policies, etc.) and redirects back to `redirect_uri` with:

```
https://{host}/auth-end?code=<auth_code>&state=<state>
```

### Phase 6 — `/auth-end` (Popup Window, Post-Redirect)

`AuthEndComponent` runs inside the popup on the redirect.

1. **Must** call `await app.initialize()` — the popup is now on the app's domain, and Teams SDK must be initialised before calling `notifySuccess/notifyFailure`.
2. Calls `AuthService.completeSignin()` → `UserManager.signinRedirectCallback()`:
   - Reads `code` and `state` from the URL query string.
   - Validates `state` matches the stored value (CSRF protection).
   - Exchanges `code` + `code_verifier` for tokens at the IdP's token endpoint (resolved from OIDC discovery; PKCE verified server-side).
   - Stores the `User` (access token, ID token, refresh token) in `sessionStorage`.
3. On success: calls `authentication.notifySuccess(JSON.stringify(user))` — signals Teams to close the popup and invoke `successCallback` in the main tab.
4. On failure: calls `authentication.notifyFailure(reason)` — signals Teams to invoke `failureCallback`.

### Phase 7 — Main Tab Receives Result

Back in the main tab, `successCallback` fires:

1. Deserialises the `User` object from the JSON string.
2. Updates `AuthService.user$` (`BehaviorSubject`) — all subscribed components re-render reactively.
3. The auth guard's `ensureAuthenticated()` promise resolves.
4. Angular renders `HomeComponent` showing the authenticated user's profile.

### Phase 8 — Outgoing API Calls

`authInterceptor` (registered globally via `provideHttpClient(withInterceptors([authInterceptor]))`) automatically attaches the bearer token to every outgoing `HttpClient` request:

```http
Authorization: Bearer <access_token>
```

No component needs to handle this manually.

---

## Call Flow Diagram

```
Main Tab (iframe)                   Popup Window                OIDC Provider (any)
      │                                   │                              │
      │  [APP_INITIALIZER]                │                              │
      │  app.initialize()                 │                              │
      │  ThemeService.initialize()        │                              │
      │                                   │                              │
      │  authGuard → ensureAuthenticated()│                              │
      │  no valid token in sessionStorage │                              │
      │                                   │                              │
      │  authentication.authenticate()    │                              │
      │─────── opens popup ─────────────▶│                              │
      │                                   │  /auth-start loads           │
      │                                   │  UserManager.signinRedirect()│
      │                                   │──── GET /.well-known/ ──────▶│  (OIDC discovery)
      │                                   │◀─── openid-configuration ────│
      │                                   │──── GET /authorize ─────────▶│
      │                                   │     (PKCE, state, nonce)     │
      │                                   │                              │
      │                                   │         [user logs in]       │
      │                                   │◀─── redirect /auth-end?code ─│
      │                                   │                              │
      │                                   │  /auth-end loads             │
      │                                   │  app.initialize()            │
      │                                   │  signinRedirectCallback()    │
      │                                   │──── POST /token ────────────▶│
      │                                   │     (code + code_verifier)   │
      │                                   │◀─── access_token, id_token ──│
      │                                   │     refresh_token            │
      │                                   │                              │
      │                                   │  authentication.notifySuccess│
      │◀────── successCallback(user) ────│                              │
      │                                   │  [popup closes]              │
      │  user$.next(user)                 │                              │
      │  HomeComponent re-renders         │                              │
      │                                   │                              │
      │  HttpClient.get('/api/data')      │                              │
      │  authInterceptor adds Bearer token│                              │
      │─── Authorization: Bearer <token> ───────────────────────────────▶│
```

---

## Token Lifecycle & Silent Renewal

| Token | Storage | Typical lifetime |
|---|---|---|
| Access token | `sessionStorage` | 1 hour (IdP-configurable) |
| ID token | `sessionStorage` | 1 hour (IdP-configurable) |
| Refresh token | `sessionStorage` | Hours to days (IdP-configurable) |

On subsequent page loads or guard activations, `AuthService` reads the user from `sessionStorage`. If the access token is expired but a `refresh_token` is present, `signinSilent()` exchanges it for a new access token at the IdP's token endpoint — **no popup required**.

`scope: 'openid profile email offline_access'` — `openid` is required by OIDC; `offline_access` is the standard scope to request a refresh token. Some IdPs (e.g. Keycloak, Okta) use different mechanisms — check your IdP's documentation if refresh tokens are not being issued.

---

## Route Structure

| Route | Component | Guard | Purpose |
|---|---|---|---|
| `/` | — | — | Redirects to `/home` |
| `/home` | `HomeComponent` | `authGuard` | Main app view; shows auth state |
| `/auth-start` | `AuthStartComponent` | none | PKCE redirect initiator (popup) |
| `/auth-end` | `AuthEndComponent` | none | OIDC callback handler (popup) |
| `/tab-config` | `TabConfigComponent` | none | Channel tab configuration page |
| `**` | — | — | Redirects to `/home` |

---

## Key Source Files

```
src/app/
├── app.config.ts                   APP_INITIALIZER: Teams SDK + theme bootstrap
├── app.routes.ts                   Route definitions
├── app.ts                          Root component (<router-outlet />)
├── auth/
│   ├── auth.service.ts             UserManager, ensureAuthenticated(), loginViaTeamsPopup()
│   ├── auth-start.component.ts     Popup page 1 — initiates PKCE redirect
│   ├── auth-end.component.ts       Popup page 2 — completes token exchange
│   ├── auth.guard.ts               CanActivateFn — ensures valid session before route
│   └── auth.interceptor.ts         HttpInterceptorFn — attaches Bearer token
├── home/
│   └── home.component.ts           UI — authenticated / unauthenticated state
├── tab-config/
│   └── tab-config.component.ts     Team channel tab configuration
└── theme/
    └── theme.service.ts            Applies Teams theme class on <body>
```

---

## Teams App Manifest

Located in `teams-app/manifest.json` (manifest version `1.17`).

| Field | Value |
|---|---|
| App ID | `00c0513e-7bc8-4a98-bcb4-36fbed66c808` |
| Personal tab content URL | `{host}/home` |
| Channel tab config URL | `{host}/tab-config` |
| Scopes | `personal`, `team`, `groupchat` |
| `validDomains` | Must include the app hostname |

**Important:** `validDomains` must be kept in sync with any hostname change (devtunnel → production). Teams will refuse to load or run popups for domains not listed here.

The uploadable package `teams-app/teams-tab.zip` contains `manifest.json`, `color.png` (192×192), and `outline.png` (32×32).

---

## Environment Configuration

`src/environments/environment.ts` (dev) and `environment.prod.ts` (production):

```typescript
export const environment = {
  production: false,
  oidc: {
    // The OIDC issuer URL. oidc-client-ts appends /.well-known/openid-configuration
    // to discover all endpoints automatically.
    authority: 'https://{your-idp}/{realm-or-tenant}',
    clientId: '{your-client-id}',
    redirectUri: 'https://{host}/auth-end',
    scope: 'openid profile email offline_access',
    responseType: 'code',
  },
};
```

**Switching IdP requires only these four values** — no code changes. Examples:

| Provider | `authority` example |
|---|---|
| Microsoft Entra ID | `https://login.microsoftonline.com/{tenant-id}/v2.0` |
| Keycloak | `https://{host}/realms/{realm}` |
| Okta | `https://{org}.okta.com/oauth2/default` |
| Auth0 | `https://{domain}` |
| AWS Cognito | `https://cognito-idp.{region}.amazonaws.com/{userPoolId}` |

The `redirectUri` must be registered at the IdP as a **public client / SPA redirect URI** (not a Web/confidential type) so the IdP's token endpoint returns CORS headers. Using the wrong type blocks the PKCE token exchange in the browser.

---

## Local Development

Requires an HTTPS tunnel because Teams will not load `http://localhost`.

```bash
# Start the tunnel (reuse the same tunnel ID to keep the URL stable)
devtunnel host -p 4200 --allow-anonymous

# Start the Angular dev server
npm start
```

Update `redirectUri` in `environment.ts` and the `validDomains` + content URLs in `manifest.json` to match the devtunnel hostname, then re-upload `teams-tab.zip`.

**Regenerate the zip after any manifest change:**

```powershell
$src = ".\teams-app"
Remove-Item "$src\teams-tab.zip" -ErrorAction SilentlyContinue
Compress-Archive -Path "$src\manifest.json","$src\color.png","$src\outline.png" -DestinationPath "$src\teams-tab.zip"
```

---

## Security Notes

| Concern | Mitigation |
|---|---|
| No client secret in browser | SPA / public client — PKCE is the proof of possession |
| Token storage | `sessionStorage` only — cleared on tab close, not accessible cross-tab |
| CSRF on redirect | `state` parameter validated by `oidc-client-ts` in `signinRedirectCallback()` |
| Replay attack on code | `nonce` claim validated against stored value during ID token verification |
| CORS on token endpoint | SPA redirect URI type grants the necessary CORS headers from Entra ID |
| Domain allow-listing | `validDomains` in manifest prevents Teams from loading untrusted origins |
| Bearer token on all requests | `authInterceptor` only attaches the token when it is non-null; no token → request goes unauthenticated |

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
