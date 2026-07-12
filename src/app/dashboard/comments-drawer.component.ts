import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Comment, Issue } from '../models';
import { IssuesService } from '../issues.service';

@Component({
  selector: 'app-comments-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scrim" [class.show]="!!issue" (click)="close.emit()"></div>

    <aside class="drawer" [class.show]="!!issue" *ngIf="issue">
      <header class="head">
        <div class="head-top">
          <a class="key" [href]="issue.url || '#'" target="_blank" rel="noopener">{{ issue.key }} ↗</a>
          <button class="x" type="button" (click)="close.emit()" aria-label="ปิด">✕</button>
        </div>
        <h2 class="title">{{ issue.summary }}</h2>
        <div class="tags">
          <span class="pill" [attr.data-due]="issue.dueStatus">{{ dueLabel }}</span>
          <span class="pill ghost" *ngIf="issue.status">{{ issue.status }}</span>
          <span class="pill ghost" *ngIf="issue.assigneeName">{{ issue.assigneeName }}</span>
        </div>
      </header>

      <section class="comments">
        <div class="section-label">
          ความคิดเห็น
          <span class="count" *ngIf="!loading">{{ comments.length }}</span>
        </div>

        <div class="state" *ngIf="loading">กำลังโหลดความคิดเห็น…</div>
        <div class="state" *ngIf="error">โหลดความคิดเห็นไม่สำเร็จ — ลองรีเฟรชอีกครั้ง</div>
        <div class="state empty" *ngIf="!loading && !error && comments.length === 0">
          ยังไม่มีความคิดเห็นในงานนี้
        </div>

        <div class="thread" *ngIf="!loading && !error">
          <article class="comment" *ngFor="let c of comments">
            <div class="c-head">
              <span class="avatar">{{ initials(c.authorName) }}</span>
              <span class="author">{{ c.authorName || 'ไม่ทราบชื่อ' }}</span>
              <span class="when">{{ c.created | date: 'd MMM yyyy, HH:mm' }}</span>
            </div>
            <p class="c-body">{{ c.body }}</p>
          </article>
        </div>
      </section>
    </aside>
  `,
  styles: [
    `
      .scrim {
        position: fixed;
        inset: 0;
        background: rgba(5, 8, 14, 0.55);
        backdrop-filter: blur(2px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        z-index: 40;
      }
      .scrim.show { opacity: 1; pointer-events: auto; }

      .drawer {
        position: fixed;
        top: 0;
        right: 0;
        height: 100dvh;
        width: min(460px, 100vw);
        background: var(--panel);
        border-left: 1px solid var(--line);
        transform: translateX(100%);
        transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
        z-index: 50;
        display: flex;
        flex-direction: column;
      }
      .drawer.show { transform: translateX(0); }

      .head { padding: 20px 22px 16px; border-bottom: 1px solid var(--line); }
      .head-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .key {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 13px;
        color: var(--brand);
        text-decoration: none;
      }
      .key:hover { text-decoration: underline; }
      .x {
        background: transparent;
        border: 1px solid var(--line);
        color: var(--muted);
        width: 30px;
        height: 30px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
      }
      .x:hover { color: var(--text); border-color: var(--muted); }

      .title {
        margin: 0 0 12px;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 18px;
        line-height: 1.35;
      }
      .tags { display: flex; flex-wrap: wrap; gap: 6px; }
      .pill {
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 3px 9px;
        border-radius: 99px;
        border: 1px solid var(--c, var(--line));
        color: var(--c, var(--muted));
        background: color-mix(in srgb, var(--c, var(--line)) 12%, transparent);
      }
      .pill[data-due='overdue']   { --c: var(--overdue); }
      .pill[data-due='due_today'] { --c: var(--today); }
      .pill[data-due='due_soon']  { --c: var(--soon); }
      .pill[data-due='upcoming']  { --c: var(--upcoming); }
      .pill.ghost { --c: var(--muted); color: var(--muted); background: transparent; }

      .comments { flex: 1; overflow-y: auto; padding: 18px 22px 28px; }
      .section-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 16px;
      }
      .count {
        font-family: var(--font-mono);
        background: var(--panel-2);
        border: 1px solid var(--line);
        border-radius: 99px;
        padding: 1px 8px;
        color: var(--text);
      }

      .state { color: var(--muted); font-size: 13px; padding: 24px 0; text-align: center; }
      .state.empty { color: var(--muted-2); }

      .thread { display: flex; flex-direction: column; gap: 14px; }
      .comment {
        background: var(--panel-2);
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        padding: 12px 14px;
      }
      .c-head { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }
      .avatar {
        width: 26px;
        height: 26px;
        border-radius: 99px;
        background: color-mix(in srgb, var(--brand) 22%, var(--panel));
        color: var(--brand);
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 700;
        display: grid;
        place-items: center;
        flex: 0 0 26px;
      }
      .author { font-weight: 600; font-size: 13px; }
      .when { margin-left: auto; font-family: var(--font-mono); font-size: 11px; color: var(--muted-2); }
      .c-body {
        margin: 0;
        font-size: 13.5px;
        line-height: 1.6;
        color: var(--text);
        white-space: pre-wrap;
        word-break: break-word;
      }

      @media (max-width: 520px) {
        .drawer { width: 100vw; }
      }
    `,
  ],
})
export class CommentsDrawerComponent implements OnChanges {
  @Input() issue: Issue | null = null;
  @Output() close = new EventEmitter<void>();

  comments: Comment[] = [];
  loading = false;
  error = false;

  constructor(private service: IssuesService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['issue'] && this.issue) {
      this.fetch(this.issue.key);
    }
  }

  private fetch(key: string): void {
    this.loading = true;
    this.error = false;
    this.comments = [];
    this.service.comments(key).subscribe({
      next: (c) => {
        this.comments = c;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  initials(name: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
  }

  get dueLabel(): string {
    const i = this.issue;
    if (!i || i.daysUntilDue === null || !i.dueDate) return 'ไม่มีกำหนด';
    const d = i.daysUntilDue;
    if (d < 0) return `เลยกำหนด ${Math.abs(d)} วัน`;
    if (d === 0) return 'ครบกำหนดวันนี้';
    return `อีก ${d} วัน`;
  }
}
