import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth-actions";
import { Avatar } from "./avatar";

export async function Header() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 sticky top-0 z-50">
      <Link href="/dashboard" className="flex items-center gap-3">
        <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 text-white"
            fill="currentColor"
          >
            <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
          </svg>
        </div>
        <span className="text-lg font-normal text-gray-700 hidden sm:block">
          Classroom
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm text-gray-600 hidden md:block capitalize">
          {user.role} · {user.name}
        </span>
        <div className="relative group">
          <button className="cursor-pointer">
            <Avatar name={user.name} color={user.avatarColor} size="md" />
          </button>
          <div className="absolute right-0 top-12 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="font-medium text-sm text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
