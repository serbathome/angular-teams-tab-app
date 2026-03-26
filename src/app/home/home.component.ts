import { Component, OnInit, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { User } from 'oidc-client-ts';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  template: `
    <div class="page">
      <div class="card">
        <div class="card__logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="8" fill="var(--teams-brand, #6264a7)"/>
            <path d="M12 13h16M20 13v14" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>

        @if (user()) {
          <div class="status status--authenticated">
            <span class="status__dot"></span>
            Authenticated
          </div>
          <h1 class="card__title">
            Welcome, {{ displayName() }}
          </h1>
          <p class="card__subtitle">{{ user()!.profile.email ?? user()!.profile.sub }}</p>

          <div class="profile-row">
            <div class="profile-item">
              <span class="profile-item__label">Subject</span>
              <span class="profile-item__value">{{ user()!.profile.sub }}</span>
            </div>
            @if (user()!.profile['preferred_username']) {
              <div class="profile-item">
                <span class="profile-item__label">Username</span>
                <span class="profile-item__value">{{ user()!.profile['preferred_username'] }}</span>
              </div>
            }
            <div class="profile-item">
              <span class="profile-item__label">Token expires</span>
              <span class="profile-item__value">{{ tokenExpiry() }}</span>
            </div>
          </div>

          <button class="btn btn--secondary" (click)="signOut()">Sign out</button>
        } @else {
          <div class="status status--unauthenticated">
            <span class="status__dot"></span>
            Not signed in
          </div>
          <h1 class="card__title">Teams Tab</h1>
          <p class="card__subtitle">Sign in with your organisational account to continue.</p>
          <button class="btn btn--primary" (click)="signIn()">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 1a8 8 0 1 0 0 16A8 8 0 0 0 9 1Zm0 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm0 10.2a6 6 0 0 1-4.6-2.1C4.6 10.8 7 10 9 10s4.4.8 4.6 2.1A6 6 0 0 1 9 14.2Z" fill="currentColor"/>
            </svg>
            Sign in
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      box-sizing: border-box;
    }

    .card {
      background: var(--teams-bg, #ffffff);
      border: 1px solid color-mix(in srgb, var(--teams-fg, #201f1e) 12%, transparent);
      border-radius: 12px;
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 420px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      box-shadow: 0 2px 12px color-mix(in srgb, var(--teams-fg, #201f1e) 8%, transparent);
    }

    .card__logo {
      margin-bottom: 0.5rem;
    }

    .card__title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--teams-fg, #201f1e);
      text-align: center;
    }

    .card__subtitle {
      margin: 0;
      font-size: 0.9rem;
      color: color-mix(in srgb, var(--teams-fg, #201f1e) 60%, transparent);
      text-align: center;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 0.3rem 0.75rem;
      border-radius: 999px;
    }

    .status__dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status--authenticated {
      background: color-mix(in srgb, #107c10 12%, transparent);
      color: #107c10;
    }
    .status--authenticated .status__dot { background: #107c10; }

    .status--unauthenticated {
      background: color-mix(in srgb, var(--teams-fg, #201f1e) 8%, transparent);
      color: color-mix(in srgb, var(--teams-fg, #201f1e) 55%, transparent);
    }
    .status--unauthenticated .status__dot {
      background: color-mix(in srgb, var(--teams-fg, #201f1e) 40%, transparent);
    }

    .profile-row {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0.5rem 0;
      background: color-mix(in srgb, var(--teams-fg, #201f1e) 4%, transparent);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      box-sizing: border-box;
    }

    .profile-item {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      font-size: 0.85rem;
    }

    .profile-item__label {
      color: color-mix(in srgb, var(--teams-fg, #201f1e) 55%, transparent);
      white-space: nowrap;
    }

    .profile-item__value {
      color: var(--teams-fg, #201f1e);
      font-weight: 500;
      word-break: break-all;
      text-align: right;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem 1.5rem;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      margin-top: 0.5rem;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn:active { opacity: 0.7; }

    .btn--primary {
      background: var(--teams-brand, #6264a7);
      color: #ffffff;
    }

    .btn--secondary {
      background: color-mix(in srgb, var(--teams-fg, #201f1e) 8%, transparent);
      color: var(--teams-fg, #201f1e);
    }
  `],
})
export class HomeComponent implements OnInit {
  protected readonly user = signal<User | null>(null);

  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    this.authService.user$.subscribe((u) => this.user.set(u));
  }

  protected displayName(): string {
    const p = this.user()!.profile;
    return (p['name'] ?? p['preferred_username'] ?? p.sub) as string;
  }

  protected tokenExpiry(): string {
    const exp = this.user()!.profile.exp;
    if (!exp) return '—';
    return new Date(exp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async signIn(): Promise<void> {
    try {
      await this.authService.ensureAuthenticated();
    } catch (err) {
      console.error('[HomeComponent] sign-in failed', err);
    }
  }

  signOut(): void {
    this.authService.logout();
  }
}

