import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);

  try {
    await authService.ensureAuthenticated();
  } catch {
    // Outside Teams or silent renew failed — let the route render;
    // HomeComponent shows the Sign in button as the fallback.
  }
  return true;
};
