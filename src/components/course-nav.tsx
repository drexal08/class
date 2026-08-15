"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  courseId: number;
  courseName: string;
  themeColor: string;
  userRole: "teacher" | "student";
};

export function CourseNav({ courseId, courseName, themeColor, userRole }: Props) {
  const pathname = usePathname();
  const base = `/course/${courseId}`;

  const tabs = [
    { label: "Stream", href: base },
    { label: "Classwork", href: `${base}/classwork` },
    { label: "People", href: `${base}/people` },
    ...(userRole === "teacher"
      ? [{ label: "Grades", href: `${base}/grades` }]
      : []),
  ];

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="flex items-center gap-1 h-12 overflow-x-auto">
          <Link
            href="/dashboard"
            className="mr-2 p-2 rounded-full hover:bg-gray-100 text-gray-500 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="text-sm font-medium text-gray-800 truncate mr-4 max-w-[200px]">
            {courseName}
          </span>
          {tabs.map((tab) => {
            const isActive =
              tab.href === base
                ? pathname === base
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition shrink-0 ${
                  isActive
                    ? "border-current"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
                style={isActive ? { color: themeColor, borderColor: themeColor } : {}}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
