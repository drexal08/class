import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accountRoleDecision,
  attachmentKeyBelongsToCourse,
  canCommentOnStream,
  canPostOnStream,
  canSubmitWork,
  resolveCourseAccess,
  rubricScoreError,
  visibleFeedbackForStudent,
  visibleGradeForStudent,
} from "./rules";

describe("resolveCourseAccess", () => {
  it("gives an enrolled teacher full management rights", () => {
    const access = resolveCourseAccess({
      isAdmin: false,
      enrollment: { role: "TEACHER" },
    });

    assert.deepEqual(access, {
      role: "TEACHER",
      isTeacher: true,
      canManage: true,
      isEnrolled: true,
    });
  });

  it("keeps an enrolled student a student even when they are an admin", () => {
    const access = resolveCourseAccess({
      isAdmin: true,
      enrollment: { role: "STUDENT" },
    });

    assert.deepEqual(access, {
      role: "STUDENT",
      isTeacher: false,
      canManage: false,
      isEnrolled: true,
    });
  });

  it("lets an unenrolled admin inspect a class read-only", () => {
    const access = resolveCourseAccess({ isAdmin: true, enrollment: null });

    assert.deepEqual(access, {
      role: "TEACHER",
      isTeacher: true,
      canManage: false,
      isEnrolled: false,
    });
  });

  it("refuses a user who is neither enrolled nor an admin", () => {
    assert.equal(
      resolveCourseAccess({ isAdmin: false, enrollment: null }),
      null,
    );
  });
});

describe("stream policies", () => {
  const student = { canManage: false, role: "STUDENT" as const };

  it("allows a student to post only when the policy says so", () => {
    assert.equal(
      canPostOnStream({
        ...student,
        postPolicy: "STUDENTS_CAN_POST_AND_COMMENT",
      }),
      true,
    );
    assert.equal(
      canPostOnStream({
        ...student,
        postPolicy: "STUDENTS_CAN_COMMENT_ONLY",
      }),
      false,
    );
    assert.equal(
      canPostOnStream({ ...student, postPolicy: "ONLY_TEACHERS" }),
      false,
    );
  });

  it("allows a student to comment unless the class is teacher-only", () => {
    assert.equal(
      canCommentOnStream({
        ...student,
        postPolicy: "STUDENTS_CAN_POST_AND_COMMENT",
      }),
      true,
    );
    assert.equal(
      canCommentOnStream({
        ...student,
        postPolicy: "STUDENTS_CAN_COMMENT_ONLY",
      }),
      true,
    );
    assert.equal(
      canCommentOnStream({ ...student, postPolicy: "ONLY_TEACHERS" }),
      false,
    );
  });

  it("always allows a manager to post and comment", () => {
    const manager = { canManage: true, role: "TEACHER" as const };
    for (const postPolicy of [
      "STUDENTS_CAN_POST_AND_COMMENT",
      "STUDENTS_CAN_COMMENT_ONLY",
      "ONLY_TEACHERS",
    ] as const) {
      assert.equal(canPostOnStream({ ...manager, postPolicy }), true);
      assert.equal(canCommentOnStream({ ...manager, postPolicy }), true);
    }
  });
});

describe("submission workflow", () => {
  it("only allows turning work in again before it is marked", () => {
    assert.equal(canSubmitWork("ASSIGNED"), true);
    assert.equal(canSubmitWork("SUBMITTED"), true);
    assert.equal(canSubmitWork("LATE"), true);
    assert.equal(canSubmitWork("GRADED"), false);
    assert.equal(canSubmitWork("RETURNED"), false);
  });

  it("hides a grade and feedback until the work is returned", () => {
    assert.equal(visibleGradeForStudent("GRADED", 18), null);
    assert.equal(visibleFeedbackForStudent("GRADED", "Good work"), null);
    assert.equal(visibleGradeForStudent("RETURNED", 18), 18);
    assert.equal(visibleFeedbackForStudent("RETURNED", "Good work"), "Good work");
  });

  it("still hides a missing grade on returned work", () => {
    assert.equal(visibleGradeForStudent("RETURNED", null), null);
  });
});

describe("attachment keys", () => {
  const courseId = "course_123";

  it("accepts a key minted for the same course and scope", () => {
    assert.equal(
      attachmentKeyBelongsToCourse(
        `courses/${courseId}/submission/abc-file.pdf`,
        courseId,
        "submission",
      ),
      true,
    );
  });

  it("rejects another course, another scope and a prefix look-alike", () => {
    assert.equal(
      attachmentKeyBelongsToCourse(
        "courses/other_course/submission/abc-file.pdf",
        courseId,
        "submission",
      ),
      false,
    );
    assert.equal(
      attachmentKeyBelongsToCourse(
        `courses/${courseId}/announcement/abc-file.pdf`,
        courseId,
        "submission",
      ),
      false,
    );
    assert.equal(
      attachmentKeyBelongsToCourse(
        `courses/${courseId}2/submission/abc-file.pdf`,
        courseId,
        "submission",
      ),
      false,
    );
  });
});

describe("rubric scoring", () => {
  const criteria = [
    { id: "criterion_a", points: 8 },
    { id: "criterion_b", points: 4 },
  ];

  it("accepts marks within each criterion's maximum", () => {
    assert.equal(
      rubricScoreError(criteria, [
        { criterionId: "criterion_a", points: 8 },
        { criterionId: "criterion_b", points: 3 },
      ]),
      null,
    );
  });

  it("rejects a criterion from another assignment", () => {
    assert.equal(
      rubricScoreError(criteria, [
        { criterionId: "criterion_from_elsewhere", points: 1 },
      ]),
      "That rubric criterion does not belong to this assignment",
    );
  });

  it("rejects over-max, negative and non-numeric points", () => {
    assert.match(
      rubricScoreError(criteria, [
        { criterionId: "criterion_a", points: 9 },
      ]) ?? "",
      /cannot be more than 8/,
    );
    assert.equal(
      rubricScoreError(criteria, [
        { criterionId: "criterion_a", points: -1 },
      ]),
      "Rubric points cannot be negative",
    );
    assert.equal(
      rubricScoreError(criteria, [
        { criterionId: "criterion_a", points: Number.NaN },
      ]),
      "Rubric points must be numbers",
    );
  });
});

describe("accountRoleDecision", () => {
  it("keeps the role an existing account already has", () => {
    assert.deepEqual(
      accountRoleDecision({ existingRole: "TEACHER" }),
      { kind: "keep", role: "TEACHER" },
    );
    assert.deepEqual(
      accountRoleDecision({ existingRole: "STUDENT" }),
      { kind: "keep", role: "STUDENT" },
    );
  });

  it("never changes the role of an existing account, even one that asks", () => {
    assert.deepEqual(
      accountRoleDecision({ existingRole: "STUDENT", intendedRole: "TEACHER" }),
      { kind: "keep", role: "STUDENT" },
    );
  });

  it("creates a new account with the role the person chose", () => {
    assert.deepEqual(
      accountRoleDecision({ existingRole: null, intendedRole: "TEACHER" }),
      { kind: "create", role: "TEACHER" },
    );
    assert.deepEqual(
      accountRoleDecision({ existingRole: null, intendedRole: "STUDENT" }),
      { kind: "create", role: "STUDENT" },
    );
  });

  it("asks a new account what it is instead of defaulting to student", () => {
    assert.deepEqual(accountRoleDecision({ existingRole: null }), {
      kind: "ask",
    });
    assert.deepEqual(
      accountRoleDecision({ existingRole: null, intendedRole: undefined }),
      { kind: "ask" },
    );
  });
});
