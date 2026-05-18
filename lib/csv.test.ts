import { describe, expect, it } from "vitest";

import { parsePeopleCsv, serializePeopleCsv } from "./csv";
import { person } from "@/test/factories";

describe("parsePeopleCsv", () => {
  it("parses people, roles, quoted values, and workflow labels", () => {
    expect(
      parsePeopleCsv(
        'email,name,role,step\njane@example.com,"Jane, Doe",Reviewer,Eval + Interview\nsam@example.com,Sam,Ops Lead,Interview\n',
      ),
    ).toEqual([
      {
        email: "jane@example.com",
        name: "Jane, Doe",
        role: "Reviewer",
        step: "eval",
        fields: { name: true, role: true, step: true },
      },
      {
        email: "sam@example.com",
        name: "Sam",
        role: "Ops Lead",
        step: "interview",
        fields: { name: true, role: true, step: true },
      },
    ]);
  });

  it("reports missing headers, invalid values, and duplicate emails", () => {
    expect(() => parsePeopleCsv("name\nJane\n")).toThrow(
      "CSV must include an email column",
    );
    expect(() => parsePeopleCsv("email,step\njane@example.com,done\n")).toThrow(
      "Row 2: step must be one of eval, interview, background_check, sent_contracts, in_production",
    );
    expect(() => parsePeopleCsv("email\nnot-an-email\n")).toThrow(
      "Row 2: email must be a valid email address",
    );
    expect(() =>
      parsePeopleCsv("email\njane@example.com\n JANE@example.com \n"),
    ).toThrow("Row 3: duplicate email jane@example.com");
  });

  it("tracks omitted columns separately from blank cells", () => {
    expect(parsePeopleCsv("email,role\njane@example.com,\n")).toEqual([
      {
        email: "jane@example.com",
        role: undefined,
        fields: { name: false, role: true, step: false },
        step: undefined,
      },
    ]);
  });
});

describe("serializePeopleCsv", () => {
  it("serializes queue people with escaped values", () => {
    expect(
      serializePeopleCsv([
        person({
          email: "jane@example.com",
          name: "Jane, Doe",
          role: 'Reviewer "A"',
          step: "background_check",
        }),
      ]),
    ).toBe(
      'email,name,role,step\njane@example.com,"Jane, Doe","Reviewer ""A""",background_check\n',
    );
  });
});
