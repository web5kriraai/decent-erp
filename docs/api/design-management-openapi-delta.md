# API delta - master prompt §14 vs Decent ERP routes

Base URL: `/api`. Auth: session JWT. All mutations derive `employeeId` from session.

## Implemented (path may differ)

| Master | Actual |
|--------|--------|
| POST/GET/PATCH `/designs` | `/api/designs`, `/api/designs/[id]` |
| POST `/designs/{id}/tasks/generate` | `/api/designs/[id]/tasks/generate` |
| GET `/tasks/my` | `/api/tasks/my`, `/api/tasks/action-center` |
| POST `/tasks/{id}/start\|hold\|resume\|end` | `/api/tasks/[id]/start` etc. |
| POST `/workday/close` | `/api/workday/close` |
| POST `/corrections` | `/api/corrections` |
| PATCH `/corrections/{id}` | `/api/corrections/[id]` |
| POST `/corrections/{id}/approve\|reject` | `/api/corrections/[id]/approve`, `/reject` |
| POST `/approvals` | `/api/approvals` |
| GET `/approvals/inbox` | `/api/approvals/inbox` |
| POST costs | `/api/designs/[id]/costs` |
| request-final-approval | `/api/designs/[id]/request-approval` |
| production accept/instruction/release | `/api/production/*` |
| mark-live | `/api/production/live` |
| GET `/designs/{id}/history` | `/api/designs/[id]/history` |
| GET/POST admin permissions | `/api/admin/rbac-matrix`, roles permissions |
| GET/POST assignment-rules | `/api/admin/assignment-rules` |

## Assign / reassign

| Master | Actual |
|--------|--------|
| POST `/designs/{id}/assign` | PATCH `/api/tasks/[id]/assign` |
| POST `/designs/{id}/reassign` | Same + DESIGN_ASSIGN / DESIGN_REASSIGN |

## Permissions (representative)

| Route | Permission |
|-------|------------|
| POST `/designs` (AUTOMATIC) | DESIGN_CREATE + DESIGN_ASSIGN_AUTO (or DESIGN_ASSIGN) |
| POST `/designs` (MANUAL) | DESIGN_CREATE + DESIGN_ASSIGN_MANUAL (or DESIGN_ASSIGN) |
| GET `/designs/[id]/history` | WORKFLOW_VIEW_HISTORY (or MASTER_ADMIN) |
| POST corrections | CORRECTION_REQUEST (or CORRECTION_RAISE) |
| PATCH/approve correction | CORRECTION_EXECUTE / CORRECTION_APPROVE |
| Timer mutations | TASK_EXECUTE + Idempotency-Key optional |

## Errors

Standard: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict (concurrency, running task), 422 business rule, 500 + `correlationId`.
