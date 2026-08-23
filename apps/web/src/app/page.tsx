import NewListingFlow from "@/components/listing/NewListingFlow";
import DashboardLink from "@/components/dashboard/DashboardLink";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sell something</h1>
          <p className="mt-1 text-neutral-600">
            Upload a photo — AI identifies the item, grades its condition, and prices it for you.
          </p>
        </div>
        <DashboardLink />
      </div>

      <div className="mt-8">
        <NewListingFlow />
      </div>
    </main>
  );
}
