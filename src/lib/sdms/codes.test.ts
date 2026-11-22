import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateJoinCode, normalizeJoinCode } from "./codes";

describe("SDMS join codes", () => {
  it("uses an explicit target prefix and eight unambiguous characters", () => {
    for (const [kind, prefix] of [["SCHOOL", "SCH-"], ["COHORT", "CLS-"], ["COURSE", "CLS-"]] as const) {
      const code = generateJoinCode(kind);
      assert.ok(code.startsWith(prefix));
      assert.equal(code.length, prefix.length + 8);
      assert.match(code.slice(prefix.length), /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    }
  });

  it("normalizes user input without accepting a malformed prefix", () => {
    assert.equal(normalizeJoinCode(" sch-abcd 2345 "), "SCH-ABCD2345");
    assert.equal(normalizeJoinCode("CLS-ABCDEFGH"), "CLS-ABCDEFGH");
  });
});
