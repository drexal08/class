import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  role: z.enum(["teacher", "student"]).default("student"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createCourseSchema = z.object({
  name: z.string().min(1, "Course name is required").max(255),
  section: z.string().max(255).optional(),
  subject: z.string().max(255).optional(),
  room: z.string().max(100).optional(),
});

export const joinCourseSchema = z.object({
  joinCode: z
    .string()
    .length(7, "Join code must be 7 characters")
    .toUpperCase(),
});

export const createAnnouncementSchema = z.object({
  courseId: z.number().int().positive(),
  content: z.string().min(1, "Content is required").max(10000),
});

export const createAssignmentSchema = z.object({
  courseId: z.number().int().positive(),
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10000).optional(),
  type: z.enum(["assignment", "quiz", "material"]).default("assignment"),
  maxPoints: z.number().int().min(0).max(1000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  topicId: z.number().int().positive().nullable().optional(),
});

export const createTopicSchema = z.object({
  courseId: z.number().int().positive(),
  name: z.string().min(1, "Topic name is required").max(255),
});

export const submitWorkSchema = z.object({
  assignmentId: z.number().int().positive(),
  content: z.string().max(10000).optional(),
});

export const gradeSubmissionSchema = z.object({
  submissionId: z.number().int().positive(),
  grade: z.number().int().min(0).max(1000),
  feedback: z.string().max(5000).optional(),
});

export const returnSubmissionSchema = z.object({
  submissionId: z.number().int().positive(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment is required").max(5000),
  announcementId: z.number().int().positive().optional(),
  assignmentId: z.number().int().positive().optional(),
  submissionId: z.number().int().positive().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type JoinCourseInput = z.infer<typeof joinCourseSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type SubmitWorkInput = z.infer<typeof submitWorkSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
