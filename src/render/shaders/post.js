// Shaders de pós-processamento (GLSL). Todas as passagens usam um triângulo de tela cheia.
//
// Referências principais:
//  - Bloom: Jorge Jimenez, "Next Generation Post Processing in Call of Duty: Advanced Warfare" (SIGGRAPH 2014)
//  - AO: Morgan McGuire et al., "Scalable Ambient Obscurance" (HPG 2012)
//  - God rays: Kenny Mitchell, "Volumetric Light Scattering as a Post-Process" (GPU Gems 3, cap. 13)
//  - Lens flare: John Chapman, "Pseudo Lens Flare" (2013)
//  - Tonemapping: AgX (Troy Sobotka / Filament), ACES fit (Stephen Hill), Khronos PBR Neutral
//  - Ruído de dithering: Jorge Jimenez, Interleaved Gradient Noise

export const fullscreenVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const common = /* glsl */ `
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

// ---------------------------------------------------------------------------
// BLOOM: downsample de 13 amostras (com média de Karis na primeira passagem)
// ---------------------------------------------------------------------------
export const bloomDownFrag = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
uniform float uClampMax;
varying vec2 vUv;
${common}
vec3 S(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
#ifdef PREFILTER
float karis(vec3 c) { return 1.0 / (1.0 + luma(c)); }
#endif
void main() {
  vec3 a = S(vec2(-2.0, 2.0)), b = S(vec2(0.0, 2.0)), c = S(vec2(2.0, 2.0));
  vec3 d = S(vec2(-2.0, 0.0)), e = S(vec2(0.0, 0.0)), f = S(vec2(2.0, 0.0));
  vec3 g = S(vec2(-2.0, -2.0)), h = S(vec2(0.0, -2.0)), i = S(vec2(2.0, -2.0));
  vec3 j = S(vec2(-1.0, 1.0)), k = S(vec2(1.0, 1.0)), l = S(vec2(-1.0, -1.0)), m = S(vec2(1.0, -1.0));
#ifdef PREFILTER
  vec3 g0 = (j + k + l + m) * 0.25;
  vec3 g1 = (a + b + d + e) * 0.25;
  vec3 g2 = (b + c + e + f) * 0.25;
  vec3 g3 = (d + e + g + h) * 0.25;
  vec3 g4 = (e + f + h + i) * 0.25;
  float w0 = karis(g0) * 0.5, w1 = karis(g1) * 0.125, w2 = karis(g2) * 0.125, w3 = karis(g3) * 0.125, w4 = karis(g4) * 0.125;
  vec3 col = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  col = min(col, vec3(uClampMax));
  // limiar suave (quadratic knee)
  float br = max(col.r, max(col.g, col.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = (rq * rq) / (4.0 * uKnee + 1e-4);
  col *= max(rq, br - uThreshold) / max(br, 1e-4);
#else
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
#endif
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

// Upsample com filtro tenda 3x3 (somado de forma aditiva no mip maior)
export const bloomUpFrag = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uWeight;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * uRadius;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += (texture2D(tSrc, vUv + vec2(-o.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(o.x, 0.0)).rgb +
        texture2D(tSrc, vUv + vec2(0.0, -o.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, o.y)).rgb) * 2.0;
  s += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb +
       texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb;
  gl_FragColor = vec4(s * (uWeight / 16.0), 1.0);
}
`;

// ---------------------------------------------------------------------------
// AMBIENT OCCLUSION (SAO simplificado) em meia resolução + blur bilateral
// ---------------------------------------------------------------------------
export const aoFrag = /* glsl */ `
uniform sampler2D tDepth;
uniform mat4 uProjInv;
uniform float uProjScale;
uniform vec2 uResolution;
uniform vec2 uDepthTexel;
uniform float uRadius;
uniform float uIntensity;
uniform float uBias;
varying vec2 vUv;
${common}
vec3 viewPos(vec2 uv, float d) {
  vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}
vec3 viewPosAt(vec2 uv) { return viewPos(uv, texture2D(tDepth, uv).x); }
void main() {
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.99999) { gl_FragColor = vec4(1.0, -1e4, 0.0, 1.0); return; }
  vec3 P = viewPos(vUv, d);
  // reconstrução de normal escolhendo a menor diferença (evita artefatos nas bordas)
  vec3 Pr = viewPosAt(vUv + vec2(uDepthTexel.x, 0.0));
  vec3 Pl = viewPosAt(vUv - vec2(uDepthTexel.x, 0.0));
  vec3 Pu = viewPosAt(vUv + vec2(0.0, uDepthTexel.y));
  vec3 Pd = viewPosAt(vUv - vec2(0.0, uDepthTexel.y));
  vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
  vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(dx, dy));
  float ssR = uRadius * uProjScale / max(-P.z, 0.1);
  ssR = min(ssR, 80.0);
  float rnd = ign(gl_FragCoord.xy) * 6.2831853;
  float occ = 0.0;
  float r2 = uRadius * uRadius;
  for (int i = 0; i < AO_SAMPLES; i++) {
    float t = (float(i) + 0.5) / float(AO_SAMPLES);
    float ang = t * 6.2831853 * 7.0 + rnd;
    vec2 suv = vUv + vec2(cos(ang), sin(ang)) * (t * ssR) / uResolution;
    vec3 S = viewPosAt(suv);
    vec3 v = S - P;
    float vv = dot(v, v);
    float vn = dot(v, N);
    float f = max(r2 - vv, 0.0);
    occ += f * f * f * max((vn - uBias) / (0.02 + vv), 0.0);
  }
  occ /= (r2 * r2 * r2);
  float ao = max(0.0, 1.0 - occ * uIntensity * (5.0 / float(AO_SAMPLES)));
  // some com a distância (precisão do depth buffer longe da câmera gera bandas)
  ao = mix(ao, 1.0, smoothstep(35.0, 70.0, -P.z));
  gl_FragColor = vec4(ao, P.z, 0.0, 1.0);
}
`;

export const aoBlurFrag = /* glsl */ `
uniform sampler2D tAO;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec2 c = texture2D(tAO, vUv).rg;
  float sum = c.r * 0.2270270;
  float wsum = 0.2270270;
  float W[4];
  W[0] = 0.1945946; W[1] = 0.1216216; W[2] = 0.0540540; W[3] = 0.0162162;
  for (int i = 1; i <= 4; i++) {
    for (int s = -1; s <= 1; s += 2) {
      vec2 sv = texture2D(tAO, vUv + uDir * float(i * s)).rg;
      float dz = abs(sv.g - c.g) / (abs(c.g) * 0.04 + 0.05);
      float w = W[i - 1] * exp(-dz * dz);
      sum += sv.r * w;
      wsum += w;
    }
  }
  gl_FragColor = vec4(sum / wsum, c.g, 0.0, 1.0);
}
`;

// ---------------------------------------------------------------------------
// GOD RAYS — máscara do céu + blur radial em direção ao sol
// ---------------------------------------------------------------------------
export const godMaskFrag = /* glsl */ `
uniform sampler2D tDepth;
uniform sampler2D tColor;
uniform vec2 uSunUV;
uniform float uAspect;
uniform vec3 uSunColor;
uniform float uSize;
varying vec2 vUv;
void main() {
  float d = texture2D(tDepth, vUv).x;
  float sky = step(0.99999, d);
  vec2 dv = (vUv - uSunUV) * vec2(uAspect, 1.0);
  float r = length(dv);
  float glow = exp(-r * r / (uSize * uSize)) + 0.25 * exp(-r / (uSize * 3.0));
  // um pouco da cor real do céu (nuvens iluminadas também espalham luz)
  vec3 skyCol = min(texture2D(tColor, vUv).rgb, vec3(4.0));
  vec3 col = (uSunColor * glow + skyCol * glow * 0.15) * sky;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const godBlurFrag = /* glsl */ `
uniform sampler2D tMask;
uniform vec2 uSunUV;
uniform float uDensity;
uniform float uDecay;
uniform float uWeight;
uniform float uExposure;
varying vec2 vUv;
${common}
#define GOD_SAMPLES 48
void main() {
  vec2 delta = (vUv - uSunUV) * (uDensity / float(GOD_SAMPLES));
  vec2 uv = vUv - delta * ign(gl_FragCoord.xy);
  float illum = 1.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < GOD_SAMPLES; i++) {
    acc += texture2D(tMask, uv).rgb * illum * uWeight;
    illum *= uDecay;
    uv -= delta;
  }
  gl_FragColor = vec4(acc * uExposure, 1.0);
}
`;

// ---------------------------------------------------------------------------
// PROFUNDIDADE DE CAMPO — gather em espiral dourada (meia resolução)
// ---------------------------------------------------------------------------
export const dofFrag = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uRange;
uniform float uFarStart;
uniform float uFarEnd;
uniform float uMode;      // 0 = foco em distância, 1 = só desfoque distante
uniform float uMaxRadius; // em pixels (meia resolução)
varying vec2 vUv;
${common}
float viewZ(float d) { return (uNear * uFar) / ((uFar - uNear) * d - uFar); }
float coc(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  float z = -viewZ(d);
  if (uMode > 0.5) return smoothstep(uFarStart, uFarEnd, z);
  return clamp(abs(z - uFocus) / uRange, 0.0, 1.0);
}
void main() {
  float c0 = coc(vUv);
  vec3 acc = texture2D(tColor, vUv).rgb;
  float wsum = 1.0;
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  const float GA = 2.39996323;
  for (int i = 1; i < 28; i++) {
    float r = sqrt(float(i) / 28.0);
    float a = float(i) * GA + rot;
    vec2 o = vec2(cos(a), sin(a)) * r * uMaxRadius * c0 / uResolution;
    vec2 suv = vUv + o;
    float cs = coc(suv);
    float w = smoothstep(r - 0.25, r, max(cs, c0 * 0.6));
    acc += texture2D(tColor, suv).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, c0);
}
`;

// ---------------------------------------------------------------------------
// COMPOSIÇÃO FINAL: AO, DoF, god rays, bloom, lens flare, tonemap, grading,
// vinheta, aberração cromática, grão, iris/fade e dithering
// ---------------------------------------------------------------------------
export const compositeFrag = /* glsl */ `
uniform sampler2D tHDR;
uniform sampler2D tBloom;
uniform sampler2D tAO;
uniform sampler2D tGod;
uniform sampler2D tDoF;
uniform sampler2D tFlare;
uniform vec2 uResolution;
uniform vec2 uHdrTexel;
uniform float uTime;
uniform float uExposure;
uniform float uBloomIntensity;
uniform float uAOStrength;
uniform float uGodStrength;
uniform float uDoFAmount;
uniform float uFlareIntensity;
uniform float uCA;
uniform float uVignette;
uniform float uGrain;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform vec3 uTint;
uniform float uSharpen;
uniform vec3 uFadeColor;
uniform float uFade;
uniform vec2 uIrisCenter;
uniform float uIris;
uniform float uHit;
uniform float uDesaturate;
uniform float uTonemap;
varying vec2 vUv;
${common}

vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
// AgX (Filament/Blender) com "look" levemente punchy. Saída já codificada para exibição (~gamma 2.2).
vec3 tonemapAgX(vec3 color) {
  const mat3 toRec2020 = mat3(0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956);
  const mat3 inset = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 outset = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const mat3 fromRec2020 = mat3(1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187);
  const float minEv = -12.47393;
  const float maxEv = 4.026069;
  color = toRec2020 * color;
  color = inset * color;
  color = max(color, 1e-10);
  color = clamp((log2(color) - minEv) / (maxEv - minEv), 0.0, 1.0);
  color = agxContrast(color);
  // look "punchy"
  float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = pow(max(color, 0.0), vec3(1.08));
  color = l + 1.25 * (color - l);
  color = outset * color;
  color = pow(max(color, 0.0), vec3(2.2));
  color = fromRec2020 * color;
  return clamp(color, 0.0, 1.0);
}

vec3 tonemapACES(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color = ACESInputMat * (color / 0.6);
  vec3 a = color * (color + 0.0245786) - 0.000090537;
  vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
  color = ACESOutputMat * (a / b);
  return clamp(color, 0.0, 1.0);
}

vec3 tonemapNeutral(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}

vec3 linearToSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 lensFlare(vec2 uv) {
  vec2 tc = vec2(1.0) - uv;
  vec2 ghostVec = (vec2(0.5) - tc) * 0.42;
  vec3 result = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec2 off = fract(tc + ghostVec * float(i));
    float w = pow(max(0.0, 1.0 - length(vec2(0.5) - off) / 0.7071), 8.0);
    vec3 s = texture2D(tFlare, off).rgb;
    result += max(s - 1.2, 0.0) * w * (i == 0 ? vec3(1.0, 0.7, 0.5) : (i == 2 ? vec3(0.5, 0.8, 1.0) : vec3(0.8, 1.0, 0.8)));
  }
  vec2 haloVec = normalize(ghostVec + 1e-5) * 0.46;
  vec2 hp = tc + haloVec;
  float hw = pow(max(0.0, 1.0 - length(vec2(0.5) - fract(hp)) / 0.7071), 4.0);
  vec3 h;
  h.r = texture2D(tFlare, hp + haloVec * 0.02).r;
  h.g = texture2D(tFlare, hp).g;
  h.b = texture2D(tFlare, hp - haloVec * 0.02).b;
  result += max(h - 1.0, 0.0) * hw * 0.6;
  return result;
}

void main() {
  vec2 uv = vUv;
  vec2 texel = uHdrTexel;
  vec2 fromCenter = uv - 0.5;
  float r2 = dot(fromCenter, fromCenter);

  // aberração cromática radial (mais forte nas bordas e ao levar dano)
  float ca = (uCA + uHit * 0.012) * r2;
  vec3 col;
  col.r = texture2D(tHDR, uv - fromCenter * ca).r;
  col.g = texture2D(tHDR, uv).g;
  col.b = texture2D(tHDR, uv + fromCenter * ca).b;

  // nitidez adaptativa (compensa a resolução dinâmica)
  if (uSharpen > 0.001) {
    vec3 n = texture2D(tHDR, uv + vec2(0.0, texel.y)).rgb;
    vec3 s = texture2D(tHDR, uv - vec2(0.0, texel.y)).rgb;
    vec3 e = texture2D(tHDR, uv + vec2(texel.x, 0.0)).rgb;
    vec3 w = texture2D(tHDR, uv - vec2(texel.x, 0.0)).rgb;
    vec3 mn = min(min(n, s), min(e, w));
    vec3 mx = max(max(n, s), max(e, w));
    vec3 sharp = col + (col * 4.0 - (n + s + e + w)) * (uSharpen * 0.25);
    col = clamp(sharp, min(mn, col), max(mx, col));
  }

  // profundidade de campo
  if (uDoFAmount > 0.001) {
    vec4 dof = texture2D(tDoF, uv);
    col = mix(col, dof.rgb, smoothstep(0.05, 0.6, dof.a) * uDoFAmount);
  }

  // oclusão ambiente
  col *= mix(1.0, texture2D(tAO, uv).r, uAOStrength);

  // raios de luz volumétricos
  col += texture2D(tGod, uv).rgb * uGodStrength;

  // bloom
  col += texture2D(tBloom, uv).rgb * uBloomIntensity;

  // lens flare
  if (uFlareIntensity > 0.001) col += lensFlare(uv) * uFlareIntensity;

  // exposição + balanço de branco
  col *= uExposure * uTint;

  // tonemapping: 0 = AgX, 1 = ACES (fit de Stephen Hill), 2 = Khronos PBR Neutral
  if (uTonemap < 0.5) col = tonemapAgX(col);
  else if (uTonemap < 1.5) col = tonemapACES(col);
  else col = clamp(tonemapNeutral(col), 0.0, 1.0);

  // grading em espaço de exibição: lift/gamma/gain, contraste, saturação
  col = linearToSRGB(col);
  col = uGain * (col + uLift * (1.0 - col));
  col = pow(max(col, 0.0), 1.0 / uGamma);
  col = (col - 0.5) * uContrast + 0.5;
  float l = luma(col);
  col = mix(vec3(l), col, uSaturation * (1.0 - uDesaturate));

  // vinheta
  float vig = smoothstep(0.95, 0.25, length(fromCenter * vec2(uResolution.x / uResolution.y * 0.72, 1.0)));
  col *= mix(1.0, vig, uVignette + uHit * 0.35);
  col = mix(col, col * vec3(1.0, 0.55, 0.55), uHit * 0.25 * (1.0 - vig));

  // grão de filme + dithering (remove bandas nos gradientes do céu)
  float gn = ign(gl_FragCoord.xy + fract(uTime * 7.31) * 131.7);
  col += (gn - 0.5) * (uGrain * (1.0 - l * 0.6));
  col += (ign(gl_FragCoord.yx + 17.0) - 0.5) / 255.0;

  // transição em íris (estilo desenho animado) e fade
  vec2 ip = (uv - uIrisCenter) * vec2(uResolution.x / uResolution.y, 1.0);
  float iris = smoothstep(uIris, uIris - 0.004, length(ip));
  col *= iris;
  col = mix(col, uFadeColor, uFade);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const copyFrag = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(tSrc, vUv); }
`;
