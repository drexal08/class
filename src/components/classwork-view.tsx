"use client";

import { useState, useActionState } from "react";
import {
  createAssignmentAction,
  createTopicAction,
  type ActionState,
} from "@/lib/actions/assignment-actions";
import Link from "next/link";
import { formatDate, isOverdue } from "@/lib/utils";

type Assignment = {
  id: number;
  title: string;
  description: string | null;
  type: "assignment" | "quiz" | "material";
  maxPoints: number | null;
  dueDate: Date | null;
  topicId: number | null;
  published: boolean;
  createdAt: Date;
  createdByName: string;
};

type Topic = {
  id: number;
  name: string;
  sortOrder: number;
};

type Props = {
  courseId: number;
  assignments: Assignment[];
  topics: Topic[];
  userRole: "teacher" | "student";
  themeColor: string;
};

const typeIcons: Record<string, { icon: string; color: string }> = {
  assignment: { icon: "📝", color: "bg-blue-100 text-blue-700" },
  quiz: { icon: "❓", color: "bg-purple-100 text-purple-700" },
  material: { icon: "📖", color: "bg-green-100 text-green-700" },
};

export function ClassworkView({
  courseId,
  assignments,
  topics,
  userRole,
  themeColor,
}: Props) {
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [showCreateTopic, setShowCreateTopic] = useState(false);

  // Group assignments by topic
  const ungrouped = assignments.filter((a) => !a.topicId);
  const grouped = topics.map((topic) => ({
    ...topic,
    items: assignments.filter((a) => a.topicId === topic.id),
  }));

  return (
    <div>
      {userRole === "teacher" && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setShowCreateAssignment(true)}
            className="px-4 py-2 text-sm text-white rounded-md flex items-center gap-2 cursor-pointer"
            style={{ backgroundColor: themeColor }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create
          </button>
          <button
            onClick={() => setShowCreateTopic(true)}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 cursor-pointer"
          >
            Create topic
          </button>
        </div>
      )}

      {/* Create assignment form */}
      {showCreateAssignment && (
        <CreateAssignmentForm
          courseId={courseId}
          topics={topics}
          themeColor={themeColor}
          onClose={() => setShowCreateAssignment(false)}
        />
      )}

      {/* Create topic form */}
      {showCreateTopic && (
        <CreateTopicForm
          courseId={courseId}
          themeColor={themeColor}
          onClose={() => setShowCreateTopic(false)}
        />
      )}

      {/* Ungrouped assignments */}
      {ungrouped.length > 0 && (
        <div className="mb-6">
          {ungrouped.map((a) => (
            <AssignmentItem
              key={a.id}
              assignment={a}
              courseId={courseId}
              themeColor={themeColor}
            />
          ))}
        </div>
      )}

      {/* Grouped by topic */}
      {grouped.map((topic) => (
        <div key={topic.id} className="mb-6">
          <h3
            className="text-lg font-medium mb-2 pb-1 border-b-2"
            style={{ color: themeColor, borderColor: themeColor }}
          >
            {topic.name}
          </h3>
          {topic.items.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No items</p>
          ) : (
            topic.items.map((a) => (
              <AssignmentItem
                key={a.id}
                assignment={a}
                courseId={courseId}
                themeColor={themeColor}
              />
            ))
          )}
        </div>
      ))}

      {assignments.length === 0 && topics.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
            📚
          </div>
          <p className="text-sm">
            {userRole === "teacher"
              ? "Add assignments, quizzes, and materials for your class"
              : "No classwork yet"}
          </p>
        </div>
      )}
    </div>
  );
}

function AssignmentItem({
  assignment,
  courseId,
  themeColor,
}: {
  assignment: Assignment;
  courseId: number;
  themeColor: string;
}) {
  const info = typeIcons[assignment.type] || typeIcons.assignment;
  const overdue = isOverdue(assignment.dueDate);

  return (
    <Link
      href={`/course/${courseId}/assignment/${assignment.id}`}
      className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg mb-2 hover:shadow-sm transition group"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: themeColor }}
      >
        <span className="text-lg">{info.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">
          {assignment.title}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
          <span className="capitalize">{assignment.type}</span>
          {assignment.dueDate && (
            <>
              <span>·</span>
              <span className={overdue ? "text-red-500" : ""}>
                Due {formatDate(assignment.dueDate)}
                {overdue && " (Past due)"}
              </span>
            </>
          )}
          {assignment.maxPoints !== null && (
            <>
              <span>·</span>
              <span>{assignment.maxPoints} points</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function CreateAssignmentForm({
  courseId,
  topics,
  themeColor,
  onClose,
}: {
  courseId: number;
  topics: Topic[];
  themeColor: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createAssignmentAction,
    {}
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-medium text-gray-800 mb-4">
        Create new classwork
      </h3>
      {state.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {state.error}
        </div>
      )}
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="courseId" value={courseId} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Title *</label>
            <input
              name="title"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Type</label>
            <select
              name="type"
              defaultValue="assignment"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="assignment">Assignment</option>
              <option value="quiz">Quiz</option>
              <option value="material">Material</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Instructions (optional)
          </label>
          <textarea
            name="description"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Points
            </label>
            <input
              name="maxPoints"
              type="number"
              min="0"
              max="1000"
              placeholder="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Due date
            </label>
            <input
              name="dueDate"
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Topic
            </label>
            <select
              name="topicId"
              defaultValue=""
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">No topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 text-sm text-white rounded-md disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: themeColor }}
          >
            {isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateTopicForm({
  courseId,
  themeColor,
  onClose,
}: {
  courseId: number;
  themeColor: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createTopicAction,
    {}
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Create topic</h3>
      {state.error && (
        <p className="text-sm text-red-600 mb-2">{state.error}</p>
      )}
      <form action={formAction} className="flex gap-3">
        <input type="hidden" name="courseId" value={courseId} />
        <input
          name="name"
          required
          placeholder="Topic name"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 text-sm text-white rounded-md disabled:opacity-50 cursor-pointer"
          style={{ backgroundColor: themeColor }}
        >
          {isPending ? "Creating..." : "Create"}
        </button>
      </form>
    </div>
  );
}
