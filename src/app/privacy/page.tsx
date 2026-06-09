export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <div className="prose prose-gray mt-8 max-w-none">
        <p>VS GAMEOLOGY respects your privacy and is committed to protecting your personal data.</p>
        <h2>Data We Collect</h2>
        <p>We collect account information (name, email, phone), shipping addresses, and bidding activity.</p>
        <h2>How We Use Data</h2>
        <p>Your data is used to operate the auction platform, process payments, and deliver won items.</p>
        <h2>Data Storage</h2>
        <p>All data is securely stored in Supabase with row-level security policies.</p>
      </div>
    </div>
  );
}
