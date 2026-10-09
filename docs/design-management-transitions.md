# Design Management - Status Transitions

Reference for master-spec §9. **Enforcement** lives in services; this document is the contract.

## DesignConcept (`DesignStatus`)

| From | To | Trigger | Permission / gate |
|------|-----|---------|-------------------|
| DRAFT | ACTIVE | Create completes + tasks generated | DESIGN_CREATE |
| DRAFT | ON_HOLD, CLOSED | Manual status edit | DESIGN_CREATE |
| ACTIVE | ON_HOLD, APPROVAL_PENDING, DRAFT, CLOSED | Manual / workflow | DESIGN_CREATE |
| ON_HOLD | ACTIVE, DRAFT, CLOSED | Manual | DESIGN_CREATE |
| APPROVAL_PENDING | ACTIVE, ON_HOLD, REJECTED | Management chain | DESIGN_APPROVE |
| APPROVAL_PENDING | APPROVED | All management levels approved | DESIGN_APPROVE + costing gate |
| APPROVED | ON_HOLD, CLOSED | Manual | DESIGN_CREATE |
| APPROVED | PRODUCTION_ACCEPTED | Production handoff accept | PRODUCTION_RELEASE |
| REJECTED | ACTIVE, DRAFT, CLOSED | Manual | DESIGN_CREATE |
| PRODUCTION_RELEASED | CLOSED | Manual | PRODUCTION_RELEASE |
| LIVE | CLOSED | Manual | DESIGN_APPROVE |
| * | APPROVED / PRODUCTION_RELEASED / LIVE | Dedicated flows only | Not via generic PATCH |

Gated transitions use approval, production release, and mark-live services - not `assertAllowedDesignStatusTransition` alone.

**Display labels** (master prompt → UI): see `src/lib/design-status-display.ts`.

## DesignTask (`TaskStatus`)

| From | To | Action | Notes |
|------|-----|--------|-------|
| PENDING | ASSIGNED | Dependency satisfied + assignee resolved | `unlockNextDependentTasks` |
| ASSIGNED | RUNNING | POST start | One RUNNING per employee (409) |
| RUNNING | ON_HOLD | POST hold | Hold reason required |
| ON_HOLD | RUNNING | POST resume | |
| RUNNING / ON_HOLD | CHECKING / COMPLETED | POST end | Files/checklist gates |
| ASSIGNED / RUNNING | CORRECTION_REQUIRED | Stage reject / correction raise | |
| CORRECTION_REQUIRED | RUNNING / ASSIGNED | Assignee rework + start | |
| * | COMPLETED | Stage approval approve / end | |
| * | SKIPPED / CANCELLED | Workflow override / admin | WORKFLOW_OVERRIDE |

Stage-specific behavior: `resolveStageBehavior` + `StageCapabilities` JSON on sub-process master.

## DesignCorrection (`CorrectionStatus`)

| From | To | Action |
|------|-----|--------|
| OPEN | IN_PROGRESS | Assignee starts work / PATCH |
| IN_PROGRESS | CHECKING | Submit correction |
| CHECKING | DONE | Reviewer approve |
| CHECKING | REJECTED | Reviewer reject → new cycle |
| * | REJECTED | Reviewer reject from OPEN/IN_PROGRESS |

Legacy statuses ASSIGNED/CHECKING normalize to IN_PROGRESS in queue utils.

## Management sign-off (`DesignApproval.decision`)

PENDING → APPROVED | REJECTED | CORRECTION_REQUIRED per level sequence (Checker → Design Head → Management).
