import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Issue } from '../models';

@Component({
  selector: 'app-issue-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article
      class="card"
      [attr.data-due]="issue.dueStatus"
      tabindex="0"
      (click)="open.emit(issue)"
      (keydown.enter)="open.emit(issue)"
      (keydown.space)="$event.preventDefault(); open.emit(issue)"
    >
      <!-- signature: urgency rail -->
      <div class="rail">
        <span class="rail-num">{{ railNumber }}</span>
        <span class="rail-unit">{{ railUnit }}</span>
      </div>

      <div class="body">
        <div class="top">
          <span class="key">{{ issue.key }}</span>
          <span class="type" *ngIf="issue.issueType">{{ issue.issueType }}</span>
          <span class="spacer"></span>
          <span class="due-tag">{{ dueLabel }}</span>
        </div>

        <h3 class="summary">{{ issue.summary }}</h3>

        <div class="meta">
          <span class="status" *ngIf="issue.status">{{ issue.status }}</span>
          <span class="dot" *ngIf="issue.projectName">·</span>
          <span class="project" *ngIf="issue.projectName">{{ issue.projectName }}</span>
          <span class="dot" *ngIf="issue.assigneeName">·</span>
          <span class="assignee" *ngIf="issue.assigneeName">{{ issue.assigneeName }}</span>
        </div>

        <div class="foot">
          <div class="labels" *ngIf="issue.labels?.length">
            <span class="label" *ngFor="let l of issue.labels">{{ l }}</span>
          </div>
          <span class="spacer"></span>
          <button class="comments" type="button" (click)="$event.stopPropagation(); open.emit(issue)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {{ issue.commentCount }}
          </button>
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      .card {
        position: relative;
        display: flex;
        gap: 0;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease;
        outline: none;
      }
      .card:hover,
      .card:focus-visible {
        transform: translateY(-2px);
        border-color: var(--c);
        background: var(--panel-2);
      }
      .card:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 55%, transparent); }

      /* urgency color per state */
      .card[data-due='overdue']   { --c: var(--overdue); }
      .card[data-due='due_today'] { --c: var(--today); }
      .card[data-due='due_soon']  { --c: var(--soon); }
      .card[data-due='upcoming']  { --c: var(--upcoming); }
      .card[data-due='none']      { --c: var(--muted-2); }

      .rail {
        flex: 0 0 64px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        background: color-mix(in srgb, var(--c) 14%, transparent);
        border-right: 2px solid var(--c);
      }
      .rail-num {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 22px;
        line-height: 1;
        color: var(--c);
      }
      .rail-unit {
        font-size: 9px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--c) 75%, var(--muted));
      }

      .body { flex: 1; min-width: 0; padding: 13px 15px; }

      .top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .key {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 12px;
        color: var(--brand);
        letter-spacing: 0.02em;
      }
      .type {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
        border: 1px solid var(--line);
        border-radius: 99px;
        padding: 1px 7px;
      }
      .spacer { flex: 1; }
      .due-tag {
        font-family: var(--font-mono);
        font-size: 10.5px;
        font-weight: 500;
        color: var(--c);
        white-space: nowrap;
      }

      .summary {
        margin: 0 0 8px;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 15px;
        line-height: 1.35;
        color: var(--text);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 10px;
      }
      .status { color: var(--text); font-weight: 500; }
      .dot { color: var(--muted-2); }

      .foot { display: flex; align-items: center; gap: 8px; }
      .labels { display: flex; flex-wrap: wrap; gap: 5px; min-width: 0; }
      .label {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--muted);
        background: var(--panel-2);
        border: 1px solid var(--line);
        border-radius: 5px;
        padding: 1px 6px;
      }
      .card:hover .label { background: var(--panel); }

      .comments {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--muted);
        background: transparent;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 4px 9px;
        cursor: pointer;
        transition: color 0.12s, border-color 0.12s;
      }
      .comments:hover { color: var(--brand); border-color: var(--brand); }
    `,
  ],
})
export class IssueCardComponent {
  @Input({ required: true }) issue!: Issue;
  @Output() open = new EventEmitter<Issue>();

  get railNumber(): string {
    const d = this.issue.daysUntilDue;
    if (d === null) return '–';
    return String(Math.abs(d));
  }

  get railUnit(): string {
    const d = this.issue.daysUntilDue;
    if (d === null) return '—';
    if (d === 0) return 'today';
    return 'days';
  }

  get dueLabel(): string {
    const d = this.issue.daysUntilDue;
    if (d === null || !this.issue.dueDate) return 'ไม่มีกำหนด';
    const date = this.issue.dueDate;
    if (d < 0) return `เลยกำหนด ${Math.abs(d)} วัน · ${date}`;
    if (d === 0) return `ครบกำหนดวันนี้ · ${date}`;
    return `อีก ${d} วัน · ${date}`;
  }
}
