"""Fetch USGS 3DEP elevation (EPSG:6547, ND South ft) for the model block, resample to the model frame.
Georeference: two GPS'd thermal test bores on M001 (East N46.915283 W103.547716, West N46.914299 W103.548797)
located on the registered M001 sheet -> rotation -40.758 deg, scale 1. Vertical datum: FFE 2516.0 ft (C514) = z 0."""
import numpy as np, json, urllib.parse, urllib.request, io, sys
from PIL import Image
from scipy.ndimage import map_coordinates
from matplotlib.path import Path
g = json.load(open('/home/claude/lbc/georef_pts.json'))
A = np.array(g['stlA']); gA = np.array(g['gA']); th = np.radians(-40.758)
R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
s2g = lambda p: (R @ (np.asarray(p, float) - A).T).T + gA
X0, X1, Y0, Y1, C = -1300, 2500, -1650, 1300, 6
C4 = s2g(np.array([[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]])); mn = C4.min(0) - 50; mx = C4.max(0) + 50
w = int((mx - mn)[0] / 3.2808) + 1; h = int((mx - mn)[1] / 3.2808) + 1
url = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?' + urllib.parse.urlencode(dict(
    bbox=f'{mn[0]},{mn[1]},{mx[0]},{mx[1]}', bboxSR=6547, imageSR=6547, size=f'{w},{h}', format='tiff', pixelType='F32',
    interpolation='RSP_BilinearInterpolation', f='image'))
D = np.array(Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=300).read())), dtype=np.float32)
xs = np.arange(X0, X1 + .1, C); ys = np.arange(Y0, Y1 + .1, C)
GX, GY = np.meshgrid(xs, ys); P = np.stack([GX.ravel(), GY.ravel()], 1); G = s2g(P)
dx = (mx[0] - mn[0]) / w; dy = (mx[1] - mn[1]) / h
Z = map_coordinates(D, [(mx[1] - G[:, 1]) / dy - .5, (G[:, 0] - mn[0]) / dx - .5], order=1).reshape(GX.shape) * 3.280839895 - 2516.0
# building pad: keep the lidar (pre-construction) ground from poking through the floor
fp = json.load(open('/home/claude/lbcsystems/assets/data/footprints.json'))
from scipy.ndimage import binary_dilation
inside = np.zeros(GX.shape, bool)
for f in fp: inside |= Path(f).contains_points(P).reshape(GX.shape)
inside = binary_dilation(inside, iterations=2)
Z[inside] = np.minimum(Z[inside], -0.6)
np.save('/home/claude/lbc/dem/Zfull.npy', Z.astype(np.float32))
print(Z.shape, Z.min(), Z.max(), url[:80])
json.dump(dict(x0=X0, y0=Y0, cell=C, nx=len(xs), ny=len(ys)), open('/home/claude/lbc/dem/grid.json', 'w'))
