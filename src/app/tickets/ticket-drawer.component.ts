import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LinkedIssue, TicketDetail } from '../models';
import { TicketsService } from '../tickets.service';
import { FollowupBadgeComponent } from './followup-badge.component';
import { StageStripComponent } from './stage-strip.component';
import { stageMeta } from './status-chip';

@Component({
  selector: 'app-ticket-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, StageStripComponent, FollowupBadgeComponent],
  template: `
    <div class="scrim" [class.show]="!!ticketNumber" (click)="closed.emit()"></div>

    <aside class="drawer" [class.show]="!!ticketNumber" *ngIf="ticketNumber">
      <header class="head">
        <div class="head-top">
          <span class="key mono">{{ ticketNumber }}</span>
          <button class="x" type="button" (click)="closed.emit()" aria-label="ปิดหน้าต่าง">✕</button>
        </div>
        <h2 class="title" *ngIf="detail">{{ detail.ticket.title || '(ไม่มีหัวข้อ)' }}</h2>
      </header>

      <div class="body">
        <div class="state" *ngIf="loading">กำลังโหลดรายละเอียด…</div>
        <div class="state err" *ngIf="error">
          โหลดรายละเอียดไม่ได้
          <button class="retry" (click)="retry()">ลองใหม่</button>
        </div>

        <ng-container *ngIf="detail && !loading">
          <!-- ── รายละเอียดตั๋วจากชีต ── -->
          <section>
            <div class="section-label">รายละเอียดตั๋ว</div>
            <dl class="fields">
              <div><dt>บริษัท</dt><dd>{{ detail.ticket.company || '—' }}</dd></div>
              <div><dt>แผนก</dt><dd>{{ detail.ticket.department || '—' }}</dd></div>
              <div><dt>ผู้แจ้งปัญหา</dt><dd>{{ detail.ticket.requesterName || '—' }}</dd></div>
              <div><dt>อีเมล</dt><dd>{{ detail.ticket.requesterEmail || '—' }}</dd></div>
              <div><dt>ประเภท</dt><dd>{{ detail.ticket.ticketType || '—' }}</dd></div>
              <div><dt>ความเร่งด่วน</dt><dd>{{ detail.ticket.urgency || '—' }}</dd></div>
              <div><dt>ผลอนุมัติ</dt><dd>{{ detail.ticket.finalStatus || '—' }}</dd></div>
              <div><dt>สถานะในชีต</dt><dd>{{ detail.ticket.sheetStatus || '—' }}</dd></div>
              <div><dt>ผู้รับเรื่อง</dt><dd>{{ detail.ticket.staffPro || '—' }}</dd></div>
              <div><dt>แจ้งเมื่อ</dt><dd>{{ detail.ticket.createdAtSheet | date: 'd MMM yyyy' }}</dd></div>
            </dl>
            <p class="desc" *ngIf="detail.ticket.description">{{ detail.ticket.description }}</p>
          </section>

          <!-- ── การ์ด Jira ที่เชื่อม ── -->
          <section>
            <div class="section-label">
              การ์ด Jira <span class="count num">{{ detail.issues.length }}</span>
            </div>

            <div class="empty-card" *ngIf="detail.issues.length === 0">
              ยังไม่พบการ์ด Jira สำหรับตั๋วนี้
            </div>

            <article class="jcard" *ngFor="let iss of detail.issues">
              <div class="jhead">
                <a class="jkey mono" [href]="iss.url" target="_blank" rel="noopener">{{ iss.jiraKey }} ↗</a>
                <span class="mby" [class.manual]="iss.matchedBy === 'manual'">
                  {{ iss.matchedBy === 'manual' ? 'เชื่อมเอง' : 'จับคู่อัตโนมัติ' }}
                </span>
                <button class="unlink" (click)="unlink(iss)" title="ยกเลิกการเชื่อมการ์ดนี้">ยกเลิกการเชื่อม</button>
              </div>

              <!-- full Stage Strip: อยู่สเตจไหน ใครถือ ค้างกี่วัน -->
              <app-stage-strip mode="full" [status]="iss.status" [days]="currentStageDays(iss)"></app-stage-strip>
              <app-followup-badge class="fb-slot" [followup]="detail.followup" [status]="iss.status"></app-followup-badge>

              <div class="jmeta">
                <span *ngIf="iss.assignee">ผู้รับผิดชอบ: <b>{{ iss.assignee }}</b></span>
                <span *ngIf="!iss.assignee" class="muted">ยังไม่มีผู้รับผิดชอบ</span>
              </div>
              <div class="jsummary" *ngIf="iss.summary">{{ iss.summary }}</div>

              <!-- history timeline with time-in-stage -->
              <div class="tl-label" *ngIf="iss.timeline.length">ประวัติการเปลี่ยนสเตจ</div>
              <div class="timeline" *ngIf="iss.timeline.length">
                <div class="tl-step" *ngFor="let s of iss.timeline; let idx = index">
                  <span class="dot" [style.background]="dotColor(s.toStatus)"></span>
                  <div class="tl-body">
                    <div class="tl-status">{{ stageLabel(s.toStatus) }}</div>
                    <div class="tl-when num">
                      {{ s.changedAt | date: 'd MMM yyyy, HH:mm' }}
                      <span class="dur">· อยู่ {{ stageDuration(iss.timeline, idx) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="no-tl" *ngIf="!iss.timeline.length">ยังไม่มีประวัติการเปลี่ยนสเตจ</div>
            </article>

            <!-- manual link -->
            <div class="linker">
              <input type="text" placeholder="ใส่เลขการ์ด เช่น SE-123" [(ngModel)]="linkKey" (keyup.enter)="link()" />
              <button (click)="link()" [disabled]="!linkKey.trim() || linking">เชื่อมการ์ด</button>
            </div>
            <div class="link-err" *ngIf="linkError">{{ linkError }}</div>
          </section>
        </ng-container>
      </div>
    </aside>
  `,
  styles: [
    `
      .scrim { position: fixed; inset: 0; background: rgba(5, 8, 14, 0.55); backdrop-filter: blur(2px); opacity: 0; pointer-events: none; transition: opacity 0.2s ease; z-index: 40; }
      .scrim.show { opacity: 1; pointer-events: auto; }
      .drawer { position: fixed; top: 0; right: 0; height: 100dvh; width: min(580px, 100vw); background: var(--panel); border-left: 1px solid var(--line); transform: translateX(100%); transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1); z-index: 50; display: flex; flex-direction: column; }
      .drawer.show { transform: translateX(0); }
      @media (prefers-reduced-motion: reduce) { .drawer, .scrim { transition: none; } }

      .head { padding: 20px 24px 16px; border-bottom: 1px solid var(--line); }
      .head-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .key { font-weight: 700; font-size: 15px; color: var(--text); }
      .x { background: transparent; border: 1px solid var(--line); color: var(--muted); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 14px; }
      .x:hover { color: var(--text); border-color: var(--muted); }
      .x:focus-visible { outline: 2px solid var(--brand); }
      .title { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 18px; line-height: 1.45; }

      .body { flex: 1; overflow-y: auto; padding: 20px 24px 34px; }
      section { margin-bottom: 28px; }
      .section-label { display: flex; align-items: center; gap: 9px; font-size: 12.5px; font-weight: 600; color: var(--muted); margin-bottom: 15px; }
      .count { background: var(--panel-2); border: 1px solid var(--line); border-radius: 99px; padding: 1px 9px; color: var(--text); font-size: 12px; }

      .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 13px 18px; margin: 0; }
      .fields dt { font-size: 12px; color: var(--muted-2); margin-bottom: 3px; }
      .fields dd { margin: 0; font-size: 15px; color: var(--text); word-break: break-word; line-height: 1.6; }
      .desc { margin: 16px 0 0; padding: 13px 15px; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--radius-sm); font-size: 14.5px; line-height: 1.75; white-space: pre-wrap; word-break: break-word; }

      .empty-card { color: var(--muted-2); font-size: 14.5px; padding: 10px 0; }
      .jcard { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 15px 16px; margin-bottom: 13px; }
      .jhead { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
      .jkey { font-weight: 700; font-size: 14px; color: var(--brand); text-decoration: none; }
      .jkey:hover { text-decoration: underline; }
      .mby { font-size: 11px; color: var(--muted-2); border: 1px solid var(--line); border-radius: 6px; padding: 2px 7px; }
      .mby.manual { color: var(--brand); border-color: color-mix(in srgb, var(--brand) 50%, var(--line)); }
      .unlink { margin-left: auto; background: transparent; border: 1px solid var(--line); color: var(--muted); border-radius: var(--radius-xs); cursor: pointer; font-size: 12px; padding: 4px 10px; font-family: var(--font-body); }
      .unlink:hover { color: var(--st-rework); border-color: var(--st-rework); }

      .fb-slot { display: block; margin-top: 8px; }
      .fb-slot:empty { display: none; }
      .jmeta { font-size: 14px; color: var(--muted); margin: 13px 0 6px; }
      .jmeta b { color: var(--text); font-weight: 600; }
      .jmeta .muted { color: var(--muted-2); }
      .jsummary { font-size: 14px; line-height: 1.6; color: var(--text); }

      .tl-label { font-size: 12px; color: var(--muted-2); margin: 16px 0 10px; }
      .timeline { padding-left: 4px; }
      .tl-step { display: flex; gap: 12px; position: relative; padding-bottom: 14px; }
      .tl-step:not(:last-child)::before { content: ''; position: absolute; left: 4px; top: 13px; bottom: 0; width: 1px; background: var(--line); }
      .dot { width: 9px; height: 9px; border-radius: 99px; margin-top: 4px; flex: 0 0 9px; z-index: 1; }
      .tl-status { font-size: 14px; font-weight: 600; }
      .tl-when { font-size: 12px; color: var(--muted-2); margin-top: 2px; }
      .dur { color: var(--muted); }
      .no-tl { font-size: 13.5px; color: var(--muted-2); margin-top: 10px; }

      .linker { display: flex; gap: 9px; margin-top: 14px; }
      .linker input { flex: 1; background: var(--panel); border: 1px solid var(--line); color: var(--text); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 14px; font-family: var(--font-mono); }
      .linker input:focus { outline: 2px solid color-mix(in srgb, var(--brand) 55%, transparent); border-color: var(--brand); }
      .linker button { background: color-mix(in srgb, var(--brand) 20%, var(--panel)); border: 1px solid var(--brand); color: var(--text); border-radius: var(--radius-sm); padding: 9px 18px; font-size: 14px; cursor: pointer; font-family: var(--font-body); }
      .linker button:disabled { opacity: 0.4; cursor: not-allowed; }
      .link-err { color: var(--st-rework); font-size: 13px; margin-top: 9px; }

      .state { color: var(--muted); font-size: 14.5px; padding: 34px 0; text-align: center; display: flex; flex-direction: column; gap: 12px; align-items: center; }
      .state.err { color: var(--st-rework); }
      .retry { background: var(--panel); border: 1px solid var(--line); color: var(--text); border-radius: var(--radius-sm); padding: 7px 15px; font-size: 14px; cursor: pointer; font-family: var(--font-body); }

      @media (max-width: 580px) { .drawer { width: 100vw; } .fields { grid-template-columns: 1fr; } }
    `,
  ],
})
export class TicketDrawerComponent implements OnChanges {
  @Input() ticketNumber: string | null = null;
  @Output() closed = new EventEmitter<void>();

  detail: TicketDetail | null = null;
  loading = false;
  error = false;

  linkKey = '';
  linking = false;
  linkError = '';

  constructor(private service: TicketsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ticketNumber'] && this.ticketNumber) {
      this.fetch(this.ticketNumber);
    }
  }

  private fetch(tn: string): void {
    this.loading = true;
    this.error = false;
    this.detail = null;
    this.linkKey = '';
    this.linkError = '';
    this.service.detail(tn).subscribe({
      next: (d) => {
        this.detail = d;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  retry(): void {
    if (this.ticketNumber) this.fetch(this.ticketNumber);
  }

  stageLabel(status: string | null): string {
    return stageMeta(status).label;
  }
  dotColor(status: string | null): string {
    return stageMeta(status).color;
  }

  /** วันที่ค้างในสเตจปัจจุบัน = ครั้งล่าสุดที่เข้าสถานะเดียวกับ status ปัจจุบัน → ตอนนี้ */
  currentStageDays(iss: LinkedIssue): number | null {
    const cur = (iss.status ?? '').trim().toLowerCase();
    if (!cur || !iss.timeline.length) return null;
    let since: string | null = null;
    for (const s of iss.timeline) {
      if ((s.toStatus ?? '').trim().toLowerCase() === cur && s.changedAt) since = s.changedAt;
    }
    if (!since) return null;
    return Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
  }

  link(): void {
    const key = this.linkKey.trim().toUpperCase();
    if (!key || !this.ticketNumber) return;
    this.linking = true;
    this.linkError = '';
    this.service.addLink(this.ticketNumber, key).subscribe({
      next: () => {
        this.linking = false;
        this.linkKey = '';
        if (this.ticketNumber) this.fetch(this.ticketNumber);
      },
      error: (e) => {
        this.linking = false;
        this.linkError = e?.error?.message || `เชื่อมการ์ด ${key} ไม่สำเร็จ — การ์ดนี้ถูกดึงเข้าระบบแล้วหรือยัง?`;
      },
    });
  }

  unlink(iss: LinkedIssue): void {
    if (!this.ticketNumber) return;
    this.service.removeLink(this.ticketNumber, iss.jiraKey).subscribe({
      next: () => {
        if (this.ticketNumber) this.fetch(this.ticketNumber);
      },
    });
  }

  stageDuration(timeline: { changedAt: string | null }[], idx: number): string {
    const cur = timeline[idx]?.changedAt;
    if (!cur) return '';
    const start = new Date(cur).getTime();
    const next = timeline[idx + 1]?.changedAt;
    const end = next ? new Date(next).getTime() : Date.now();
    const ms = end - start;
    if (ms < 0) return '';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins} นาที`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชม.`;
    return `${Math.floor(hrs / 24)} วัน`;
  }
}
