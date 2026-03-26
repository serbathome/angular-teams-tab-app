import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User, UserManager, UserManagerSettings } from 'oidc-client-ts';
import { authentication } from '@microsoft/teams-js';
import { environment } from '../../environments/environment';

const userManagerSettings: UserManagerSettings = {
  authority: environment.oidc.authority,
  client_id: environment.oidc.clientId,
  redirect_uri: environment.oidc.redirectUri,
  scope: environment.oidc.scope,
  response_type: environment.oidc.responseType,
  response_mode: 'query',
  // Store tokens in sessionStorage only — never localStorage
  userStore: undefined, // defaults to sessionStorage via WebStorageStateStore
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userManager = new UserManager(userManagerSettings);
  readonly user$ = new BehaviorSubject<User | null>(null);

  constructor() {
    // Sync user state on service init (restores from sessionStorage if present)
    this.userManager.getUser().then((user) => this.user$.next(user));

    // Keep BehaviorSubject in sync with UserManager events
    this.userManager.events.addUserLoaded((user) => this.user$.next(user));
    this.userManager.events.addUserUnloaded(() => this.user$.next(null));
    this.userManager.events.addUserSignedOut(() => this.user$.next(null));
  }

  get currentUser(): User | null {
    return this.user$.getValue();
  }

  get accessToken(): string | null {
    return this.currentUser?.access_token ?? null;
  }

  /**
   * Returns the current user if valid.
   * If the user is expired and has a refresh_token, attempts a silent renew.
   * Otherwise goes straight to the Teams popup — avoids hanging hidden-iframe
   * silent auth inside Teams (which causes the popup to never fire).
   */
  async ensureAuthenticated(): Promise<User> {
    const existing = await this.userManager.getUser();
    if (existing && !existing.expired) {
      return existing;
    }

    if (existing?.refresh_token) {
      try {
        const renewed = await this.userManager.signinSilent();
        if (renewed) return renewed;
      } catch {
        // refresh failed — fall through to popup
      }
    }

    return this.loginViaTeamsPopup();
  }

  /**
   * Opens the Teams authentication popup, which loads /auth-start.
   * On completion the auth-end component calls notifySuccess with the serialised User.
   */
  loginViaTeamsPopup(): Promise<User> {
    return new Promise<User>((resolve, reject) => {
      authentication.authenticate({
        url: `${window.location.origin}/auth-start`,
        width: 600,
        height: 535,
        successCallback: (result: string | undefined) => {
          const user: User = JSON.parse(result ?? '{}');
          this.user$.next(user);
          resolve(user);
        },
        failureCallback: (reason: string) => {
          reject(new Error(reason));
        },
      });
    });
  }

  async logout(): Promise<void> {
    await this.userManager.signoutSilent();
    this.user$.next(null);
  }

  /** Called from the auth-end component after the IdP redirect. */
  async completeSignin(): Promise<User> {
    const user = await this.userManager.signinRedirectCallback();
    this.user$.next(user);
    return user;
  }
}
