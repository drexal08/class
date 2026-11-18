# School records

Terms, weighted grades, attendance, absence requests, a weekly timetable and
report cards, all inside LMS Core. There is no AcademicBridge dependency of any
kind: no import, sync, scrape, bookmarklet, embed or vendor call. LMS Core is the
system of record — teachers enter marks and registers here, students read what
is stored here.

Coursework already lives in LMS Core, so this feature does not duplicate it.
`GradeItem.assignmentId` is the only connection between the two, and it is
optional.

## Modules

| Module | Teacher route | Student route | Domain rules |
| --- | --- | --- | --- |
| Terms | `/admin` (Terms section) | – | `src/lib/school/validation.ts` |
| Weighted grades | `/course/[id]/grades`, `/course/[id]/grades/settings` | `/grades` | `src/lib/school/grading.ts` |
| Classwork marks | `/course/[id]/grades/classwork` | `/grades` | existing gradebook |
| Attendance | `/course/[id]/attendance` | `/attendance` | `src/lib/school/attendance.ts` |
| Absence requests | `/course/[id]/attendance` (decide) | `/attendance` (create/cancel) | `src/lib/school/validation.ts` |
| Weekly schedule | `/course/[id]/settings` | `/calendar` | `src/lib/school/schedule.ts` |
| Report cards | `/course/[id]/reports` | `/reports/[termId]` | `src/lib/school/grading.ts` |

Server reads live in `src/lib/data/school.ts`; mutations are server actions in
`src/lib/actions/{term,gradebook,attendance,schedule,report}-actions.ts`.

## Terms

`Term` is `(academicYear, name, startsOn, endsOn, isActive)`. An admin creates,
edits and activates terms in the admin console. Activation is exclusive: setting
one term active deactivates the others, so gradebook defaults are unambiguous.

The active term drives:

- the default term in the gradebook, attendance and report pickers;
- the dashboard "current term" card;
- the term a graded submission lands in (see the coursework bridge).

Dates are date-only values stored at UTC midnight. They are never shifted into
a viewer's local timezone, because doing so would move a Monday register onto
Sunday for anyone west of UTC.

## Weighted grades

Students are grouped into categories (for example Coursework 40, Tests 40,
Participation 20). Weights are whole percentages and must total exactly 100 per
course and term; the settings page refuses anything else.

The maths is in `computeTerm` and is applied identically by the gradebook, the
student marks page, the course report page and the report card:

1. **`null` means "not marked", never zero.** A blank cell is excluded from the
   category; it does not drag the average down.
2. **Category average** is `sum(score) / sum(maximum) × 100` over the items that
   have a score. An item with a non-positive maximum is ignored as malformed
   data.
3. **Empty categories are dropped** and their weight is redistributed across
   the categories that do have marks. A student is not penalised for a test the
   teacher has not entered yet. The remaining weights are normalised back to
   100%.
4. **Rounding happens once**, at the end, to one decimal place. Category
   contributions are not truncated before being summed.
5. No marked items at all ⇒ average is `null`, rendered as "—", not `0`.

The seed data produces exactly this result, which is the reconciliation fixture
for manual checks:

| Student | Coursework (40) | Tests (40) | Participation (20) | Term |
| --- | --- | --- | --- | --- |
| Amara | 18/20 = 90 | 82/100 = 82 | 9/10 = 90 | **86.8** |
| Ben | 14/20 = 70 | 67/100 = 67 | 7/10 = 70 | **68.8** |
| Chidi | — (ungraded) | 74/100 = 74 | 8/10 = 80 | **76.0** (40/20 renormalised) |
| Dana | — | — | 6/10 = 60 | **60.0** |

Per-cell score entry autosaves. It deliberately does **not** call
`revalidatePath`, because revalidating on every keystroke would refetch the grid
under the cursor; the next navigation picks up the stored value.

## Attendance

One `AttendanceSession` is a course on a date, optionally with a `period` when
the course meets twice. Each `AttendanceRecord` is one student's status:

`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`, `LEFT_EARLY`.

The rate rule, shared by the teacher register, the student month grid and the
report card:

- `PRESENT` and `LATE` count as attended (a late student did arrive).
- `ABSENT` and `LEFT_EARLY` count against the rate.
- `EXCUSED` is excluded from both numerator and denominator — an authorised
  absence should not be punished.
- A date with **no session at all is "not recorded"**, never absent. Nothing is
  inferred from the timetable.
- Rate is `attended / counted × 100`, one decimal; `null` when nothing is
  countable (no sessions, or all excused).

`minutesLate` is only accepted for `LATE` and is bounded at 600. `note` is
optional. The register form keeps parallel FormData arrays aligned by submitting
a hidden `minutesLate` per row; the visible input has no `name`.

Dates are keyed by `toDateKey`/`parseDateKey` (`YYYY-MM-DD` at UTC midnight).
The month view is Monday-first and pads adjacent days; days outside the month
are still shown but muted.

## Absence requests

A student requests an authorized absence for a course over a date range with a
reason (`AttendanceRequest`, status `PENDING` → `APPROVED` | `DECLINED`).

- Students may cancel their own pending request.
- Course teachers decide. The decider and decision note are stored.
- **Approving never writes attendance records.** The teacher's register remains
  the source of truth; approval is context, not an automatic `EXCUSED`.
- Creation notifies the course teachers (`NotificationType.ABSENCE_REQUESTED`);
  the decision notifies the student (`ABSENCE_DECIDED`).

## Weekly schedule

`CourseSchedule` is a recurring slot: `weekday` (0 = Monday … 6 = Sunday),
school-local `startsAt`/`endsAt` as `HH:mm`, and an optional room. Slots are
validated for a sane time range and cannot overlap within a course.

The school timezone comes from `SCHOOL_TIMEZONE`, defaulting to
`Africa/Kigali` (`DEFAULT_SCHOOL_TIMEZONE`). "Today" and "this weekday" are
computed in that zone, so a server in UTC and a browser elsewhere agree on which
lessons are current.

Surfaces: the course settings editor, the weekly timetable on `/calendar`, and
the dashboard "Today" strip (`getTodaySchedule`).

## Report cards

A report card is computed, not stored: term average plus per-course rows,
attendance rate and the teacher's `ReportComment` for that course and term.
Only the comment is editable (`saveReportCommentAction`), one per
`(course, term, student)`.

Students see their own card at `/reports/[termId]`; teachers see a class summary
at `/course/[id]/reports` and can write comments per student.

## Coursework bridge

Grading a `Submission` also materialises one gradebook column:

- `materialiseAssignmentGrade` runs inside the grading transaction.
- It uses the active term (falling back to the latest term) and the course's
  category named "Coursework" (case-insensitive).
- `GradeItem.assignmentId` is nullable and unique, so re-grading updates the same
  column instead of adding another, and deleting the assignment nulls the link
  while keeping the historical item and scores (`ON DELETE SET NULL`).
- If there is no term or no "Coursework" category, the bridge is a no-op. It
  never invents a category, because that would silently change the teacher's
  weights. The manual gradebook still works.

Classwork marks remain visible at `/course/[id]/grades/classwork`; the weighted
grid is `/course/[id]/grades`.

## Permissions

| Action | Who |
| --- | --- |
| Create/activate terms | admin |
| Set category weights, create/delete items, enter marks | course teacher |
| Mark a register, decide absence requests | course teacher |
| Write report comments | course teacher |
| View own marks, attendance, report card | enrolled student |
| Create/cancel own pending absence request | enrolled student |
| View any course's records | admin |

Authorization uses the existing guards (`requireCourseTeacher`,
`requireCourseAccess`, `requireUser`), and resources are resolved inside the
scoped query (`where: { id, courseId }`) rather than checked after a lookup.

## Data model

Nine models were added, all additive:

- `Term`
- `GradeCategory` (unique per `courseId, termId, name`)
- `GradeItem` (unique per `courseId, termId, title, assessedOn`; `assignmentId`
  nullable unique)
- `GradeScore` (nullable `score`; unique per `gradeItemId, studentId`)
- `AttendanceSession` (unique per `courseId, date, period`)
- `AttendanceRecord` (unique per `sessionId, studentId`)
- `AttendanceRequest`
- `CourseSchedule`
- `ReportComment` (unique per `courseId, termId, studentId`)

Enums: `AttendanceStatus`, `RequestStatus`. `NotificationType` gained
`ABSENCE_REQUESTED` and `ABSENCE_DECIDED`.

Migrations:

- `20261117215727_school_records` — models, enums and relations.
- `20261117223117_absence_notifications` — the two enum values, kept separate
  because PostgreSQL cannot add enum values and use them in one transaction.

## Seed and tests

`npm run db:seed` (with `SEED_ALLOW=true`) adds a `2026-2027` year with two
terms (Term 1 active, `2026-09-01` – `2026-12-11`), three categories, three
grade items, nine scores, five sessions with twenty records (including excused,
late and left-early), one approved and one pending absence request, five weekly
slots and one report comment. Dates are fixed, so repeated seeds do not
duplicate rows.

`npm test` runs the pure-rule suites in `src/lib/school/*.test.ts`
(`grading`, `attendance`, `schedule`). If a weight, a target column maximum or
an attendance rule changes, update this document and the tests so the displayed
figures and the documented rules cannot drift.
