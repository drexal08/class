"use client";

import { useState, useTransition } from "react";
import { MessageSquare, MoreVertical, Pin, PinOff, Trash2 } from "lucide-react";

import { AttachmentList } from "@/components/shared/attachment-list";
import { FileUploader } from "@/components/shared/file-uploader";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  CommentThread,
  type ThreadComment,
} from "@/components/stream/comment-thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  deleteAnnouncementAction,
  setAnnouncementPinnedAction,
} from "@/lib/actions/stream-actions";
import { displayNameOf, formatRelative } from "@/lib/utils";

export type StreamPost = {
  id: string;
  content: string;
  pinned: boolean;
  createdAt: Date;
  authorId: string;
  author: {
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  attachments: {
    id: string;
    name: string;
    url: string;
    mimeType: string | null;
    size: number | null;
    uploadedById: string | null;
  }[];
  comments: ThreadComment[];
};

export function AnnouncementCard({
  post,
  courseId,
  viewerId,
  canManage,
  canComment,
  uploadsEnabled,
}: {
  post: StreamPost;
  courseId: string;
  viewerId: string;
  canManage: boolean;
  canComment: boolean;
  uploadsEnabled: boolean;
}) {
  const [showComments, setShowComments] = useState(post.comments.length > 0);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <UserAvatar user={post.author} className="size-9 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{displayNameOf(post.author)}</span>
            <span className="text-xs text-muted-foreground">
              {formatRelative(post.createdAt)}
            </span>
            {post.pinned && (
              <Badge variant="outline" className="ml-1">
                <Pin className="size-3" />
                Pinned
              </Badge>
            )}
          </div>
        </div>

        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label="Post options"
                disabled={pending}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() =>
                  startTransition(async () => {
                    await setAnnouncementPinnedAction(
                      courseId,
                      post.id,
                      !post.pinned,
                    );
                  })
                }
              >
                {post.pinned ? <PinOff /> : <Pin />}
                {post.pinned ? "Unpin" : "Pin to top"}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  startTransition(async () => {
                    await deleteAnnouncementAction(courseId, post.id);
                  })
                }
              >
                <Trash2 />
                Delete post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {post.content}
      </p>

      {post.attachments.length > 0 && (
        <div className="mt-4">
          <AttachmentList
            attachments={post.attachments}
            courseId={courseId}
            viewerId={viewerId}
            canManage={canManage}
          />
        </div>
      )}

      {uploadsEnabled &&
        (canManage || post.authorId === viewerId) &&
        canComment && (
          <div className="mt-3">
            <FileUploader
              courseId={courseId}
              scope="announcement"
              targetId={post.id}
              enabled={uploadsEnabled}
              label="Attach file"
            />
          </div>
        )}

      <Separator className="my-4" />

      {showComments ? (
        <CommentThread
          comments={post.comments}
          courseId={courseId}
          announcementId={post.id}
          viewerId={viewerId}
          canModerate={canManage}
          canComment={canComment}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          onClick={() => setShowComments(true)}
        >
          <MessageSquare strokeWidth={1.75} />
          {post.comments.length > 0
            ? `${post.comments.length} class ${post.comments.length === 1 ? "comment" : "comments"}`
            : "Add a class comment"}
        </Button>
      )}
    </Card>
  );
}
