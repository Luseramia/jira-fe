import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { TicketListResponse } from '../models';
import { TicketsService } from '../tickets.service';
import { TicketDrawerComponent } from '../tickets/ticket-drawer.component';

@Component({
  selector: 'app-mail-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, TicketDrawerComponent],
  template: `
    <header class="masthead">
      <div>
        <h1>Track Mail</h1>
        <p class="sub">เมล UAT / Smoke Test ที่ส่งแล้วและยังรอคำตอบ · เรียงจากรอนานที่สุด</p>
      </div>
      <div class="total" *ngIf="data && !loading">
        <span class="num">{{ data.total | number }}</span>
        <span>ticket ที่รอคำตอบ</span>
      </div>
    </header>

    <div class="toolbar">
      <label class="search">
        <span>ค้นหา ticket หรือหัวข้อ</span>
        <input type="search" [(ngModel)]="q" (ngModelChange)="search()" placeholder="เลข ticket หรือหัวข้อ…" />
      </label>
      <button class="refresh" (click)="reload()" [disabled]="loading">รีเฟรช</button>
    </div>

    <main class="page">
      <div class="state" *ngIf="loading">กำลังโหลดเมลที่รอคำตอบ…</div>
      <div class="state error" *ngIf="!loading && error">
        โหลดข้อมูลติดตามเมลไม่ได้
        <button (click)="reload()">ลองใหม่</button>
      </div>
      <div class="state" *ngIf="!loading && !error && data?.total === 0">
        {{ q ? 'ไม่พบ ticket ที่ตรงกับคำค้นหา' : 'ไม่มีเมล UAT / Smoke Test ที่รอคำตอบ' }}
      </div>

      <div class="table-wrap" *ngIf="!loading && !error && data && data.rows.length">
        <table>
          <thead>
            <tr>
              <th>Ticket / หัวข้อ</th>
              <th>การ์ด Jira</th>
              <th>เมลขั้นตอน</th>
              <th>ส่งเมื่อ</th>
              <th>รอมาแล้ว</th>
              <th>กำหนดตอบ</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let t of data.rows" (click)="selected = t.ticketNumber"
                (keyup.enter)="selected = t.ticketNumber" tabindex="0"
                [class.overdue]="t.followup?.overdue">
              <td class="ticket">
                <span class="key mono">{{ t.ticketNumber }}</span>
                <span class="title" [title]="t.title || ''">{{ t.title || '—' }}</span>
                <span class="minor" *ngIf="t.requesterName">{{ t.requesterName }}</span>
              </td>
              <td>
                <span class="key mono">{{ t.jiraKey || '—' }}</span>
                <span class="minor">{{ t.jiraStatus || '' }}</span>
              </td>
              <td>{{ t.followup?.stage === 'smoke test' ? 'Smoke Test' : 'UAT' }}</td>
              <td class="date">{{ t.followup?.sentAt ? (t.followup?.sentAt | date: 'd MMM yyyy HH:mm') : '—' }}</td>
              <td>
                <span class="days num" [class.late]="t.followup?.overdue">
                  {{ t.followup?.sentAt ? t.followup?.daysWaiting : '—' }}<small *ngIf="t.followup?.sentAt"> วัน</small>
                </span>
                <span class="late-note" *ngIf="t.followup?.overdue">เกินกำหนด</span>
              </td>
              <td class="date">{{ t.followup?.deadlineDate ? (t.followup?.deadlineDate | date: 'd MMM yyyy') : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pager" *ngIf="!loading && !error && data && data.total > data.limit">
        <button (click)="go(page - 1)" [disabled]="page <= 1">‹ ก่อนหน้า</button>
        <span>หน้า {{ page }} / {{ lastPage }}</span>
        <button (click)="go(page + 1)" [disabled]="page >= lastPage">ถัดไป ›</button>
      </div>
    </main>

    <app-ticket-drawer [ticketNumber]="selected" (closed)="selected = null"></app-ticket-drawer>
  `,
  styles: [`
    .masthead, .toolbar, .page { max-width: 1320px; margin: 0 auto; padding-left: 28px; padding-right: 28px; }
    .masthead { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 16px; padding-top: 30px; padding-bottom: 18px; }
    h1 { margin: 0; font-family: var(--font-display); font-size: 24px; }
    .sub { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
    .total { display: flex; flex-direction: column; align-items: flex-end; color: var(--muted); font-size: 12px; }
    .total .num { color: var(--text); font-size: 22px; font-weight: 700; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding-bottom: 18px; }
    .search { display: flex; flex-direction: column; gap: 5px; flex: 1; max-width: 360px; color: var(--muted); font-size: 12px; }
    input { width: 100%; min-width: 190px; padding: 8px 11px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-sm); color: var(--text); font: 14px var(--font-body); }
    button { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-sm); color: var(--text); padding: 8px 14px; font: 13px var(--font-body); cursor: pointer; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    button:hover:not(:disabled) { border-color: var(--brand); }
    input:focus-visible, button:focus-visible, tr:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
    .page { padding-bottom: 80px; }
    .state { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; min-height: 180px; color: var(--muted); }
    .state.error { color: var(--st-rework); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); }
    table { width: 100%; border-collapse: collapse; min-width: 800px; }
    th { text-align: left; color: var(--muted); background: var(--panel-2); font-size: 12px; font-weight: 600; padding: 11px 16px; white-space: nowrap; }
    td { padding: 12px 16px; border-top: 1px solid var(--line); vertical-align: middle; font-size: 14px; }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: var(--panel-2); }
    .ticket { max-width: 320px; }
    .key { color: var(--text); font-size: 12.5px; font-weight: 600; }
    .title, .minor { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .title { max-width: 320px; }
    .minor { color: var(--muted); font-size: 12px; }
    .date { white-space: nowrap; color: var(--muted); }
    .days { color: var(--st-user); font-size: 18px; font-weight: 700; white-space: nowrap; }
    .days small { font: 12px var(--font-body); }
    .days.late, .late-note { color: var(--st-rework); }
    .late-note { display: block; font-size: 11px; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 14px; padding-top: 20px; color: var(--muted); font-size: 13px; }
    @media (max-width: 720px) { .masthead, .toolbar, .page { padding-left: 16px; padding-right: 16px; } }
  `],
})
export class MailTrackingComponent implements OnInit, OnDestroy {
  data: TicketListResponse | null = null;
  loading = true;
  error = false;
  selected: string | null = null;
  q = '';
  page = 1;
  private search$ = new Subject<void>();
  private destroy$ = new Subject<void>();
  private requestId = 0;

  constructor(private service: TicketsService) {}

  ngOnInit(): void {
    this.search$.pipe(debounceTime(350), takeUntil(this.destroy$)).subscribe(() => {
      this.page = 1;
      this.reload();
    });
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  search(): void {
    this.search$.next();
  }

  reload(): void {
    const requestId = ++this.requestId;
    this.loading = true;
    this.error = false;
    this.service.list({ mailWaiting: true, sort: 'mailAge', q: this.q.trim(), page: this.page, limit: 50 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          if (requestId !== this.requestId) return;
          this.data = data;
          this.loading = false;
        },
        error: () => {
          if (requestId !== this.requestId) return;
          this.error = true;
          this.loading = false;
        },
      });
  }

  go(page: number): void {
    this.page = page;
    this.reload();
  }

  get lastPage(): number {
    return this.data ? Math.max(1, Math.ceil(this.data.total / this.data.limit)) : 1;
  }
}
