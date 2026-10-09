import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers/auth";

test.describe("Manual assign create (§16.1)", () => {
  test("MANUAL create assigns sketch task with audit trail", async ({ page, request }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);

    const employeesRes = await request.get("/api/masters/employees");
    const employees = (await employeesRes.json()) as Array<{
      id: number;
      role: { code: string };
    }>;
    const sketch = employees.find((e) => e.role.code === "SKETCH_DESIGNER");
    expect(sketch).toBeTruthy();

    const processesRes = await request.get("/api/masters/processes");
    const processes = (await processesRes.json()) as Array<{
      id: number;
      subProcesses: Array<{ id: number; code: string }>;
    }>;
    const sketchSub = processes
      .flatMap((p) => p.subProcesses.map((s) => ({ ...s, processId: p.id })))
      .find((s) => s.code === "SKETCH");
    expect(sketchSub).toBeTruthy();

    const productTypesRes = await request.get("/api/masters/product-types");
    const productTypes = (await productTypesRes.json()) as Array<{ id: number }>;
    const seasonsRes = await request.get("/api/masters/seasons");
    const seasons = (await seasonsRes.json()) as Array<{ id: number }>;

    const createRes = await request.post("/api/designs", {
      data: {
        productTypeId: productTypes[0]!.id,
        seasonId: seasons[0]!.id,
        collectionName: `Manual ${Date.now()}`,
        priority: "HIGH",
        conceptNote: "Manual assignment e2e",
        assignmentMode: "MANUAL",
        manualTasks: [
          {
            processId: sketchSub!.processId,
            subProcessId: sketchSub!.id,
            expectedMinutes: 120,
            assignedEmployeeId: sketch!.id,
            sequence: 1,
            dueAt: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
      },
    });
    expect(createRes.status()).toBe(201);
    const design = (await createRes.json()) as {
      id: string;
      tasks: Array<{ assignedEmployeeId?: number; status: string }>;
    };
    expect(design.tasks?.[0]?.assignedEmployeeId).toBe(sketch!.id);

    const historyRes = await request.get(`/api/designs/${design.id}/history`);
    expect(historyRes.ok()).toBeTruthy();
    const history = (await historyRes.json()) as { items: Array<{ action: string }> };
    expect(history.items.some((i) => i.action === "CREATE")).toBeTruthy();
  });
});
