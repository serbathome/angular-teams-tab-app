import { Component, OnInit } from '@angular/core';
import { UserManager, UserManagerSettings } from 'oidc-client-ts';
import { environment } from '../../environments/environment';

/**
 * auth-start runs inside the Teams popup window.
 * It must NOT use the Teams SDK — the popup is a plain browser window.
 * Its only job is to kick off the PKCE redirect to the IdP immediately.
 */
@Component({
  selector: 'app-auth-start',
  standalone: true,
  template: `<p>Redirecting to login&hellip;</p>`,
})
export class AuthStartComponent implements OnInit {
  ngOnInit(): void {
    const settings: UserManagerSettings = {
      authority: environment.oidc.authority,
      client_id: environment.oidc.clientId,
      redirect_uri: environment.oidc.redirectUri,
      scope: environment.oidc.scope,
      response_type: environment.oidc.responseType,
      response_mode: 'query',
    };

    const manager = new UserManager(settings);
    // Immediately redirect the popup to the IdP login page
    manager.signinRedirect().catch((err: unknown) => {
      console.error('[auth-start] signinRedirect failed', err);
    });
  }
}
