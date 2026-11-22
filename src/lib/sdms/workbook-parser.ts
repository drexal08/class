import ExcelJS from "exceljs";

import {
  collapseWhitespace,
  normalizeAlias,
  normalizeCombinationText,
  normalizeDisplayName,
  normalizeGender,
  normalizeGrade,
  normalizeStudentCode,
  parseAcademicYear,
  type ImportedGender,
} from "./import-normalization";

export const MAX_WORKBOOK_BYTES = 8 * 1024 * 1024;
export const MAX_UNCOMPRESSED_WORKBOOK_BYTES = 64 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2_000;
export const MAX_IMPORT_SHEETS = 100;
export const MAX_IMPORT_CELLS = 100_000;

type MetadataField = "schoolName" | "grade" | "combination" | "classLabel" | "academicYear";
type GridCell = { text: string; raw: unknown; address: string };
type Grid = Map<number, Map<number, GridCell>>;

export type ParsedStudentRow = {
  rowNumber: number;
  code: string;
  nameAsImported: string;
  displayName: string;
  gender: ImportedGender | null;
};

export type ParsedCohortSheet = {
  sheetName: string;
  label: string;
  schoolName: string | null;
  grade: string;
  rawGrade: string | null;
  combination: string;
  normalizedCombination: string;
  academicYear: { startYear: number; label: string };
  metadataSources: Partial<Record<MetadataField, string>>;
  headerRow: number;
  headers: Partial<Record<"code" | "name" | "gender", string>>;
  students: ParsedStudentRow[];
};

export type WorkbookIssue = {
  kind: "ROW" | "SHEET" | "METADATA" | "DUPLICATE_CODE" | "SCHOOL_MISMATCH";
  sheetName: string;
  rowNumber?: number;
  cell?: string;
  message: string;
};

export type WorkbookParseResult = {
  sheets: ParsedCohortSheet[];
  warnings: WorkbookIssue[];
  errors: WorkbookIssue[];
  totalRows: number;
};

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value && value.result != null) {
      const result = value.result;
      if (typeof result === "string" || typeof result === "number") return String(result).trim();
    }
  }
  return cell.text.trim();
}

function buildGrid(sheet: ExcelJS.Worksheet): { grid: Grid; cells: number } {
  const grid: Grid = new Map();
  let cells = 0;
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const text = cellText(cell);
      if (!text) return;
      cells += 1;
      if (cells > MAX_IMPORT_CELLS) {
        throw new Error(`Workbooks may contain at most ${MAX_IMPORT_CELLS.toLocaleString()} non-empty cells`);
      }
      if (!grid.has(rowNumber)) grid.set(rowNumber, new Map());
      grid.get(rowNumber)!.set(columnNumber, {
        text,
        raw: cell.value,
        address: cell.address,
      });
    });
  }
  return { grid, cells };
}

const METADATA_PATTERN = /^\s*(school|grade|combination|class|academic\s*year)\b\s*:?[ \t]*(.*)$/i;
const METADATA_KEYS: Record<string, MetadataField> = {
  school: "schoolName",
  grade: "grade",
  combination: "combination",
  class: "classLabel",
  academicyear: "academicYear",
};

function readMetadata(grid: Grid): {
  values: Partial<Record<MetadataField, string>>;
  sources: Partial<Record<MetadataField, string>>;
} {
  const values: Partial<Record<MetadataField, string>> = {};
  const sources: Partial<Record<MetadataField, string>> = {};

  for (const [rowNumber, columns] of grid) {
    for (const [columnNumber, cell] of columns) {
      const match = cell.text.match(METADATA_PATTERN);
      if (!match) continue;
      const key = METADATA_KEYS[match[1].replace(/\s+/g, "").toLowerCase()];
      if (!key || values[key]) continue;

      let value = collapseWhitespace(match[2]);
      if (!value) {
        for (let column = columnNumber + 1; column <= 100; column += 1) {
          const candidate = columns.get(column)?.text;
          if (candidate) {
            value = candidate;
            break;
          }
        }
      }
      if (!value) {
        for (let row = rowNumber + 1; row <= rowNumber + 3; row += 1) {
          const candidate = grid.get(row)?.get(columnNumber)?.text;
          if (candidate) {
            value = candidate;
            break;
          }
        }
      }
      if (value) {
        values[key] = value;
        sources[key] = cell.address;
      }
    }
  }
  return { values, sources };
}

const HEADER_ALIASES: Record<string, "code" | "name" | "gender"> = {
  studentcode: "code",
  sdms: "code",
  sdmscode: "code",
  code: "code",
  studentid: "code",
  regno: "code",
  registrationnumber: "code",
  names: "name",
  name: "name",
  fullname: "name",
  studentname: "name",
  studentnames: "name",
  gender: "gender",
  sex: "gender",
};

function normalizedHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeader(grid: Grid): { rowNumber: number; columns: Map<number, "code" | "name" | "gender"> } | null {
  for (const [rowNumber, cells] of grid) {
    const columns = new Map<number, "code" | "name" | "gender">();
    for (const [columnNumber, cell] of cells) {
      const field = HEADER_ALIASES[normalizedHeader(cell.text)];
      if (field) columns.set(columnNumber, field);
    }
    if (new Set(columns.values()).size >= 2) return { rowNumber, columns };
  }
  return null;
}

/** Reject zip bombs before ExcelJS inflates the workbook. */
function assertArchiveBudget(input: Buffer): void {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let index = input.length - 22; index >= Math.max(0, input.length - 65_557); index -= 1) {
    if (input.readUInt32LE(index) === eocdSignature) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("The file is not a valid .xlsx workbook");

  const entries = input.readUInt16LE(eocd + 10);
  let offset = input.readUInt32LE(eocd + 16);
  let uncompressedTotal = 0;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > input.length || input.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("The .xlsx archive directory is invalid or unsupported");
    }
    uncompressedTotal += input.readUInt32LE(offset + 24);
    if (uncompressedTotal > MAX_UNCOMPRESSED_WORKBOOK_BYTES) {
      throw new Error("The expanded workbook exceeds the 64 MB safety limit");
    }
    const nameLength = input.readUInt16LE(offset + 28);
    const extraLength = input.readUInt16LE(offset + 30);
    const commentLength = input.readUInt16LE(offset + 32);
    offset += 46 + nameLength + extraLength + commentLength;
  }
}

export async function parseWorkbook(
  input: Buffer | Uint8Array,
  fileName: string,
  options: { importYear?: number } = {},
): Promise<WorkbookParseResult> {
  if (fileName.toLowerCase().endsWith(".xls")) {
    throw new Error("Legacy .xls files are not supported. Save the workbook as .xlsx and upload it again.");
  }
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Upload an .xlsx workbook");
  }
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input as unknown as ArrayBuffer);
  if (buffer.byteLength > MAX_WORKBOOK_BYTES) {
    throw new Error("Workbooks may be at most 8 MB");
  }
  assertArchiveBudget(buffer);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as any);
  } catch {
    throw new Error("Could not read the workbook. Upload a valid, unencrypted .xlsx file.");
  }
  if (workbook.worksheets.length > MAX_IMPORT_SHEETS) {
    throw new Error(`Workbooks may contain at most ${MAX_IMPORT_SHEETS} sheets`);
  }

  const result: WorkbookParseResult = { sheets: [], warnings: [], errors: [], totalRows: 0 };
  const codeLocations = new Map<string, Array<{ sheetName: string; rowNumber: number; cell: string }>>();
  const schoolNames = new Set<string>();
  const grids = new Map<string, Grid>();
  const explicitYears = new Map<string, { startYear: number; label: string }>();
  for (const sheet of workbook.worksheets) {
    const { grid } = buildGrid(sheet);
    grids.set(sheet.name, grid);
    const year = parseAcademicYear(readMetadata(grid).values.academicYear);
    if (year) explicitYears.set(year.label, year);
  }
  const sharedAcademicYear = explicitYears.size === 1
    ? [...explicitYears.values()][0]
    : undefined;

  for (const sheet of workbook.worksheets) {
    const grid = grids.get(sheet.name)!;
    const header = findHeader(grid);
    if (!header) {
      result.warnings.push({
        kind: "SHEET",
        sheetName: sheet.name,
        message: `Sheet "${sheet.name}" has no student table and was skipped`,
      });
      continue;
    }

    const metadata = readMetadata(grid);
    const label = collapseWhitespace(metadata.values.classLabel || sheet.name);
    const rawGrade = metadata.values.grade ?? null;
    const grade = normalizeGrade(rawGrade) ?? normalizeGrade(label) ?? "";
    if (!grade) {
      result.errors.push({ kind: "METADATA", sheetName: sheet.name, message: "Grade is missing or invalid" });
    }
    const combination = normalizeCombinationText(metadata.values.combination ?? "");
    if (!combination) {
      result.errors.push({ kind: "METADATA", sheetName: sheet.name, message: "Combination is missing" });
    }
    const parsedYear = parseAcademicYear(metadata.values.academicYear);
    const fallbackYear = options.importYear ?? new Date().getUTCFullYear();
    const academicYear = parsedYear ?? sharedAcademicYear ?? {
      startYear: fallbackYear,
      label: `${fallbackYear}/${fallbackYear + 1}`,
    };
    if (!parsedYear) {
      result.warnings.push({
        kind: "METADATA",
        sheetName: sheet.name,
        message: sharedAcademicYear
          ? `Academic year ${academicYear.label} was inherited from another sheet`
          : `Academic year was not found; ${academicYear.label} will be used`,
      });
    }
    const schoolName = metadata.values.schoolName?.trim() || null;
    if (schoolName) schoolNames.add(schoolName.toLocaleLowerCase("en"));

    const students: ParsedStudentRow[] = [];
    const requiredColumns = new Set(header.columns.values());
    for (const field of ["code", "name"] as const) {
      if (!requiredColumns.has(field)) {
        result.errors.push({
          kind: "SHEET",
          sheetName: sheet.name,
          rowNumber: header.rowNumber,
          message: `The student table has no recognizable ${field} column`,
        });
      }
    }
    const hasGenderColumn = requiredColumns.has("gender");
    if (!hasGenderColumn) {
      result.warnings.push({
        kind: "SHEET",
        sheetName: sheet.name,
        rowNumber: header.rowNumber,
        message: "This sheet has no gender column; students will be imported with gender unset",
      });
    }

    for (let rowNumber = header.rowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const cells = grid.get(rowNumber);
      if (!cells) continue;
      const values = new Map<"code" | "name" | "gender", { text: string; raw: unknown; column: number }>();
      for (const [column, field] of header.columns) {
        const cell = cells.get(column);
        if (cell) values.set(field, { text: cell.text, raw: cell.raw, column });
      }
      if (![...values.values()].some((value) => value.text)) continue;
      result.totalRows += 1;
      if (result.totalRows > MAX_IMPORT_ROWS) {
        throw new Error(`Workbooks may contain at most ${MAX_IMPORT_ROWS.toLocaleString()} student rows`);
      }

      const codeCell = values.get("code");
      const nameCell = values.get("name");
      const genderCell = values.get("gender");
      const code = normalizeStudentCode(codeCell?.raw ?? codeCell?.text);
      const nameAsImported = collapseWhitespace(nameCell?.text);
      const displayName = normalizeDisplayName(nameAsImported);
      const gender = hasGenderColumn ? normalizeGender(genderCell?.text) : null;
      let valid = true;

      const rowError = (cell: ExcelJS.Cell, message: string) => {
        valid = false;
        result.errors.push({ kind: "ROW", sheetName: sheet.name, rowNumber, cell: cell.address, message });
      };
      if (!code) rowError(sheet.getCell(rowNumber, codeCell?.column ?? 1), "Student code must be 6–20 letters, digits or hyphens");
      if (nameAsImported.length < 2 || !/\p{L}/u.test(nameAsImported)) {
        rowError(sheet.getCell(rowNumber, nameCell?.column ?? 2), "Student name is missing or invalid");
      }
      if (hasGenderColumn && !gender) {
        rowError(sheet.getCell(rowNumber, genderCell?.column ?? 3), "Gender must be M or F");
      }
      if (!valid || !code || (hasGenderColumn && !gender)) continue;

      if (typeof codeCell?.raw === "number") {
        result.warnings.push({
          kind: "ROW",
          sheetName: sheet.name,
          rowNumber,
          cell: sheet.getCell(rowNumber, codeCell.column).address,
          message: "Student code is numeric; format it as text to preserve any leading zeroes",
        });
      }
      students.push({ rowNumber, code, nameAsImported, displayName, gender });
      const locations = codeLocations.get(code) ?? [];
      locations.push({ sheetName: sheet.name, rowNumber, cell: sheet.getCell(rowNumber, codeCell!.column).address });
      codeLocations.set(code, locations);
    }

    result.sheets.push({
      sheetName: sheet.name,
      label,
      schoolName,
      grade,
      rawGrade,
      combination,
      normalizedCombination: normalizeAlias(combination),
      academicYear,
      metadataSources: metadata.sources,
      headerRow: header.rowNumber,
      headers: Object.fromEntries(
        [...header.columns].map(([column, field]) => [field, sheet.getCell(header.rowNumber, column).text]),
      ),
      students,
    });
  }

  if (schoolNames.size > 1) {
    result.errors.push({
      kind: "SCHOOL_MISMATCH",
      sheetName: "Workbook",
      message: "Sheets name different schools; import one school per workbook",
    });
  }
  for (const [code, locations] of codeLocations) {
    if (locations.length < 2) continue;
    const first = locations[0];
    result.errors.push({
      kind: "DUPLICATE_CODE",
      sheetName: first.sheetName,
      rowNumber: first.rowNumber,
      cell: first.cell,
      message: `Duplicate student code ${code}: ${locations.map((location) => `${location.sheetName}!${location.cell}`).join(", ")}`,
    });
  }
  return result;
}
