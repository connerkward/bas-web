import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGLTF } from "@react-three/drei";
import { EffectComposer, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

// RectAreaLight needs its uniforms initialized once before use.
RectAreaLightUniformsLib.init();
import { lightProbe } from "../lib/lightProbe";
import { scrollProgress } from "../lib/scrollProgress";

// True while the OS pointer is over the document. Flips on document
// mouseleave/mouseenter (cursor crossing the viewport edge) and on
// blur/focus (alt-tab away).
function useMousePresence() {
  const present = useRef(true);
  useEffect(() => {
    const leave = () => {
      present.current = false;
    };
    const enter = () => {
      present.current = true;
    };
    document.addEventListener("mouseleave", leave);
    document.addEventListener("mouseenter", enter);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", enter);
    return () => {
      document.removeEventListener("mouseleave", leave);
      document.removeEventListener("mouseenter", enter);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", enter);
    };
  }, []);
  return present;
}

// Toggle a piece of state with a single keypress. Skips when the user is
// typing in an input/textarea or holding a modifier (so it doesn't fight
// browser shortcuts).
function useKeyToggle(key: string, initial = false) {
  const [on, setOn] = useState(initial);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      setOn((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key]);
  return [on, setOn] as const;
}

// --- Bezier-curve light falloff -----------------------------------------
//
// Cubic bezier from P0=(0,1) to P3=(1,0). c1/c2 are the draggable handles.
// X is normalized distance from light (0 = at light, 1 = at cutoff).
// Y is intensity multiplier (1 = full, 0 = zero). The curve gets sampled
// into a 256-element 1D LUT texture and patched into three.js's
// getDistanceAttenuation via onBeforeCompile.

type LightShape = { c1x: number; c1y: number; c2x: number; c2y: number };

const DEFAULT_LIGHT_SHAPE: LightShape = {
  c1x: 0.05,
  c1y: 0.5,
  c2x: 0.4,
  c2y: 0.05,
};

function sampleBezierLUT(shape: LightShape, n: number): Float32Array {
  // Build a dense (t -> x, y) table, then for each LUT slot binary-search
  // for the matching x. Endpoints (0,1) and (1,0) are implicit.
  const dense = 256;
  const xs = new Float32Array(dense + 1);
  const ys = new Float32Array(dense + 1);
  for (let i = 0; i <= dense; i++) {
    const t = i / dense;
    const it = 1 - t;
    xs[i] =
      3 * it * it * t * shape.c1x + 3 * it * t * t * shape.c2x + t * t * t;
    ys[i] =
      it * it * it + 3 * it * it * t * shape.c1y + 3 * it * t * t * shape.c2y;
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const targetX = i / (n - 1);
    let lo = 0,
      hi = dense;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < targetX) lo = mid;
      else hi = mid;
    }
    const dx = xs[hi] - xs[lo];
    const u = dx > 1e-6 ? (targetX - xs[lo]) / dx : 0;
    out[i] = Math.max(0, ys[lo] + (ys[hi] - ys[lo]) * u);
  }
  return out;
}

function useFalloffLUT(shape: LightShape) {
  const tex = useMemo(() => {
    const data = new Float32Array(256);
    const t = new THREE.DataTexture(
      data,
      256,
      1,
      THREE.RedFormat,
      THREE.FloatType,
    );
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => {
    const data = tex.image.data as Float32Array;
    data.set(sampleBezierLUT(shape, 256));
    tex.needsUpdate = true;
  }, [shape, tex]);
  return tex;
}

// Patch a meshStandardMaterial so its point-light distance attenuation comes
// from our LUT instead of three's default 1/d^decay × cutoff-envelope. The
// LUT covers the full envelope, so we drop the original cutoff multiplier.
function useFalloffPatch(
  matRef: React.RefObject<THREE.MeshStandardMaterial | null>,
  lut: THREE.DataTexture,
) {
  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFalloffLUT = { value: lut };
      shader.fragmentShader =
        "uniform sampler2D uFalloffLUT;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );",
        "float __t = clamp(lightDistance / max(cutoffDistance, 0.0001), 0.0, 1.0);\nfloat distanceFalloff = texture2D(uFalloffLUT, vec2(__t, 0.5)).r;",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );",
        "// LUT already encodes cutoff envelope",
      );
    };
    mat.needsUpdate = true;
  }, [matRef, lut]);
}

type StonePreset = { name: string; color: string; roughness: number };

// Curated to evoke ancient temple-relief lit by torchlight: warm sandstones,
// cool granites, weathered green, soot-stained, and the volcanic basalt of
// Mesoamerican stelae. Order = most to least classical-temple-like.
const STONE_PRESETS: StonePreset[] = [
  { name: "Sandstone Gold", color: "#c9a36a", roughness: 0.92 },
  { name: "Rust Ochre", color: "#94532a", roughness: 0.9 },
  { name: "Limestone Pale", color: "#d6cfb8", roughness: 0.95 },
  { name: "Travertine", color: "#caab8c", roughness: 0.9 },
  { name: "Red Sandstone", color: "#9c5536", roughness: 0.88 },
  { name: "Ochre Adobe", color: "#b6764a", roughness: 0.94 },
  { name: "Granite Dark", color: "#5a564f", roughness: 0.85 },
  { name: "Slate Blue-Grey", color: "#5e6873", roughness: 0.82 },
  { name: "Mossy Stone", color: "#7d8a76", roughness: 0.94 },
  { name: "Soot Charcoal", color: "#3b332b", roughness: 0.92 },
  { name: "Basalt Black", color: "#2a2825", roughness: 0.78 },
];

type Variant = "procedural" | "relief-draft";
const VARIANT: Variant = "relief-draft";

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

// A centered medallion: outer beveled disc, an incised ring, an inner raised
// disc, and a small center boss. Simple, recognizable as a relief panel under
// raking light. Subtle stone grain on top.
function relief(x: number, y: number) {
  const r = Math.sqrt(x * x + y * y);

  const discR = 1.9;
  const discBevel = 0.18;
  const disc = smoothstep(discR, discR - discBevel, r) * 0.22;

  const ringR = 1.45;
  const ringW = 0.07;
  const ringT = (r - ringR) / ringW;
  const ring = -Math.exp(-(ringT * ringT)) * 0.07;

  const medR = 1.05;
  const medBevel = 0.12;
  const medallion = smoothstep(medR, medR - medBevel, r) * 0.1;

  const boss = smoothstep(0.28, 0.06, r) * 0.08;

  const grain = (smoothNoise(x * 14, y * 14) - 0.5) * 0.006;

  return disc + ring + medallion + boss + grain;
}

function ProceduralRelief({ color, roughness, lut }: StoneProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFalloffPatch(matRef, lut);
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(8, 5, 320, 200);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, relief(pos.getX(i), pos.getY(i)));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        ref={matRef}
        color={color}
        roughness={roughness}
        metalness={0}
      />
    </mesh>
  );
}

type StoneProps = {
  color: string;
  roughness: number;
  lut: THREE.DataTexture;
};

const RELIEF_DRAFT_URL = "/meshes/relief-draft.glb";

function ReliefDraft({ color, roughness, lut }: StoneProps) {
  const { scene } = useGLTF(RELIEF_DRAFT_URL);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFalloffPatch(matRef, lut);

  const geometry = useMemo<THREE.BufferGeometry>(() => {
    let found: THREE.BufferGeometry | null = null;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !found) found = mesh.geometry;
    });
    if (!found) throw new Error("relief-draft.glb has no mesh");
    return found;
  }, [scene]);

  useLayoutEffect(() => {
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    const center = new THREE.Vector3();
    bb.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
    const size = new THREE.Vector3();
    bb.getSize(size);
    console.log("[ReliefDraft] bbox size", size, "vertexCount", geometry.attributes.position?.count);
  }, [geometry]);

  return (
    <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial
        ref={matRef}
        color={color}
        roughness={roughness}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

useGLTF.preload(RELIEF_DRAFT_URL);

function HeroMesh({ color, roughness, lut }: StoneProps) {
  if (VARIANT === "relief-draft")
    return <ReliefDraft color={color} roughness={roughness} lut={lut} />;
  return <ProceduralRelief color={color} roughness={roughness} lut={lut} />;
}

function Backdrop({ color, roughness, lut }: StoneProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFalloffPatch(matRef, lut);
  return (
    <mesh position={[0, 0, -0.5]}>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        roughness={roughness}
        metalness={0}
      />
    </mesh>
  );
}


// Two-octave smooth-noise flicker, range ~[-0.18, 0.18]. Slow base envelope
// + faster micro-jitter, both C¹-smooth so the modulation is continuous.
function flameFlicker(t: number) {
  const slow = (smoothNoise(t * 1.9, 11.3) - 0.5) * 0.14;
  const fast = (smoothNoise(t * 7.0, 41.7) - 0.5) * 0.05;
  return slow + fast;
}

// Per-axis smooth wander for the light's local offset. Sample with seeded
// coords so each axis gets an independent path through the noise field.
function flameOffset(t: number, seed: number) {
  return (smoothNoise(t * 2.2, seed) - 0.5) * 2;
}
// Defaults tuned in the debug menu. intensity is the peak before
// flicker/presence/intro multipliers; radiusFrac scales the PointLight cutoff
// to the viewport diagonal at z=0. The actual distance attenuation comes
// from the bezier LUT (see useFalloffPatch), so PointLight.decay no longer
// matters — we leave it at 1.
const DEFAULT_LIGHT_INTENSITY = 0.95;
const DEFAULT_LIGHT_RADIUS_FRAC = 1.5;
// Lock the torch to a lower band of the relief and let only horizontal cursor
// motion move it. Y is in world units (visible vertical half-extent at z=0
// is ~2.5 with CAMERA_Z=8, fov=35, so -1.5 sits about 60% down from center).
const LIGHT_LOCK_Y = -1.5;

const INTRO_DURATION = 1.8; // seconds

// EaseOutCubic intro curve, started on first frame.
function useIntroProgress() {
  const start = useRef<number | null>(null);
  return (clockTime: number) => {
    if (start.current === null) start.current = clockTime;
    const t = Math.min(1, (clockTime - start.current) / INTRO_DURATION);
    return 1 - Math.pow(1 - t, 3);
  };
}

type LightControls = {
  intensity: number;
  radiusFrac: number;
  lockY: boolean;
  // Subtle warm uplight from a thin bar along the bottom of the relief plane.
  // Grazing angle picks up surface bumps, adding contrast/shadow detail.
  bottomBar: boolean;
  bottomBarIntensity: number;
};

// Footlight bar params. Width matches the relief width; height (depth) is
// thin so it reads as a strip. Position sits just below the visible bottom
// edge and slightly in front of the relief plane so light grazes upward.
const BOTTOM_BAR_WIDTH = 7;
const BOTTOM_BAR_HEIGHT = 0.4;
const BOTTOM_BAR_POS: [number, number, number] = [0, -2.4, 0.5];
const BOTTOM_BAR_COLOR = "#ffb072";

function BottomBarLight({ intensity }: { intensity: number }) {
  // Rotate +90° around X so the rect's emission axis (local -Z) points to
  // world +Y (upward), illuminating the relief above it.
  return (
    <rectAreaLight
      position={BOTTOM_BAR_POS}
      rotation={[Math.PI / 2, 0, 0]}
      width={BOTTOM_BAR_WIDTH}
      height={BOTTOM_BAR_HEIGHT}
      intensity={intensity}
      color={BOTTOM_BAR_COLOR}
    />
  );
}

function MouseLight({ controls }: { controls: LightControls }) {
  const { intensity, radiusFrac, lockY } = controls;
  const lightRef = useRef<THREE.PointLight>(null);
  const target = useRef(new THREE.Vector3(0, 0, 0.7));
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    [],
  );
  const hit = useMemo(() => new THREE.Vector3(), []);
  const intro = useIntroProgress();
  const present = useMousePresence();
  const presence = useRef(1);

  useFrame((state) => {
    raycaster.setFromCamera(state.pointer, state.camera);
    const t = state.clock.elapsedTime;
    if (raycaster.ray.intersectPlane(plane, hit)) {
      // Layer subtle XY/Z wander on top of the cursor-tracked target so the
      // shadows on the relief shift like a candle, not a static spotlight.
      const wx = flameOffset(t, 7.3) * 0.025;
      const wy = flameOffset(t, 19.1) * 0.025;
      const wz = flameOffset(t, 31.7) * 0.09;
      const baseY = lockY ? LIGHT_LOCK_Y : hit.y;
      target.current.set(hit.x + wx, baseY + wy, 0.7 + wz);
      if (lightRef.current) {
        // Constant smooth lerp — no snap on jump. Re-entering the window from
        // a different edge looks like the light gliding to its new position.
        lightRef.current.position.lerp(target.current, 0.18);
      }
    }
    if (lightRef.current) {
      // Asymmetric presence lerp: comes up quickly when the cursor enters
      // the window, fades out slowly when it leaves so the room "settles
      // into the dark" instead of blinking off.
      const presenceTarget = present.current ? 1 : 0;
      const presenceRate =
        presenceTarget > presence.current ? 0.07 : 0.025;
      presence.current +=
        (presenceTarget - presence.current) * presenceRate;

      const introT = intro(state.clock.elapsedTime);
      const flicker = 1 + flameFlicker(state.clock.elapsedTime);
      const visibility = introT * flicker * presence.current;
      lightRef.current.intensity = intensity * visibility;
      // Top-bar coloration uses the same visibility BUT also fades out as
      // the user scrolls past the hero — otherwise cursor proximity in the
      // footer would still drive the logo to black on the dark bg.
      const scrollFade = 1 - Math.min(1, scrollProgress.current * 1.6);
      lightProbe.intensity = Math.max(
        0,
        Math.min(1, visibility * scrollFade),
      );

      const cam = state.camera as THREE.PerspectiveCamera;
      const fovRad = (cam.fov * Math.PI) / 180;
      const vH = 2 * CAMERA_Z * Math.tan(fovRad / 2);
      const vW = vH * (state.size.width / state.size.height);
      const diag = Math.sqrt(vW * vW + vH * vH);
      lightRef.current.distance = radiusFrac * diag;
    }
  });

  return (
    <pointLight
      ref={lightRef}
      color="#fff1d4"
      intensity={0}
      distance={5}
      decay={1}
    />
  );
}

const CAMERA_Z = 8;

// Pure XY parallax — no Z dolly. Camera depth is constant.
function CameraRig() {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, CAMERA_Z));

  useFrame((state) => {
    const { x, y } = state.pointer;
    target.current.set(x * 0.18, y * 0.12, CAMERA_Z);
    camera.position.lerp(target.current, 0.06);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

interface HeroProps {
  dpr: number;
}

// Active preset from STONE_PRESETS. Change index to swap material.
const ACTIVE_STONE = STONE_PRESETS[0];

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          display: "flex",
          justifyContent: "space-between",
          opacity: 0.7,
        }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: "#c9a36a" }}
      />
    </label>
  );
}

// Cubic bezier editor. P0=(0,1), P3=(1,0) are pinned (at-light=full,
// at-cutoff=zero). c1/c2 are draggable handles. X axis = normalized distance,
// Y axis = intensity multiplier (1 at top, 0 at bottom). Points can be
// dragged outside [0,1] for over/undershoot effects.
function BezierEditor({
  shape,
  onChange,
}: {
  shape: LightShape;
  onChange: (s: LightShape) => void;
}) {
  const W = 220;
  const H = 140;
  const PAD = 14;
  const innerW = W - 2 * PAD;
  const innerH = H - 2 * PAD;
  const svgRef = useRef<SVGSVGElement>(null);

  // Normalized [0,1] -> SVG coords. Y is flipped (1 at top, 0 at bottom).
  const toSvg = (nx: number, ny: number) => ({
    x: PAD + nx * innerW,
    y: PAD + (1 - ny) * innerH,
  });
  const p0 = toSvg(0, 1);
  const p3 = toSvg(1, 0);
  const c1 = toSvg(shape.c1x, shape.c1y);
  const c2 = toSvg(shape.c2x, shape.c2y);
  const path = `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p3.x} ${p3.y}`;

  const startDrag = (which: "c1" | "c2") => (e: React.PointerEvent) => {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => {
      const rect = svgRef.current!.getBoundingClientRect();
      const nx = (ev.clientX - rect.left - PAD) / innerW;
      const ny = 1 - (ev.clientY - rect.top - PAD) / innerH;
      // Clamp loosely so handles can be dragged just past the bounds.
      const cx = Math.max(-0.2, Math.min(1.2, nx));
      const cy = Math.max(-0.2, Math.min(1.2, ny));
      onChange(
        which === "c1"
          ? { ...shape, c1x: cx, c1y: cy }
          : { ...shape, c2x: cx, c2y: cy },
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <svg
      ref={svgRef}
      width={W}
      height={H}
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: 3,
        touchAction: "none",
      }}
    >
      {/* axes */}
      <line
        x1={PAD}
        y1={H - PAD}
        x2={W - PAD}
        y2={H - PAD}
        stroke="rgba(255,255,255,0.12)"
      />
      <line
        x1={PAD}
        y1={PAD}
        x2={PAD}
        y2={H - PAD}
        stroke="rgba(255,255,255,0.12)"
      />
      <line
        x1={W - PAD}
        y1={PAD}
        x2={W - PAD}
        y2={H - PAD}
        stroke="rgba(255,255,255,0.08)"
        strokeDasharray="2 3"
      />
      {/* handles */}
      <line
        x1={p0.x}
        y1={p0.y}
        x2={c1.x}
        y2={c1.y}
        stroke="rgba(255,255,255,0.18)"
        strokeDasharray="2 2"
      />
      <line
        x1={p3.x}
        y1={p3.y}
        x2={c2.x}
        y2={c2.y}
        stroke="rgba(255,255,255,0.18)"
        strokeDasharray="2 2"
      />
      {/* curve */}
      <path d={path} fill="none" stroke="#c9a36a" strokeWidth={1.5} />
      {/* endpoints */}
      <circle cx={p0.x} cy={p0.y} r={3} fill="rgba(255,255,255,0.4)" />
      <circle cx={p3.x} cy={p3.y} r={3} fill="rgba(255,255,255,0.4)" />
      {/* draggable control points */}
      <circle
        cx={c1.x}
        cy={c1.y}
        r={6}
        fill="#c9a36a"
        style={{ cursor: "grab" }}
        onPointerDown={startDrag("c1")}
      />
      <circle
        cx={c2.x}
        cy={c2.y}
        r={6}
        fill="#c9a36a"
        style={{ cursor: "grab" }}
        onPointerDown={startDrag("c2")}
      />
    </svg>
  );
}

function DebugMenu({
  controls,
  onControlsChange,
  shape,
  onShapeChange,
  onResetLight,
}: {
  controls: LightControls;
  onControlsChange: (c: LightControls) => void;
  shape: LightShape;
  onShapeChange: (s: LightShape) => void;
  onResetLight: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6,
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
        letterSpacing: 0.04,
        color: "#ddd",
        userSelect: "none",
        minWidth: 240,
      }}
    >
      <div
        style={{
          opacity: 0.5,
          letterSpacing: 0.18,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>LIGHT</span>
        <span>press D to close</span>
      </div>
      <BezierEditor shape={shape} onChange={onShapeChange} />
      <div style={{ opacity: 0.4, fontSize: 9, marginTop: -4 }}>
        falloff curve · X = distance · Y = intensity
      </div>
      <Slider
        label="intensity"
        min={0}
        max={5}
        step={0.05}
        value={controls.intensity}
        onChange={(v) => onControlsChange({ ...controls, intensity: v })}
      />
      <Slider
        label="pool size"
        min={0.1}
        max={2}
        step={0.01}
        value={controls.radiusFrac}
        onChange={(v) => onControlsChange({ ...controls, radiusFrac: v })}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={controls.lockY}
          onChange={(e) =>
            onControlsChange({ ...controls, lockY: e.target.checked })
          }
          style={{ accentColor: "#c9a36a" }}
        />
        lock light to lower band (X-only)
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={controls.bottomBar}
          onChange={(e) =>
            onControlsChange({ ...controls, bottomBar: e.target.checked })
          }
          style={{ accentColor: "#c9a36a" }}
        />
        bottom uplight bar
      </label>
      {controls.bottomBar && (
        <Slider
          label="bar intensity"
          min={0}
          max={4}
          step={0.05}
          value={controls.bottomBarIntensity}
          onChange={(v) =>
            onControlsChange({ ...controls, bottomBarIntensity: v })
          }
        />
      )}
      <button
        onClick={onResetLight}
        style={{
          marginTop: 2,
          padding: "3px 6px",
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 3,
          color: "inherit",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "inherit",
          opacity: 0.7,
        }}
      >
        reset
      </button>
    </div>
  );
}

const DEFAULT_LIGHT_CONTROLS: LightControls = {
  intensity: DEFAULT_LIGHT_INTENSITY,
  radiusFrac: DEFAULT_LIGHT_RADIUS_FRAC,
  lockY: false,
  bottomBar: false,
  bottomBarIntensity: 0.6,
};

export default function Hero({ dpr }: HeroProps) {
  const [debugOpen] = useKeyToggle("d", false);
  const [lightShape, setLightShape] =
    useState<LightShape>(DEFAULT_LIGHT_SHAPE);
  const [lightControls, setLightControls] = useState<LightControls>(
    DEFAULT_LIGHT_CONTROLS,
  );
  const lut = useFalloffLUT(lightShape);
  return (
    <div className="hero">
      <Canvas
        camera={{ position: [0, 0, CAMERA_Z], fov: 35 }}
        dpr={dpr}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={["#0a0a0a"]} />
        <ambientLight intensity={0} />
        <MouseLight controls={lightControls} />
        {lightControls.bottomBar && (
          <BottomBarLight intensity={lightControls.bottomBarIntensity} />
        )}
        <CameraRig />
        <Backdrop
          color={ACTIVE_STONE.color}
          roughness={ACTIVE_STONE.roughness}
          lut={lut}
        />
        <Suspense fallback={null}>
          <HeroMesh
            color={ACTIVE_STONE.color}
            roughness={ACTIVE_STONE.roughness}
            lut={lut}
          />
        </Suspense>
        <EffectComposer>
          <Noise opacity={0.2} blendFunction={BlendFunction.OVERLAY} />
        </EffectComposer>
      </Canvas>
      {debugOpen && (
        <DebugMenu
          controls={lightControls}
          onControlsChange={setLightControls}
          shape={lightShape}
          onShapeChange={setLightShape}
          onResetLight={() => {
            setLightControls(DEFAULT_LIGHT_CONTROLS);
            setLightShape(DEFAULT_LIGHT_SHAPE);
          }}
        />
      )}
    </div>
  );
}
