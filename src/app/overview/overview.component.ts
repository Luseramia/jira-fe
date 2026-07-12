import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Overview, TicketPreset } from '../models';
import { TicketsService } from '../tickets.service';
import { StageStripComponent } from '../tickets/stage-strip.component';

export interface NavEvent {
  tab: 'tickets' | 'workload';
  preset?: TicketPreset;
}

const GROUP_LABEL: Record<string, string> = {
  active: 'ในมือ dev (ทำอยู่)',
  waiting_tester: 'รอ tester',
  waiting_user: 'รอ user',
  waiting_senior: 'รอ senior',
  rework_dev: 'แก้กลับ',
  in_transit: 'ระหว่าง deploy',
  other: 'อื่น ๆ',
};
const GROUP_COLOR: Record<string, string> = {
  active: 'var(--st-active)',
  waiting_tester: 'var(--st-tester)',
  waiting_user: 'var(--st-user)',
  waiting_senior: 'var(--st-senior)',
  rework_dev: 'var(--st-rework)',
  in_transit: 'var(--st-neutral)',
  other: 'var(--st-neutral)',
};

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, StageStripComponent],
  template: `
    <header class="masthead">
      <div>
        <h1>ภาพรวม</h1>
        <p class="sub">ตั๋วเปิดการ์ดครบไหม · งานติดที่ใคร · อะไรค้างนาน</p>
      </div>
      <div class="year-pick">
        <label>ปีที่แจ้ง</label>
        <select [(ngModel)]="year" (ngModelChange)="load()">
          <option [ngValue]="undefined">ทุกปี</option>
          <option *ngFor="let y of years" [ngValue]="y">{{ y }}</option>
        </select>
      </div>
    </header>

    <p class="year-note" *ngIf="year != null">
      กำลังดูเฉพาะตั๋วที่แจ้งปี {{ year }} · Jira เริ่มใช้ปีนี้ ปีเก่ากว่านี้แทบไม่มีการ์ด
    </p>

    <main class="page">
      <div class="state" *ngIf="loading">กำลังโหลดภาพรวม…</div>
      <div class="state err" *ngIf="error">
        โหลดภาพรวมไม่ได้ — ระบบ API ที่ port 3000 อาจไม่ทำงาน
        <button class="retry" (click)="load()">ลองใหม่</button>
      </div>

      <div class="grid" *ngIf="data && !loading">
        <!-- A. Ticket coverage -->
        <section class="panel">
          <h2>ตั๋วเปิดการ์ด Jira แล้วแค่ไหน <span class="only">เฉพาะตั๋วที่อนุมัติแล้ว</span></h2>
          <div class="cov-bar" [title]="pct(data.coverage.linked, data.coverage.total) + '% เปิดการ์ดแล้ว'">
            <span class="cov-fill" [style.width.%]="pct(data.coverage.linked, data.coverage.total)"></span>
          </div>
          <div class="tiles">
            <div class="tile"><span class="tn num">{{ data.coverage.total | number }}</span><span class="tl">ตั๋วทั้งหมด</span></div>
            <button class="tile click" (click)="go({ tab: 'tickets', preset: { hasJira: 'yes' } })">
              <span class="tn num">{{ data.coverage.linked | number }}</span><span class="tl">เปิดการ์ดแล้ว</span>
            </button>
            <button class="tile click" (click)="go({ tab: 'tickets', preset: { hasJira: 'no' } })">
              <span class="tn num">{{ data.coverage.unlinked | number }}</span><span class="tl">ยังไม่เปิดการ์ด</span>
            </button>
            <button class="tile click warn" (click)="go({ tab: 'tickets', preset: { mismatch: true } })">
              <span class="tn num">⚠ {{ data.coverage.mismatch | number }}</span><span class="tl">ข้อมูลไม่ตรงกัน</span>
            </button>
          </div>
        </section>

        <!-- B. Ball-ownership funnel -->
        <section class="panel">
          <h2>งานที่เปิดอยู่ตอนนี้ติดที่ใคร</h2>
          <p class="hint" (click)="go({ tab: 'workload' })">ดูรายคนในหน้า Workload →</p>
          <div class="funnel">
            <div class="fn-row" *ngFor="let g of data.byGroup">
              <span class="fn-label">{{ label(g.group) }}</span>
              <div class="fn-track">
                <span class="fn-bar" [style.width.%]="barW(g.count)" [style.background]="color(g.group)"></span>
              </div>
              <span class="fn-n num" [class.pain]="g.group === 'waiting_user'">{{ g.count }}</span>
            </div>
          </div>
        </section>

        <!-- C. Aging -->
        <section class="panel">
          <h2>งานค้างนานในสเตจเดิม</h2>
          <div class="aging-top">
            <div class="a-stat"><span class="tn num">{{ data.aging.over7 }}</span><span class="tl">ค้าง > 7 วัน</span></div>
            <div class="a-stat warn"><span class="tn num">{{ data.aging.over14 }}</span><span class="tl">ค้าง > 14 วัน</span></div>
          </div>
          <div class="aging-list">
            <a class="ag" *ngFor="let c of data.aging.oldest" [href]="jiraUrl(c.key)" target="_blank" rel="noopener">
              <span class="ag-key mono">{{ c.key }}</span>
              <app-stage-strip class="ag-strip" [status]="c.status" [showLabel]="false"></app-stage-strip>
              <span class="ag-stage" [style.color]="color(c.category)">{{ stageText(c) }}</span>
              <span class="ag-days num">{{ c.daysInStage }} วัน</span>
              <span class="ag-who mono">{{ c.ticketNumbers.length ? c.ticketNumbers.join(', ') : 'ไม่พบตั๋วที่เชื่อม' }}</span>
            </a>
            <div class="empty" *ngIf="data.aging.oldest.length === 0">ไม่มีงานค้างเกิน 7 วัน 👍</div>
          </div>
        </section>

        <!-- D. By department -->
        <section class="panel">
          <h2>ตั๋วแยกตามแผนก · เปิดการ์ดแล้วแค่ไหน <span class="only">เฉพาะตั๋วที่อนุมัติแล้ว</span></h2>
          <div class="dept">
            <button class="dept-row" *ngFor="let d of topDepts()" (click)="go({ tab: 'tickets', preset: { department: d.department } })">
              <span class="d-name">{{ d.department }}</span>
              <div class="d-track"><span class="d-fill" [style.width.%]="pct(d.linked, d.tickets)"></span></div>
              <span class="d-num num">{{ d.linked | number }}/{{ d.tickets | number }}</span>
              <span class="d-pct num">{{ pct(d.linked, d.tickets) }}%</span>
            </button>
          </div>
        </section>
      </div>
    </main>
  `,
  styles: [
    `
      .masthead { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; max-width: 1320px; margin: 0 auto; padding: 30px 28px 8px; }
      h1 { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 24px; }
      .sub { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
      .year-pick { display: flex; flex-direction: column; gap: 5px; }
      .year-pick label { font-size: 11px; color: var(--muted); font-weight: 500; }
      .year-pick select { background: var(--panel); border: 1px solid var(--line); color: var(--text); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 14px; font-family: var(--font-body); min-width: 120px; }
      .year-pick select:focus { outline: 2px solid color-mix(in srgb, var(--brand) 55%, transparent); border-color: var(--brand); }
      .year-note { max-width: 1320px; margin: 8px auto 0; padding: 0 28px; font-size: 12.5px; color: var(--muted-2); }
      .page { max-width: 1320px; margin: 0 auto; padding: 14px 28px 80px; }
      .state { text-align: center; color: var(--muted); padding: 54px 16px; font-size: 15px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .state.err { color: var(--st-rework); }
      .retry { background: var(--panel); border: 1px solid var(--line); color: var(--text); border-radius: var(--radius-sm); padding: 8px 16px; font-size: 14px; cursor: pointer; font-family: var(--font-body); }

      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .panel { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); padding: 18px 20px; }
      .panel h2 { margin: 0 0 14px; font-family: var(--font-display); font-size: 15px; font-weight: 600; }
      .panel h2 .only { font-family: var(--font-body); font-size: 11.5px; font-weight: 400; color: var(--muted-2); background: var(--panel-2); border: 1px solid var(--line); border-radius: 99px; padding: 2px 9px; margin-left: 6px; white-space: nowrap; }
      .hint { margin: -8px 0 12px; font-size: 12.5px; color: var(--brand); cursor: pointer; }
      .hint:hover { text-decoration: underline; }
      .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

      /* A. coverage */
      .cov-bar { height: 10px; border-radius: 99px; background: var(--line); overflow: hidden; margin-bottom: 16px; }
      .cov-fill { display: block; height: 100%; background: color-mix(in srgb, var(--text) 55%, var(--line)); border-radius: 99px; }
      .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .tile { display: flex; flex-direction: column; gap: 3px; align-items: flex-start; padding: 12px 13px; border-radius: var(--radius-sm); background: var(--panel-2); border: 1px solid var(--line); text-align: left; }
      button.tile { cursor: pointer; font-family: var(--font-body); }
      button.tile:hover { border-color: var(--brand); }
      button.tile:focus-visible { outline: 2px solid var(--brand); }
      .tile .tn { font-size: 21px; font-weight: 700; color: var(--text); }
      .tile .tl { font-size: 11.5px; color: var(--muted); }
      .tile.warn .tn { color: var(--st-user); }

      /* B. funnel */
      .funnel { display: flex; flex-direction: column; gap: 9px; }
      .fn-row { display: grid; grid-template-columns: 120px 1fr 40px; align-items: center; gap: 10px; }
      .fn-label { font-size: 13px; color: var(--muted); }
      .fn-track { height: 16px; background: var(--panel-2); border-radius: var(--radius-xs); overflow: hidden; }
      .fn-bar { display: block; height: 100%; border-radius: var(--radius-xs); min-width: 3px; }
      .fn-n { text-align: right; font-size: 14px; font-weight: 700; color: var(--text); }
      .fn-n.pain { color: var(--st-user); }

      /* C. aging */
      .aging-top { display: flex; gap: 24px; margin-bottom: 14px; }
      .a-stat { display: flex; flex-direction: column; gap: 2px; }
      .a-stat .tn { font-size: 24px; font-weight: 700; color: var(--text); }
      .a-stat.warn .tn { color: var(--st-user); }
      .a-stat .tl { font-size: 12px; color: var(--muted); }
      .aging-list { display: flex; flex-direction: column; }
      .ag { display: grid; grid-template-columns: 64px 70px 1fr 62px; grid-template-areas: 'key strip stage days' 'who who who who'; align-items: center; gap: 4px 10px; padding: 9px 4px; border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent); text-decoration: none; }
      .ag:hover { background: var(--panel-2); }
      .ag-key { grid-area: key; font-size: 12px; font-weight: 700; color: var(--brand); }
      .ag-strip { grid-area: strip; }
      .ag-stage { grid-area: stage; font-size: 12.5px; font-weight: 600; }
      .ag-days { grid-area: days; text-align: right; font-size: 12.5px; color: var(--text); font-weight: 700; }
      .ag-who { grid-area: who; font-size: 11.5px; color: var(--muted-2); }
      .empty { color: var(--muted-2); font-size: 13.5px; padding: 12px 0; }

      /* D. department */
      .dept { display: flex; flex-direction: column; gap: 4px; }
      .dept-row { display: grid; grid-template-columns: 1fr 120px 78px 46px; align-items: center; gap: 12px; padding: 8px 6px; background: transparent; border: none; border-bottom: 1px solid color-mix(in srgb, var(--line) 55%, transparent); cursor: pointer; font-family: var(--font-body); text-align: left; }
      .dept-row:hover { background: var(--panel-2); }
      .dept-row:focus-visible { outline: 2px solid var(--brand); }
      .d-name { font-size: 13.5px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .d-track { height: 8px; background: var(--line); border-radius: 99px; overflow: hidden; }
      .d-fill { display: block; height: 100%; background: color-mix(in srgb, var(--text) 45%, var(--line)); }
      .d-num { font-size: 12px; color: var(--muted); text-align: right; }
      .d-pct { font-size: 12.5px; color: var(--text); text-align: right; font-weight: 700; }

      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      @media (max-width: 620px) {
        .masthead, .page { padding-left: 16px; padding-right: 16px; }
        .tiles { grid-template-columns: repeat(2, 1fr); }
        .fn-row { grid-template-columns: 96px 1fr 34px; }
      }
    `,
  ],
})
export class OverviewComponent implements OnInit {
  @Output() navigate = new EventEmitter<NavEvent>();

  data: Overview | null = null;
  loading = true;
  error = false;
  // default = ปีปัจจุบัน เพราะ Jira เพิ่งเริ่มใช้ปีนี้ (ปีเก่าทำให้ coverage เพี้ยน)
  year: number | undefined = new Date().getFullYear();
  years: number[] = [];

  constructor(private service: TicketsService) {}

  ngOnInit(): void {
    const cur = new Date().getFullYear();
    this.years = [cur, cur - 1, cur - 2, cur - 3];
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.service.overview(this.year).subscribe({
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

  go(e: NavEvent): void {
    // coverage/แผนก นับเฉพาะ Approved + ปีที่ดู → drill-down พาเงื่อนไขเดียวกันไปด้วย ให้เลขตรง
    if (e.tab === 'tickets') {
      e = {
        ...e,
        preset: {
          ...(e.preset ?? {}),
          finalStatus: 'Approved',
          ...(this.year != null ? { year: this.year } : {}),
        },
      };
    }
    this.navigate.emit(e);
  }

  label(g: string): string {
    return GROUP_LABEL[g] ?? g;
  }
  color(g: string): string {
    return GROUP_COLOR[g] ?? 'var(--st-neutral)';
  }
  pct(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
  }
  barW(count: number): number {
    const max = Math.max(1, ...(this.data?.byGroup.map((g) => g.count) ?? [1]));
    return Math.max(3, Math.round((count / max) * 100));
  }
  topDepts() {
    return (this.data?.byDepartment ?? []).slice(0, 10);
  }
  stageText(c: { status: string | null }): string {
    return c.status ?? '—';
  }
  jiraUrl(key: string): string {
    return `https://sittidate-lueangon.atlassian.net/browse/${key}`;
  }
}
