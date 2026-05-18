export interface VoiceProfile {
  name: string;
  description: string;
  doNot: string[];
  tone: string[];
  match: string[];
}

export const VOICES: VoiceProfile[] = [
  {
    name: "Quiet Confidence",
    description:
      "Plainspoken, never shouty. Sentences land. Tone is grounded and a little dry — like a brand that doesn't need to prove anything.",
    doNot: ["exclamation marks", "marketing puffery", "ALL CAPS phrases", "the word 'unleash'"],
    tone: ["calm", "premium", "considered", "warm"],
    match: ["premium", "wellness", "cafe", "skincare", "hospitality", "beverage"],
  },
  {
    name: "Editorial Wit",
    description:
      "Reads like the front page of a thoughtful magazine. Short headlines, dry humor, a single sharp insight per line.",
    doNot: ["emoji", "stacked adjectives", "hashtag stuffing"],
    tone: ["witty", "literary", "knowing"],
    match: ["editorial", "fashion", "hospitality", "media", "cpg"],
  },
  {
    name: "Direct & Useful",
    description:
      "Says exactly what the thing is and what it does. No theater, no metaphors. Trust comes from precision.",
    doNot: ["metaphors that obscure the offer", "hype", "vague promises"],
    tone: ["clear", "useful", "trustworthy"],
    match: ["saas", "fintech", "healthcare", "tools", "developer", "b2b"],
  },
  {
    name: "Joyful Bold",
    description:
      "Big mood. Plays with color and rhythm. Lines should feel like a chant you can almost hear.",
    doNot: ["being timid", "long sentences", "corporate hedging"],
    tone: ["energetic", "playful", "bold"],
    match: ["cpg", "beverage", "events", "kids", "lifestyle"],
  },
  {
    name: "Craft Forward",
    description:
      "Treats the work like a maker treats their bench. Specifics matter. Names the technique. Slow burn — confident, not loud.",
    doNot: ["lazy buzzwords", "generic adjectives"],
    tone: ["artisan", "warm", "grounded"],
    match: ["ceramics", "coffee", "food", "leather", "cafe", "hospitality"],
  },
];

export function voiceForIndustry(industry: string | undefined): VoiceProfile {
  if (!industry) return VOICES[0];
  const lc = industry.toLowerCase();
  return VOICES.find((v) => v.match.some((m) => lc.includes(m) || m.includes(lc))) || VOICES[0];
}
