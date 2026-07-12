import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Issue, Summary } from '../models';
import { IssuesService } from '../issues.service';
import { IssueCardComponent } from './issue-card.component';
import { CommentsDrawerComponent } from './comments-drawer.component';

interface Group {
  key: 'overdue' | 'due_today' | 'due_soon' | 'upcoming';
  label: string;
  hint: string;
  issues: Issue[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, IssueCardComponent, CommentsDrawerComponent],
  template: `
    <header class="masthead">
      <div class="brand">
        <span class="brand-mark">▚</span>
        <div>
          <h1>Due Board</h1>
          <p class="sub">งานที่เลยกำหนดและใกล้ครบกำหนด · ดึงจาก Jira</p>
        </div>
      </div>

      <!-- triage strip: count chips = สาระหลัก -->
      <div class="triage" *ngIf="summary">
        <button class="chip overdue" [class.active]="filter === 'overdue'" (click)="toggle('overdue')">
          <span class="n">{{ summary.overdue }}</span><span class="t">เลยกำหนด</span>
        </button>
        <button class="chip today" [class.active]="filter === 'due_today'" (click)="toggle('due_today')">
          <span class="n">{{ summary.dueToday }}</span><span class="t">วันนี้</span>
        </button>
        <button class="chip soon" [class.active]="filter === 'due_soon'" (click)="toggle('due_soon')">
          <span class="n">{{ summary.dueSoon }}</span><span class="t">ใกล้ครบ</span>
        </button>
        <button class="chip upcoming" [class.active]="filter === 'upcoming'" (click)="toggle('upcoming')">
          <span class="n">{{ summary.upcoming }}</span><span class="t">กำลังจะถึง</span>
        </button>
      </div>
    </header>

    <main class="page">
      <div class="state" *ngIf="loading">กำลังดึงข้อมูลจาก Postgres…</div>
      <div class="state err" *ngIf="error">
        เชื่อมต่อ API ไม่ได้ — ตรวจว่า backend รันอยู่ที่ port 3000 และ CORS ตั้งถูก
      </div>

      <div class="state empty" *ngIf="!loading && !error && total === 0">
        ไม่มีงานที่มีกำหนดส่งค้างอยู่ — เคลียร์หมดแล้ว
      </div>

      <ng-container *ngIf="!loading && !error">
        <section class="group" *ngFor="let g of visibleGroups">
          <div class="group-head" [attr.data-due]="g.key">
            <span class="g-bar"></span>
            <h2>{{ g.label }}</h2>
            <span class="g-count">{{ g.issues.length }}</span>
            <span class="g-hint">{{ g.hint }}</span>
          </div>
          <div class="grid">
            <app-issue-card
              *ngFor="let i of g.issues"
              [issue]="i"
              (open)="selected = $event"
            ></app-issue-card>
          </div>
        </section>
      </ng-container>
    </main>

    <app-comments-drawer [issue]="selected" (close)="selected = null"></app-comments-drawer>
  `,
  styles: [
    `
      .masthead {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
        max-width: 1180px;
        margin: 0 auto;
        padding: 36px 28px 22px;
      }
      .brand { display: flex; align-items: center; gap: 14px; }
      .brand-mark {
        font-size: 30px;
        color: var(--brand);
        line-height: 1;
        transform: translateY(2px);
      }
      h1 {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 26px;
        letter-spacing: -0.01em;
      }
      .sub { margin: 3px 0 0; color: var(--muted); font-size: 13px; }

      .triage { display: flex; gap: 10px; flex-wrap: wrap; }
      .chip {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        min-width: 78px;
        padding: 9px 14px;
        border-radius: var(--radius-sm);
        background: var(--panel);
        border: 1px solid var(--line);
        cursor: pointer;
        transition: transform 0.12s, border-color 0.12s, background 0.12s;
      }
      .chip:hover { transform: translateY(-2px); }
      .chip .n {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 22px;
        line-height: 1;
        color: var(--cc);
      }
      .chip .t { font-size: 11px; color: var(--muted); }
      .chip.overdue  { --cc: var(--overdue); }
      .chip.today    { --cc: var(--today); }
      .chip.soon     { --cc: var(--soon); }
      .chip.upcoming { --cc: var(--upcoming); }
      .chip.active { border-color: var(--cc); background: color-mix(in srgb, var(--cc) 12%, var(--panel)); }

      .page { max-width: 1180px; margin: 0 auto; padding: 8px 28px 80px; }

      .state { text-align: center; color: var(--muted); padding: 60px 0; font-size: 14px; }
      .state.err { color: var(--overdue); }
      .state.empty { color: var(--upcoming); }

      .group { margin-top: 30px; }
      .group-head {
        display: flex;
        align-items: center;
        gap: 11px;
        margin-bottom: 14px;
      }
      .g-bar { width: 3px; height: 18px; border-radius: 2px; background: var(--gc); }
      .group-head h2 {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 14px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text);
      }
      .g-count {
        font-family: var(--font-mono);
        font-size: 12px;
        font-weight: 700;
        color: var(--gc);
        background: color-mix(in srgb, var(--gc) 14%, transparent);
        border-radius: 99px;
        padding: 1px 9px;
      }
      .g-hint { font-size: 11.5px; color: var(--muted-2); margin-left: 4px; }
      .group-head[data-due='overdue']   { --gc: var(--overdue); }
      .group-head[data-due='due_today'] { --gc: var(--today); }
      .group-head[data-due='due_soon']  { --gc: var(--soon); }
      .group-head[data-due='upcoming']  { --gc: var(--upcoming); }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: 14px;
      }

      @media (max-width: 620px) {
        .masthead { padding: 26px 18px 18px; }
        .page { padding: 8px 18px 60px; }
        .grid { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  issues: Issue[] = [];
  summary: Summary | null = null;
  selected: Issue | null = null;

  loading = true;
  error = false;
  filter: Group['key'] | null = null;

  private readonly groupMeta: Omit<Group, 'issues'>[] = [
    { key: 'overdue', label: 'เลยกำหนด', hint: 'จัดการก่อนเป็นอันดับแรก' },
    { key: 'due_today', label: 'ครบกำหนดวันนี้', hint: '' },
    { key: 'due_soon', label: 'ใกล้ครบกำหนด', hint: 'ภายในไม่กี่วัน' },
    { key: 'upcoming', label: 'กำลังจะถึง', hint: '' },
  ];

  constructor(private service: IssuesService) {}

  ngOnInit(): void {
    this.service.summary().subscribe({ next: (s) => (this.summary = s) });
    this.service.list().subscribe({
      next: (list) => {
        this.issues = list;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  get total(): number {
    return this.issues.length;
  }

  get groups(): Group[] {
    return this.groupMeta
      .map((m) => ({ ...m, issues: this.issues.filter((i) => i.dueStatus === m.key) }))
      .filter((g) => g.issues.length > 0);
  }

  get visibleGroups(): Group[] {
    if (!this.filter) return this.groups;
    return this.groups.filter((g) => g.key === this.filter);
  }

  toggle(key: Group['key']): void {
    this.filter = this.filter === key ? null : key;
  }
}
