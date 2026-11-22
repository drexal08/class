import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { parseWorkbook } from "../src/lib/sdms/workbook-parser";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/inspect-sdms-workbook.ts <workbook.xlsx>");
    process.exitCode = 1;
    return;
  }

  const parsed = await parseWorkbook(await readFile(filePath), basename(filePath));
  console.log(JSON.stringify({
  sheets: parsed.sheets.map((sheet) => ({
    label: sheet.label,
    grade: sheet.grade,
    academicYear: sheet.academicYear.label,
    headerRow: sheet.headerRow,
    headers: sheet.headers,
    rows: sheet.students.length,
    metadataSources: sheet.metadataSources,
  })),
  totalRows: parsed.totalRows,
  errors: parsed.errors.map(({ kind, sheetName, rowNumber, cell, message }) => ({
    kind,
    sheetName,
    rowNumber,
    cell,
    ...(kind === "DUPLICATE_CODE" ? {} : { message }),
  })),
  warnings: parsed.warnings.map(({ kind, sheetName, rowNumber, cell, message }) => ({
    kind,
    sheetName,
    rowNumber,
    cell,
    message,
  })),
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Could not inspect workbook");
  process.exitCode = 1;
});
