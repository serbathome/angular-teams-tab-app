import { Component, OnInit } from '@angular/core';
import { app, pages } from '@microsoft/teams-js';

/**
 * Tab configuration page — shown when adding the tab to a team channel.
 * Must call pages.config.setValidityState(true) and pages.config.setConfig()
 * before Teams enables the Save button.
 */
@Component({
  selector: 'app-tab-config',
  standalone: true,
  template: `
    <div style="padding: 1rem;">
      <h2>Configure Teams Tab</h2>
      <p>Click <strong>Save</strong> to add this tab to your channel.</p>
    </div>
  `,
})
export class TabConfigComponent implements OnInit {
  async ngOnInit(): Promise<void> {
    await app.initialize();

    pages.config.registerOnSaveHandler((saveEvent) => {
      pages.config.setConfig({
        suggestedDisplayName: 'Teams Tab',
        entityId: 'home',
        contentUrl: `${window.location.origin}/home`,
        websiteUrl: `${window.location.origin}/home`,
      });
      saveEvent.notifySuccess();
    });

    // Enable the Save button immediately — no user configuration needed
    pages.config.setValidityState(true);
  }
}
