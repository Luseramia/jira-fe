import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { UatFollowup } from '../models';
import { categoryOf } from './status-chip';

/**
 * Badge ติดตามเมล UAT — "✉ ส่งเมลแล้ว X วัน" (สี rework เมื่อ overdue)
 * แสดงเฉพาะเมื่อมีแถว follow-up ค้าง และ status ปัจจุบันเป็นกลุ่ม waiting_user
 * (เช็คซ้ำด้วย categoryOf กัน badge โผล่ตอนการ์ดถูกเลื่อนสเตจไปแล้วแต่แถวยังค้าง)
 */
@Component({
  selector: 'app-followup-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="fb" *ngIf="show" [class.over]="f!.overdue" [title]="tooltip">
      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="2"></rect>
        <path d="m22 7-10 6L2 7"></path>
      </svg>
      ส่งเมลแล้ว <span class="num">{{ f!.daysWaiting }}</span> วัน
    </span>
  `,
  styles: [
    `
      .fb {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 11.5px; font-weight: 600; font-family: var(--font-body);
        padding: 2px 8px; border-radius: 99px; white-space: nowrap;
        color: var(--st-user);
        background: color-mix(in srgb, var(--st-user) 16%, transparent);
        border: 1px solid color-mix(in srgb, var(--st-user) 32%, transparent);
      }
      .fb.over {
        color: var(--st-rework);
        background: color-mix(in srgb, var(--st-rework) 16%, transparent);
        border-color: color-mix(in srgb, var(--st-rework) 45%, transparent);
      }
      .ic { width: 12px; height: 12px; flex: 0 0 12px; }
      .fb .num { font-variant-numeric: tabular-nums; }
    `,
  ],
})
export class FollowupBadgeComponent {
  @Input() followup: UatFollowup | null | undefined = null;
  /** status ปัจจุบันของการ์ด — กัน badge โผล่ตอนการ์ดไม่ได้อยู่ waiting_user แล้ว */
  @Input() status: string | null = null;

  get f() {
    return this.followup;
  }

  get show(): boolean {
    if (!this.f) return false;
    return categoryOf(this.status) === 'waiting_user';
  }

  get tooltip(): string {
    if (!this.f) return '';
    const sent = this.f.sentAt ? new Date(this.f.sentAt).toLocaleDateString('th-TH') : '—';
    const dl = this.f.deadlineDate
      ? ` · กำหนดตอบ ${new Date(this.f.deadlineDate).toLocaleDateString('th-TH')}`
      : '';
    const od = this.f.overdue ? ' · เกินกำหนดเตือนแล้ว' : '';
    return `ส่งเมล${this.f.stage === 'smoke test' ? ' (smoke test)' : ''} ${sent}${dl}${od}`;
  }
}
