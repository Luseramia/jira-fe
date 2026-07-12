import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { IssuesService } from '../issues.service';
import { AssigneeReport, BlockedReason, WeeklyReport } from '../models';

interface ReasonMeta {
  label: string;
  cssKey: string; // ใช้กับ [attr.data-reason]
}

@Component({
  selector: 'app-weekly',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="page">
      <div class="state" *ngIf="loading">กำลังสร้างรายงานรายสัปดาห์…</div>
      <div class="state err" *ngIf="error">
        ดึงรายงานไม่ได้ — ตรวจว่า backend รันอยู่ และรัน DDL
        (db/02_weekly_report.sql) + sync changelog แล้ว
      </div>

      <div class="state empty" *ngIf="!loading && !error && report && report.assignees.length === 0">
        ยังไม่มีข้อมูลในรายงาน — เช็คว่า sync ดึงสถานะที่รออยู่เข้ามาแล้ว
      </div>

      <ng-container *ngIf="!loading && !error && report">
        <p class="window">
          รอบรายงาน · 7 วันล่าสุด ถึง {{ report.weekEnd | date: 'd MMM yyyy' }}
        </p>

        <section class="person" *ngFor="let a of report.assignees">
          <div class="person-head">
            <span class="avatar">{{ initials(a.assignee) }}</span>
            <h2>{{ a.assignee }}</h2>
            <span class="counts">
              <span class="c blocked" *ngIf="a.blocked.length">{{ a.blocked.length }} ติด</span>
              <span class="c wu" *ngIf="waitingUser(a)">{{ waitingUser(a) }} รอ user ⭐</span>
              <span class="c plan" *ngIf="a.plan.length">{{ a.plan.length }} แพลน</span>
              <span class="c done" *ngIf="a.done.length">{{ a.done.length }} เสร็จ</span>
            </span>
          </div>

          <div class="cols">
            <!-- ── BLOCKED (สำคัญสุด) ── -->
            <div class="col">
              <h3 class="col-title">🚧 ติดอยู่ / รออยู่</h3>
              <p class="col-empty" *ngIf="!a.blocked.length">— ไม่มี</p>
              <article
                class="bcard"
                *ngFor="let b of a.blocked"
                [attr.data-reason]="reasonMeta(b.blockedReason).cssKey"
              >
                <div class="rail">
                  <span class="rail-num">{{ b.daysBlocked ?? '–' }}</span>
                  <span class="rail-unit">วันค้าง</span>
                </div>
                <div class="bbody">
                  <div class="brow">
                    <span class="key">{{ b.key }}</span>
                    <span class="reason">{{ reasonMeta(b.blockedReason).label }}</span>
                    <span class="overdue" *ngIf="b.overdue">1เลย due</span>
                  </div>
                  <p class="bsum">{{ b.summary }}</p>
                  <div class="bmeta">
                    <span class="status">{{ b.status }}</span>
                    <span class="dot" *ngIf="b.dueDate">·</span>
                    <span *ngIf="b.dueDate">due {{ b.dueDate }}</span>
                  </div>
                </div>
              </article>
            </div>

            <!-- ── PLAN ── -->
            <div class="col">
              <h3 class="col-title">📋 แพลน (sprint)</h3>
              <p class="col-empty" *ngIf="!a.plan.length">— ไม่มี</p>
              <article class="scard" *ngFor="let p of a.plan">
                <div class="srow">
                  <span class="key">{{ p.key }}</span>
                  <span class="sprint" *ngIf="p.sprintState">{{ p.sprintState }}</span>
                  <span class="spacer"></span>
                  <span class="status">{{ p.status }}</span>
                </div>
                <p class="ssum">{{ p.summary }}</p>
                <div class="smeta" *ngIf="p.dueDate || p.sprintName">
                  <span *ngIf="p.sprintName">{{ p.sprintName }}</span>
                  <span class="dot" *ngIf="p.dueDate && p.sprintName">·</span>
                  <span *ngIf="p.dueDate">due {{ p.dueDate }}</span>
                </div>
              </article>
            </div>

            <!-- ── ACTIVITY + DONE ── -->
            <div class="col">
              <h3 class="col-title">🔄 ความเคลื่อนไหว</h3>
              <p class="col-empty" *ngIf="!a.activity.length">— ไม่มี</p>
              <div class="line" *ngFor="let ac of a.activity">
                <span class="key">{{ ac.issueKey }}</span>
                <span class="trans">
                  <span class="from">{{ ac.fromStatus || '—' }}</span>
                  <span class="arrow">→</span>
                  <span class="to">{{ ac.toStatus }}</span>
                </span>
                <span class="when">{{ ac.changedAt | date: 'd MMM' }}</span>
              </div>

              <ng-container *ngIf="a.done.length">
                <h3 class="col-title done-title">✅ เสร็จสัปดาห์นี้</h3>
                <div class="line done" *ngFor="let d of a.done">
                  <span class="key">{{ d.issueKey }}</span>
                  <span class="dsum">{{ d.summary }}</span>
                  <span class="when">{{ d.changedAt | date: 'd MMM' }}</span>
                </div>
              </ng-container>
            </div>
          </div>
        </section>
      </ng-container>
    </main>
  `,
  styles: [
    `
      .page { max-width: 1320px; margin: 0 auto; padding: 8px 28px 80px; }
      .state { text-align: center; color: var(--muted); padding: 60px 0; font-size: 14px; }
      .state.err { color: var(--overdue); }
      .state.empty { color: var(--upcoming); }
      .window {
        color: var(--muted-2);
        font-family: var(--font-mono);
        font-size: 12px;
        margin: 4px 0 18px;
      }

      .person {
        margin-top: 22px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--panel);
        overflow: hidden;
      }
      .person-head {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 18px;
        border-bottom: 1px solid var(--line);
        background: var(--panel-2);
      }
      .avatar {
        width: 30px; height: 30px;
        flex: 0 0 30px;
        display: grid; place-items: center;
        border-radius: 99px;
        background: color-mix(in srgb, var(--brand) 18%, transparent);
        color: var(--brand);
        font-family: var(--font-mono);
        font-size: 12px;
        font-weight: 700;
      }
      .person-head h2 {
        margin: 0;
        font-family: var(--font-display);
        font-size: 16px;
        font-weight: 600;
      }
      .counts { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
      .counts .c {
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 2px 9px;
        border-radius: 99px;
        border: 1px solid var(--line);
        color: var(--muted);
      }
      .counts .c.blocked { color: var(--today); border-color: color-mix(in srgb, var(--today) 45%, var(--line)); }
      .counts .c.wu {
        color: var(--overdue);
        border-color: var(--overdue);
        background: color-mix(in srgb, var(--overdue) 12%, transparent);
        font-weight: 700;
      }
      .counts .c.plan { color: var(--brand); }
      .counts .c.done { color: var(--upcoming); }

      .cols {
        display: grid;
        grid-template-columns: 1.2fr 1fr 1fr;
        gap: 0;
      }
      .col { padding: 14px 16px; border-right: 1px solid var(--line); min-width: 0; }
      .col:last-child { border-right: none; }
      .col-title {
        margin: 0 0 10px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .col-title.done-title { margin-top: 16px; color: var(--upcoming); }
      .col-empty { color: var(--muted-2); font-size: 12px; margin: 0; }

      /* blocked card — urgency rail ตาม reason */
      .bcard {
        display: flex;
        gap: 0;
        margin-bottom: 9px;
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        overflow: hidden;
        background: var(--panel-2);
      }
      .bcard[data-reason='waiting_user']   { --c: var(--overdue); }
      .bcard[data-reason='waiting_tester'] { --c: var(--soon); }
      .bcard[data-reason='waiting_senior'] { --c: var(--brand); }
      .bcard[data-reason='rework_dev']     { --c: var(--today); }
      .bcard[data-reason='in_transit']     { --c: var(--upcoming); }
      .bcard[data-reason='other']          { --c: var(--muted-2); }
      .bcard[data-reason='waiting_user'] {
        border-color: var(--overdue);
        box-shadow: inset 3px 0 0 0 var(--overdue);
      }
      .rail {
        flex: 0 0 52px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, var(--c) 14%, transparent);
        border-right: 2px solid var(--c);
      }
      .rail-num {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 19px;
        line-height: 1;
        color: var(--c);
      }
      .rail-unit { font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
      .bbody { flex: 1; min-width: 0; padding: 9px 11px; }
      .brow { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; flex-wrap: wrap; }
      .key { font-family: var(--font-mono); font-weight: 700; font-size: 11px; color: var(--brand); }
      .reason {
        font-size: 10px;
        font-weight: 600;
        color: var(--c);
        background: color-mix(in srgb, var(--c) 14%, transparent);
        border-radius: 99px;
        padding: 1px 8px;
      }
      .overdue {
        font-size: 10px;
        font-weight: 700;
        color: var(--overdue);
        border: 1px solid var(--overdue);
        border-radius: 99px;
        padding: 0 7px;
      }
      .bsum {
        margin: 0 0 5px;
        font-size: 13px;
        line-height: 1.35;
        color: var(--text);
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .bmeta, .smeta { display: flex; flex-wrap: wrap; gap: 5px; font-size: 11px; color: var(--muted); }
      .bmeta .status, .srow .status { color: var(--text); }
      .dot { color: var(--muted-2); }

      /* plan card */
      .scard {
        margin-bottom: 8px;
        padding: 9px 11px;
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: var(--panel-2);
      }
      .srow { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; }
      .spacer { flex: 1; }
      .sprint {
        font-family: var(--font-mono);
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--brand);
        border: 1px solid color-mix(in srgb, var(--brand) 40%, var(--line));
        border-radius: 99px;
        padding: 0 7px;
      }
      .srow .status { font-size: 11px; }
      .ssum {
        margin: 0 0 4px;
        font-size: 13px;
        line-height: 1.3;
        color: var(--text);
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }

      /* activity + done lines */
      .line {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 5px 0;
        border-bottom: 1px dashed var(--line);
        font-size: 12px;
      }
      .line:last-child { border-bottom: none; }
      .trans { display: flex; align-items: center; gap: 5px; min-width: 0; flex: 1; }
      .trans .from { color: var(--muted-2); }
      .trans .arrow { color: var(--muted-2); }
      .trans .to { color: var(--text); font-weight: 500; }
      .when { margin-left: auto; font-family: var(--font-mono); font-size: 10.5px; color: var(--muted-2); white-space: nowrap; }
      .dsum {
        flex: 1; min-width: 0;
        color: var(--text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .line.done .key { color: var(--upcoming); }

      @media (max-width: 900px) {
        .cols { grid-template-columns: 1fr; }
        .col { border-right: none; border-bottom: 1px solid var(--line); }
        .col:last-child { border-bottom: none; }
      }
      @media (max-width: 620px) {
        .page { padding: 8px 16px 60px; }
        .counts { width: 100%; margin-left: 42px; }
      }
    `,
  ],
})
export class WeeklyComponent implements OnInit {
  report: WeeklyReport | null = null;
  loading = true;
  error = false;

  private readonly reasons: Record<BlockedReason, ReasonMeta> = {
    waiting_user: { label: 'รอผล UAT ,SMOKE TEST', cssKey: 'waiting_user' },
    waiting_tester: { label: 'กำลังเทส', cssKey: 'waiting_tester' },
    waiting_senior: { label: 'กำลัง deploy', cssKey: 'waiting_senior' },
    rework_dev: { label: 'fail ,UAT ,SMOKE TEST', cssKey: 'rework_dev' },
    in_transit: { label: 'กำลัง repost ,deploy', cssKey: 'in_transit' },
    other: { label: 'อื่นๆ', cssKey: 'other' },
  };

  constructor(private service: IssuesService) {}

  ngOnInit(): void {
    this.service.weeklyReport().subscribe({
      next: (r) => {
        this.report = r;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  reasonMeta(r: BlockedReason): ReasonMeta {
    return this.reasons[r] ?? this.reasons.other;
  }

  waitingUser(a: AssigneeReport): number {
    return a.blocked.filter((b) => b.blockedReason === 'waiting_user').length;
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}
