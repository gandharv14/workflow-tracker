import { describe, expect, it } from "vitest";

import { bulkSchema, createPersonSchema, updatePersonSchema } from "./schemas";

describe("createPersonSchema", () => {
  it("accepts valid people and trims optional fields", () => {
    const result = createPersonSchema.parse({
      email: "  JANE@EXAMPLE.COM ",
      name: " Jane Doe ",
      step: "interview",
    });

    expect(result).toEqual({
      email: "JANE@EXAMPLE.COM",
      name: "Jane Doe",
      step: "interview",
    });
  });

  it("turns a blank name into undefined", () => {
    const result = createPersonSchema.parse({
      email: "person@example.com",
      name: "   ",
    });

    expect(result.name).toBeUndefined();
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
        step: "sent_contracts",
      }),
    ).toEqual({
      email: "person@example.com",
      name: null,
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

describe("bulkSchema", () => {
  it("accepts move and delete requests", () => {
    expect(
      bulkSchema.parse({
        action: "move",
        ids: ["one", "two"],
        step: "gmail_creation",
      }),
    ).toEqual({
      action: "move",
      ids: ["one", "two"],
      step: "gmail_creation",
    });

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
