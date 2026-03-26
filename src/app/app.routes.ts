import { Routes } from '@angular/router';
import { AuthStartComponent } from './auth/auth-start.component';
import { AuthEndComponent } from './auth/auth-end.component';
import { HomeComponent } from './home/home.component';
import { TabConfigComponent } from './tab-config/tab-config.component';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent, canActivate: [authGuard] },
  { path: 'tab-config', component: TabConfigComponent },
  { path: 'auth-start', component: AuthStartComponent },
  { path: 'auth-end', component: AuthEndComponent },
  { path: '**', redirectTo: 'home' },
];
