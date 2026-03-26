import {
  APP_INITIALIZER,
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { app } from '@microsoft/teams-js';

import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { ThemeService } from './theme/theme.service';

function initializeTeamsAndTheme(): () => Promise<void> {
  return async () => {
    try {
      await app.initialize();
      await inject(ThemeService).initialize();
    } catch {
      // Running outside Teams (local browser dev) — safe to continue
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTeamsAndTheme,
      multi: true,
    },
  ],
};
