import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYERS, PLACES, NOTE, CALLOUTS } from './content.js';

// ---------- params / embed ----------
const qs = new URLSearchParams(location.search);
const EMBED = qs.get('embed') === '1';
const SHOW_PANEL = qs.get('panel') !== '0';
const LOCK_LAYER = qs.get('lock') === '1';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 760px)').matches;
document.documentElement.classList.toggle('embed', EMBED);
document.documentElement.classList.toggle('no-panel', !SHOW_PANEL);

// Model coords (feet): x, y on plane, z up  ->  three: (x, z, -y)
const W = (x, y, z = 0) => new THREE.Vector3(x, z, -y);
const D2R = Math.PI / 180;

// ---------- DOM ----------
const viewer = document.getElementById('viewer');
const panel = document.getElementById('panel');
const tabs = document.getElementById('tabs');
const btnUnder = document.getElementById('btn-under');
const btnRoof = document.getElementById('btn-roof');
const btnReset = document.getElementById('btn-reset');
const loading = document.getElementById('loading');

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = !MOBILE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewer.appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
viewer.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const SKY = new THREE.Color('#ECEDE6');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 4200, 9000);

const camera = new THREE.PerspectiveCamera(35, 1, 2, 30000);
const controls = new OrbitControls(camera, labelRenderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 40;
controls.maxDistance = 5200;
controls.screenSpacePanning = false;

scene.add(new THREE.HemisphereLight('#fdfbf3', '#7d7458', 1.1));
const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
sun.position.set(-700, 1500, 900);
sun.target.position.set(450, 0, 200);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 100, far: 4500 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

// ---------- groups ----------
const groups = {
  ground: new THREE.Group(), site: new THREE.Group(), building: new THREE.Group(),
  overview: new THREE.Group(), energy: new THREE.Group(), water: new THREE.Group(), carbon: new THREE.Group()
};
Object.values(groups).forEach(g => scene.add(g));
const animators = [];
const m4 = new THREE.Matrix4();
const centroid = pts => { let x = 0, y = 0; pts.forEach(p => { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; };
function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; } return Math.abs(s / 2); }
function inPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; }
const shapeFrom = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; };
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? .7, metalness: o.m ?? 0, emissive: o.e ? color : '#000', emissiveIntensity: o.e ?? 0, transparent: o.op != null, opacity: o.op ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.dw ?? true });

// ---------- data ----------
const [site, sys, terBuf, roofBuf, footprints, beams] = await Promise.all([
  fetch('assets/data/site.json').then(r => r.json()),
  fetch('assets/data/systems.json').then(r => r.json()),
  fetch('assets/data/terrain.bin').then(r => r.arrayBuffer()),
  fetch('assets/data/roof.bin').then(r => r.arrayBuffer()),
  fetch('assets/data/footprints.json').then(r => r.json()),
  fetch('assets/data/beams.json').then(r => r.json())
]);
const TER = sys.terrain, TH = new Int16Array(terBuf);
const RF = sys.roof, RH = new Int16Array(roofBuf);
const X0 = TER.x0, Y0 = TER.y0, X1 = TER.x0 + TER.cell * (TER.nx - 1), Y1 = TER.y0 + TER.cell * (TER.ny - 1);
const BASE = -380;
function hAt(x, y) {
  const fx = Math.min(Math.max((x - X0) / TER.cell, 0), TER.nx - 1.001), fy = Math.min(Math.max((y - Y0) / TER.cell, 0), TER.ny - 1.001);
  const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, n = TER.nx;
  const a = TH[j * n + i], b = TH[j * n + i + 1], c = TH[(j + 1) * n + i], d = TH[(j + 1) * n + i + 1];
  return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) * TER.scale;
}
function roofAt(x, y) { // roof top height (ft) or -99 outside building
  const i = Math.floor((x - RF.x0) / RF.cell), j = Math.floor((y - RF.y0) / RF.cell);
  if (i < 0 || j < 0 || i >= RF.nx || j >= RF.ny) return -99;
  const v = RH[j * RF.nx + i]; return v === -32768 ? -99 : v * RF.scale;
}
const ground = (x, y) => Math.max(hAt(x, y), -1);

// named anchors (model coords)
const P = {};
const lot = site.parkingShared, lotC = centroid(lot);
const pvC = centroid(site.pv.map(centroid));
const allWells = sys.wellRows.flat();
const fieldC = centroid(allWells);
P.pv = [pvC[0], pvC[1], 24];
P.field = [1010, -300, -150];
P.vault = [sys.vault[0], sys.vault[1], -6];
P.headerMid = [...sys.header[Math.floor(sys.header.length / 2)], -6];
const mc = centroid(sys.mechRoom.corners);
P.mech = [mc[0], mc[1], 6];
P.gallery = [150, 130, 12];
P.roofCut = [150, 105, 26];
P.specRoof = [95, 55, 22];
P.specSlab = [205, 62, 10];
P.road = [1266, 86, 4];
P.grid = [1300, 120, 30];
P.tanks = [585, 175, -12];
const bigBasin = site.basins.slice().sort((a, b) => polyArea(b) - polyArea(a))[0];
const bb = centroid(bigBasin); P.basin = [bb[0], bb[1], 3];
P.lawn = [330, -620, 2];
P.leach = [612, -470, -4];
P.roots = [60, -470, -4];
P.pasture = [-250, -800, 3];
P.valley = [600, -200, -40];
P.overlook = [site.overlook.c[0], site.overlook.c[1], 6];
P.trailhead = [site.trailhead[0], site.trailhead[1], 4];
P.loopW = (() => { const b = site.boardwalk; let m = b[0]; b.forEach(p => { if (p[0] < m[0]) m = p; }); return [m[0], m[1], 6]; })();
const at = a => typeof a === 'string' ? W(...P[a]) : W(...a);

// ---------- strata material (cut faces, block sides) ----------
const STRATA_GLSL = /* glsl */`
  float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }
  vec3 srgb(vec3 c){ return pow(c, vec3(2.2)); }
  vec3 strata(vec3 w, float surf){
    float d = surf - w.y;
    if (d < 1.4) return srgb(vec3(.24,.19,.13));
    if (d < 6.0) return srgb(mix(vec3(.47,.36,.25), vec3(.58,.46,.33), smoothstep(1.4,6.0,d)));
    float y = w.y + 4.0*sin(w.x*.012 + w.z*.005) + 2.5*sin(w.z*.019 - w.x*.003);
    float k = floor(y / 9.0), f = fract(y / 9.0), r = h1(k);
    vec3 c;
    if (r < .30) c = vec3(.86,.78,.60);
    else if (r < .52) c = vec3(.68,.66,.61);
    else if (r < .70) c = vec3(.57,.59,.62);
    else if (r < .88) c = vec3(.78,.68,.52);
    else c = vec3(.72,.40,.27);
    if (h1(k + 7.31) > .74 && f > .80) c = vec3(.17,.14,.13);
    float g = h1(floor(w.x*.7) + floor(w.z*.7)*57.0 + floor(w.y*.7)*13.0);
    c *= .93 + .09*g;
    c *= 1.0 - .22*(1.0 - smoothstep(0.0, .05, f));
    return srgb(c);
  }`;
function strataMaterial(opts = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, side: THREE.DoubleSide, ...opts });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float surf;\nvarying float vSurf;\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurf = surf;\nvWp = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSurf;\nvarying vec3 vWp;\n' + STRATA_GLSL)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( strata(vWp, vSurf), opacity );')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive + diffuseColor.rgb * 0.22;');
  };
  return m;
}

// ---------- terrain block ----------
const groundMats = [], clipWithGround = [];
const terrainPlanes = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];
const terrainTop = (() => {
  const nx = TER.nx, ny = TER.ny, cell = TER.cell;
  const pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3);
  const c = new THREE.Color(), prairie = new THREE.Color('#B5B47F'), prairie2 = new THREE.Color('#A3A56E'), dry = new THREE.Color('#C9BD8E');
  const bands = ['#D8C9A0', '#B9B2A2', '#A7A39A', '#C7AE86', '#B86D4F', '#8E8778'].map(s => new THREE.Color(s));
  const green = new THREE.Color('#8D9A62'), juniper = new THREE.Color('#5E6B45');
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = X0 + i * cell, y = Y0 + j * cell, h = TH[k] * TER.scale;
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = -y;
    const hx = TH[j * nx + Math.min(i + 1, nx - 1)] - TH[j * nx + Math.max(i - 1, 0)], hy = TH[Math.min(j + 1, ny - 1) * nx + i] - TH[Math.max(j - 1, 0) * nx + i];
    const slope = Math.hypot(hx, hy) * TER.scale / (2 * cell);
    const n = hash(i * .37 | 0, j * .37 | 0) * .5 + hash(i, j) * .5;
    c.copy(prairie).lerp(prairie2, n).lerp(dry, Math.max(0, hash(i >> 3, j >> 3) - .6));
    if (slope > .22) {
      const bi = Math.floor((h + 3 * Math.sin(x * .01)) / 7) % bands.length;
      const b = bands[(bi + bands.length) % bands.length];
      c.lerp(b, Math.min(1, (slope - .22) * 3.5));
    }
    if (h < -120 && slope < .25) c.lerp(green, .55);
    if (slope > .1 && slope < .5 && hash(i * 3.1, j * 1.7) > .93) c.lerp(juniper, .8);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  const idx = new Uint32Array((nx - 1) * (ny - 1) * 6); let q = 0;
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; idx[q++] = a; idx[q++] = b; idx[q++] = d; idx[q++] = b; idx[q++] = e; idx[q++] = d; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, clipIntersection: true }));
  m.receiveShadow = true; groundMats.push(m.material); groups.ground.add(m);
  return m;
})();
// sides + bottom of the block
const strataSide = strataMaterial({ clipIntersection: true });
groundMats.push(strataSide);
{
  const geos = [];
  const edge = (pts) => {
    const n = pts.length, pos = new Float32Array(n * 6), surf = new Float32Array(n * 2), idx = [];
    pts.forEach(([x, y], i) => { const h = hAt(x, y); pos.set([x, h, -y, x, BASE, -y], i * 6); surf[i * 2] = surf[i * 2 + 1] = h; if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('surf', new THREE.BufferAttribute(surf, 1)); g.setIndex(idx); geos.push(g);
  };
  const s = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
  edge(s(X0, X1, TER.nx - 1).map(x => [x, Y0])); edge(s(X0, X1, TER.nx - 1).map(x => [x, Y1]));
  edge(s(Y0, Y1, TER.ny - 1).map(y => [X0, y])); edge(s(Y0, Y1, TER.ny - 1).map(y => [X1, y]));
  const bottom = new THREE.PlaneGeometry(X1 - X0, Y1 - Y0); bottom.rotateX(Math.PI / 2); bottom.translate((X0 + X1) / 2, BASE, -(Y0 + Y1) / 2);
  bottom.setAttribute('surf', new THREE.BufferAttribute(new Float32Array(4).fill(0), 1)); bottom.deleteAttribute('uv');
  geos.forEach(g => g.computeVertexNormals());
  bottom.computeVertexNormals();
  const sides = new THREE.Mesh(mergeGeometries([...geos, bottom]), strataSide);
  groups.ground.add(sides);
}

// ---------- terrain cut (rectangular pit) ----------
const CUT = { on: false, k: 0, target: 0, c: [0, 0], ang: 0, l: 0, w: 0, depth: 340 };
const capMat = strataMaterial();
const floorMat = new THREE.MeshStandardMaterial({ color: '#7E705C', roughness: 1, side: THREE.DoubleSide });
const capMeshes = Array.from({ length: 5 }, (_, i) => { const m = new THREE.Mesh(new THREE.BufferGeometry(), i === 4 ? floorMat : capMat); m.visible = false; m.frustumCulled = false; groups.ground.add(m); return m; });
const CAPN = 48;
capMeshes.slice(0, 4).forEach(m => {
  m.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((CAPN + 1) * 6), 3));
  m.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((CAPN + 1) * 6), 3));
  m.geometry.setAttribute('surf', new THREE.BufferAttribute(new Float32Array((CAPN + 1) * 2), 1));
  const idx = []; for (let i = 0; i < CAPN; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } m.geometry.setIndex(idx);
});
{ const f = capMeshes[4].geometry; f.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); f.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3)); f.setAttribute('surf', new THREE.BufferAttribute(new Float32Array(4), 1)); f.setIndex([0, 1, 2, 0, 2, 3]); }
function cutFrame(c, ang, l, w, corner) {
  const u = [Math.cos(ang * D2R), Math.sin(ang * D2R)], v = [-u[1], u[0]];
  const c0 = corner || [c[0] - u[0] * l / 2 - v[0] * w / 2, c[1] - u[1] * l / 2 - v[1] * w / 2];
  return { u, v, c0 };
}
// clip segment p0 + d*[0,L] to the block rectangle -> [a,b] or null
function clipSeg(p0, d, L) {
  let a = 0, b = L;
  for (const [pi, di, lo, hi] of [[p0[0], d[0], X0, X1], [p0[1], d[1], Y0, Y1]]) {
    if (Math.abs(di) < 1e-9) { if (pi < lo || pi > hi) return null; continue; }
    let t0 = (lo - pi) / di, t1 = (hi - pi) / di; if (t0 > t1) [t0, t1] = [t1, t0];
    a = Math.max(a, t0); b = Math.min(b, t1);
  }
  return b > a ? [a, b] : null;
}
function setPlane(pl, dir, sign, c0, off) { // distance = sign*((p-c0)·dir) - off
  pl.normal.set(sign * dir[0], 0, -sign * dir[1]);
  pl.constant = -sign * (c0[0] * dir[0] + c0[1] * dir[1]) - off;
}
function updateCut() {
  const on = CUT.on && CUT.k > 0.001;
  [...groundMats, ...clipWithGround].forEach(m => { const want = on ? terrainPlanes : null; if (m.clippingPlanes !== want) { m.clippingPlanes = want; m.clipIntersection = true; m.needsUpdate = true; } });
  capMeshes.forEach(m => m.visible = on);
  if (!on) return;
  const l = CUT.l * CUT.k, w = CUT.w * CUT.k, dep = CUT.depth;
  const { u, v, c0 } = cutFrame(CUT.c, CUT.ang, l, w, CUT.c0);
  setPlane(terrainPlanes[0], u, -1, c0, 0);       // -s
  setPlane(terrainPlanes[1], u, 1, c0, l);        // s - l
  setPlane(terrainPlanes[2], v, -1, c0, 0);       // -t
  setPlane(terrainPlanes[3], v, 1, c0, w);        // t - w
  terrainPlanes[4].normal.set(0, -1, 0); terrainPlanes[4].constant = -dep; // -(y + dep)
  const faces = [ // start, dir, length, inward normal (model)
    [c0, u, l, v], [[c0[0] + v[0] * w, c0[1] + v[1] * w], u, l, [-v[0], -v[1]]],
    [c0, v, w, u], [[c0[0] + u[0] * l, c0[1] + u[1] * l], v, w, [-u[0], -u[1]]]
  ];
  faces.forEach(([s0, d, L, nrm], fi) => {
    const g = capMeshes[fi].geometry, pa = g.attributes.position.array, na = g.attributes.normal.array, sa = g.attributes.surf.array;
    const r = clipSeg(s0, d, L) || [0, 0];
    for (let i = 0; i <= CAPN; i++) {
      const tt = r[0] + (r[1] - r[0]) * i / CAPN, x = s0[0] + d[0] * tt, y = s0[1] + d[1] * tt, h = hAt(x, y);
      pa.set([x, h, -y, x, -dep, -y], i * 6); na.set([nrm[0], 0, -nrm[1], nrm[0], 0, -nrm[1]], i * 6); sa[i * 2] = sa[i * 2 + 1] = h;
    }
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.surf.needsUpdate = true; g.computeBoundingSphere();
  });
  const f = capMeshes[4].geometry, fp = f.attributes.position.array;
  const cs = [c0, [c0[0] + u[0] * l, c0[1] + u[1] * l], [c0[0] + u[0] * l + v[0] * w, c0[1] + u[1] * l + v[1] * w], [c0[0] + v[0] * w, c0[1] + v[1] * w]];
  cs.forEach((p, i) => { fp.set([Math.min(Math.max(p[0], X0), X1), -dep, -Math.min(Math.max(p[1], Y0), Y1)], i * 3); f.attributes.surf.array[i] = 0; });
  f.attributes.position.needsUpdate = true; f.computeBoundingSphere();
}

// ---------- building cut ----------
const BCUT = { on: false, k: 0, c: [0, 0], ang: 0, l: 0, w: 0, z: 0 };
const bPlanes = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];
const bMats = [];
const ROOF_LAYERS = [ // from top down: thickness (ft, drawn a little thicker than built), color
  [1.3, '#6F8A47'], [0.25, '#2E2B28'], [1.2, '#EDE3B0'], [0.35, '#A9A7A1'], [1.0, '#D6A15F']
];
const bcapMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, side: THREE.DoubleSide });
const bcap = new THREE.Mesh(new THREE.BufferGeometry(), bcapMat); bcap.visible = false; bcap.frustumCulled = false; groups.building.add(bcap);
function updateBcut() {
  const on = BCUT.on && BCUT.k > 0.001;
  bMats.forEach(m => { const want = on ? bPlanes : null; if (m.clippingPlanes !== want) { m.clippingPlanes = want; m.needsUpdate = true; } });
  bcap.visible = on; if (!on) return;
  const l = BCUT.l * BCUT.k, w = BCUT.w * BCUT.k;
  const { u, v, c0 } = cutFrame(BCUT.c, BCUT.ang, l, w);
  setPlane(bPlanes[0], u, -1, c0, 0); setPlane(bPlanes[1], u, 1, c0, l);
  setPlane(bPlanes[2], v, -1, c0, 0); setPlane(bPlanes[3], v, 1, c0, w);
  bPlanes[4].normal.set(0, -1, 0); bPlanes[4].constant = BCUT.z; // removed above z
  const pos = [], colr = [], nor = [], col = new THREE.Color();
  const faces = [[c0, u, l, v], [[c0[0] + v[0] * w, c0[1] + v[1] * w], u, l, v], [c0, v, w, u], [[c0[0] + u[0] * l, c0[1] + u[1] * l], v, w, u]];
  faces.forEach(([s0, d, L, nrm]) => {
    const N = Math.max(8, Math.ceil(L / 2)); let prev = null;
    for (let i = 0; i <= N; i++) {
      const x = s0[0] + d[0] * L * i / N, y = s0[1] + d[1] * L * i / N, T = roofAt(x, y);
      const cur = T > Math.max(BCUT.z, 6) + 2 ? { x, y, T } : null;
      if (cur && prev) {
        let z = 0;
        ROOF_LAYERS.forEach(([th, c]) => {
          const a1 = prev.T - z, a0 = prev.T - z - th, b1 = cur.T - z, b0 = cur.T - z - th; z += th;
          if (Math.min(a0, b0) < BCUT.z) return;
          col.set(c);
          const q = [[prev.x, a1, prev.y], [prev.x, a0, prev.y], [cur.x, b1, cur.y], [cur.x, b0, cur.y]];
          [0, 1, 2, 2, 1, 3].forEach(k => { pos.push(q[k][0], q[k][1], -q[k][2]); colr.push(col.r, col.g, col.b); nor.push(nrm[0], 0, -nrm[1]); });
        });
      }
      prev = cur;
    }
  });
  const g = bcap.geometry; g.dispose();
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ng.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); ng.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  bcap.geometry = ng;
}

// ---------- helpers: tubes & flows ----------
function tube(points, radius, mat, seg) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.15);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg || Math.max(16, points.length * 6), radius, 8, false), mat);
  m.userData.curve = curve; return m;
}
// many polylines -> one instanced mesh of moving beads
function flows(group, paths, color, { spacing = 30, speed = 34, size = 2.2, glow = 1, max = 60 } = {}) {
  const P2 = paths.map(pts => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1])); return { pts, L, len: L[L.length - 1] }; }).filter(p => p.len > 1);
  const beads = []; P2.forEach((p, pi) => { const n = Math.max(2, Math.min(max, Math.round(p.len / spacing))); for (let i = 0; i < n; i++) beads.push([pi, i / n]); });
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: glow, roughness: .4 });
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 10, 8), mat, beads.length);
  inst.frustumCulled = false;
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3();
  const upd = t => {
    beads.forEach(([pi, o], k) => {
      const path = P2[pi]; const d = ((o + t * speed / path.len) % 1) * path.len;
      let i = 1; while (i < path.L.length - 1 && path.L[i] < d) i++;
      const a = path.pts[i - 1], b = path.pts[i], f = (d - path.L[i - 1]) / Math.max(1e-6, path.L[i] - path.L[i - 1]);
      p.lerpVectors(a, b, f); m4.makeTranslation(p.x, p.y, p.z); inst.setMatrixAt(k, m4);
    });
    inst.instanceMatrix.needsUpdate = true;
  };
  upd(0); animators.push(t => { if (inst.visible && group.visible && !REDUCED) upd(t); });
  group.add(inst); return inst;
}
const smooth = (pts, n = 6) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .15).getSpacedPoints(Math.max(2, pts.length * n));

// ---------- callouts ----------
const callouts = {};
function callout(group, id, pos, opts = {}) {
  const c = CALLOUTS[id]; if (!c) return;
  const el = document.createElement('div'); el.className = 'co' + (opts.left ? ' left' : '');
  el.innerHTML = `<div class="callout"><b>${c[0]}</b>${c[1] ? `<span>${c[1]}</span>` : ''}</div>`;
  const o = new CSS2DObject(el); o.position.copy(pos); group.add(o);
  (callouts[id] ||= []).push(o); o.visible = false; el.style.display = 'none';
}
function marker(group, pos, num, color, stopIdx) {
  const el = document.createElement('button');
  el.className = 'hotspot'; el.style.setProperty('--c', color); el.textContent = num;
  el.setAttribute('aria-label', `Stop ${num}`);
  el.addEventListener('click', e => { e.stopPropagation(); selectStop(stopIdx); });
  const o = new CSS2DObject(el); o.position.copy(pos); group.add(o); return el;
}
function place(group, pos, text, main) {
  const el = document.createElement('div'); el.className = 'place' + (main ? ' main' : ''); el.textContent = text;
  const o = new CSS2DObject(el); o.position.copy(pos); group.add(o);
}

// ---------- site surface: paving, basins, boardwalk ----------
function flatPoly(pts, color, lift = 0.4, opts = {}) {
  const geo = new THREE.ShapeGeometry(shapeFrom(pts)); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, clipIntersection: true });
  const m = new THREE.Mesh(geo, mat); m.position.y = lift; m.receiveShadow = true;
  if (opts.ground !== false) groundMats.push(mat);
  return m;
}
{
  groups.site.add(flatPoly(lot, '#BDB7AC'));
  groups.site.add(flatPoly(site.parkingDropoff, '#BDB7AC'));
  site.basins.forEach(b => groups.site.add(flatPoly(b, '#7FAE9B', .45)));
  const bwMat = std('#9B7651', { r: .8 });
  const bw = tube(site.boardwalk.map(p => W(p[0], p[1], 2.2)), 4.5, bwMat); bw.scale.y = 1; bw.castShadow = true; groups.site.add(bw);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(site.overlook.r, 4, 8, 48), bwMat);
  ring.rotation.x = Math.PI / 2; ring.position.copy(W(site.overlook.c[0], site.overlook.c[1], 2.2)); groups.site.add(ring);
  // road
  const rd = site.chateauRoad.filter(p => p[0] < X1 && p[1] < Y1).map(p => W(p[0], p[1], ground(p[0], p[1]) + 0.8));
  const road = tube(rd, 12, std('#A19E96', { r: 1 })); road.scale.y = 1; groups.site.add(road);
  // maintenance & land stewardship building
  const om = new THREE.Mesh(new THREE.BoxGeometry(64, 16, 38), std('#CFC6B4', { r: .9 })); om.position.copy(W(site.omBldg[0] - 12, site.omBldg[1] + 6, 8)); om.rotation.y = .7; om.castShadow = true; groups.site.add(om);
}

// ---------- building ----------
const mats = {
  roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: THREE.DoubleSide, clipIntersection: true }),
  fascia: new THREE.MeshStandardMaterial({ color: '#6E5A45', roughness: .8, side: THREE.DoubleSide, clipIntersection: true }),
  body: new THREE.MeshStandardMaterial({ color: '#B9A386', roughness: .55, metalness: .05, side: THREE.DoubleSide, clipIntersection: true }),
  floor: new THREE.MeshStandardMaterial({ color: '#D9D4CA', roughness: .9, clipIntersection: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
};
bMats.push(mats.roof, mats.fascia, mats.body);
const woodColor = new THREE.Color('#C98C4E'), bodyColor = new THREE.Color('#B9A386');
const roofParts = [];
{
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('assets/models/building.glb');
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const n = (o.name + ' ' + (o.parent?.name || '')).toLowerCase();
    if (n.includes('roof')) { o.material = mats.roof; roofParts.push(o); }
    else if (n.includes('fascia')) { o.material = mats.fascia; roofParts.push(o); }
    else { o.material = mats.body; o.geometry.deleteAttribute('color'); }
    o.geometry.computeVertexNormals();
    o.castShadow = true; o.receiveShadow = true;
  });
  groups.building.add(gltf.scene);
  footprints.forEach(fp => { const g = new THREE.ShapeGeometry(shapeFrom(fp)); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mats.floor); m.position.y = 0.25; m.receiveShadow = true; groups.building.add(m); });
}
// interior group: things you only see when the building is cut open
const interior = new THREE.Group(); groups.building.add(interior);

// ---- mechanical room E148 (layout from M301, schedules from M802) ----
const MR = sys.mechRoom, mrAng = MR.angle * D2R;
const mech = new THREE.Group(); interior.add(mech);
const eqPos = {};
{
  // room slab + low walls (dollhouse)
  const slab = flatPoly(MR.corners, '#C9C6BF', 0.5, { ground: false }); slab.material.clipIntersection = false; mech.add(slab);
  const wallMat = std('#EFE9DC', { r: .9, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const a = MR.corners[i], b = MR.corners[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(L, 12, 0.8), wallMat);
    wall.position.copy(W((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 6)); wall.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]); mech.add(wall);
  }
  const kinds = {
    hp: (s, i, h) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(s, h, i), std('#E07A45', { r: .5 })); b.position.y = h / 2; g.add(b); const p = new THREE.Mesh(new THREE.BoxGeometry(s * .5, h * .3, .2), std('#2B3036')); p.position.set(-s * .15, h * .7, i / 2 + .1); g.add(p); return g; },
    chiller: (s, i, h) => { const g = new THREE.Group(); const sm = std('#5B8DB8', { r: .4, m: .3 }); [-.22, .22].forEach(o => { const c = new THREE.Mesh(new THREE.CylinderGeometry(i * .27, i * .27, s * .95, 20), sm); c.rotation.z = Math.PI / 2; c.position.set(0, h * .3, o * i); g.add(c); }); const comp = new THREE.Mesh(new THREE.CylinderGeometry(i * .3, i * .3, s * .3, 20), std('#D9DEE2', { r: .3, m: .5 })); comp.rotation.z = Math.PI / 2; comp.position.set(s * .15, h * .78, 0); g.add(comp); const base = new THREE.Mesh(new THREE.BoxGeometry(s, .5, i), std('#3a3f45')); base.position.y = .25; g.add(base); return g; },
    ahu: (s, i, h) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(s, h, i), std('#B7C1C9', { r: .45, m: .3 })); b.position.y = h / 2; g.add(b); for (let k = 1; k < 6; k++) { const r = new THREE.Mesh(new THREE.BoxGeometry(.25, h + .1, i + .1), std('#8D99A3')); r.position.set(-s / 2 + k * s / 6, h / 2, 0); g.add(r); } return g; },
    boiler: (s, i, h) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(s, h, i), std('#C4483A', { r: .5 })); b.position.y = h / 2; g.add(b); return g; },
    pump: (s, i, h) => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(i * .45, i * .45, s * .5, 16), std('#2F6D93', { r: .4 })); c.rotation.z = Math.PI / 2; c.position.set(-s * .2, h * .4, 0); g.add(c); const mo = new THREE.Mesh(new THREE.CylinderGeometry(i * .35, i * .35, s * .45, 16), std('#5D6770')); mo.rotation.z = Math.PI / 2; mo.position.set(s * .25, h * .45, 0); g.add(mo); return g; },
    tank: (s, i, h) => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(s / 2, s / 2, h, 24), std('#CDD2D6', { r: .35, m: .4 })); c.position.y = h / 2; g.add(c); return g; },
    mbr: (s, i, h) => { const g = new THREE.Group(); const fr = new THREE.Mesh(new THREE.BoxGeometry(s, .6, i), std('#2C6E86')); fr.position.y = .3; g.add(fr); for (let k = 0; k < 5; k++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(i * .32, i * .32, h * (k % 2 ? .7 : 1), 16), std(k % 2 ? '#2FB5DA' : '#E6EEF2', { r: .35, m: .2 })); t.position.set(-s / 2 + (k + .5) * s / 5, h * (k % 2 ? .35 : .5), 0); g.add(t); } const uv = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, s * .8, 10), std('#9C6BD6', { e: .6 })); uv.rotation.z = Math.PI / 2; uv.position.set(0, h * .95, i * .3); g.add(uv); return g; }
  };
  MR.equipment.forEach(e => {
    const mk = e.tag === 'BREAK' ? kinds.tank : kinds[e.kind]; const g = mk(e.s, e.i, e.h);
    g.position.copy(W(e.at[0], e.at[1], 0.5)); g.rotation.y = mrAng; g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    mech.add(g); eqPos[e.tag] = W(e.at[0], e.at[1], e.h + 1.5);
  });
}

// ---- tunnel to the west building ----
const tunnelPts = [W(398, 100, -8), W(330, 104, -8), W(300, 100, -8), W(260, 90, -8)];

// ---- section interior: radiant tubing, chilled beams, fresh air (west building) ----
const section = new THREE.Group(); interior.add(section);
{
  const inB = (x, y) => roofAt(x, y) > 12;
  // radiant serpentine in the floor
  const pts = []; let dir = 1;
  for (let y = 60; y <= 200; y += 5) { const row = []; for (let x = 30; x <= 285; x += 5) if (inB(x, y)) row.push(x); if (row.length < 2) continue; const a = row[0], b = row[row.length - 1]; if (dir > 0) { pts.push(W(a, y, .6), W(b, y, .6)); } else { pts.push(W(b, y, .6), W(a, y, .6)); } dir *= -1; }
  const lines = []; for (let i = 1; i < pts.length; i++) lines.push(pts[i - 1], pts[i]);
  const radGeo = new THREE.BufferGeometry().setFromPoints(lines);
  const radMat = new THREE.LineBasicMaterial({ color: '#F07F3C' });
  section.add(new THREE.LineSegments(radGeo, radMat));
  // a few thicker tubes so it reads from afar
  const thick = []; for (let i = 0; i < pts.length - 1; i++) thick.push(new THREE.LineCurve3(pts[i], pts[i + 1]));
  const tubeGeos = thick.map(c => new THREE.TubeGeometry(c, 1, .28, 4));
  if (tubeGeos.length) section.add(new THREE.Mesh(mergeGeometries(tubeGeos), std('#F08A4B', { e: .55, r: .5 })));
  // chilled beams
  const beamGeo = new THREE.BoxGeometry(8, .9, 2.2), bm = std('#9FD3EE', { e: .25, r: .4, m: .2 }); bm.clipIntersection = true; bMats.push(bm);
  const bpos = [];
  for (let x = 36; x <= 280; x += 20) for (let y = 70; y <= 200; y += 18) { const T = roofAt(x, y); if (T > 16) bpos.push([x, y, T - 6.5]); }
  const beamsI = new THREE.InstancedMesh(beamGeo, bm, bpos.length); const m4 = new THREE.Matrix4();
  bpos.forEach(([x, y, z], i) => { m4.makeTranslation(...W(x, y, z).toArray()); beamsI.setMatrixAt(i, m4); }); section.add(beamsI);
  P.beamC = bpos.length ? bpos[Math.floor(bpos.length * .55)] : [150, 140, 20];
  // cool air drifting down from beams
  flows(section, bpos.filter((_, i) => i % 3 === 0).map(([x, y, z]) => [W(x, y, z - .6), W(x + 2, y, Math.max(3, z - 12))]), '#7CC6EA', { spacing: 4, speed: 4, size: .55, glow: .8 });
  // fresh-air duct along the gallery
  const duct = [W(150, 40, 0), W(150, 120, 0), W(150, 200, 0)];
  duct.forEach(p => { p.y = Math.max(14, roofAt(p.x, -p.z) - 4.2); });
  const dm = std('#D7DBDE', { r: .4, m: .5 }); dm.clipIntersection = true; bMats.push(dm); section.add(tube(duct, 1.6, dm, 40));
  flows(section, [duct], '#FFFFFF', { spacing: 12, speed: 18, size: .8, glow: .5 });
  P.duct = [150, 112, duct[1].y + 1];
  // glulam beams (carbon & envelope)
  const beamMat = std('#D08A45', { e: .2, r: .6 }); beamMat.clipIntersection = true; bMats.push(beamMat);
  const gl = [];
  beams.forEach(b => { if (b.length < 3) return; const pts2 = b.map(p => new THREE.Vector3(p[0], p[1] - 3.5, p[2])); gl.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), pts2.length * 2, 1.1, 5, false)); });
  if (gl.length) { const glm = new THREE.Mesh(mergeGeometries(gl), beamMat); section.add(glm); P.glulam = (() => { const b = beams[Math.floor(beams.length / 2)]; const p = b[Math.floor(b.length / 2)]; return [p[0], -p[2], p[1] - 3]; })(); }
}


// ---- specimens: exploded samples of the roof assembly and the radiant slab ----
const specimens = {};
{
  const g = new THREE.Group(); const base = [95, 55, 14], S = 24;
  const put = (mesh, z) => { mesh.position.copy(W(base[0], base[1], z)); g.add(mesh); return mesh; };
  let z = 0; const gap = 2.6; const lab = {};
  // glulam beams
  [-7, 7].forEach(o => { const b = new THREE.Mesh(new THREE.BoxGeometry(S, 2.4, 1.6), std('#C98846', { r: .6 })); b.position.copy(W(base[0], base[1] + o, base[2] + z + 1.2)); g.add(b); });
  lab.glulam = [base[0] + S / 2, base[1] - 7, base[2] + z + 1.2]; z += 2.4 + gap;
  // 7-layer CLT
  for (let k = 0; k < 7; k++) { const ply = new THREE.Mesh(new THREE.BoxGeometry(S, .19, S), std(k % 2 ? '#E2B57A' : '#D19C5C', { r: .7 })); put(ply, base[2] + z + .1 + k * .2); }
  lab.clt = [base[0] + S / 2, base[1] - S / 2, base[2] + z + .7]; z += 1.4;
  put(new THREE.Mesh(new THREE.BoxGeometry(S, .35, S), std('#A9A7A1')), base[2] + z + .17); z += .35 + gap;
  put(new THREE.Mesh(new THREE.BoxGeometry(S, 1.5, S), std('#EEE1A6', { r: .9 })), base[2] + z + .75);
  lab.insul = [base[0] + S / 2, base[1] - S / 2, base[2] + z + .75]; z += 1.5 + gap * .6;
  put(new THREE.Mesh(new THREE.BoxGeometry(S, .2, S), std('#2D2A27')), base[2] + z + .1); z += .2 + gap * .6;
  put(new THREE.Mesh(new THREE.BoxGeometry(S, 1.3, S), std('#5B4330', { r: 1 })), base[2] + z + .65); z += 1.3;
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(.45, 2.2, 5), std('#7E9A4A'), 120);
  for (let i = 0; i < 120; i++) { m4.makeTranslation(base[0] + (Math.random() - .5) * (S - 1), base[2] + z + 1, -(base[1] + (Math.random() - .5) * (S - 1))); tufts.setMatrixAt(i, m4); }
  g.add(tufts); lab.roofLayers = [base[0] + S / 2, base[1] - S / 2, base[2] + z + 1];
  g.visible = false; interior.add(g); specimens.roof = { g, lab };
}
{
  const g = new THREE.Group(); const base = [205, 62, 9], S = 26;
  const conc = new THREE.Mesh(new THREE.BoxGeometry(S, 1.6, S), std('#C8C4BC', { op: .55, dw: false, r: .9 }));
  conc.position.copy(W(base[0], base[1], base[2] + .8)); g.add(conc);
  const xps = new THREE.Mesh(new THREE.BoxGeometry(S, .6, S), std('#9CC3D9', { r: .9 })); xps.position.copy(W(base[0], base[1], base[2] - .5)); g.add(xps);
  const pts = []; for (let k = 0; k < 9; k++) { const y = base[1] - S / 2 + 1.2 + k * (S - 2.4) / 8; const a = W(base[0] - S / 2 + 1, y, base[2] + .7), b = W(base[0] + S / 2 - 1, y, base[2] + .7); if (k % 2) pts.push(b, a); else pts.push(a, b); }
  const tg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .05), 200, .32, 6), std('#F07F3C', { e: .6 })); g.add(tg);
  flows(g, [pts], '#FFD2B0', { spacing: 3, speed: 5, size: .38 });
  g.visible = false; interior.add(g); specimens.slab = { g, lab: { slab: [base[0] + S / 2, base[1] - S / 2, base[2] + .8] } };
}

// ---------- OVERVIEW ----------
PLACES.forEach(p => place(groups.overview, at(p.at), p.name, p.main));

// ---------- ENERGY ----------
const E = groups.energy;
const COOL = '#4E9BD6', WARM = '#F07F3C';
{
  // solar canopies: timber frame + panel deck with module grid
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const cx = cv.getContext('2d');
  cx.fillStyle = '#1D2B4D'; cx.fillRect(0, 0, 64, 64); cx.strokeStyle = '#7F93B8'; cx.lineWidth = 2; cx.strokeRect(1, 1, 62, 62); cx.strokeStyle = '#2E4270'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(32, 0); cx.lineTo(32, 64); cx.moveTo(0, 32); cx.lineTo(64, 32); cx.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(1 / 6.5, 1 / 3.6);
  const panelMat = new THREE.MeshStandardMaterial({ map: tex, roughness: .3, metalness: .35, emissive: '#1d2f5a', emissiveIntensity: .2 });
  const timber = std('#A8713F', { r: .8 });
  clipWithGround.push(panelMat, timber);
  site.pv.forEach(poly => {
    const small = polyArea(poly) < 3000, h = small ? 17 : 15;
    const geo = new THREE.ExtrudeGeometry(shapeFrom(poly), { depth: .8, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv; // planar uv in feet
    for (let i = 0; i < uv.count; i++) { const x = geo.attributes.position.getX(i), z = geo.attributes.position.getZ(i); uv.setXY(i, x, z); }
    const m = new THREE.Mesh(geo, panelMat); m.position.y = h; m.castShadow = true; groups.site.add(m);
    if (!small) {
      // posts along the long axis
      const c = centroid(poly); let far = poly[0]; poly.forEach(p => { if (Math.hypot(p[0] - c[0], p[1] - c[1]) > Math.hypot(far[0] - c[0], far[1] - c[1])) far = p; });
      const ax = [far[0] - c[0], far[1] - c[1]], L = Math.hypot(...ax), a = [ax[0] / L, ax[1] / L];
      const n = Math.max(2, Math.round(L / 24));
      for (let k = -n; k <= n; k++) {
        const px = c[0] + a[0] * k * (L * .85 / n), py = c[1] + a[1] * k * (L * .85 / n);
        if (!inPoly(px, py, poly)) continue;
        const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), timber); post.position.copy(W(px, py, h / 2)); post.castShadow = true; groups.site.add(post);
      }
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(L * 1.8, 1.4, 1.4), timber); ridge.position.copy(W(c[0], c[1], h - .7)); ridge.rotation.y = Math.atan2(a[1], a[0]); groups.site.add(ridge);
    }
  });
  callout(E, 'pv', W(pvC[0], pvC[1], 30));
  // sunlight onto panels
  const sunPaths = [];
  site.pv.slice().sort((a, b) => polyArea(b) - polyArea(a)).slice(0, 5).forEach(poly => { const c = centroid(poly); for (let j = 0; j < 3; j++) { const dx = (j - 1) * 16; sunPaths.push([W(c[0] - 240 + dx, c[1] + 140, 400), W(c[0] + dx * .3, c[1], 17)]); } });
  flows(E, sunPaths, '#FFC94D', { spacing: 70, speed: 120, size: 2.2, glow: 1.4 });
  // power to the building
  flows(E, [smooth([W(pvC[0], pvC[1], 12), W(pvC[0] - 140, pvC[1] + 120, 3), W(560, 60, 3), W(430, 70, 4)])], '#FFC94D', { spacing: 22, speed: 50 });

  // ---- geothermal wells (M001: 216 boreholes, 300 ft) ----
  const DEPTH = sys.wellDepth;
  const n = allWells.length;
  const grout = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.4, 2.4, DEPTH, 10, 1, true), std('#8C8B86', { op: .38, dw: false, side: THREE.DoubleSide }), n);
  const pipeG = new THREE.CylinderGeometry(.75, .75, DEPTH, 6);
  const down = new THREE.InstancedMesh(pipeG, std(COOL, { e: .35, r: .4 }), n);
  const up = new THREE.InstancedMesh(pipeG, std(WARM, { e: .35, r: .4 }), n);
  const bend = new THREE.InstancedMesh(new THREE.TorusGeometry(1.1, .75, 6, 12, Math.PI), std('#C98A6E', { e: .2 }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  allWells.forEach(([x, y], i) => {
    const top = -5, mid = top - DEPTH / 2;
    m4.makeTranslation(x, mid, -y); grout.setMatrixAt(i, m4);
    m4.makeTranslation(x - 1.1, mid, -y); down.setMatrixAt(i, m4);
    m4.makeTranslation(x + 1.1, mid, -y); up.setMatrixAt(i, m4);
    q.setFromEuler(new THREE.Euler(0, 0, Math.PI)); m4.compose(new THREE.Vector3(x, top - DEPTH, -y), q, s1); bend.setMatrixAt(i, m4);
  });
  [grout, down, up, bend].forEach(m => { m.frustumCulled = false; E.add(m); });
  // flow inside wells inside the pit
  const pitStop = LAYERS.energy.stops.find(s => s.id === 'wells');
  const { u: pu, v: pv, c0: pc0 } = cutFrame(pitStop.cut.c, pitStop.cut.ang, pitStop.cut.l, pitStop.cut.w, pitStop.cut.c0);
  const inPit = ([x, y]) => { const s = (x - pc0[0]) * pu[0] + (y - pc0[1]) * pu[1], t = (x - pc0[0]) * pv[0] + (y - pc0[1]) * pv[1]; return s > 0 && s < pitStop.cut.l && t > 0 && t < pitStop.cut.w; };
  const pitWells = allWells.filter(inPit);
  flows(E, pitWells.map(([x, y]) => [W(x - 1.1, y, -5), W(x - 1.1, y, -5 - DEPTH)]), '#9AD0F5', { spacing: 26, speed: 22, size: 1.5 });
  flows(E, pitWells.map(([x, y]) => [W(x + 1.1, y, -5 - DEPTH), W(x + 1.1, y, -5)]), '#FFB27A', { spacing: 26, speed: 22, size: 1.5 });
  // depth ruler on the pit's far corner
  const rc = [pc0[0] + pu[0] * 3 + pv[0] * 3, pc0[1] + pu[1] * 3 + pv[1] * 3];
  [100, 200].forEach(d => { const el = document.createElement('div'); el.className = 'ruler'; el.textContent = `${d} ft`; const o = new CSS2DObject(el); o.position.copy(W(rc[0], rc[1], -d)); E.add(o); (callouts.depth ||= []).push(o); o.visible = false; el.style.display = 'none'; });
  callout(E, 'depth', W(rc[0], rc[1], -DEPTH - 5));
  callout(E, 'rock', W(pc0[0] + pu[0] * 260 - pv[0] * 2, pc0[1] + pu[1] * 260 - pv[1] * 2, -170));
  if (pitWells.length) { const w0 = pitWells.reduce((a, b) => Math.hypot(b[0] - rc[0], b[1] - rc[1]) < Math.hypot(a[0] - rc[0], a[1] - rc[1]) ? b : a); callout(E, 'loop', W(w0[0] + 1, w0[1], -60)); }

  // ---- circuits: rows of wells -> vault (M001) ----
  const pipeMat = std('#6B7C8C', { r: .5 });
  const vault = sys.vault;
  const rowGeos = [];
  const circuitPaths = [];
  sys.wellRows.forEach(row => {
    const a = row[0], b = row[row.length - 1];
    const near = Math.hypot(a[0] - vault[0], a[1] - vault[1]) < Math.hypot(b[0] - vault[0], b[1] - vault[1]) ? row.slice() : row.slice().reverse();
    const pts = [W(vault[0], vault[1], -6), W((vault[0] + near[0][0]) / 2, (vault[1] + near[0][1]) / 2, -6), ...near.map(p => W(p[0], p[1], -5))];
    const curvePts = smooth(pts, 4);
    rowGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), curvePts.length, .9, 5));
    circuitPaths.push(curvePts.map(p => p.clone().add(new THREE.Vector3(0, .9, 0))));
  });
  E.add(new THREE.Mesh(mergeGeometries(rowGeos), pipeMat));
  flows(E, circuitPaths, '#FFB27A', { spacing: 40, speed: 30, size: 1.6 });
  const vbox = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 12), std('#8F969C', { r: .6 })); vbox.position.copy(W(vault[0], vault[1], -6)); vbox.rotation.y = 108 * D2R; E.add(vbox);
  callout(E, 'vault', W(vault[0], vault[1], 4));

  // ---- the mains: vault -> mechanical room (two 6" pipes) ----
  const hd = sys.header.map(p => [p[0], p[1]]);
  const off = (pts, o) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [p[0] - dy / L * o, p[1] + dx / L * o]; });
  const entry = [MR.corners[0][0] - 6, MR.corners[0][1] - 4];
  const supply = [...off(hd, 2).reverse().map(p => W(p[0], p[1], -6))]; // vault -> plant
  const ret = off(hd, -2).map(p => W(p[0], p[1], -6));                    // plant -> vault
  const sIn = [...supply, W(entry[0], entry[1], -6), W(entry[0], entry[1], 2)];
  const rOut = [W(entry[0] + 3, entry[1] - 2, 2), W(entry[0] + 3, entry[1] - 2, -6), ...ret];
  E.add(tube(sIn, 1.3, std(WARM, { e: .3 }), 300));
  E.add(tube(rOut, 1.3, std(COOL, { e: .3 }), 300));
  flows(E, [sIn], '#FFB27A', { spacing: 18, speed: 40, size: 1.7 });
  flows(E, [rOut], '#9AD0F5', { spacing: 18, speed: 40, size: 1.7 });
  callout(E, 'mains', W(...P.headerMid.slice(0, 2), 2));
  // plant -> manifold -> heat pumps
  const hp = MR.equipment.filter(e => e.kind === 'hp' && e.tag.startsWith('WWHP')).map(e => W(e.at[0], e.at[1], 3));
  flows(E, [[W(entry[0], entry[1], 3), ...hp, eqPos['CH-1'].clone().setY(3)]], '#FFB27A', { spacing: 6, speed: 12, size: .9 });
  // tunnel to west building + radiant loop
  const tun = tube(tunnelPts, 4.5, std('#BDB6A8', { op: .45, dw: false, side: THREE.DoubleSide }), 40); E.add(tun);
  flows(E, [tunnelPts.map(p => p.clone().add(new THREE.Vector3(0, -1, 1.5)))], '#FFB27A', { spacing: 10, speed: 22, size: 1.1 });
  flows(E, [tunnelPts.slice().reverse().map(p => p.clone().add(new THREE.Vector3(0, -1, -1.5)))], '#9AD0F5', { spacing: 10, speed: 22, size: 1.1 });
  // grid line from the road
  const gp = site.chateauRoad.filter(p => p[0] < X1 - 20 && p[1] < Y1 - 20).slice(0, 3).map(p => W(p[0], p[1], ground(p[0], p[1]) + 32));
  gp.push(W(lotC[0] + 60, lotC[1] + 40, 26), W(470, 60, 22));
  E.add(tube(gp, 1, std('#7B7F86')));
  gp.slice(0, 4).forEach(p => { const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 34), std('#7a5d3e')); pole.position.set(p.x, p.y - 16, p.z); E.add(pole); });
  flows(E, [gp], '#FFFFFF', { spacing: 50, speed: 60, size: 2.2, glow: .6 });
}
// equipment callouts (shared by energy & water)
['WWHP-2', 'CH-1', 'HPLP-1', 'DWH-1', 'B-1', 'AHU-1'].forEach(t => eqPos[t] && callout(E, t, eqPos[t]));
callout(E, 'beam', W(...P.beamC.slice(0, 2), P.beamC[2] - 1));
callout(E, 'air', W(...P.duct));

Object.values(specimens).forEach(sp => Object.entries(sp.lab).forEach(([id, p]) => { callout(E, id, W(...p)); callout(groups.carbon, id, W(...p)); }));

// ---------- WATER ----------
const H2O = groups.water;
const PURPLE = '#7C6FD0', BLUE = '#3B9BD6', BROWN = '#9A8A6A', TEAL = '#3FB3A6';
{
  // process tanks (C510) + approximate drinking-water and fire/recycled tanks in the same berm
  const pt = sys.processTanks.map(([a, b]) => ({ a, b, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }));
  const axis = (() => { const d = [pt[0].b[0] - pt[0].a[0], pt[0].b[1] - pt[0].a[1]]; const L = Math.hypot(...d); return [d[0] / L, d[1] / L]; })();
  const step = [pt[1].c[0] - pt[0].c[0], pt[1].c[1] - pt[0].c[1]];
  const capsule = (c, r, len, color, z) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 20), std(color, { r: .45, e: .15 })); m.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(m); g.position.copy(W(c[0], c[1], z)); g.rotation.y = Math.atan2(axis[1], axis[0]); g.traverse(o => o.castShadow = true); H2O.add(g); return g; };
  pt.forEach(t => capsule(t.c, 5, Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1]) - 10, '#B79A6B', -9));
  const potC = [pt[2].c[0] + step[0] * 1.3, pt[2].c[1] + step[1] * 1.3], npC = [pt[2].c[0] + step[0] * 2.75, pt[2].c[1] + step[1] * 2.75];
  capsule(potC, 5, 19, BLUE, -9);
  capsule(npC, 6, 39, PURPLE, -10);
  const lift = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 16, 18), std('#8E8A82')); lift.position.copy(W(sys.liftStation[0], sys.liftStation[1], -8)); H2O.add(lift);
  callout(H2O, 'proc', W(pt[1].c[0], pt[1].c[1], -2));
  callout(H2O, 'potable', W(potC[0], potC[1], -2));
  callout(H2O, 'np', W(npC[0], npC[1], -2), { left: true });
  callout(H2O, 'lift', W(sys.liftStation[0], sys.liftStation[1], 2));
  ['MBR', 'BREAK'].forEach(t => eqPos[t] && callout(H2O, t, eqPos[t]));
  const mbr = eqPos.MBR ? eqPos.MBR.clone().setY(3) : W(420, 90, 3);
  // supply: road -> drinking-water tank -> building
  const rd = site.chateauRoad.filter(p => p[0] < X1 - 20 && p[1] < Y1 - 20).slice(0, 3).reverse();
  const supply = smooth([...rd.map(p => W(p[0], p[1], -7)), W(900, 60, -7), W(700, 150, -7), W(potC[0], potC[1], -7)], 5);
  H2O.add(tube(supply, 1.2, std(BLUE, { e: .25 }), 200));
  flows(H2O, [supply], '#8FD0F7', { spacing: 30, speed: 30, size: 1.8 });
  flows(H2O, [smooth([W(potC[0], potC[1], -6), W(500, 140, -4), W(430, 120, 2), W(320, 120, 3), W(200, 110, 3)], 4)], '#8FD0F7', { spacing: 14, speed: 20, size: 1.5 });
  // wastewater: building -> lift station -> process tanks -> MBR skid -> holding/non-potable tank
  flows(H2O, [smooth([W(150, 120, 1), W(300, 130, -3), W(420, 150, -6), W(sys.liftStation[0], sys.liftStation[1], -8)], 4)], BROWN, { spacing: 14, speed: 14, size: 1.6 });
  flows(H2O, [smooth([W(sys.liftStation[0], sys.liftStation[1], -6), W(pt[0].c[0], pt[0].c[1], -8), W(pt[1].c[0], pt[1].c[1], -8), W(pt[2].c[0], pt[2].c[1], -8)], 3)], BROWN, { spacing: 10, speed: 12, size: 1.6 });
  flows(H2O, [smooth([W(pt[2].c[0], pt[2].c[1], -6), W(470, 120, -3), mbr], 3)], TEAL, { spacing: 8, speed: 12, size: 1.3 });
  flows(H2O, [smooth([mbr, W(470, 110, -3), W(npC[0], npC[1], -8)], 3)], '#A79BEA', { spacing: 8, speed: 12, size: 1.3 });
  // recycled water back in for flushing
  flows(H2O, [smooth([W(npC[0], npC[1], -6), W(480, 100, -2), W(330, 80, 3), W(180, 60, 3)], 4)], '#A79BEA', { spacing: 14, speed: 18, size: 1.5 });
  // to the leach fields
  const toLeach = smooth([W(npC[0], npC[1], -8), W(600, 40, -7), W(560, -150, -7), W(560, -300, -6), W(600, -400, -4)], 5);
  H2O.add(tube(toLeach, .9, std(PURPLE, { e: .25 }), 160));
  flows(H2O, [toLeach], '#A79BEA', { spacing: 26, speed: 26, size: 1.6 });
  // leach trenches (C510/C511): drain rock + perforated lateral
  const rock = std('#C9C3B6', { r: 1 }), lat = std(PURPLE, { e: .4 });
  const rockI = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 2.3, 2), rock, sys.trenches.length);
  const latI = new THREE.InstancedMesh(new THREE.CylinderGeometry(.45, .45, 1, 8), lat, sys.trenches.length);
  sys.trenches.forEach(([a, b], i) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    m4.compose(W(c[0], c[1], -2.85), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, 0)), new THREE.Vector3(L, 1, 1)); rockI.setMatrixAt(i, m4);
    m4.compose(W(c[0], c[1], -2.1), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, Math.PI / 2)), new THREE.Vector3(1, L, 1)); latI.setMatrixAt(i, m4);
  });
  [rockI, latI].forEach(m => { m.frustumCulled = false; H2O.add(m); });
  const lstop = LAYERS.water.stops.find(s => s.id === 'leach');
  const { u: lu, v: lv, c0: lc0 } = cutFrame(lstop.cut.c, lstop.cut.ang, lstop.cut.l, lstop.cut.w);
  const seeps = [];
  sys.trenches.forEach(([a, b]) => { for (let f = .1; f < 1; f += .12) { const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f; const s = (x - lc0[0]) * lu[0] + (y - lc0[1]) * lu[1], t = (x - lc0[0]) * lv[0] + (y - lc0[1]) * lv[1]; if (s > 0 && s < lstop.cut.l && t > 0 && t < lstop.cut.w) seeps.push([W(x, y, -2.4), W(x + .3, y, -4)]); } });
  flows(H2O, seeps, '#A79BEA', { spacing: 1, speed: .8, size: .35, glow: .8 });
  flows(H2O, sys.trenches.map(([a, b]) => [W(a[0], a[1], -2.1), W(b[0], b[1], -2.1)]), '#C2B8FF', { spacing: 25, speed: 10, size: .6 });
  const tr0 = sys.trenches.reduce((best, tr) => { const c = [(tr[0][0] + tr[1][0]) / 2, (tr[0][1] + tr[1][1]) / 2]; const d = Math.hypot(c[0] - lstop.cut.c[0], c[1] - lstop.cut.c[1]); return d < best.d ? { d, c } : best; }, { d: 1e9 }).c;
  callout(H2O, 'trench', W(tr0[0], tr0[1], -2));
  // rain + runoff to basins
  const rainN = MOBILE ? 220 : 520;
  const rg = new THREE.BufferGeometry(); const rp = new Float32Array(rainN * 6);
  const area = { x0: -250, x1: 900, y0: -600, y1: 300 };
  const drops = Array.from({ length: rainN }, () => ({ x: area.x0 + Math.random() * (area.x1 - area.x0), y: area.y0 + Math.random() * (area.y1 - area.y0), z: Math.random() * 380 }));
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#5AA9D6', transparent: true, opacity: .5 }));
  rain.frustumCulled = false; H2O.add(rain);
  let lastT = 0;
  const drawRain = dt => { drops.forEach((d, i) => { d.z -= dt * 260; if (d.z < 0) d.z += 380; const k = i * 6; rp[k] = d.x; rp[k + 1] = d.z; rp[k + 2] = -d.y; rp[k + 3] = d.x - 2; rp[k + 4] = d.z + 9; rp[k + 5] = -d.y; }); rg.attributes.position.needsUpdate = true; };
  drawRain(0);
  animators.push(t => { const dt = Math.min(.05, t - lastT); lastT = t; if (rain.visible && H2O.visible && !REDUCED) drawRain(dt); });
  const runoff = site.basins.map(b => { const c = centroid(b); const s = [Math.min(Math.max(c[0], 20), 560), Math.min(Math.max(c[1], -30), 210)]; return smooth([W(s[0], s[1], 30), W((s[0] + c[0]) / 2, (s[1] + c[1]) / 2, 4), W(c[0], c[1], 1.5)], 4); });
  flows(H2O, runoff, '#5AA9D6', { spacing: 26, speed: 24, size: 2 });
  const bmat = new THREE.MeshBasicMaterial({ color: '#4FC0E8', transparent: true, opacity: .45, depthWrite: false }); clipWithGround.push(bmat);
  site.basins.forEach(b => { const g = new THREE.ShapeGeometry(shapeFrom(b)); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, bmat); m.position.y = .7; H2O.add(m); });
  animators.push(t => { bmat.opacity = REDUCED ? .45 : .35 + .15 * Math.sin(t * 1.2); });
  H2O.userData.rain = rain;
}

// ---------- CARBON ----------
const C = groups.carbon;
{
  // roots on the walls of the prairie pit, and soil cores
  const rstop = LAYERS.carbon.stops.find(s => s.id === 'prairie');
  const { u, v, c0 } = cutFrame(rstop.cut.c, rstop.cut.ang, rstop.cut.l, rstop.cut.w);
  const L = rstop.cut.l, Wd = rstop.cut.w;
  const rootPos = []; const rnd = (a, b) => a + Math.random() * (b - a);
  const wallPts = [];
  for (let s = 1; s < L; s += 1.6) { wallPts.push([c0[0] + u[0] * s + v[0] * .25, c0[1] + u[1] * s + v[1] * .25, v]); wallPts.push([c0[0] + u[0] * s + v[0] * (Wd - .25), c0[1] + u[1] * s + v[1] * (Wd - .25), [-v[0], -v[1]]]); }
  for (let t = 1; t < Wd; t += 1.6) { wallPts.push([c0[0] + v[0] * t + u[0] * .25, c0[1] + v[1] * t + u[1] * .25, u]); wallPts.push([c0[0] + v[0] * t + u[0] * (L - .25), c0[1] + v[1] * t + u[1] * (L - .25), [-u[0], -u[1]]]); }
  wallPts.forEach(([x, y]) => {
    const depth = rnd(4, 13); let px = x, py = y, pz = hAt(x, y);
    const segs = 9; const t0 = [rnd(-1, 1), rnd(-1, 1)];
    for (let k = 0; k < segs; k++) { const nz = pz - depth / segs, nx = px + rnd(-.5, .5) * .6 + t0[0] * .08, ny = py + rnd(-.5, .5) * .6 + t0[1] * .08; rootPos.push(px, pz, -py, nx, nz, -ny); if (k > 2 && Math.random() < .35) { rootPos.push(nx, nz, -ny, nx + rnd(-1.5, 1.5), nz - rnd(.5, 2), -ny + rnd(-1.5, 1.5)); } px = nx; py = ny; pz = nz; }
  });
  const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.Float32BufferAttribute(rootPos, 3));
  const roots = new THREE.LineSegments(rgeo, new THREE.LineBasicMaterial({ color: '#E8D9A8' })); C.add(roots);
  // grass tufts on the pit rim
  const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(.6, 2.8, 5), std('#8F9B55'), wallPts.length); wallPts.forEach(([x, y], i) => { m4.makeTranslation(x, hAt(x, y) + 1.3, -y); tuft.setMatrixAt(i, m4); }); C.add(tuft);
  // carbon drifting into the prairie
  const dots = []; for (let i = 0; i < 26; i++) { const x = c0[0] + u[0] * rnd(0, L) + v[0] * rnd(0, Wd), y = c0[1] + u[1] * rnd(0, L) + v[1] * rnd(0, Wd); dots.push([W(x + 30, y + 30, 80), W(x, y, 1), W(x + .3, y, -8)]); }
  flows(C, dots.slice(0, 14), '#5C7F8F', { spacing: 22, speed: 6, size: .4, glow: .5 });
  callout(C, 'roots', W(c0[0] + v[0] * Wd + u[0] * L * .5, c0[1] + v[1] * Wd + u[1] * L * .5, -6));
  // soil cores standing on the pit floor
  for (let i = 0; i < 4; i++) { const s = L * (.25 + i * .17), t = Wd * .55; const x = c0[0] + u[0] * s + v[0] * t, y = c0[1] + u[1] * s + v[1] * t; const core = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 3.5, 12), std('#5A4128', { e: .1 })); core.position.copy(W(x, y, -14)); const tubeC = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, 3.6, 12, 1, true), std('#E3E7EA', { op: .35, dw: false, side: THREE.DoubleSide })); tubeC.position.copy(core.position); C.add(core, tubeC); if (!i) callout(C, 'cores', W(x, y, -11.5)); }
  P.rootsCore = [rstop.cut.c[0], rstop.cut.c[1], -10];
  // glulam/CLT callouts in carbon too
  // grazing paddock fences in the west pasture
  const fp = []; for (let i = 0; i < 4; i++) { const x = -420 + i * 110; fp.push(x, 2, 600, x, 2, 950); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  C.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: '#6B5A3E' })));
}

// ---------- hotspots per layer ----------
const hotspotEls = { energy: [], water: [], carbon: [] };
['energy', 'water', 'carbon'].forEach(k => LAYERS[k].stops.forEach((s, i) => { const p = at(s.at); if (s.cut) p.y = Math.max(p.y, 4); hotspotEls[k].push(marker(groups[k], p, i + 1, LAYERS[k].color, i)); }));

// ---------- state ----------
let layer = 'overview', stop = -1, xray = false, roofOff = false;
const HOME = { target: W(420, -110, -20), pos: W(1080, -1010, 520) };
const fly = { active: false };
function flyTo(target, pos, dur = 1.4) {
  fly.t0 = performance.now(); fly.dur = dur * 1000; fly.fromT = controls.target.clone(); fly.fromP = camera.position.clone(); fly.toT = target.clone(); fly.toP = pos.clone(); fly.active = !REDUCED;
  if (REDUCED) { controls.target.copy(target); camera.position.copy(pos); }
}
function viewFor(s) {
  const t = at(s.at); const v = s.view || { dist: 600, tilt: .9 };
  const az = (v.az ?? 230) * D2R, el = Math.max(.12, Math.min(1.4, v.tilt)) * .78;
  const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el));
  return { t, pos: t.clone().add(dir.multiplyScalar(v.dist)) };
}
function setXray(v) {
  xray = v; btnUnder.setAttribute('aria-pressed', v);
  groundMats.forEach(m => { m.opacity = v ? .4 : 1; m.depthWrite = !v; if (m.transparent !== v) { m.transparent = v; m.needsUpdate = true; } });
  controls.maxPolarAngle = v || CUT.on ? Math.PI * .62 : Math.PI * .49;
}
function setRoof(off) { roofOff = off; btnRoof.setAttribute('aria-pressed', off); roofParts.forEach(m => m.visible = !off); }
function setWood(on) { mats.body.color.copy(on ? woodColor : bodyColor); }
function resolveCut(c) { return c ? { c0: null, ...c, c: typeof c.c === 'string' ? P[c.c].slice(0, 2) : (c.c || c.c0) } : null; }
function setCuts(stopDef) {
  const tc = resolveCut(stopDef?.cut), bc = resolveCut(stopDef?.bcut);
  const same = (a, b) => a && b && a.c[0] === b.c[0] && a.c[1] === b.c[1] && a.l === b.l && a.w === b.w;
  if (tc) { const keep = CUT.on && same(CUT, tc); Object.assign(CUT, tc, { on: true, depth: tc.depth ?? (stopDef.id === 'wells' ? 330 : stopDef.id === 'tanks' ? 28 : stopDef.id === 'leach' ? 6 : 18) }); if (!keep) CUT.k = REDUCED ? 1 : 0; } else CUT.on = false;
  if (bc) { const keep = BCUT.on && same(BCUT, bc) && BCUT.z === bc.z; Object.assign(BCUT, bc, { on: true }); if (!keep) BCUT.k = REDUCED ? 1 : 0; } else BCUT.on = false;
  interior.visible = !!bc || roofOff;
  section.visible = !!bc && bc.ang === 0; mech.visible = !!bc && bc.ang !== 0 || roofOff;
  Object.entries(specimens).forEach(([k, sp]) => sp.g.visible = stopDef?.specimen === k);
  updateCut(); updateBcut();
}
function showCallouts(list) {
  const want = new Set(list || []);
  Object.entries(callouts).forEach(([id, arr]) => arr.forEach(o => { const vis = want.has(id) && o.parent && o.parent.visible !== false && isShown(o); o.visible = vis; o.element.style.display = vis ? '' : 'none'; }));
}
function isShown(o) { let p = o.parent; while (p) { if (p.visible === false) return false; p = p.parent; } return true; }

function setLayer(k, opts = {}) {
  layer = k; stop = -1;
  ['overview', 'energy', 'water', 'carbon'].forEach(n => { groups[n].visible = n === k; groups[n].traverse(o => { if (o.isCSS2DObject && !Object.values(callouts).some(a => a.includes(o))) { o.visible = n === k; o.element.style.display = n === k ? '' : 'none'; } }); });
  [...tabs.querySelectorAll('button')].forEach(b => b.setAttribute('aria-selected', b.dataset.layer === k));
  document.documentElement.style.setProperty('--layer', LAYERS[k].color || '#1B4633');
  setRoof(false); setWood(k === 'carbon'); setCuts(null); setXray(false); showCallouts([]);
  if (groups.water.userData.rain) groups.water.userData.rain.visible = true;
  renderPanel();
  if (!opts.noFly) flyTo(HOME.target, HOME.pos);
  if (!EMBED && !opts.noHash) history.replaceState(null, '', `#${k}`);
}
function selectStop(i) {
  const L = LAYERS[layer]; if (!L.stops[i]) return;
  stop = i; const s = L.stops[i];
  setRoof(s.roof === false);
  setCuts(s);
  setXray(!!s.xray);
  setWood(layer === 'carbon');
  if (groups.water.userData.rain) groups.water.userData.rain.visible = !['tanks', 'treat', 'leach'].includes(s.id);
  showCallouts(s.show);
  hotspotEls[layer].forEach((el, j) => el.classList.toggle('active', j === i));
  const v = viewFor(s); flyTo(v.t, v.pos);
  renderPanel();
  if (!EMBED) history.replaceState(null, '', `#${layer}/${i + 1}`);
}

// ---------- panel ----------
function renderPanel() {
  const L = LAYERS[layer];
  const stats = L.stats.length ? `<div class="stats">${L.stats.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}</div>${L.statNote ? `<p class="statnote">${L.statNote}</p>` : ''}` : '';
  let body = '';
  if (layer === 'overview') {
    body = `<div class="pick">${['energy', 'water', 'carbon'].map(k => `<button data-go="${k}" style="--c:${LAYERS[k].color}"><b>${LAYERS[k].label}</b><span>${LAYERS[k].stops.length} stops</span></button>`).join('')}</div>`;
  } else {
    body = `<ol class="stops">${L.stops.map((s, i) => `<li class="${i === stop ? 'open' : ''}"><button data-stop="${i}" aria-expanded="${i === stop}"><i>${i + 1}</i>${s.title}${s.cut || s.bcut ? '<em class="cut-tag">cutaway</em>' : ''}</button>${i === stop ? `<div class="detail"><p>${s.text}</p><div class="nav">${i > 0 ? `<button data-stop="${i - 1}">‹ Back</button>` : '<span></span>'}${i < L.stops.length - 1 ? `<button data-stop="${i + 1}" class="next">Next ›</button>` : `<button data-go="overview" class="next">All systems</button>`}</div></div>` : ''}</li>`).join('')}</ol>`;
  }
  panel.querySelector('.panel-body').innerHTML = `<div class="eyebrow">Theodore Roosevelt Presidential Library</div><h2>${L.title}</h2><p class="intro">${L.intro}</p>${stats}${body}<p class="note">${NOTE}</p>`;
  panel.querySelectorAll('[data-stop]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.stop; if (i === stop && b.closest('li') && !b.classList.contains('next')) { stop = -1; setCuts(null); setXray(false); showCallouts([]); renderPanel(); hotspotEls[layer].forEach(el => el.classList.remove('active')); return; } selectStop(i); }));
  panel.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => setLayer(b.dataset.go)));
  const open = panel.querySelector('li.open'); if (open) open.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
}

// ---------- controls ----------
tabs.innerHTML = ['overview', 'energy', 'water', 'carbon'].map(k => `<button role="tab" data-layer="${k}" style="--c:${LAYERS[k].color || '#1B4633'}">${LAYERS[k].label}</button>`).join('');
tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setLayer(b.dataset.layer)));
if (LOCK_LAYER) tabs.hidden = true;
btnUnder.addEventListener('click', () => setXray(!xray));
btnRoof.addEventListener('click', () => { setRoof(!roofOff); interior.visible = roofOff || BCUT.on; mech.visible = roofOff || (BCUT.on && BCUT.ang !== 0); });
btnReset.addEventListener('click', () => flyTo(HOME.target, HOME.pos));
panel.querySelector('.panel-toggle')?.addEventListener('click', () => panel.classList.toggle('collapsed'));

// ---------- resize / loop ----------
function resize() {
  const w = viewer.clientWidth, h = viewer.clientHeight;
  renderer.setSize(w, h, false); labelRenderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewer); resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime(), dt = Math.min(.05, t - (renderer._lt ?? t)); renderer._lt = t;
  if (fly.active) {
    const u = Math.min(1, (performance.now() - fly.t0) / fly.dur), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    controls.target.lerpVectors(fly.fromT, fly.toT, e); camera.position.lerpVectors(fly.fromP, fly.toP, e);
    if (u >= 1) fly.active = false;
  }
  if (CUT.on && CUT.k < 1) { CUT.k = Math.min(1, CUT.k + dt * .9); updateCut(); }
  if (BCUT.on && BCUT.k < 1) { BCUT.k = Math.min(1, BCUT.k + dt * 1.1); updateBcut(); }
  animators.forEach(f => f(t));
  controls.update();
  renderer.render(scene, camera); labelRenderer.render(scene, camera);
});

// ---------- start ----------
camera.position.copy(HOME.pos); controls.target.copy(HOME.target);
const fromHash = location.hash.slice(1).split('/');
const startLayer = qs.get('layer') || fromHash[0];
const startStop = +(qs.get('stop') || fromHash[1] || 0);
setLayer(LAYERS[startLayer] ? startLayer : 'overview', { noFly: true, noHash: true });
if (startStop && LAYERS[layer].stops[startStop - 1]) {
  selectStop(startStop - 1);
  if (qs.get('instant') === '1') { fly.active = false; const v = viewFor(LAYERS[layer].stops[startStop - 1]); controls.target.copy(v.t); camera.position.copy(v.pos); CUT.k = 1; BCUT.k = 1; updateCut(); updateBcut(); }
}
loading.classList.add('done');
window.__ready = true;
