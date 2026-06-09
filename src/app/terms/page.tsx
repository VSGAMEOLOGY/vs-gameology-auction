export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
      <div className="prose prose-gray mt-8 max-w-none">
        <p>By using the VS GAMEOLOGY Auction platform, you agree to these terms.</p>
        <h2>1. Bidding</h2>
        <p>All bids are binding. Winning bidders must complete payment within the specified timeframe.</p>
        <h2>2. Payments</h2>
        <p>Payments must be submitted with proof for admin verification before items are shipped or made available for collection.</p>
        <h2>3. Account Suspension</h2>
        <p>VS GAMEOLOGY reserves the right to suspend or permanently ban accounts that violate platform rules.</p>
      </div>
    </div>
  );
}
