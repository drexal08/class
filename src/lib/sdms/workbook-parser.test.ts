import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";

import { parseWorkbook } from "./workbook-parser";

async function workbookBuffer(build: (workbook: ExcelJS.Workbook) => void): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("SDMS workbook parser", () => {
  it("finds metadata and headers by labels at different row offsets", async () => {
    const input = await workbookBuffer((workbook) => {
      const first = workbook.addWorksheet("S4 MS2");
      first.getCell("A1").value = "School:";
      first.getCell("B1").value = "Example Secondary";
      first.getCell("F1").value = "Academic Year: 2026/2027";
      first.getCell("A2").value = "Grade: SENIOR 4";
      first.getCell("A3").value = "Combination: Math and Science (Math and Science)";
      first.getRow(7).values = ["#", "Student Code", "Names", "Sex"];
      first.getRow(8).values = [1, "ab 00123456", "AKANYIJUKA BRIGHT", "M"];
      first.getRow(9).values = [2, "00123457", "GANZA Ivo", "F"];

      const second = workbook.addWorksheet("S4 MS1");
      second.getCell("A1").value = "School: Example Secondary";
      second.getCell("A2").value = "Academic Year:";
      second.getCell("B2").value = "2026/2027";
      second.getCell("A3").value = "Grade";
      second.getCell("A4").value = "S4";
      second.getCell("A5").value = "Combination";
      second.getCell("B5").value = "Math and Science";
      second.getRow(6).values = ["#", "SDMS Code", "Full Name", "Gender"];
      second.getRow(7).values = [1, "00123458", "INEZA LIXA", "GIRL"];

      workbook.addWorksheet("Instructions").getCell("A1").value = "Read me first";
    });

    const result = await parseWorkbook(input, "students.xlsx");

    assert.equal(
      result.sheets.length,
      2,
      JSON.stringify({
        errors: result.errors,
        warnings: result.warnings,
        sheets: result.sheets.map((sheet) => ({
          sheetName: sheet.sheetName,
          students: sheet.students.length,
          headerRow: sheet.headerRow,
        })),
      }),
    );
    assert.equal(result.sheets[0]?.label, "S4 MS2");
    assert.equal(result.sheets[0]?.grade, "S4");
    assert.equal(result.sheets[0]?.academicYear.startYear, 2026);
    assert.equal(result.sheets[0]?.schoolName, "Example Secondary");
    assert.equal(result.sheets[0]?.combination, "Math and Science");
    assert.equal(result.sheets[0]?.headerRow, 7);
    assert.equal(result.sheets[0]?.students.length, 2);
    assert.deepEqual(result.sheets[0]?.students[0], {
      rowNumber: 8,
      code: "AB00123456",
      nameAsImported: "AKANYIJUKA BRIGHT",
      displayName: "Akanyijuka Bright",
      gender: "MALE",
    });
    assert.equal(result.sheets[1]?.headerRow, 6);
    assert.equal(result.sheets[1]?.students[0]?.gender, "FEMALE");
    assert.equal(result.totalRows, 3);
    assert.equal(result.errors.length, 0);
    assert.ok(result.warnings.some((warning) => warning.message.includes("no student table")));
    assert.equal(result.sheets[0]?.metadataSources.academicYear, "F1");
  });

  it("reports duplicate codes and invalid cells without dropping valid rows", async () => {
    const input = await workbookBuffer((workbook) => {
      for (const name of ["S4 MS1", "S4 MS2"]) {
        const sheet = workbook.addWorksheet(name);
        sheet.getCell("A1").value = "Academic Year: 2026/2027";
        sheet.getCell("A2").value = "Grade: S4";
        sheet.getCell("A3").value = "Combination: Sciences";
        sheet.getRow(5).values = ["Student ID", "Student Names", "Gender"];
        sheet.getRow(6).values = ["00123456", name === "S4 MS1" ? "FIRST STUDENT" : "SECOND STUDENT", "M"];
      }
      const first = workbook.getWorksheet("S4 MS1");
      if (!first) throw new Error("Missing test worksheet");
      first.getRow(7).values = ["00123459", "VALID STUDENT", "F"];
      first.getRow(8).values = ["00123460", "BAD GENDER", "?"];
    });

    const result = await parseWorkbook(input, "students.xlsx");

    assert.equal(result.sheets[0]?.students.length, 2);
    assert.equal(
      result.sheets[1]?.students.length,
      1,
      JSON.stringify({
        errors: result.errors,
        sheets: result.sheets.map((sheet) => ({ sheetName: sheet.sheetName, students: sheet.students })),
      }),
    );
    assert.ok(result.errors.some((error) => error.kind === "DUPLICATE_CODE"));
    assert.ok(result.errors.some((error) => error.cell === "C8" && error.kind === "ROW"));
  });

  it("allows a missing gender column and inherits one explicit workbook year", async () => {
    const input = await workbookBuffer((workbook) => {
      const dated = workbook.addWorksheet("S4 MS2");
      dated.getCell("A1").value = "Academic Year: 2031/2032";
      dated.getCell("A2").value = "Grade: S4";
      dated.getCell("A3").value = "Combination: Sciences";
      dated.getRow(5).values = ["Student Code", "Names", "Gender"];
      dated.getRow(6).values = ["00123456", "DATED STUDENT", "M"];

      const undated = workbook.addWorksheet("S4 MS1");
      undated.getCell("A2").value = "Grade: S4";
      undated.getCell("A3").value = "Combination: Sciences";
      undated.getRow(7).values = ["Student Code", "Names"];
      undated.getRow(8).values = ["00123457", "UNDATED STUDENT"];
    });

    const result = await parseWorkbook(input, "students.xlsx", { importYear: 2026 });
    const undated = result.sheets.find((sheet) => sheet.label === "S4 MS1");

    assert.equal(undated?.students.length, 1);
    assert.equal(undated?.students[0]?.gender, null);
    assert.equal(undated?.academicYear.startYear, 2031);
    assert.equal(result.errors.length, 0);
    assert.ok(result.warnings.some((warning) => warning.message.includes("no gender column")));
    assert.ok(result.warnings.some((warning) => warning.message.includes("inherited from another sheet")));
  });

  it("rejects legacy xls files instead of parsing them as xlsx", async () => {
    await assert.rejects(
      parseWorkbook(Buffer.from("not a workbook"), "students.xls"),
      /Save the workbook as \.xlsx/,
    );
  });
});
