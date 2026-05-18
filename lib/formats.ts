export interface FormatSpec {
  slug: string;
  name: string;
  platform: "Meta" | "Google" | "LinkedIn" | "Pinterest" | "TikTok" | "X" | "Reddit" | "Snap";
  aspect: string;
  width: number;
  height: number;
  placement: string;
  channel: "feed" | "story" | "reel" | "display" | "search" | "discover";
}

export const ALL_FORMATS: FormatSpec[] = [
  // Meta — feed & stories & reels
  { slug: "meta-feed-1x1", name: "Meta Feed Square", platform: "Meta", aspect: "1:1", width: 1080, height: 1080, placement: "FB/IG Feed", channel: "feed" },
  { slug: "meta-feed-4x5", name: "Meta Feed Portrait", platform: "Meta", aspect: "4:5", width: 1080, height: 1350, placement: "FB/IG Feed", channel: "feed" },
  { slug: "meta-story-9x16", name: "Meta Story", platform: "Meta", aspect: "9:16", width: 1080, height: 1920, placement: "FB/IG Stories", channel: "story" },
  { slug: "meta-reels-9x16", name: "Meta Reels Cover", platform: "Meta", aspect: "9:16", width: 1080, height: 1920, placement: "IG Reels", channel: "reel" },
  { slug: "meta-link-191x1", name: "Meta Link Ad", platform: "Meta", aspect: "1.91:1", width: 1200, height: 628, placement: "FB Link Ads", channel: "feed" },

  // Google Display & YouTube
  { slug: "google-display-300x250", name: "Display Medium Rect", platform: "Google", aspect: "6:5", width: 300, height: 250, placement: "GDN", channel: "display" },
  { slug: "google-display-336x280", name: "Display Large Rect", platform: "Google", aspect: "12:10", width: 336, height: 280, placement: "GDN", channel: "display" },
  { slug: "google-display-728x90", name: "Display Leaderboard", platform: "Google", aspect: "8:1", width: 728, height: 90, placement: "GDN", channel: "display" },
  { slug: "google-display-300x600", name: "Display Half-page", platform: "Google", aspect: "1:2", width: 300, height: 600, placement: "GDN", channel: "display" },
  { slug: "google-display-160x600", name: "Display Skyscraper", platform: "Google", aspect: "4:15", width: 160, height: 600, placement: "GDN", channel: "display" },
  { slug: "google-display-320x50", name: "Mobile Banner", platform: "Google", aspect: "32:5", width: 320, height: 50, placement: "GDN Mobile", channel: "display" },
  { slug: "google-discovery-191x1", name: "Discovery Landscape", platform: "Google", aspect: "1.91:1", width: 1200, height: 628, placement: "Discovery", channel: "discover" },
  { slug: "google-discovery-1x1", name: "Discovery Square", platform: "Google", aspect: "1:1", width: 1200, height: 1200, placement: "Discovery", channel: "discover" },
  { slug: "youtube-bumper-16x9", name: "YouTube Companion", platform: "Google", aspect: "16:9", width: 1920, height: 1080, placement: "YouTube", channel: "display" },

  // LinkedIn
  { slug: "linkedin-feed-1x1", name: "LinkedIn Feed Square", platform: "LinkedIn", aspect: "1:1", width: 1200, height: 1200, placement: "Feed", channel: "feed" },
  { slug: "linkedin-feed-191x1", name: "LinkedIn Feed Wide", platform: "LinkedIn", aspect: "1.91:1", width: 1200, height: 628, placement: "Feed", channel: "feed" },

  // Pinterest
  { slug: "pinterest-pin-2x3", name: "Pinterest Pin", platform: "Pinterest", aspect: "2:3", width: 1000, height: 1500, placement: "Pin", channel: "feed" },
  { slug: "pinterest-idea-9x16", name: "Pinterest Idea Pin", platform: "Pinterest", aspect: "9:16", width: 1080, height: 1920, placement: "Idea Pin", channel: "story" },

  // TikTok
  { slug: "tiktok-feed-9x16", name: "TikTok In-Feed", platform: "TikTok", aspect: "9:16", width: 1080, height: 1920, placement: "Feed", channel: "feed" },

  // X
  { slug: "x-feed-191x1", name: "X Image Card", platform: "X", aspect: "1.91:1", width: 1200, height: 628, placement: "Feed", channel: "feed" },

  // Snap
  { slug: "snap-story-9x16", name: "Snap Story", platform: "Snap", aspect: "9:16", width: 1080, height: 1920, placement: "Discover/Story", channel: "story" },

  // Reddit
  { slug: "reddit-promoted-1x1", name: "Reddit Promoted Square", platform: "Reddit", aspect: "1:1", width: 1200, height: 1200, placement: "Feed", channel: "feed" },
];

export function formatBySlug(slug: string): FormatSpec | undefined {
  return ALL_FORMATS.find((f) => f.slug === slug);
}

export function defaultFormatSlugs(): string[] {
  return [
    "meta-feed-1x1",
    "meta-feed-4x5",
    "meta-story-9x16",
    "google-display-300x250",
    "google-display-728x90",
    "google-display-300x600",
    "linkedin-feed-1x1",
    "pinterest-pin-2x3",
    "x-feed-191x1",
    "tiktok-feed-9x16",
  ];
}

export function formatsByPlatform() {
  const groups: Record<string, FormatSpec[]> = {};
  for (const f of ALL_FORMATS) {
    (groups[f.platform] ||= []).push(f);
  }
  return groups;
}
