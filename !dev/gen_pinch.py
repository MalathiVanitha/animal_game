"""Bake the diagonal 'pinch' border pieces out of the existing bar art.

Where two solid cells touch only at a corner, both of them want a corner piece on
that one grid point, facing each other, and the two overlap into a single S bend -
so the pair reads as one connected board. This bakes one piece for that junction
instead: each cell's frame sweeps round it on a wide arc that pulls back off the
point, opening a gap between the two cells.

The arc is swept from the bar art itself - the cross section of the top/bottom bar
turning into the cross section of the left/right one - so the piece is the same
tubing as the rest of the frame, just on a lazier curve than a corner piece. It
lands inside the footprint of the two corner pieces it replaces, so it drops
straight in and nothing else about the frame has to move.

    python3 gen_pinch.py [radius] [dest/]

board-border.js draws the slab to the same curve: PINCH_RADIUS is this radius, and
BAR_CENTER_H / BAR_CENTER_V are the bar centres printed below. Change one here and
change it there too.
"""
import os, sys, json
from PIL import Image
import numpy as np

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "source", "board_borders") + os.sep

BAR_TOP = 21.5; BAR_SIDE = 16.5; RIGHT_BAR_INSET = 4.5
CORNER_INSET_X = 82.5; CORNER_INSET_Y = 70
CORNER_SIZE = 100

RADIUS = float(sys.argv[1]) if len(sys.argv) > 1 else 68.0
DEST = sys.argv[2] if len(sys.argv) > 2 else SRC

HALF = 84       # the piece is square and centred on the junction, like the pair it replaces
SAMPLES = 3     # supersampling per pixel, so the sweep comes out with clean edges

_cache = {}
def bar(name):
    if name not in _cache: _cache[name] = np.array(Image.open(SRC + name + ".png").convert("RGBA")).astype(float)
    return _cache[name]

# A bar sprite is uniform along its run, so one slice across it is the whole shape:
# the profile the sweep carries round the corner.
def profile(name, horizontal):
    a = bar(name)
    return a[:, a.shape[1] // 2, :] if horizontal else a[a.shape[0] // 2, :, :]

# ...and the middle of its solid core is where the centre line of the sweep runs.
def core_centre(strip):
    solid = np.where(strip[:, 3] >= 200)[0]
    return (solid[0] + solid[-1]) / 2

# One half of a junction: the solid cell lying diagonally (sx, sy) from the point,
# with its two bars turning into each other around the corner nearest the point.
def half(sx, sy):
    h = "bottom" if sy < 0 else "top"
    v = "right" if sx < 0 else "left"

    hstrip = profile(h, True)
    vstrip = profile(v, False)

    # where each bar sits relative to the cell edge it runs along
    hoff = 0.0 if sy < 0 else -BAR_TOP
    voff = -RIGHT_BAR_INSET if sx < 0 else -BAR_SIDE

    return dict(
        sx=sx, sy=sy, outx=-sx, outy=-sy,
        hstrip=hstrip, vstrip=vstrip,
        hcentre=hoff + core_centre(hstrip),   # the bar centre lines, in junction space
        vcentre=voff + core_centre(vstrip),
        hindex=core_centre(hstrip), vindex=core_centre(vstrip),
        # how far the piece reaches: exactly what the corner piece it replaces covered
        hspan=CORNER_INSET_X if sx < 0 else CORNER_SIZE - BAR_SIDE,
        vspan=CORNER_INSET_Y if sy < 0 else CORNER_SIZE - BAR_TOP,
    )

def sample(strip, index, centre, out):
    """the bar's cross section, read at a signed distance out from its centre line"""
    at = centre + index * out
    rgba = np.empty(index.shape + (4,))
    xs = np.arange(strip.shape[0])
    for c in range(4):
        rgba[..., c] = np.interp(at, xs, strip[:, c], left=0, right=0)
    return rgba

def build(kind):
    halves = [half(-1, -1), half(1, 1)] if kind == "down" else [half(1, -1), half(-1, 1)]

    n = HALF * 2 * SAMPLES
    step = 1.0 / SAMPLES
    axis = -HALF + (np.arange(n) + 0.5) * step
    X, Y = np.meshgrid(axis, axis)

    out = np.zeros((n, n, 4))

    for h in halves:

        cy = h["hcentre"]           # the horizontal bar's centre line
        cx = h["vcentre"]           # ...and the vertical one's
        cornerX, cornerY = cx, cy   # where the two would meet if they ran on

        # The arc is tangent to both centre lines, pulled back into the cell so the
        # two halves of the junction come apart.
        centreX = cornerX + h["sx"] * RADIUS
        centreY = cornerY + h["sy"] * RADIUS

        u = (X - centreX) * h["outx"]
        v = (Y - centreY) * h["outy"]

        turning = (u >= 0) & (v >= 0)
        running_v = ~turning & (v < 0)   # past the arc, straight along the vertical bar

        # distance out from the centre line, and how far round the turn we are
        dist = np.hypot(u, v) - RADIUS
        along = np.where(turning, dist, np.where(running_v, (X - cx) * h["outx"], (Y - cy) * h["outy"]))
        turn = np.where(turning, 1 - np.arctan2(np.maximum(v, 0), np.maximum(u, 0)) / (np.pi / 2),
                        np.where(running_v, 1.0, 0.0))

        # the straight runs stop where the corner pieces used to stop
        within = np.where(turning, True,
                          np.where(running_v, Y * h["sy"] <= h["vspan"], X * h["sx"] <= h["hspan"]))

        hcol = sample(h["hstrip"], along, h["hindex"], h["outy"])
        vcol = sample(h["vstrip"], along, h["vindex"], h["outx"])

        # cross fade the two cross sections around the turn, on premultiplied alpha
        t = turn[..., None]
        pre = hcol[..., :3] * hcol[..., 3:4] * (1 - t) + vcol[..., :3] * vcol[..., 3:4] * t
        alpha = hcol[..., 3:4] * (1 - t) + vcol[..., 3:4] * t
        alpha = np.where(within[..., None], alpha, 0)

        rgb = np.where(alpha > 0, pre / np.maximum(alpha, 1e-6), 0)

        # over what is already there
        sa = alpha / 255.0
        ba = out[..., 3:4] / 255.0
        oa = sa + ba * (1 - sa)
        out[..., :3] = np.where(oa > 0, (rgb * sa + out[..., :3] * ba * (1 - sa)) / np.maximum(oa, 1e-6), 0)
        out[..., 3:4] = oa * 255

    # back down from the supersampled grid
    out = out.reshape(HALF * 2, SAMPLES, HALF * 2, SAMPLES, 4)
    pre = out[..., :3] * out[..., 3:4]
    alpha = out[..., 3:4].mean(axis=(1, 3))
    rgb = np.where(alpha > 0, pre.mean(axis=(1, 3)) / np.maximum(alpha, 1e-6), 0)

    flat = np.concatenate([rgb, alpha], axis=-1)
    return Image.fromarray(np.clip(flat, 0, 255).astype(np.uint8)), halves

info = {"radius": RADIUS, "half": HALF}
for kind in ("down", "up"):
    im, halves = build(kind)
    im.save(DEST + "pinch_" + kind + ".png")
    info[kind] = [{"cell": [h["sx"], h["sy"]], "hcentre": round(h["hcentre"], 2), "vcentre": round(h["vcentre"], 2)} for h in halves]
    print(kind, im.size)
print(json.dumps(info, indent=1))
