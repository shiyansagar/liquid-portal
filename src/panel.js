// side panel: one control per tunable, grouped, live-editing P

const SCHEMA = [
  ["Layout", [
    ["vertical", "Vertical scroll", 0, 1, 1],
    ["cardAspect", "Card aspect (w/h)", 0.5, 2.5, 0.01],
    ["cardSize", "Card size", 0.1, 0.9, 0.005],
    ["cardMaxAcross", "Max size across", 0.3, 1, 0.01],
    ["stack", "Edge to edge (0 = spaced)", 0, 1, 1],
    ["gap", "Gap between cards", 0, 300, 1, "px"],
    ["peek", "Neighbour peek (spaced)", 0, 0.4, 0.002],
    ["sideScale", "Neighbour size", 0.3, 1, 0.01],
    ["farPush", "Off-screen push", 0.5, 3, 0.05],
    ["radius", "Corner radius", 0, 0.15, 0.001],
    ["edgeLight", "Card edge light", 0, 0.4, 0.005],
  ]],
  ["Portal shape", [
    ["shape", "Rounded rect (0 = ellipse)", 0, 1, 1],
    ["round", "Rect rounding", 0, 1, 0.01],
    ["sizeX", "Width", 0.1, 1.5, 0.005],
    ["sizeY", "Height", 0.1, 1.5, 0.005],
    ["rotation", "Rotation", -90, 90, 1, "°"],
    ["posX", "Centre (along)", 0, 1, 0.005],
    ["posY", "Centre (across)", 0, 1, 0.005],
    ["oAspect", "Rim distance along", 0.8, 4, 0.01],
    ["cardCross", "Rim distance across", 0.1, 1.5, 0.005],
  ]],
  ["Refraction", [
    ["zoom", "Inward pull", -1, 2, 0.01],
    ["dispersion", "Dispersion", 0, 40, 0.1],
    ["blur", "Inner blur", 0, 20, 0.1, "px"],
    ["rimStart", "Bend starts at (lower = smoother arc)", 0, 0.99, 0.001],
    ["rimEase", "Bend onset easing", 0.3, 4, 0.05],
    ["rimRelease", "Warp relaxes from (seamless rim)", 0.5, 1, 0.005],
    ["outside", "Show cards outside portal", 0, 1, 0.01],
    ["rimTangential", "Rim swirl", 0, 2, 0.01],
    ["rimInward", "Rim pull", -1, 1, 0.01],
    ["rimFreq1", "Wave freq 1", 0, 12, 1],
    ["rimFreq2", "Wave freq 2", 0, 12, 1],
    ["waveSpeed", "Wave motion (0 = still)", 0, 4, 0.05],
    ["mirror", "Mirror (0 off, 1 top→bottom, 2 bottom→top)", 0, 2, 1],
    ["stick", "Stick to image", 0, 1, 0.01],
    ["stickPx", "Bulge fade distance", 10, 600, 1, "px"],
  ]],
  ["Glow", [
    ["glow", "Glow", 0, 17, 0.1],
    ["whiteGlow", "Centre nova", 0, 2, 0.01],
    ["novaSize", "Nova size", 0, 40, 0.5],
    ["centerDark", "Centre darkening", 0, 0.5, 0.005],
    ["blueRing", "Ring", 0, 20, 0.1],
    ["ringRadius", "Ring radius", 0.1, 0.49, 0.001],
    ["ringWidth", "Ring width", 0.003, 0.1, 0.001],
    ["shimmerFreq", "Shimmer waves", 0, 40, 1],
    ["shimmerSpeed", "Shimmer speed", 0, 12, 0.1],
    ["shimmerDepth", "Shimmer depth", 0, 0.5, 0.005],
    ["blueColor", "Ring colour", "color"],
    ["glowOnBg", "Glow on background", 0, 1, 0.01],
    ["rimLine", "Border line", 0, 4, 0.01],
    ["rimLinePos", "Border position", 0.3, 0.5, 0.001],
    ["rimLineWidth", "Border width", 0.0005, 0.02, 0.0005],
    ["vignette", "Vignette", 0, 1, 0.01],
    ["vignetteSize", "Vignette size", 0.05, 1.5, 0.01],
  ]],
  ["Entry animation", [
    ["entry", "Play on load", 0, 1, 1],
    ["entryStartPx", "Start size", 20, 300, 1, "px"],
    ["riseDuration", "Rise duration", 0.2, 3, 0.05, "s"],
    ["riseStagger", "Rise stagger", 0, 0.5, 0.005, "s"],
    ["fromBelow", "Rise distance", 0, 2, 0.01],
    ["growDelay", "Grow delay", 0, 2, 0.05, "s"],
    ["growDuration", "Grow duration", 0.2, 5, 0.05, "s"],
    ["growStagger", "Grow stagger", 0, 0.5, 0.005, "s"],
    ["lensBloom", "Portal bloom", 0.1, 4, 0.05, "s"],
  ]],
  ["Feel", [
    ["motionStyle", "Spring (0 = original lerp)", 0, 1, 1],
    ["springStiffness", "Spring speed", 10, 200, 1],
    ["springDamping", "Spring damping", 0.4, 1.5, 0.01],
    ["bend", "Bend while moving", 0, 4, 0.05],
    ["bendMax", "Max bend", 0, 300, 1, "px"],
    ["parallax", "Inner parallax", -0.4, 0.4, 0.005],
    ["warpBoost", "Glass swirl at speed", 0, 4, 0.05],
    ["dispBoost", "Colour split at speed", 0, 5, 0.05],
  ]],
  ["Motion", [
    ["ease", "Glide (lower = heavier)", 0.01, 0.4, 0.005],
    ["snapEase", "Snap landing", 0.01, 0.4, 0.005],
    ["snapIdleMs", "Snap after idle", 0, 1000, 10, "ms"],
    ["pageAt", "Page after", 0, 0.5, 0.01],
    ["touchEase", "Touch follow", 0.05, 1, 0.01],
    ["wheel", "Scroll speed", 0.2, 4, 0.05],
    ["drag", "Drag speed", 0.2, 4, 0.05],
    ["friction", "Flick friction", 0.5, 0.99, 0.005],
    ["shrink", "Speed shrink", 0, 0.6, 0.01],
    ["shrinkMax", "Full speed at", 5, 200, 1, "px"],
    ["shrinkAttack", "Shrink attack", 0.01, 1, 0.01],
    ["shrinkDecay", "Shrink decay", 0.005, 0.5, 0.005],
    ["motionBlur", "Motion blur", 0, 3, 0.01],
    ["autoplay", "Autoplay", 0, 10, 0.5, "s"],
  ]],
  ["Scene", [
    ["bg", "Background", "color"],
  ]],
];

export function buildPanel(P, DEFAULTS, persist, { replay } = {}) {
  const box = document.getElementById("controls");
  const refreshers = [];
  const changed = () => persist();

  for (const [group, rows] of SCHEMA) {
    const det = document.createElement("details");
    det.open = group === "Layout" || group === "Portal shape" || group === "Refraction";
    det.innerHTML = `<summary>${group}</summary>`;
    for (const [key, label, min, max, step, unit = ""] of rows) {
      const el = document.createElement("div");
      el.className = "row";
      if (min === "color") {
        el.innerHTML = `<label>${label}<input type="color"></label>`;
        const input = el.querySelector("input");
        const sync = () => { input.value = P[key]; };
        input.addEventListener("input", () => { P[key] = input.value; changed(); });
        sync(); refreshers.push(sync);
      } else {
        el.innerHTML = `<label>${label}<output></output></label><input type="range" min="${min}" max="${max}" step="${step}">`;
        const input = el.querySelector("input"), out = el.querySelector("output");
        const dec = step >= 1 ? 0 : step < 0.001 ? 4 : step < 0.01 ? 3 : 2;
        const sync = () => { input.value = P[key]; out.textContent = Number(P[key]).toFixed(dec) + unit; };
        input.addEventListener("input", () => { P[key] = parseFloat(input.value); sync(); changed(); });
        input.addEventListener("dblclick", () => { P[key] = DEFAULTS[key]; sync(); changed(); });
        sync(); refreshers.push(sync);
      }
      det.appendChild(el);
    }
    box.appendChild(det);
  }

  document.getElementById("reset").addEventListener("click", () => {
    Object.assign(P, DEFAULTS);
    refreshers.forEach((f) => f());
    changed();
  });

  const copyBtn = document.getElementById("copy");
  copyBtn.addEventListener("click", async () => {
    const text = JSON.stringify(P, null, 2);
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      t.remove();
    }
    copyBtn.textContent = "Copied";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
  });

  const replayBtn = document.getElementById("replay");
  if (replayBtn && replay) replayBtn.addEventListener("click", replay);

  // hidden by default; press G to open (see main.js)
}
