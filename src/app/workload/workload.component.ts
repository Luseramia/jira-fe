import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { TicketFilters, WorkloadGroup } from '../models';
import { TicketsService } from '../tickets.service';
import { FollowupBadgeComponent } from '../tickets/followup-badge.component';
import { StageStripComponent } from '../tickets/stage-strip.component';

interface AppliedChip {
  label: string;
  clear: () => void;
}

const JIRA_BASE = 'https://sittidate-lueangon.atlassian.net/browse/';

@Component({
  selector: 'app-workload',
  standalone: true,
  imports: [CommonModule, FormsModule, StageStripComponent, FollowupBadgeComponent],
  template: `
    <header class="masthead">
      <div>
        <h1>Workload</h1>
        <p class="sub">การ์ด Jira อยู่ในมือใคร · แยก “อยู่ในมือจริง” กับ “ติดรอคนอื่น”</p>
      </div>
      <label class="toggle">
        <input type="checkbox" [(ngModel)]="includeDone" (ngModelChange)="load()" />
        รวมงานที่เสร็จแล้ว
      </label>
    </header>

    <div class="filters">
      <div class="f">
        <label>แผนกที่แจ้ง</label>
        <select [(ngModel)]="department" (ngModelChange)="load()">
          <option value="">ทุกแผนก</option>
          <option *ngFor="let d of filters?.departments" [value]="d">{{ d }}</option>
        </select>
      </div>
      <div class="f grow">
        <label>ผู้แจ้งปัญหา</label>
        <input type="text" list="wl-requesters" placeholder="พิมพ์บางส่วนของชื่อ…" [(ngModel)]="requester" (ngModelChange)="onText()" />
        <datalist id="wl-requesters">
          <option *ngFor="let r of filters?.requesters" [value]="r"></option>
        </datalist>
      </div>
    </div>

    <div class="applied" *ngIf="appliedChips().length">
      <span class="a-label">กรองการ์ดจากตั๋วที่:</span>
      <button class="a-chip" *ngFor="let c of appliedChips()" (click)="c.clear()">{{ c.label }} <span class="ax">✕</span></button>
      <button class="clear-all" (click)="resetFilters()">ล้างทั้งหมด</button>
    </div>

    <main class="page">
      <div class="state" *ngIf="loading">กำลังโหลดข้อมูล…</div>
      <div class="state err" *ngIf="error">
        โหลดข้อมูลไม่ได้ — ระบบ API ที่ port 3000 อาจไม่ทำงาน
        <button class="retry" (click)="load()">ลองใหม่</button>
      </div>
      <div class="state empty" *ngIf="!loading && !error && groups.length === 0">
        {{ appliedChips().length ? 'ไม่พบการ์ดจากตั๋วตามตัวกรอง — ลองล้างตัวกรอง' : 'ไม่มีการ์ดที่เปิดค้างอยู่' }}
        <button class="retry" (click)="resetFilters()" *ngIf="appliedChips().length">ล้างตัวกรอง</button>
      </div>

      <section class="group" *ngFor="let g of groups">
        <div class="g-head">
          <span class="avatar">{{ initials(g.assignee) }}</span>
          <h2>{{ g.assignee }}</h2>
          <div class="counts">
            <span class="cnt inhand"><b class="num">{{ g.inHand }}</b> อยู่ในมือจริง</span>
            <span class="cnt waiting"><b class="num">{{ g.waitingOnOthers }}</b> ติดรอคนอื่น</span>
            <span class="cnt total"><b class="num">{{ g.total }}</b> การ์ดทั้งหมด</span>
          </div>
        </div>

        <div class="cards">
          <article class="card" *ngFor="let c of g.cards">
            <div class="c-top">
              <a class="c-key mono" [href]="jiraUrl(c.key)" target="_blank" rel="noopener">{{ c.key }} ↗</a>
            </div>
            <div class="c-summary" [title]="c.summary">{{ c.summary }}</div>
            <app-stage-strip [status]="c.status" [days]="c.daysInStage"></app-stage-strip>
            <app-followup-badge class="fb-slot" [followup]="c.followup" [status]="c.status"></app-followup-badge>
            <div class="c-tickets" *ngIf="c.ticketNumbers.length">
              <span class="tk mono" *ngFor="let t of c.ticketNumbers">{{ t }}</span>
            </div>
            <div class="c-tickets none" *ngIf="!c.ticketNumbers.length">ไม่พบตั๋วที่เชื่อม</div>
          </article>
        </div>
      </section>
    </main>
  `,
  styles: [
    `
      .masthead { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; max-width: 1320px; margin: 0 auto; padding: 30px 28px 16px; }
      h1 { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 24px; }
      .sub { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
      .toggle { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--muted); cursor: pointer; }

      .filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; max-width: 1320px; margin: 0 auto; padding: 4px 28px 2px; }
      .f { display: flex; flex-direction: column; gap: 5px; }
      .f.grow { flex: 1; min-width: 220px; }
      .f label { font-size: 11px; color: var(--muted); font-weight: 500; }
      .filters input, .filters select { background: var(--panel); border: 1px solid var(--line); color: var(--text); border-radius: var(--radius-sm); padding: 8px 11px; font-size: 14px; font-family: var(--font-body); min-width: 160px; }
      .filters input:focus, .filters select:focus { outline: 2px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 1px; border-color: var(--brand); }

      .applied { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 1320px; margin: 8px auto 0; padding: 0 28px; }
      .a-label { font-size: 12.5px; color: var(--muted); }
      .a-chip { display: inline-flex; align-items: center; gap: 7px; background: var(--panel-2); border: 1px solid var(--line); color: var(--text); border-radius: 99px; padding: 4px 11px; font-size: 13px; cursor: pointer; font-family: var(--font-body); }
      .a-chip:hover { border-color: var(--brand); }
      .a-chip .ax { color: var(--muted); font-size: 11px; }
      .clear-all { background: transparent; border: none; color: var(--brand); font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px; font-family: var(--font-body); }

      .page { max-width: 1320px; margin: 0 auto; padding: 10px 28px 80px; }
      .state { text-align: center; color: var(--muted); padding: 54px 16px; font-size: 15px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .state.err { color: var(--st-rework); }
      .retry { background: var(--panel); border: 1px solid var(--line); color: var(--text); border-radius: var(--radius-sm); padding: 8px 16px; font-size: 14px; cursor: pointer; font-family: var(--font-body); }

      .group { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); padding: 18px 20px; margin-bottom: 16px; }
      .g-head { display: flex; align-items: center; gap: 13px; flex-wrap: wrap; margin-bottom: 16px; }
      .avatar { width: 34px; height: 34px; border-radius: 99px; flex: 0 0 34px; display: grid; place-items: center; background: color-mix(in srgb, var(--brand) 22%, var(--panel)); color: var(--brand); font-family: var(--font-mono); font-size: 13px; font-weight: 700; }
      .g-head h2 { margin: 0; font-family: var(--font-display); font-size: 17px; font-weight: 600; }

      .counts { margin-left: auto; display: flex; gap: 20px; align-items: baseline; }
      .cnt { font-size: 13px; color: var(--muted); display: flex; align-items: baseline; gap: 6px; }
      .cnt b { font-size: 20px; font-weight: 700; }
      .cnt.inhand b { color: var(--st-active); }
      .cnt.waiting b { color: var(--st-user); }
      .cnt.total b { color: var(--text); }

      .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px; }
      .card { border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); padding: 13px 14px; display: flex; flex-direction: column; gap: 10px; }
      .c-top { display: flex; align-items: center; gap: 8px; }
      .c-key { font-weight: 700; font-size: 13px; color: var(--brand); text-decoration: none; }
      .c-key:hover { text-decoration: underline; }
      /* badge ติดตามเมล — ซ่อน host ตอนไม่มี badge กัน gap ของ .card กินที่เปล่า */
      .fb-slot { align-self: flex-start; }
      .fb-slot:empty { display: none; }
      .c-summary { font-size: 14px; line-height: 1.55; color: var(--text); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .c-tickets { display: flex; flex-wrap: wrap; gap: 5px; }
      .c-tickets.none { font-size: 12px; color: var(--muted-2); }
      .tk { font-size: 11px; color: var(--muted); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-xs); padding: 2px 7px; }

      @media (max-width: 720px) {
        .masthead, .filters, .applied, .page { padding-left: 16px; padding-right: 16px; }
        .counts { margin-left: 0; gap: 16px; }
        .cards { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class WorkloadComponent implements OnInit {
  groups: WorkloadGroup[] = [];
  filters: TicketFilters | null = null;
  loading = true;
  error = false;
  includeDone = false;
  department = '';
  requester = '';
  private text$ = new Subject<void>();

  constructor(private service: TicketsService) {}

  ngOnInit(): void {
    this.service.filters().subscribe({ next: (f) => (this.filters = f) });
    this.text$.pipe(debounceTime(350)).subscribe(() => this.load());
    this.load();
  }

  onText(): void {
    this.text$.next();
  }

  appliedChips(): AppliedChip[] {
    const chips: AppliedChip[] = [];
    if (this.department)
      chips.push({ label: `แผนก: ${this.department}`, clear: () => { this.department = ''; this.load(); } });
    if (this.requester)
      chips.push({ label: `ผู้แจ้ง: ${this.requester}`, clear: () => { this.requester = ''; this.load(); } });
    return chips;
  }

  resetFilters(): void {
    this.department = '';
    this.requester = '';
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.service
      .workload({
        includeDone: this.includeDone,
        department: this.department || undefined,
        requester: this.requester || undefined,
      })
      .subscribe({
      next: (g) => {
        // เรียงคนที่ "งานอยู่ในมือจริง" เยอะสุดก่อน (design brief §5)
        this.groups = [...g].sort(
          (a, b) =>
            b.inHand - a.inHand ||
            b.waitingOnOthers - a.waitingOnOthers ||
            a.assignee.localeCompare(b.assignee),
        );
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  jiraUrl(key: string): string {
    return JIRA_BASE + key;
  }

  initials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
  }
}
