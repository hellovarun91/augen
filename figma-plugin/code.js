// Augen ↔ Figma bridge — plugin sandbox (main thread).
// Imports an Augen creative as an editable frame (rendered preview as a locked
// backdrop + editable text layers), and reads copy edits back out to send to Augen.
// Runs in Figma's plugin sandbox; talks to ui.html via postMessage.

figma.showUI(__html__, { width: 380, height: 620 });

const PADDING = 0.08; // text inset as a fraction of width

async function importCreative(c) {
  await Promise.all([
    figma.loadFontAsync({ family: "Inter", style: "Bold" }),
    figma.loadFontAsync({ family: "Inter", style: "Regular" }),
  ]);

  // Keep imported frames a sane size on the canvas.
  const scale = Math.min(1, 1080 / Math.max(c.width || 1080, c.height || 1080));
  const W = Math.round((c.width || 1080) * scale);
  const H = Math.round((c.height || 1080) * scale);

  const frame = figma.createFrame();
  frame.name = "Augen · " + (c.format || c.id);
  frame.resize(W, H);
  const center = figma.viewport.center;
  frame.x = Math.round(center.x - W / 2);
  frame.y = Math.round(center.y - H / 2);
  frame.setPluginData("augenId", c.id);

  // Rendered preview as a locked background image fill.
  if (c.pngBytes && c.pngBytes.length) {
    try {
      const image = figma.createImage(new Uint8Array(c.pngBytes));
      const rect = figma.createRectangle();
      rect.resize(W, H);
      rect.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];
      rect.name = "render (locked)";
      rect.locked = true;
      frame.appendChild(rect);
    } catch (e) {
      figma.notify("Couldn't load the render image; importing text only.");
    }
  }

  const addText = (key, text, yFrac, sizeFrac, bold) => {
    if (!text) return;
    const t = figma.createText();
    t.fontName = { family: "Inter", style: bold ? "Bold" : "Regular" };
    t.characters = String(text);
    t.fontSize = Math.max(10, Math.round(W * sizeFrac));
    t.x = Math.round(W * PADDING);
    t.y = Math.round(H * yFrac);
    t.resize(Math.round(W * (1 - PADDING * 2)), t.height);
    t.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    t.name = "augen:" + key; // names let us read edits back out
    frame.appendChild(t);
  };

  // Rough starting positions; the designer is free to move them.
  addText("eyebrow", c.eyebrow, 0.50, 0.020, false);
  addText("headline", c.headline, 0.56, 0.052, true);
  addText("subhead", c.subhead, 0.74, 0.026, false);
  addText("cta", c.cta, 0.88, 0.026, true);

  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
  figma.ui.postMessage({ type: "imported", id: c.id });
}

function findAugenFrame() {
  for (const node of figma.currentPage.selection) {
    if (node.getPluginData && node.getPluginData("augenId")) return node;
    if (node.parent && node.parent.getPluginData && node.parent.getPluginData("augenId")) return node.parent;
  }
  return null;
}

function readSelection() {
  const frame = findAugenFrame();
  if (!frame) { figma.ui.postMessage({ type: "error", message: "Select an imported Augen frame (or a layer inside it) first." }); return; }
  const id = frame.getPluginData("augenId");
  const copy = {};
  for (const child of frame.children) {
    if (child.type === "TEXT" && child.name.indexOf("augen:") === 0) {
      copy[child.name.slice("augen:".length)] = child.characters;
    }
  }
  figma.ui.postMessage({ type: "selection-copy", id: id, copy: copy });
}

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === "import") await importCreative(msg.creative);
    else if (msg.type === "read-selection") readSelection();
    else if (msg.type === "notify") figma.notify(msg.message);
    else if (msg.type === "close") figma.closePlugin();
  } catch (e) {
    figma.ui.postMessage({ type: "error", message: (e && e.message) || "Plugin error" });
  }
};
