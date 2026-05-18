// Curated brand palettes. Each is a tuned 7-color set that always reads as designed.
export interface Palette {
  name: string;
  mood: string[];
  industries: string[];
  background: string;
  surface: string;
  foreground: string;
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
}

export const PALETTES: Palette[] = [
  {
    name: "Editorial Cream",
    mood: ["editorial", "warm", "premium", "natural", "calm"],
    industries: ["beverage", "wellness", "skincare", "hospitality", "cafe"],
    background: "#F2EBDC",
    surface: "#E8D9B8",
    foreground: "#1A1815",
    primary: "#1F4A47",
    secondary: "#C9A45C",
    accent: "#D85A3A",
    muted: "#8C8478",
  },
  {
    name: "Studio Noir",
    mood: ["bold", "premium", "fashion", "moody"],
    industries: ["fashion", "luxury", "spirits", "automotive"],
    background: "#0E0E10",
    surface: "#18181C",
    foreground: "#F5F2EA",
    primary: "#D9B26A",
    secondary: "#5A4A33",
    accent: "#FF5E3A",
    muted: "#5C5C66",
  },
  {
    name: "Botanical",
    mood: ["natural", "wellness", "calm", "organic"],
    industries: ["wellness", "beauty", "supplements", "food"],
    background: "#EFEEE7",
    surface: "#DCDBD0",
    foreground: "#212C24",
    primary: "#345C44",
    secondary: "#9DB089",
    accent: "#E3A857",
    muted: "#7A8478",
  },
  {
    name: "Tropical",
    mood: ["vibrant", "playful", "summer", "energetic"],
    industries: ["beverage", "travel", "lifestyle", "cpg"],
    background: "#FFF0E0",
    surface: "#FFD9A8",
    foreground: "#1A1A2E",
    primary: "#E94F37",
    secondary: "#F2BB05",
    accent: "#159891",
    muted: "#A8896B",
  },
  {
    name: "Brutalist",
    mood: ["industrial", "bold", "tech", "raw"],
    industries: ["saas", "fintech", "developer", "tools"],
    background: "#0A0A0A",
    surface: "#161616",
    foreground: "#F4F4F0",
    primary: "#FF4500",
    secondary: "#FFFFFF",
    accent: "#00E0A4",
    muted: "#7A7A7A",
  },
  {
    name: "Sky",
    mood: ["clean", "calm", "tech", "trust"],
    industries: ["fintech", "healthcare", "saas", "education"],
    background: "#EDF2F7",
    surface: "#D4E0EC",
    foreground: "#0B2C4A",
    primary: "#2A6DB0",
    secondary: "#8EB8DD",
    accent: "#F6B042",
    muted: "#6A7A8C",
  },
  {
    name: "Plum Night",
    mood: ["premium", "moody", "fashion", "evening"],
    industries: ["beauty", "fashion", "hospitality", "events"],
    background: "#1A1224",
    surface: "#2A1B36",
    foreground: "#F4E4D9",
    primary: "#C26FB1",
    secondary: "#7A4789",
    accent: "#FFC857",
    muted: "#6E5A7A",
  },
  {
    name: "Sand & Sea",
    mood: ["coastal", "calm", "summer", "natural"],
    industries: ["hospitality", "travel", "beverage", "lifestyle"],
    background: "#F0E6D2",
    surface: "#D9CFB5",
    foreground: "#1E3A45",
    primary: "#2D6A7C",
    secondary: "#E5C18B",
    accent: "#D85E37",
    muted: "#8C8675",
  },
  {
    name: "Mono Concrete",
    mood: ["minimalist", "industrial", "premium"],
    industries: ["architecture", "premium", "saas", "fashion"],
    background: "#E5E3DD",
    surface: "#CFCDC6",
    foreground: "#1A1A1A",
    primary: "#3D3D3D",
    secondary: "#A3A29A",
    accent: "#E54B2A",
    muted: "#7A7972",
  },
  {
    name: "Cyber",
    mood: ["tech", "future", "energy"],
    industries: ["gaming", "tech", "crypto", "devtool"],
    background: "#070712",
    surface: "#0F0F22",
    foreground: "#EFF6FF",
    primary: "#7C5CFF",
    secondary: "#23D5AB",
    accent: "#FF3C8B",
    muted: "#5C5C7A",
  },
  {
    name: "Terracotta",
    mood: ["warm", "natural", "artisan"],
    industries: ["food", "ceramics", "hospitality", "cafe"],
    background: "#F5E9DA",
    surface: "#E6CFB0",
    foreground: "#2A1A12",
    primary: "#B2553A",
    secondary: "#6F4A2E",
    accent: "#1F574A",
    muted: "#9B7A60",
  },
  {
    name: "Ice Pop",
    mood: ["playful", "vibrant", "kids"],
    industries: ["cpg", "kids", "food", "events"],
    background: "#FCEFF4",
    surface: "#FAD6E2",
    foreground: "#1F1F2A",
    primary: "#FF4D80",
    secondary: "#5BCFE0",
    accent: "#FFB836",
    muted: "#A56F86",
  },
];

export function paletteForIndustry(industry: string | undefined, moodHint?: string): Palette {
  if (!industry) return PALETTES[0];
  const lc = industry.toLowerCase();
  const moodLc = (moodHint || "").toLowerCase();
  const byIndustry = PALETTES.filter((p) => p.industries.some((i) => lc.includes(i) || i.includes(lc)));
  const byMood = (byIndustry.length ? byIndustry : PALETTES).filter((p) =>
    p.mood.some((m) => moodLc.includes(m) || m.includes(moodLc)),
  );
  return (byMood[0] || byIndustry[0] || PALETTES[0]);
}
