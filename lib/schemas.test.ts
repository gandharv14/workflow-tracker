import { describe, expect, it } from "vitest";

import {
  bulkSchema,
  createPersonSchema,
  importPeopleSchema,
  updatePersonSchema,
} from "./schemas";

describe("createPersonSchema", () => {
  it("accepts valid people and trims optional fields", () => {
    const result = createPersonSchema.parse({
      email: "  JANE@EXAMPLE.COM ",
      name: " Jane Doe ",
      role: " Reviewer ",
      step: "background_check",
    });

    expect(result).toEqual({
      email: "JANE@EXAMPLE.COM",
      name: "Jane Doe",
      role: "Reviewer",
      step: "background_check",
    });
  });

  it("accepts interview and normalizes legacy combined-step values", () => {
    expect(
      createPersonSchema.parse({
        email: "person@example.com",
        step: "interview",
      }).step,
    ).toBe("interview");

    expect(
      createPersonSchema.parse({
        email: "person@example.com",
        step: "Eval + Interview",
      }).step,
    ).toBe("eval");
  });

  it("turns blank optional text into undefined", () => {
    const result = createPersonSchema.parse({
      email: "person@example.com",
      name: "   ",
      role: "   ",
    });

    expect(result.name).toBeUndefined();
    expect(result.role).toBeUndefined();
  });

  it("rejects invalid email and workflow step values", () => {
    expect(() =>
      createPersonSchema.parse({ email: "not-an-email" }),
    ).toThrow("Must be a valid email address");

    expect(() =>
      createPersonSchema.parse({
        email: "person@example.com",
        step: "unknown",
      }),
    ).toThrow();
  });
});

describe("updatePersonSchema", () => {
  it("accepts email, name, and step patches", () => {
    expect(
      updatePersonSchema.parse({
        email: "person@example.com",
        name: null,
        role: "Lead",
        step: "sent_contracts",
      }),
    ).toEqual({
      email: "person@example.com",
      name: null,
      role: "Lead",
      step: "sent_contracts",
    });
  });

  it("requires at least one update field", () => {
    expect(() => updatePersonSchema.parse({})).toThrow(
      "Provide at least one field to update",
    );
  });

  it("rejects invalid patch values", () => {
    expect(() =>
      updatePersonSchema.parse({ email: "bad-email" }),
    ).toThrow("Must be a valid email address");

    expect(() => updatePersonSchema.parse({ step: "done" })).toThrow();
  });
});

describe("importPeopleSchema", () => {
  it("accepts rows and normalizes step labels", () => {
    expect(
      importPeopleSchema.parse({
        people: [
          {
            email: "person@example.com",
            name: " Person ",
            role: " Reviewer ",
            step: "Eval + Interview",
          },
        ],
      }),
    ).toEqual({
      people: [
        {
          email: "person@example.com",
          name: "Person",
          role: "Reviewer",
          step: "eval",
        },
      ],
    });
  });

  it("requires at least one row", () => {
    expect(() => importPeopleSchema.parse({ people: [] })).toThrow(
      "Upload at least one person",
    );
  });
});

describe("bulkSchema", () => {
  it("accepts move and delete requests", () => {
    expect(
      bulkSchema.parse({
        action: "move",
        ids: ["one", "two"],
        step: "background_check",
      }),
    ).toEqual({
      action: "move",
      ids: ["one", "two"],
      step: "background_check",
    });

    expect(
      bulkSchema.parse({
        action: "move",
        ids: ["one"],
        step: "gmail_creation",
      }).step,
    ).toBe("background_check");

    expect(bulkSchema.parse({ action: "delete", ids: ["one"] })).toEqual({
      action: "delete",
      ids: ["one"],
    });
  });

  it("requires ids and a step for move actions", () => {
    expect(() => bulkSchema.parse({ action: "delete", ids: [] })).toThrow(
      "Provide at least one id",
    );

    expect(() =>
      bulkSchema.parse({ action: "move", ids: ["one"] }),
    ).toThrow("step is required when action is 'move'");
  });
});
