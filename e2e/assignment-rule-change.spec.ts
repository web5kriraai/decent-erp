import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers/auth";

test.describe("Assignment rule change (§16.2)", () => {
  test("preferred employee rule changes auto assignee", async ({ page, request }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    const employeesRes = await request.get("/api/masters/employees");
    expect(employeesRes.ok()).toBeTruthy();
    const employees = (await employeesRes.json()) as Array<{ id: number; role: { code: string } }>;
    const sketch = employees.find((e) => e.role.code === "SKETCH_DESIGNER");
    expect(sketch).toBeTruthy();

    const rulesRes = await request.post("/api/admin/assignment-rules", {
      data: {
        name: "E2E prefer sketch",
        priority: 1,
        active: true,
        strategy: "WORKLOAD_SKILL",
        criteriaJson: {
          subProcessCode: "SKETCH",
          preferredEmployeeId: sketch!.id,
        },
      },
    });
    expect(rulesRes.ok()).toBeTruthy();

    await login(page, USERS.designHead.email, USERS.designHead.password);
    const patternsRes = await request.get("/api/masters/workflow-patterns");
    expect(patternsRes.ok()).toBeTruthy();
    const patterns = (await patternsRes.json()) as Array<{ id: number; name: string }>;
    const pattern = patterns.find((p) => p.name.toLowerCase().includes("full")) ?? patterns[0];
    expect(pattern).toBeTruthy();

    const productTypesRes = await request.get("/api/masters/product-types");
    const productTypes = (await productTypesRes.json()) as Array<{ id: number }>;
    const seasonsRes = await request.get("/api/masters/seasons");
    const seasons = (await seasonsRes.json()) as Array<{ id: number }>;

    const createRes = await request.post("/api/designs", {
      data: {
        productTypeId: productTypes[0]!.id,
        seasonId: seasons[0]!.id,
        collectionName: `Rule test ${Date.now()}`,
        priority: "MEDIUM",
        conceptNote: "Assignment rule e2e",
        assignmentMode: "AUTOMATIC",
        workflowPatternId: pattern!.id,
        taskDateMode: "SEQUENTIAL",
      },
    });
    expect(createRes.status()).toBe(201);
    const design = (await createRes.json()) as {
      id: string;
      tasks: Array<{ subProcess?: { code: string }; assignedEmployeeId?: number }>;
    };
    const sketchTask = design.tasks?.find((t) => t.subProcess?.code === "SKETCH");
    expect(sketchTask?.assignedEmployeeId).toBe(sketch!.id);
  });
});
