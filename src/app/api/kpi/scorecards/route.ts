import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  applyScorecardBenchmark,
  createScorecard,
  listScorecards,
} from "@/lib/services/kpi-benchmark-service";
import { SPEC_KPI_METRICS } from "@/lib/kpi-metrics";

export async function GET() {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const cards = await listScorecards(ctx.companyId);
    return jsonOk(serializeBigInt(cards), ctx.correlationId);
  });
}

const createSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(2).max(120),
  description: z.string().optional(),
  roleId: z.number().int().positive().optional().nullable(),
  metricWeights: z.record(z.string(), z.number()),
});

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    // Default missing metrics to 0 so callers can send partial maps
    const weights: Record<string, number> = {};
    for (const m of SPEC_KPI_METRICS) {
      weights[m.code] = Number(body.metricWeights[m.code] ?? 0);
    }
    for (const [code, value] of Object.entries(body.metricWeights)) {
      weights[code] = value;
    }
    const card = await createScorecard({
      companyId: ctx.companyId,
      createdById: ctx.employeeId,
      code: body.code,
      name: body.name,
      description: body.description,
      roleId: body.roleId,
      metricWeights: weights,
    });
    return jsonOk(serializeBigInt(card), ctx.correlationId, 201);
  });
}

const applySchema = z.object({
  scorecardId: z.number().int().positive(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

export async function PUT(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const body = await parseBody(request, applySchema);
    const result = await applyScorecardBenchmark({
      companyId: ctx.companyId,
      scorecardId: body.scorecardId,
      year: body.year,
      month: body.month,
    });
    return jsonOk(serializeBigInt(result), ctx.correlationId);
  });
}
