# Full Workflow Testing Guide (Role-wise)

Simple step-by-step guide to test the full Decent ERP design-to-production workflow — what to set up first, who does what, and in which order.

---

## Part 0 — Start the app (do this first)

1. Open terminal in the `decent-erp` folder.
2. Run:

```bash
cp .env.example .env
docker compose up postgres redis minio minio-init -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

3. Open **http://localhost:3000**

### Demo passwords

- Admin: `Admin@123`
- Everyone else: `Demo@123`

| Email | Role |
|---|---|
| `admin@decent-erp.local` | System Admin |
| `designhead@decent-erp.local` | Design Head |
| `sketch@decent-erp.local` | Sketch Designer |
| `punch@decent-erp.local` | Punching Designer |
| `machine@decent-erp.local` | Machine Operator |
| `checker@decent-erp.local` | Sample Checker |
| `costing@decent-erp.local` | Costing Team |
| `production@decent-erp.local` | Production Head |
| `management@decent-erp.local` | Management |

**Tip:** Use two browsers (or one normal + one Incognito) so you can switch roles without logging out every time.

---

## Part 1 — What Admin should check first (masters)

Login: **System Admin** (`admin@decent-erp.local` / `Admin@123`)

Do this before creating a real design. Without masters, create-design will fail or look empty.

| Step | Where | What to check |
|---|---|---|
| 1 | Admin → Employees | Demo users exist and roles look correct |
| 2 | Admin → Roles & Access | Each role shows its permissions |
| 3 | Master Data → Master Catalog | Seasons, product categories, fabrics, machines, correction types exist |
| 4 | Process Masters | Main processes / sub-processes exist |
| 5 | Workflow Patterns | Patterns like Standard Saree / Suit / Kurti / Lehenga exist |

You don’t need to create everything from scratch if seed already filled them. Just confirm they are there.

---

## Part 2 — Who does what (role cheat sheet)

| Role | Main job in the flow |
|---|---|
| **Design Head** | Creates design, assigns people, approves sketch, requests final approval, sends to production |
| **Sketch Designer** | Draws / finishes sketch task |
| **Punching Designer** | Digitize / punch task |
| **Sample Checker** | Checks punch + sample; also first approval level |
| **Machine Operator** | Runs machine sample |
| **Costing Team** | Enters costs (needed before final management approve) |
| **Production Head** | Accepts handoff → writes instruction → releases |
| **Management** | Final approval + marks design live |
| **System Admin** | Setup, masters, employees — not daily design work |

---

## Part 3 — Happy path (test one design end-to-end)

Follow this order. After each step, check the design status moved forward.

### Step 1 — Design Head creates the concept

Login: `designhead@decent-erp.local` / `Demo@123`

1. Open **New Concept / Create Design**
2. Fill:
   - Product type / season
   - Workflow pattern (e.g. Standard Saree)
   - Other required fields
3. Save / create

**Check**

- Design is created
- Task list appears from the pattern
- Concept review moves forward automatically
- Sketch task is ready (assigned to Sketch Designer, or you assign it)

---

### Step 2 — Sketch Designer finishes sketch

Login: `sketch@decent-erp.local` / `Demo@123`

1. Open **My Tasks / My Action Center / My Work**
2. Open the sketch task
3. **Start** → (optional **Hold** with reason → **Resume**) → **End**
4. Add remark; upload file if required

**Check**

- Timer works
- Task completes
- Design moves toward sketch approval

---

### Step 3 — Design Head approves sketch

Login: Design Head again

1. Open the design / approval action for sketch
2. **Approve** sketch

**Check**

- Punching stage becomes available next

*(If you return sketch instead: Sketch Designer must rework — good negative test later.)*

---

### Step 4 — Punching Designer finishes punch

Login: `punch@decent-erp.local` / `Demo@123`

1. My Tasks → open punch task
2. Start → End (with remark / file if needed)

**Check**

- Punch check becomes ready for Sample Checker

---

### Step 5 — Sample Checker approves punch

Login: `checker@decent-erp.local` / `Demo@123`

1. Open punch-check task / quality action
2. **Approve** punch

**Check**

- Material / fabric stages can proceed

---

### Step 6 — Material + fabric stages

Usually Design Head or the assigned person completes:

- Material request
- Fabric issue

On **Materials** (`/work/materials`), if needed:

- Create stock / indent
- Mark available / issue

**Check**

- Completing MAT_REQ / FABRIC_ISSUE works
- Machine sample becomes ready

---

### Step 7 — Machine Operator runs sample

Login: `machine@decent-erp.local` / `Demo@123`

1. My Tasks → machine sample
2. Start → End

**Check**

- Sample check becomes ready

---

### Step 8 — Sample Checker approves sample

Login: Sample Checker

1. Sample check task
2. Choose **Approve** (not Reject / Re-sample for happy path)

**Check**

- Costing stage becomes available

---

### Step 9 — Costing Team enters costs

Login: `costing@decent-erp.local` / `Demo@123`

1. Open design → **Costing**
2. Add development / standard cost lines
3. Finish costing stage if shown

**Check**

- Costs visible on design
- Final approval can proceed later (without costs, Management approve will block)

---

### Step 10 — Design Head requests management approval

Login: Design Head

1. When all stages are done, open **Ready for sign-off / Approvals**
2. **Request management approval**

**Check**

- Design enters approval chain

---

### Step 11 — Approval chain (3 levels)

Do in this order:

| Order | Login | Action |
|---|---|---|
| 1 | Sample Checker | Approve (Level 1) |
| 2 | Design Head | Approve (Level 2) |
| 3 | Management (`management@decent-erp.local`) | Approve (Level 3) |

**Check**

- After Level 3 with costs present → design is fully approved
- Production handoff becomes available

---

### Step 12 — Production handoff + release

Login: Design Head  
→ Complete **production handoff**

Login: `production@decent-erp.local` / `Demo@123`

1. **Accept** handoff
2. Write **production instruction**
3. Complete checklist → **Release**

**Check**

- Design is released
- Management sees live-review queue

---

### Step 13 — Management marks live

Login: Management (`management@decent-erp.local` / `Demo@123`)

1. Open released design / live review
2. **Mark live**

**Check**

- Design status = **Live** → journey complete

---

## Part 4 — Extra tests (after happy path works)

| Test | Who | What to do | Expected |
|---|---|---|---|
| Hold / resume | Any executor | Hold without reason | Blocked |
| Hold with reason | Any executor | Hold → Resume | Works |
| End without remark / file | Executor | Try finish empty | Blocked |
| Sample Re-sample | Checker | Choose Re-sample | Machine Operator gets work again |
| Sample Reject | Checker | Reject + correction | Rework path opens |
| Approve without costs | Management | Final approve early | Blocked until costing adds costs |
| Production return | Production Head | Return for clarification | Goes back; history kept |
| Correction raise | Design Head / Checker | Raise correction to a stage | That role sees rework |

---

## Part 5 — Simple day-to-day “who opens what”

| Screen | Main roles |
|---|---|
| New Concept / Designs | Design Head |
| My Tasks | Sketch, Punch, Machine, Checker |
| Corrections | Design Head, Sketch, Punch, Checker |
| Approvals | Checker, Design Head, Management |
| Costing | Costing Team |
| Production desk / release | Design Head + Production Head |
| Live review | Management |
| Materials | Design Head / assigned ops |
| Live Team Time / KPI | Design Head, Management (watch only; not required for flow) |
| Admin / Masters | System Admin |

---

## Part 6 — Fast smoke checklist (one sitting)

1. Admin: masters + users OK
2. Design Head: create design
3. Sketch → Design Head approve sketch
4. Punch → Checker approve punch
5. Material / fabric → Machine sample
6. Checker approve sample
7. Costing enters costs
8. Request approval → Checker → Design Head → Management
9. Handoff → Production accept → instruct → release
10. Management marks live

If all 10 work, the **whole workflow is healthy**.

---

## Optional automatic test

If the app is already running:

```bash
npm run test:e2e:reuse -- e2e/full-workflow-pipeline.spec.ts
```

That runs the pipeline in Playwright. Still do the manual role walk once so you understand each person’s screen.

---

## Related docs

- [`docs/business-flows/design-to-production-journey.md`](business-flows/design-to-production-journey.md) — detailed business flow + QA paths
- [`docs/UAT_SIGN_OFF_CHECKLIST.md`](UAT_SIGN_OFF_CHECKLIST.md) — UAT sign-off checklist
- [`README.md`](../README.md) — setup, roles, and demo accounts
