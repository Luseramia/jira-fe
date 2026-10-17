import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UatVerdict, UatVerdictList } from '../models';
import { stageMeta } from '../tickets/status-chip';
import { UatVerdictsService } from '../uat-verdicts.service';

/**
 * แท็บ "UAT อนุมัติ" — ผลทดสอบจากเมล MOTO.OS (jira-be docs/UAT-VERDICT-PLAN.md)
 * ผ่าน → รอคนกดย้ายไป READY TO DEPLOY · ไม่ผ่าน → BE ย้ายเป็น UAT Fail เอง
 * ปุ่มย้ายเปิดเฉพาะการ์ดที่สถานะสดยังเป็น UAT (BE เช็คซ้ำอีกรอบก่อนย้าย)
 */
@Component({
  selector: 'app-uat-verdicts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="masthead">
      <div>
        <h1>UAT อนุมัติ</h1>
        <p class="sub">ผลทดสอบจากเมล MOTO.OS · ผ่าน = กดย้ายไป READY TO DEPLOY · ไม่ผ่าน = ย้ายเป็น UAT Fail อัตโนมัติ</p>
      </div>
      <div class="head-actions">
        <span class="queued" *ngIf="data?.queued">รอประมวลผล <b class="num">{{ data?.queued }}</b></span>
        <button class="btn ghost" (click)="processNow()" [disabled]="processing || !data?.jiraConfigured">
          {{ processing ? 'กำลังประมวลผล…' : 'ประมวลผลตอนนี้' }}
        </button>
        <button class="btn ghost" (click)="load()" [disabled]="loading">รีเฟรช</button>
      </div>
    </header>

    <main class="page">
      <div class="banner warn" *ngIf="data && !data.jiraConfigured">
        backend ยังไม่ได้ตั้ง JIRA_EMAIL / JIRA_API_TOKEN — ยังไม่ประมวลผลเมลและย้ายการ์ดไม่ได้
      </div>
      <div class="banner" *ngIf="data && !data.autoFail">ปิดการย้ายอัตโนมัติอยู่ (UAT_AUTO_FAIL=false) — เมลไม่ผ่านจะรอให้กดเหมือนเมลผ่าน</div>
      <div class="banner warn" *ngIf="data?.liveError">ดึงสถานะสดจาก Jira ไม่ได้ — {{ data?.liveError }}</div>
      <div class="banner err" *ngIf="actionError">
        {{ actionError }}
        <button class="x" (click)="actionError = null" aria-label="ปิด">✕</button>
      </div>

      <div class="state" *ngIf="loading && !data">กำลังโหลดข้อมูล…</div>
      <div class="state err" *ngIf="error">
        โหลดข้อมูลไม่ได้ — ระบบ API ที่ port 3000 อาจไม่ทำงาน
        <button class="btn" (click)="load()">ลองใหม่</button>
      </div>

      <ng-container *ngIf="data">
        <!-- ── รออนุมัติ ── -->
        <section class="group">
          <div class="g-head">
            <h2>รออนุมัติ</h2>
            <span class="count num">{{ data.pending.length }}</span>
          </div>
          <div class="empty" *ngIf="!data.pending.length">ไม่มีการ์ดรออนุมัติ</div>
          <div class="cards">
            <article class="card" *ngFor="let v of data.pending">
              <ng-container *ngTemplateOutlet="cardHead; context: { $implicit: v }"></ng-container>
              <div class="move">
                <span class="st" [style.--c]="color(v.liveStatus ?? v.jiraStatus)">{{ v.liveStatus ?? v.jiraStatus ?? '—' }}</span>
                <span class="arrow">→</span>
                <span class="st" [style.--c]="color(v.targetStatus)">{{ v.targetStatus }}</span>
              </div>
              <div class="reason" *ngIf="v.reason">{{ v.reason }}</div>
              <div class="drift" *ngIf="!canApprove(v)">
                การ์ดไม่ได้อยู่ UAT แล้ว — กด "ย้าย" ไม่ได้ ลอง "ตรวจใหม่"
              </div>
              <div class="actions">
                <button class="btn primary" (click)="approve(v)" [disabled]="busyId === v.id || !canApprove(v)">
                  {{ busyId === v.id ? 'กำลังย้าย…' : 'ย้ายไป ' + v.targetStatus }}
                </button>
                <button class="btn ghost" (click)="requeue(v)" [disabled]="busyId === v.id" *ngIf="!canApprove(v)">ตรวจใหม่</button>
                <button class="btn ghost" (click)="dismiss(v)" [disabled]="busyId === v.id">ซ่อน</button>
              </div>
            </article>
          </div>
        </section>

        <!-- ── ต้องตรวจ ── -->
        <section class="group" *ngIf="data.review.length">
          <div class="g-head">
            <h2>ต้องตรวจ</h2>
            <span class="count num review">{{ data.review.length }}</span>
            <span class="g-sub">ระบบตัดสินเองไม่ได้ — ไม่ได้แตะ Jira</span>
          </div>
          <div class="cards">
            <article class="card" *ngFor="let v of data.review">
              <ng-container *ngTemplateOutlet="cardHead; context: { $implicit: v }"></ng-container>
              <div class="move" *ngIf="v.jiraKey">
                <span class="lbl">Jira ตอนนี้</span>
                <span class="st" [style.--c]="color(v.liveStatus ?? v.jiraStatus)">{{ v.liveStatus ?? v.jiraStatus ?? '—' }}</span>
              </div>
              <div class="reason strong">{{ v.reason || 'ไม่ทราบเหตุผล' }}</div>
              <div class="link-row" *ngIf="linkingId === v.id">
                <input type="text" class="mono" placeholder="SE-2157" [(ngModel)]="linkKey" (keyup.enter)="requeue(v, linkKey)" />
                <button class="btn primary" (click)="requeue(v, linkKey)" [disabled]="!linkKey.trim() || busyId === v.id">ผูก + ตรวจ</button>
                <button class="btn ghost" (click)="linkingId = null">ยกเลิก</button>
              </div>
              <div class="actions" *ngIf="linkingId !== v.id">
                <button class="btn" (click)="requeue(v)" [disabled]="busyId === v.id">
                  {{ busyId === v.id ? 'กำลังตรวจ…' : 'ตรวจใหม่' }}
                </button>
                <button class="btn ghost" (click)="startLink(v)" [disabled]="busyId === v.id">ผูกการ์ดเอง</button>
                <button class="btn ghost" (click)="dismiss(v)" [disabled]="busyId === v.id">ซ่อน</button>
              </div>
            </article>
          </div>
        </section>

        <!-- ── ล่าสุด 7 วัน ── -->
        <section class="group">
          <div class="g-head">
            <h2>ล่าสุด 7 วัน</h2>
            <label class="toggle">
              <input type="checkbox" [(ngModel)]="showSuperseded" /> แสดงเมลที่ถูกแทน
            </label>
          </div>
          <div class="empty" *ngIf="!recentRows().length">ยังไม่มีรายการ</div>
          <div class="log">
            <div class="log-row" *ngFor="let v of recentRows()">
              <span class="t mono">{{ v.updatedAt | date: 'd MMM HH:mm' }}</span>
              <span class="tk mono">{{ v.ticketNo }}</span>
              <a class="c-key mono" *ngIf="v.jiraKey" [href]="v.jiraUrl" target="_blank" rel="noopener">{{ v.jiraKey }} ↗</a>
              <span class="c-key none" *ngIf="!v.jiraKey">—</span>
              <span class="vd" [class.fail]="v.verdict === 'fail'">{{ v.verdict === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน' }}</span>
              <span class="outcome" [ngClass]="v.state" [title]="outcome(v)">{{ outcome(v) }}</span>
            </div>
          </div>
        </section>
      </ng-container>
    </main>

    <ng-template #cardHead let-v>
      <div class="c-top">
        <span class="tk mono">{{ v.ticketNo }}</span>
        <a class="c-key mono" *ngIf="v.jiraKey" [href]="v.jiraUrl" target="_blank" rel="noopener">{{ v.jiraKey }} ↗</a>
        <span class="vd" [class.fail]="v.verdict === 'fail'">{{ v.verdict === 'pass' ? 'UAT ผ่าน' : 'UAT ไม่ผ่าน' }}</span>
      </div>
      <div class="c-summary" [title]="v.jiraSummary || v.subject">{{ v.jiraSummary || v.subject }}</div>
      <div class="meta">
        <span *ngIf="v.actorName">โดย {{ v.actorName }}</span>
        <span class="mono">เมล {{ v.receivedAt | date: 'd MMM HH:mm' }}</span>
      </div>
    </ng-template>
  `,
  styles: [
    `
      .masthead { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; max-width: 1320px; margin: 0 auto; padding: 30px 28px 16px; }
      h1 { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 24px; }
      .sub { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
      .head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .queued { font-size: 13px; color: var(--muted); }
      .queued b { color: var(--st-user); font-size: 16px; margin-left: 4px; }

      .page { max-width: 1320px; margin: 0 auto; padding: 10px 28px 80px; }
      .state { text-align: center; color: var(--muted); padding: 54px 16px; font-size: 15px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .state.err { color: var(--st-rework); }

      .banner { display: flex; align-items: center; gap: 10px; border: 1px solid var(--line); background: var(--panel); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 12px; font-size: 14px; color: var(--muted); }
      .banner.warn { color: var(--st-user); border-color: color-mix(in srgb, var(--st-user) 40%, var(--line)); }
      .banner.err { color: var(--st-rework); border-color: color-mix(in srgb, var(--st-rework) 45%, var(--line)); }
      .banner .x { margin-left: auto; background: transparent; border: none; color: inherit; cursor: pointer; font-size: 13px; }

      .btn { background: var(--panel-2); border: 1px solid var(--line); color: var(--text); border-radius: var(--radius-sm); padding: 7px 14px; font-size: 13.5px; cursor: pointer; font-family: var(--font-body); white-space: nowrap; }
      .btn:hover:not(:disabled) { border-color: var(--brand); }
      .btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .btn.primary { background: color-mix(in srgb, var(--brand) 22%, var(--panel-2)); border-color: color-mix(in srgb, var(--brand) 55%, var(--line)); color: var(--text); font-weight: 600; }
      .btn.ghost { background: transparent; }

      .group { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); padding: 18px 20px; margin-bottom: 16px; }
      .g-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
      .g-head h2 { margin: 0; font-family: var(--font-display); font-size: 17px; font-weight: 600; }
      .g-sub { font-size: 12.5px; color: var(--muted); }
      .count { font-size: 13px; font-weight: 700; color: var(--st-user); background: color-mix(in srgb, var(--st-user) 14%, transparent); border-radius: 99px; padding: 0 9px; }
      .count.review { color: var(--st-rework); background: color-mix(in srgb, var(--st-rework) 14%, transparent); }
      .empty { font-size: 13.5px; color: var(--muted-2); }
      .toggle { margin-left: auto; display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); cursor: pointer; }

      .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
      .card { border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); padding: 13px 14px; display: flex; flex-direction: column; gap: 9px; }
      .c-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .c-key { font-weight: 700; font-size: 13px; color: var(--brand); text-decoration: none; }
      .c-key:hover { text-decoration: underline; }
      .c-key.none { color: var(--muted-2); }
      .tk { font-size: 11.5px; color: var(--muted); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-xs); padding: 2px 7px; }
      .vd { margin-left: auto; font-size: 11.5px; font-weight: 700; padding: 1px 9px; border-radius: 99px; color: var(--st-active); background: color-mix(in srgb, var(--st-active) 15%, transparent); }
      .vd.fail { color: var(--st-rework); background: color-mix(in srgb, var(--st-rework) 15%, transparent); }
      .c-summary { font-size: 14px; line-height: 1.55; color: var(--text); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12.5px; color: var(--muted); }

      .move { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
      .move .lbl { color: var(--muted); font-size: 12.5px; }
      .arrow { color: var(--muted); }
      .st { --c: var(--st-neutral); display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--text); }
      .st::before { content: ''; width: 8px; height: 8px; border-radius: 99px; background: var(--c); }

      .reason { font-size: 12.5px; color: var(--muted); }
      .reason.strong { color: var(--st-rework); font-size: 13px; }
      .drift { font-size: 12.5px; color: var(--st-user); }
      .actions, .link-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
      .link-row input { flex: 1; min-width: 120px; background: var(--panel); border: 1px solid var(--line); color: var(--text); border-radius: var(--radius-sm); padding: 7px 10px; font-size: 13.5px; }
      .link-row input:focus { outline: 2px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 1px; border-color: var(--brand); }

      .log { display: flex; flex-direction: column; }
      .log-row { display: grid; grid-template-columns: 110px 90px 100px 64px 1fr; align-items: center; gap: 10px; padding: 7px 4px; border-top: 1px solid var(--line); font-size: 13px; }
      .log-row:first-child { border-top: none; }
      .log-row .t { color: var(--muted); font-size: 12px; }
      .log-row .vd { margin-left: 0; justify-self: start; }
      .outcome { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .outcome.transitioned { color: var(--text); }

      @media (max-width: 720px) {
        .masthead, .page { padding-left: 16px; padding-right: 16px; }
        .cards { grid-template-columns: 1fr; }
        .log-row { grid-template-columns: 90px 1fr auto; }
        .log-row .tk, .log-row .vd { display: none; }
        .outcome { grid-column: 1 / -1; white-space: normal; }
      }
    `,
  ],
})
export class UatVerdictsComponent implements OnInit {
  data: UatVerdictList | null = null;
  loading = true;
  error = false;
  processing = false;
  busyId: number | null = null;
  actionError: string | null = null;
  linkingId: number | null = null;
  linkKey = '';
  showSuperseded = false;

  constructor(private service: UatVerdictsService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.service.list().subscribe({
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

  processNow(): void {
    this.processing = true;
    this.service.process().subscribe({
      next: () => {
        this.processing = false;
        this.load();
      },
      error: (e) => {
        this.processing = false;
        this.actionError = this.message(e);
      },
    });
  }

  /** สถานะสดยังเป็น UAT (ถ้าดึงสถานะสดไม่ได้ ให้ BE ตัดสินตอนกด) */
  canApprove(v: UatVerdict): boolean {
    const s = (v.liveStatus ?? v.jiraStatus ?? '').trim().toLowerCase();
    return !!v.jiraKey && (v.liveStatus == null || s === 'uat');
  }

  approve(v: UatVerdict): void {
    if (!confirm(`ย้าย ${v.jiraKey} (${v.ticketNo}) ไป ${v.targetStatus} ใน Jira?`)) return;
    this.run(v, this.service.approve(v.id));
  }

  dismiss(v: UatVerdict): void {
    if (!confirm(`ซ่อน ${v.ticketNo} จากรายการ? (ไม่แตะ Jira)`)) return;
    this.run(v, this.service.dismiss(v.id));
  }

  requeue(v: UatVerdict, jiraKey?: string): void {
    this.run(v, this.service.requeue(v.id, jiraKey?.trim() || undefined));
  }

  startLink(v: UatVerdict): void {
    this.linkingId = v.id;
    this.linkKey = v.jiraKey ?? '';
  }

  recentRows(): UatVerdict[] {
    const rows = this.data?.recent ?? [];
    return this.showSuperseded ? rows : rows.filter((r) => r.state !== 'superseded');
  }

  outcome(v: UatVerdict): string {
    switch (v.state) {
      case 'transitioned':
        return `${v.transitionedBy === 'auto' ? 'ย้ายอัตโนมัติ' : 'ย้ายจากเว็บ'} → ${v.targetStatus}`;
      case 'skipped':
        return `ข้าม — ${v.reason ?? ''}`;
      case 'dismissed':
        return 'ซ่อนแล้ว';
      case 'superseded':
        return `ถูกแทน — ${v.reason ?? ''}`;
      default:
        return v.state;
    }
  }

  color(status: string | null): string {
    return stageMeta(status).color;
  }

  private run(v: UatVerdict, req: ReturnType<UatVerdictsService['approve']>): void {
    this.busyId = v.id;
    this.actionError = null;
    req.subscribe({
      next: () => {
        this.busyId = null;
        this.linkingId = null;
        this.linkKey = '';
        this.load();
      },
      error: (e) => {
        this.busyId = null;
        this.actionError = this.message(e);
        this.load(); // BE อาจอัปเดต state แล้ว (เช่น 409 การ์ดขยับไปแล้ว)
      },
    });
  }

  private message(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(', ') : m || e?.message || 'เกิดข้อผิดพลาด';
  }
}
