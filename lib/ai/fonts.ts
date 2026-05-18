// Web-safe font stacks paired with mood. The composer will request these via SVG.
export interface FontPair {
  name: string;
  display: string;
  body: string;
  mood: string[];
}

export const FONTS: FontPair[] = [
  {
    name: "Editorial Serif",
    display:
      '"Tiempos Headline", "GT Sectra", "Canela", "Playfair Display", Georgia, serif',
    body:
      '"Söhne", "Inter", "Helvetica Neue", system-ui, sans-serif',
    mood: ["editorial", "premium", "warm", "calm"],
  },
  {
    name: "Modern Sans",
    display:
      '"Söhne", "GT America", "Inter", "Helvetica Neue", system-ui, sans-serif',
    body:
      '"Söhne", "Inter", "Helvetica Neue", system-ui, sans-serif',
    mood: ["minimalist", "clean", "tech", "industrial"],
  },
  {
    name: "Display Grotesk",
    display:
      '"Founders Grotesk", "ABC Whyte", "Inter", "Helvetica Neue", sans-serif',
    body: '"Söhne", "Inter", system-ui, sans-serif',
    mood: ["bold", "fashion", "moody", "premium"],
  },
  {
    name: "Geometric",
    display: '"Söhne Breit", "Futura", "Avenir Next", system-ui, sans-serif',
    body: '"Söhne", "Inter", system-ui, sans-serif',
    mood: ["playful", "energetic", "vibrant", "kids"],
  },
  {
    name: "Mono Tech",
    display: '"GT America Mono", "JetBrains Mono", ui-monospace, monospace',
    body: '"Söhne", "Inter", system-ui, sans-serif',
    mood: ["tech", "developer", "raw", "industrial"],
  },
  {
    name: "Crafted Serif",
    display: '"Canela", "Tiempos", "GT Sectra", Georgia, serif',
    body: '"GT America", "Söhne", "Inter", system-ui, sans-serif',
    mood: ["artisan", "warm", "natural", "craft"],
  },
];

export function fontPairForMood(mood: string | undefined): FontPair {
  if (!mood) return FONTS[0];
  const lc = mood.toLowerCase();
  return FONTS.find((f) => f.mood.some((m) => lc.includes(m) || m.includes(lc))) || FONTS[0];
}
