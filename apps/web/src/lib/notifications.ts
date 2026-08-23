import type { Prisma } from "@misc-sales-app/db";
import { sendEmail } from "./email";

interface SaleNotificationParams {
  sellerId: string;
  listingId: string;
  listingTitle: string;
  orderId: string;
  totalCents: number;
}

/** Writes the in-app notification. Takes a transaction client so it lands
 *  atomically with the Order/Listing update that triggered it. */
export async function recordSaleNotification(
  tx: Prisma.TransactionClient,
  params: SaleNotificationParams
): Promise<void> {
  await tx.notification.create({
    data: {
      userId: params.sellerId,
      type: "ORDER_PAID",
      title: "Your item sold!",
      body: `"${params.listingTitle}" sold for ${formatCents(params.totalCents)}.`,
      listingId: params.listingId,
      orderId: params.orderId,
    },
  });
}

/** Best-effort email, sent after the DB transaction commits — a delivery
 *  failure here shouldn't undo an already-recorded sale. */
export async function emailSellerOfSale(
  sellerEmail: string,
  params: Pick<SaleNotificationParams, "listingTitle" | "orderId" | "totalCents">
): Promise<void> {
  await sendEmail({
    to: sellerEmail,
    subject: `Sold: ${params.listingTitle}`,
    html: `<p>Great news — <strong>${params.listingTitle}</strong> just sold for ${formatCents(
      params.totalCents
    )}.</p><p>Order #${params.orderId}</p>`,
  });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
