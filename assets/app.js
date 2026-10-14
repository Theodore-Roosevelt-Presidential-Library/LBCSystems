import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYERS, PLACES, NOTE, CALLOUTS, LEGEND, LBC, PETALS } from './content.js';

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
const TOUCH = matchMedia('(pointer: coarse)').matches;
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
const controls = new OrbitControls(camera, renderer.domElement); // the label layer passes pointer events through to the canvas
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
P.roots = [60, -470, 0];
P.pasture = [-250, -800, 3];
P.valley = [600, -200, -40];
P.overlook = [site.overlook.c[0], site.overlook.c[1], 6];
P.trailhead = [site.trailhead[0], site.trailhead[1], 4];
P.loopW = (() => { const b = site.boardwalk; let m = b[0]; b.forEach(p => { if (p[0] < m[0]) m = p; }); return [m[0], m[1], 6]; })();
// anchors given relative to the ground (z = height above terrain)
const G = (x, y, dz) => [x, y, hAt(x, y) + dz];
Object.assign(P, { pv: G(pvC[0], pvC[1], 24), vault: G(sys.vault[0], sys.vault[1], -6), headerMid: G(...sys.header[Math.floor(sys.header.length / 2)], -6),
  road: G(1266, 86, 4), grid: G(1300, 120, 30), tanks: G(585, 175, -12), basin: G(bb[0], bb[1], 3), lawn: G(330, -620, 2), leach: G(612, -470, -3), roots: G(60, -470, -2),
  valley: G(600, -200, -20), overlook: G(site.overlook.c[0], site.overlook.c[1], 6), trailhead: G(site.trailhead[0], site.trailhead[1], 4), field: G(1010, -300, -150) });
P.loopW = G(P.loopW[0], P.loopW[1], 6);
const at = a => typeof a === 'string' ? W(...P[a]) : W(...a);

// ---------- strata material (cut faces, block sides) ----------
// Rock layers drawn after the Medora-area sequence in TRPL's geology explorer (geology.labs.trlibrary.com):
// gray-brown Sentinel Butte Formation on top, the red HT Butte clinker band, yellow-brown Bullion Creek below.
// Depths of the contacts at the Library are illustrative, not from site borings.
const SB_BASE = -52, CLK_BASE = -84;
const STRATA_GLSL = /* glsl */`
  float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }
  vec3 srgb(vec3 c){ return pow(c, vec3(2.2)); }
  vec3 rock(vec3 w){
    float y = w.y + 3.0*sin(w.x*.011 + w.z*.006) + 2.0*sin(w.z*.017 - w.x*.004);
    vec3 c; float k, f, r;
    if (y > ${SB_BASE.toFixed(1)}) {
      k = floor(y/6.5); f = fract(y/6.5); r = h1(k);
      c = mix(vec3(.67,.62,.56), vec3(.55,.51,.47), r);
      if (r > .8) c = vec3(.78,.73,.64);
      if (h1(k+3.7) > .62 && f > .84) c = vec3(.16,.14,.13);
    } else if (y > ${CLK_BASE.toFixed(1)}) {
      float n = h1(floor(w.x*.22)+floor(w.z*.22)*31.0+floor(w.y*.35)*7.0);
      c = mix(vec3(.80,.40,.24), vec3(.62,.25,.15), n);
      if (y < ${(CLK_BASE + 3).toFixed(1)}) c = vec3(.16,.13,.12);
    } else {
      k = floor(y/4.5); f = fract(y/4.5); r = h1(k);
      c = mix(vec3(.86,.72,.46), vec3(.74,.60,.38), r);
      if (r > .86) c = vec3(.69,.67,.61);
      if (h1(k+9.1) > .9 && f > .86) c = vec3(.2,.17,.14);
    }
    float g = h1(floor(w.x*.7) + floor(w.z*.7)*57.0 + floor(w.y*.9)*13.0);
    return c * (.93 + .09*g);
  }
  vec3 strata(vec3 w, float surf){
    float d = surf - w.y;
    if (d < 1.2) return srgb(vec3(.26,.20,.14));
    if (d < 5.0) return srgb(mix(vec3(.45,.36,.27), vec3(.58,.50,.40), smoothstep(1.2,5.0,d)));
    return srgb(rock(w));
  }`;
// same rock colors on the CPU for the exposed badland slopes
function rockColor(x, y, h, out) {
  const fr = n => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
  const wx = x, wz = -y, yy = h + 3 * Math.sin(wx * .011 + wz * .006) + 2 * Math.sin(wz * .017 - wx * .004);
  let c;
  if (yy > SB_BASE) { const k = Math.floor(yy / 6.5), f = yy / 6.5 - k, r = fr(k); c = [.67 + (.55 - .67) * r, .62 + (.51 - .62) * r, .56 + (.47 - .56) * r]; if (r > .8) c = [.78, .73, .64]; if (fr(k + 3.7) > .62 && f > .84) c = [.25, .22, .2]; }
  else if (yy > CLK_BASE) { const n = fr(Math.floor(wx * .05) + Math.floor(wz * .05) * 31); c = [.80 - .18 * n, .40 - .15 * n, .24 - .09 * n]; }
  else { const k = Math.floor(yy / 4.5), r = fr(k); c = [.86 - .12 * r, .72 - .12 * r, .46 - .08 * r]; if (r > .86) c = [.69, .67, .61]; }
  return out.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
}
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
  const ST = MOBILE ? 2 : 1, nx = Math.floor((TER.nx - 1) / ST) + 1, ny = Math.floor((TER.ny - 1) / ST) + 1, cell = TER.cell * ST;
  const TT = new Int16Array(nx * ny); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) TT[j * nx + i] = TH[j * ST * TER.nx + i * ST];
  const pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3);
  const c = new THREE.Color(), prairie = new THREE.Color('#B5B47F'), prairie2 = new THREE.Color('#A3A56E'), dry = new THREE.Color('#C9BD8E');
  const bands = ['#D8C9A0', '#B9B2A2', '#A7A39A', '#C7AE86', '#B86D4F', '#8E8778'].map(s => new THREE.Color(s));
  const green = new THREE.Color('#8D9A62'), juniper = new THREE.Color('#5E6B45'), rc = new THREE.Color();
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = X0 + i * cell, y = Y0 + j * cell, h = TT[k] * TER.scale;
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = -y;
    const hx = TT[j * nx + Math.min(i + 1, nx - 1)] - TT[j * nx + Math.max(i - 1, 0)], hy = TT[Math.min(j + 1, ny - 1) * nx + i] - TT[Math.max(j - 1, 0) * nx + i];
    const slope = Math.hypot(hx, hy) * TER.scale / (2 * cell);
    const n = hash(i * .37 | 0, j * .37 | 0) * .5 + hash(i, j) * .5;
    c.copy(prairie).lerp(prairie2, n).lerp(dry, Math.max(0, hash(i >> 3, j >> 3) - .6));
    if (slope > .2) c.lerp(rockColor(x, y, h, rc), Math.min(1, (slope - .2) * 3));
    if (h < -170 && slope < .2) c.lerp(green, .5);
    if (slope > .1 && slope < .5 && hash(i * 3.1, j * 1.7) > .93) c.lerp(juniper, .8);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  const idx = new Uint32Array((nx - 1) * (ny - 1) * 6); let q = 0;
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; idx[q++] = a; idx[q++] = b; idx[q++] = d; idx[q++] = b; idx[q++] = e; idx[q++] = d; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, withTrench(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, clipIntersection: true })));
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
const BERM = { poly: null };
const ROOFCUT = { off: false, planes: [new THREE.Plane(new THREE.Vector3(0, -1, 0), 15)] }; // dollhouse cut at 15 ft
function updateBcut() {
  if (BERM.mesh) BERM.mesh.visible = !!BCUT.on;
  const on = BCUT.on && BCUT.k > 0.001;
  bMats.forEach(m => { const want = on ? bPlanes : (ROOFCUT.off ? ROOFCUT.planes : null); if (m.clippingPlanes !== want) { m.clippingPlanes = want; m.needsUpdate = true; } });
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
        if (BERM.poly && inPoly(prev.x, prev.y, BERM.poly) && inPoly(cur.x, cur.y, BERM.poly)) {
          const a1 = prev.T - z, b1 = cur.T - z, a0 = Math.max(BCUT.z, hAt(prev.x, prev.y)), b0 = Math.max(BCUT.z, hAt(cur.x, cur.y));
          if (a1 > a0 && b1 > b0) { col.set('#9A7A55'); const q = [[prev.x, a1, prev.y], [prev.x, a0, prev.y], [cur.x, b1, cur.y], [cur.x, b0, cur.y]];
            [0, 1, 2, 2, 1, 3].forEach(k => { pos.push(q[k][0], q[k][1], -q[k][2]); colr.push(col.r, col.g, col.b); nor.push(nrm[0], 0, -nrm[1]); }); }
        }
      }
      prev = cur;
    }
  });
  // earth floor across the cut where it falls inside the berm
  if (BERM.poly && inPoly(BCUT.c[0], BCUT.c[1], BERM.poly)) {
    col.set('#8C6D4C'); const N = 24, z0 = BCUT.z + .05;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const P0 = (a, b) => [c0[0] + u[0] * l * a / N + v[0] * w * b / N, c0[1] + u[1] * l * a / N + v[1] * w * b / N];
      const q = [P0(i, j), P0(i + 1, j), P0(i + 1, j + 1), P0(i, j + 1)];
      const cc = P0(i + .5, j + .5); if (!inPoly(cc[0], cc[1], BERM.poly) || roofAt(...cc) - 4.2 < z0) continue;
      [0, 1, 2, 0, 2, 3].forEach(k => { pos.push(q[k][0], z0, -q[k][1]); colr.push(col.r, col.g, col.b); nor.push(0, 1, 0); });
    }
  }
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
const flowReg = [];
function flows(group, paths, key, { spacing = 30, speed = 34, size = 2.2, glow = 1, max = 60, stops = null, ov = true } = {}) {
  const color = LEGEND[key] ? LEGEND[key][1] : key;
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
  group.add(inst); flowReg.push({ inst, key, stops, ov, group }); return inst;
}
const smooth = (pts, n = 6) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .15).getSpacedPoints(Math.max(2, pts.length * n));


// ---------- shared time uniform ----------
const uTime = { value: 0 };
animators.push(t => { uTime.value = REDUCED ? 0 : t; });

// ---------- trenches: open the ground along a pipe route ----------
const TRENCH = { segs: { value: Array.from({ length: 48 }, () => new THREE.Vector4(1e6, 1e6, 1e6, 1e6)) }, n: { value: 0 }, hw: { value: 7 } };
function withTrench(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uTSeg = TRENCH.segs; sh.uniforms.uTN = TRENCH.n; sh.uniforms.uTHW = TRENCH.hw;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTw;\nuniform vec4 uTSeg[48];\nuniform int uTN;\nuniform float uTHW;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        for (int i = 0; i < 48; i++) { if (i >= uTN) break; vec2 a = uTSeg[i].xy, b = uTSeg[i].zw, pq = vTw.xz - a, ab = b - a;
          float h = clamp(dot(pq, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0); if (length(pq - ab * h) < uTHW) discard; }`);
  };
  mat.customProgramCacheKey = () => 'trench' + (mat.uuid);
  return mat;
}
const trenchMesh = new THREE.Mesh(new THREE.BufferGeometry(), capMat); trenchMesh.visible = false; trenchMesh.frustumCulled = false; groups.ground.add(trenchMesh);
const routes = {}; // name -> [[x,y],...] model coords (pipe routes that can be trenched)
function resample2(pts, step) { const out = [pts[0]]; let acc = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); acc += L; if (acc >= step || i === pts.length - 1) { out.push(b); acc = 0; } } return out; }
function setTrenches(names, depth = 11, hw = 9) {
  const lines = (names || []).map(n => routes[n]).filter(Boolean);
  TRENCH.hw.value = hw;
  const plen = l => l.reduce((a, p, i) => i ? a + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0, 0);
  const total = lines.reduce((a, l) => a + plen(l), 0);
  const segs = []; lines.forEach(l => { const step = Math.max(6, total / 44); const r = resample2(l, step); for (let i = 1; i < r.length; i++) segs.push([r[i - 1], r[i]]); });
  segs.slice(0, 48).forEach(([a, b], i) => TRENCH.segs.value[i].set(a[0], -a[1], b[0], -b[1]));
  TRENCH.n.value = Math.min(48, segs.length);
  trenchMesh.visible = segs.length > 0;
  if (!segs.length) return;
  // walls + floor along each line (offset left/right), strata on the faces
  const pos = [], nor = [], srf = [], idx = [];
  const strip = (pts, side) => {
    const base = pos.length / 3;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L * side, ny = dx / L * side, x = p[0] + nx * hw * .98, y = p[1] + ny * hw * .98, h = hAt(x, y);
      pos.push(x, h, -y, x, h - depth, -y); nor.push(-nx, 0, ny, -nx, 0, ny); srf.push(h, h);
      if (i) { const k = base + (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
    });
  };
  const floor = pts => {
    const base = pos.length / 3;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      [1, -1].forEach(sd => { const x = p[0] + nx * hw * sd, y = p[1] + ny * hw * sd, h = hAt(p[0], p[1]); pos.push(x, h - depth, -y); nor.push(0, 1, 0); srf.push(h); });
      if (i) { const k = base + (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
    });
  };
  lines.forEach(l => { const r = resample2(l, 4); strip(r, 1); strip(r, -1); floor(r); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('surf', new THREE.Float32BufferAttribute(srf, 1)); g.setIndex(idx);
  trenchMesh.geometry.dispose(); trenchMesh.geometry = g;
}

// ---------- flowing pipes: liquid / energy moving inside a see-through pipe ----------
function flowMaterial(color, { rep = 1, spd = 1, glow = 1.1, op } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(.5), emissive: color, emissiveIntensity: 1, roughness: .35, metalness: .05, transparent: op != null, opacity: op ?? 1 });
  m.userData.u = { uRep: { value: rep }, uSpd: { value: spd }, uGlow: { value: glow } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.u, { uTime });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float flowu;\nvarying float vFu;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFu = flowu;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFu;\nuniform float uRep, uSpd, uGlow, uTime;')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'float st = fract(vFu * uRep - uTime * uSpd); float pulse = smoothstep(0.35, 0.8, st) * (1.0 - smoothstep(0.86, 1.0, st));\nvec3 totalEmissiveRadiance = emissive * (0.4 + uGlow * pulse);');
  };
  m.customProgramCacheKey = () => 'flow';
  return m;
}
const glassMat = new THREE.MeshStandardMaterial({ color: '#E9F1F4', roughness: .1, metalness: .1, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide });
function pipe(group, pts, radius, key, { speed = 14, stops = null, shell = true, seg } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .1);
  const L = curve.getLength();
  const g = new THREE.TubeGeometry(curve, seg || Math.min(600, Math.max(24, Math.round(L / 3))), radius, 10, false);
  const uv = g.attributes.uv, fu = new Float32Array(uv.count); for (let i = 0; i < uv.count; i++) fu[i] = uv.getX(i); g.setAttribute('flowu', new THREE.BufferAttribute(fu, 1));
  const color = LEGEND[key] ? LEGEND[key][1] : key;
  const core = new THREE.Mesh(g, flowMaterial(color, { rep: L / 16, spd: speed / 16 }));
  group.add(core);
  if (shell) { const sh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(300, Math.max(16, Math.round(L / 6))), radius * 1.5, 10, false), glassMat); group.add(sh); }
  flowReg.push({ inst: core, key, stops, ov: false, group, phys: true });
  return core;
}
// a ray of energy (sunlight) — additive glowing beam with pulses moving along it
const rayMat = color => new THREE.ShaderMaterial({
  uniforms: { uTime, uC: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform float uTime; uniform vec3 uC; varying vec2 vUv; void main(){ float s = fract(vUv.y*5.0 + uTime*0.9); float p = smoothstep(0.6,0.95,s)*(1.0-smoothstep(0.95,1.0,s)); float a = (0.10 + 0.6*p) * smoothstep(0.0,0.03,vUv.y) * (1.0 - smoothstep(0.7,1.0,vUv.y)); gl_FragColor = vec4(uC*(0.6+0.8*p), a); }'
});
function ray(group, from, to, color, r0 = .7, r1 = 1.8) {
  const d = new THREE.Vector3().subVectors(to, from), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 10, 1, true), rayMat(color));
  m.position.copy(from).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize());
  group.add(m); return m;
}
// a point below the ground surface
const B = (x, y, d) => W(x, y, hAt(x, y) - d);

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
  ['pointerdown', 'mousedown', 'touchstart'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
  el.addEventListener('click', e => { e.stopPropagation(); selectStop(stopIdx); });
  const o = new CSS2DObject(el); o.position.copy(pos); group.add(o); return el;
}
function place(group, pos, text, main) {
  const el = document.createElement('div'); el.className = 'place' + (main ? ' main' : ''); el.textContent = text;
  const o = new CSS2DObject(el); o.position.copy(pos); group.add(o);
}

// ---------- site surface: paving, basins, boardwalk ----------
// a polygon laid onto the terrain (grid cells inside the outline, each corner at ground height)
function drapePoly(pts, mat, lift = .4, cell = 5) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pos = [];
  for (let x = x0; x < x1; x += cell) for (let y = y0; y < y1; y += cell) {
    if (!inPoly(x + cell / 2, y + cell / 2, pts)) continue;
    const q = [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]].map(([u, v]) => [u, hAt(u, v) + lift, -v]);
    [0, 2, 1, 0, 3, 2].forEach(k => pos.push(...q[k]));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
function flatPoly(pts, color, lift = 0.4, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, clipIntersection: true, side: THREE.DoubleSide });
  if (opts.ground !== false) { groundMats.push(mat); withTrench(mat); }
  if (opts.flat) { const geo = new THREE.ShapeGeometry(shapeFrom(pts)); geo.rotateX(-Math.PI / 2); const m = new THREE.Mesh(geo, mat); m.position.y = lift; m.receiveShadow = true; return m; }
  return drapePoly(pts, mat, lift);
}
{
  groups.site.add(flatPoly(lot, '#BDB7AC'));
  groups.site.add(flatPoly(site.parkingDropoff, '#BDB7AC'));
  site.basins.forEach(b => groups.site.add(flatPoly(b, '#7FAE9B', .45)));
  // road
  { const pts = new THREE.CatmullRomCurve3(site.chateauRoad.map(p => new THREE.Vector3(p[0], 0, p[1]))).getSpacedPoints(160).filter(p => p.x < X1 && p.z < Y1 && p.x > X0 && p.z > Y0);
    const pos = []; pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dy = b.z - a.z, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 12, ny = dx / L * 12;
      const l = [p.x + nx, p.z + ny], r = [p.x - nx, p.z - ny]; pos.push(l, r); });
    const v = []; for (let i = 1; i < pts.length; i++) { const [l0, r0] = [pos[(i - 1) * 2], pos[(i - 1) * 2 + 1]], [l1, r1] = [pos[i * 2], pos[i * 2 + 1]]; [l0, r0, l1, l1, r0, r1].forEach(q => v.push(q[0], hAt(q[0], q[1]) + .5, -q[1])); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    const rm = new THREE.MeshStandardMaterial({ color: '#A19E96', roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); groundMats.push(rm); withTrench(rm);
    const road = new THREE.Mesh(g, rm); road.receiveShadow = true; groups.site.add(road); }
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
bMats.push(mats.body);
const woodColor = new THREE.Color('#C98C4E'), bodyColor = new THREE.Color('#B9A386');
const roofParts = [];
{
  // Building and landscape from the CampusMap model, registered to the drawings' frame (tools/export.mjs)
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('assets/models/campus.glb');
  const M = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? .85, metalness: o.m ?? 0, side: THREE.DoubleSide, clipIntersection: true, transparent: !!o.op, opacity: o.op ?? 1 }); if (o.ground) { clipWithGround.push(m); withTrench(m); } else bMats.push(m); return m; };
  const CM = {
    plants: M('#7D8F52', { r: 1 }), roofEdge: M('#6E5A45'), walls: mats.body, glass: M('#9FB6C2', { r: .2, m: .4, op: .75 }),
    wood: M('#9B7651', { r: .8, ground: true }), path: M('#CFC6B3', { r: 1, ground: true }), people: M('#4E5257', { r: .9, ground: true }), rock: M('#A89B8C', { ground: true }), metal: M('#6F747A', { m: .4, r: .5, ground: true })
  };
  const pick = n => {
    if (/roof surface|^roof$|roof_path|plant/.test(n)) return CM.plants;
    if (/roof wall|north roof overlook/.test(n)) return CM.roofEdge;
    if (/window|windscreen.*panels|netting/.test(n)) return CM.glass;
    if (/building|retaining|stairs walls|base/.test(n)) return CM.walls;
    if (/boardwalk|bench|seat|dip backrest|railings-wood|picnic|windscreen/.test(n)) return CM.wood;
    if (/path|floor|parking|curve|pebbles|stairs/.test(n)) return CM.path;
    if (/people/.test(n)) return CM.people;
    if (/rock/.test(n)) return CM.rock;
    return null;
  };
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const n = (o.name + ' ' + (o.parent?.name || '')).toLowerCase().replace(/_/g, ' ').trim();
    const m = pick(n);
    if (m) o.material = m; else { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; o.material.clipIntersection = true; bMats.push(o.material); }
    if (/roof/.test(n)) roofParts.push(o);
    o.castShadow = true; o.receiveShadow = true;
  });
  groups.building.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  // roof plants are instanced meshes: anything instanced that sits up on the roof lifts with it
  gltf.scene.traverse(o => { if (!o.isInstancedMesh || roofParts.includes(o)) return; o.computeBoundingBox(); const b = o.boundingBox.clone().applyMatrix4(o.matrixWorld); const cx = (b.min.x + b.max.x) / 2, cy = -(b.min.z + b.max.z) / 2; if (b.max.y > 6 && roofAt(cx, cy) > 5) { roofParts.push(o); o.material.clipIntersection = true; if (!bMats.includes(o.material)) bMats.push(o.material); } });
  // also plain meshes named like plants
  gltf.scene.traverse(o => { if (o.isMesh && !roofParts.includes(o) && /plant/i.test(o.name + (o.parent?.name || ''))) roofParts.push(o); });
  // CampusMap keeps its ground flat; lay paths, the Boardwalk and people onto the real terrain
  const drape = [];
  gltf.scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !clipWithGround.includes(o.material)) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); if (b.min.y > 3 || b.max.y > 8) { if (!roofParts.includes(o)) roofParts.push(o); return; } drape.push(o); });
  gltf.scene.traverse(o => { if (!o.isInstancedMesh || roofParts.includes(o)) return; o.computeBoundingBox(); const b = o.boundingBox.clone().applyMatrix4(o.matrixWorld); if (b.min.y > 3) roofParts.push(o); });
  drape.forEach(o => {
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + hAt(x, -z) + .77); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, o.material); m.castShadow = o.castShadow; m.receiveShadow = true;
    o.parent.remove(o); groups.site.add(m);
  });
  footprints.forEach(fp => { const g = new THREE.ShapeGeometry(shapeFrom(fp)); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mats.floor); m.position.y = 0.25; m.receiveShadow = true; groups.building.add(m); });
}
// interior group: things you only see when the building is cut open
const interior = new THREE.Group(); groups.building.add(interior);

// ---- interior floor plan, shown when the roof is lifted (A201 First Floor Plan – Overall, registered to the model) ----
const planGroup = new THREE.Group(); planGroup.visible = false; groups.building.add(planGroup);
{
  const PB = { x0: -10, x1: 480, y0: -70, y1: 240 };
  const tex = new THREE.TextureLoader().load('assets/models/floorplan.jpg'); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const fm = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  footprints.forEach(fp => {
    const g = new THREE.ShapeGeometry(shapeFrom(fp)); const pa = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pa.count; i++) uv.setXY(i, (pa.getX(i) - PB.x0) / (PB.x1 - PB.x0), (pa.getY(i) - PB.y0) / (PB.y1 - PB.y0));
    g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, fm); m.position.y = .45; m.receiveShadow = true; planGroup.add(m);
  });
  fetch('assets/data/walls.json').then(r => r.json()).then(walls => {
    const geos = [];
    walls.forEach(([outer, holes]) => { const sh = shapeFrom(outer); holes.forEach(h => sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))))); const g = new THREE.ExtrudeGeometry(sh, { depth: 9, bevelEnabled: false }); g.rotateX(-Math.PI / 2); geos.push(g); });
    if (geos.length) { const wm = new THREE.Mesh(mergeGeometries(geos), std('#F3EEE3', { r: .85 })); wm.castShadow = true; wm.receiveShadow = true; planGroup.add(wm); }
  });
}

// ---- mechanical room E148 (layout from M301, schedules from M802) ----
const MR = sys.mechRoom, mrAng = MR.angle * D2R;
const mech = new THREE.Group(); interior.add(mech);
const eqPos = {};
{
  // room slab + low walls (dollhouse)
  const slab = flatPoly(MR.corners, '#C9C6BF', 0.5, { ground: false, flat: true }); slab.material.clipIntersection = false; mech.add(slab);
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
  flows(section, bpos.filter((_, i) => i % 3 === 0).map(([x, y, z]) => [W(x, y, z - .6), W(x + 2, y, Math.max(3, z - 12))]), 'coolAir', { stops: ['radiant'], ov: false, spacing: 4, speed: 4, size: .55, glow: .8 });
  // fresh-air duct along the gallery
  const duct = [W(150, 40, 0), W(150, 120, 0), W(150, 200, 0)];
  duct.forEach(p => { p.y = Math.max(14, roofAt(p.x, -p.z) - 4.2); });
  const dm = std('#D7DBDE', { r: .4, m: .5 }); dm.clipIntersection = true; bMats.push(dm); section.add(tube(duct, 1.6, dm, 40));
  flows(section, [duct], 'freshAir', { stops: ['radiant'], ov: false, spacing: 12, speed: 18, size: .8, glow: .5 });
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
  // Roof build-up (Metropolis; Buildings.com; DD energy report): plants + 15 in of soil, membrane, R-70 insulation,
  // 3 in concrete topping, 7-layer CLT, glulam beams about 4 ft deep — about 8 ft in all. Drawn exploded, true thicknesses.
  const g = new THREE.Group(); const base = [95, 55, 12], S = 24;
  const put = (mesh, z) => { mesh.position.copy(W(base[0], base[1], z)); g.add(mesh); return mesh; };
  let z = 0; const gap = 2.2; const lab = {};
  [-7, 7].forEach(o => { const b = new THREE.Mesh(new THREE.BoxGeometry(S, 4, 1.4), std('#C98846', { r: .6 })); b.position.copy(W(base[0], base[1] + o, base[2] + z + 2)); g.add(b); });
  lab.glulam = [base[0] + S / 2, base[1] - 7, base[2] + z + 2]; z += 4 + gap;
  for (let k = 0; k < 7; k++) { const ply = new THREE.Mesh(new THREE.BoxGeometry(S, .11, S), std(k % 2 ? '#E2B57A' : '#D19C5C', { r: .7 })); ply.rotation.y = k % 2 ? 0 : 0; put(ply, base[2] + z + .06 + k * .115); }
  lab.clt = [base[0] + S / 2, base[1] - S / 2, base[2] + z + .4]; z += .8 + gap * .6;
  put(new THREE.Mesh(new THREE.BoxGeometry(S, .25, S), std('#B3B0A9')), base[2] + z + .12); lab.topping = [base[0] - S / 2, base[1] + S / 2, base[2] + z + .12]; z += .25 + gap;
  put(new THREE.Mesh(new THREE.BoxGeometry(S, 1.2, S), std('#EEE1A6', { r: .9 })), base[2] + z + .6);
  lab.insul = [base[0] + S / 2, base[1] - S / 2, base[2] + z + .6]; z += 1.2 + gap * .6;
  put(new THREE.Mesh(new THREE.BoxGeometry(S, .15, S), std('#2D2A27')), base[2] + z + .07); z += .15 + gap * .6;
  put(new THREE.Mesh(new THREE.BoxGeometry(S, 1.25, S), std('#5B4330', { r: 1 })), base[2] + z + .62); lab.soil = [base[0] - S / 2, base[1] + S / 2, base[2] + z + .62]; z += 1.25;
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(.45, 2.2, 5), std('#7E9A4A'), 140);
  for (let i = 0; i < 140; i++) { m4.makeTranslation(base[0] + (Math.random() - .5) * (S - 1), base[2] + z + 1, -(base[1] + (Math.random() - .5) * (S - 1))); tufts.setMatrixAt(i, m4); }
  g.add(tufts); lab.roofLayers = [base[0] + S / 2, base[1] - S / 2, base[2] + z + 1.5];
  g.visible = false; interior.add(g); specimens.roof = { g, lab };
}
{
  const g = new THREE.Group(); const base = [205, 62, 9], S = 26;
  const conc = new THREE.Mesh(new THREE.BoxGeometry(S, 1.6, S), std('#C8C4BC', { op: .55, dw: false, r: .9 }));
  conc.position.copy(W(base[0], base[1], base[2] + .8)); g.add(conc);
  const xps = new THREE.Mesh(new THREE.BoxGeometry(S, .6, S), std('#9CC3D9', { r: .9 })); xps.position.copy(W(base[0], base[1], base[2] - .5)); g.add(xps);
  const pts = []; for (let k = 0; k < 9; k++) { const y = base[1] - S / 2 + 1.2 + k * (S - 2.4) / 8; const a = W(base[0] - S / 2 + 1, y, base[2] + .7), b = W(base[0] + S / 2 - 1, y, base[2] + .7); if (k % 2) pts.push(b, a); else pts.push(a, b); }
  const tg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .05), 200, .32, 6), std('#F07F3C', { e: .6 })); g.add(tg);
  flows(g, [pts], 'heatingWater', { stops: ['radiant'], ov: false, spacing: 3, speed: 5, size: .38 });
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
    const gz = hAt(...centroid(poly)); const m = new THREE.Mesh(geo, panelMat); m.position.y = gz + h; m.castShadow = true; groups.site.add(m);
    if (!small) {
      // posts along the long axis
      const c = centroid(poly); let far = poly[0]; poly.forEach(p => { if (Math.hypot(p[0] - c[0], p[1] - c[1]) > Math.hypot(far[0] - c[0], far[1] - c[1])) far = p; });
      const ax = [far[0] - c[0], far[1] - c[1]], L = Math.hypot(...ax), a = [ax[0] / L, ax[1] / L];
      const n = Math.max(2, Math.round(L / 24));
      for (let k = -n; k <= n; k++) {
        const px = c[0] + a[0] * k * (L * .85 / n), py = c[1] + a[1] * k * (L * .85 / n);
        if (!inPoly(px, py, poly)) continue;
        const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), timber); post.position.copy(W(px, py, gz + h / 2)); post.castShadow = true; groups.site.add(post);
      }
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(L * 1.8, 1.4, 1.4), timber); ridge.position.copy(W(c[0], c[1], gz + h - .7)); ridge.rotation.y = Math.atan2(a[1], a[0]); groups.site.add(ridge);
    }
  });
  callout(E, 'pv', W(pvC[0], pvC[1], hAt(...pvC) + 30));
  // sunlight onto the panels: glowing rays
  const rays = new THREE.Group(); E.add(rays);
  site.pv.slice().sort((a, b) => polyArea(b) - polyArea(a)).slice(0, 6).forEach(poly => {
    const c = centroid(poly), gz = hAt(...c);
    for (let j = 0; j < 3; j++) { const dx = (j - 1) * 18, dy = (j - 1) * -8; ray(rays, W(c[0] - 260 + dx, c[1] + 150 + dy, gz + 430), W(c[0] + dx * .4, c[1] + dy * .4, gz + 16), '#FFC94D'); }
  });
  flowReg.push({ inst: rays, key: 'sun', stops: ['solar', 'goal'], ov: true, group: E });
  // power from the canopies to the building, in a buried conduit
  routes.solarFeed = [[pvC[0], pvC[1]], [pvC[0] - 150, pvC[1] + 110], [600, 40], [500, 70], [455, 80]];
  pipe(E, smooth(routes.solarFeed.map(([x, y]) => B(x, y, 4)), 6), 1.8, 'solar', { speed: 40, stops: ['solar', 'goal'] });

  // ---- geothermal wells (M001: 216 boreholes, 300 ft) ----
  const DEPTH = sys.wellDepth;
  const n = allWells.length;
  const grout = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.4, 2.4, DEPTH, 10, 1, true), std('#8C8B86', { op: .32, dw: false, side: THREE.DoubleSide }), n);
  const pipeG = new THREE.CylinderGeometry(.8, .8, DEPTH, 6, 1, false);
  { const uv = pipeG.attributes.uv, fu = new Float32Array(uv.count); for (let i = 0; i < uv.count; i++) fu[i] = uv.getY(i); pipeG.setAttribute('flowu', new THREE.BufferAttribute(fu, 1)); }
  const down = new THREE.InstancedMesh(pipeG, flowMaterial(LEGEND.loopOut[1], { rep: DEPTH / 18, spd: -1.2 }), n);
  const up = new THREE.InstancedMesh(pipeG, flowMaterial(LEGEND.loopBack[1], { rep: DEPTH / 18, spd: 1.2 }), n);
  const bend = new THREE.InstancedMesh(new THREE.TorusGeometry(1.1, .8, 6, 12, Math.PI), std('#C98A6E', { e: .2 }), n);
  const q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  allWells.forEach(([x, y], i) => {
    const top = hAt(x, y) - 5, mid = top - DEPTH / 2;
    m4.makeTranslation(x, mid, -y); grout.setMatrixAt(i, m4);
    m4.makeTranslation(x - 1.1, mid, -y); down.setMatrixAt(i, m4);
    m4.makeTranslation(x + 1.1, mid, -y); up.setMatrixAt(i, m4);
    q.setFromEuler(new THREE.Euler(0, 0, Math.PI)); m4.compose(new THREE.Vector3(x, top - DEPTH, -y), q, s1); bend.setMatrixAt(i, m4);
  });
  [grout, down, up, bend].forEach(m => { m.frustumCulled = false; E.add(m); });
  flowReg.push({ inst: down, key: 'loopOut', stops: ['wells'], phys: true }, { inst: up, key: 'loopBack', stops: ['wells'], phys: true });
  const pitStop = LAYERS.energy.stops.find(s => s.id === 'wells');
  const { u: pu, v: pv, c0: pc0 } = cutFrame(pitStop.cut.c, pitStop.cut.ang, pitStop.cut.l, pitStop.cut.w, pitStop.cut.c0);
  const inPit = ([x, y]) => { const s = (x - pc0[0]) * pu[0] + (y - pc0[1]) * pu[1], t = (x - pc0[0]) * pv[0] + (y - pc0[1]) * pv[1]; return s > 0 && s < pitStop.cut.l && t > 0 && t < pitStop.cut.w; };
  const pitWells = allWells.filter(inPit);
  // depth ruler on the pit's corner
  const rc = [pc0[0] + pu[0] * 3 + pv[0] * 3, pc0[1] + pu[1] * 3 + pv[1] * 3], g0 = hAt(...rc);
  [100, 200].forEach(d => { const el = document.createElement('div'); el.className = 'ruler'; el.textContent = `${d} ft`; const o = new CSS2DObject(el); o.position.copy(W(rc[0], rc[1], g0 - d)); E.add(o); (callouts.depth ||= []).push(o); o.visible = false; el.style.display = 'none'; });
  callout(E, 'depth', W(rc[0], rc[1], g0 - DEPTH - 5));
  const fp = d => [pc0[0] + pu[0] * d + pv[0], pc0[1] + pu[1] * d + pv[1]];
  callout(E, 'sb', W(...fp(330), -28)); callout(E, 'clk', W(...fp(400), (SB_BASE + CLK_BASE) / 2)); callout(E, 'bc', W(...fp(330), -190));
  if (pitWells.length) { const w0 = pitWells.reduce((a, b) => Math.hypot(b[0] - rc[0], b[1] - rc[1]) < Math.hypot(a[0] - rc[0], a[1] - rc[1]) ? b : a); callout(E, 'loop', W(w0[0] + 1, w0[1], hAt(...w0) - 60)); }

  // ---- circuits: rows of wells -> vault (M001) ----
  const vault = sys.vault;
  sys.wellRows.forEach(row => {
    const a = row[0], b = row[row.length - 1];
    const near = Math.hypot(a[0] - vault[0], a[1] - vault[1]) < Math.hypot(b[0] - vault[0], b[1] - vault[1]) ? row.slice() : row.slice().reverse();
    const pts = [B(vault[0], vault[1], 6), B((vault[0] + near[0][0]) / 2, (vault[1] + near[0][1]) / 2, 6), ...near.map(p => B(p[0], p[1], 5))];
    pipe(E, smooth(pts, 4), .9, 'loopBack', { speed: 10, stops: ['circuits'], shell: false });
  });
  const vbox = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 12), std('#8F969C', { r: .6 })); vbox.position.copy(B(vault[0], vault[1], 6)); vbox.rotation.y = 108 * D2R; E.add(vbox);
  callout(E, 'vault', W(vault[0], vault[1], hAt(...vault) + 4));

  // ---- the mains: vault -> mechanical room (two 6" pipes) ----
  const hd = sys.header.map(p => [p[0], p[1]]);
  routes.header = hd;
  const off = (pts, o) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [p[0] - dy / L * o, p[1] + dx / L * o]; });
  const entry = [MR.corners[0][0] - 6, MR.corners[0][1] - 4];
  const sIn = [...off(hd, 3).reverse().map(p => B(p[0], p[1], 6)), B(entry[0], entry[1], 6), W(entry[0], entry[1], 2)];
  const rOut = [W(entry[0] + 3, entry[1] - 2, 2), B(entry[0] + 3, entry[1] - 2, 6), ...off(hd, -3).map(p => B(p[0], p[1], 6))];
  pipe(E, sIn, 2.2, 'loopBack', { speed: 22, stops: ['circuits', 'header', 'plant'] });
  pipe(E, rOut, 2.2, 'loopOut', { speed: 22, stops: ['circuits', 'header', 'plant'] });
  callout(E, 'mains', B(...P.headerMid.slice(0, 2), -3));
  // plant -> manifold -> heat pumps and chiller
  const hp = MR.equipment.filter(e => e.kind === 'hp' && e.tag.startsWith('WWHP')).map(e => W(e.at[0], e.at[1], 3));
  pipe(E, [W(entry[0], entry[1], 3), ...hp, eqPos['CH-1'].clone().setY(3)], .7, 'loopBack', { speed: 8, stops: ['plant'], shell: false });
  // tunnel to the west building, with warm and chilled water lines inside
  const tun = tube(tunnelPts, 4.5, std('#BDB6A8', { op: .4, dw: false, side: THREE.DoubleSide }), 40); E.add(tun);
  pipe(E, tunnelPts.map(p => p.clone().add(new THREE.Vector3(0, -1, 1.6))), .8, 'heatingWater', { speed: 14, stops: ['radiant', 'plant'], shell: false });
  pipe(E, tunnelPts.slice().reverse().map(p => p.clone().add(new THREE.Vector3(0, -1, -1.6))), .8, 'coolingWater', { speed: 14, stops: ['radiant', 'plant'], shell: false });
  // grid line from the road, power pulsing along the wire
  const gp = site.chateauRoad.filter(p => p[0] < X1 - 20 && p[1] < Y1 - 20).slice(0, 3).map(p => W(p[0], p[1], hAt(p[0], p[1]) + 32));
  gp.push(W(lotC[0] + 60, lotC[1] + 40, hAt(lotC[0] + 60, lotC[1] + 40) + 26), W(470, 60, 22));
  pipe(E, gp, .9, 'grid', { speed: 60, stops: ['goal'], shell: false });
  gp.slice(0, 4).forEach(p => { const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 34), std('#7a5d3e')); pole.position.set(p.x, p.y - 16, p.z); E.add(pole); });
}
// equipment callouts (shared by energy & water)
['WWHP-2', 'CH-1', 'HPLP-1', 'DWH-1', 'B-1', 'AHU-1'].forEach(t => eqPos[t] && callout(E, t, eqPos[t], { left: ['HPLP-1', 'B-1', 'AHU-1'].includes(t) }));
callout(E, 'beam', W(...P.beamC.slice(0, 2), P.beamC[2] - 1));
callout(E, 'air', W(...P.duct));

['roof', 'slab'].forEach(k => Object.entries(specimens[k].lab).forEach(([id, p]) => { callout(E, id, W(...p), { left: ['topping', 'soil'].includes(id) }); callout(groups.carbon, id, W(...p), { left: ['topping', 'soil'].includes(id) }); }));

// ---------- WATER ----------
const H2O = groups.water;
const PURPLE = '#7C6FD0', BLUE = '#3B9BD6';
{
  // process tanks (C510) + approximate drinking-water and fire/recycled tanks in the same berm
  const pt = sys.processTanks.map(([a, b]) => ({ a, b, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }));
  const axis = (() => { const d = [pt[0].b[0] - pt[0].a[0], pt[0].b[1] - pt[0].a[1]]; const L = Math.hypot(...d); return [d[0] / L, d[1] / L]; })();
  const step = [pt[1].c[0] - pt[0].c[0], pt[1].c[1] - pt[0].c[1]];
  const capsule = (c, r, len, color, z, ax = axis) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 24), std(color, { r: .45, e: .15 })); m.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(m); g.position.copy(W(c[0], c[1], z)); g.rotation.y = Math.atan2(ax[1], ax[0]); g.traverse(o => o.castShadow = true); H2O.add(g); return g; };
  // three 20,000-gallon FRP process tanks (C510, C516): buried with their tops at least 3 ft below grade
  pt.forEach(t => { const g0 = Math.min(hAt(...t.a), hAt(...t.b), hAt(...t.c), -2); t.z = g0 - 5 - 3; capsule(t.c, 5, Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1]) - 10, '#B79A6B', t.z); });
  // storage tanks in the east berm (M001A): NPT-1 40,000 gal non-potable, DWT-1 15,000 gal domestic; top of tank +14 ft
  const ST = sys.storageTanks, tr = ST.dia / 2, TZ = ST.top - tr;
  const tankOf = ([a, b]) => ({ c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L: Math.hypot(b[0] - a[0], b[1] - a[1]), ax: [(b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]), (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1])] });
  const NPT = tankOf(ST.npt), DWT = tankOf(ST.dwt);
  const potC = DWT.c, npC = NPT.c;
  capsule(potC, tr, DWT.L - 2 * tr, BLUE, TZ, DWT.ax);
  capsule(npC, tr, NPT.L - 2 * tr, PURPLE, TZ, NPT.ax);
  P.tanks = [(potC[0] + npC[0]) / 2, (potC[1] + npC[1]) / 2, TZ];
  // the east berm: earth piled against the east building, under the sloping prairie roof
  {
    const poly = sys.berm, cell = 3, top = (x, y) => Math.max(hAt(x, y) + .5, roofAt(x, y) - 4.2);
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const pos = [], srf = [];
    for (let x = Math.min(...xs); x < Math.max(...xs); x += cell) for (let y = Math.min(...ys); y < Math.max(...ys); y += cell) {
      if (!inPoly(x + cell / 2, y + cell / 2, poly) || roofAt(x + cell / 2, y + cell / 2) < 1) continue;
      const q = [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]].map(([u, v]) => [u, top(u, v), -v]);
      [0, 2, 1, 0, 3, 2].forEach(k => { pos.push(...q[k]); srf.push(q[k][1]); });
      // sides where the neighbor is outside
      [[0, -1, 0, 1], [1, 0, 1, 2], [0, 1, 2, 3], [-1, 0, 3, 0]].forEach(([dx, dy, i0, i1]) => {
        const nx = x + cell / 2 + dx * cell, ny = y + cell / 2 + dy * cell;
        if (inPoly(nx, ny, poly) && roofAt(nx, ny) >= 1) return;
        const A = q[i0], Bq = q[i1], ga = hAt(A[0], -A[2]), gb = hAt(Bq[0], -Bq[2]);
        const quad = [A, Bq, [Bq[0], gb, Bq[2]], [A[0], ga, A[2]]];
        [0, 1, 2, 0, 2, 3].forEach(k => { pos.push(...quad[k]); srf.push(Math.max(A[1], Bq[1])); });
      });
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('surf', new THREE.Float32BufferAttribute(srf, 1)); g.computeVertexNormals();
    const bm = strataMaterial({ clipIntersection: true }); bMats.push(bm);
    const berm = new THREE.Mesh(g, bm); berm.receiveShadow = true; groups.building.add(berm);
    BERM.poly = poly; BERM.mesh = berm; berm.visible = false; // only drawn inside a building cutaway
  }
  const lift = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 16, 18), std('#8E8A82')); lift.position.copy(W(sys.liftStation[0], sys.liftStation[1], Math.min(hAt(...sys.liftStation), -2) - 9)); H2O.add(lift);
  callout(H2O, 'proc', W(pt[1].c[0], pt[1].c[1], pt[1].z + 6));
  callout(H2O, 'potable', W(potC[0], potC[1], ST.top + 1));
  callout(H2O, 'np', W(npC[0], npC[1], ST.top + 1), { left: true });
  callout(H2O, 'lift', W(sys.liftStation[0], sys.liftStation[1], Math.min(hAt(...sys.liftStation), -2) - 1));
  ['MBR', 'BREAK'].forEach(t => eqPos[t] && callout(H2O, t, eqPos[t]));
  const mbr = eqPos.MBR ? eqPos.MBR.clone().setY(3) : W(420, 90, 3);
  const bldg = (x, y) => W(x, y, 3);
  // drinking water: road -> drinking-water tank -> building
  const rd = site.chateauRoad.filter(p => p[0] < X1 - 20 && p[1] < Y1 - 20).slice(0, 3).reverse().map(p => [p[0], p[1]]);
  routes.supply = [...rd, [900, 60], [700, 150], potC];
  pipe(H2O, smooth(routes.supply.map(([x, y]) => B(x, y, 7)), 5), 2, 'drinking', { speed: 20, stops: ['pipeline', 'tanks'] });
  pipe(H2O, smooth([W(potC[0], potC[1], TZ), B(500, 140, 5), B(455, 125, 5), bldg(430, 115), bldg(320, 120), bldg(200, 110)], 4), .9, 'drinking', { speed: 14, stops: ['pipeline', 'reuse'], shell: false });
  // wastewater: building -> lift station -> process tanks -> MBR skid -> recycled-water tank
  pipe(H2O, smooth([bldg(150, 125), bldg(300, 135), B(420, 150, 6), B(sys.liftStation[0], sys.liftStation[1], 8)], 4), 1, 'waste', { speed: 10, stops: ['tanks', 'process', 'treat', 'reuse'], shell: false });
  pipe(H2O, smooth([B(sys.liftStation[0], sys.liftStation[1], 7), ...pt.map(t => B(t.c[0], t.c[1], 6))], 3), .9, 'waste', { speed: 8, stops: ['tanks', 'process', 'treat'], shell: false });
  pipe(H2O, smooth([B(pt[2].c[0], pt[2].c[1], 6), B(470, 120, 4), mbr], 3), .8, 'waste', { speed: 8, stops: ['treat', 'process'], shell: false });
  pipe(H2O, smooth([mbr.clone().setY(4), B(470, 110, 4), W(npC[0], npC[1], TZ)], 3), .8, 'treated', { speed: 8, stops: ['treat', 'tanks', 'process'], shell: false });
  // recycled water back in for flushing
  routes.recycled = [npC, [520, 120], [480, 100], [440, 92]];
  pipe(H2O, smooth([...routes.recycled.map(([x, y]) => B(x, y, 6)), bldg(420, 90), bldg(330, 80), bldg(180, 60)], 4), 1.8, 'treated', { speed: 14, stops: ['reuse'] });
  // to the leach fields
  routes.leachFeed = [npC, [600, 40], [560, -150], [560, -300], [600, -400]];
  pipe(H2O, smooth(routes.leachFeed.map(([x, y]) => B(x, y, 7)), 5), 1.8, 'treated', { speed: 18, stops: ['leach', 'tanks'] });
  // leach trenches (C510/C511): drain rock + perforated lateral with water moving through it
  const rock = std('#C9C3B6', { r: 1 });
  const latG = new THREE.CylinderGeometry(.5, .5, 1, 8); { const uv = latG.attributes.uv, fu = new Float32Array(uv.count); for (let i = 0; i < uv.count; i++) fu[i] = uv.getY(i); latG.setAttribute('flowu', new THREE.BufferAttribute(fu, 1)); }
  const rockI = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 2.3, 2), rock, sys.trenches.length);
  const latI = new THREE.InstancedMesh(latG, flowMaterial(LEGEND.treated[1], { rep: 7, spd: .5 }), sys.trenches.length);
  sys.trenches.forEach(([a, b], i) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), g = hAt(...c);
    m4.compose(W(c[0], c[1], g - 2.85), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, 0)), new THREE.Vector3(L, 1, 1)); rockI.setMatrixAt(i, m4);
    m4.compose(W(c[0], c[1], g - 2.1), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, Math.PI / 2)), new THREE.Vector3(1, L, 1)); latI.setMatrixAt(i, m4);
  });
  [rockI, latI].forEach(m => { m.frustumCulled = false; H2O.add(m); });
  const lstop = LAYERS.water.stops.find(s => s.id === 'leach');
  const { u: lu, v: lv, c0: lc0 } = cutFrame(lstop.cut.c, lstop.cut.ang, lstop.cut.l, lstop.cut.w);
  const seeps = [];
  sys.trenches.forEach(([a, b]) => { for (let f = .1; f < 1; f += .12) { const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, g = hAt(x, y); const s = (x - lc0[0]) * lu[0] + (y - lc0[1]) * lu[1], t = (x - lc0[0]) * lv[0] + (y - lc0[1]) * lv[1]; if (s > 0 && s < lstop.cut.l && t > 0 && t < lstop.cut.w) seeps.push([W(x, y, g - 2.4), W(x + .3, y, g - 4)]); } });
  flows(H2O, seeps, 'soak', { stops: ['leach'], ov: false, spacing: 1, speed: .8, size: .35, glow: .8 });
  const tr0 = sys.trenches.reduce((best, tr) => { const c = [(tr[0][0] + tr[1][0]) / 2, (tr[0][1] + tr[1][1]) / 2]; const d = Math.hypot(c[0] - lstop.cut.c[0], c[1] - lstop.cut.c[1]); return d < best.d ? { d, c } : best; }, { d: 1e9 }).c;
  callout(H2O, 'trench', B(tr0[0], tr0[1], 2));

  // ---- rain: falls on the prairie roof; extra drains out at the foot of the building to the basins ----
  const rainN = MOBILE ? 260 : 700;
  const area = { x0: -60, x1: 620, y0: -420, y1: 260 };
  const drops = Array.from({ length: rainN }, () => ({ x: area.x0 + Math.random() * (area.x1 - area.x0), y: area.y0 + Math.random() * (area.y1 - area.y0), z: Math.random() * 300 }));
  drops.forEach(d => { const r = roofAt(d.x, d.y); d.floor = r > 5 ? r : hAt(d.x, d.y); });
  const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(.35, 8, .35), new THREE.MeshBasicMaterial({ color: '#3E8FD0', transparent: true, opacity: .85 }), rainN);
  rain.frustumCulled = false; H2O.add(rain);
  let lastT = 0;
  const drawRain = dt => { drops.forEach((d, i) => { d.z -= dt * 160; if (d.z < 0) d.z += 300; m4.makeTranslation(d.x, d.floor + d.z + 3.5, -d.y); rain.setMatrixAt(i, m4); }); rain.instanceMatrix.needsUpdate = true; };
  drawRain(0);
  animators.push(t => { const dt = Math.min(.05, t - lastT); lastT = t; if (rain.visible && H2O.visible && !REDUCED) drawRain(dt); });
  // water soaking into the roof soil
  const roofSoak = []; for (let k = 0; k < 90; k++) { const x = 20 + Math.random() * 520, y = -20 + Math.random() * 230, r = roofAt(x, y); if (r > 10) roofSoak.push([W(x, y, r + .5), W(x, y, r - 1.2)]); }
  flows(H2O, roofSoak, 'rain', { stops: ['roof'], ov: false, spacing: .6, speed: .5, size: .45 });
  // roof drain pipes: from the roof edge down to an outlet at the foot of the wall, then over the ground to a basin
  const fpts = footprints[0];
  const nearestOnFP = (x, y) => { let best = null; for (let i = 0; i < fpts.length; i++) { const a = fpts[i], b = fpts[(i + 1) % fpts.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)); const px = a[0] + dx * t, py = a[1] + dy * t, d = Math.hypot(px - x, py - y); if (!best || d < best.d) best = { d, p: [px, py] }; } return best.p; };
  const runoff = [];
  site.basins.forEach(b => {
    const c = centroid(b); if (Math.hypot(c[0] - 280, c[1] - 90) > 520) return;
    const e = nearestOnFP(...c), v = [c[0] - e[0], c[1] - e[1]], L = Math.hypot(...v) || 1, u = [v[0] / L, v[1] / L];
    const inn = [e[0] - u[0] * 6, e[1] - u[1] * 6], out = [e[0] + u[0] * 5, e[1] + u[1] * 5];
    const top = Math.max(roofAt(...inn), 12);
    pipe(H2O, [W(...inn, top - 2), W(...inn, 2), B(...out, 1.5), W(...out, hAt(...out) + .3)], 1.5, 'rain', { speed: 10, stops: ['roof', 'basins'], seg: 30 }); if (!P.roofdrain) { P.roofdrain = [...e, Math.max(roofAt(...inn), 12) * .5]; P.roofdrainAz = Math.atan2(u[1], u[0]) / D2R; }
    runoff.push(smooth([W(...out, hAt(...out) + .6), W((out[0] + c[0]) / 2, (out[1] + c[1]) / 2, hAt((out[0] + c[0]) / 2, (out[1] + c[1]) / 2) + .6), W(c[0], c[1], hAt(...c) + .6)], 4));
  });
  flows(H2O, runoff, 'rain', { stops: ['roof', 'basins', 'sprinklers', 'loop'], ov: true, spacing: 14, speed: 12, size: 1.6 });
  callout(H2O, 'roofdrain', runoff.length ? runoff[0][0].clone().add(new THREE.Vector3(0, 4, 0)) : W(300, 0, 5));
  const bmat = new THREE.MeshBasicMaterial({ color: '#4FC0E8', transparent: true, opacity: .45, depthWrite: false }); clipWithGround.push(bmat);
  site.basins.forEach(b => H2O.add(drapePoly(b, bmat, .7)));
  animators.push(t => { bmat.opacity = REDUCED ? .45 : .35 + .15 * Math.sin(t * 1.2); });
  H2O.userData.rain = rain;
  const mid = (r, f = .5) => r[Math.min(r.length - 1, Math.floor(r.length * f))];
  callout(H2O, 'lSupply', B(...mid(routes.supply, .55), 3));
  callout(H2O, 'lRecycled', B(...mid(routes.recycled, .6), 2), { left: true });
  callout(H2O, 'lLeach', B(...mid(routes.leachFeed, .6), 3));
  callout(H2O, 'lWaste', W(300, 135, 6), { left: true });

  // ---- underground detention under the east lot (C310.B, Contech system) ----
  const DT = sys.detention, da = DT.ang * D2R, du = [Math.cos(da), Math.sin(da)], dv = [-du[1], du[0]];
  const dg = new THREE.Group(); H2O.add(dg);
  const gz = hAt(...DT.c), bedTop = gz - 3, chamberR = 4.2;
  const bed = new THREE.Mesh(new THREE.BoxGeometry(DT.l + 6, 11, DT.w + 6), std('#BDB5A6', { r: 1, op: .55, dw: false }));
  bed.position.copy(W(DT.c[0], DT.c[1], bedTop - 5.5)); bed.rotation.y = da; dg.add(bed);
  const cmat = std('#8F9BA6', { r: .5, m: .4, op: .6, dw: false, side: THREE.DoubleSide });
  const wmat = flowMaterial(LEGEND.rain[1], { rep: 10, spd: .25, glow: .6 });
  for (let k = -1; k <= 1; k++) {
    const cc = [DT.c[0] + dv[0] * k * 9.5, DT.c[1] + dv[1] * k * 9.5];
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(chamberR, chamberR, DT.l, 20, 1, true, 0, Math.PI), cmat);
    arch.rotation.order = 'YZX'; arch.rotation.z = Math.PI / 2; arch.rotation.y = da; arch.position.copy(W(cc[0], cc[1], bedTop - 9)); dg.add(arch);
    const wg = new THREE.BoxGeometry(DT.l - 2, 2.2, chamberR * 1.7); { const uv = wg.attributes.uv, fu = new Float32Array(uv.count); for (let i = 0; i < uv.count; i++) fu[i] = uv.getX(i); wg.setAttribute('flowu', new THREE.BufferAttribute(fu, 1)); }
    const water = new THREE.Mesh(wg, wmat); water.position.copy(W(cc[0], cc[1], bedTop - 8)); water.rotation.y = da; dg.add(water);
  }
  // inlets (dome-grate risers) and the slow-release outlet pipe
  [-.38, .38].forEach(f => { const x = DT.c[0] + du[0] * DT.l * f + dv[0] * 18, y = DT.c[1] + du[1] * DT.l * f + dv[1] * 18; pipe(H2O, [W(x, y, hAt(x, y) + .5), B(x, y, 4), W(DT.c[0] + du[0] * DT.l * f, DT.c[1] + du[1] * DT.l * f, bedTop - 6)], .9, 'rain', { speed: 8, stops: ['detention'], seg: 20 }); });
  const o0 = [DT.c[0] - du[0] * DT.l * .5, DT.c[1] - du[1] * DT.l * .5];
  routes.detentionOut = [o0, [o0[0] - 60, o0[1] - 20], [o0[0] - 150, o0[1] - 30]];
  pipe(H2O, smooth(routes.detentionOut.map(([x, y]) => B(x, y, 8)), 4), 1.6, 'rain', { speed: 4, stops: ['detention'] });
  const dropsIn = []; for (let k = 0; k < 40; k++) { const f = Math.random() - .5, g2 = (Math.random() - .5) * DT.w; const x = DT.c[0] + du[0] * DT.l * f + dv[0] * g2, y = DT.c[1] + du[1] * DT.l * f + dv[1] * g2; dropsIn.push([W(x, y, bedTop - 4), W(x, y, bedTop - 8.5)]); }
  flows(H2O, dropsIn, 'rain', { stops: ['detention'], ov: false, spacing: 1.5, speed: 1.4, size: .5 });
  callout(H2O, 'detention', W(DT.c[0], DT.c[1], bedTop - 6));
  P.detention = [DT.c[0], DT.c[1], gz - 6];

  // ---- the treatment train, drawn as a diagram above the tanks (C510 process flow, C516 equipment) ----
  const pf = new THREE.Group(); H2O.add(pf); specimens.process = { g: pf, lab: {} };
  const tc = centroid(pt.map(t => t.c)), sd = (() => { const L = Math.hypot(...step); return [step[0] / L, step[1] / L]; })();
  const base = hAt(...tc) + 70;
  const STEPS = [
    ['Lift station', 'waste', 'pump'], ['Trash trap', 'waste', 'tank'], ['Equalization', 'waste', 'tank'],
    ['Anoxic zone', 'waste', 'tank'], ['Aerobic zone', 'waste', 'air'], ['Membranes', 'treated', 'mem'],
    ['UV light', 'treated', 'uv'], ['Treated-water tank', 'treated', 'tank']
  ];
  const spacing = 30, nodes = [];
  STEPS.forEach(([name, key, kind], i) => {
    const off2 = -(i - (STEPS.length - 1) / 2) * spacing, x = tc[0] + sd[0] * off2, y = tc[1] + sd[1] * off2, z = base + Math.sin(i / (STEPS.length - 1) * Math.PI) * 6;
    const g = new THREE.Group(); g.position.copy(W(x, y, z)); pf.add(g); nodes.push(W(x, y, z));
    const col = LEGEND[key][1];
    const vessel = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 9, 24, 1, true), std('#E8ECEE', { op: .35, dw: false, side: THREE.DoubleSide, m: .2, r: .2 }));
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, kind === 'pump' ? 3 : 6, 24), std(col, { e: .35, r: .4 })); liquid.position.y = kind === 'pump' ? -3 : -1.4;
    g.add(vessel, liquid);
    if (kind === 'air') flows(g, Array.from({ length: 14 }, () => { const a = Math.random() * 6.28, r = Math.random() * 3.6; return [new THREE.Vector3(Math.cos(a) * r, -4.2, Math.sin(a) * r), new THREE.Vector3(Math.cos(a) * r, 1.4, Math.sin(a) * r)]; }), 'air', { stops: ['process'], ov: false, spacing: 1.2, speed: 2.4, size: .35 });
    if (kind === 'mem') for (let k = -2; k <= 2; k++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(.25, 6.5, 6.5), std('#F2F5F7', { r: .3 })); pl.position.set(k * 1.4, -.6, 0); g.add(pl); }
    if (kind === 'uv') { const rod = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 8, 12), std('#A27CFF', { e: 1.2 })); g.add(rod); }
    const el = document.createElement('div'); el.className = 'co pf' + (i % 2 ? ' left' : ''); el.innerHTML = `<div class="callout"><b>${i + 1}. ${name}</b></div>`;
    const o = new CSS2DObject(el); o.position.set(0, i % 2 ? -5 : 5.5, 0); g.add(o); (callouts['pf'] ||= []).push(o); o.visible = false; el.style.display = 'none';
  });
  for (let i = 1; i < nodes.length; i++) pipe(pf, [nodes[i - 1].clone().add(new THREE.Vector3(0, -2, 0)), nodes[i].clone().add(new THREE.Vector3(0, -2, 0))], .9, STEPS[i][1], { speed: 8, stops: ['process'], shell: false, seg: 16 });
  // branches: reuse, leach fields, sludge
  const endN = nodes[nodes.length - 1];
  const branch = (dz, dxy, label, key) => {
    const p2 = endN.clone().add(new THREE.Vector3(-sd[0] * dxy, dz, sd[1] * dxy));
    pipe(pf, [endN.clone().add(new THREE.Vector3(0, -2, 0)), p2], .8, key, { speed: 8, stops: ['process'], shell: false, seg: 12 });
    const el = document.createElement('div'); el.className = 'co pf'; el.innerHTML = `<div class="callout"><b>${label}</b></div>`;
    const o = new CSS2DObject(el); o.position.copy(p2); pf.add(o); (callouts['pf'] ||= []).push(o); o.visible = false; el.style.display = 'none';
  };
  branch(12, 18, 'Flush toilets and urinals', 'treated'); branch(-14, 18, 'Leach fields', 'treated');
  { const p1 = nodes[1].clone(), p2 = p1.clone().add(new THREE.Vector3(0, -16, 0)); pipe(pf, [p1.clone().add(new THREE.Vector3(0, -4, 0)), p2], .7, 'waste', { speed: 4, stops: ['process'], shell: false, seg: 10 });
    const el = document.createElement('div'); el.className = 'co pf left'; el.innerHTML = '<div class="callout"><b>Sludge, hauled off site</b></div>'; const o = new CSS2DObject(el); o.position.copy(p2); pf.add(o); (callouts['pf'] ||= []).push(o); o.visible = false; el.style.display = 'none'; }
  // dashed drops showing where the diagram sits: down to the real tanks
  pt.forEach(t => { const a = W(t.c[0], t.c[1], base - 6), b = B(t.c[0], t.c[1], 4); const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineDashedMaterial({ color: '#7d6f5c', dashSize: 2, gapSize: 2 })); l.computeLineDistances(); pf.add(l); });
  pf.visible = false;
  P.process = [tc[0], tc[1], base - 4];
  { const az = Math.atan2(sd[1], sd[0]) / D2R + 90; P.processAz = az; }
}

// ---------- CARBON ----------
const C = groups.carbon;
const label3 = (group, id, pos, left) => callout(group, id, pos, { left });
{
  const rnd = (a, b) => a + Math.random() * (b - a);
  // ---- breezeway: glulam beams laid out in triangles under the roof (WoodWorks; Snøhetta) ----
  {
    const g = new THREE.Group(); C.add(g); specimens.diagrid = { g, lab: {} };
    const bz = [[296, 38], [327, 38], [329, 192], [296, 192]];
    const wood = std('#C98846', { r: .55, e: .08 });
    const geos = [];
    [90, 30, 150].forEach((deg, di) => {
      const d = [Math.cos(deg * D2R), Math.sin(deg * D2R)], n = [-d[1], d[0]], sp = di ? 12 : 10.4;
      for (let k = -30; k <= 30; k++) {
        let run = [];
        const flush = () => { if (run.length > 1) { const a = run[0], b = run[run.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const top = Math.min(roofAt(...c), 36); const bx = new THREE.BoxGeometry(L, di ? 1.8 : 2.6, di ? .7 : .9); bx.rotateY(Math.atan2(d[1], d[0])); bx.translate(c[0], 31.8 - (di ? .9 : 1.3), -c[1]); geos.push(bx); } run = []; };
        for (let t = -260; t <= 260; t += 1) { const x = 311 + n[0] * k * sp + d[0] * t, y = 115 + n[1] * k * sp + d[1] * t; if (inPoly(x, y, bz)) run.push([x, y]); else flush(); }
        flush();
      }
    });
    // columns
    [[300, 60], [323, 90], [300, 120], [323, 150], [300, 180]].forEach(([x, y]) => { const c = new THREE.CylinderGeometry(.9, .9, 30, 12); c.translate(x, 15, -y); geos.push(c); });
    g.add(new THREE.Mesh(mergeGeometries(geos), wood));
    // CLT deck just above the beams
    // carbon locked in the wood: slow green motes settling into the beams
    const motes = []; for (let k = 0; k < 40; k++) { const x = rnd(298, 326), y = rnd(42, 188); motes.push([W(x + 40, y + 20, 70), W(x, y, 30)]); }
    flows(g, motes, 'carbon', { stops: ['timber'], ov: false, spacing: 30, speed: 7, size: .45 });
    g.visible = false;
    callout(C, 'diagrid', W(318, 118, 29.5));
    P.breezeway = [311, 100, 22];
  }

  // ---- material samples, set out on the prairie south of the building ----
  // each sample stands on its own raised plinth, clear of the ground and the Boardwalk
  const plinth = (c, l, w) => { let top = -1e9; for (let dx = -l / 2; dx <= l / 2; dx += 3) for (let dy = -w / 2; dy <= w / 2; dy += 3) top = Math.max(top, hAt(c[0] + dx, c[1] + dy)); top += 2.5; let low = 1e9; for (let dx = -l / 2; dx <= l / 2; dx += 3) for (let dy = -w / 2; dy <= w / 2; dy += 3) low = Math.min(low, hAt(c[0] + dx, c[1] + dy)); const h = top - low + 1; const m = new THREE.Mesh(new THREE.BoxGeometry(l + 4, h, w + 4), std('#EDE7D9', { r: .9 })); m.position.copy(W(c[0], c[1], top - h / 2)); m.receiveShadow = true; plinths.push([m, c]); return top; };
  const plinths = [];
  // (a) carbon ledger: whole-building LCA (Atelier Ten, 2026) — typical steel building vs the Library
  {
    const g = new THREE.Group(); C.add(g); specimens.ledger = { g, lab: {} };
    const c = [170, -235], gz = plinth(c, 70, 24), k = 46;
    const bar = (dx, h, color, op) => { const m = new THREE.Mesh(new THREE.BoxGeometry(12, h, 12), std(color, { r: .6, op, dw: op == null })); m.position.copy(W(c[0] + dx, c[1], gz + h / 2)); g.add(m); return m; };
    bar(-22, k, '#8E9399');
    bar(0, k * .74, '#C98846');
    bar(22, k * .48, '#7FB069');
    bar(22, k * .74, '#7FB069', .22).position.copy(W(c[0] + 22, c[1], gz + k * .74 / 2));
    // carbon pulled out of the air and held in the wood (the hatched gap on the right bar)
    flows(g, Array.from({ length: 16 }, () => { const x = c[0] + 22 + rnd(-5, 5), y = c[1] + rnd(-5, 5); return [W(x, y, gz + k * .74 + 22), W(x, y, gz + k * .5)]; }), 'carbon', { stops: ['embodied'], ov: false, spacing: 8, speed: 5, size: .5 });
    label3(C, 'ledger0', W(c[0] - 22, c[1], gz + k + 1), true);
    label3(C, 'ledger1', W(c[0], c[1], gz + k * .74 + 1));
    label3(C, 'ledger2', W(c[0] + 22, c[1], gz + k * .48 + 1));
    g.visible = false; P.ledger = [c[0], c[1], gz + 20];
  }
  // (b) low-carbon concrete: test cylinders, typical vs Library mixes (ForConstructionPros; Metropolis)
  {
    const g = new THREE.Group(); C.add(g); specimens.concrete = { g, lab: {} };
    const c = [290, -235], gz = plinth(c, 50, 20) + .7;
    const cyl = (dx, parts) => { let z = gz; parts.forEach(([h, col]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, h, 32), std(col, { r: .8 })); m.position.copy(W(c[0] + dx, c[1], z + h / 2)); g.add(m); z += h; }); return z; };
    // binder share only, drawn as stacked bands: dark = portland cement, tan = fly ash, white = slag
    const tTop = cyl(-12, [[18, '#5F6368']]);
    const lTop = cyl(12, [[7.2, '#5F6368'], [5.4, '#C9B48A'], [5.4, '#ECEAE4']]);
    // the CO2 that comes with each mix
    const puff = (dx, n, top) => { for (let q = 0; q < n; q++) { const r = rnd(1, 1.7), m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), std('#4F5D66', { op: .7, dw: false })); m.position.copy(W(c[0] + dx + rnd(-2.5, 2.5), c[1] + rnd(-2.5, 2.5), top + 2 + q * 1.4)); g.add(m); } };
    puff(-12, 8, tTop); puff(12, 4, lTop);
    label3(C, 'mixTypical', W(c[0] - 12, c[1], tTop + 14), true);
    label3(C, 'mixLibrary', W(c[0] + 12, c[1], lTop + 8));
    label3(C, 'flyash', W(c[0] + 16, c[1], gz + 10));
    g.visible = false; P.concrete = [c[0], c[1], gz + 12];
  }
  // (c) rammed earth: a slice of the wall, 2 ft thick, built in compacted lifts (Grand Forks Herald; Buildings.com)
  {
    const g = new THREE.Group(); C.add(g); specimens.earth = { g, lab: {} };
    const c = [55, -235], gz = plinth(c, 30, 12) - 1, Lw = 22, T = 2, lift = 8 / 12, n = 33;
    const pal = ['#D7B98C', '#C9A177', '#B9825A', '#A9703F', '#C79A6A', '#E0C59A', '#9C8A74', '#B57B4F'].map(x => new THREE.Color(x));
    const geo = new THREE.BoxGeometry(Lw, lift, T); const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1 }), n);
    let band = 0;
    for (let q = 0; q < n; q++) { if (Math.random() < .35) band = (band + 1 + (Math.random() * 3 | 0)) % pal.length; m4.makeTranslation(c[0], gz + 1 + lift / 2 + q * lift, -c[1]); im.setMatrixAt(q, m4); im.setColorAt(q, pal[band].clone().offsetHSL(0, 0, rnd(-.03, .03))); }
    g.add(im);
    // the lift being packed: loose 12 in of earth tamped down to 8 in, over and over
    const top = gz + 1 + n * lift, loose = new THREE.Mesh(new THREE.BoxGeometry(Lw, 1, T), std('#D2AE80', { r: 1 })); g.add(loose);
    const form = new THREE.Mesh(new THREE.BoxGeometry(Lw + .6, 1.6, T + .8), std('#6E5A45', { op: .5, dw: false })); form.position.copy(W(c[0], c[1], top + .8)); g.add(form);
    const tamp = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 4, 8), std('#4A4F55', { m: .5 })); shaft.position.y = 2; const foot = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .25, 16), std('#4A4F55', { m: .5 })); tamp.add(shaft, foot); g.add(tamp);
    animators.push(t => { if (!g.visible) return; const ph = REDUCED ? 1 : (t * .45) % 1; const h = 1 - .33 * ph; loose.scale.y = h; loose.position.copy(W(c[0], c[1], top + h / 2)); const k = (t * 3) % 1; const along = Math.sin(t * .7) * (Lw / 2 - 1); tamp.position.copy(W(c[0] + along, c[1], top + h + (REDUCED ? .3 : Math.abs(Math.sin(k * Math.PI)) * 1.2))); });
    label3(C, 'earthLifts', W(c[0] + Lw / 2, c[1], gz + 12));
    label3(C, 'earthThick', W(c[0] - Lw / 2, c[1], top + 2), true);
    g.visible = false; P.earth = [c[0], c[1], gz + 12];
  }
  // (d) saved and used again: heart pine, Sagamore Hill copper beech, Hebron brick, timber-mat bench
  {
    const g = new THREE.Group(); C.add(g); specimens.reuse = { g, lab: {} };
    const c = [420, -235], gz = plinth([c[0] + 5, c[1]], 66, 16) + .3;
    // heart pine boards, 5, 7 and 9 in wide
    [5, 7, 9, 5, 7, 9, 7].forEach((w, q) => { const b = new THREE.Mesh(new THREE.BoxGeometry(12, .1, w / 12), std(q % 2 ? '#B5733A' : '#A9652F', { r: .55 })); let off = 0; for (let r = 0; r < q; r++) off += [5, 7, 9, 5, 7, 9, 7][r] / 12 + .05; b.position.copy(W(c[0] - 16, c[1] - 2 + off, gz + 2.2)); g.add(b); });
    const stand = new THREE.Mesh(new THREE.BoxGeometry(12.4, 2, 4.9), std('#E8E2D4')); stand.position.copy(W(c[0] - 16, c[1] + .4, gz + 1)); g.add(stand);
    // live-edge slab (copper beech)
    const sh = new THREE.Shape(); sh.moveTo(-7, -1.2); for (let x = -7; x <= 7; x += .7) sh.lineTo(x, -1.2 - Math.abs(Math.sin(x * 1.3)) * .45 - (x * x) / 70); for (let x = 7; x >= -7; x -= .7) sh.lineTo(x, 1.4 + Math.abs(Math.cos(x * 1.1)) * .5 - (x * x) / 90); sh.closePath();
    const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .35, bevelEnabled: true, bevelSize: .06, bevelThickness: .05, bevelSegments: 2 }), std('#9B4F2E', { r: .45 }));
    slab.rotation.x = -Math.PI / 2; slab.position.copy(W(c[0], c[1], gz + 3)); g.add(slab);
    [[-5, 0], [5, 0]].forEach(([dx]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(.4, 3, 2), std('#2E2B28', { m: .4 })); l.position.copy(W(c[0] + dx, c[1], gz + 1.5)); g.add(l); });
    // crushed Hebron brick
    const nb = 260, brick = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.28), std('#A4472E', { r: 1 }), nb);
    for (let q = 0; q < nb; q++) { const a = rnd(0, 6.28), r = Math.sqrt(Math.random()) * 3.4, x = c[0] + 13 + Math.cos(a) * r, y = c[1] + Math.sin(a) * r, h = Math.max(0, 1.6 - r * .45) + rnd(0, .2); m4.makeRotationFromEuler(new THREE.Euler(rnd(0, 3), rnd(0, 3), 0)).setPosition(x, gz + h, -y); brick.setMatrixAt(q, m4); brick.setColorAt(q, new THREE.Color('#A4472E').offsetHSL(rnd(-.02, .02), 0, rnd(-.08, .08))); }
    g.add(brick);
    // bench from reused construction timber mats
    [0, 1, 2].forEach(q => { const t = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 1), std('#8B7558', { r: .9 })); t.position.copy(W(c[0] + 26, c[1] - 1 + q * 1.02, gz + 1.7)); g.add(t); });
    [[-4], [4]].forEach(([dx]) => { const t = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 3.2), std('#7B664C', { r: .9 })); t.position.copy(W(c[0] + 26 + dx, c[1], gz + .6)); g.add(t); });
    label3(C, 'pine', W(c[0] - 16, c[1], gz + 2.6), true);
    label3(C, 'beech', W(c[0], c[1], gz + 3.6));
    label3(C, 'brick', W(c[0] + 13, c[1], gz + 1.8));
    label3(C, 'mats', W(c[0] + 26, c[1], gz + 2.4));
    g.visible = false; P.reuse = [c[0] + 5, c[1], gz + 6];
  }

  plinths.forEach(([m, c]) => { const k = ['ledger', 'concrete', 'earth', 'reuse'].reduce((best, k) => { const pp = P[k]; const d = Math.hypot(pp[0] - c[0], pp[1] - c[1]); return d < best[1] ? [k, d] : best; }, ['', 1e9])[0]; specimens[k].g.add(m); });
  // ---- prairie: soil pit with deep roots, seed story, soil cores ----
  const rstop = LAYERS.carbon.stops.find(s => s.id === 'prairie');
  const { u, v, c0 } = cutFrame(rstop.cut.c, rstop.cut.ang, rstop.cut.l, rstop.cut.w);
  const L = rstop.cut.l, Wd = rstop.cut.w;
  const rootPos = [];
  const wallPts = [];
  for (let s = 1; s < L; s += 1.3) { wallPts.push([c0[0] + u[0] * s + v[0] * .25, c0[1] + u[1] * s + v[1] * .25]); wallPts.push([c0[0] + u[0] * s + v[0] * (Wd - .25), c0[1] + u[1] * s + v[1] * (Wd - .25)]); }
  for (let t = 1; t < Wd; t += 1.3) { wallPts.push([c0[0] + v[0] * t + u[0] * .25, c0[1] + v[1] * t + u[1] * .25]); wallPts.push([c0[0] + v[0] * t + u[0] * (L - .25), c0[1] + v[1] * t + u[1] * (L - .25)]); }
  wallPts.forEach(([x, y]) => {
    const depth = rnd(5, 15); let px = x, py = y, pz = hAt(x, y);
    const segs = 12; const t0 = [rnd(-1, 1), rnd(-1, 1)];
    for (let k = 0; k < segs; k++) { const nz = pz - depth / segs, nx = px + rnd(-.5, .5) * .6 + t0[0] * .08, ny = py + rnd(-.5, .5) * .6 + t0[1] * .08; rootPos.push(px, pz, -py, nx, nz, -ny); if (k > 2 && Math.random() < .45) { rootPos.push(nx, nz, -ny, nx + rnd(-1.5, 1.5), nz - rnd(.5, 2.5), -ny + rnd(-1.5, 1.5)); } px = nx; py = ny; pz = nz; }
  });
  const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.Float32BufferAttribute(rootPos, 3));
  C.add(new THREE.LineSegments(rgeo, new THREE.LineBasicMaterial({ color: '#F1E3B4' })));
  const grassGeo = new THREE.ConeGeometry(.5, 3.2, 5);
  const tuft = new THREE.InstancedMesh(grassGeo, std('#8F9B55'), wallPts.length); wallPts.forEach(([x, y], q) => { m4.makeTranslation(x, hAt(x, y) + 1.5, -y); tuft.setMatrixAt(q, m4); }); C.add(tuft);
  const dots = []; for (let q = 0; q < 20; q++) { const x = c0[0] + u[0] * rnd(0, L) + v[0] * rnd(0, Wd), y = c0[1] + u[1] * rnd(0, L) + v[1] * rnd(0, Wd), g0 = hAt(x, y); dots.push([W(x + 25, y + 25, g0 + 60), W(x, y, g0 + 1), W(x + .3, y, g0 - rnd(4, 12))]); }
  flows(C, dots, 'carbon', { stops: ['prairie', 'soil'], ov: false, spacing: 14, speed: 6, size: .45 });
  callout(C, 'roots', W(c0[0] + v[0] * Wd + u[0] * L * .5, c0[1] + v[1] * Wd + u[1] * L * .5, hAt(...rstop.cut.c) - 6));
  for (let q = 0; q < 4; q++) { const s2 = L * (.25 + q * .17), t = Wd * .55; const x = c0[0] + u[0] * s2 + v[0] * t, y = c0[1] + u[1] * s2 + v[1] * t, fl = hAt(...rstop.cut.c) - 18; const core = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 3.5, 12), std('#5A4128', { e: .1 })); core.position.copy(W(x, y, fl + 1.75)); const tubeC = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, 3.6, 12, 1, true), std('#E3E7EA', { op: .35, dw: false, side: THREE.DoubleSide })); tubeC.position.copy(core.position); C.add(core, tubeC); if (!q) callout(C, 'cores', W(x, y, fl + 3.8)); }

  // ---- grazing: paddock fences and a small herd, rotated through the pasture ----
  const fpos = []; const px0 = -1150, py0 = -180, pw = 110, ph = 300;
  for (let q = 0; q <= 4; q++) { const x = px0 + q * pw; for (let y = py0; y > py0 - ph; y -= 10) fpos.push(x, hAt(x, y) + 2, -y, x, hAt(x, y - 10) + 2, -(y - 10)); }
  [py0, py0 - ph].forEach(y => { for (let x = px0; x < px0 + 4 * pw; x += 10) fpos.push(x, hAt(x, y) + 2, -y, x + 10, hAt(x + 10, y) + 2, -y); });
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
  C.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: '#5E4E36' })));
  const herd = new THREE.InstancedMesh(new THREE.BoxGeometry(7, 4.5, 3), std('#3B2B22', { r: .9 }), 18); herd.frustumCulled = false; C.add(herd);
  const cows = Array.from({ length: 18 }, () => [rnd(10, pw - 10), rnd(20, ph - 20), rnd(0, 6.28)]);
  animators.push(t => { if (!C.visible) return; const pad = REDUCED ? 1 : Math.floor(t / 6) % 4; cows.forEach(([ox, oy, a], q) => { const x = px0 + pad * pw + ox, y = py0 - oy, w2 = Math.sin(t * .3 + q) * 2; m4.compose(new THREE.Vector3(x + w2, hAt(x, y) + 2.3, -y), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(1, 1, 1)); herd.setMatrixAt(q, m4); }); herd.instanceMatrix.needsUpdate = true; });
  P.pasture = [px0 + 2 * pw, py0 - ph / 2, hAt(px0 + 2 * pw, py0 - ph / 2)];
  P.rootsCore = [rstop.cut.c[0], rstop.cut.c[1], hAt(...rstop.cut.c) - 10];
}

// ---------- hotspots per layer ----------
const hotspotEls = { energy: [], water: [], carbon: [] };
['energy', 'water', 'carbon'].forEach(k => LAYERS[k].stops.forEach((s, i) => { const p = at(s.at); if (s.cut) p.y = Math.max(p.y, 4); hotspotEls[k].push(marker(groups[k], p, i + 1, LAYERS[k].color, i)); }));

// ---------- state ----------
let detailTab = 'simple';
let layer = 'overview', stop = -1, xray = false, roofOff = false, userLook = false;
const HOME = { target: W(420, -110, -20), pos: W(1080, -1010, 520) };
const fly = { active: false };
function flyTo(target, pos, dur = 1.4) {
  fly.t0 = performance.now(); fly.dur = dur * 1000; fly.fromT = controls.target.clone(); fly.fromP = camera.position.clone(); fly.toT = target.clone(); fly.toP = pos.clone(); fly.active = !REDUCED;
  if (REDUCED) { controls.target.copy(target); camera.position.copy(pos); }
}
function viewFor(s) {
  const t = at(s.at); const v = s.view || { dist: 600, tilt: .9 };
  const az = (v.az === 'perp' ? P.processAz : v.az === 'drain' ? P.roofdrainAz : (v.az ?? 230)) * D2R, el = Math.max(.12, Math.min(1.4, v.tilt)) * .78;
  const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el));
  if (v.from) return { t, pos: W(...v.from) };
  return { t, pos: t.clone().add(dir.multiplyScalar(v.dist)) };
}
// "See through ground" from the toolbar shows every buried system at once, whatever layer is open
const XRAY_LABELS = ['loop', 'vault', 'mains', 'proc', 'lift', 'potable', 'np', 'trench', 'detention'];
let xrayAll = false;
function setXrayAll(on) {
  xrayAll = on;
  ['energy', 'water', 'carbon'].forEach(n => { groups[n].visible = n === layer || on; });
  const s = stop >= 0 ? LAYERS[layer].stops[stop] : null;
  showCallouts([...(s?.show || []), ...(on ? XRAY_LABELS : [])]);
  if (on) flowReg.forEach(f => { if (!f.phys && f.group && f.group !== groups[layer]) f.inst.visible = false; }); // pipes and tanks only, no sun rays or dots from other layers
  else if (typeof updateFlows === 'function') updateFlows(s ? s.id : null);
}
function setXray(v, manual = false) {
  if (xrayAll && !(manual && v)) setXrayAll(false);
  xray = v; btnUnder.setAttribute('aria-pressed', v);
  groundMats.forEach(m => { m.opacity = v ? (layer === 'water' && stop >= 0 && LAYERS.water.stops[stop].id === 'loop' ? .22 : .4) : 1; m.depthWrite = !v; if (m.transparent !== v) { m.transparent = v; m.needsUpdate = true; } });
  controls.maxPolarAngle = v || CUT.on ? Math.PI * .62 : Math.PI * .49;
  if (manual && v) setXrayAll(true);
  if (typeof camHint !== 'undefined') syncCam();
}
function setRoof(off) { roofOff = off; ROOFCUT.off = off; planGroup.visible = off; btnRoof.setAttribute('aria-pressed', off); roofParts.forEach(m => m.visible = !off); updateBcut(); if (typeof camHint !== 'undefined') syncCam(); }
function setWood(on) { mats.body.color.copy(on ? woodColor : bodyColor); }
function resolveCut(c) { return c ? { c0: null, ...c, c: typeof c.c === 'string' ? P[c.c].slice(0, 2) : (c.c || c.c0) } : null; }
function setCuts(stopDef) {
  const tc = resolveCut(stopDef?.cut), bc = resolveCut(stopDef?.bcut);
  const same = (a, b) => a && b && a.c[0] === b.c[0] && a.c[1] === b.c[1] && a.l === b.l && a.w === b.w;
  if (tc) { const keep = CUT.on && same(CUT, tc); Object.assign(CUT, tc, { on: true, depth: (tc.depth ?? (stopDef.id === 'wells' ? 330 : stopDef.id === 'tanks' ? 26 : 18)) - hAt(...tc.c) }); if (!keep) CUT.k = REDUCED ? 1 : 0; } else CUT.on = false;
  if (bc) { const keep = BCUT.on && same(BCUT, bc) && BCUT.z === bc.z; Object.assign(BCUT, bc, { on: true }); if (!keep) BCUT.k = REDUCED ? 1 : 0; } else BCUT.on = false;
  interior.visible = !!bc || roofOff;
  section.visible = !!bc && bc.ang === 0 && !bc.bare; mech.visible = !!bc && bc.ang !== 0 && !bc.bare || roofOff;
  const sps = [].concat(stopDef?.specimen || []);
  Object.entries(specimens).forEach(([k, sp]) => sp.g.visible = sps.includes(k));
  setTrenches(stopDef?.trench || null);
  updateCut(); updateBcut();
}
function showCallouts(list) {
  const want = new Set(list || []);
  Object.entries(callouts).forEach(([id, arr]) => arr.forEach(o => { const vis = want.has(id) && o.parent && o.parent.visible !== false && isShown(o); o.visible = vis; o.element.style.display = vis ? '' : 'none'; }));
}
const camHint = viewer.querySelector('.hint') || document.querySelector('.hint');
// free look only outside the guided tour; during a step the camera holds the framed view
function syncCam() {
  const free = stop < 0 || userLook;
  controls.enabled = free; viewer.classList.toggle('locked', !free); viewer.classList.toggle('look', roofOff || xray);
  if (!camHint) return;
  camHint.textContent = free
    ? (TOUCH ? 'Drag to turn · Pinch to zoom · Two fingers to pan' : 'Drag to turn · Scroll to zoom · Right-drag to pan') + (layer === 'overview' ? '' : ' · Tap a number')
    : 'View is set for this step · Use See through ground or Lift the roof to look around';
}
const legendEl = document.createElement('div'); legendEl.className = 'legend'; viewer.appendChild(legendEl);
function updateFlows(id) {
  const keys = [];
  const active = f => id === 'loop' ? f.group === groups.water : id ? (!f.stops || f.stops.includes(id)) : f.ov;
  flowReg.forEach(f => { if (!f.phys) f.inst.visible = active(f); });
  flowReg.forEach(f => { if (active(f) && isShown(f.inst) && !keys.includes(f.key)) keys.push(f.key); });
  legendEl.innerHTML = keys.length ? `<b>Moving dots</b>${keys.filter(k => LEGEND[k]).map(k => `<span><i style="--c:${LEGEND[k][1]}"></i>${LEGEND[k][0]}</span>`).join('')}` : '';
  legendEl.hidden = !keys.length;
}
function isShown(o) { let p = o.parent; while (p) { if (p.visible === false) return false; p = p.parent; } return true; }

function setLayer(k, opts = {}) {
  layer = k; stop = -1; userLook = false;
  ['overview', 'energy', 'water', 'carbon'].forEach(n => { groups[n].visible = n === k; groups[n].traverse(o => { if (o.isCSS2DObject && !Object.values(callouts).some(a => a.includes(o))) { o.visible = n === k; o.element.style.display = n === k ? '' : 'none'; } }); });
  [...tabs.querySelectorAll('button')].forEach(b => b.setAttribute('aria-selected', b.dataset.layer === k));
  document.documentElement.style.setProperty('--layer', LAYERS[k].color || '#1B4633');
  setRoof(false); setWood(k === 'carbon'); setCuts(null); setXray(false); showCallouts([]);
  if (groups.water.userData.rain) groups.water.userData.rain.visible = true;
  updateFlows(null);
  renderPanel();
  if (!opts.noFly) flyTo(HOME.target, HOME.pos);
  if (!EMBED && !opts.noHash) history.replaceState(null, '', `#${k}`);
}
function selectStop(i) {
  const L = LAYERS[layer]; if (!L.stops[i]) return;
  stop = i; userLook = false; const s = L.stops[i];
  setRoof(s.roof === false);
  setCuts(s);
  setXray(!!s.xray);
  setWood(layer === 'carbon');
  if (groups.water.userData.rain) groups.water.userData.rain.visible = ['roof', 'basins'].includes(s.id);
  showCallouts(s.show);
  updateFlows(s.id);
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
    const zeros = LBC.zeros.map(z => `<div class="zero" style="--c:${z.k ? LAYERS[z.k].color : '#8A8F87'}"><b>${z.title}</b><span>${z.text}</span></div>`).join('');
    const cmp = `<table class="cmp">${LBC.compare.map((r, i) => `<tr>${r.map((c, j) => i === 0 || j === 0 ? `<th>${c}</th>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
    body = `<div class="pick">${['energy', 'water', 'carbon'].map(k => `<button data-go="${k}" style="--c:${LAYERS[k].color}"><b>${LAYERS[k].label}</b><span>${LAYERS[k].stops.length} stops</span></button>`).join('')}</div><h3 class="sec">The four zeros</h3><div class="zeros">${zeros}</div><h3 class="sec">What is the Living Building Challenge?</h3><div class="dtabs" role="tablist"><button role="tab" data-dtab="simple" aria-selected="${detailTab === 'simple'}">The short version</button><button role="tab" data-dtab="tech" aria-selected="${detailTab === 'tech'}">Technical details</button></div><p class="lbc-text${detailTab === 'tech' ? ' tech' : ''}">${detailTab === 'tech' ? LBC.tech : LBC.text}</p>${cmp}`;
  } else {
    body = `<ol class="stops">${L.stops.map((s, i) => `<li class="${i === stop ? 'open' : ''}"><button data-stop="${i}" aria-expanded="${i === stop}"><i>${i + 1}</i>${s.title}${s.cut || s.bcut ? '<em class="cut-tag">cutaway</em>' : ''}</button>${i === stop ? `<div class="detail">${s.photo ? `<figure class="ph"><img src="assets/photos/trpl-${s.photo[0]}-480.jpg" srcset="assets/photos/trpl-${s.photo[0]}-480.jpg 480w, assets/photos/trpl-${s.photo[0]}-1400.jpg 1400w" sizes="(max-width: 760px) 92vw, 400px" alt="${s.photo[1]}" loading="lazy"><figcaption>${s.photo[1]}</figcaption></figure>` : ''}<div class="dtabs" role="tablist"><button role="tab" data-dtab="simple" aria-selected="${detailTab === 'simple'}">How it works</button>${s.tech ? `<button role="tab" data-dtab="tech" aria-selected="${detailTab === 'tech'}">Technical details</button>` : ''}</div><p class="${detailTab === 'tech' && s.tech ? 'tech' : ''}">${detailTab === 'tech' && s.tech ? s.tech : s.text}</p>${s.lbc ? `<div class="lbc"><b>Living Building Challenge · ${PETALS[s.lbc[0]] || s.lbc[0]}</b><span>${s.lbc[1]}</span></div>` : ''}<div class="nav">${i > 0 ? `<button data-stop="${i - 1}">‹ Back</button>` : '<span></span>'}${i < L.stops.length - 1 ? `<button data-stop="${i + 1}" class="next">Next ›</button>` : `<button data-go="overview" class="next">All systems</button>`}</div></div>` : ''}</li>`).join('')}</ol>`;
  }
  panel.querySelector('.panel-body').innerHTML = `<div class="eyebrow">Theodore Roosevelt Presidential Library</div><h2>${L.title}</h2><p class="intro">${L.intro}</p>${stats}${body}<p class="note">${NOTE}</p>`;
  panel.querySelectorAll('[data-stop]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.stop; if (i === stop && b.closest('li') && !b.classList.contains('next')) { stop = -1; setCuts(null); setXray(false); showCallouts([]); updateFlows(null); renderPanel(); hotspotEls[layer].forEach(el => el.classList.remove('active')); return; } selectStop(i); }));
  panel.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => setLayer(b.dataset.go)));
  panel.querySelectorAll('[data-dtab]').forEach(b => b.addEventListener('click', () => { detailTab = b.dataset.dtab; renderPanel(); }));
  syncCam();
  const open = panel.querySelector('li.open'); if (open) open.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
}

// ---------- controls ----------
tabs.innerHTML = ['overview', 'energy', 'water', 'carbon'].map(k => `<button role="tab" data-layer="${k}" style="--c:${LAYERS[k].color || '#1B4633'}">${LAYERS[k].label}</button>`).join('');
tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setLayer(b.dataset.layer)));
if (LOCK_LAYER) tabs.hidden = true;
btnUnder.addEventListener('click', () => { userLook = true; setXray(!xray, true); });
btnRoof.addEventListener('click', () => { userLook = true; setRoof(!roofOff); interior.visible = roofOff || BCUT.on; mech.visible = roofOff || (BCUT.on && BCUT.ang !== 0); if (roofOff && stop < 0) flyTo(W(235, 85, 0), W(330, -160, 330)); });
// full-screen toggle (same icon as the campus map). Inside an embed it fills the screen with the iframe;
// where the browser can't (iPhone Safari), it opens the full-screen page in a new tab instead.
{
  const fsBtn = document.getElementById('btn-fs'), root = document.documentElement;
  const IN = '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>', OUT = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      const req = root.requestFullscreen || root.webkitRequestFullscreen;
      const canFs = req && (document.fullscreenEnabled || document.webkitFullscreenEnabled);
      if (canFs) { const r = req.call(root); if (r && r.catch) r.catch(() => openPage()); } else openPage();
    });
    const openPage = () => { const u = new URL(location.href); ['embed', 'lock', 'panel', 'layer', 'stop'].forEach(k => u.searchParams.delete(k)); u.hash = stop >= 0 ? `${layer}/${stop + 1}` : layer; window.open(u.href, '_blank', 'noopener'); };
    const sync = () => { const on = !!fsEl(); fsBtn.querySelector('svg').innerHTML = on ? IN : OUT; fsBtn.title = fsBtn.ariaLabel = on ? 'Exit full screen' : 'Full screen'; setTimeout(resize, 50); };
    document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
  }
}
btnReset.addEventListener('click', () => { if (stop >= 0) { const v = viewFor(LAYERS[layer].stops[stop]); flyTo(v.t, v.pos); } else flyTo(HOME.target, HOME.pos); });
panel.querySelector('.panel-toggle')?.addEventListener('click', () => panel.classList.toggle('collapsed'));

// ---------- resize / loop ----------
function resize() {
  const w = viewer.clientWidth, h = viewer.clientHeight;
  renderer.setSize(w, h, false); labelRenderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewer); resize();
const clock = new THREE.Clock();
let frameN = 0;
// keep callout boxes from sitting on top of each other: nudge them up the screen
function declutter() {
  const items = [];
  labelRenderer.domElement.querySelectorAll('.co').forEach(co => {
    if (co.style.display === 'none' || co.parentElement?.style.display === 'none') return;
    const box = co.querySelector('.callout'); if (!box) return;
    const off = +(box.dataset.off || 0); const r = box.getBoundingClientRect(); if (!r.width) return;
    items.push({ box, off, l: r.left, r: r.right, t: r.top - off, b: r.bottom - off });
  });
  items.sort((a, b) => b.b - a.b);
  const placed = [];
  items.forEach(it => {
    let dy = 0;
    for (let k = 0; k < 12; k++) { const hit = placed.find(p => it.l < p.r + 4 && it.r > p.l - 4 && it.t + dy < p.b + 3 && it.b + dy > p.t - 3); if (!hit) break; dy = hit.t - 3 - it.b; }
    const nd = Math.round(dy * .5 + it.off * .5);
    if (Math.abs(nd - it.off) > .5) { it.box.dataset.off = nd; it.box.style.transform = nd ? `translateY(${nd}px)` : ''; }
    placed.push({ l: it.l, r: it.r, t: it.t + nd, b: it.b + nd });
  });
}
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
  if ((++frameN % 4) === 0) declutter();
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
