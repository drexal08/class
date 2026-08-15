"use client";

import { useActionState, useState } from "react";
import {
  createAnnouncementAction,
  togglePinAction,
  deleteAnnouncementAction,
  type ActionState,
} from "@/lib/actions/stream-actions";
import { Avatar } from "./avatar";
import { formatDateTime } from "@/lib/utils";
import { CommentSection } from "./comment-section";

type Announcement = {
  id: number;
  content: string;
  pinned: boolean;
  createdAt: Date;
  authorName: string;
  authorColor: string;
  authorId: number;
};

type Props = {
  courseId: number;
  announcements: Announcement[];
  userRole: "teacher" | "student";
  themeColor: string;
};

export function StreamView({ courseId, announcements, userRole, themeColor }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createAnnouncementAction,
    {}
  );

  return (
    <div className="space-y-4">
      {/* Announcement Input */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="w-full px-4 py-3 text-left text-gray-500 hover:text-gray-700 flex items-center gap-3 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <span className="text-sm">Announce something to your class</span>
          </button>
        ) : (
          <form action={formAction} className="p-4">
            <input type="hidden" name="courseId" value={courseId} />
            <textarea
              name="content"
              rows={3}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Announce something to your class..."
              autoFocus
            />
            {state.error && (
              <p className="text-sm text-red-600 mt-1">{state.error}</p>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-sm text-white rounded-md disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: themeColor }}
              >
                {isPending ? "Posting..." : "Post"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">This is where you can talk to your class</p>
        </div>
      ) : (
        announcements.map((ann) => (
          <AnnouncementCard
            key={ann.id}
            announcement={ann}
            courseId={courseId}
            userRole={userRole}
          />
        ))
      )}
    </div>
  );
}

function AnnouncementCard({
  announcement,
  courseId,
  userRole,
}: {
  announcement: Announcement;
  courseId: number;
  userRole: "teacher" | "student";
}) {
  const [showComments, setShowComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handlePin() {
    await togglePinAction(announcement.id, courseId);
    setMenuOpen(false);
  }

  async function handleDelete() {
    if (confirm("Delete this announcement?")) {
      await deleteAnnouncementAction(announcement.id, courseId);
    }
    setMenuOpen(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar
            name={announcement.authorName}
            color={announcement.authorColor}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-gray-900">
                {announcement.authorName}
              </span>
              {announcement.pinned && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                  Pinned
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {formatDateTime(announcement.createdAt)}
            </p>
          </div>
          {userRole === "teacher" && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 hover:bg-gray-100 rounded-full cursor-pointer"
              >
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10">
                  <button
                    onClick={handlePin}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    {announcement.pinned ? "Unpin" : "Pin to top"}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
          {announcement.content}
        </div>
      </div>

      <div className="border-t border-gray-100">
        <button
          onClick={() => setShowComments(!showComments)}
          className="w-full px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Class comments
        </button>
        {showComments && (
          <CommentSection
            announcementId={announcement.id}
            courseId={courseId}
          />
        )}
      </div>
    </div>
  );
}
