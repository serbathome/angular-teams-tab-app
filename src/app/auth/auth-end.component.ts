import { Component, OnInit } from '@angular/core';
import { app, authentication } from '@microsoft/teams-js';
import { AuthService } from './auth.service';

/**
 * auth-end is the OIDC redirect_uri page loaded inside the Teams popup.
 * It MUST initialize the Teams SDK before calling notifySuccess/notifyFailure.
 */
@Component({
  selector: 'app-auth-end',
  standalone: true,
  template: `<p>Completing sign-in&hellip;</p>`,
})
export class AuthEndComponent implements OnInit {
  constructor(private readonly authService: AuthService) {}

  async ngOnInit(): Promise<void> {
    try {
      // Teams SDK must be initialized in the popup before notifySuccess/notifyFailure
      await app.initialize();

      const user = await this.authService.completeSignin();
      authentication.notifySuccess(JSON.stringify(user));
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      authentication.notifyFailure(reason);
    }
  }
}
