import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { TicketFilters, TicketListResponse, TicketPreset, TicketQuery, TicketRow } from '../models';
import { TicketsService } from '../tickets.service';
import { FollowupBadgeComponent } from './followup-badge.component';
import { StageStripComponent } from './stage-strip.component';
import { TicketDrawerComponent } from './ticket-drawer.component';

type JiraFilter = 'all' | 'yes' | 'no';
interface AppliedChip {
  label: string;
  clear: () => void;
}

@Component({
  selector: 'app-ticket-board',
  standalone: true,
  imports: [CommonModule, FormsModule, TicketDrawerComponent, StageStripComponent, FollowupBadgeComponent],
  template: `
    <header class="masthead">
      <div class="brand">
        <div>
          <h1>Tickets</h1>
          <p class="sub">ตั๋วแจ้งปัญหา · เปิดการ์ด Jira แล้วหรือยัง และไปถึงขั้นไหน</p>
        </div>
      </div>
      <div class="totals" *ngIf="data">
        <span class="n num">{{ data.total | number }}</span>
        <span class="t">ตั๋วตามตัวกรอง</span>
      </div>
    </header>

    <div class="filters">
      <div class="f grow">
        <label>ค้นหา</label>
        <input type="text" placeholder="เลขตั๋ว หรือหัวข้อ…" [(ngModel)]="q" (ngModelChange)="onText()" />
      </div>
      <div class="f">
        <label>แผนก</label>
        <select [(ngModel)]="department" (ngModelChange)="reload(true)">
          <option value="">ทุกแผนก</option>
          <option *ngFor="let d of filters?.departments" [value]="d">{{ d }}</option>
        </select>
      </div>
      <div class="f">
        <label>ผู้แจ้งปัญหา</label>
        <input type="text" list="requesters" placeholder="พิมพ์บางส่วนของชื่อ…" [(ngModel)]="requester" (ngModelChange)="onText()" />
        <datalist id="requesters">
          <option *ngFor="let r of filters?.requesters" [value]="r"></option>
        </datalist>
      </div>
      <div class="f">
        <label>ปีที่แจ้ง</label>
        <select [(ngModel)]="year" (ngModelChange)="reload(true)">
          <option [ngValue]="undefined">ทุกปี</option>
          <option *ngFor="let y of years" [ngValue]="y">{{ y }}</option>
        </select>
      </div>
      <div class="f">
        <label>ผลอนุมัติ</label>
        <div class="seg">
          <button *ngFor="let fs of filters?.finalStatuses" [class.active]="finalStatus === fs" (click)="toggleFinal(fs)">{{ fs }}</button>
        </div>
      </div>
      <div class="f">
        <label>การ์ด Jira</label>
        <div class="seg">
          <button [class.active]="jira === 'all'" (click)="setJira('all')">ทั้งหมด</button>
          <button [class.active]="jira === 'yes'" (click)="setJira('yes')">เปิดแล้ว</button>
          <button [class.active]="jira === 'no'" (click)="setJira('no')">ยังไม่เปิด</button>
        </div>
      </div>
      <div class="f">
        <label>ความถูกต้อง</label>
        <button class="mm-toggle" [class.active]="mismatch" (click)="toggleMismatch()" title="ตั๋วที่ชีตกับการ์ดจริงไม่ตรงกัน">⚠ เฉพาะที่ไม่ตรงกัน</button>
      </div>
    </div>

    <!-- applied filters — state always spoken, one-click remove -->
    <div class="applied" *ngIf="appliedChips().length">
      <span class="a-label">ตัวกรองที่ใช้:</span>
      <button class="a-chip" *ngFor="let c of appliedChips()" (click)="c.clear()">
        {{ c.label }} <span class="ax">✕</span>
      </button>
      <button class="clear-all" (click)="reset()">ล้างทั้งหมด</button>
    </div>

    <main class="page">
      <!-- loading skeleton of the real layout -->
      <div class="table-wrap" *ngIf="loading">
        <table>
          <tbody>
            <tr class="sk-row" *ngFor="let s of skeleton">
              <td><span class="sk" style="width:64px"></span></td>
              <td><span class="sk" style="width:80%"></span></td>
              <td><span class="sk" style="width:110px"></span></td>
              <td><span class="sk" style="width:80px"></span></td>
              <td><span class="sk" style="width:90px"></span></td>
              <td><span class="sk" style="width:28px"></span></td>
              <td><span class="sk" style="width:64px"></span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="state err" *ngIf="error">
        โหลดข้อมูลไม่ได้ — ระบบ API ที่ port 3000 อาจไม่ทำงาน
        <button class="retry" (click)="reload(false)">ลองใหม่</button>
      </div>

      <div class="state empty" *ngIf="!loading && !error && data && data.total === 0">
        ไม่พบ ticket ตามตัวกรอง — ลองล้างตัวกรองแล้วค้นใหม่
        <button class="retry" (click)="reset()" *ngIf="appliedChips().length">ล้างตัวกรอง</button>
      </div>

      <div class="table-wrap" *ngIf="!loading && !error && data && data.rows.length">
        <table>
          <thead>
            <tr>
              <th class="c-tn">เลขตั๋ว</th>
              <th class="c-title">หัวข้อ</th>
              <th class="c-stage">สเตจการ์ด Jira</th>
              <th class="c-dept">แผนก</th>
              <th class="c-req">ผู้แจ้ง</th>
              <th class="c-urg">ด่วน</th>
              <th class="c-fin">ผลอนุมัติ</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let t of data.rows" (click)="selected = t.ticketNumber" class="row" tabindex="0" (keyup.enter)="selected = t.ticketNumber">
              <td class="c-tn">
                <span class="tn mono">{{ t.ticketNumber }}</span>
                <span class="warn" *ngIf="t.flagMismatch" [title]="mismatchReason(t)">⚠</span>
              </td>
              <td class="c-title"><span class="title" [title]="t.title || ''">{{ t.title || '—' }}</span></td>
              <td class="c-stage">
                <app-stage-strip *ngIf="t.jiraKey; else noCard" [status]="t.jiraStatus"></app-stage-strip>
                <app-followup-badge [followup]="t.followup" [status]="t.jiraStatus"></app-followup-badge>
                <ng-template #noCard><span class="nocard">ยังไม่เปิดการ์ด</span></ng-template>
                <span class="more mono" *ngIf="t.jiraCount > 1" [title]="t.jiraCount + ' การ์ด'">+{{ t.jiraCount - 1 }}</span>
              </td>
              <td class="c-dept"><span [title]="t.department || ''">{{ t.department || '—' }}</span></td>
              <td class="c-req"><span [title]="t.requesterName || ''">{{ t.requesterName || '—' }}</span></td>
              <td class="c-urg"><span class="urg mono" [class.high]="(t.urgency || '').toUpperCase() === 'H'">{{ t.urgency || '—' }}</span></td>
              <td class="c-fin"><span class="fin">{{ t.finalStatus || '—' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pager" *ngIf="!loading && !error && data && data.total > 0">
        <button [disabled]="page <= 1" (click)="go(page - 1)">‹ ก่อนหน้า</button>
        <span class="info num">หน้า {{ page }} / {{ lastPage }} · {{ rangeFrom }}–{{ rangeTo }} จาก {{ data.total | number }}</span>
        <button [disabled]="page >= lastPage" (click)="go(page + 1)">ถัดไป ›</button>
        <button class="export" (click)="exportCsv()" [disabled]="!data || data.total === 0" title="ส่งออกตั๋วตามตัวกรองปัจจุบันเป็น CSV">⬇ ดาวน์โหลด CSV</button>
      </div>
    </main>

    <app-ticket-drawer [ticketNumber]="selected" (closed)="onDrawerClosed()"></app-ticket-drawer>
  `,
  styles: [
    `
      .masthead { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; max-width: 1320px; margin: 0 auto; padding: 30px 28px 14px; }
      h1 { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 24px; }
      .sub { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
      .totals { display: flex; flex-direction: column; align-items: flex-end; }
      .totals .n { font-weight: 700; font-size: 22px; color: var(--text); }
      .totals .t { font-size: 12px; color: var(--muted); }

      .filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; max-width: 1320px; margin: 0 auto; padding: 6px 28px; }
      .f { display: flex; flex-direction: column; gap: 5px; }
      .f.grow { flex: 1; min-width: 220px; }
      .f label { font-size: 11px; color: var(--muted); font-weight: 500; }
      input, select { background: var(--panel); border: 1px solid var(--line); color: var(--text); border-radius: var(--radius-sm); padding: 8px 11px; font-size: 14px; font-family: var(--font-body); min-width: 150px; }
      input:focus, select:focus { outline: 2px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 1px; border-color: var(--brand); }

      .seg { display: flex; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; }
      .seg button { background: var(--panel); border: none; color: var(--muted); padding: 8px 13px; font-size: 13px; cursor: pointer; font-family: var(--font-body); }
      .seg button + button { border-left: 1px solid var(--line); }
      .seg button.active { background: color-mix(in srgb, var(--brand) 20%, var(--panel)); color: var(--text); }
      .seg button:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
      .mm-toggle { background: var(--panel); border: 1px solid var(--line); color: var(--muted); border-radius: var(--radius-sm); padding: 8px 13px; font-size: 13px; cursor: pointer; font-family: var(--font-body); }
      .mm-toggle.active { border-color: var(--st-user); color: var(--st-user); background: color-mix(in srgb, var(--st-user) 12%, var(--panel)); }

      .applied { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 1320px; margin: 8px auto 0; padding: 0 28px; }
      .a-label { font-size: 12.5px; color: var(--muted); }
      .a-chip { display: inline-flex; align-items: center; gap: 7px; background: var(--panel-2); border: 1px solid var(--line); color: var(--text); border-radius: 99px; padding: 4px 11px; font-size: 13px; cursor: pointer; }
      .a-chip:hover { border-color: var(--brand); }
      .a-chip .ax { color: var(--muted); font-size: 11px; }
      .clear-all { background: transparent; border: none; color: var(--brand); font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px; font-family: var(--font-body); }

      .page { max-width: 1320px; margin: 0 auto; padding: 14px 28px 80px; }
      .state { text-align: center; color: var(--muted); padding: 54px 16px; font-size: 15px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
      .state.err { color: var(--st-rework); }
      .retry { background: var(--panel); border: 1px solid var(--line); color: var(--text); border-radius: var(--radius-sm); padding: 8px 16px; font-size: 14px; cursor: pointer; font-family: var(--font-body); }

      .table-wrap { border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; background: var(--panel); }
      table { width: 100%; border-collapse: collapse; }
      thead th { text-align: left; padding: 12px 16px; font-size: 12px; font-weight: 600; color: var(--muted); border-bottom: 1px solid var(--line); white-space: nowrap; position: sticky; top: 0; background: var(--panel-2); z-index: 1; }
      tbody .row { border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent); cursor: pointer; transition: background 0.12s; }
      tbody .row:last-child { border-bottom: none; }
      tbody .row:hover { background: var(--panel-2); }
      tbody .row:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
      td { padding: 11px 16px; vertical-align: middle; height: 48px; font-size: 14.5px; }

      .tn { font-weight: 600; color: var(--text); font-size: 13px; }
      .warn { margin-left: 7px; color: var(--st-user); cursor: help; font-size: 13px; }
      .c-title { max-width: 320px; }
      .title, .c-dept span, .c-req span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .c-title .title { max-width: 320px; }
      .c-dept, .c-req { color: var(--muted); max-width: 150px; }
      .c-stage { min-width: 170px; white-space: nowrap; }
      /* strip + badge ติดตามเมลเรียงลงมาในเซลล์เดียว */
      .c-stage app-followup-badge { display: block; margin-top: 4px; }
      .more { font-size: 11px; color: var(--muted); margin-left: 6px; vertical-align: top; }
      .nocard { font-size: 13px; color: var(--muted-2); }

      .urg { font-size: 12px; color: var(--muted); }
      .urg.high { color: var(--text); font-weight: 700; }
      .fin { font-size: 13.5px; color: var(--muted); }

      .pager { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 14px; padding: 22px 0 0; }
      .pager button { background: var(--panel); border: 1px solid var(--line); color: var(--text); border-radius: var(--radius-sm); padding: 8px 15px; font-size: 14px; cursor: pointer; font-family: var(--font-body); }
      .pager button:disabled { color: var(--muted-2); cursor: not-allowed; opacity: 0.5; }
      .pager .info { font-size: 13px; color: var(--muted); }
      .export { margin-left: 10px; color: var(--brand); border-color: color-mix(in srgb, var(--brand) 45%, var(--line)) !important; }

      .sk-row td { height: 48px; }
      .sk { display: inline-block; height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--panel-2) 25%, var(--line) 37%, var(--panel-2) 63%); background-size: 400% 100%; animation: sk 1.3s ease infinite; }
      @keyframes sk { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
      @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }

      @media (max-width: 720px) {
        .masthead, .filters, .applied, .page { padding-left: 16px; padding-right: 16px; }
        .c-dept, .c-req { display: none; }
        .c-title { max-width: 140px; } .c-title .title { max-width: 140px; }
      }
    `,
  ],
})
export class TicketBoardComponent implements OnInit {
  filters: TicketFilters | null = null;
  data: TicketListResponse | null = null;
  selected: string | null = null;

  loading = true;
  error = false;

  @Input() preset: TicketPreset | null = null;

  q = '';
  department = '';
  requester = '';
  finalStatus = '';
  jira: JiraFilter = 'all';
  mismatch = false;
  year: number | undefined = undefined;
  page = 1;
  limit = 50;

  years = [2026, 2025, 2024, 2023];
  skeleton = Array.from({ length: 10 });
  private text$ = new Subject<void>();

  constructor(private service: TicketsService) {}

  ngOnInit(): void {
    // preset จาก drill-down หน้า Overview
    if (this.preset) {
      if (this.preset.hasJira) this.jira = this.preset.hasJira;
      if (this.preset.mismatch) this.mismatch = true;
      if (this.preset.department) this.department = this.preset.department;
      if (this.preset.finalStatus) this.finalStatus = this.preset.finalStatus;
      if (this.preset.year != null) this.year = this.preset.year;
    }
    this.service.filters().subscribe({ next: (f) => (this.filters = f) });
    this.text$.pipe(debounceTime(350)).subscribe(() => this.reload(true));
    this.reload(true);
  }

  onText(): void {
    this.text$.next();
  }

  private currentQuery(): TicketQuery {
    return {
      department: this.department || undefined,
      requester: this.requester || undefined,
      finalStatus: this.finalStatus || undefined,
      hasJira: this.jira === 'all' ? undefined : this.jira === 'yes',
      mismatch: this.mismatch || undefined,
      year: this.year,
      q: this.q || undefined,
    };
  }

  reload(resetPage = false): void {
    if (resetPage) this.page = 1;
    this.loading = true;
    this.error = false;
    const query: TicketQuery = { ...this.currentQuery(), page: this.page, limit: this.limit };
    this.service.list(query).subscribe({
      next: (d) => {
        this.data = d;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  toggleFinal(fs: string): void {
    this.finalStatus = this.finalStatus === fs ? '' : fs;
    this.reload(true);
  }

  setJira(v: JiraFilter): void {
    this.jira = v;
    this.reload(true);
  }

  toggleMismatch(): void {
    this.mismatch = !this.mismatch;
    this.reload(true);
  }

  reset(): void {
    this.q = '';
    this.department = '';
    this.requester = '';
    this.finalStatus = '';
    this.jira = 'all';
    this.mismatch = false;
    this.year = undefined;
    this.reload(true);
  }

  appliedChips(): AppliedChip[] {
    const chips: AppliedChip[] = [];
    if (this.q) chips.push({ label: `ค้นหา: ${this.q}`, clear: () => { this.q = ''; this.reload(true); } });
    if (this.department) chips.push({ label: `แผนก: ${this.department}`, clear: () => { this.department = ''; this.reload(true); } });
    if (this.requester) chips.push({ label: `ผู้แจ้ง: ${this.requester}`, clear: () => { this.requester = ''; this.reload(true); } });
    if (this.year != null) chips.push({ label: `ปี: ${this.year}`, clear: () => { this.year = undefined; this.reload(true); } });
    if (this.finalStatus) chips.push({ label: `ผลอนุมัติ: ${this.finalStatus}`, clear: () => { this.finalStatus = ''; this.reload(true); } });
    if (this.jira !== 'all') chips.push({ label: this.jira === 'yes' ? 'เปิดการ์ดแล้ว' : 'ยังไม่เปิดการ์ด', clear: () => { this.jira = 'all'; this.reload(true); } });
    if (this.mismatch) chips.push({ label: 'เฉพาะที่ไม่ตรงกัน', clear: () => { this.mismatch = false; this.reload(true); } });
    return chips;
  }

  mismatchReason(t: TicketRow): string {
    if (t.jiraFlag === true && t.jiraCount === 0) return 'ชีตระบุว่ามีการ์ด Jira แต่ระบบยังหาการ์ดไม่พบ';
    if (t.jiraFlag === false && t.jiraCount > 0) return 'ชีตระบุว่าไม่มีการ์ด แต่พบการ์ดที่เชื่อมอยู่';
    return 'ข้อมูลชีตกับการ์ดจริงไม่ตรงกัน';
  }

  exportCsv(): void {
    if (!this.data || this.data.total === 0) return;
    window.open(this.service.exportUrl(this.currentQuery()), '_blank');
  }

  go(page: number): void {
    this.page = page;
    this.reload(false);
  }

  onDrawerClosed(): void {
    this.selected = null;
    this.reload(false);
  }

  get lastPage(): number {
    if (!this.data) return 1;
    return Math.max(1, Math.ceil(this.data.total / this.data.limit));
  }
  get rangeFrom(): number {
    if (!this.data || this.data.total === 0) return 0;
    return (this.data.page - 1) * this.data.limit + 1;
  }
  get rangeTo(): number {
    if (!this.data) return 0;
    return Math.min(this.data.total, this.data.page * this.data.limit);
  }
}
