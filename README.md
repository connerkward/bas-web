# bas-web

R3F (React Three Fiber) hero scene with a torchlight-lit stone relief, plus a debug panel for swapping stone materials.

## Hero scene (`src/components/Hero.tsx`)

A single `<Canvas>` renders a stone-relief panel under a cursor-tracked point light. Designed to read as "ancient temple relief seen by torchlight."

### Mesh variants

`VARIANT` constant at the top of `Hero.tsx` selects the relief geometry:

- `"relief-draft"` — `public/meshes/relief-draft.glb`, converted from an STL (see [Converting an STL relief](#converting-an-stl-relief))
- `"procedural"` — runtime `PlaneGeometry` deformed by `relief()` (medallion + ring + boss + stone grain)

Both variants share the same material (driven by the active `STONE_PRESETS` entry) and lighting rig.

### Stone presets

`STONE_PRESETS` is a curated list of `{ name, color, roughness }` aimed at temple-ruin material vibes (Sandstone Gold, Rust Ochre, Limestone Pale, Travertine, Red Sandstone, Ochre Adobe, Granite Dark, Slate Blue-Grey, Mossy Stone, Soot Charcoal, Basalt Black). The active preset is set by `ACTIVE_STONE = STONE_PRESETS[0]` near the bottom of the file — change the index to swap. Color + roughness propagate to the relief mesh **and** the backdrop plane.

### Lighting

- `<MouseLight>` — warm point light (`#fff1d4`) raycast onto the relief plane to track the cursor.
  - **Flame flicker:** intensity modulated by two-octave smooth noise (`flameFlicker`), and the target position layers tiny XY/Z wander (`flameOffset`) so cast shadows on the relief shift like a candle.
  - **Viewport-relative cutoff:** `light.distance` recomputes each frame as `LIGHT_RADIUS_FRAC * viewport_diagonal_at_z=0` so the lit screen-area stays roughly constant on resize / different aspect ratios.
  - **Presence fade:** intensity scales with `presence` (cursor-on-page tracker) — fast ramp up when the cursor enters, slow fade out when it leaves so the room "settles into the dark" rather than blinking off.
  - **Intro:** ease-out-cubic ramp from 0 → `BASE_LIGHT_INTENSITY` over `INTRO_DURATION` seconds on first frame.
- `<ambientLight intensity={0}>` — full crushed blacks for max contrast against the torch pool.
- ACES filmic tone mapping on the renderer for highlight rolloff (set on the WebGL context, not via postprocessing).

### Postprocessing

`<EffectComposer>` runs a single `<Noise>` pass (`opacity={0.2}`, `BlendFunction.OVERLAY`) for film grain.

### Camera

`CAMERA_Z = 7`, `fov = 35`. `<CameraRig>` adds gentle XY parallax tied to the cursor (no Z dolly). At 16:9 the relief (~8w × 5.2h after STL normalization) fully covers the viewport; the `<Backdrop>` 40×40 sandstone plane at `z=-0.5` catches gaps on ultrawide displays and during parallax sway.

## Converting an STL relief

Source STLs live in `~/ideas-syncthing/proj-bas/`. The conversion script `/tmp/stl-convert/convert.py` is a Blender Python script that:

1. Imports the STL (Blender 4.1+ / 5.x: `bpy.ops.wm.stl_import`).
2. Merges coincident verts (`remove_doubles`) — STL files duplicate verts per face.
3. Decimates to **120k faces** (target tunable in the script).
4. Detects the depth axis (smallest extent) and rotates so the relief side faces +Z (toward camera). Direction picked by analyzing centroid offset along the depth axis (relief side has less mass than the flat back).
5. Centers, normalizes scale so the largest in-plane dim = 8 (matches the procedural plane).
6. Smooth shading + consistent normals.
7. Exports as Draco-compressed GLB (`level=6`, no materials).

**Run:**
```bash
blender --background --python /tmp/stl-convert/convert.py -- "<input.stl>" "/Users/conner/dev/bas-web/public/meshes/<name>.glb"
```

A 155 MB / 3.1M-tri STL became a **296 KB GLB** at 120k tris.

To add a new mesh option, place the GLB in `public/meshes/` and add a corresponding branch in `<HeroMesh>` keyed off `VARIANT`.

In `<ReliefDraft>` the GLB is loaded via `useGLTF`, the first mesh's geometry is extracted, recentered against its bounding box at runtime, and rendered with `side={THREE.DoubleSide}` (safety against winding flips from the Blender rotation pipeline). The mesh node has `rotation={[Math.PI / 2, 0, 0]}` to bring the relief face toward camera — this depends on how the Blender script oriented the source; if a new STL comes out edge-on, adjust this rotation.

## Tooling notes

- Postprocessing deps: `@react-three/postprocessing` + `postprocessing` (already installed).
- Type-check: `npx tsc -b --noEmit`.
- Dev server: `npm run dev` (Vite).

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
