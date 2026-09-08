# UAT Sign-off Checklist — E2E Prototype Parity + Master Catalog

Use after migrate + seed (`npx prisma migrate deploy` && `npx prisma db seed`).

## Master catalog

- [ ] Admin → Master Data → Master Catalog shows grouped tile grid (product, materials, specs, quality, related)
- [ ] Hub search filters master types; record counts load via `?summary=1`
- [ ] Deep link `?tab=catalog&type=SEASON` (or other type) opens that master list; Back clears `type`
- [ ] Open Product Category / Season / Fabric / Machine / Correction Type — create + deactivate works
- [ ] Detail view filter by code/name and Active / Inactive works
- [ ] New Design form: product, season, fabric, machine, stitching, grade, style, theme, celebrity, work type from catalog
- [ ] Component types selectable with per-component specs saved on create
- [ ] Edit Design updates fabric/machine/grade/stitching/catalog attributes

## Materials

- [ ] Materials (`/work/materials`): create stock and purchase-indent lines
- [ ] Mark Available / Issue updates status
- [ ] Completing MAT_REQ without material lines is blocked
- [ ] Completing MAT_REQ marks REQUESTED/INDENT → AVAILABLE
- [ ] Completing FABRIC_ISSUE marks AVAILABLE → ISSUED

## Media

- [ ] Create Design Concept → Media & references: queue Image / Video / File before submit
- [ ] Create Design Concept → Record voice → Add to queue → create uploads recorded audio
- [ ] After create with at least one image, detail opens without `?setup=images` when primary was set
- [ ] After create with failed media uploads, concept still exists; toast lists failures; retry on detail
- [ ] Design detail → Design Files: Upload tab auto-detects Image / Voice / Video / File (no media-type dropdown)
- [ ] Design detail → Record voice: Start / Stop / Send (mic permission denied shows clear message)
- [ ] Optional link upload to a design component
- [ ] Gallery filters All / Images / Voice / Video / Files
- [ ] Audio/video playback works; FILE rows show Download; image set-primary works
- [ ] Unsupported browser for MediaRecorder shows upload-file fallback message

## Workbenches

- [ ] Sketch / Punching / Sample boards (`/work/sketch`, `/work/punching`, `/work/samples`) list stage queues
- [ ] Sample Board: select job → assign MACHINE from catalog

## Reports / approvals / KPI

- [ ] Master Data → Concept Targets: set monthly target by season/product category
- [ ] Master Data `?tab=catalog|targets|kpi` deep links open the correct tab; `?tab=catalog&type=MACHINE` opens that type
- [ ] Materials design picker lists designs (limit query)
- [ ] Reports hub CSV exports (design, cost, material, delay, ranking)
- [ ] Approvals: select multiple management items → Approve Selected
- [ ] Master Data → KPI Weights: edit and save weight %

## Regression smoke

- [ ] Create design (automatic pattern) → assign → start/hold/end timer
- [ ] Raise correction (catalog types visible)
- [ ] Costing entry → approval chain → production release still works

## Notes

Structured masters (processes, skills, hold reasons, approval levels, checklist, KPI defs) remain on dedicated tables; hub tiles link out where applicable.
