import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeLegacyUsername,
  parseLegacyLevel,
  readAllLegacyStudents,
  readLegacyStudentByEmail,
  readLegacyStudentByUid,
  stageLegacyStudent,
  type LegacySourceReader,
  type LegacyStageRow,
  type LegacyStudentTable,
} from "./legacy-source";

/** A source with two students, one of them without an address. */
function fakeReader(): LegacySourceReader {
  const students: Record<
    string,
    { data: Record<string, unknown>; estimates: Record<string, unknown> }
  > = {
    "uid-1": {
      data: { level: "s5", username: "@Giant" },
      estimates: {
        S5: {
          combination_code: "MPCB",
          marks: { Mathematics: "80", Physics: 70 },
          targets: {
            Mathematics: {
              BOT: [{ got: "10", total: "20" }],
            },
          },
          goal_targets: { Mathematics: "90" },
          overall_target: "85",
          usefulness_rating: 4,
        },
      },
    },
    "uid-2": {
      data: { level: "s4", username: "lixa" },
      estimates: {},
    },
  };

  return {
    async listStudentIds() {
      return Object.keys(students);
    },
    async studentDocument(uid) {
      const student = students[uid];
      return student ? { exists: true, data: student.data } : { exists: false, data: {} };
    },
    async estimateDocument(uid, level) {
      const estimate = students[uid]?.estimates[level];
      return estimate
        ? { exists: true, data: estimate }
        : { exists: false, data: {} };
    },
    async authUserByEmail(email) {
      if (email === "one@example.com") {
        return { uid: "uid-1", email, displayName: "One" };
      }
      if (email === "two@example.com") {
        return { uid: "uid-2", email, displayName: "Two" };
      }
      return null;
    },
    async authUserByUid(uid) {
      if (uid === "uid-1") {
        return { uid, email: "one@example.com", displayName: "One" };
      }
      // uid-2 has no Auth user: it can never be joined to an LMS account.
      return null;
    },
  };
}

/** An in-memory staging table that records what was written. */
function fakeTable() {
  const rows = new Map<string, LegacyStageRow>();
  const writes: string[] = [];

  const table: LegacyStudentTable = {
    async findByEmail(email) {
      for (const row of rows.values()) {
        if (row.email === email) return row;
      }
      return null;
    },
    async findByUid(sourceUid) {
      for (const row of rows.values()) {
        if (row.sourceUid === sourceUid) return row;
      }
      return null;
    },
    async update(id, fields) {
      writes.push(`update:${id}`);
      const row = rows.get(id);
      if (!row) return;
      rows.set(id, {
        ...row,
        ...(fields.email === undefined ? {} : { email: fields.email }),
        level: fields.level,
        username: fields.username,
        displayName: fields.displayName,
        estimates: fields.estimates,
      });
    },
    async create(fields) {
      writes.push(`create:${fields.sourceUid}`);
      rows.set(`row-${fields.sourceUid}`, {
        id: `row-${fields.sourceUid}`,
        sourceUid: fields.sourceUid,
        email: fields.email ?? null,
        level: fields.level,
        username: fields.username,
        displayName: fields.displayName,
        estimates: fields.estimates,
        claimedAt: null,
      });
    },
  };

  return { table, rows, writes };
}

describe("reading the standalone app", () => {
  it("reads a level whatever spelling the source used", () => {
    assert.equal(parseLegacyLevel("s4"), "S4");
    assert.equal(parseLegacyLevel("S5"), "S5");
    assert.equal(parseLegacyLevel(" s6 "), "S6");
    assert.equal(parseLegacyLevel("senior"), null);
    assert.equal(parseLegacyLevel(undefined), null);
  });

  it("normalises a nickname the way the standalone app did", () => {
    assert.equal(normalizeLegacyUsername("@Giant"), "giant");
    assert.equal(normalizeLegacyUsername(" lixa "), "lixa");
    assert.equal(normalizeLegacyUsername("@"), null);
    assert.equal(normalizeLegacyUsername(42), null);
  });

  it("reads a student, their nickname and their saved estimate", async () => {
    const student = await readLegacyStudentByUid(fakeReader(), "uid-1");
    assert.ok(student);
    assert.equal(student.email, "one@example.com");
    assert.equal(student.displayName, "One");
    assert.equal(student.level, "S5");
    assert.equal(student.username, "giant");
    assert.deepEqual(Object.keys(student.estimates), ["S5"]);

    const estimate = student.estimates.S5!;
    assert.equal(estimate.combinationCode, "MPCB");
    assert.deepEqual(estimate.marks, { Mathematics: "80", Physics: "70" });
    assert.equal(estimate.goalTargets["Mathematics"], "90");
    assert.equal(estimate.overallTarget, "85");
    assert.equal(estimate.usefulnessRating, 4);
    assert.deepEqual(estimate.targets["Mathematics"]["BOT"], [
      { got: "10", total: "20" },
    ]);
  });

  it("skips a document with no address anywhere", async () => {
    const student = await readLegacyStudentByUid(fakeReader(), "uid-2");
    assert.equal(student, null);
  });

  it("finds a student by the address they signed up with", async () => {
    const student = await readLegacyStudentByEmail(
      fakeReader(),
      "one@example.com",
    );
    assert.ok(student);
    assert.equal(student.uid, "uid-1");
    assert.equal(student.username, "giant");
  });

  it("reports an address the source has never seen", async () => {
    assert.equal(
      await readLegacyStudentByEmail(fakeReader(), "stranger@example.com"),
      null,
    );
  });

  it("separates the students it can read from the ones it cannot", async () => {
    const { students, withoutAddress } = await readAllLegacyStudents(
      fakeReader(),
    );
    assert.deepEqual(
      students.map((student) => student.uid),
      ["uid-1"],
    );
    assert.deepEqual(withoutAddress, ["uid-2"]);
  });
});

describe("staging a clabridge student", () => {
  it("creates a row for a student nobody has staged yet", async () => {
    const { table, rows, writes } = fakeTable();
    const student = await readLegacyStudentByUid(fakeReader(), "uid-1");

    const outcome = await stageLegacyStudent(table, student!);
    assert.equal(outcome, "staged");
    assert.deepEqual(writes, ["create:uid-1"]);
    assert.equal(rows.get("row-uid-1")?.username, "giant");
  });

  it("refreshes a row that has not been claimed", async () => {
    const { table, rows, writes } = fakeTable();
    const student = await readLegacyStudentByUid(fakeReader(), "uid-1");
    await stageLegacyStudent(table, student!);
    writes.length = 0;

    const outcome = await stageLegacyStudent(table, {
      ...student!,
      username: "giant2",
      level: "S6",
    });

    assert.equal(outcome, "staged");
    assert.deepEqual(writes, ["update:row-uid-1"]);
    assert.equal(rows.get("row-uid-1")?.username, "giant2");
    assert.equal(rows.get("row-uid-1")?.level, "S6");
  });

  it("never touches a row that has already been claimed", async () => {
    const { table, rows, writes } = fakeTable();
    const student = await readLegacyStudentByUid(fakeReader(), "uid-1");
    await stageLegacyStudent(table, student!);
    rows.get("row-uid-1")!.claimedAt = new Date();
    writes.length = 0;

    const outcome = await stageLegacyStudent(table, {
      ...student!,
      username: "stolen",
    });

    assert.equal(outcome, "claimed");
    assert.deepEqual(writes, []);
    assert.equal(rows.get("row-uid-1")?.username, "giant");
  });

  it("matches a row by address even when the source id changed", async () => {
    const { table, rows, writes } = fakeTable();
    const student = await readLegacyStudentByUid(fakeReader(), "uid-1");
    await stageLegacyStudent(table, student!);
    writes.length = 0;

    // The student recreated their clabridge account, so the source id differs
    // but the address is the same.
    const outcome = await stageLegacyStudent(table, {
      ...student!,
      uid: "uid-new",
      username: "giant3",
    });

    assert.equal(outcome, "staged");
    assert.deepEqual(writes, ["update:row-uid-1"]);
    assert.equal(rows.size, 1);
    assert.equal(rows.get("row-uid-1")?.username, "giant3");
  });
});
