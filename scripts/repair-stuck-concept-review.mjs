/**
 * Auto-complete open Concept Review tasks so Sketch (and downstream) unlock.
 * Run once after deploy to fix in-flight designs created before auto-advance shipped.
 *
 * Usage: npx tsx scripts/repair-stuck-concept-review.mjs
 */
import {
  autoAdvanceConceptReview,
  listDesignsWithStuckConceptReview,
} from "../src/lib/services/concept-review-auto-advance.ts";

async function main() {
  const stuck = await listDesignsWithStuckConceptReview();
  if (stuck.length === 0) {
    console.log("No designs with stuck Concept Review.");
    return;
  }

  console.log(`Found ${stuck.length} design(s) with stuck Concept Review.`);

  let advanced = 0;
  let skipped = 0;

  for (let i = 0; i < stuck.length; i += 1) {
    const design = stuck[i];
    const pct = Math.round(((i + 1) / stuck.length) * 100);
    process.stdout.write(`[${i + 1}/${stuck.length}] (${pct}%) ${design.ideaRef} ... `);

    const actorId = design.designHeadEmployeeId ?? design.createdById;
    const result = await autoAdvanceConceptReview(
      design.id,
      actorId,
      `repair-concept-review-${design.id}`,
      { remark: "Auto-approved by system repair" },
    );

    if (result.advanced) {
      advanced += 1;
      console.log("advanced");
    } else {
      skipped += 1;
      console.log(`skipped (${result.reason})`);
    }
  }

  console.log(`Done. Repaired ${advanced} design(s); skipped ${skipped}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/db.ts");
    await prisma.$disconnect();
  });
