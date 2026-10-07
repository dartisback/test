"""Anima il logo OBLIVION con gli stessi effetti del logo MYSTERIOUS:
fiamme ondeggianti separate dal guerriero, occhi luminosi, gemma e sfera
pulsanti, bagliore attorno alle fiamme e scintille che salgono.

uso: python3 anima.py 2.png out_dir [sfondo r,g,b | trasparente]
"""
import sys, os, math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
bgarg = sys.argv[3] if len(sys.argv) > 3 else "255,255,255"
os.makedirs(out, exist_ok=True)

N = 40  # fotogrammi per ciclo (2 s a 20 fps)
im = np.array(Image.open(src).convert("RGBA")).astype(np.float32) / 255
H, W = im.shape[:2]
rgb, a = im[..., :3], im[..., 3]
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
V = rgb.max(-1); S = np.where(V > 0, (V - rgb.min(-1)) / np.maximum(V, 1e-6), 0)

# --- separazione fiamme / guerriero ---------------------------------------
flame_col = (a > 0) & (b > g) & (r > g) & (V > 0.5) & (S > 0.12) & (S < 0.6)
fg = (a > 0) & ~flame_col
fg = ndi.binary_opening(fg, iterations=1)
fg = ndi.binary_fill_holes(fg)
lab, n = ndi.label(fg)
sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
fg = np.isin(lab, 1 + np.where(sizes > 300)[0])
flame = (a > 0) & ~fg
# bordo morbido del guerriero: riprende l'alpha originale ai margini esterni
fg_a = np.where(fg, a, 0)
fg_soft = ndi.gaussian_filter(fg.astype(np.float32), 0.6)
fg_a = np.clip(np.maximum(fg_a, fg_soft * a), 0, 1) * (ndi.binary_dilation(fg, iterations=1))

# strato fiamme esteso sotto il guerriero (colore del pixel di fiamma più vicino)
_, (iy, ix) = ndi.distance_transform_edt(~flame, return_indices=True)
fl_rgb = rgb[iy, ix]
fl_a = np.where(flame, a, 0.0)
fl_a = np.where(fg, 1.0, fl_a)  # nascosto dal guerriero, evita buchi quando ondeggia

# intensità del movimento: cresce allontanandosi dal guerriero
dist = ndi.distance_transform_edt(~fg)
strength = np.clip(dist / 30.0, 0, 1) ** 0.8
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# bagliore delle fiamme (alone viola)
glow_base = ndi.gaussian_filter(np.where(flame, 1.0, 0.0).astype(np.float32), 9)
glow_col = np.array([0.62, 0.35, 0.95], np.float32)

def radial(cx, cy, rad):
    d2 = (xx - cx) ** 2 + (yy - cy) ** 2
    return np.exp(-d2 / (2 * rad * rad))

eyes = [(272.3, 160.0), (315.1, 160.0)]
gem = (294.0, 122.5)
orb = (382.5, 362.5)

# scintille: posizioni di partenza sui bordi alti delle fiamme
rng = np.random.default_rng(7)
fy, fx = np.where(flame & (strength > 0.5))
pick = rng.choice(len(fy), 26, replace=False)
sparks = [dict(x=fx[i], y=fy[i], off=rng.random(), rise=rng.uniform(40, 90),
               drift=rng.uniform(-8, 8), size=rng.uniform(1.0, 2.0)) for i in pick]

def warp(ch, dx, dy):
    return ndi.map_coordinates(ch, [yy + dy, xx + dx], order=1, mode="nearest")

if bgarg == "trasparente":
    bg_rgb = None
else:
    bg_rgb = np.array([int(v) for v in bgarg.split(",")], np.float32) / 255

for t in range(N):
    ph = 2 * math.pi * t / N
    # ondeggiamento: onde che salgono (fase dipende da y), periodiche nel ciclo
    dx = strength * (3.2 * np.sin(yy * 0.065 + ph) + 1.4 * np.sin(yy * 0.14 + xx * 0.04 + 2 * ph))
    dy = strength * (2.6 * (1 + np.sin(xx * 0.08 - yy * 0.03 + ph)) + 1.0 * np.sin(yy * 0.11 + 2 * ph))
    wr = np.stack([warp(fl_rgb[..., c], dx, dy) for c in range(3)], -1)
    wa = np.clip(warp(fl_a, dx, dy), 0, 1)
    # tremolio di luminosità
    flick = 1 + 0.10 * np.sin(ph * 2 + yy * 0.05) * strength
    wr = np.clip(wr * flick[..., None], 0, 1)

    # --- composizione: alone -> fiamme -> guerriero -> luci ---
    out_rgb = np.zeros((H, W, 3), np.float32)
    out_a = np.zeros((H, W), np.float32)

    def over(c, al):
        global out_rgb, out_a
        na = al + out_a * (1 - al)
        out_rgb = (c * al[..., None] + out_rgb * out_a[..., None] * (1 - al[..., None])) / np.maximum(na, 1e-6)[..., None]
        out_a = na

    gp = 0.75 + 0.25 * math.sin(ph)
    ga = np.clip(warp(glow_base, dx * 0.5, dy * 0.5) * 0.85 * gp, 0, 1)
    over(np.broadcast_to(glow_col, (H, W, 3)), ga)
    over(wr, wa)
    over(rgb, fg_a)

    # luci additive
    add = np.zeros((H, W, 3), np.float32)
    ep = 0.55 + 0.45 * (0.5 + 0.5 * math.sin(ph * 2))
    for cx, cy in eyes:
        core = radial(cx, cy, 4.0) * 0.9 + radial(cx, cy, 11) * 0.55
        streak = np.exp(-((yy - cy) ** 2) / 2.0 - ((xx - cx) ** 2) / (2 * 22 ** 2)) * 0.5
        add += (core + streak)[..., None] * np.array([0.85, 0.75, 1.0]) * ep
    gpul = 0.5 + 0.5 * math.sin(ph + 1.0)
    add += (radial(*gem, 5) * 0.6 + radial(*gem, 14) * 0.35)[..., None] * np.array([0.75, 0.35, 1.0]) * (0.4 + 0.6 * gpul)
    opul = 0.5 + 0.5 * math.sin(ph - 0.8)
    ring = np.exp(-((np.hypot(xx - orb[0], yy - orb[1]) - 19) ** 2) / (2 * 3.5 ** 2))
    add += (radial(*orb, 9) * 0.45 + radial(*orb, 26) * 0.45 + ring * 0.35)[..., None] \
        * np.array([0.7, 0.35, 1.0]) * (0.35 + 0.65 * opul)
    # riflesso che ruota sulla sfera
    ang = ph
    hx, hy = orb[0] + 9 * math.cos(ang), orb[1] + 9 * math.sin(ang)
    add += radial(hx, hy, 2.5)[..., None] * np.array([1.0, 0.9, 1.0]) * 0.8

    for s in sparks:
        p = (t / N + s["off"]) % 1.0
        sx = s["x"] + s["drift"] * p + 2 * math.sin(p * 6.28 * 2 + s["off"] * 9)
        sy = s["y"] - s["rise"] * p
        fade = math.sin(math.pi * p)
        add += radial(sx, sy, s["size"])[..., None] * np.array([0.95, 0.75, 1.0]) * 1.2 * fade

    add_l = add.max(-1)
    out_rgb = np.clip(out_rgb * out_a[..., None] + add, 0, None)
    out_a = np.clip(out_a + add_l, 0, 1)
    out_rgb = np.clip(out_rgb / np.maximum(out_a, 1e-6)[..., None], 0, 1)

    if bg_rgb is not None:
        final = out_rgb * out_a[..., None] + bg_rgb * (1 - out_a[..., None])
        Image.fromarray((final * 255 + 0.5).astype(np.uint8)).save(f"{out}/f{t:03d}.png")
    else:
        rgba = np.dstack([out_rgb, out_a])
        Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA").save(f"{out}/f{t:03d}.png")
    print(t, end=" ", flush=True)
print()
