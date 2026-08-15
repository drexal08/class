import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function listNotifications(limit = 15) {
  const user = await getCurrentUser();
  if (!user) return { items: [], unread: 0 };

  try {
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          linkPath: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    return { items, unread };
  } catch {
    // The bell is decoration; it must never take the page down.
    return { items: [], unread: 0 };
  }
}
