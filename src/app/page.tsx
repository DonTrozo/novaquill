import type { Metadata } from "next";
import HomePage from "@/components/HomePage";
import { SITE_URL } from "@/lib/siteIdentity";

// Keep this on the homepage: other routes must not claim it as their canonical.
export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
};

export default function Home() {
  const identity = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: "NovaQuill",
        alternateName: "NovaQuill.co.za",
        description: "Upload, fill, sign and download PDF documents online.",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "NovaQuill",
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/novaquill-icon-512.png`,
      },
    ],
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(identity).replace(/</g, "\\u003c") }} />
    <HomePage />
  </>;
}
