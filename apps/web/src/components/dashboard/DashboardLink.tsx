import { prisma } from "@misc-sales-app/db";
import { CURRENT_SELLER_ID } from "@/lib/auth";

/** Server component — queries the unread count directly, so it can be dropped
 *  into any server-rendered page without an extra client round-trip. */
export default async function DashboardLink() {
  const unreadCount = await prisma.notification.count({
    where: { userId: CURRENT_SELLER_ID, read: false },
  });

  return (
    <a href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 underline">
      Dashboard
      {unreadCount > 0 && (
        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </a>
  );
}
