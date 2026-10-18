import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MailTrackingComponent } from './mail-tracking/mail-tracking.component';
import { UatVerdictsComponent } from './uat/uat-verdicts.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MailTrackingComponent, UatVerdictsComponent],
  template: `
    <nav class="tabs" aria-label="Main navigation">
      <button class="tab" [class.active]="tab === 'uat'" [attr.aria-current]="tab === 'uat' ? 'page' : null"
              (click)="tab = 'uat'">UAT อนุมัติ</button>
      <button class="tab" [class.active]="tab === 'mail'" [attr.aria-current]="tab === 'mail' ? 'page' : null"
              (click)="tab = 'mail'">Track Mail</button>
    </nav>

    <app-uat-verdicts *ngIf="tab === 'uat'"></app-uat-verdicts>
    <app-mail-tracking *ngIf="tab === 'mail'"></app-mail-tracking>
  `,
  styles: [
    `
      .tabs {
        display: flex;
        gap: 4px;
        max-width: 1320px;
        margin: 0 auto;
        padding: 18px 28px 0;
      }
      .tab {
        position: relative;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--muted);
        font-family: var(--font-display);
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.02em;
        padding: 8px 14px;
        cursor: pointer;
      }
      .tab:hover { color: var(--text); }
      .tab.active { color: var(--text); border-bottom-color: var(--brand); }
      .tab:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
      @media (max-width: 620px) {
        .tabs { padding: 14px 16px 0; }
      }
    `,
  ],
})
export class AppComponent {
  tab: 'uat' | 'mail' = 'uat';
}
