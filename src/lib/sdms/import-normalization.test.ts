import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultCohortPassword,
  normalizeAlias,
  normalizeCombinationText,
  normalizeDisplayName,
  normalizeGender,
  normalizeGrade,
  normalizeStudentCode,
  parseAcademicYear,
  studentAuthEmail,
} from "./import-normalization";

describe("SDMS import normalization", () => {
  it("canonicalizes student codes without treating them as numbers", () => {
    assert.equal(normalizeStudentCode("  ab 040-220239 \n"), "AB040-220239");
    assert.equal(normalizeStudentCode("00123456"), "00123456");
    assert.equal(normalizeStudentCode("bad!"), null);
    assert.equal(normalizeStudentCode(12345678), "12345678");
  });

  it("uses the same canonical code for the synthetic Firebase email", () => {
    assert.equal(
      studentAuthEmail(" AB 040-220239 ", "Students.Example.test"),
      "ab040-220239@students.example.test",
    );
  });

  it("normalizes imported names while retaining the raw name separately", () => {
    assert.equal(normalizeDisplayName("AKANYIJUKA   BRIGHT"), "Akanyijuka Bright");
    assert.equal(normalizeDisplayName("GANZA Ivo"), "Ganza Ivo");
    assert.equal(normalizeDisplayName("  o'neil   mary-jane "), "O'Neil Mary-Jane");
  });

  it("accepts explicit gender aliases and rejects ambiguous values", () => {
    for (const value of ["M", "male", "BOY", "b"]) {
      assert.equal(normalizeGender(value), "MALE");
    }
    for (const value of ["F", "female", "GIRL", "g"]) {
      assert.equal(normalizeGender(value), "FEMALE");
    }
    assert.equal(normalizeGender("?"), null);
    assert.equal(normalizeGender(""), null);
  });

  it("normalizes grades and academic years", () => {
    assert.equal(normalizeGrade("SENIOR 4"), "S4");
    assert.equal(normalizeGrade(" s 5 "), "S5");
    assert.equal(normalizeGrade("unknown"), null);
    assert.deepEqual(parseAcademicYear("Academic Year: 2026/2027"), {
      startYear: 2026,
      label: "2026/2027",
    });
    assert.equal(parseAcademicYear("20/21"), null);
  });

  it("removes only a duplicated parenthetical from combinations", () => {
    assert.equal(
      normalizeCombinationText("Math and Science (Math and Science)"),
      "Math and Science",
    );
    assert.equal(
      normalizeCombinationText("Arts & Humanities (Elective)"),
      "Arts & Humanities (Elective)",
    );
    assert.equal(
      normalizeAlias(" Math & Science (Math & Science) "),
      "math and science",
    );
  });

  it("derives the documented temporary cohort password", () => {
    assert.equal(defaultCohortPassword(2026), "Cla@2026");
  });
});
