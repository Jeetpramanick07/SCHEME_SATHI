import { describe, it, expect } from "vitest";
import { validatePrerequisitesDag } from "../src/ingest/validator.js";

describe("Document Prerequisites DAG Validator", () => {
  it("validates a clean acyclic prerequisite dependency graph", () => {
    const validGraph = [
      { document_id: "DOC_002", requires_document_ids: ["DOC_001", "DOC_004"] },
      { document_id: "DOC_003", requires_document_ids: ["DOC_001"] },
      { document_id: "DOC_005", requires_document_ids: ["DOC_001", "DOC_003"] },
    ];

    const result = validatePrerequisitesDag(validGraph);
    expect(result.valid).toBe(true);
    expect(result.cycle).toBeUndefined();
  });

  it("detects direct two-node circular dependencies", () => {
    const directCycle = [
      { document_id: "DOC_A", requires_document_ids: ["DOC_B"] },
      { document_id: "DOC_B", requires_document_ids: ["DOC_A"] },
    ];

    const result = validatePrerequisitesDag(directCycle);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Cycle detected");
  });

  it("detects multi-node circular dependencies", () => {
    const multiCycle = [
      { document_id: "DOC_A", requires_document_ids: ["DOC_B"] },
      { document_id: "DOC_B", requires_document_ids: ["DOC_C"] },
      { document_id: "DOC_C", requires_document_ids: ["DOC_D"] },
      { document_id: "DOC_D", requires_document_ids: ["DOC_A"] },
    ];

    const result = validatePrerequisitesDag(multiCycle);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Cycle detected");
  });

  it("detects self-referencing document requirement", () => {
    const selfCycle = [
      { document_id: "DOC_A", requires_document_ids: ["DOC_A"] },
    ];

    const result = validatePrerequisitesDag(selfCycle);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Cycle detected");
  });
});
