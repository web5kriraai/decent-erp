# Prisma schema delta (master-spec alignment)

Applied via migrations in this repo. PostgreSQL + Prisma (not raw SQL Server DDL).

## DesignCorrection (§7)

| Column | Type | Purpose |
|--------|------|---------|
| `reviewer_employee_id` | Int? FK Employee | Who must approve/reject after rework (defaults to `raised_by` on stage-originated corrections) |
| `cycle_no` | Int default 1 | Increment per design + route stage on rejected correction |

Indexes: `(design_id, route_to_sub_process_id, cycle_no)`.

## AssignmentRule (§4.3)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | Int | PK |
| `company_id` | Int | Tenant scope |
| `name` | String | Admin label |
| `priority` | Int | Lower = evaluated first |
| `active` | Boolean | |
| `strategy` | String | `WORKLOAD_SKILL` (default), extensible |
| `criteria_json` | Json | Optional filters: productTypeId, skillId, department, roundRobin |

## TaskTimerIdempotency (§6)

| Column | Type | Purpose |
|--------|------|---------|
| `idempotency_key` | String unique | Client header |
| `task_id` | BigInt | |
| `employee_id` | Int | |
| `action` | String | START/HOLD/RESUME/END |
| `created_at_utc` | DateTime | TTL cleanup |

## Permission seeds (§8)

New rows in `permissions` - see `src/lib/permissions.ts` and migration seed script. Existing `DESIGN_ASSIGN` and `CORRECTION_RAISE` retained for backward compatibility.
