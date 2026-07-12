# Work Tracking System — Handoff สำหรับ Claude Code

เอกสารนี้รวมบริบทจากหลาย session เพื่อใช้เขียนต่อใน Claude Code
**เป้าหมายปลายทาง:** ระบบติดตามงานที่ออกรายงานทุกวันอังคาร — สรุปงานที่แต่ละคนทำ, แพลนสัปดาห์หน้า, และงานติดปัญหาอยู่ที่ไหน (เน้น "งานที่รอ user" ซึ่งเป็น bottleneck หลัก)

---

## 1. บริบทองค์กร & ปัญหาที่จะแก้

ทีมเป็นฝั่ง **โปรแกรมเมอร์** งานไหลตาม flow นี้และมักค้างเพราะต้องรอคนนอกทีม (โดยเฉพาะ user) โดยที่ต้นทุนการรอตกอยู่ที่ dev (ค้าง, เลย due, ต้องตามเอง)

```
user เปิด ticket
  → pending → todo → inprogress        (dev ทำงาน)
  → test → testing                      (ส่งให้ tester / กำลังเทส)
  → uat                                 ⭐ รอ user เซ็นผ่านเมล   ← bottleneck
        ผ่าน → ready to deploy          (รอ senior review code)
        ไม่ผ่าน → uat fail              (กลับมา dev แก้)
  → ready to deploy
        ผ่าน → deployed
        ไม่ผ่าน → cr reject             (กลับมา dev แก้)
  → deployed → repost (บางงาน)
        ไม่ผ่าน → repost fail           (กลับมา dev แก้)
  → smoke test                          ⭐ รอ user ยืนยันหลัง deploy ← bottleneck
        ไม่ผ่าน → smoke test fail        (กลับมา dev แก้)
  → done
closed = ใช้กับ ticket ที่เปิดมาผิด (terminal)
```

### Status taxonomy — ลูกอยู่ในมือใคร (อ้างอิงสำคัญ)

| สถานะ (Jira) | หมวด (blocked_reason) | ลูกอยู่ที่ |
|---|---|---|
| pending, todo, inprogress | — (active dev) | dev |
| test, testing | `waiting_tester` | tester |
| **uat** | **`waiting_user`** ⭐ | **user (เซ็นเมล)** |
| **smoke test** | **`waiting_user`** ⭐ | **user (ยืนยันหลัง deploy)** |
| ready to deploy | `waiting_senior` | senior (review code) |
| uat fail, cr reject, repost fail, smoke test fail | `rework_dev` | dev (แก้กลับ) |
| deployed, repost | `in_transit` | กำลังเคลื่อน |
| done, closed | — (terminal) | จบ |

> หมายเหตุ casing: Jira เก็บชื่อสถานะตัวพิมพ์ไม่แน่นอน (`PENDING`, `To Do`, `In Progress`, `UAT FAIL` ฯลฯ) ทุก query เทียบด้วย `lower(status)` เพื่อกันพลาด

### แนวทางจัดการเชิงกระบวนการ (จาก session ติดตามงาน)
ไม่ใช่ตามถี่ขึ้น แต่ย้าย "ต้นทุนของการนิ่งเฉย" กลับไปที่ผู้รอ:
- ตั้ง **SLA ฝั่ง user** + default action เมื่อเงียบ (เช่น "ไม่ตอบใน X วัน = deemed accepted")
- ทำให้สถานะ **มองเห็นได้** ใน tracker (สถานะสาธารณะกดดันได้ดีกว่าแชตส่วนตัว)
- ให้ **ระบบเตือนแทนคน** (n8n auto-reminder) ตัดภาระและความเกรงใจ
- เกินรอบแล้ว **escalate เป็นเรื่องปกติ** กรอบเป็น "ขอช่วยปลดบล็อก" ไม่ใช่ตำหนิ
- ทำเป็น **policy ของทีม** ร่วมกับหัวหน้าทั้งสองฝั่ง ไม่ใช่ภาระส่วนตัว

---

## 2. ระบบเดิมที่มีอยู่แล้ว (dashboard)

โปรเจกต์ `jira-due-dashboard/` — full stack ที่ build ไว้แล้ว ผ่าน typecheck สะอาด

**Architecture:** `Jira → n8n (sync ทุก 22:00) → PostgreSQL → NestJS (TypeORM) → Angular 18`

- **Jira:** `sittidate-lueangon.atlassian.net`, project key `SE`, credential n8n = `jiraSoftwareCloudApi` (id `Jux4CxYDCvK7GB3f`)
- **n8n:** self-hosted, ใช้ HTTP Request node ตรงไป Jira (เลี่ยงข้อจำกัด built-in Jira node), Postgres upsert node v2.6, Discord webhook ต่อผ่าน n8n อยู่แล้ว
- **NestJS:** คำนวณ `dueStatus`/`daysUntilDue` ฝั่ง server (overdue / due_today / due_soon / upcoming, เกณฑ์ปรับด้วย env `DUE_SOON_DAYS`), ตัวแปลง ADF→text ที่ `common/adf.ts`
  - endpoints: `GET /api/issues`, `/api/issues/summary`, `/api/issues/:key/comments`
- **Angular 18 (standalone):** ธีมจอเข้ม "ops console", ฟอนต์ Space Grotesk / Inter / JetBrains Mono, การ์ดมี "urgency rail" แถบสีซ้ายโชว์จำนวนวัน, chip strip กรองตามความเร่งด่วน, comments drawer เลื่อนเข้า
- **Postgres credential** n8n = `jira_issues` (id `U7FCo1k1Vlsydp8G`)

### Jira field gotchas (สำคัญตอนเขียน sync)
- field ใน search เป็น lowercase ไม่มีตัวคั่น: `duedate` (ไม่ใช่ dueDate), `issuetype`, `statusCategory` เป็น nested ใต้ `status`
- `duedate` คืน `YYYY-MM-DD` ไม่มี time/tz → **ต้องตั้ง `TZ=Asia/Bangkok`** ที่ NestJS process ไม่งั้นเลข "เหลือกี่วัน" เหลื่อม ±1 วัน
- `customfield_10020` = **Sprint**, `customfield_10016` = Story Points, `customfield_10019` = Rank
- `comment` ที่ขอ inline ใน search จะ **truncate** ถ้า comment เยอะ → ต้องเรียก `GET /rest/api/3/issue/{key}/comment` แยกถ้าต้องการครบ
- `attachment` ต้องใส่ใน `fields` array ของ search ถึงจะ match media node ได้

---

## 3. ของที่เพิ่มใน session นี้

### ไฟล์ที่ส่งมอบ
| ไฟล์ | คือ |
|---|---|
| `All_issue_full.json` | n8n workflow ล่าสุด (issue sync + sprint + changelog branch) — ใช้ตัวนี้แทนของเก่า |
| `weekly_report.sql` | SQL รายงานรายสัปดาห์ 4 ส่วน group by assignee |

### การเปลี่ยนแปลงใน `All_issue_full.json`
1. **ขยาย JQL** ให้รวมสถานะที่กำลังรอ — เดิมมีแต่ `pending/todo/inprogress` + พวก `*FAIL` ตอนนี้เพิ่ม `test, testing, uat, ready to deploy, deployed, repost, smoke test` ด้วย → งานที่รอ user ถึงจะถูก sync เข้า DB (ไม่งั้นรายงาน blocked ว่างเปล่า)
2. **เพิ่ม sync sprint** — เพิ่ม `customfield_10020` ใน JQL fields, parse ใน Code node (เลือก sprint ตามลำดับ active > future > ตัวท้าย, รองรับทั้ง object และ string format), map ลง 3 คอลัมน์ใหม่
3. **เพิ่ม changelog branch** — แตกจาก `3. Split Issues1` ขนานกับ Code เดิม:
   `Get Changelog (HTTP) → Parse Status Transitions (Code) → Upsert Status History (PG)`
   - ดึง `GET /issue/{key}/changelog?maxResults=100`, batch 5 req/1s
   - กรองเฉพาะ `field === 'status'`, upsert match บน `id` (history id) → idempotent

---

## 4. Data model เป้าหมาย

### DDL ที่ต้องรันก่อน (ยังไม่ได้รัน — เป็นสาเหตุ error "Column sprint_id does not exist")
```sql
-- เพิ่มคอลัมน์ sprint ใน jira_issues
ALTER TABLE jira_issues
  ADD COLUMN IF NOT EXISTS sprint_id    INT,
  ADD COLUMN IF NOT EXISTS sprint_name  TEXT,
  ADD COLUMN IF NOT EXISTS sprint_state TEXT;

-- ตารางประวัติการเปลี่ยนสถานะ (กุญแจของรายงาน)
CREATE TABLE IF NOT EXISTS jira_status_history (
  id           BIGINT PRIMARY KEY,          -- changelog history id
  issue_key    TEXT REFERENCES jira_issues(key) ON DELETE CASCADE,
  from_status  TEXT,
  to_status    TEXT,
  changed_at   TIMESTAMPTZ,
  changed_by   TEXT
);
CREATE INDEX IF NOT EXISTS idx_status_history_key     ON jira_status_history(issue_key);
CREATE INDEX IF NOT EXISTS idx_status_history_changed ON jira_status_history(changed_at);
```

### ตารางที่มีอยู่
- `jira_issues` — key (PK), summary, status, status_category, priority, issue_type, project_key, project_name, assignee_name, assignee_account_id, parent_key, url, due_date (DATE), jira_updated, jira_created, comment_count, labels (array), raw (JSONB), synced_at **+ sprint_id, sprint_name, sprint_state (ใหม่)**
- `jira_comments` — id (PK), issue_key (FK), author_name, body_adf (JSONB), body_text, jira_created, jira_updated, synced_at
- `jira_comment_attachments` — ไฟล์แนบ เก็บใน SeaweedFS S3, URL ในตาราง
- `jira_status_history` — (ใหม่ ตาม DDL ข้างบน)

---

## 5. รายงานรายสัปดาห์ — `weekly_report.sql`

4 ส่วน group by assignee (ทุก query ใช้ `lower(status)`):

| ส่วน | คือ | แหล่งข้อมูล | สถานะ |
|---|---|---|---|
| **A. plan** | งานใน sprint active/future ที่ยังไม่จบ | `jira_issues.sprint_state` | ✅ พร้อม |
| **B. activity** | status เปลี่ยนใน 7 วัน (ใครทำอะไร) | `jira_status_history` | ✅ พร้อม |
| **C. blocked** | งานพ้นมือ dev แต่ยังไม่จบ + ค้างกี่วัน | `jira_issues` + history | ✅ พร้อม |
| **D. done** | เสร็จใน 7 วัน | history (to_status=done) | ⚠️ รอ branch 2 |

**ส่วน C (pain หลัก)** — auto `blocked_reason` ตาม taxonomy ข้อ 1, คำนวณ `days_blocked` จาก history (เข้าสถานะปัจจุบันมากี่วัน), เรียง `waiting_user` ขึ้นบนสุด, มี `overdue` flag

---

## 6. TODO — สิ่งที่จะเขียนต่อใน Claude Code

### หลัก (ทำให้รายงานใช้งานได้)
1. **NestJS endpoint** `GET /api/weekly-report?week=...` — คืน JSON ต่อ assignee:
   `{ assignee, plan[], activity[], blocked[], done[] }` (เอา query จาก `weekly_report.sql` มาห่อ; แต่ละ assignee เป็น group)
2. **Angular "Weekly" tab** — column/section ต่อคน, การ์ดแยกกลุ่ม plan / blocked / activity, ส่วน blocked ใช้ urgency rail สีเดิมโชว์ `days_blocked`, ปักธง `waiting_user` ให้เด่น (นี่คือสิ่งที่ต้องดูทุกอังคาร)
3. **TypeORM entity** สำหรับ `jira_status_history` + repository query (ใช้ raw query / QueryBuilder ก็ได้)

### เสริม (ทำเมื่อพร้อม)
4. **branch 2** ใน n8n — JQL กว้าง `project = SE AND updated >= -10d` (ทุกสถานะรวม done) → Get Changelog → Upsert Status History เพื่อจับ transition `→ done` (ทำให้ส่วน D ทำงาน)
5. **Auto-reminder** — n8n workflow ยิงเตือน `waiting_user` items อัตโนมัติตาม cadence (วันแรก/ครบ N วัน/ครบ M วัน CC หัวหน้า) + นับ `reminders_sent` → ลดการตามด้วยมือ
6. **SLA + deemed-accepted** logic — นับ business days ที่ค้างที่ uat/smoke test, แจ้งเตือนเมื่อเกิน threshold

---

## 7. Gotchas / สิ่งที่ต้องระวัง

- **FK ordering:** `jira_status_history.issue_key → jira_issues(key)` หมายความว่า issue ต้อง upsert ลง `jira_issues` **ก่อน** insert history ตอนนี้ branch upsert issue กับ changelog แตกจาก `3. Split Issues1` พร้อมกัน ถ้า history รันก่อนจะติด FK error → แก้โดยให้ changelog branch ต่อ **หลัง** node `Insert or update rows` หรือตัด FK ออกเป็น `issue_key TEXT` เฉยๆ
- **`duedate IS NOT EMPTY` ใน JQL:** ยังคงไว้ตามเดิม แต่ user บอกว่า "บางงาน" เท่านั้นที่มี due date → งานที่รอ user แต่ไม่มี due date จะ **ไม่โผล่** ในรายงาน ถ้าอยากเห็นงานค้างทุกตัวให้ลบ clause นี้ (dashboard จะมีงานเยอะขึ้น) — **ยังไม่ได้ตัดสินใจ**
- **done/closed ไม่อยู่ใน JQL หลัก:** เลยไม่ถูกจับ transition `→ done` → ส่วน D ต้องใช้ branch 2 (ข้อ 6.4)
- **case ของชื่อสถานะ:** Jira เก็บไม่สม่ำเสมอ → ใช้ `lower(status)` ทุกที่
- **changelog pagination:** ตอนนี้ `maxResults=100` ต่อ issue พอสำหรับ SE ปกติ ถ้า issue ไหน history ยาวเกิน 100 entries (ทุก field) ต้องวน `startAt`
- **TZ=Asia/Bangkok** ที่ NestJS process (เรื่อง duedate ±1 วัน)
- **comment truncation** ใน search — ดึงแยกถ้าต้องครบ

---

## 8. สรุป next action ทันที
1. รัน DDL ข้อ 4 (สร้างคอลัมน์ sprint + ตาราง status_history) — แก้ error ที่เจออยู่
2. แก้ลำดับ FK / decide เรื่อง duedate filter (ข้อ 7)
3. re-import `All_issue_full.json` → รัน sync 1 รอบ
4. ทดสอบ `weekly_report.sql` ส่วน C
5. เขียน endpoint + Angular Weekly tab (ข้อ 6.1–6.3)
