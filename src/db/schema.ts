import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  serial,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["admin", "teacher", "student"]);
export const enrollmentRoleEnum = pgEnum("enrollment_role", ["teacher", "student"]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "assigned",
  "turned_in",
  "graded",
  "returned",
]);
export const assignmentTypeEnum = pgEnum("assignment_type", [
  "assignment",
  "quiz",
  "material",
]);

// ── Users ──────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("student"),
    avatarColor: varchar("avatar_color", { length: 7 }).notNull().default("#4285F4"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)]
);

// ── Courses ────────────────────────────────────────────
export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    section: varchar("section", { length: 255 }),
    subject: varchar("subject", { length: 255 }),
    room: varchar("room", { length: 100 }),
    joinCode: varchar("join_code", { length: 7 }).notNull().unique(),
    themeColor: varchar("theme_color", { length: 7 }).notNull().default("#1967D2"),
    archived: boolean("archived").notNull().default(false),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("courses_join_code_idx").on(table.joinCode),
    index("courses_created_by_idx").on(table.createdById),
  ]
);

// ── Enrollments ────────────────────────────────────────
export const enrollments = pgTable(
  "enrollments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    role: enrollmentRoleEnum("role").notNull().default("student"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("enrollments_user_course_idx").on(table.userId, table.courseId),
    index("enrollments_course_idx").on(table.courseId),
  ]
);

// ── Topics ─────────────────────────────────────────────
export const topics = pgTable(
  "topics",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("topics_course_idx").on(table.courseId)]
);

// ── Announcements (Stream) ─────────────────────────────
export const announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("announcements_course_idx").on(table.courseId),
    index("announcements_author_idx").on(table.authorId),
  ]
);

// ── Assignments ────────────────────────────────────────
export const assignments = pgTable(
  "assignments",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    type: assignmentTypeEnum("type").notNull().default("assignment"),
    maxPoints: integer("max_points"),
    dueDate: timestamp("due_date"),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("assignments_course_idx").on(table.courseId),
    index("assignments_topic_idx").on(table.topicId),
  ]
);

// ── Submissions ────────────────────────────────────────
export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: submissionStatusEnum("status").notNull().default("assigned"),
    content: text("content"),
    grade: integer("grade"),
    feedback: text("feedback"),
    turnedInAt: timestamp("turned_in_at"),
    gradedAt: timestamp("graded_at"),
    late: boolean("late").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("submissions_assignment_student_idx").on(
      table.assignmentId,
      table.studentId
    ),
    index("submissions_student_idx").on(table.studentId),
  ]
);

// ── Comments ───────────────────────────────────────────
export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    announcementId: integer("announcement_id").references(() => announcements.id, {
      onDelete: "cascade",
    }),
    assignmentId: integer("assignment_id").references(() => assignments.id, {
      onDelete: "cascade",
    }),
    submissionId: integer("submission_id").references(() => submissions.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("comments_announcement_idx").on(table.announcementId),
    index("comments_assignment_idx").on(table.assignmentId),
    index("comments_submission_idx").on(table.submissionId),
  ]
);

// ── Attachments ────────────────────────────────────────
export const attachments = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileType: varchar("file_type", { length: 100 }),
    fileSize: integer("file_size"),
    announcementId: integer("announcement_id").references(() => announcements.id, {
      onDelete: "cascade",
    }),
    assignmentId: integer("assignment_id").references(() => assignments.id, {
      onDelete: "cascade",
    }),
    submissionId: integer("submission_id").references(() => submissions.id, {
      onDelete: "cascade",
    }),
    uploadedById: integer("uploaded_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("attachments_announcement_idx").on(table.announcementId),
    index("attachments_assignment_idx").on(table.assignmentId),
    index("attachments_submission_idx").on(table.submissionId),
  ]
);
