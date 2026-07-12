// =====================================================================
//  Stage taxonomy — single source สำหรับ presentation ของ Jira workflow
//  (mirror ของ backend common/status-taxonomy.ts §14; เทียบด้วย lower(status))
//  สี map 1:1 กับกลุ่ม ball-ownership · label เป็นภาษาไทยที่ผู้ใช้รู้จัก
// =====================================================================

export type StageGroup =
  | 'active'
  | 'waiting_tester'
  | 'waiting_user'
  | 'waiting_senior'
  | 'rework'
  | 'in_transit'
  | 'terminal'
  | 'other';

/** ลำดับ stage คงที่ของ workflow (ใช้วาด Stage Strip) */
export const STAGE_ORDER = [
  'pending',
  'todo',
  'inprogress',
  'test',
  'testing',
  'uat',
  'ready to deploy',
  'deployed',
  'repost',
  'smoke test',
  'done',
];

// alias ของ status ที่เขียนได้หลายแบบ → คำใน STAGE_ORDER
const ALIAS: Record<string, string> = {
  'to do': 'todo',
  'in progress': 'inprogress',
  'testing acc': 'testing',
};

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
const canon = (s: string) => ALIAS[s] ?? s;

const GROUP: Record<string, StageGroup> = {
  pending: 'active',
  todo: 'active',
  inprogress: 'active',
  test: 'waiting_tester',
  testing: 'waiting_tester',
  'testing acc': 'waiting_tester',
  uat: 'waiting_user',
  'smoke test': 'waiting_user',
  'ready to deploy': 'waiting_senior',
  'uat fail': 'rework',
  'cr reject': 'rework',
  'repost fail': 'rework',
  'smoke test fail': 'rework',
  deployed: 'in_transit',
  repost: 'in_transit',
  done: 'terminal',
  closed: 'terminal',
};

// ป้ายไทยที่ผู้ใช้รู้จัก (ไม่ใช่ศัพท์ระบบ)
const LABEL: Record<string, string> = {
  pending: 'รอเริ่ม',
  todo: 'จะทำ',
  inprogress: 'กำลังทำ',
  test: 'รอเทสต์',
  testing: 'กำลังเทสต์',
  'testing acc': 'เทสต์บัญชี',
  uat: 'รอ user เซ็น',
  'smoke test': 'รอ user (smoke)',
  'ready to deploy': 'รอ senior',
  'uat fail': 'UAT ไม่ผ่าน',
  'cr reject': 'CR ตีกลับ',
  'repost fail': 'repost ไม่ผ่าน',
  'smoke test fail': 'smoke ไม่ผ่าน',
  deployed: 'ขึ้นระบบแล้ว',
  repost: 'ส่งกลับแก้',
  done: 'เสร็จ',
  closed: 'ปิด',
};

// fail state อยู่ที่ stage ไหนบน strip (ใช้เติมแถบ)
const FAIL_AT: Record<string, string> = {
  'uat fail': 'uat',
  'smoke test fail': 'smoke test',
  'repost fail': 'repost',
  'cr reject': 'ready to deploy',
};

const GROUP_COLOR: Record<StageGroup, string> = {
  active: 'var(--st-active)',
  waiting_tester: 'var(--st-tester)',
  waiting_user: 'var(--st-user)',
  waiting_senior: 'var(--st-senior)',
  rework: 'var(--st-rework)',
  in_transit: 'var(--st-neutral)',
  terminal: 'var(--st-neutral)',
  other: 'var(--st-neutral)',
};

export interface StageMeta {
  group: StageGroup;
  label: string; // ป้ายไทย
  color: string; // CSS var
  index: number; // ตำแหน่งบน STAGE_ORDER (-1 = นอกลำดับ)
  isFail: boolean;
}

export function stageMeta(status: string | null | undefined): StageMeta {
  const s = norm(status);
  const group = GROUP[s] ?? 'other';
  const isFail = group === 'rework';
  const stageKey = isFail ? FAIL_AT[s] ?? '' : canon(s);
  const index = STAGE_ORDER.indexOf(stageKey);
  return {
    group,
    label: LABEL[s] ?? (status ? String(status) : '—'),
    color: GROUP_COLOR[group],
    index,
    isFail,
  };
}

// ── backward-compat helpers (ใช้อยู่ในหลายที่) ────────────────────────
export function categoryOf(status: string | null | undefined): StageGroup {
  return stageMeta(status).group;
}
export function waitingLabelOf(status: string | null | undefined): string | null {
  switch (categoryOf(status)) {
    case 'waiting_user':
      return 'รอ user';
    case 'waiting_tester':
      return 'รอ tester';
    case 'waiting_senior':
      return 'รอ senior';
    default:
      return null;
  }
}
