import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { MailTrackingComponent } from './mail-tracking/mail-tracking.component';
import { MainMergesComponent } from './main-merges/main-merges.component';
import { UatVerdictsComponent } from './uat/uat-verdicts.component';

const holoColors = [
  { tail: 'rgba(196,181,253,.85)', head: '#f9a8d4', glow: 'rgba(244,114,182,.7)' },
  { tail: 'rgba(165,243,252,.85)', head: '#93c5fd', glow: 'rgba(96,165,250,.65)' },
  { tail: 'rgba(249,168,212,.85)', head: '#f0abfc', glow: 'rgba(232,121,249,.65)' },
  { tail: 'rgba(254,215,170,.8)', head: '#fde68a', glow: 'rgba(251,191,36,.55)' },
  { tail: 'rgba(167,243,208,.85)', head: '#a5f3fc', glow: 'rgba(45,212,191,.55)' },
];

type Tab = 'uat' | 'mail' | 'merge';

/** แท็บจาก URL hash (#uat / #mail / #merge) — ไม่รู้จัก = UAT */
const tabFromHash = (): Tab =>
  window.location.hash === '#mail' ? 'mail' : window.location.hash === '#merge' ? 'merge' : 'uat';

type MeteorDecoration = {
  id: number;
  top: number;
  left: number;
  width: number;
  delay: string;
  angle: string;
  tail: string;
  head: string;
  glow: string;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MailTrackingComponent, MainMergesComponent, UatVerdictsComponent],
  template: `
    <div class="app-shell">
      <div #ambience class="holo-ambience" aria-hidden="true">
        <span class="ambient-blob blob-violet"></span>
        <span class="ambient-blob blob-pink"></span>
        <span class="ambient-blob blob-cyan"></span>
        <span class="ambient-blob blob-peach"></span>
        <span *ngFor="let meteor of meteors; trackBy: trackDecoration" class="ambient-meteor"
              [attr.data-meteor-id]="meteor.id"
              [style.top.%]="meteor.top" [style.left.%]="meteor.left"
              [style.width.px]="meteor.width" [style.animation-delay]="meteor.delay"
              [style.--meteor-angle]="meteor.angle" [style.--meteor-tail]="meteor.tail"
              [style.--meteor-head]="meteor.head" [style.--meteor-glow]="meteor.glow"><i></i><b></b><em></em></span>
      </div>
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark fx-holo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1c.6 6 5 10.4 11 11-6 .6-10.4 5-11 11C11.4 17 7 12.6 1 12 7 11.4 11.4 7 12 1Z"/></svg>
          </span>
          <span class="brand-copy"><strong>Jira Due</strong><small>UAT &amp; Mail tracker</small></span>
        </div>

        <nav class="tabs" aria-label="เมนูหลัก">
          <button class="tab" [class.active]="tab === 'uat'" [class.fx-shine]="tab === 'uat'" [attr.aria-current]="tab === 'uat' ? 'page' : null"
                  (click)="open('uat')">UAT อนุมัติ</button>
          <button class="tab" [class.active]="tab === 'mail'" [class.fx-shine]="tab === 'mail'" [attr.aria-current]="tab === 'mail' ? 'page' : null"
                  (click)="open('mail')">Track Mail</button>
          <button class="tab" [class.active]="tab === 'merge'" [class.fx-shine]="tab === 'merge'" [attr.aria-current]="tab === 'merge' ? 'page' : null"
                  (click)="open('merge')">Merge เข้า main</button>
        </nav>

        <span class="workspace-label">Jira &amp; Mail</span>
      </header>

      <app-uat-verdicts *ngIf="tab === 'uat'"></app-uat-verdicts>
      <app-mail-tracking *ngIf="tab === 'mail'"></app-mail-tracking>
      <app-main-merges *ngIf="tab === 'merge'"></app-main-merges>
      <div class="sparkle-trail" aria-hidden="true">
        <span #cursorGlow class="cursor-glow"></span>
        <span *ngFor="let spark of sparks; trackBy: trackSpark" class="pointer-spark"
              [class.spark-a]="spark.alternate === 0" [class.spark-b]="spark.alternate === 1"
              [class.spark-dot]="spark.dot" [class.spark-large]="spark.large"
              [style.left.px]="spark.x" [style.top.px]="spark.y"
              [style.width.px]="spark.size" [style.height.px]="spark.size"
              [style.color]="spark.color" [style.--spark-x.px]="spark.dx" [style.--spark-y.px]="spark.dy">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C12.7 6.6 17.4 11.3 24 12c-6.6.7-11.3 5.4-12 12C11.3 17.4 6.6 12.7 0 12 6.6 11.3 11.3 6.6 12 0Z"/><circle cx="12" cy="12" r="2.4" fill="white"/></svg>
        </span>
      </div>
    </div>
  `,
  styles: [
    `
      .app-shell { position: relative; min-height: 100vh; padding: 24px 0 40px; overflow: hidden; isolation: isolate; }
      .holo-ambience { position: absolute; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
      .ambient-blob { position: absolute; width: 580px; height: 580px; border-radius: 50%; animation: ambient-blob-drift 20s ease-in-out infinite; }
      .blob-violet { top: -205px; right: -130px; background: radial-gradient(circle, rgba(196,181,253,.62), transparent 69%); }
      .blob-pink { top: -160px; left: -180px; background: radial-gradient(circle, rgba(249,168,212,.57), transparent 69%); animation-delay: -7s; }
      .blob-cyan { top: 37%; right: -225px; background: radial-gradient(circle, rgba(165,243,252,.5), transparent 69%); animation-delay: -12s; }
      .blob-peach { bottom: -250px; left: -120px; background: radial-gradient(circle, rgba(254,215,170,.43), transparent 69%); animation-delay: -4s; }
      .ambient-meteor { position: absolute; height: 3px; border-radius: 3px; background: linear-gradient(90deg, transparent, var(--meteor-tail) 42%, rgba(255,255,255,.92) 80%, var(--meteor-head)); box-shadow: 0 0 9px var(--meteor-glow), 0 0 22px var(--meteor-glow); opacity: 0; animation: ambient-meteor 6s linear infinite; }
      .ambient-meteor::before { content: ''; position: absolute; top: -28px; right: -27px; width: 58px; height: 58px; border-radius: 50%; background: radial-gradient(circle, #fff, var(--meteor-glow) 28%, transparent 74%); filter: blur(3px); }
      .ambient-meteor::after { content: ''; position: absolute; top: -5px; right: 30px; width: 4px; height: 4px; border-radius: 50%; background: #fff; box-shadow: -20px 8px 0 var(--meteor-head), -46px -8px 0 #fff, -72px 7px 0 var(--meteor-tail), -105px -6px 0 #fff, -135px 5px 0 var(--meteor-head); animation: meteor-glitter .55s ease-in-out infinite alternate; }
      .ambient-meteor i, .ambient-meteor b, .ambient-meteor em { position: absolute; display: block; background: #fff; clip-path: polygon(50% 0, 60% 39%, 100% 50%, 60% 61%, 50% 100%, 40% 61%, 0 50%, 40% 39%); filter: drop-shadow(0 0 6px var(--meteor-head)) drop-shadow(0 0 12px #fff); animation: meteor-head-twinkle .8s ease-in-out infinite alternate; }
      .ambient-meteor i { top: -11px; right: -10px; width: 25px; height: 25px; }
      .ambient-meteor b { top: -5px; right: 50px; width: 12px; height: 12px; animation-delay: -.4s; }
      .ambient-meteor em { top: -3px; right: 112px; width: 8px; height: 8px; animation-delay: -.7s; }
      .sparkle-trail { position: fixed; inset: 0; z-index: 80; pointer-events: none; }
      .cursor-glow { position: fixed; top: 0; left: 0; width: 56px; height: 56px; opacity: 0; pointer-events: none; will-change: transform; transition: opacity .16s ease-out; }
      .cursor-glow::before { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.92) 0%, rgba(244,114,182,.57) 18%, rgba(167,139,250,.34) 42%, rgba(103,232,249,.16) 60%, transparent 76%); filter: blur(3px); animation: cursor-aura 1.25s ease-in-out infinite alternate; }
      .cursor-glow::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 16% 31%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 81% 20%, #f9a8d4 0 2px, transparent 3px), radial-gradient(circle at 85% 73%, #a5f3fc 0 1.5px, transparent 2.5px), radial-gradient(circle at 26% 82%, #fde68a 0 1.5px, transparent 2.5px); filter: drop-shadow(0 0 4px #f472b6); animation: cursor-glints 1.9s linear infinite; }
      .pointer-spark { position: absolute; display: block; filter: drop-shadow(0 0 8px currentColor); animation: pointer-spark-fade .9s cubic-bezier(.2,.7,.3,1) both; }
      .pointer-spark svg { display: block; width: 100%; height: 100%; }
      .pointer-spark.spark-b { animation-name: pointer-spark-fade-b; }
      .pointer-spark.spark-large { filter: drop-shadow(0 0 11px currentColor) drop-shadow(0 0 16px currentColor); }
      .pointer-spark.spark-dot { border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor, 0 0 15px currentColor; }
      .pointer-spark.spark-dot svg { display: none; }
      @keyframes ambient-blob-drift { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(48px,-36px) scale(1.08); } 66% { transform: translate(-36px,28px) scale(.94); } }
      @keyframes ambient-meteor { 0% { transform: rotate(var(--meteor-angle)) translateX(-240px); opacity: 0; } 6% { opacity: .95; } 36% { opacity: .95; } 51%,100% { transform: rotate(var(--meteor-angle)) translateX(1050px); opacity: 0; } }
      @keyframes meteor-glitter { from { opacity: .35; transform: scale(.7); } to { opacity: 1; transform: scale(1.2); } }
      @keyframes meteor-head-twinkle { from { scale: .85; rotate: 0deg; } to { scale: 1.15; rotate: 90deg; } }
      @keyframes cursor-aura { from { opacity: .7; scale: .82; } to { opacity: 1; scale: 1.14; } }
      @keyframes cursor-glints { 0% { opacity: .55; rotate: 0deg; scale: .85; } 50% { opacity: 1; scale: 1.13; } 100% { opacity: .55; rotate: 180deg; scale: .85; } }
      @keyframes pointer-spark-fade { 0% { opacity: 1; transform: translate(-50%,-50%) scale(1.1) rotate(0); } 100% { opacity: 0; transform: translate(calc(-50% + var(--spark-x)),calc(-50% + var(--spark-y))) scale(.15) rotate(180deg); } }
      @keyframes pointer-spark-fade-b { 0% { opacity: 1; transform: translate(-50%,-50%) scale(1.1) rotate(0); } 100% { opacity: 0; transform: translate(calc(-50% + var(--spark-x)),calc(-50% + var(--spark-y))) scale(.15) rotate(-160deg); } }
      .topbar {
        position: relative; z-index: 1;
        display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px;
        max-width: 1256px; min-height: 82px; margin: 0 auto; padding: 12px 16px;
        border: 1.5px solid transparent; border-radius: 26px;
        background: linear-gradient(120deg, rgba(255,255,255,.92), rgba(249,238,255,.86) 52%, rgba(235,249,255,.9)) padding-box,
                    linear-gradient(110deg, #c4b5fd, #f9a8d4 36%, #a5f3fc 72%, #fde68a) border-box;
        box-shadow: inset 0 1px 0 #fff, 0 14px 40px -18px rgba(140,90,177,.32), 0 0 22px rgba(196,181,253,.16);
        backdrop-filter: blur(18px) saturate(170%);
      }
      .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .brand-mark { display: grid; place-items: center; width: 46px; height: 46px; flex: 0 0 46px; color: #6d28d9; border-radius: 15px; background: linear-gradient(120deg, #e6dcff, #fbd5eb, #d8f2ff, #ffedc9); box-shadow: 0 0 0 5px rgba(255,255,255,.42), 0 0 24px rgba(249,168,212,.44), 0 0 32px rgba(165,243,252,.28), 0 8px 22px -8px rgba(155,105,188,.46), inset 0 0 0 2px rgba(255,255,255,.9); }
      .brand-mark svg { width: 25px; height: 25px; filter: drop-shadow(0 0 5px rgba(255,255,255,.95)) drop-shadow(0 0 9px rgba(192,132,252,.55)); }
      .brand-copy { display: flex; flex-direction: column; line-height: 1.2; white-space: nowrap; }
      .brand-copy strong { font: 700 22px var(--font-display); color: var(--text); }
      .brand-copy small { font-size: 12.5px; color: var(--muted); }
      .tabs {
        display: flex;
        gap: 6px; padding: 5px; border-radius: 999px;
        background: rgba(237, 229, 251, .64); border: 1px solid rgba(255, 255, 255, .95);
      }
      .tab {
        min-height: 44px; padding: 0 20px; border: 1px solid transparent; border-radius: 999px;
        background: transparent; color: #4c1d95; font: 600 14px var(--font-body);
        white-space: nowrap; cursor: pointer;
      }
      .tab:hover:not(.active) { background: rgba(255, 255, 255, .7); }
      .tab.active { color: #4c1d95; border-color: #c4a9ec; background: radial-gradient(circle at 12% 26%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 89% 72%, #fff 0 1px, transparent 2px), linear-gradient(120deg, #e6dcff, #fbd5eb 56%, #d8f2ff); box-shadow: inset 0 1px 0 #fff, 0 9px 22px -10px rgba(150,90,184,.42), 0 0 0 3px rgba(244,114,182,.1); text-shadow: 0 1px 0 rgba(255,255,255,.8); }
      .tab.active::before { content: '✦'; position: absolute; top: 5px; right: 10px; color: #ad78da; font-size: 9px; line-height: 1; text-shadow: 0 0 5px #fff, 0 0 9px rgba(192,132,252,.8); animation: tab-glint 2.3s ease-in-out infinite alternate; pointer-events: none; }
      .tab:focus-visible { outline: 2px solid #a78bfa; outline-offset: 3px; }
      .workspace-label { justify-self: end; padding: 8px 13px; border: 1px solid #e2d3f5; border-radius: 999px; background: linear-gradient(120deg, #f8f2ff, #eef8ff); color: #5b318f; font-size: 13px; font-weight: 600; white-space: nowrap; }
      @keyframes tab-glint { from { opacity: .45; transform: rotate(-20deg) scale(.7); } to { opacity: 1; transform: rotate(18deg) scale(1.2); } }
      app-uat-verdicts, app-mail-tracking, app-main-merges { display: block; position: relative; z-index: 1; }
      @media (prefers-reduced-motion: reduce) { .holo-ambience, .sparkle-trail { display: none; } .tab.active::before { animation: none; } }
      @media (max-width: 900px) {
        .topbar { margin: 0 16px; grid-template-columns: 1fr auto; }
        .tabs { grid-column: 1 / -1; grid-row: 2; justify-self: stretch; }
        .tab { flex: 1; }
      }
      @media (max-width: 520px) {
        .app-shell { padding-top: 12px; }
        .topbar { display: flex; flex-direction: column; align-items: stretch; margin: 0 12px; padding: 12px; }
        .brand-copy strong { font-size: 19px; }
        .workspace-label { display: none; }
        .tabs { width: 100%; overflow-x: auto; }
        .tab { min-width: 0; padding: 0 10px; font-size: 13px; }
      }
    `,
  ],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('ambience') private ambience!: ElementRef<HTMLElement>;
  @ViewChild('cursorGlow') private cursorGlow!: ElementRef<HTMLElement>;
  tab: Tab = tabFromHash();
  readonly meteors: MeteorDecoration[] = Array.from({ length: 12 }, (_, id) =>
    this.createMeteor(id, `${-(id * .5).toFixed(1)}s`));
  sparks: Array<{ id: number; x: number; y: number; size: number; color: string; dx: number; dy: number; alternate: number; dot: boolean; large: boolean }> = [];
  private sparkId = 0;
  private lastSpark = { x: -999, y: -999, time: 0 };
  private cursorFrame = 0;
  private cursorPosition = { x: 0, y: 0 };
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly sparkColors = ['#c4b5fd', '#f9a8d4', '#93c5fd', '#fde68a', '#a7f3d0', '#f0abfc'];
  private readonly onPointerMoveOutsideAngular = (event: PointerEvent): void => {
    this.moveCursorGlow(event);
    this.onPointerMove(event);
  };
  private readonly hideCursorGlow = (): void => {
    if (this.cursorFrame) window.cancelAnimationFrame(this.cursorFrame);
    this.cursorFrame = 0;
    this.cursorGlow.nativeElement.style.opacity = '0';
  };
  private readonly onMeteorIterationOutsideAngular = (event: AnimationEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('ambient-meteor') ||
        !event.animationName.endsWith('ambient-meteor')) return;
    const meteor = this.meteors[Number(target.dataset['meteorId'])];
    if (!meteor) return;
    this.zone.run(() => Object.assign(meteor, this.createMeteor(meteor.id, meteor.delay)));
  };

  constructor(private readonly zone: NgZone) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onPointerMoveOutsideAngular, { passive: true });
      window.addEventListener('blur', this.hideCursorGlow);
      document.documentElement.addEventListener('pointerleave', this.hideCursorGlow);
      this.ambience.nativeElement.addEventListener('animationiteration', this.onMeteorIterationOutsideAngular);
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('pointermove', this.onPointerMoveOutsideAngular);
    window.removeEventListener('blur', this.hideCursorGlow);
    document.documentElement.removeEventListener('pointerleave', this.hideCursorGlow);
    this.ambience.nativeElement.removeEventListener('animationiteration', this.onMeteorIterationOutsideAngular);
    if (this.cursorFrame) window.cancelAnimationFrame(this.cursorFrame);
  }

  trackSpark(_index: number, spark: { id: number }): number { return spark.id; }
  trackDecoration(_index: number, item: { id: number }): number { return item.id; }

  private createMeteor(id: number, delay: string): MeteorDecoration {
    const color = holoColors[Math.floor(Math.random() * holoColors.length)];
    const edge = Math.floor(Math.random() * 3);
    const across = 12 + Math.random() * 76;
    const along = 8 + Math.random() * 58;
    const angle = edge === 0 ? 18 + Math.random() * 24 :    // left → right/down
      edge === 1 ? 138 + Math.random() * 24 :              // right → left/down
      55 + Math.random() * 70;                             // top → down
    return {
      id,
      top: edge === 2 ? -9 : along,
      left: edge === 0 ? -8 : edge === 1 ? 106 : across,
      width: 160 + Math.round(Math.random() * 70),
      delay,
      angle: `${angle.toFixed(1)}deg`,
      tail: color.tail,
      head: color.head,
      glow: color.glow,
    };
  }

  private moveCursorGlow(event: PointerEvent): void {
    if (event.pointerType === 'touch' || this.reducedMotion.matches) {
      this.hideCursorGlow();
      return;
    }
    this.cursorPosition.x = event.clientX;
    this.cursorPosition.y = event.clientY;
    if (this.cursorFrame) return;
    this.cursorFrame = window.requestAnimationFrame(() => {
      this.cursorFrame = 0;
      const glow = this.cursorGlow.nativeElement;
      glow.style.transform = `translate3d(${this.cursorPosition.x - 28}px, ${this.cursorPosition.y - 28}px, 0)`;
      glow.style.opacity = '1';
    });
  }

  private onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch' || this.reducedMotion.matches) return;
    const now = performance.now();
    if (now - this.lastSpark.time < 80 ||
        (now - this.lastSpark.time < 120 && Math.hypot(event.clientX - this.lastSpark.x, event.clientY - this.lastSpark.y) < 18)) return;
    this.lastSpark = { x: event.clientX, y: event.clientY, time: now };
    const burst = Array.from({ length: 6 }, (_, index) => {
      const id = ++this.sparkId;
      const dot = index === 2 || index === 5;
      const large = index === 0 || index === 3;
      return {
        id,
        x: event.clientX + Math.random() * 40 - 20,
        y: event.clientY + Math.random() * 40 - 20,
        size: dot ? 6 + Math.round(Math.random() * 5) : large ? 26 + Math.round(Math.random() * 14) : 14 + Math.round(Math.random() * 12),
        color: this.sparkColors[id % this.sparkColors.length],
        dx: Math.round(Math.random() * 86 - 43),
        dy: Math.round(Math.random() * 76 - 22),
        alternate: id % 2,
        dot,
        large,
      };
    });
    this.zone.run(() => { this.sparks = [...this.sparks.slice(-60), ...burst]; });
    const ids = new Set(burst.map(spark => spark.id));
    window.setTimeout(() => {
      this.zone.run(() => { this.sparks = this.sparks.filter(spark => !ids.has(spark.id)); });
    }, 900);
  }

  open(tab: Tab): void {
    this.tab = tab;
    window.location.hash = tab;
  }

  @HostListener('window:hashchange')
  onHashChange(): void {
    this.tab = tabFromHash();
  }
}
