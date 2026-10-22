import Link from "next/link";

export default function SetupPage() {
  return <section style={{ maxWidth: 780, margin: "40px auto", padding: "0 24px", overflowWrap: "anywhere" }}>
    <p>Timeline / Development setup</p><h1>Connect your private workspace.</h1>
    <p>This first-use build needs a Supabase development project. It does not create a demo account or store events locally as though they were cloud-saved.</p>
    <ol style={{ lineHeight: 1.9 }}>
      <li>Create a development project at <a href="https://supabase.com/dashboard" rel="noreferrer">Supabase</a>. Keep email confirmation enabled.</li>
      <li>Run <code>supabase\migrations\202610200001_first_use.sql</code> in its SQL Editor, or apply it through the Supabase CLI.</li>
      <li>Copy <code>.env.example</code> to <code>.env.local</code> in the Timeline folder. Set <code>APP_ORIGIN</code>, <code>SUPABASE_URL</code>, and <code>SUPABASE_PUBLISHABLE_KEY</code>. Never put a secret/service-role key here.</li>
      <li>Set the Supabase Auth Site URL to your exact app origin and allow its <code>/api/auth/callback</code> URL, including the recovery variant. For local development the origin is <code>http://localhost:3000</code>.</li>
      <li>Configure confirmation/reset email templates as described in <code>README.md</code>. Use only development/test content until production privacy and lifecycle milestones are complete.</li>
      <li>Restart the development server, then create an account, confirm the email, create a project, and add a first event.</li>
    </ol>
    <p>See <code>README.md</code> in the repository for complete Windows commands, callback configuration, current limitations, and verification steps.</p>
    <p><Link href="/account?mode=signup">Create an account after setup</Link> &middot; <Link href="/">Return to Timeline</Link></p>
  </section>;
}
