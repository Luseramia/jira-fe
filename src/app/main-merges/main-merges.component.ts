import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { MainMergesService } from '../main-merges.service';
import {
  CardMergeState,
  MainMergesPage,
  MergeCard,
  MergeGroup,
  MergePrState,
  MergeTotals,
  RepoMerge,
  UnmatchedPr,
  UnmatchedReason,
} from '../models';
import { stageMeta } from '../tickets/status-chip';

interface RepoSlot {
  label: string;
  merge: RepoMerge | null;
  tip: string;
}

interface CardView {
  card: MergeCard;
  slots: RepoSlot[]; // ลำดับเดียวกับหัวคอลัมน์ repo ทุกแถว
  via: string | null; // ผูกมาจาก CR / ticket / หัวข้อ PR (ไม่โชว์ถ้ามาจากชื่อ branch ตรง ๆ)
}

interface GroupMeta {
  id: MergeGroup;
  tile: string; // ป้ายบนกล่องตัวเลข
  title: string;
  sub: string;
  empty: string;
  unit: string;
}

const PAGE_SIZE = 10;
const GROUP_META: Record<MergeGroup, GroupMeta> = {
  attn: { id: 'attn', tile: 'ต้องดู', title: 'ต้องดู', sub: 'สถานะ Jira ไม่ตรงกับของที่อยู่บน main', empty: 'ไม่มีการ์ดที่ต้องดู', unit: 'การ์ด' },
  waiting: { id: 'waiting', tile: 'รอ merge', title: 'รอ merge', sub: 'มี PR เข้า main ที่ยังเปิดอยู่', empty: 'ไม่มี PR ค้าง', unit: 'การ์ด' },
  merged: { id: 'merged', tile: 'merge แล้ว', title: 'merge แล้ว', sub: 'เข้า main ในช่วงที่เลือก เรียงจาก merge ล่าสุด', empty: 'ยังไม่มีการ์ดที่ merge ในช่วงนี้', unit: 'การ์ด' },
  unmatched: { id: 'unmatched', tile: 'ผูกการ์ดไม่ได้', title: 'PR ที่ไม่รู้ว่าเป็นงานไหน', sub: 'merge เข้า main ในช่วงที่เลือก แต่ผูกการ์ดไม่ได้', empty: 'ไม่มี PR ที่ผูกการ์ดไม่ได้', unit: 'PR' },
};

// วันที่แบบเดียวกับ Track Mail (ไทย ปี ค.ศ. เวลาไทย)
const DAY_FMT = new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
const DAY_TIME_FMT = new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
});
const fmt = (f: Intl.DateTimeFormat, d: string | null | undefined) => {
  if (!d) return '—';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? '—' : f.format(t);
};

/**
 * แท็บ "Merge เข้า main" — PR ของ erp-backend / erp-frontend ที่ผูกกับการ์ด SE (jira-be docs/MAIN-MERGE-PLAN.md)
 * BE แบ่งหน้าให้ทีละกลุ่ม (กล่องตัวเลขด้านบน = ตัวเลือกกลุ่ม) · ค้นหาฝั่ง server
 */
@Component({
  selector: 'app-main-merges',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="6" cy="5" r="2.4"></circle><circle cx="6" cy="19" r="2.4"></circle><circle cx="18" cy="12" r="2.4"></circle>
            <path d="M6 7.4v9.2M6 8.5c0 2.6 2.4 3.5 5 3.5h4.6"></path>
          </svg>
          PR erp-backend / erp-frontend
        </div>
        <h1 class="fx-text">Merge เข้า main</h1>
      </div>

      <div class="metrics" role="group" aria-label="เลือกกลุ่มที่จะดู">
        <button type="button" *ngFor="let m of tiles" class="metric fx-lift" [ngClass]="'metric-' + m.id"
                [class.active]="group === m.id" [attr.aria-pressed]="group === m.id" (click)="setGroup(m.id)">
          <span class="metric-label">
            <span class="dot" *ngIf="m.id === 'attn'" [class.fx-ping]="!!data?.totals?.attn"></span>
            {{ m.tile }}<ng-container *ngIf="m.id === 'merged'"> · {{ days }} วัน</ng-container>
          </span>
          <span class="metric-value">
            <b [class.ready-number]="!!data">{{ data ? tileCount(data.totals, m.id) : '—' }}</b><small>{{ m.unit }}</small>
          </span>
          <span class="found" *ngIf="data?.found as f">พบ {{ tileCount(f, m.id) }}</span>
        </button>
      </div>
    </section>

    <main class="page">
      <div class="banner warn" *ngIf="data?.notReady">{{ data?.notReady }}</div>
      <ng-container *ngIf="data?.sync as s">
        <div class="banner warn" *ngIf="!s.prSyncedAt">
          ยังไม่มีข้อมูล PR — import workflow n8n <span class="mono">n8n/main-merge-sync.json</span> แล้วกด Execute
        </div>
        <div class="banner warn" *ngIf="s.prSyncedAt && minutesAgo(s.prSyncedAt) > 60">
          PR sync ล่าสุด {{ ago(s.prSyncedAt) }} — workflow n8n อาจหยุดทำงาน
        </div>
        <div class="banner warn" *ngIf="!s.sheetSyncedAt">ยังไม่มีข้อมูล sheet CR — branch release/CR-… จะผูกการ์ดไม่ได้</div>
        <div class="banner warn" *ngIf="s.sheetSyncedAt && minutesAgo(s.sheetSyncedAt) > 180">
          sheet CR sync ล่าสุด {{ ago(s.sheetSyncedAt) }}
        </div>
      </ng-container>


      <section class="list-panel" [attr.aria-label]="meta[group].title" [attr.aria-busy]="loading">
        <div class="toolbar">
          <div class="seg" role="group" aria-label="ช่วงเวลา">
            <button *ngFor="let d of dayOptions" type="button" class="seg-btn" [class.active]="days === d"
                    [class.fx-shine]="days === d" [attr.aria-pressed]="days === d" (click)="setDays(d)">{{ d }} วัน</button>
          </div>
          <label class="searchbox">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
              <circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>
            </svg>
            <span class="sr-only">ค้นหา SE, CR, branch หรือชื่องาน</span>
            <input type="search" [(ngModel)]="q" (ngModelChange)="search()" placeholder="ค้นหา SE, CR, branch หรือชื่องาน…" />
          </label>
          <button class="refresh" type="button" (click)="load(true)" [disabled]="loading">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"></path>
            </svg>
            รีเฟรช
          </button>
        </div>

        <div class="g-head">
          <h2>{{ meta[group].title }}</h2>
          <span class="count num" [ngClass]="'c-' + group">{{ data?.total ?? '—' }}</span>
          <span class="g-sub">{{ meta[group].sub }}</span>
          <label class="toggle" *ngIf="group === 'unmatched'">
            <input type="checkbox" [(ngModel)]="noRef" (ngModelChange)="setNoRef()" />
            รวมที่ไม่มีเลขงาน <span class="num">({{ data?.totals?.unmatchedNoRef ?? 0 }})</span>
          </label>
        </div>

        <div class="state" *ngIf="loading && !data">กำลังโหลดข้อมูล merge…</div>
        <div class="state error" *ngIf="!loading && error">
          โหลดข้อมูลไม่ได้ — ระบบ API อาจไม่ทำงาน
          <button type="button" (click)="load(true)">ลองใหม่</button>
        </div>

        <ng-container *ngIf="data && !data.notReady && !error">
          <div class="empty" *ngIf="!data.total">
            {{ q.trim() ? 'ไม่พบในกลุ่มนี้' : meta[group].empty }}
            <ng-container *ngIf="elsewhere.length">
              — พบใน
              <button type="button" class="jump" *ngFor="let e of elsewhere" (click)="setGroup(e.id)">{{ e.title }} ({{ e.n }})</button>
            </ng-container>
          </div>

          <div class="grid" role="table" *ngIf="group !== 'unmatched' && views.length"
               [class.busy]="loading" [style.--repos]="repoLabels.length" [attr.aria-label]="meta[group].title">
            <div class="grid-head" role="row">
              <span role="columnheader">การ์ด Jira</span>
              <span role="columnheader">งาน · ผู้รับผิดชอบ</span>
              <span role="columnheader">สถานะ Jira</span>
              <span role="columnheader" *ngFor="let l of repoLabels">{{ l }}</span>
            </div>
            <div class="grid-row" role="row" *ngFor="let v of views; trackBy: trackRow">
              <div class="key-cell" role="cell">
                <a class="jira-key mono" [href]="v.card.url" target="_blank" rel="noopener">{{ v.card.key }} ↗</a>
                <span class="merge-pill" [ngClass]="v.card.state">{{ stateLabel[v.card.state] }}</span>
              </div>
              <div class="summary-cell" role="cell">
                <span class="title" [title]="v.card.summary || ''">{{ v.card.summary || '— ไม่พบชื่องาน —' }}</span>
                <span class="sub">
                  {{ v.card.assignee || 'ไม่ระบุผู้รับผิดชอบ' }}<ng-container *ngIf="v.via"> · ผูกจาก <span class="mono">{{ v.via }}</span></ng-container>
                </span>
                <span class="flag-note" *ngIf="v.card.flagText"><i class="dot"></i>{{ v.card.flagText }}</span>
              </div>
              <div role="cell">
                <span class="jira-status" [style.--c]="color(v.card.status)">
                  {{ v.card.status || 'ไม่ทราบสถานะ' }}<small *ngIf="v.card.statusSource === 'db'">DB</small>
                </span>
              </div>
              <div class="repo-cell" role="cell" *ngFor="let s of v.slots; trackBy: trackSlot">
                <span class="repo-label" aria-hidden="true">{{ s.label }}</span>
                <a class="repo-chip" *ngIf="s.merge as m; else noPr" [ngClass]="m.state"
                   [attr.href]="m.latest.url" target="_blank" rel="noopener" [title]="s.tip"
                   [attr.aria-label]="s.label + ' PR #' + m.latest.number + ' ' + prStateLabel[m.state]">
                  <span class="ic" aria-hidden="true">{{ icon[m.state] }}</span>
                  <b>#{{ m.latest.number }}</b>
                  <small>{{ m.state === 'merged' ? day(m.latest.mergedAt) : prStateLabel[m.state] }}</small>
                  <em *ngIf="m.prs.length > 1">+{{ m.prs.length - 1 }}</em>
                </a>
                <ng-template #noPr><span class="repo-chip none">ไม่มี PR</span></ng-template>
              </div>
            </div>
          </div>

          <div class="log" *ngIf="group === 'unmatched' && data.unmatched.length" [class.busy]="loading">
            <div class="log-row" *ngFor="let u of data.unmatched; trackBy: trackPr">
              <span class="t">{{ dayTime(u.mergedAt) }}</span>
              <span class="repo-tag">{{ u.repoLabel }}</span>
              <a class="pr mono" [attr.href]="u.url" target="_blank" rel="noopener">#{{ u.number }}</a>
              <span class="br mono" [title]="u.title || u.branch">{{ u.branch }}</span>
              <span class="why" [ngClass]="u.reason">
                {{ reasonLabel[u.reason] }}<ng-container *ngIf="u.via"> · <span class="mono">{{ u.via }}</span></ng-container>
              </span>
            </div>
          </div>

          <nav class="pager" aria-label="เปลี่ยนหน้า" *ngIf="data.total > 0">
            <span>แสดง {{ rangeFrom }}–{{ rangeTo }} จาก {{ data.total }} {{ meta[group].unit }}</span>
            <div class="page-buttons" *ngIf="lastPage > 1">
              <button type="button" class="round" (click)="go(page - 1)" [disabled]="loading || page <= 1" aria-label="หน้าก่อนหน้า">‹</button>
              <button type="button" class="round" *ngFor="let p of pageNumbers" [class.current]="p === page"
                      [attr.aria-current]="p === page ? 'page' : null" [disabled]="loading" (click)="go(p)">{{ p }}</button>
              <button type="button" class="round" (click)="go(page + 1)" [disabled]="loading || page >= lastPage" aria-label="หน้าถัดไป">›</button>
            </div>
          </nav>
        </ng-container>
      </section>

      <p class="sync" *ngIf="data?.sync?.prSyncedAt">
        PR <b class="num">{{ data?.sync?.prCount | number }}</b> ใบ · sync {{ ago(data?.sync?.prSyncedAt) }}
        <span aria-hidden="true">✦</span>
        sheet CR <b class="num">{{ data?.sync?.sheetRows | number }}</b> เลข · sync {{ ago(data?.sync?.sheetSyncedAt) }}
      </p>
    </main>
  `,
  styles: [`
    .hero, .page { position: relative; max-width: 1256px; margin: 0 auto; }
    .hero { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 28px; padding: 30px 0 27px; }
    .hero-copy { display: flex; flex-direction: column; gap: 8px; flex: 1 1 360px; min-width: 0; }
    .eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #7c3aed; font-size: 13px; font-weight: 700; }
    .eyebrow svg { width: 17px; height: 17px; filter: drop-shadow(0 0 6px rgba(167,139,250,.7)); }
    h1 { position: relative; isolation: isolate; width: max-content; max-width: 100%; margin: 0; font: 700 clamp(38px, 4vw, 54px)/1.15 var(--font-display); letter-spacing: -.035em; color: #a21caf; background: linear-gradient(90deg, #db2777, #7c3aed, #0284c7, #db2777); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h1::before { content: ''; position: absolute; z-index: -1; inset: -20px -38px -14px -28px; border-radius: 50%; background: radial-gradient(ellipse at 21% 54%, rgba(249,168,212,.5), transparent 61%), radial-gradient(ellipse at 65% 42%, rgba(196,181,253,.55), transparent 62%), radial-gradient(ellipse at 96% 66%, rgba(165,243,252,.38), transparent 53%); filter: blur(16px); pointer-events: none; }

    /* กล่องตัวเลข = ปุ่มเลือกกลุ่ม */
    .metrics { display: flex; flex-wrap: wrap; gap: 12px; }
    .metric { --metric-surface: rgba(255,255,255,.94); --metric-edge: linear-gradient(135deg, #c4b5fd, #f9a8d4 45%, #a5f3fc); --metric-edge-on: linear-gradient(135deg, #8b5cf6, #ec4899 50%, #06b6d4); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 3px; min-width: 140px; min-height: 98px; padding: 14px 18px; border: 2px solid transparent; border-radius: 26px; background: linear-gradient(var(--metric-surface), var(--metric-surface)) padding-box, var(--metric-edge) border-box; box-shadow: inset 0 1px 0 #fff, 0 18px 40px -25px rgba(124,58,237,.38); font: inherit; color: inherit; text-align: left; }
    .metric:hover { box-shadow: inset 0 1px 0 #fff, 0 22px 44px -22px rgba(140,90,177,.4), 0 0 20px rgba(196,181,253,.18); }
    .metric.active { background: linear-gradient(var(--metric-surface), var(--metric-surface)) padding-box, var(--metric-edge-on) border-box; box-shadow: inset 0 1px 0 #fff, 0 0 0 4px rgba(167,139,250,.28), 0 22px 44px -20px rgba(140,90,177,.5); }
    .metric::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,.14) 42%, rgba(255,255,255,.64) 50%, rgba(196,181,253,.16) 58%, transparent 70%); opacity: 0; transform: translateX(-120%); pointer-events: none; }
    .metric:hover::after, .metric:focus-visible::after { opacity: 1; transform: translateX(120%); transition: transform .7s ease-out, opacity .2s ease-out; }
    .metric:focus-visible { outline: 3px solid #a78bfa; outline-offset: 3px; }
    .metric-attn { --metric-surface: rgba(255,241,245,.94); --metric-edge: linear-gradient(135deg, #fda4af, #f9a8d4 55%, #c4b5fd); --metric-edge-on: linear-gradient(135deg, #e11d48, #db2777 55%, #a855f7); }
    .metric-waiting { --metric-surface: rgba(255,251,235,.94); --metric-edge: linear-gradient(135deg, #fde68a, #fed7aa 55%, #f9a8d4); --metric-edge-on: linear-gradient(135deg, #f59e0b, #fb923c 55%, #f472b6); }
    .metric-merged { --metric-edge: linear-gradient(135deg, #a7f3d0, #a5f3fc 55%, #c4b5fd); --metric-edge-on: linear-gradient(135deg, #10b981, #06b6d4 55%, #8b5cf6); }
    .metric-label { display: inline-flex; align-items: center; gap: 8px; color: #5b4775; font-size: 13px; font-weight: 600; white-space: nowrap; }
    .metric-attn .metric-label { color: #9f1239; }
    .metric-waiting .metric-label { color: #92400e; }
    .metric-value { display: flex; align-items: baseline; gap: 6px; }
    .metric-value b { position: relative; display: inline-block; font: 700 38px/1.1 var(--font-display); color: #6d28d9; }
    .metric-value b.ready-number::after { content: '✦'; position: absolute; top: -7px; right: -11px; color: #b77be9; font: 700 13px/1 var(--font-display); text-shadow: 0 0 5px #fff, 0 0 11px rgba(192,132,252,.9); animation: metric-glint 2.3s ease-in-out infinite alternate; pointer-events: none; }
    .metric-attn .metric-value b { color: #be123c; }
    .metric-attn .metric-value b.ready-number::after { color: #ec85aa; animation-delay: -.8s; }
    .metric-waiting .metric-value b { color: #b45309; }
    .metric-waiting .metric-value b.ready-number::after { color: #e7a85a; animation-delay: -1.1s; }
    .metric-merged .metric-value b { color: #047857; }
    .metric-merged .metric-value b.ready-number::after { color: #4fb6dc; animation-delay: -1.5s; }
    .metric-unmatched .metric-value b { color: #5b4775; }
    .metric-value small { color: #5b4775; font-size: 14px; }
    .found { position: absolute; top: 10px; right: 12px; padding: 1px 8px; border-radius: 999px; background: #fff; border: 1px solid #e9d5ff; color: #6d28d9; font-size: 11px; font-weight: 700; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #e11d48; flex: 0 0 8px; }

    .page { padding-bottom: 80px; }
    .banner { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; border: 1px solid var(--line); background: rgba(255,255,255,.8); border-radius: 16px; padding: 12px 16px; margin-bottom: 12px; font-size: 14px; color: var(--muted); }
    .banner.warn { color: #92400e; border-color: #fde68a; background: rgba(255,251,235,.9); }

    .list-panel { display: flex; flex-direction: column; gap: 16px; padding: 22px; border: 1.5px solid transparent; border-radius: 30px; background: radial-gradient(circle at 0% 0%, rgba(249,168,212,.18), transparent 30%) padding-box, radial-gradient(circle at 100% 100%, rgba(165,243,252,.21), transparent 32%) padding-box, linear-gradient(rgba(255,255,255,.92), rgba(255,255,255,.92)) padding-box, linear-gradient(120deg, #c4b5fd, #f9a8d4 36%, #a5f3fc 74%, #fde68a) border-box; box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 24px 60px -32px rgba(124,58,237,.45), 0 0 20px rgba(196,181,253,.12); backdrop-filter: blur(16px); }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .seg { display: flex; gap: 4px; padding: 5px; border-radius: 999px; background: rgba(237,229,251,.64); border: 1px solid rgba(255,255,255,.95); }
    .seg-btn { min-height: 40px; padding: 0 16px; border: 1px solid transparent; border-radius: 999px; background: transparent; color: #4c1d95; font: 600 14px var(--font-body); white-space: nowrap; }
    .seg-btn:hover:not(.active) { background: rgba(255,255,255,.7); }
    .seg-btn.active { border-color: #c4a9ec; background: linear-gradient(120deg, #e6dcff, #fbd5eb 56%, #d8f2ff); box-shadow: inset 0 1px 0 #fff, 0 9px 22px -10px rgba(150,90,184,.42); text-shadow: 0 1px 0 rgba(255,255,255,.8); }
    .searchbox { display: flex; align-items: center; gap: 10px; min-height: 50px; flex: 1 1 320px; padding: 0 16px; border: 1.5px solid #e9d5ff; border-radius: 18px; background: rgba(255,255,255,.9); color: #7c3aed; box-shadow: 0 14px 34px -22px rgba(124,58,237,.5); }
    .searchbox:focus-within { border-color: #a78bfa; box-shadow: 0 0 0 4px rgba(167,139,250,.45), 0 14px 34px -20px rgba(124,58,237,.5); }
    .searchbox svg, .refresh svg { width: 19px; height: 19px; flex: 0 0 19px; }
    .searchbox svg { filter: drop-shadow(0 0 6px rgba(167,139,250,.55)); }
    .searchbox input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #2e1a47; font: 15px var(--font-body); }
    .searchbox input::placeholder { color: #7a6894; }
    button { font-family: var(--font-body); cursor: pointer; }
    .refresh { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 50px; padding: 0 18px; border: 1.5px solid #e9d5ff; border-radius: 18px; background: rgba(255,255,255,.85); color: #4c1d95; font-size: 14px; font-weight: 600; transition: transform .18s ease, box-shadow .18s ease; }
    .refresh::after { content: '✦'; position: absolute; top: 4px; right: 7px; color: #b77be9; font-size: 12px; line-height: 1; text-shadow: 0 0 6px #fff, 0 0 10px rgba(192,132,252,.8); opacity: 0; transform: scale(.6) rotate(-20deg); transition: opacity .2s ease, transform .2s ease; pointer-events: none; }
    .refresh:hover:not(:disabled), .refresh:focus-visible { border-color: #a78bfa; background: #fff; box-shadow: 0 0 0 3px rgba(249,168,212,.15), 0 8px 18px -12px rgba(150,90,184,.35); }
    .refresh:hover:not(:disabled)::after, .refresh:focus-visible::after { opacity: 1; transform: scale(1.2) rotate(18deg); }
    .refresh:active:not(:disabled) { transform: scale(.96); }
    button:disabled { opacity: .45; cursor: not-allowed; }
    button:focus-visible, a:focus-visible, .toggle:focus-within { outline: 3px solid #a78bfa; outline-offset: 2px; }

    .g-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .g-head h2 { position: relative; isolation: isolate; margin: 0; font: 700 20px var(--font-display); color: var(--text); }
    .g-head h2::before { content: ''; position: absolute; z-index: -1; inset: -7px -16px; border-radius: 50%; background: radial-gradient(ellipse, rgba(196,181,253,.4), rgba(249,168,212,.18) 48%, transparent 75%); filter: blur(7px); pointer-events: none; }
    .g-sub { font-size: 12.5px; color: var(--muted); }
    .count { --k: #6d28d9; display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--k); background: color-mix(in srgb, var(--k) 12%, transparent); border-radius: 99px; padding: 0 9px; }
    .count::after { content: '✦'; color: #a86bd8; font-size: 10px; text-shadow: 0 0 5px #fff, 0 0 9px rgba(192,132,252,.8); animation: metric-glint 2.3s ease-in-out infinite alternate; }
    .count.c-attn { --k: #be123c; }
    .count.c-waiting { --k: #b45309; }
    .count.c-merged { --k: #047857; }
    .count.c-unmatched { --k: #5b4775; }
    .toggle { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; padding: 6px 13px; border: 1px solid #e9d5ff; border-radius: 999px; background: rgba(255,255,255,.85); color: #4b3f63; font-size: 13px; cursor: pointer; }
    .toggle input { accent-color: #7c3aed; }

    .state { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; min-height: 210px; color: #5b4775; }
    .state.error { color: #be123c; }
    .state button { padding: 9px 16px; border: 1px solid #e9d5ff; border-radius: 14px; background: #fff; color: #5b21b6; }
    .empty { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 120px; justify-content: center; color: #5b4775; font-size: 14px; }
    .jump { padding: 5px 12px; border: 1.5px solid #e9d5ff; border-radius: 999px; background: #fff; color: #5b21b6; font-size: 13px; font-weight: 600; }
    .jump:hover { border-color: #a78bfa; box-shadow: 0 6px 14px -10px rgba(150,90,184,.5); }
    .busy { opacity: .5; transition: opacity .15s ease; }

    /* แถวแบบเดียวกับตาราง Track Mail — div grid เพื่อไม่ติด cursor ของ tbody tr (แถวนี้กดทั้งแถวไม่ได้) */
    .grid { display: flex; flex-direction: column; gap: 8px; }
    .grid-head, .grid-row { display: grid; grid-template-columns: minmax(128px, .7fr) minmax(240px, 2.3fr) minmax(130px, .85fr) repeat(var(--repos, 2), minmax(150px, 1fr)); align-items: center; gap: 14px; }
    .grid-head { padding: 0 16px; color: #6e5c88; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
    .grid-row { position: relative; overflow: hidden; padding: 12px 16px; border: 1.5px solid transparent; border-radius: 18px; background: rgba(255,255,255,.82); transition: background-color .2s ease, border-color .2s ease; }
    .grid-row:hover, .grid-row:focus-within { background: #f7f0ff; border-color: #c4b5fd; }
    .grid-row::after { content: ''; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 26%, rgba(255,255,255,.52) 50%, transparent 74%); transform: translateX(-130%); pointer-events: none; }
    .grid-row:hover::after { transform: translateX(130%); transition: transform .62s ease-out; }

    .key-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
    .jira-key { color: #4c1d95; font-size: 12.5px; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .jira-key:hover { color: #6d28d9; text-decoration: underline; }
    .merge-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
    .merge-pill.merged { background: linear-gradient(120deg, #d1fae5, #e0e7ff); color: #065f46; }
    .merge-pill.partial, .merge-pill.open { background: linear-gradient(135deg, #fef3c7, #ffedd5); color: #92400e; }
    .merge-pill.none { background: #ffe4e6; color: #9f1239; }

    .summary-cell { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .title { color: #2e1a47; font-weight: 700; line-height: 1.45; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .sub { color: #6e5c88; font-size: 12.5px; }
    .sub .mono { color: #4c1d95; font-size: 12px; }
    .flag-note { display: inline-flex; align-items: center; gap: 6px; width: fit-content; margin-top: 5px; padding: 3px 11px; border-radius: 999px; background: #ffe4e6; color: #9f1239; font-size: 12px; font-weight: 700; }
    .flag-note .dot { width: 7px; height: 7px; flex-basis: 7px; animation: holo-ping 1.8s ease-out infinite; }

    .jira-status { --c: var(--st-neutral); display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--c) 12%, #fff); color: #2e1a47; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .jira-status::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--c); }
    .jira-status small { padding: 0 5px; border-radius: 6px; background: rgba(255,255,255,.8); color: #796b91; font-size: 10.5px; font-weight: 600; }

    .repo-cell { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .repo-label { display: none; }
    .repo-chip { display: inline-flex; align-items: baseline; gap: 6px; padding: 6px 12px; border: 1.5px solid transparent; border-radius: 14px; color: inherit; font-size: 13px; text-decoration: none; white-space: nowrap; transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }
    .repo-chip.merged { background: linear-gradient(135deg, #d1fae5, #e0f2fe); color: #065f46; }
    .repo-chip.open { background: linear-gradient(135deg, #fef3c7, #ffedd5); color: #92400e; }
    .repo-chip.closed { background: #f1f5f9; color: #475569; }
    .repo-chip.none { background: transparent; border: 1.5px dashed #e2d3f5; color: #796b91; font-size: 12.5px; }
    a.repo-chip:hover { border-color: currentColor; box-shadow: 0 8px 18px -12px rgba(150,90,184,.45); transform: translateY(-1px); }
    .repo-chip .ic { font-size: 11px; }
    .repo-chip b { font: 700 13px var(--font-mono); }
    .repo-chip small { font-size: 12px; font-weight: 600; }
    .repo-chip em { font-style: normal; font-size: 11.5px; opacity: .75; }

    .log { display: flex; flex-direction: column; gap: 6px; }
    .log-row { display: grid; grid-template-columns: 112px 40px 64px minmax(0, 1.5fr) minmax(0, 1fr); align-items: center; gap: 12px; padding: 9px 16px; border: 1.5px solid transparent; border-radius: 16px; background: rgba(255,255,255,.82); font-size: 13px; transition: background-color .2s ease, border-color .2s ease; }
    .log-row:hover { background: #f7f0ff; border-color: #c4b5fd; }
    .log-row .t { color: #6e5c88; font-size: 12.5px; white-space: nowrap; }
    .repo-tag { justify-self: start; padding: 1px 8px; border-radius: 8px; background: #ede9fe; color: #5b21b6; font: 700 11.5px var(--font-mono); }
    .pr { color: #6d28d9; font-weight: 600; text-decoration: none; }
    .pr:hover { text-decoration: underline; }
    .br { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #2e1a47; font-size: 12.5px; }
    .why { justify-self: start; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 10px; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; }
    .why.no_ref { background: #f1f5f9; color: #475569; }

    .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; color: #5b4775; font-size: 13px; }
    .page-buttons { display: flex; gap: 8px; }
    .round { display: grid; place-items: center; width: 44px; height: 44px; border: 1.5px solid #e9d5ff; border-radius: 50%; background: rgba(255,255,255,.85); color: #4c1d95; font-size: 15px; font-weight: 600; }
    .round.current { border-color: transparent; background: linear-gradient(120deg, #7c3aed, #db2777); color: #fff; box-shadow: 0 10px 22px -10px rgba(192,38,211,.7); }
    .round.current:disabled { opacity: 1; }
    .sync { margin: 14px 6px 0; color: #6e5c88; font-size: 12.5px; }
    .sync b { color: #4c1d95; }
    .sync span { margin: 0 6px; color: #b77be9; }

    @keyframes metric-glint { from { opacity: .5; transform: rotate(-20deg) scale(.75); } to { opacity: 1; transform: rotate(18deg) scale(1.18); } }
    @media (prefers-reduced-motion: reduce) { .metric-value b.ready-number::after, .count::after, .flag-note .dot { animation: none; } .metric::after, .grid-row::after { display: none; } }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    @media (max-width: 1320px) { .hero, .page { margin-left: 28px; margin-right: 28px; } }
    @media (max-width: 900px) {
      .hero { align-items: flex-start; }
      .metrics { width: 100%; }
      .metric { flex: 1; }
      .grid-head { display: none; }
      .grid-row { grid-template-columns: 1fr; gap: 8px; }
      .key-cell { flex-direction: row; align-items: center; }
      .repo-label { display: inline; min-width: 22px; color: #6e5c88; font: 700 12px var(--font-display); }
      .log-row { grid-template-columns: 96px 36px 1fr; }
      .log-row .br, .log-row .why { grid-column: 1 / -1; }
      .toggle { margin-left: 0; }
    }
    @media (max-width: 620px) {
      .hero, .page { margin-left: 16px; margin-right: 16px; }
      .hero { padding-top: 26px; }
      .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .metric { min-width: 0; min-height: 84px; padding: 11px 12px; border-radius: 20px; }
      .metric-label { font-size: 11.5px; }
      .metric-value b { font-size: 28px; }
      .metric-value small { font-size: 11px; }
      .seg { width: 100%; }
      .seg-btn { flex: 1; }
      .refresh { flex: 1; }
      .list-panel { padding: 16px; border-radius: 24px; }
      .pager { justify-content: center; }
    }
  `],
})
export class MainMergesComponent implements OnInit, OnDestroy {
  readonly dayOptions = [7, 30, 90];
  readonly meta = GROUP_META;
  readonly tiles = [GROUP_META.attn, GROUP_META.waiting, GROUP_META.merged, GROUP_META.unmatched];
  readonly stateLabel: Record<CardMergeState, string> = {
    merged: 'เข้า main แล้ว',
    partial: 'เข้าบางส่วน',
    open: 'รอ merge',
    none: 'ไม่มี PR',
  };
  readonly prStateLabel: Record<MergePrState, string> = { merged: 'merged', open: 'รอ merge', closed: 'ปิดไม่ merge' };
  readonly icon: Record<MergePrState, string> = { merged: '✓', open: '●', closed: '✕' };
  readonly reasonLabel: Record<UnmatchedReason, string> = {
    cr_not_in_sheet: 'CR ยังไม่อยู่ใน sheet',
    cr_no_se: 'CR ใน sheet ยังไม่ผูก SE',
    ticket_no_se: 'ticket ยังไม่ผูก SE',
    no_ref: 'ไม่มีเลขงานในชื่อ branch',
  };

  days = 30;
  group: MergeGroup = 'attn';
  page = 1;
  q = '';
  noRef = false;
  data: MainMergesPage | null = null;
  loading = true;
  error = false;

  // view model — ประกอบตอนได้ข้อมูลหน้าใหม่ (template ไม่ต้องคำนวณทุกรอบ change detection)
  views: CardView[] = [];
  repoLabels: string[] = [];
  elsewhere: { id: MergeGroup; title: string; n: number }[] = [];

  private autoGroup = true; // ครั้งแรกให้ BE เลือกกลุ่มแรกที่มีรายการ
  private requestId = 0;
  private search$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(private service: MainMergesService) {}

  ngOnInit(): void {
    this.search$.pipe(debounceTime(350), takeUntil(this.destroy$)).subscribe(() => {
      this.page = 1;
      this.load();
    });
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** fresh = ปุ่มรีเฟรช (BE รอเช็คข้อมูลใหม่) · อย่างอื่นตอบจาก snapshot ของ BE ทันที */
  load(fresh = false): void {
    const requestId = ++this.requestId;
    this.loading = true;
    this.error = false;
    this.service
      .list({
        days: this.days,
        group: this.autoGroup ? undefined : this.group,
        page: this.page,
        limit: PAGE_SIZE,
        q: this.q.trim() || undefined,
        noRef: this.noRef,
        fresh,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (d) => {
          if (requestId !== this.requestId) return; // คำตอบของคำขอเก่า (กดเร็ว ๆ)
          this.apply(d);
          this.loading = false;
        },
        error: () => {
          if (requestId !== this.requestId) return;
          this.error = true;
          this.loading = false;
        },
      });
  }

  search(): void {
    this.search$.next();
  }

  setGroup(g: MergeGroup): void {
    this.autoGroup = false;
    if (g === this.group && !this.loading && this.data) return;
    this.group = g;
    this.page = 1;
    this.load();
  }

  setDays(d: number): void {
    if (d === this.days) return;
    this.days = d;
    this.page = 1;
    this.load();
  }

  setNoRef(): void {
    this.page = 1;
    this.load();
  }

  go(p: number): void {
    if (p < 1 || p > this.lastPage || p === this.page) return;
    this.page = p;
    this.load();
  }

  /** ตัวเลขบนกล่อง — กลุ่ม PR ผูกไม่ได้ นับตาม toggle "รวมที่ไม่มีเลขงาน" */
  tileCount(t: MergeTotals, g: MergeGroup): number {
    if (g === 'unmatched') return this.noRef ? t.unmatched : t.unmatched - t.unmatchedNoRef;
    return t[g];
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

  minutesAgo(iso: string | null | undefined): number {
    return iso ? (Date.now() - new Date(iso).getTime()) / 60000 : Infinity;
  }

  ago(iso: string | null | undefined): string {
    const m = this.minutesAgo(iso);
    if (!Number.isFinite(m)) return '—';
    if (m < 1) return 'เมื่อสักครู่';
    if (m < 60) return `${Math.floor(m)} นาทีก่อน`;
    if (m < 60 * 24) return `${Math.floor(m / 60)} ชม. ก่อน`;
    return `${Math.floor(m / 60 / 24)} วันก่อน`;
  }

  day(iso: string | null | undefined): string {
    return fmt(DAY_FMT, iso);
  }

  dayTime(iso: string | null | undefined): string {
    return fmt(DAY_TIME_FMT, iso);
  }

  color(status: string | null): string {
    return stageMeta(status).color;
  }

  trackRow = (_: number, v: CardView) => v.card.key;
  trackSlot = (_: number, s: RepoSlot) => s.label;
  trackPr = (_: number, u: UnmatchedPr) => `${u.repo}#${u.number}`;

  private apply(d: MainMergesPage): void {
    this.data = d;
    this.group = d.group; // BE อาจเลือกกลุ่มให้ (ครั้งแรก) หรือ
    this.page = d.page; //   ปรับหน้าที่เกินหน้าสุดท้าย
    this.autoGroup = false;

    // คอลัมน์ repo ชุดเดียวกันทุกแถว: repo ที่ sync มา + repo ที่โผล่ในหน้านี้
    const repos = [...new Set([...(d.sync?.repos ?? []), ...d.cards.flatMap((c) => c.repos.map((r) => r.repo))])].sort();
    this.repoLabels = repos.map((r) => this.labelOf(r));
    this.views = d.cards.map((c) => this.toView(c, repos));

    // ค้นหาแล้วกลุ่มนี้ว่าง แต่เจอในกลุ่มอื่น → ปุ่มพาไป
    const f = d.found;
    this.elsewhere =
      f && !d.total
        ? this.tiles
            .filter((m) => m.id !== d.group)
            .map((m) => ({ id: m.id, title: m.title, n: this.tileCount(f, m.id) }))
            .filter((x) => x.n > 0)
        : [];
  }

  private toView(c: MergeCard, repos: string[]): CardView {
    const byRepo = new Map(c.repos.map((r) => [r.repo, r]));
    const slots: RepoSlot[] = repos.map((repo) => {
      const m = byRepo.get(repo) ?? null;
      const tip = m
        ? m.prs
            .map((p) => `#${p.number} ${p.state === 'merged' ? 'merged ' + this.day(p.mergedAt) : this.prStateLabel[p.state]} · ${p.branch}`)
            .join('\n')
        : '';
      return { label: m?.label ?? this.labelOf(repo), merge: m, tip };
    });

    const via = new Set<string>();
    for (const p of c.repos.flatMap((r) => r.prs)) {
      if (p.matchedBy === 'title') via.add('หัวข้อ PR');
      else if (p.matchedBy !== 'branch' && p.via) via.add(p.via);
    }
    return { card: c, slots, via: via.size ? [...via].join(', ') : null };
  }

  /** ป้ายสั้นของ repo (ให้ตรงกับ BE repoLabel) */
  private labelOf(repo: string): string {
    const name = repo.split('/').pop() ?? repo;
    if (/backend|api$/i.test(name)) return 'BE';
    if (/frontend$/i.test(name)) return 'FE';
    return name;
  }
}
