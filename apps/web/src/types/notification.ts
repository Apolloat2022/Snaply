export interface SellerNotification {
  id: string;
  type: "ORDER_PAID";
  title: string;
  body: string;
  listingId: string | null;
  orderId: string | null;
  read: boolean;
  createdAt: string;
}
