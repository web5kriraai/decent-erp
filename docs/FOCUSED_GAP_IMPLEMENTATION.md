# Focused Gap Implementation Plan

Priorities confirmed from Spec Understanding & Gap Analysis. **Status: implemented.**

1. Component type multi-select on design create
2. Due-soon / overdue scheduled notifications + material/machine hold notifications
3. ERP design-success sync hardening

## 1. Component types on create — done

- Shared `DesignComponentTypePicker` wired into `DesignCreateForm` and `DesignCreateModal`
- Sends `componentTypeIds` on create (API already supported)

## 2. Notifications — done

- `MATERIAL_HOLD` / `MACHINE_HOLD` message subjects
- Post-commit notify from `holdTask` for `WAIT_MATERIAL` / `MACHINE_NA`
- `task-due-notification-service` + BullMQ `SCAN_TASK_DUES` every 15m
- Manual trigger: `POST /api/admin/scan-task-dues` (MASTER_ADMIN)
- Dedup via recent `notification_outbox` rows (12h)
- Env: `TASK_DUE_SOON_HOURS` (default 24)

## 3. Design-success ERP sync — done

- Partial upserts (only defined fields)
- Live ingest after each `syncAllErpModules` batch (logged, not swallowed)
- Empty success metric row seeded on production release
- Safer stage-complete metric updates
- UI: simulated sync disabled/labeled; return qty + repeat orders on manual form
