import { Injectable, OnDestroy } from '@angular/core';
import { app } from '@microsoft/teams-js';

export type TeamsTheme = 'default' | 'dark' | 'contrast';

const THEME_CLASSES: TeamsTheme[] = ['default', 'dark', 'contrast'];

@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  private currentTheme: TeamsTheme = 'default';

  async initialize(): Promise<void> {
    const context = await app.getContext();
    this.applyTheme((context.app.theme as TeamsTheme) ?? 'default');

    app.registerOnThemeChangeHandler((theme) => {
      this.applyTheme((theme as TeamsTheme) ?? 'default');
    });
  }

  private applyTheme(theme: TeamsTheme): void {
    const body = document.body;
    THEME_CLASSES.forEach((c) => body.classList.remove(`teams-theme-${c}`));
    body.classList.add(`teams-theme-${theme}`);
    this.currentTheme = theme;
  }

  get theme(): TeamsTheme {
    return this.currentTheme;
  }

  ngOnDestroy(): void {
    // Teams SDK does not expose a way to remove the theme change handler;
    // the service lives for the app lifetime so this is a no-op.
  }
}
