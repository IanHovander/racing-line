// three.js render layer (experimental). Turned on from Settings → Display → Renderer, or ?three in
// the URL (see switch.ts, which loads this module on demand). It draws the same world as the canvas renderer, in WebGL, with the same
// framing: the camera matrix below is the canvas projection P(x, y, z) from render/camera.ts written
// as one affine matrix, so the HUD, the minimap and every screen-space layout stay where they are.
//
// World axes are the game's: x, y on the ground, z up, in metres.
import * as THREE from 'three';
import { GS } from '../state';
import { H, W, cv } from '../core/dom';
import { attract, cars, opts } from '../game/race';
import { cam } from '../render/camera';
import { BODY, COVER, FPLATE, FWING, PODS, RPLATE, RWING, WHEELS, rect } from '../render/car';
import { liveZone, profileFor } from '../sim/profile';
import { shade } from '../teams/teams';

let renderer: any = null,
  scene: any = null,
  camera: any = null,
  world: any = null,
  builtFor: any = null,
  lineGeo: any = null,
  lineCol: Float32Array | null = null;
const carObjs = new Map<any, any>();

let glCanvas: HTMLCanvasElement | null = null;
/** create the WebGL canvas (under the game canvas, which stays on top for the overlays) and the scene */
export function start(): void {
  if (renderer) return;
  const gl = document.createElement('canvas');
  gl.id = 'gl3';
  gl.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;';
  cv.parentNode.insertBefore(gl, cv);
  glCanvas = gl;
  renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  scene = new THREE.Scene();
  camera = new THREE.Camera();
  camera.matrixAutoUpdate = false;
  scene.add(new THREE.HemisphereLight(0xeef4ff, 0x4a5a3a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-0.5, -0.8, 1.4);
  scene.add(sun);
}

/** the canvas projection P() as a matrix: screen x/y from P, depth along the view direction */
function updateCamera3d() {
  const s = Math.sin(cam.a),
    c = Math.cos(cam.a),
    zm = cam.zoom,
    t = cam.tilt,
    hz = cam.hz,
    R = 4000;
  const cx = cam.x,
    cy = cam.y,
    cz = cam.z;
  const OX = GS.OX,
    OY = GS.OY;
  const m = camera.projectionMatrix;
  m.set(
    (-2 * zm * s) / W,
    (2 * zm * c) / W,
    0,
    (2 / W) * (OX + zm * (s * cx - c * cy)) - 1,
    (2 * zm * t * c) / H,
    (2 * zm * t * s) / H,
    (2 * zm * hz) / H,
    1 - (2 / H) * (OY + zm * (t * (c * cx + s * cy) + hz * cz)),
    (hz * c) / R,
    (hz * s) / R,
    -t / R,
    (-hz * (c * cx + s * cy) + t * cz) / R,
    0,
    0,
    0,
    1,
  );
  camera.projectionMatrixInverse.copy(m).invert();
}

export function show(on: boolean): void {
  if (glCanvas) glCanvas.style.display = on ? 'block' : 'none';
}

// ---------- track geometry ----------
const OVR = (o, i) => (typeof o === 'number' ? o : o.R ? o.R[i] : o[i]),
  OVL = (o, i) => (typeof o === 'number' ? o : o.L ? o.L[i] : o[i]);
const mat = (col, extra?) =>
  new THREE.MeshLambertMaterial({ color: new THREE.Color(col), side: THREE.DoubleSide, ...extra });

/** a band along the track between signed offsets a(i) .. b(i) (positive = right), lifted dz */
function band(
  a: (i: number) => number,
  b: (i: number) => number,
  dz: number,
  col,
  keep?: (i: number) => boolean,
) {
  const pos: number[] = [],
    idx: number[] = [];
  const N = GS.N;
  for (let i = 0; i < N; i++) {
    const A = a(i),
      B = b(i),
      z = GS.HT[i] + dz;
    pos.push(GS.cx[i] + GS.nx[i] * A, GS.cy[i] + GS.ny[i] * A, z);
    pos.push(GS.cx[i] + GS.nx[i] * B, GS.cy[i] + GS.ny[i] * B, z);
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    if (keep && !(keep(i) && keep(j))) continue;
    idx.push(2 * i, 2 * j, 2 * j + 1, 2 * i, 2 * j + 1, 2 * i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, typeof col === 'string' ? mat(col) : col);
}

function buildWorld() {
  if (world) {
    scene.remove(world);
    world.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => m.dispose());
    });
  }
  for (const o of carObjs.values()) scene.remove(o);
  carObjs.clear();
  world = new THREE.Group();
  scene.add(world);
  const TR = GS.TR,
    N = GS.N,
    HW = GS.HW;
  renderer.setClearColor(new THREE.Color(TR.bg));
  let hmin = 1e9;
  for (let i = 0; i < N; i++) hmin = Math.min(hmin, GS.HT[i]);
  // ground
  {
    const cx = (GS.minX + GS.maxX) / 2,
      cy = (GS.minY + GS.maxY) / 2,
      span = Math.max(GS.maxX - GS.minX, GS.maxY - GS.minY) + 1200;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(span, span), mat(TR.bg));
    g.position.set(cx, cy, hmin - 0.3);
    world.add(g);
  }
  // water
  for (const poly of GS.WATER || []) {
    const sh = new THREE.Shape(poly.map(q => new THREE.Vector2(q[0], q[1])));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat('#1f6f9a'));
    m.position.z = hmin - 0.25;
    world.add(m);
  }
  // run-off, its sides down to the ground, gravel, paint, white lines, asphalt, kerbs
  world.add(
    band(
      i => OVR(GS.SIDES, i),
      i => -OVL(GS.SIDES, i),
      0,
      TR.run,
    ),
  );
  for (const sg of [1, -1]) {
    const A = sg > 0 ? GS.BARR : GS.BARL;
    const pos: number[] = [],
      idx: number[] = [];
    for (let i = 0; i < N; i++) {
      const o = sg * A[i];
      pos.push(GS.cx[i] + GS.nx[i] * o, GS.cy[i] + GS.ny[i] * o, GS.HT[i]);
      pos.push(GS.cx[i] + GS.nx[i] * o, GS.cy[i] + GS.ny[i] * o, hmin - 0.3);
    }
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      idx.push(2 * i, 2 * j, 2 * j + 1, 2 * i, 2 * j + 1, 2 * i + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    world.add(new THREE.Mesh(g, mat(shade(TR.run, 0.7))));
  }
  for (const sg of [1, -1]) {
    world.add(
      band(
        i => sg * (GS.GINA[i] || 0),
        i => sg * (GS.gout[i] || 0),
        0.01,
        '#cbb68a',
        i => GS.gside[i] === sg,
      ),
    );
  }
  if (TR.paint) {
    for (const sg of [1, -1]) {
      const Wd = sg > 0 ? GS.PWR : GS.PWL;
      TR.paint.forEach((col, b) => {
        const sw = 1.6;
        world.add(
          band(
            i => sg * (HW + 1 + Math.min(b * sw, Wd[i])),
            i => sg * (HW + 1 + Math.min((b + 1) * sw, Wd[i])),
            0.015,
            col,
            i => Wd[i] > 0.05 && Wd[i] > b * sw,
          ),
        );
      });
    }
  }
  world.add(
    band(
      () => HW + 0.45,
      () => -(HW + 0.45),
      0.02,
      '#ececec',
    ),
  );
  world.add(
    band(
      () => HW,
      () => -HW,
      0.03,
      opts.rain ? '#35373c' : '#46484e',
    ),
  );
  world.add(
    band(
      i => GS.off[i] + 1.1,
      i => GS.off[i] - 1.1,
      0.035,
      mat('#000', { transparent: true, opacity: 0.16, depthWrite: false }),
    ),
  );
  for (const sg of [1, -1]) {
    for (const red of [true, false])
      world.add(
        band(
          () => sg * (HW - 0.5),
          () => sg * (HW + 1.4),
          0.04,
          red ? '#d42a2a' : '#f4f4f4',
          i => GS.kerb[i] && (Math.floor(i / 2) % 2 === 1) === red,
        ),
      );
  }
  // start line chequers
  {
    const i = 0;
    for (let r = 0; r < 2; r++)
      for (let q = 0; q < 10; q++) {
        const o1 = -HW + q * 1.4,
          a = r * 1.2;
        const g = new THREE.PlaneGeometry(1.4, 1.2);
        const m = new THREE.Mesh(g, mat((q + r) % 2 ? '#111' : '#fff'));
        const o = o1 + 0.7,
          s = a + 0.6;
        m.position.set(
          GS.cx[i] + GS.nx[i] * o + GS.tx[i] * s,
          GS.cy[i] + GS.ny[i] * o + GS.ty[i] * s,
          GS.HT[i] + 0.045,
        );
        m.rotation.z = Math.atan2(GS.ty[i], GS.tx[i]) + Math.PI / 2;
        world.add(m);
      }
  }
  // racing line: one ribbon whose vertex colours are set every frame (dashed: every other 2 m sample)
  {
    const pos: number[] = [],
      idx: number[] = [];
    for (let i = 0; i < N; i++) {
      const z = GS.HT[i] + 0.05;
      for (const o of [0.15, -0.15]) {
        const v = GS.off[i] + o;
        pos.push(GS.cx[i] + GS.nx[i] * v, GS.cy[i] + GS.ny[i] * v, z);
      }
    }
    for (let i = 0; i < N; i += 2) {
      const j = (i + 1) % N;
      idx.push(2 * i, 2 * j, 2 * j + 1, 2 * i, 2 * j + 1, 2 * i + 1);
    }
    lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    lineCol = new Float32Array(N * 2 * 4);
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 4));
    lineGeo.setIndex(idx);
    const m = new THREE.Mesh(
      lineGeo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    m.frustumCulled = false;
    world.add(m);
  }
  // barriers: track-side face, top and outer face
  {
    const st = !!TR.street,
      WH = st ? 1.1 : 1.0,
      TH = st ? 0.35 : 0.7;
    for (const sg of [1, -1]) {
      const A = sg > 0 ? GS.BARR : GS.BARL;
      const face = (o0, o1, z0, z1, col) => {
        const pos: number[] = [],
          idx: number[] = [];
        for (let i = 0; i < N; i++) {
          const a = sg * (A[i] + o0),
            b = sg * (A[i] + o1);
          pos.push(GS.cx[i] + GS.nx[i] * a, GS.cy[i] + GS.ny[i] * a, GS.HT[i] + z0);
          pos.push(GS.cx[i] + GS.nx[i] * b, GS.cy[i] + GS.ny[i] * b, GS.HT[i] + z1);
        }
        for (let i = 0; i < N; i++) {
          const j = (i + 1) % N;
          idx.push(2 * i, 2 * j, 2 * j + 1, 2 * i, 2 * j + 1, 2 * i + 1);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        world.add(new THREE.Mesh(g, mat(col)));
      };
      face(0, 0, 0, WH, st ? '#b8bcc2' : '#a4a9b0');
      face(0, TH, WH, WH, st ? '#e9ebee' : '#d6d9dd');
      face(TH, TH, 0, WH, st ? '#9ea3a9' : '#878c93');
    }
  }
  // buildings
  for (const b of GS.boxes || []) {
    if (!b.pts || b.pts.length < 3) continue;
    const sh = new THREE.Shape(b.pts.map(p => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(sh, { depth: b.h, bevelEnabled: false });
    const m = new THREE.Mesh(g, [mat(b.top), mat(b.side)]);
    m.position.z = b.hz || 0;
    world.add(m);
  }
  // trees: instanced pines (stacked cones) and round trees
  {
    const T = GS.trees || [];
    const pines = T.filter(t => t.pine),
      rounds = T.filter(t => !t.pine);
    const dummy = new THREE.Object3D();
    const cone = new THREE.ConeGeometry(1, 1, 8);
    cone.rotateX(Math.PI / 2);
    const cols = ['#1f4d2c', '#245533', '#2a5e36'];
    for (let k = 0; k < 3 && pines.length; k++) {
      const im = new THREE.InstancedMesh(cone, mat(cols[k]), pines.length);
      pines.forEach((t, n) => {
        const w = t.r * (1.15 - k * 0.28),
          z0 = t.h * (0.18 + k * 0.24),
          z1 = t.h * (0.55 + k * 0.22);
        dummy.position.set(t.x, t.y, (t.hz || 0) + (z0 + z1) / 2);
        dummy.scale.set(w, w, z1 - z0);
        dummy.updateMatrix();
        im.setMatrixAt(n, dummy.matrix);
      });
      world.add(im);
    }
    if (rounds.length) {
      const sp = new THREE.IcosahedronGeometry(1, 1);
      const im = new THREE.InstancedMesh(sp, mat(TR.tree || '#2f6b34'), rounds.length);
      rounds.forEach((t, n) => {
        dummy.position.set(t.x, t.y, (t.hz || 0) + t.h * 0.6);
        dummy.scale.set(t.r, t.r, t.r * 0.9);
        dummy.updateMatrix();
        im.setMatrixAt(n, dummy.matrix);
      });
      world.add(im);
      const trunk = new THREE.CylinderGeometry(0.18, 0.25, 1, 6);
      trunk.rotateX(Math.PI / 2);
      const tm = new THREE.InstancedMesh(trunk, mat('#4a3420'), rounds.length);
      rounds.forEach((t, n) => {
        dummy.position.set(t.x, t.y, (t.hz || 0) + t.h * 0.25);
        dummy.scale.set(1, 1, t.h * 0.5);
        dummy.updateMatrix();
        tm.setMatrixAt(n, dummy.matrix);
      });
      world.add(tm);
    }
  }
}

// ---------- cars ----------
/** a polygon in car coordinates extruded from z0 to z1 */
function slab(poly, z0, z1, col) {
  const sh = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false });
  const m = new THREE.Mesh(g, mat(col));
  m.position.z = z0;
  return m;
}
function makeCar(c) {
  const g = new THREE.Group();
  g.add(slab(rect(1.2, -1.95, -0.12, 0.12), 0.18, 0.3, '#222'));
  g.add(slab(PODS, 0.1, 0.38, shade(c.col, 0.92)));
  g.add(slab(BODY, 0.12, 0.46, c.col));
  g.add(slab(COVER, 0.46, 0.78, shade(c.col, 1.12)));
  g.add(slab(FWING, 0.05, 0.18, shade(c.col, 0.85)));
  for (const fp of FPLATE) g.add(slab(fp, 0.05, 0.3, shade(c.acc, 0.9)));
  g.add(slab(rect(-2.5, -2.3, -0.06, 0.06), 0.4, 0.95, '#222'));
  g.add(slab(RWING, 0.9, 1.08, c.acc));
  for (const rp of RPLATE) g.add(slab(rp, 0.55, 1.12, shade(c.col, 0.8)));
  const tyre = mat('#1a1a1a');
  WHEELS.forEach((w, k) => {
    const r = k < 2 ? 0.31 : 0.34,
      hw = k < 2 ? 0.17 : 0.21;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hw * 2, 16), tyre);
    cyl.position.set(w[0], w[1] + Math.sign(w[1]) * hw, r);
    g.add(cyl);
  });
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8), mat(c.acc));
  helmet.position.set(-0.05, 0, 0.85);
  g.add(helmet);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 2.3),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  shadow.position.set(0.1, 0.35, 0.02);
  g.add(shadow);
  return g;
}

function updateLine() {
  if (!lineCol || !lineGeo) return;
  const visible = opts.line && !attract && cars[GS.ctrl];
  if (!visible) {
    lineCol.fill(0);
    lineGeo.attributes.color.needsUpdate = true;
    return;
  }
  if (GS.PZONE.team !== cars[GS.ctrl].team) {
    GS.PZONE = new Uint8Array(GS.N);
    GS.PZONE.team = cars[GS.ctrl].team;
    profileFor(cars[GS.ctrl].st, GS.PZONE);
  }
  const ZN = liveZone(cars[GS.ctrl], GS.PZONE.length === GS.N ? GS.PZONE : GS.zone);
  const C = [
    [0.47, 1, 0.47, 0.55],
    [1, 0.27, 0.24, 0.75],
    [1, 0.84, 0.04, 0.65],
  ];
  for (let i = 0; i < GS.N; i++) {
    const q = C[ZN[i]] || C[0];
    for (let k = 0; k < 2; k++) lineCol.set(q, (i * 2 + k) * 4);
  }
  lineGeo.attributes.color.needsUpdate = true;
}

/** draw one frame; returns false when the layer is off */
export function render3d(): boolean {
  if (!renderer) return false;
  const key = GS.TR && GS.TR.id + ':' + GS.N + ':' + GS.seed;
  if (builtFor !== key) {
    builtFor = key;
    buildWorld();
  }
  const sz = renderer.getSize(new THREE.Vector2());
  if (sz.x !== W || sz.y !== H) renderer.setSize(W, H, false);
  // cars
  const live = new Set();
  for (const c of cars) {
    if (c.gone) continue;
    live.add(c);
    let o = carObjs.get(c);
    if (!o) {
      o = makeCar(c);
      carObjs.set(c, o);
      scene.add(o);
    }
    o.position.set(c.x, c.y, c.hz || 0);
    o.rotation.z = c.h;
  }
  for (const [c, o] of carObjs)
    if (!live.has(c)) {
      scene.remove(o);
      carObjs.delete(c);
    }
  updateLine();
  updateCamera3d();
  renderer.render(scene, camera);
  return true;
}
