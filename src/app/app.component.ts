import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TicketPreset } from './models';
import { NavEvent, OverviewComponent } from './overview/overview.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { TicketBoardComponent } from './tickets/ticket-board.component';
import { WeeklyComponent } from './weekly/weekly.component';
import { WorkloadComponent } from './workload/workload.component';

type Tab = 'overview' | 'due' | 'weekly' | 'tickets' | 'workload';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, OverviewComponent, DashboardComponent, WeeklyComponent, TicketBoardComponent, WorkloadComponent],
  template: `
    <nav class="tabs">
      <button class="tab" [class.active]="tab === 'overview'" (click)="go('overview')">ภาพรวม</button>
      <button class="tab" [class.active]="tab === 'tickets'" (click)="go('tickets')">Tickets</button>
      <button class="tab" [class.active]="tab === 'workload'" (click)="go('workload')">Workload</button>
      <button class="tab" [class.active]="tab === 'due'" (click)="go('due')">Due Board</button>
      <button class="tab" [class.active]="tab === 'weekly'" (click)="go('weekly')">
        Weekly <span class="badge">อังคาร</span>
      </button>
    </nav>

    <app-overview *ngIf="tab === 'overview'" (navigate)="onNavigate($event)"></app-overview>
    <app-dashboard *ngIf="tab === 'due'"></app-dashboard>
    <app-weekly *ngIf="tab === 'weekly'"></app-weekly>
    <app-ticket-board *ngIf="tab === 'tickets'" [preset]="ticketPreset"></app-ticket-board>
    <app-workload *ngIf="tab === 'workload'"></app-workload>
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
        transition: color 0.12s, border-color 0.12s;
      }
      .tab:hover { color: var(--text); }
      .tab.active { color: var(--text); border-bottom-color: var(--brand); }
      .badge {
        font-family: var(--font-mono);
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--today);
        background: color-mix(in srgb, var(--today) 14%, transparent);
        border-radius: 99px;
        padding: 1px 7px;
        margin-left: 5px;
        vertical-align: middle;
      }
      @media (max-width: 620px) {
        .tabs { padding: 14px 16px 0; }
      }
    `,
  ],
})
export class AppComponent {
  tab: Tab = 'overview';
  ticketPreset: TicketPreset | null = null;

  go(tab: Tab): void {
    if (tab !== 'tickets') this.ticketPreset = null; // เปลี่ยนแท็บเองล้าง preset
    this.tab = tab;
  }

  /** drill-down จากหน้า Overview → เปิดแท็บพร้อม filter ที่ตั้งไว้ */
  onNavigate(e: NavEvent): void {
    this.ticketPreset = e.tab === 'tickets' ? e.preset ?? null : null;
    this.tab = e.tab;
  }
}
