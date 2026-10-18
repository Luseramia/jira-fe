export type DueStatus = 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'none';

export interface Issue {
  key: string;
  summary: string;
  status: string | null;
  statusCategory: string | null;
  priority: string | null;
  issueType: string | null;
  projectKey: string | null;
  projectName: string | null;
  assigneeName: string | null;
  labels: string[];
  parentKey: string | null;
  url: string | null;
  dueDate: string | null;
  daysUntilDue: number | null;
  dueStatus: DueStatus;
  commentCount: number;
}

export interface Comment {
  id: string;
  authorName: string | null;
  body: string;
  created: string | null;
  updated: string | null;
}

export interface Summary {
  overdue: number;
  dueToday: number;
  dueSoon: number;
  upcoming: number;
  total: number;
}

// ── Weekly report ────────────────────────────────────────────────────
export type BlockedReason =
  | 'waiting_user'
  | 'waiting_tester'
  | 'waiting_senior'
  | 'rework_dev'
  | 'in_transit'
  | 'other';

export interface PlanItem {
  key: string;
  summary: string;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  sprintName: string | null;
  sprintState: string | null;
}

export interface ActivityItem {
  issueKey: string;
  summary: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  changedAt: string | null;
  changedBy: string | null;
}

export interface BlockedItem {
  key: string;
  summary: string;
  status: string | null;
  blockedReason: BlockedReason;
  blockedSince: string | null;
  daysBlocked: number | null;
  dueDate: string | null;
  overdue: boolean;
}

export interface DoneItem {
  issueKey: string;
  summary: string | null;
  fromStatus: string | null;
  changedAt: string | null;
  doneBy: string | null;
}

export interface AssigneeReport {
  assignee: string;
  plan: PlanItem[];
  activity: ActivityItem[];
  blocked: BlockedItem[];
  done: DoneItem[];
}

export interface WeeklyReport {
  generatedAt: string;
  weekStart: string;
  weekEnd: string;
  assignees: AssigneeReport[];
}

// ── Tickets (ticket ↔ Jira tracking) ─────────────────────────────────
/** การติดตามเมล UAT/smoke (v_uat_followup) — optional เพื่อ degrade เงียบถ้า backend ยังไม่ส่ง */
export interface UatFollowup {
  stage: 'uat' | 'smoke test';
  sentAt: string | null;
  deadlineDate: string | null;
  daysWaiting: number;
  overdue: boolean;
}

export interface TicketRow {
  ticketNumber: string;
  company: string | null;
  requesterName: string | null;
  department: string | null;
  urgency: string | null;
  ticketType: string | null;
  title: string | null;
  finalStatus: string | null;
  sheetStatus: string | null;
  jiraFlag: boolean | null;
  createdAtSheet: string | null;
  jiraKey: string | null;
  jiraStatus: string | null;
  jiraAssignee: string | null;
  jiraCount: number;
  flagMismatch: boolean;
  followup?: UatFollowup | null;
}

export interface TicketListResponse {
  rows: TicketRow[];
  total: number;
  page: number;
  limit: number;
}

export interface MailSummary {
  waiting: number;
  overdue: number;
  longestDays: number;
}

export interface TicketFilters {
  departments: string[];
  requesters: string[];
  finalStatuses: string[];
  sheetStatuses: string[];
}

export interface TimelineStep {
  fromStatus: string | null;
  toStatus: string | null;
  changedAt: string | null;
  changedBy: string | null;
}

export interface LinkedIssue {
  jiraKey: string;
  summary: string | null;
  status: string | null;
  assignee: string | null;
  url: string;
  matchedBy: string; // customfield | summary | manual
  confidence: string; // auto | manual
  linkedAt: string | null;
  timeline: TimelineStep[];
}

export interface TicketFull {
  ticketNumber: string;
  runningNumber: number | null;
  company: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  department: string | null;
  ticketType: string | null;
  urgency: string | null;
  title: string | null;
  description: string | null;
  attachmentUrl: string | null;
  finalStatus: string | null;
  sheetStatus: string | null;
  staffPro: string | null;
  jiraFlag: boolean | null;
  accountingFlag: boolean | null;
  totalHours: number | null;
  deadlineGap: number | null;
  createdAtSheet: string | null;
  sentAtPro: string | null;
  finishedAtPro: string | null;
}

export interface TicketDetail {
  ticket: TicketFull;
  issues: LinkedIssue[];
  followup?: UatFollowup | null;
}

export interface TicketQuery {
  department?: string;
  requester?: string;
  finalStatus?: string;
  sheetStatus?: string;
  hasJira?: boolean;
  mismatch?: boolean;
  mailWaiting?: boolean;
  year?: number;
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

// ── Overview (ภาพรวม) ────────────────────────────────────────────────
export interface OverviewCoverage {
  total: number;
  linked: number;
  unlinked: number;
  mismatch: number;
}
export interface OverviewGroupCount {
  group: string;
  count: number;
}
export interface OverviewAgingCard {
  key: string;
  status: string | null;
  category: string;
  assignee: string | null;
  daysInStage: number;
  ticketNumbers: string[];
}
export interface OverviewAging {
  over7: number;
  over14: number;
  oldest: OverviewAgingCard[];
}
export interface OverviewDept {
  department: string;
  tickets: number;
  linked: number;
  /** ตั๋วที่การ์ด Jira ที่เชื่อมทุกใบเป็น done/closed */
  done: number;
}
export interface Overview {
  coverage: OverviewCoverage;
  byGroup: OverviewGroupCount[];
  aging: OverviewAging;
  byDepartment: OverviewDept[];
  generatedAt: string;
}

/** preset ที่ Overview ส่งให้หน้า Tickets ตอน drill-down */
export interface TicketPreset {
  hasJira?: 'all' | 'yes' | 'no';
  mismatch?: boolean;
  department?: string;
  finalStatus?: string;
  year?: number;
}

// ── Workload (Jira-side, group by assignee) ──────────────────────────
export interface WorkloadCard {
  key: string;
  summary: string;
  status: string | null;
  category: string;
  ballOwner: string; // dev | tester | user | senior | none
  waitingLabel: string | null;
  daysInStage: number | null;
  ticketNumbers: string[];
  followup?: UatFollowup | null;
}

export interface WorkloadGroup {
  assignee: string;
  total: number;
  inHand: number;
  waitingOnOthers: number;
  byStatus: Record<string, number>;
  cards: WorkloadCard[];
}

// ── UAT verdict (เมลผลทดสอบจาก MOTO.OS → ขยับการ์ด Jira) ─────────────
export type UatVerdictState =
  | 'new'
  | 'pending_approval'
  | 'transitioned'
  | 'skipped'
  | 'needs_review'
  | 'dismissed'
  | 'superseded';

export interface UatVerdict {
  id: number;
  ticketNo: string;
  verdict: 'pass' | 'fail';
  actorName: string | null;
  subject: string | null;
  receivedAt: string;
  state: UatVerdictState;
  jiraKey: string | null;
  jiraUrl: string | null;
  jiraSummary: string | null;
  /** สถานะตอน BE ประมวลผลล่าสุด */
  jiraStatus: string | null;
  /** สถานะสดจาก Jira ตอนเปิดหน้า (null = ดึงไม่ได้) */
  liveStatus: string | null;
  targetStatus: string | null;
  reason: string | null;
  attempts: number;
  lastError: string | null;
  transitionedAt: string | null;
  transitionedBy: string | null;
  updatedAt: string;
}

export interface UatVerdictList {
  pending: UatVerdict[];
  review: UatVerdict[];
  recent: UatVerdict[];
  queued: number;
  autoFail: boolean;
  jiraConfigured: boolean;
  liveError: string | null;
}

// ── Merge เข้า main (PR erp-backend / erp-frontend ↔ การ์ด SE) ─────────
// mirror ของ jira-be src/main-merges/main-merges.service.ts
export type MergePrState = 'merged' | 'open' | 'closed';
export type MergeMatchedBy = 'branch' | 'cr' | 'ticket' | 'title';
export type CardMergeState = 'merged' | 'partial' | 'open' | 'none';
export type MergeFlag = 'merged_not_moved' | 'no_pr' | 'open_after_deploy';
export type UnmatchedReason = 'cr_not_in_sheet' | 'cr_no_se' | 'ticket_no_se' | 'no_ref';

export interface MergePr {
  repo: string;
  repoLabel: string; // BE | FE
  number: number;
  title: string | null;
  branch: string;
  state: MergePrState;
  mergedAt: string | null;
  updatedAt: string | null;
  url: string | null;
  author: string | null;
  matchedBy: MergeMatchedBy | null;
  /** CR / ticket ที่ใช้ผูก (หรือที่หาไม่เจอ) */
  via: string | null;
}

export interface UnmatchedPr extends MergePr {
  reason: UnmatchedReason;
}

export interface RepoMerge {
  repo: string;
  label: string;
  state: MergePrState;
  latest: MergePr;
  lastMergedAt: string | null;
  prs: MergePr[]; // ใหม่ → เก่า
}

export interface MergeCard {
  key: string;
  url: string;
  summary: string | null;
  assignee: string | null;
  status: string | null;
  statusSource: 'live' | 'db' | null;
  state: CardMergeState;
  repos: RepoMerge[];
  lastMergedAt: string | null;
  lastActivityAt: string | null;
  flag: MergeFlag | null;
  flagText: string | null;
}

export interface MergeSync {
  prSyncedAt: string | null;
  prCount: number;
  repos: string[];
  sheetSyncedAt: string | null;
  sheetRows: number;
}

export type MergeGroup = 'attn' | 'waiting' | 'merged' | 'unmatched';

/** จำนวนทั้งช่วงวัน (ไม่ขึ้นกับคำค้นหา / หน้า) */
export interface MergeTotals {
  attn: number;
  waiting: number;
  merged: number;
  unmatched: number; // รวมที่ไม่มีเลขงาน
  unmatchedNoRef: number;
}

export interface MergeListParams {
  days: number;
  group?: MergeGroup; // ไม่ส่ง = BE เลือกกลุ่มแรกที่มีรายการ
  page: number;
  limit: number;
  q?: string;
  noRef?: boolean;
  fresh?: boolean; // ปุ่มรีเฟรช: ให้ BE เช็คข้อมูลใหม่จาก DB ก่อนตอบ
}

/** 1 หน้าของ 1 กลุ่ม — GET /api/main-merges */
export interface MainMergesPage {
  days: number;
  group: MergeGroup;
  page: number;
  limit: number;
  total: number; // แถวของกลุ่มนี้หลังค้นหา
  totals: MergeTotals;
  /** จำนวนที่ตรงคำค้นหาในแต่ละกลุ่ม (null = ไม่ได้ค้นหา) */
  found: MergeTotals | null;
  cards: MergeCard[]; // group ≠ unmatched
  unmatched: UnmatchedPr[]; // group = unmatched
  sync: MergeSync | null;
  jiraConfigured: boolean;
  liveError: string | null;
  notReady: string | null;
}
