import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { MailTrackingComponent } from './mail-tracking/mail-tracking.component';
import { UatVerdictsComponent } from './uat/uat-verdicts.component';

const holoColors = [
  { tail: 'rgba(196,181,253,.85)', head: '#f9a8d4', glow: 'rgba(244,114,182,.7)', star: '#a78bfa', accent: '#f472b6' },
  { tail: 'rgba(165,243,252,.85)', head: '#93c5fd', glow: 'rgba(96,165,250,.65)', star: '#38bdf8', accent: '#a5f3fc' },
  { tail: 'rgba(249,168,212,.85)', head: '#f0abfc', glow: 'rgba(232,121,249,.65)', star: '#e879f9', accent: '#f9a8d4' },
  { tail: 'rgba(254,215,170,.8)', head: '#fde68a', glow: 'rgba(251,191,36,.55)', star: '#fbbf24', accent: '#fed7aa' },
  { tail: 'rgba(167,243,208,.85)', head: '#a5f3fc', glow: 'rgba(45,212,191,.55)', star: '#34d399', accent: '#67e8f9' },
];

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
  imports: [CommonModule, MailTrackingComponent, UatVerdictsComponent],
  template: `
    <div class="app-shell">
      <div class="holo-ambience" aria-hidden="true">
        <span class="ambient-blob blob-violet"></span>
        <span class="ambient-blob blob-pink"></span>
        <span class="ambient-blob blob-cyan"></span>
        <span class="ambient-blob blob-peach"></span>
        <span *ngFor="let star of stars; trackBy: trackDecoration" class="ambient-star"
              [style.top.%]="star.top" [style.left.%]="star.left" [style.width.px]="star.size"
              [style.height.px]="star.size" [style.--star-color]="star.color"
              [style.--star-accent]="star.accent" [style.--star-glow]="star.glow"
              [style.animation-delay]="star.delay"></span>
        <span *ngFor="let meteor of meteors; trackBy: trackDecoration" class="ambient-meteor"
              [style.top.%]="meteor.top" [style.left.%]="meteor.left"
              [style.width.px]="meteor.width" [style.animation-delay]="meteor.delay"
              [style.--meteor-angle]="meteor.angle" [style.--meteor-tail]="meteor.tail"
              [style.--meteor-head]="meteor.head" [style.--meteor-glow]="meteor.glow"
              (animationiteration)="rerollMeteor(meteor, $event)"><i></i><b></b><em></em></span>
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
        </nav>

        <span class="workspace-label">Jira &amp; Mail</span>
      </header>

      <app-uat-verdicts *ngIf="tab === 'uat'"></app-uat-verdicts>
      <app-mail-tracking *ngIf="tab === 'mail'"></app-mail-tracking>
      <div class="sparkle-trail" aria-hidden="true">
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
      .ambient-star { position: absolute; display: block; background: linear-gradient(135deg, var(--star-color), #fff 40%, var(--star-accent) 65%, var(--star-color)); background-size: 240% 240%; clip-path: polygon(50% 0, 60% 39%, 100% 50%, 60% 61%, 50% 100%, 40% 61%, 0 50%, 40% 39%); filter: drop-shadow(0 0 6px var(--star-color)) drop-shadow(0 0 14px var(--star-glow)); animation: ambient-drift 12s ease-in-out infinite, ambient-twinkle 2.2s ease-in-out infinite, ambient-star-holo 3.1s ease-in-out infinite; }
      .ambient-meteor { position: absolute; height: 3px; border-radius: 3px; background: linear-gradient(90deg, transparent, var(--meteor-tail) 42%, rgba(255,255,255,.92) 80%, var(--meteor-head)); box-shadow: 0 0 9px var(--meteor-glow), 0 0 22px var(--meteor-glow); opacity: 0; animation: ambient-meteor 18s linear infinite; }
      .ambient-meteor::before { content: ''; position: absolute; top: -28px; right: -27px; width: 58px; height: 58px; border-radius: 50%; background: radial-gradient(circle, #fff, var(--meteor-glow) 28%, transparent 74%); filter: blur(3px); }
      .ambient-meteor::after { content: ''; position: absolute; top: -5px; right: 30px; width: 4px; height: 4px; border-radius: 50%; background: #fff; box-shadow: -20px 8px 0 var(--meteor-head), -46px -8px 0 #fff, -72px 7px 0 var(--meteor-tail), -105px -6px 0 #fff, -135px 5px 0 var(--meteor-head); animation: meteor-glitter .55s ease-in-out infinite alternate; }
      .ambient-meteor i, .ambient-meteor b, .ambient-meteor em { position: absolute; display: block; background: #fff; clip-path: polygon(50% 0, 60% 39%, 100% 50%, 60% 61%, 50% 100%, 40% 61%, 0 50%, 40% 39%); filter: drop-shadow(0 0 6px var(--meteor-head)) drop-shadow(0 0 12px #fff); animation: meteor-head-twinkle .8s ease-in-out infinite alternate; }
      .ambient-meteor i { top: -11px; right: -10px; width: 25px; height: 25px; }
      .ambient-meteor b { top: -5px; right: 50px; width: 12px; height: 12px; animation-delay: -.4s; }
      .ambient-meteor em { top: -3px; right: 112px; width: 8px; height: 8px; animation-delay: -.7s; }
      .sparkle-trail { position: fixed; inset: 0; z-index: 80; pointer-events: none; }
      .pointer-spark { position: absolute; display: block; filter: drop-shadow(0 0 6px currentColor) drop-shadow(0 0 4px #fff); animation: pointer-spark-fade 1s cubic-bezier(.2,.7,.3,1) both; }
      .pointer-spark svg { display: block; width: 100%; height: 100%; }
      .pointer-spark.spark-b { animation-name: pointer-spark-fade-b; }
      .pointer-spark.spark-large { filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 13px currentColor) drop-shadow(0 0 3px #fff); }
      .pointer-spark.spark-dot { border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor, 0 0 15px currentColor; }
      .pointer-spark.spark-dot svg { display: none; }
      @keyframes ambient-blob-drift { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(48px,-36px) scale(1.08); } 66% { transform: translate(-36px,28px) scale(.94); } }
      @keyframes ambient-drift { 0%,100% { translate: 0 0; } 25% { translate: 34px -22px; } 50% { translate: -12px -44px; } 75% { translate: -32px 12px; } }
      @keyframes ambient-twinkle { 0%,100% { opacity: .32; scale: .45; rotate: 0deg; } 50% { opacity: 1; scale: 1.2; rotate: 90deg; } }
      @keyframes ambient-star-holo { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
      @keyframes ambient-meteor { 0% { transform: rotate(var(--meteor-angle)) translateX(-240px); opacity: 0; } 2% { opacity: .95; } 12% { opacity: .95; } 17%,100% { transform: rotate(var(--meteor-angle)) translateX(1050px); opacity: 0; } }
      @keyframes meteor-glitter { from { opacity: .35; transform: scale(.7); } to { opacity: 1; transform: scale(1.2); } }
      @keyframes meteor-head-twinkle { from { scale: .85; rotate: 0deg; } to { scale: 1.15; rotate: 90deg; } }
      @keyframes pointer-spark-fade { 0% { opacity: 1; transform: translate(-50%,-50%) scale(1.1) rotate(0); } 100% { opacity: 0; transform: translate(calc(-50% + var(--spark-x)),calc(-50% + var(--spark-y))) scale(.15) rotate(180deg); } }
      @keyframes pointer-spark-fade-b { 0% { opacity: 1; transform: translate(-50%,-50%) scale(1.1) rotate(0); } 100% { opacity: 0; transform: translate(calc(-50% + var(--spark-x)),calc(-50% + var(--spark-y))) scale(.15) rotate(-160deg); } }
      .topbar {
        position: relative; z-index: 1;
        display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px;
        max-width: 1256px; min-height: 82px; margin: 0 auto; padding: 12px 16px;
        background: rgba(255, 255, 255, .64); border: 1px solid rgba(255, 255, 255, .95);
        border-radius: 26px; box-shadow: 0 14px 40px -18px rgba(124, 58, 237, .35);
        backdrop-filter: blur(18px) saturate(170%);
      }
      .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .brand-mark { display: grid; place-items: center; width: 46px; height: 46px; flex: 0 0 46px; color: #fff; border-radius: 15px; background: linear-gradient(120deg, #a78bfa, #f472b6, #38bdf8, #fbbf24); box-shadow: 0 8px 22px -6px rgba(192, 38, 211, .55), inset 0 0 0 2px rgba(255, 255, 255, .6); }
      .brand-mark svg { width: 25px; height: 25px; }
      .brand-copy { display: flex; flex-direction: column; line-height: 1.2; white-space: nowrap; }
      .brand-copy strong { font: 700 22px var(--font-display); color: var(--text); }
      .brand-copy small { font-size: 12.5px; color: var(--muted); }
      .tabs {
        display: flex;
        gap: 6px; padding: 5px; border-radius: 999px;
        background: rgba(237, 233, 254, .8); border: 1px solid rgba(255, 255, 255, .95);
      }
      .tab {
        min-height: 44px; padding: 0 20px; border: 0; border-radius: 999px;
        background: transparent; color: #4c1d95; font: 600 14px var(--font-body);
        white-space: nowrap; cursor: pointer;
      }
      .tab:hover:not(.active) { background: rgba(255, 255, 255, .7); }
      .tab.active { color: #fff; background: linear-gradient(120deg, #7c3aed, #c026d3 60%, #db2777); box-shadow: 0 10px 24px -10px rgba(192, 38, 211, .7); }
      .tab:focus-visible { outline: 2px solid #7c3aed; outline-offset: 3px; }
      .workspace-label { justify-self: end; padding: 8px 13px; border: 1px solid #ddd6fe; border-radius: 999px; background: #f5f3ff; color: #5b21b6; font-size: 13px; font-weight: 600; white-space: nowrap; }
      app-uat-verdicts, app-mail-tracking { display: block; position: relative; z-index: 1; }
      @media (prefers-reduced-motion: reduce) { .holo-ambience, .sparkle-trail { display: none; } }
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
        .tabs { width: 100%; }
        .tab { min-width: 0; padding: 0 10px; font-size: 13px; }
      }
    `,
  ],
})
export class AppComponent {
  tab: 'uat' | 'mail' = window.location.hash === '#mail' ? 'mail' : 'uat';
  readonly stars = Array.from({ length: 72 }, (_, id) => {
    const color = holoColors[id % holoColors.length];
    return {
      id,
      top: 3 + (id * 37) % 93,
      left: id % 4 === 0 ? 1 + (id * 13) % 7 :
        id % 4 === 1 ? 92 + (id * 11) % 7 : 9 + (id * 61) % 82,
      size: id % 8 === 0 ? 19 + id % 5 : 5 + (id * 7) % 10,
      color: color.star,
      accent: color.accent,
      glow: color.glow,
      delay: `${-(id * 1.7) % 12}s, ${-(id * .7) % 2.2}s, ${-(id * .9) % 3.1}s`,
    };
  });
  readonly meteors: MeteorDecoration[] = Array.from({ length: 36 }, (_, id) =>
    this.createMeteor(id, `${-(id * .5).toFixed(1)}s`));
  sparks: Array<{ id: number; x: number; y: number; size: number; color: string; dx: number; dy: number; alternate: number; dot: boolean; large: boolean }> = [];
  private sparkId = 0;
  private lastSpark = { x: -999, y: -999, time: 0 };
  private readonly sparkColors = ['#c4b5fd', '#f9a8d4', '#93c5fd', '#fde68a', '#a7f3d0', '#f0abfc'];

  trackSpark(_index: number, spark: { id: number }): number { return spark.id; }
  trackDecoration(_index: number, item: { id: number }): number { return item.id; }

  rerollMeteor(meteor: MeteorDecoration, event: AnimationEvent): void {
    // Child glitter animations bubble through this element; only reroll on a full flight.
    if (event.target !== event.currentTarget || !event.animationName.endsWith('ambient-meteor')) return;
    Object.assign(meteor, this.createMeteor(meteor.id, meteor.delay));
  }

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

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const now = performance.now();
    if (now - this.lastSpark.time < 50 ||
        (now - this.lastSpark.time < 80 && Math.hypot(event.clientX - this.lastSpark.x, event.clientY - this.lastSpark.y) < 18)) return;
    this.lastSpark = { x: event.clientX, y: event.clientY, time: now };
    const burst = Array.from({ length: 4 }, (_, index) => {
      const id = ++this.sparkId;
      const dot = index === 2;
      return {
        id,
        x: event.clientX + Math.random() * 28 - 14,
        y: event.clientY + Math.random() * 28 - 14,
        size: dot ? 4 + Math.round(Math.random() * 4) : index === 0 ? 18 + Math.round(Math.random() * 12) : 9 + Math.round(Math.random() * 10),
        color: this.sparkColors[id % this.sparkColors.length],
        dx: Math.round(Math.random() * 68 - 34),
        dy: Math.round(Math.random() * 64 - 18),
        alternate: id % 2,
        dot,
        large: index === 0,
      };
    });
    this.sparks = [...this.sparks.slice(-92), ...burst];
    const ids = new Set(burst.map(spark => spark.id));
    window.setTimeout(() => { this.sparks = this.sparks.filter(spark => !ids.has(spark.id)); }, 1000);
  }

  open(tab: 'uat' | 'mail'): void {
    this.tab = tab;
    window.location.hash = tab;
  }

  @HostListener('window:hashchange')
  onHashChange(): void {
    this.tab = window.location.hash === '#mail' ? 'mail' : 'uat';
  }
}
