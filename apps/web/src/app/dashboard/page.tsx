import { prisma } from "@snaply-app/db";
import NotificationList from "@/components/dashboard/NotificationList";
import { CURRENT_SELLER_ID } from "@/lib/auth";
import type { SellerNotification } from "@/types/notification";

// Per-seller notification state — must render per-request, not get baked
// into the static build.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const records = await prisma.notification.findMany({
    where: { userId: CURRENT_SELLER_ID },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const notifications: SellerNotification[] = records.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    listingId: n.listingId,
    orderId: n.orderId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <a href="/" className="text-sm font-medium text-neutral-600 underline">
          New listing
        </a>
      </div>
      <p className="mt-1 text-neutral-600">Notifications about your listings.</p>

      <div className="mt-8">
        <NotificationList sellerId={CURRENT_SELLER_ID} initialNotifications={notifications} />
      </div>
    </main>
  );
}
