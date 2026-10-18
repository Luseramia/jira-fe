import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { MailSummary, TicketListResponse, UatFollowup } from '../models';
import { TicketsService } from '../tickets.service';
import { TicketDrawerComponent } from '../tickets/ticket-drawer.component';

@Component({
  selector: 'app-mail-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, TicketDrawerComponent],
  template: `
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="m4 7 8 6 8-6"></path>
          </svg>
          เมล UAT / Smoke Test
        </div>
        <h1 class="fx-text">Track Mail</h1>

      </div>

      <div class="metrics" aria-label="สรุปเมลที่รอคำตอบ">
        <div class="metric metric-waiting fx-lift">
          <span class="metric-label">รอการตอบกลับ</span>
          <span class="metric-value"><b [class.ready-number]="summary?.waiting != null || data?.total != null">{{ summary?.waiting ?? data?.total ?? '—' }}</b><small>ticket</small></span>
        </div>
        <div class="metric metric-overdue fx-lift">
          <span class="metric-label"><span class="dot"></span>เกินกำหนด</span>
          <span class="metric-value"><b [class.ready-number]="summary?.overdue != null">{{ summary?.overdue ?? '—' }}</b><small>ticket</small></span>
        </div>
        <div class="metric metric-longest fx-lift">
          <span class="metric-label">สูงสุด</span>
          <span class="metric-value"><b [class.ready-number]="summary?.longestDays != null || data?.rows?.[0]?.followup?.daysWaiting != null">{{ summary?.longestDays ?? data?.rows?.[0]?.followup?.daysWaiting ?? '—' }}</b><small>วัน</small></span>
        </div>
      </div>
    </section>

    <main class="page">
      <section class="list-panel" aria-label="รายการเมลที่รอคำตอบ">
        <div class="toolbar">
          <label class="searchbox">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
              <circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>
            </svg>
            <span class="sr-only">ค้นหาด้วยเลข ticket หรือหัวข้อ</span>
            <input type="search" [(ngModel)]="q" (ngModelChange)="search()" placeholder="ค้นหาเลข ticket หรือหัวข้อ…" />
          </label>
          <button class="refresh" type="button" (click)="refresh()" [disabled]="loading">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"></path>
            </svg>
            รีเฟรช
          </button>
          <div class="legend" aria-label="สีของสถานะ">
            <span><i class="swatch overdue"></i>เกินกำหนด</span>
            <span><i class="swatch soon"></i>ใกล้ครบกำหนด</span>
            <span><i class="swatch normal"></i>ยังอยู่ในกำหนด</span>
          </div>
        </div>

        <div class="state" *ngIf="loading">กำลังโหลดเมลที่รอคำตอบ…</div>
        <div class="state error" *ngIf="!loading && error">
          โหลดข้อมูลติดตามเมลไม่ได้
          <button type="button" (click)="refresh()">ลองใหม่</button>
        </div>
        <div class="state" *ngIf="!loading && !error && data?.total === 0">
          {{ q ? 'ไม่พบ ticket ที่ตรงกับคำค้นหา' : 'ไม่มีเมล UAT / Smoke Test ที่รอคำตอบ' }}
        </div>

        <div class="table-scroll" *ngIf="!loading && !error && data && data.rows.length">
          <table>
            <thead>
              <tr>
                <th scope="col">Ticket</th>
                <th scope="col">หัวข้อ · ผู้แจ้ง</th>
                <th scope="col">การ์ด Jira</th>
                <th scope="col">ขั้นตอนเมล</th>
                <th scope="col">ส่งเมล</th>
                <th scope="col">กำหนดตอบ</th>
                <th scope="col">รอมาแล้ว</th>
                <th scope="col"><span class="sr-only">รายละเอียด</span></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let t of data.rows" (click)="selected = t.ticketNumber"
                  (keyup.enter)="selected = t.ticketNumber" tabindex="0">
                <td><span class="ticket-key mono">{{ t.ticketNumber }}</span></td>
                <td class="summary-cell">
                  <span class="ticket-title" [title]="t.title || ''">{{ t.title || '—' }}</span>
                  <span class="ticket-sub">{{ t.requesterName || 'ไม่ระบุผู้แจ้ง' }}<ng-container *ngIf="t.department"> · {{ t.department }}</ng-container></span>
                </td>
                <td>
                  <span class="jira-key mono">{{ t.jiraKey || '—' }}</span>
                  <span class="jira-status" *ngIf="t.jiraStatus" [class.ready]="isReady(t.jiraStatus)">{{ t.jiraStatus }}</span>
                </td>
                <td><span class="stage-pill" [class.smoke]="t.followup?.stage === 'smoke test'">{{ t.followup?.stage === 'smoke test' ? 'Smoke Test' : 'UAT' }}</span></td>
                <td class="date">{{ formatDate(t.followup?.sentAt) }}</td>
                <td class="deadline">
                  <span [class.late-text]="t.followup?.overdue" [class.soon-text]="isSoon(t.followup)">
                    {{ formatDate(t.followup?.deadlineDate) }}
                  </span>
                  <span class="deadline-note late" *ngIf="t.followup?.overdue"><i class="dot"></i>เกินกำหนด</span>
                  <span class="deadline-note soon" *ngIf="isSoon(t.followup)">{{ deadlineHint(t.followup) }}</span>
                </td>
                <td>
                  <span class="waiting-pill num" [class.late]="t.followup?.overdue" [class.soon]="isSoon(t.followup)">
                    <b>{{ t.followup?.sentAt ? t.followup?.daysWaiting : '—' }}</b><small *ngIf="t.followup?.sentAt">วัน</small>
                  </span>
                </td>
                <td class="action-cell">
                  <button type="button" class="open-detail" [attr.aria-label]="'เปิดรายละเอียด ' + t.ticketNumber"
                          (click)="$event.stopPropagation(); selected = t.ticketNumber">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <nav class="pager" aria-label="เปลี่ยนหน้า" *ngIf="!loading && !error && data && data.total > 0">
          <span>แสดง {{ rangeFrom }}–{{ rangeTo }} จาก {{ data.total }} ticket</span>
          <div class="page-buttons" *ngIf="lastPage > 1">
            <button type="button" class="round" (click)="go(page - 1)" [disabled]="page <= 1" aria-label="หน้าก่อนหน้า">‹</button>
            <button type="button" class="round" *ngFor="let p of pageNumbers" [class.current]="p === page"
                    [attr.aria-current]="p === page ? 'page' : null" (click)="go(p)">{{ p }}</button>
            <button type="button" class="round" (click)="go(page + 1)" [disabled]="page >= lastPage" aria-label="หน้าถัดไป">›</button>
          </div>
        </nav>
      </section>
    </main>

    <app-ticket-drawer [ticketNumber]="selected" (closed)="selected = null"></app-ticket-drawer>
  `,
  styles: [`
    .hero, .page { position: relative; max-width: 1256px; margin: 0 auto; }
    .hero { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 28px; padding: 30px 0 27px; }
    .hero-copy { display: flex; flex-direction: column; gap: 8px; flex: 1 1 440px; min-width: 0; }
    .eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #db2777; font-size: 13px; font-weight: 700; }
    .eyebrow svg { width: 17px; height: 17px; filter: drop-shadow(0 0 6px rgba(244,114,182,.68)); }
    h1 { position: relative; isolation: isolate; width: max-content; max-width: 100%; margin: 0; font: 700 clamp(38px, 4vw, 54px)/1.15 var(--font-display); letter-spacing: -.035em; color: #a21caf; background: linear-gradient(90deg, #db2777, #7c3aed, #0284c7, #db2777); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h1::before { content: ''; position: absolute; z-index: -1; inset: -20px -38px -14px -28px; border-radius: 50%; background: radial-gradient(ellipse at 21% 54%, rgba(249,168,212,.5), transparent 61%), radial-gradient(ellipse at 65% 42%, rgba(196,181,253,.55), transparent 62%), radial-gradient(ellipse at 96% 66%, rgba(165,243,252,.38), transparent 53%); filter: blur(16px); pointer-events: none; }
    .hero-copy p { margin: 0; color: #5b4775; font-size: 16px; }
    .hero-copy strong { color: #9d174d; }
    .hint { display: inline-flex; align-items: center; gap: 7px; align-self: flex-start; margin-top: 4px; padding: 6px 14px; border: 1px solid #e9d5ff; border-radius: 999px; background: rgba(255,255,255,.72); color: #4b3f63; font-size: 13px; }
    .hint svg { width: 15px; height: 15px; flex: 0 0 15px; }
    .metrics { display: flex; flex-wrap: wrap; gap: 14px; }
    .metric { --metric-surface: rgba(255,255,255,.94); --metric-edge: linear-gradient(135deg, #c4b5fd, #f9a8d4 45%, #a5f3fc); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 3px; min-width: 152px; min-height: 98px; padding: 15px 20px; border: 2px solid transparent; border-radius: 26px; background: linear-gradient(var(--metric-surface), var(--metric-surface)) padding-box, var(--metric-edge) border-box; box-shadow: inset 0 1px 0 #fff, 0 18px 40px -25px rgba(124,58,237,.38); }
    .metric:hover { box-shadow: inset 0 1px 0 #fff, 0 22px 44px -22px rgba(140,90,177,.4), 0 0 20px rgba(196,181,253,.18); }
    .metric::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,.14) 42%, rgba(255,255,255,.64) 50%, rgba(196,181,253,.16) 58%, transparent 70%); opacity: 0; transform: translateX(-120%); pointer-events: none; }
    .metric:hover::after, .metric:focus-within::after { opacity: 1; transform: translateX(120%); transition: transform .7s ease-out, opacity .2s ease-out; }
    .metric-overdue { --metric-surface: rgba(255,241,245,.94); --metric-edge: linear-gradient(135deg, #fda4af, #f9a8d4 55%, #c4b5fd); }
    .metric-longest { --metric-edge: linear-gradient(135deg, #a5f3fc, #c4b5fd 55%, #f9a8d4); }
    .metric-label { display: inline-flex; align-items: center; gap: 8px; color: #5b4775; font-size: 13px; font-weight: 600; }
    .metric-overdue .metric-label { color: #9f1239; }
    .metric-value { display: flex; align-items: baseline; gap: 6px; }
    .metric-value b { position: relative; display: inline-block; font: 700 38px/1.1 var(--font-display); color: #6d28d9; }
    .metric-value b.ready-number::after { content: '✦'; position: absolute; top: -7px; right: -11px; color: #b77be9; font: 700 13px/1 var(--font-display); text-shadow: 0 0 5px #fff, 0 0 11px rgba(192,132,252,.9); animation: metric-glint 2.3s ease-in-out infinite alternate; pointer-events: none; }
    .metric-overdue .metric-value b.ready-number::after { color: #ec85aa; animation-delay: -.8s; }
    .metric-longest .metric-value b.ready-number::after { color: #4fb6dc; animation-delay: -1.5s; }
    .metric-overdue .metric-value b { color: #be123c; }
    .metric-longest .metric-value b { color: #2e1a47; }
    .metric-value small { color: #5b4775; font-size: 14px; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #e11d48; flex: 0 0 8px; }
    .metric-overdue .dot { animation: holo-ping 1.8s ease-out infinite; }
    .page { padding-bottom: 80px; }
    .list-panel { display: flex; flex-direction: column; gap: 16px; padding: 22px; border: 1.5px solid transparent; border-radius: 30px; background: radial-gradient(circle at 0% 0%, rgba(249,168,212,.18), transparent 30%) padding-box, radial-gradient(circle at 100% 100%, rgba(165,243,252,.21), transparent 32%) padding-box, linear-gradient(rgba(255,255,255,.92), rgba(255,255,255,.92)) padding-box, linear-gradient(120deg, #c4b5fd, #f9a8d4 36%, #a5f3fc 74%, #fde68a) border-box; box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 24px 60px -32px rgba(124,58,237,.45), 0 0 20px rgba(196,181,253,.12); backdrop-filter: blur(16px); }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .searchbox { display: flex; align-items: center; gap: 10px; min-height: 50px; flex: 1 1 340px; padding: 0 16px; border: 1.5px solid #e9d5ff; border-radius: 18px; background: rgba(255,255,255,.9); color: #7c3aed; box-shadow: 0 14px 34px -22px rgba(124,58,237,.5); }
    .searchbox:focus-within { border-color: #a78bfa; box-shadow: 0 0 0 4px rgba(167,139,250,.45), 0 14px 34px -20px rgba(124,58,237,.5); }
    .searchbox svg, .refresh svg { width: 19px; height: 19px; flex: 0 0 19px; }
    .searchbox svg { filter: drop-shadow(0 0 6px rgba(167,139,250,.55)); }
    .refresh:hover:not(:disabled) svg, .refresh:focus-visible svg { filter: drop-shadow(0 0 6px rgba(167,139,250,.65)); }
    .searchbox input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #2e1a47; font: 15px var(--font-body); }
    .searchbox input::placeholder { color: #7a6894; }
    button { font-family: var(--font-body); cursor: pointer; }
    .refresh { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 50px; padding: 0 18px; border: 1.5px solid #e9d5ff; border-radius: 18px; background: rgba(255,255,255,.85); color: #4c1d95; font-size: 14px; font-weight: 600; transition: transform .18s ease, box-shadow .18s ease; }
    .refresh::after { content: '✦'; position: absolute; top: 4px; right: 7px; color: #b77be9; font-size: 12px; line-height: 1; text-shadow: 0 0 6px #fff, 0 0 10px rgba(192,132,252,.8); opacity: 0; transform: scale(.6) rotate(-20deg); transition: opacity .2s ease, transform .2s ease; pointer-events: none; }
    .refresh:hover:not(:disabled), .refresh:focus-visible { border-color: #a78bfa; background: #fff; box-shadow: 0 0 0 3px rgba(249,168,212,.15), 0 8px 18px -12px rgba(150,90,184,.35); }
    .refresh:hover:not(:disabled)::after, .refresh:focus-visible::after { opacity: 1; transform: scale(1.2) rotate(18deg); }
    .refresh:active:not(:disabled) { transform: scale(.96); box-shadow: 0 0 0 6px rgba(249,168,212,.24), 0 0 23px rgba(192,132,252,.38); }
    .refresh:active:not(:disabled)::after { opacity: 1; transform: scale(1.75) rotate(65deg); }
    button:disabled { opacity: .45; cursor: not-allowed; }
    button:focus-visible, tbody tr:focus-visible { outline: 3px solid #a78bfa; outline-offset: 2px; }
    .legend { display: flex; flex-wrap: wrap; gap: 12px; margin-left: auto; color: #4b3f63; font-size: 12.5px; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .swatch { width: 12px; height: 12px; border-radius: 4px; }
    .swatch.overdue { background: linear-gradient(135deg, #fda4af, #f9a8d4); }
    .swatch.soon { background: linear-gradient(135deg, #fde68a, #fed7aa); }
    .swatch.normal { background: linear-gradient(135deg, #ddd6fe, #e0f2fe); }
    .state { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; min-height: 210px; color: #5b4775; }
    .state.error { color: #be123c; }
    .state button { padding: 9px 16px; border: 1px solid #e9d5ff; border-radius: 14px; background: #fff; color: #5b21b6; }
    .table-scroll { overflow-x: auto; margin: 0 -6px; padding: 0 6px; }
    table { width: 100%; min-width: 1120px; border-collapse: separate; border-spacing: 0 8px; font-size: 14px; }
    th { padding: 0 14px; text-align: left; color: #6e5c88; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
    td { position: relative; overflow: hidden; padding: 12px 14px; background: rgba(255,255,255,.82); border-top: 1.5px solid transparent; border-bottom: 1.5px solid transparent; vertical-align: middle; }
    td:first-child { border-left: 1.5px solid transparent; border-radius: 18px 0 0 18px; }
    td:last-child { border-right: 1.5px solid transparent; border-radius: 0 18px 18px 0; }
    tbody tr { cursor: pointer; }
    tbody tr td { transition: background-color .2s ease, border-color .2s ease; }
    tbody tr:hover td, tbody tr:focus-visible td { background: #f7f0ff; border-top-color: #c4b5fd; border-bottom-color: #c4b5fd; }
    tbody tr:hover td:first-child, tbody tr:focus-visible td:first-child { border-left-color: #c4b5fd; }
    tbody tr:hover td:last-child, tbody tr:focus-visible td:last-child { border-right-color: #c4b5fd; }
    tbody td::after { content: ''; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 26%, rgba(255,255,255,.52) 50%, transparent 74%); transform: translateX(-130%); pointer-events: none; }
    tbody tr:hover td::after, tbody tr:focus-visible td::after { transform: translateX(130%); transition: transform .62s ease-out; }
    tbody tr:hover td:nth-child(2)::after, tbody tr:focus-visible td:nth-child(2)::after { transition-delay: 35ms; }
    tbody tr:hover td:nth-child(3)::after, tbody tr:focus-visible td:nth-child(3)::after { transition-delay: 70ms; }
    tbody tr:hover td:nth-child(4)::after, tbody tr:focus-visible td:nth-child(4)::after { transition-delay: 105ms; }
    tbody tr:hover td:nth-child(5)::after, tbody tr:focus-visible td:nth-child(5)::after { transition-delay: 140ms; }
    tbody tr:hover td:nth-child(6)::after, tbody tr:focus-visible td:nth-child(6)::after { transition-delay: 175ms; }
    tbody tr:hover td:nth-child(7)::after, tbody tr:focus-visible td:nth-child(7)::after { transition-delay: 210ms; }
    tbody tr:hover td:nth-child(8)::after, tbody tr:focus-visible td:nth-child(8)::after { transition-delay: 245ms; }
    .ticket-key { color: #5b21b6; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .summary-cell { min-width: 250px; max-width: 330px; }
    .ticket-title, .ticket-sub { display: block; overflow: hidden; text-overflow: ellipsis; }
    .ticket-title { color: #2e1a47; font-weight: 700; line-height: 1.45; }
    .ticket-sub { color: #6e5c88; font-size: 12.5px; white-space: nowrap; }
    .jira-key { color: #4c1d95; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .jira-status, .stage-pill { display: inline-block; margin: 3px 0 0 5px; padding: 3px 9px; border-radius: 999px; background: #e0f2fe; color: #075985; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
    .jira-status.ready { background: linear-gradient(120deg, #d1fae5, #e0e7ff); color: #065f46; }
    .stage-pill { margin-left: 0; background: #fce7f3; color: #9d174d; }
    .stage-pill.smoke { background: #e0f2fe; color: #075985; }
    .date { color: #4b3f63; white-space: nowrap; font-size: 13px; }
    .deadline { white-space: nowrap; color: #4b3f63; font-size: 13px; }
    .deadline .late-text { color: #9f1239; font-weight: 700; }
    .deadline .soon-text { color: #92400e; font-weight: 700; }
    .deadline-note { display: flex; align-items: center; gap: 5px; width: fit-content; margin-top: 3px; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .deadline-note.late { background: #ffe4e6; color: #9f1239; }
    .deadline-note.soon { background: #fef3c7; color: #92400e; }
    .deadline-note .dot { width: 7px; height: 7px; flex-basis: 7px; }
    .waiting-pill { display: inline-flex; align-items: baseline; gap: 4px; padding: 6px 14px; border-radius: 16px; background: linear-gradient(135deg, #ede9fe, #e0f2fe); color: #4c1d95; white-space: nowrap; }
    .waiting-pill.late { background: linear-gradient(135deg, #ffe4e6, #fbcfe8); color: #9f1239; box-shadow: 0 8px 20px -12px rgba(225,29,72,.6); }
    .waiting-pill.soon { background: linear-gradient(135deg, #fef3c7, #ffedd5); color: #92400e; }
    .waiting-pill b { font: 700 24px/1 var(--font-display); }
    .waiting-pill small { font: 600 12px var(--font-body); }
    .action-cell { text-align: right; }
    .open-detail { position: relative; display: inline-grid; place-items: center; width: 44px; height: 44px; border: 1.5px solid #ddc9f5; border-radius: 50%; background: linear-gradient(125deg, #f2ebff, #ffe8f4 58%, #e8f7ff); color: #5b318f; box-shadow: inset 0 1px 0 #fff, 0 6px 16px -10px rgba(150,90,184,.38); transition: border-color .2s ease, background .2s ease, box-shadow .2s ease, transform .2s ease; }
    .open-detail:hover, tr:hover .open-detail { border-color: #c4a9ec; background: linear-gradient(120deg, #e6dcff, #fbd5eb 56%, #d8f2ff); color: #4c1d95; box-shadow: inset 0 1px 0 #fff, 0 9px 20px -9px rgba(150,90,184,.43), 0 0 0 3px rgba(244,114,182,.12); }
    .open-detail:active { transform: scale(.95); box-shadow: 0 0 0 6px rgba(249,168,212,.24), 0 0 22px rgba(192,132,252,.4); }
    .open-detail:focus-visible { outline: 3px solid #b794ee; outline-offset: 3px; }
    .open-detail::after { content: '✦'; position: absolute; top: 3px; right: 4px; color: #b77be9; font-size: 10px; line-height: 1; text-shadow: 0 0 5px #fff, 0 0 9px rgba(192,132,252,.8); opacity: 0; transform: scale(.5) rotate(-20deg); transition: opacity .2s ease, transform .2s ease; pointer-events: none; }
    .open-detail:hover::after, tr:hover .open-detail::after, .open-detail:focus-visible::after { opacity: 1; transform: scale(1.15) rotate(18deg); }
    .open-detail:active::after { opacity: 1; transform: scale(1.7) rotate(65deg); }
    .open-detail svg { width: 18px; height: 18px; }
    .open-detail:hover svg, tr:hover .open-detail svg, .open-detail:focus-visible svg { filter: drop-shadow(0 0 5px rgba(192,132,252,.7)); }
    .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; color: #5b4775; font-size: 13px; }
    .page-buttons { display: flex; gap: 8px; }
    .round { display: grid; place-items: center; width: 44px; height: 44px; border: 1.5px solid #e9d5ff; border-radius: 50%; background: rgba(255,255,255,.85); color: #4c1d95; font-size: 15px; font-weight: 600; }
    .round.current { border-color: transparent; background: linear-gradient(120deg, #7c3aed, #db2777); color: #fff; box-shadow: 0 10px 22px -10px rgba(192,38,211,.7); }
    @keyframes metric-glint { from { opacity: .5; transform: rotate(-20deg) scale(.75); } to { opacity: 1; transform: rotate(18deg) scale(1.18); } }
    @media (prefers-reduced-motion: reduce) { .metric-value b.ready-number::after { animation: none; } .refresh::after, .open-detail::after { transition: none; } .metric::after, tbody td::after { display: none; } }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    @media (max-width: 1320px) { .hero, .page { margin-left: 28px; margin-right: 28px; } }
    @media (max-width: 900px) { .hero { align-items: flex-start; } .metrics { width: 100%; } .metric { flex: 1; } .legend { margin-left: 0; } }
    @media (max-width: 620px) { .hero, .page { margin-left: 16px; margin-right: 16px; } .hero { padding-top: 26px; } .hint { border-radius: 16px; } .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; gap: 8px; } .metric { min-width: 0; padding: 11px 12px; border-radius: 20px; } .metric-label { font-size: 11.5px; } .metric-value b { font-size: 28px; } .metric-value small { font-size: 11px; } .list-panel { padding: 16px; border-radius: 24px; } .refresh { flex: 1; } .legend { width: 100%; } .pager { justify-content: center; } }
  `],
})
export class MailTrackingComponent implements OnInit, OnDestroy {
  data: TicketListResponse | null = null;
  summary: MailSummary | null = null;
  loading = true;
  error = false;
  selected: string | null = null;
  q = '';
  page = 1;
  private search$ = new Subject<void>();
  private destroy$ = new Subject<void>();
  private requestId = 0;
  private today = this.bangkokDay();

  constructor(private service: TicketsService) {}

  ngOnInit(): void {
    this.search$.pipe(debounceTime(350), takeUntil(this.destroy$)).subscribe(() => {
      this.page = 1;
      this.reload();
    });
    this.loadSummary();
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  search(): void {
    this.search$.next();
  }

  refresh(): void {
    this.today = this.bangkokDay();
    this.loadSummary();
    this.reload();
  }

  reload(): void {
    const requestId = ++this.requestId;
    this.loading = true;
    this.error = false;
    this.service.list({ mailWaiting: true, sort: 'mailAge', q: this.q.trim(), page: this.page, limit: 8 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          if (requestId !== this.requestId) return;
          this.data = data;
          this.loading = false;
        },
        error: () => {
          if (requestId !== this.requestId) return;
          this.error = true;
          this.loading = false;
        },
      });
  }

  private loadSummary(): void {
    this.service.mailSummary().pipe(takeUntil(this.destroy$)).subscribe({
      next: (summary) => { this.summary = summary; },
      error: () => { this.summary = null; },
    });
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value.length === 10 ? value + 'T12:00:00Z' : value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok',
    }).format(date);
  }

  isReady(status: string | null): boolean {
    return (status ?? '').trim().toLowerCase() === 'ready to deploy';
  }

  isSoon(followup: UatFollowup | null | undefined): boolean {
    return this.daysUntilDeadline(followup) !== null;
  }

  deadlineHint(followup: UatFollowup | null | undefined): string {
    const days = this.daysUntilDeadline(followup);
    return days === 0 ? 'ครบกำหนดวันนี้' : days === null ? '' : 'อีก ' + days + ' วัน';
  }

  private daysUntilDeadline(followup: UatFollowup | null | undefined): number | null {
    if (!followup?.deadlineDate || followup.overdue) return null;
    const due = Date.parse(followup.deadlineDate.slice(0, 10) + 'T00:00:00Z');
    const today = Date.parse(this.today + 'T00:00:00Z');
    if (Number.isNaN(due) || Number.isNaN(today)) return null;
    const days = Math.round((due - today) / 86_400_000);
    return days >= 0 && days <= 2 ? days : null;
  }

  private bangkokDay(): string {
    return new Intl.DateTimeFormat('sv-SE', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Bangkok',
    }).format(new Date());
  }

  go(page: number): void {
    this.page = page;
    this.reload();
  }

  get lastPage(): number {
    return this.data ? Math.max(1, Math.ceil(this.data.total / this.data.limit)) : 1;
  }

  get rangeFrom(): number {
    return this.data?.total ? (this.page - 1) * this.data.limit + 1 : 0;
  }

  get rangeTo(): number {
    return this.data ? Math.min(this.data.total, this.page * this.data.limit) : 0;
  }

  get pageNumbers(): number[] {
    const start = Math.max(1, Math.min(this.page - 2, this.lastPage - 4));
    return Array.from({ length: Math.min(5, this.lastPage - start + 1) }, (_, i) => start + i);
  }
}
