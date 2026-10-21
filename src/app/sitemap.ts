import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteIdentity";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/pricing", "/privacy", "/terms"].map((path) => ({
    url: `${SITE_URL}${path}`,
  }));
}
