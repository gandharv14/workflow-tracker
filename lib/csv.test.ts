import { describe, expect, it } from "vitest";

import { parsePeopleCsv, serializePeopleCsv } from "./csv";
import { person } from "@/test/factories";

describe("parsePeopleCsv", () => {
  it("parses people, roles, quoted values, and workflow labels", () => {
    expect(
      parsePeopleCsv(
        'email,name,role,step\njane@example.com,"Jane, Doe",Reviewer,Eval + Interview\nsam@example.com,Sam,Ops Lead,sent_contracts\n',
      ),
    ).toEqual([
      {
        email: "jane@example.com",
        name: "Jane, Doe",
        role: "Reviewer",
        step: "eval",
      },
      {
        email: "sam@example.com",
        name: "Sam",
        role: "Ops Lead",
        step: "sent_contracts",
      },
    ]);
  });

  it("reports missing headers and invalid steps", () => {
    expect(() => parsePeopleCsv("name\nJane\n")).toThrow(
      "CSV must include an email column",
    );
    expect(() => parsePeopleCsv("email,step\njane@example.com,done\n")).toThrow(
      "Row 2: step must be one of eval, background_check, sent_contracts, in_production",
    );
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
