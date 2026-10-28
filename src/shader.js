// two passes, like the liquid-glass carousel:
//  1. cards are drawn flat into a transparent framebuffer (premultiplied alpha)
//  2. that frame is drawn through a fixed glass portal. the warp, colour split and
//     glow only show where there is an image — the page background stays clean.

export const cardVert = /* glsl */ `
uniform float uBend;       // px the middle of the card trails its edges (signed)
uniform float uVert;       // 1 = scrolling vertically
uniform vec2 uSize;        // card size, px
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 p = position;                                 // -0.5..0.5 in both axes
  // parabolic bow across the card: edges stay put, the middle trails the motion
  if (uVert > 0.5) { float x = p.x * 2.0; p.y += uBend / max(uSize.y, 1.0) * (1.0 - x * x); }
  else             { float y = p.y * 2.0; p.x += uBend / max(uSize.x, 1.0) * (1.0 - y * y); }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const cardFrag = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uSize;        // card size, px
uniform float uTexAspect;  // image w / h
uniform float uRadius;     // px
uniform float uEdgeLight;
uniform float uFade;
uniform float uReady;
uniform float uVert;
uniform float uT;          // card position in cards (0 = centre)
uniform float uParallax;   // how far the photo drifts inside its frame
varying vec2 vUv;

float rbox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main(){
  vec2 p = (vUv - 0.5) * uSize;
  float d = rbox(p, uSize * 0.5, uRadius);
  float aa = max(fwidth(d), 1e-4);
  float a = 1.0 - smoothstep(-aa, aa, d);
  // cover-crop: fill the card, never stretch
  float cardAspect = uSize.x / uSize.y;
  vec2 uv = vUv - 0.5;
  if (uTexAspect > cardAspect) uv.x *= cardAspect / uTexAspect;
  else uv.y *= uTexAspect / cardAspect;
  // inner parallax: zoom in a touch for slack, then let the photo lag the frame
  float zoom = 1.0 + max(uParallax, 0.0);
  uv /= zoom;
  float slack = 0.5 * (1.0 - 1.0 / zoom);
  float drift = clamp(uT * 0.5, -1.0, 1.0) * slack;
  if (uVert > 0.5) uv.y -= drift; else uv.x += drift;
  vec3 c = texture2D(uMap, uv + 0.5).rgb;
  c = mix(vec3(0.9), c, uReady);                     // placeholder until the image loads
  c += uEdgeLight * (1.0 - smoothstep(0.0, 2.5, -d));
  gl_FragColor = vec4(c, a * uFade);
  #include <colorspace_fragment>
}`;

export const lensVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const lensFrag = /* glsl */ `
#define PI 3.14159265
uniform sampler2D tScene;     // premultiplied cards on transparent
uniform vec3 uBg;
uniform vec2 uRes;            // px
uniform float uAspect;        // W / H
uniform float uTime;
uniform float uFx;            // 0 = lens invisible .. 1 = full (entry bloom)
uniform float uMB;            // motion blur along the scroll axis, uv
uniform float uVertical;
// shape
uniform vec2 uCenter;         // screen uv
uniform float uSizeX, uSizeY; // half size, in viewport-height units
uniform float uRotation;      // radians
uniform float uShape;         // 0 ellipse, 1 rounded rect
uniform float uRound;
// refraction
uniform float uZoom, uDispersion, uBlur;
uniform float uRimStart, uRimTangential, uRimInward, uRimFreq1, uRimFreq2, uWaveSpeed;
uniform float uRimEase;       // >1 = gentler onset of the bend
uniform float uRimRelease;    // where the warp starts relaxing back to zero before the rim
uniform float uOutside;       // 0 = cards only visible through the portal, 1 = also intact outside it
// glow
uniform float uGlow, uWhiteGlow, uNovaSize, uCenterDark;
uniform float uBlueRing, uRingRadius, uRingWidth, uShimmerFreq, uShimmerSpeed, uShimmerDepth;
uniform vec3 uBlueColor;
uniform float uRimLine, uRimLinePos, uRimLineWidth;
uniform float uGlowOnBg;      // 0 = glass only visible on images, 1 = glow over the page too
uniform float uStick;         // 1 = warp only shows on / right around a card
uniform float uMirror;        // 0 off, 1 top -> bottom, 2 bottom -> top
uniform float uEnergy;        // 0 at rest .. 1 at full scroll speed
uniform float uWarpBoost, uDispBoost;
uniform float uStickPx;       // how far past a card's edge the warp may spill, px
uniform sampler2D tCover;     // low-res card coverage
uniform float uVignette, uVignetteSize;
varying vec2 vUv;

float sdRoundBox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// ---- the original's frame ("o" space) ----
// the lens math runs exactly as in liquid-glass-carousel, in a frame where
//   x = position along the scroll axis as a fraction of the screen (like the original's width)
//   y = position across, in the original's height units, scaled so a card is uCardCross tall
// so the rim lands on the neighbours exactly like it does there, just turned vertical.
uniform float uAlongPx;      // screen length along the scroll axis, device px
uniform float uCrossPx;      // centre card size across the scroll axis, device px
uniform float uCardCross;    // that card's size in the original's height units (0.47)
uniform float uOAspect;      // the original screen's aspect (1.92)
vec2 s2o(vec2 uv){
  vec2 px = (uv - 0.5) * uRes;
  float along = uVertical > 0.5 ? -px.y : px.x;   // next card comes from below / the right
  float cross = uVertical > 0.5 ? px.x : px.y;
  return vec2(0.5 + along / uAlongPx, 0.5 + cross / uCrossPx * uCardCross);
}
vec2 o2s(vec2 o){
  float along = (o.x - 0.5) * uAlongPx;
  float cross = (o.y - 0.5) * uCrossPx / uCardCross;
  vec2 px = uVertical > 0.5 ? vec2(cross, -along) : vec2(along, cross);
  return 0.5 + px / uRes;
}

vec4 sceneAt(vec2 uv){
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(tScene, uv);
}
vec4 sceneO(vec2 o){ return sceneAt(o2s(o)); }

// card coverage blurred over roughly uStickPx (a tiny copy of the frame, upscaled)
float coverBlur(vec2 uv){ return texture2D(tCover, clamp(uv, 0.0, 1.0)).a; }
vec3 over(vec4 s){ return uBg * (1.0 - s.a) + s.rgb; }   // premultiplied over the page

void main(){
  vec2 scrollDir = uVertical > 0.5 ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
  vec4 base = sceneAt(vUv);
  if (uMB > 0.0001) {
    vec4 b = vec4(0.0);
    for (int i = 0; i < 7; i++) b += sceneAt(vUv + scrollDir * uMB * (float(i) / 6.0 - 0.5));
    base = b / 7.0;
  }

  // local coords in the original's frame (height units), rotated with the portal
  vec2 ov = s2o(vUv);
  vec2 offset = ov - uCenter;
  vec2 p = offset;
  p.x *= uOAspect;
  float ca = cos(uRotation), sa = sin(uRotation);
  p = mat2(ca, -sa, sa, ca) * p;
  vec2 halfSize = vec2(uSizeX, uSizeY);
  float dist = length(p / halfSize);                   // 0 centre .. 1 rim
  float maskND = dist;
  if (uShape > 0.5) {
    float corner = min(uSizeX, uSizeY) * clamp(uRound, 0.0, 1.0);
    maskND = 1.0 + sdRoundBox(p, halfSize, corner) / min(uSizeX, uSizeY);
  }

  // outside the portal: the flat frame, untouched
  if (maskND > 1.0 || uFx < 0.001) {
    // outside the portal: cards are only seen through the glass, so nothing shows
    // here (uOutside 0) — otherwise a card would appear twice: intact out here and warped inside
    gl_FragColor = vec4(mix(uBg, over(base), uOutside), 1.0);
    #include <colorspace_fragment>
    return;
  }

  float fx = uFx;
  float shapeND = clamp(maskND, 0.0, 1.0);
  float nd = clamp(dist, 0.0, 1.0);
  vec2 radialDir = normalize(offset + 1e-6);
  vec2 tangentDir = vec2(-radialDir.y, radialDir.x);
  float angle = atan(p.y, p.x);

  // inward pull + fluid rim waves (static, like the original; wave speed animates it)
  float pull = uZoom * 0.30 * nd * nd * fx;
  // eased ramp over a wide band: the pull builds gently and keeps building, so a card
  // passing the rim bends into one long smooth arc instead of kinking at a line
  float rr = clamp((nd - uRimStart) / max(1.0 - uRimStart, 1e-3), 0.0, 1.0);
  rr = rr * rr * rr * (rr * (rr * 6.0 - 15.0) + 10.0);          // smootherstep
  // ...and relaxes back to zero right at the rim, so the warped part inside meets the
  // intact part outside seamlessly: one bent image, never a second (ghost) copy
  float release = 1.0 - smoothstep(uRimRelease, 1.0, nd);
  float rimStrength = pow(rr, uRimEase) * release * fx;
  // mirror: the far half of the rim reuses the near half's wave (turned 180°),
  // so cards entering get the exact same warp as cards leaving
  float along = -offset.x;                           // + = towards the top / left
  // uMirror: 0 off, 1 = top's warp copied to the bottom, 2 = bottom's warp copied to the top
  bool flipHalf = (uMirror > 1.5 && along > 0.0) || (uMirror > 0.5 && uMirror < 1.5 && along < 0.0);
  float wa = flipHalf ? angle + PI : angle;
  float fluidWave = sin(wa * uRimFreq1 + uTime * uWaveSpeed) * 0.55 + sin(wa * uRimFreq2 - uTime * uWaveSpeed * 0.7) * 0.25;
  float rScreen = (uSizeX + uSizeY) * 0.5;
  // the glass goes liquid while things move and calms down as they land
  float swirl = uRimTangential * (1.0 + uWarpBoost * uEnergy);
  vec2 rimOff = tangentDir * fluidWave * rimStrength * rScreen * swirl;
  vec2 rimPull = -radialDir * rimStrength * rScreen * uRimInward;
  vec2 baseUV = uCenter + offset * (1.0 - pull) + rimOff + rimPull;

  // chromatic dispersion: weighted multi-sample, per-channel normalised (alpha rides with green)
  float rimMask = smoothstep(uRimStart, 1.0, nd) * release;
  vec2 dispDir = offset * uDispersion * (1.0 + uDispBoost * uEnergy) * 0.004 * rimMask * fx;
  vec4 col = vec4(0.0);
  vec3 caW = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float t = float(i) / 15.0;
    vec4 s = sceneO(baseUV + dispDir * (t - 0.5) + vec2(uMB * (t - 0.5), 0.0));
    vec3 w = vec3(exp(-pow(t / 0.38, 2.0)), exp(-pow((t - 0.5) / 0.38, 2.0)), exp(-pow((t - 1.0) / 0.38, 2.0)));
    col.rgb += s.rgb * w;
    col.a += s.a * w.g;
    caW += w;
  }
  col.rgb /= max(caW, vec3(0.001));
  col.a /= max(caW.g, 0.001);

  // soft blur in the calm middle, sharp at the rim
  float blurFade = 1.0 - smoothstep(0.72, 0.98, nd);
  if (uBlur > 0.01 && blurFade > 0.01) {
    vec2 blurRad = vec2(uBlur / uAlongPx, uBlur / uCrossPx * uCardCross) * blurFade * fx;
    vec4 bcol = vec4(0.0);
    float btw = 0.0;
    for (int ai = 0; ai < 6; ai++) {
      float a = float(ai) * PI / 3.0;
      for (int ri = 0; ri < 3; ri++) {
        float rr = 0.4 + float(ri) * 0.3;
        float w = 1.0 - rr * 0.38;
        bcol += sceneO(baseUV + vec2(cos(a), sin(a)) * blurRad * rr) * w;
        btw += w;
      }
    }
    col = mix(bcol / btw, col, rimMask);
  }

  // glass only shows up where there is an image
  float cov = clamp(col.a, 0.0, 1.0);
  float glowMask = mix(uGlowOnBg, 1.0, cov);

  // glassy darkening toward the centre (images only)
  col.rgb *= mix(1.0 - uCenterDark * fx, 1.0, smoothstep(0.0, 0.38, shapeND));

  // white nova, shimmering ring + aura, bright border
  float r2 = shapeND * shapeND * 0.25;
  float gs = max(uNovaSize * uGlow * 0.003, 0.004);
  float nova = (exp(-r2 / gs) + exp(-r2 / (gs * 7.0)) * 0.18) * uWhiteGlow * (uGlow / 17.0) * 1.15;
  float dC = shapeND * 0.5;
  float tR = clamp(uRingRadius, 0.1, 0.49);
  float rW = max(uRingWidth, 0.003);
  float ring = exp(-pow((dC - tR) / rW, 2.0)) * uBlueRing * (uGlow / 17.0) * 1.8;
  ring *= sin(angle * uShimmerFreq + uTime * uShimmerSpeed) * uShimmerDepth + (1.0 - uShimmerDepth);
  float aura = exp(-pow((dC - tR) / (rW * 6.0), 2.0)) * 0.28 * uBlueRing * (uGlow / 17.0);
  float line = exp(-pow((dC - uRimLinePos) / max(uRimLineWidth, 0.0001), 2.0)) * uRimLine;
  vec3 glow = (vec3(nova) + uBlueColor * (ring + aura) + vec3(line)) * fx * glowMask;

  vec3 lensC = over(col) + glow;
  float a = smoothstep(1.0, 0.93, maskND);             // soft edge where glass meets the flat frame

  // stick to image, softly: how much card is there around here in the flat frame?
  // the warp fades out gradually with distance from a card, so bulges can swell past
  // an image like the original, but stray streaks far from any card melt away (no hard edges)
  if (uStick > 0.001) {
    vec2 r = vec2(uStickPx) / uRes * 0.5;
    float bl = (coverBlur(vUv) * 2.0
              + coverBlur(vUv + vec2(r.x, r.y)) + coverBlur(vUv + vec2(-r.x, r.y))
              + coverBlur(vUv + vec2(r.x, -r.y)) + coverBlur(vUv - r)) / 6.0;
    float near = max(base.a, bl * 2.5);
    a *= mix(1.0, smoothstep(0.02, 0.22, near), uStick);  // stays rich, then fades late
  }
  vec3 outc = mix(mix(uBg, over(base), uOutside), lensC, a);

  if (uVignette > 0.001) {
    vec2 vc = vUv - 0.5;
    vc.x *= uAspect;                                  // screen space
    float d = length(vc) / max(uVignetteSize, 0.0001);
    outc *= clamp(1.0 - uVignette * smoothstep(0.5, 1.0, d), 0.0, 1.0);
  }
  outc += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(outc, 1.0);
  #include <colorspace_fragment>
}`;
