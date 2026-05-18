import fs from "node:fs";
import { generateImage } from "@/lib/images/providers";

async function main() {
  const r = await generateImage(
    "A frosted bottle of low-sugar kombucha on a warm-toned table, soft window light, citrus peel mid-air, shallow depth of field, editorial photography.",
    "4:5",
  );
  if (!r) {
    console.log("All providers failed (or no key).");
    process.exit(1);
  }
  fs.writeFileSync("/tmp/aug-image.png", r.bytes);
  console.log(`Success via ${r.source}: ${r.bytes.length} bytes, ${r.mime}, ${r.width}x${r.height}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
