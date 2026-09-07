import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getConceptTargetAttainment,
  listConceptTargets,
  upsertConceptTarget,
} from "@/lib/services/concept-target-service";

const upsertSchema = z.object({
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  targetCount: z.number().int().min(0).max(100_000),
  seasonId: z.number().int().positive().nullable().optional(),
  productTypeId: z.number().int().positive().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

function resolvePeriod(url: URL) {
  const now = new Date();
  const yearRaw = Number(url.searchParams.get("year") ?? now.getUTCFullYear());
  const monthRaw = Number(url.searchParams.get("month") ?? now.getUTCMonth() + 1);
  const year =
    Number.isInteger(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100
      ? yearRaw
      : now.getUTCFullYear();
  const month =
    Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? monthRaw
      : now.getUTCMonth() + 1;
  return { year, month };
}

export async function GET(request: Request) {
  return withApiHandler(null, async (ctx) => {
    const url = new URL(request.url);
    const { year, month } = resolvePeriod(url);
    const [targets, attainment] = await Promise.all([
      listConceptTargets({ year, month }),
      getConceptTargetAttainment({ year, month }),
    ]);
    return jsonOk(
      serializeBigInt({
        periodYear: year,
        periodMonth: month,
        targets,
        attainment,
      }),
      ctx.correlationId,
    );
  });
}

export async function POST(request: Request) {
  return withApiHandler(
    [PERMISSIONS.MASTER_ADMIN, PERMISSIONS.DESIGN_APPROVE, PERMISSIONS.KPI_ADMIN],
    async (ctx) => {
      const body = await parseBody(request, upsertSchema);
      const saved = await upsertConceptTarget(body, ctx.employeeId, ctx.correlationId);
      const attainment = await getConceptTargetAttainment({
        year: body.periodYear,
        month: body.periodMonth,
      });
      return jsonOk(
        serializeBigInt({ target: saved, attainment }),
        ctx.correlationId,
        201,
      );
    },
  );
}
