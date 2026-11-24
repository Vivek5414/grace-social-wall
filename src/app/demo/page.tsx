import type { Metadata } from "next";
import InstagramHashtagDiscovery from "@/components/dashboard/InstagramHashtagDiscovery";

export const metadata: Metadata = {
  title: "Instagram Discovery Demo | Grace Social Wall",
  description:
    "Search public Instagram hashtag results in the Grace Social Wall demo.",
};

export default function DemoPage() {
  return (
    <main className="public-demo-page">
      <header className="public-demo-header">
        <div className="public-demo-brand">
          <span className="public-demo-mark" aria-hidden="true">G</span>
          <span>Grace Social Wall</span>
        </div>
        <span className="public-demo-badge">Live API demo</span>
      </header>

      <div className="content public-demo-content">
        <section className="public-demo-intro">
          <p className="public-demo-eyebrow">Instagram hashtag discovery</p>
          <h1>Discover public Instagram posts by hashtag</h1>
          <p>
            Search recent and top public posts, preview returned images and
            videos, and open the original Instagram post.
          </p>
        </section>

        <aside className="public-demo-notice" role="note">
          <strong>Demo integration</strong>
          <span>
            This page is read-only. It does not load or change administrator
            data, use Supabase, or save search results.
          </span>
        </aside>

        <InstagramHashtagDiscovery
          apiEndpoint="/api/demo/instagram/discover"
          publicDemo
        />
      </div>
    </main>
  );
}
