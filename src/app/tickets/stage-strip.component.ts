import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { STAGE_ORDER, StageMeta, stageMeta } from './status-chip';

type SegState = 'passed' | 'current' | 'future';

/**
 * Stage Strip — signature component (design brief §5)
 * แถบ workflow คงที่: สเตจที่ผ่านเติมจาง, สเตจปัจจุบันติดสีตามกลุ่ม + ป้ายไทย + เวลาที่ค้าง
 *   mode="micro" → ใช้ในแถวตาราง / การ์ด workload
 *   mode="full"  → ใช้ใน drawer (ป้ายใหญ่ขึ้น)
 * สีเดี่ยว ๆ ไม่เคยสื่อความหมาย — มีป้ายไทยเสมอ (zero-thought + color-blind safe)
 */
@Component({
  selector: 'app-stage-strip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="strip" [class.full]="mode === 'full'">
      <div class="bar" [attr.aria-label]="meta.label">
        <span
          class="seg"
          *ngFor="let s of segments; let i = index"
          [attr.data-state]="s"
          [style.--sc]="i === meta.index ? meta.color : null"
        ></span>
      </div>
      <div class="label" *ngIf="showLabel">
        <span class="dot" [style.background]="meta.color"></span>
        <span class="txt" [class.fail]="meta.isFail">{{ meta.label }}</span>
        <span class="days" *ngIf="days != null">· ค้าง {{ days }} วัน</span>
      </div>
    </div>
  `,
  styles: [
    `
      .strip { display: flex; flex-direction: column; gap: 5px; min-width: 96px; }
      .bar { display: flex; gap: 2px; align-items: center; }
      .seg {
        flex: 1; height: 5px; border-radius: 2px; background: var(--line);
      }
      .seg[data-state='passed'] { background: color-mix(in srgb, var(--st-neutral) 55%, transparent); }
      .seg[data-state='future'] { background: color-mix(in srgb, var(--line) 70%, transparent); }
      .seg[data-state='current'] {
        background: var(--sc, var(--st-neutral));
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--sc, var(--st-neutral)) 55%, transparent);
      }
      .full .seg { height: 8px; border-radius: 3px; }

      .label { display: flex; align-items: baseline; gap: 6px; line-height: 1.3; }
      .dot { width: 8px; height: 8px; border-radius: 99px; flex: 0 0 8px; transform: translateY(1px); }
      .txt { font-size: 12.5px; font-weight: 600; color: var(--text); }
      .txt.fail { color: var(--st-rework); }
      .days { font-family: var(--font-mono); font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
      .full .txt { font-size: 15px; }
      .full .dot { width: 10px; height: 10px; flex-basis: 10px; }
      .full .days { font-size: 13px; }
    `,
  ],
})
export class StageStripComponent {
  @Input() status: string | null = null;
  @Input() days: number | null = null;
  @Input() mode: 'micro' | 'full' = 'micro';
  @Input() showLabel = true;

  get meta(): StageMeta {
    return stageMeta(this.status);
  }

  get segments(): SegState[] {
    const cur = this.meta.index;
    return STAGE_ORDER.map((_, i) => {
      if (cur < 0) return 'future'; // นอกลำดับ (เช่นสถานะแปลก) → ปล่อยจาง
      if (i < cur) return 'passed';
      if (i === cur) return 'current';
      return 'future';
    });
  }
}
