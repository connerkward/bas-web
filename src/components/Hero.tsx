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

// True while a pointer is engaged with the page:
//   - Mouse: cursor inside the document and the window has focus.
//   - Touch: a finger is currently pressing the screen.
// Flips false when the cursor leaves, the window loses focus, or all touches
// end. Touch end → torch fades out (matches the "cursor leaves" feel on
// desktop), so the relief settles into the dark when the user lifts off.
// Touch devices have no hover — the torch should stay dark until the user
// actually presses. Mouse devices start lit so desktop renders the scene
// immediately. Used as the seed for both `present` (boolean) and `presence`
// (lerp target ref) so the very first frame matches steady-state.
const INITIAL_PRESENT =
  typeof window === "undefined" ||
  !window.matchMedia("(pointer: coarse)").matches;

function useMousePresence() {
  const present = useRef(INITIAL_PRESENT);
  useEffect(() => {
    const leave = () => {
      present.current = false;
    };
    const enter = () => {
      present.current = true;
    };
    // `mouseout` with `relatedTarget === null` is the reliable "cursor
    // left the document" signal across browsers — `mouseleave` on
    // `document` is fired inconsistently. We bind on `documentElement`
    // (html) so it fires when the cursor crosses the viewport boundary.
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget === null) leave();
    };
    const onOver = (e: MouseEvent) => {
      if (e.relatedTarget === null) enter();
    };
    document.documentElement.addEventListener("mouseout", onOut);
    document.documentElement.addEventListener("mouseover", onOver);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", enter);
    // Touch presence: any active touch counts as "engaged."
    const onTouchStart = () => {
      present.current = true;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) present.current = false;
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      document.documentElement.removeEventListener("mouseout", onOut);
      document.documentElement.removeEventListener("mouseover", onOver);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", enter);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
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
  c1y: 0.68,
  c2x: 0.4,
  c2y: 0.08,
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
// drei's useGLTF accepts a `useDraco` argument: pass `true` to wire up its
// built-in DRACOLoader (CDN-hosted decoder) so the Draco-compressed GLB
// (position 12-bit / normal 8-bit quantization, ~25% smaller) decodes.

function ReliefDraft({ color, roughness, lut }: StoneProps) {
  const { scene } = useGLTF(RELIEF_DRAFT_URL, true);
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

useGLTF.preload(RELIEF_DRAFT_URL, true);

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
  const slow = (smoothNoise(t * 1.9, 11.3) - 0.5) * 0.4;
  const fast = (smoothNoise(t * 7.0, 41.7) - 0.5) * 0.18;
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
const DEFAULT_LIGHT_INTENSITY = 0.85;
const DEFAULT_LIGHT_RADIUS_FRAC = 0.5;
// Lock the torch to a lower band of the relief and let only horizontal cursor
// motion move it. Y is in world units (visible vertical half-extent at z=0
// is ~2.5 with CAMERA_Z=8, fov=35, so -1.5 sits about 60% down from center).
const LIGHT_LOCK_Y = -1.5;
// Torch height above the relief plane. Lower = more grazing = stronger
// self-shadows on relief bumps via Lambert (N·L approaches 0 for normals
// not facing the light). 0.7 was perpendicular and washed out detail; 0.25
// puts the light just above the deepest peaks for raking light.
const DEFAULT_LIGHT_HEIGHT = 0.34;

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
  height: number;
  // Subtle warm uplight from a thin bar along the bottom of the relief plane.
  // Grazing angle picks up surface bumps, adding contrast/shadow detail.
  bottomBar: boolean;
  // Bar intensity when the cursor is OUT of the window (torch dark) — bar
  // brightens to keep the relief readable.
  bottomBarOut: number;
  // Bar intensity when the cursor is IN the window (torch lit) — bar dims
  // since the torch is carrying primary lighting.
  bottomBarIn: number;
  // Custom thin-cross mouse pointer (replaces the system cursor everywhere).
  crosshair: boolean;
  // Debug: drop mix-blend-mode on the top bar and modulate text grayscale
  // white→black as the torch approaches (older "approach turns black" feel).
  headerClassic: boolean;
};

// Single warm color shared by every light in the scene (torch + uplight bar).
const TORCH_COLOR = "#ffb072";

// Footlight bar params. Width matches the relief width; height (depth) is
// thin so it reads as a strip. Position sits just below the visible bottom
// edge and slightly in front of the relief plane so light grazes upward.
const BOTTOM_BAR_WIDTH = 7;
const BOTTOM_BAR_HEIGHT = 0.4;
const BOTTOM_BAR_POS: [number, number, number] = [0, -2.4, 0.5];

// Linear time-based presence ramp (seconds). Fade-out is the user-tuned
// 2-second handoff from torch → bar; fade-in stays snappy so re-entering
// the window doesn't feel laggy.
const PRESENCE_FADE_OUT_SEC = 2.0;
const PRESENCE_FADE_IN_SEC = 0.4;

// Step `current` linearly toward `target` by at most `dt / duration`.
function rampTo(current: number, target: number, dt: number, duration: number) {
  const step = dt / duration;
  if (target > current) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

function BottomBarLight({
  outIntensity,
  inIntensity,
}: {
  outIntensity: number;
  inIntensity: number;
}) {
  const lightRef = useRef<THREE.RectAreaLight>(null);
  const intro = useIntroProgress();
  const present = useMousePresence();
  const presence = useRef(INITIAL_PRESENT ? 1 : 0);

  // Same intro / flicker envelope as the torch. Inverse-presence: the bar
  // brightens when the torch fades out, so the relief never goes fully
  // dark when the cursor leaves.
  //
  // mouse out (presence=0) → bar = outIntensity (baseline, brighter)
  // mouse in  (presence=1) → bar = inIntensity (dimmer; torch carries the scene)
  useFrame((state, delta) => {
    if (!lightRef.current) return;
    const t = state.clock.elapsedTime;
    // Bar's target stays "in" (1) until the torch has fully faded out.
    // Then it ramps to "out" (0) over the bar's own duration. On entry,
    // both bar and torch ramp simultaneously fast.
    const torchOut = lightProbe.torchPresence < 0.001;
    const presenceTarget = present.current ? 1 : torchOut ? 0 : 1;
    const dur =
      presenceTarget > presence.current
        ? PRESENCE_FADE_IN_SEC
        : PRESENCE_FADE_OUT_SEC;
    presence.current = rampTo(presence.current, presenceTarget, delta, dur);
    const base =
      outIntensity + (inIntensity - outIntensity) * presence.current;
    const introT = intro(t);
    const flicker = 1 + flameFlicker(t);
    lightRef.current.intensity = base * introT * flicker;
  });

  // Rotate +90° around X so the rect's emission axis (local -Z) points to
  // world +Y (upward), illuminating the relief above it.
  return (
    <rectAreaLight
      ref={lightRef}
      position={BOTTOM_BAR_POS}
      rotation={[Math.PI / 2, 0, 0]}
      width={BOTTOM_BAR_WIDTH}
      height={BOTTOM_BAR_HEIGHT}
      intensity={0}
      color={TORCH_COLOR}
    />
  );
}

function MouseLight({ controls }: { controls: LightControls }) {
  const { intensity, radiusFrac, lockY, height } = controls;
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
  const presence = useRef(INITIAL_PRESENT ? 1 : 0);

  useFrame((state, delta) => {
    // r3f's state.pointer reflects mouse pointer events AND touch events
    // (touch devices fire pointermove during finger drag), so the same
    // NDC source feeds both desktop hover and mobile drag.
    raycaster.setFromCamera(state.pointer, state.camera);
    const t = state.clock.elapsedTime;
    const wx = flameOffset(t, 7.3) * 0.025;
    const wy = flameOffset(t, 19.1) * 0.025;
    const wz = flameOffset(t, 31.7) * 0.09;

    // Raycast against the actual scene mesh so the light hugs the relief
    // surface — never sinks into bumps when `height` is small. Falls back
    // to the z=0 plane if the cursor isn't over any mesh.
    const intersects = raycaster.intersectObjects(
      state.scene.children,
      true,
    );
    let hx = 0;
    let hy = 0;
    let surfaceZ = 0;
    let gotHit = false;
    for (const inter of intersects) {
      if ((inter.object as THREE.Mesh).isMesh) {
        hx = inter.point.x;
        hy = inter.point.y;
        surfaceZ = inter.point.z;
        gotHit = true;
        break;
      }
    }
    if (!gotHit && raycaster.ray.intersectPlane(plane, hit)) {
      hx = hit.x;
      hy = hit.y;
      surfaceZ = 0;
    }

    const baseY = lockY ? LIGHT_LOCK_Y : hy;
    target.current.set(hx + wx, baseY + wy, surfaceZ + height + wz);
    if (lightRef.current) {
      // Constant smooth lerp — no snap on jump. Re-entering the window from
      // a different edge looks like the light gliding to its new position.
      lightRef.current.position.lerp(target.current, 0.18);
    }
    if (lightRef.current) {
      // Linear time-based presence ramp: snappy fade-in on entry, exact
      // 2-second fade-out when the cursor leaves so the torch hands off
      // smoothly to the brightening footlight bar. On touch, present is
      // true while a finger is down → same ramp gives "lift to dim".
      const presenceTarget = present.current ? 1 : 0;
      const dur =
        presenceTarget > presence.current
          ? PRESENCE_FADE_IN_SEC
          : PRESENCE_FADE_OUT_SEC;
      presence.current = rampTo(presence.current, presenceTarget, delta, dur);
      // Publish for BottomBarLight — it stages its rise on this reaching 0.
      lightProbe.torchPresence = presence.current;

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
      color={TORCH_COLOR}
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
    target.current.set(x * 0.1, y * 0.07, CAMERA_Z);
    camera.position.lerp(target.current, 0.06);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// --- Dust motes ---------------------------------------------------------
//
// Lightweight Points system: ~250 particles drifting in a thin volume in
// front of the relief, drawn as small additive-blended soft circles via a
// runtime-generated radial-gradient texture. ~250 sprites @ 6 floats each is
// ~6KB total, one draw call per frame.

const DUST_COUNT = 250;
const DUST_VOLUME = { x: 8, y: 5, zMin: 0.4, zMax: 2.6 };

function makeDustTexture() {
  const size = 32;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// All particle motion runs in the vertex shader. Per-frame CPU cost is a
// single uTime uniform write — the GPU does the per-particle drift, sway,
// and volume-wrap math in parallel.
const DUST_VERTEX = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uPxScale;
  uniform vec3 uVolMin;
  uniform vec3 uVolSize;
  void main() {
    // Cheap per-particle velocity derived from the seed — saves an attribute.
    float vx = (fract(aSeed * 12.9898) - 0.5) * 0.0006;
    float vy = (fract(aSeed * 78.2330) - 0.5) * 0.0003 + 0.0002;
    float vz = (fract(aSeed * 39.3460) - 0.5) * 0.0002;
    vec3 vel = vec3(vx, vy, vz);
    // Slow sinusoidal sway around the drift path so motion looks organic.
    vec3 sway = vec3(
      sin(uTime * 0.4 + aSeed * 6.2832) * 0.05,
      0.0,
      cos(uTime * 0.3 + aSeed * 6.2832) * 0.05
    );
    vec3 pos = position + vel * uTime + sway;
    // Wrap into the dust volume so density stays constant.
    vec3 wrapped = mod(pos - uVolMin, uVolSize) + uVolMin;
    vec4 mvPosition = modelViewMatrix * vec4(wrapped, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * (uPxScale / -mvPosition.z);
  }
`;

const DUST_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    if (tex.a < 0.01) discard;
    gl_FragColor = vec4(uColor, tex.a * uOpacity);
  }
`;

function DustMotes() {
  const dustTex = useMemo(makeDustTexture, []);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, seeds } = useMemo(() => {
    const p = new Float32Array(DUST_COUNT * 3);
    const s = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) {
      p[i * 3] = (Math.random() - 0.5) * DUST_VOLUME.x;
      p[i * 3 + 1] = (Math.random() - 0.5) * DUST_VOLUME.y;
      p[i * 3 + 2] =
        DUST_VOLUME.zMin +
        Math.random() * (DUST_VOLUME.zMax - DUST_VOLUME.zMin);
      s[i] = Math.random();
    }
    return { positions: p, seeds: s };
  }, []);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return g;
  }, [positions, seeds]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMap: { value: dustTex },
      uColor: { value: new THREE.Color("#888888") },
      uOpacity: { value: 0.45 },
      uSize: { value: 0.022 },
      uPxScale: { value: 1.0 },
      uVolMin: {
        value: new THREE.Vector3(
          -DUST_VOLUME.x / 2,
          -DUST_VOLUME.y / 2,
          DUST_VOLUME.zMin,
        ),
      },
      uVolSize: {
        value: new THREE.Vector3(
          DUST_VOLUME.x,
          DUST_VOLUME.y,
          DUST_VOLUME.zMax - DUST_VOLUME.zMin,
        ),
      },
    }),
    [dustTex],
  );

  useFrame((state) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    // Mirror the standard PointsMaterial sizeAttenuation factor so the
    // visual size matches what we had before.
    m.uniforms.uPxScale.value = state.size.height * 0.5;
  });

  return (
    <points geometry={geom} renderOrder={1}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={DUST_VERTEX}
        fragmentShader={DUST_FRAGMENT}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

interface HeroProps {
  dpr: number;
}

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
  stone,
  onStoneChange,
  onResetLight,
}: {
  controls: LightControls;
  onControlsChange: (c: LightControls) => void;
  shape: LightShape;
  onShapeChange: (s: LightShape) => void;
  stone: StonePreset;
  onStoneChange: (s: StonePreset) => void;
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
      <Slider
        label="height (lower = grazing)"
        min={0.05}
        max={1.5}
        step={0.01}
        value={controls.height}
        onChange={(v) => onControlsChange({ ...controls, height: v })}
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
        <>
          <Slider
            label="bar intensity (mouse out)"
            min={0}
            max={4}
            step={0.05}
            value={controls.bottomBarOut}
            onChange={(v) =>
              onControlsChange({ ...controls, bottomBarOut: v })
            }
          />
          <Slider
            label="bar intensity (mouse in)"
            min={0}
            max={4}
            step={0.05}
            value={controls.bottomBarIn}
            onChange={(v) =>
              onControlsChange({ ...controls, bottomBarIn: v })
            }
          />
        </>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={controls.crosshair}
          onChange={(e) =>
            onControlsChange({ ...controls, crosshair: e.target.checked })
          }
          style={{ accentColor: "#c9a36a" }}
        />
        thin-cross cursor
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={controls.headerClassic}
          onChange={(e) =>
            onControlsChange({ ...controls, headerClassic: e.target.checked })
          }
          style={{ accentColor: "#c9a36a" }}
        />
        header classic (approach → black)
      </label>

      {/* Stone material — color picker, roughness slider, preset shortcuts. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          paddingTop: 6,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span style={{ opacity: 0.5, letterSpacing: 0.18 }}>STONE</span>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ opacity: 0.7 }}>color</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                opacity: 0.6,
                fontSize: 9,
              }}
            >
              {stone.color.toUpperCase()}
            </span>
            <input
              type="color"
              value={stone.color}
              onChange={(e) =>
                onStoneChange({ ...stone, name: "Custom", color: e.target.value })
              }
              style={{
                width: 28,
                height: 18,
                padding: 0,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                cursor: "pointer",
              }}
            />
          </span>
        </label>
        <Slider
          label="roughness"
          min={0}
          max={1}
          step={0.01}
          value={stone.roughness}
          onChange={(v) => onStoneChange({ ...stone, roughness: v })}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 4,
            marginTop: 2,
          }}
        >
          {STONE_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => onStoneChange(p)}
              title={`${p.name} · ${p.color}`}
              aria-label={p.name}
              style={{
                height: 18,
                background: p.color,
                border:
                  stone.color.toLowerCase() === p.color.toLowerCase()
                    ? "1.5px solid #fff"
                    : "1px solid rgba(255,255,255,0.15)",
                borderRadius: 2,
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>
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
  height: DEFAULT_LIGHT_HEIGHT,
  bottomBar: true,
  bottomBarOut: 0.6,
  bottomBarIn: 0.2,
  crosshair: false,
  headerClassic: false,
};

export default function Hero({ dpr }: HeroProps) {
  const [debugOpen] = useKeyToggle("d", false);
  const [lightShape, setLightShape] =
    useState<LightShape>(DEFAULT_LIGHT_SHAPE);
  const [lightControls, setLightControls] = useState<LightControls>(
    DEFAULT_LIGHT_CONTROLS,
  );
  // Live mesh material — color + roughness tweakable from the debug menu.
  const [stone, setStone] = useState<StonePreset>(STONE_PRESETS[0]);
  const lut = useFalloffLUT(lightShape);

  // Pause the WebGL render loop when the hero is offscreen (footer snapped
  // in, page hidden, etc). Saves the per-frame cost of the relief render +
  // EffectComposer passes when the user can't see the canvas.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const root = document.querySelector(".page");
    // Pre-warm: rootMargin "100%" expands the root bounds by one full
    // viewport on top + bottom, so hero is treated as "intersecting" while
    // it's still one section away. Canvas wakes before the user can see
    // hero, so by the snap arrival the render loop is already fluid — no
    // first-frame catch-up flicker.
    //
    // Past the projects section (which can be multiple viewports tall),
    // the hero IO would otherwise *still* report intersecting because the
    // pre-warm bounds reach far up. Combine with a second IO on the
    // prefinal section: once prefinal is in view, force-pause the canvas
    // regardless of hero IO state. Resumes when the user scrolls back up
    // and prefinal leaves the viewport.
    const prefinalSection = document.querySelector(
      ".page__section--prefinal",
    );

    let heroNear = true;
    let prefinalOrPastVisible = false;
    const update = () => setActive(heroNear && !prefinalOrPastVisible);

    const heroIO = new IntersectionObserver(
      ([entry]) => {
        heroNear = entry.isIntersecting;
        update();
      },
      { threshold: 0, rootMargin: "100% 0px", root },
    );
    heroIO.observe(node);

    let prefinalIO: IntersectionObserver | null = null;
    if (prefinalSection) {
      prefinalIO = new IntersectionObserver(
        ([entry]) => {
          prefinalOrPastVisible = entry.isIntersecting;
          update();
        },
        { threshold: 0, root },
      );
      prefinalIO.observe(prefinalSection);
    }

    const onVisibility = () => {
      if (document.hidden) setActive(false);
      else update();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      heroIO.disconnect();
      prefinalIO?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Apply / remove the thin-cross cursor body class.
  useEffect(() => {
    const cls = "crosshair-cursor";
    if (lightControls.crosshair) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => document.body.classList.remove(cls);
  }, [lightControls.crosshair]);

  // Classic header mode: drop mix-blend-mode and let useTopBarColor write
  // grayscale text. Body class drives CSS; lightProbe flag drives the hook.
  useEffect(() => {
    const cls = "topbar-classic";
    lightProbe.headerClassic = lightControls.headerClassic;
    if (lightControls.headerClassic) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => {
      lightProbe.headerClassic = false;
      document.body.classList.remove(cls);
    };
  }, [lightControls.headerClassic]);

  return (
    <div ref={wrapperRef} className="hero">
      <Canvas
        camera={{ position: [0, 0, CAMERA_Z], fov: 35 }}
        dpr={dpr}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        frameloop={active ? "always" : "never"}
      >
        <color attach="background" args={["#0a0a0a"]} />
        <ambientLight intensity={0} />
        <MouseLight controls={lightControls} />
        {lightControls.bottomBar && (
          <BottomBarLight
            outIntensity={lightControls.bottomBarOut}
            inIntensity={lightControls.bottomBarIn}
          />
        )}
        <CameraRig />
        <Backdrop
          color={stone.color}
          roughness={stone.roughness}
          lut={lut}
        />
        <Suspense fallback={null}>
          <HeroMesh
            color={stone.color}
            roughness={stone.roughness}
            lut={lut}
          />
        </Suspense>
        <DustMotes />
        <EffectComposer>
          <Noise opacity={0.28} blendFunction={BlendFunction.OVERLAY} />
        </EffectComposer>
      </Canvas>
      {debugOpen && (
        <DebugMenu
          controls={lightControls}
          onControlsChange={setLightControls}
          shape={lightShape}
          onShapeChange={setLightShape}
          stone={stone}
          onStoneChange={setStone}
          onResetLight={() => {
            setLightControls(DEFAULT_LIGHT_CONTROLS);
            setLightShape(DEFAULT_LIGHT_SHAPE);
            setStone(STONE_PRESETS[0]);
          }}
        />
      )}
    </div>
  );
}
