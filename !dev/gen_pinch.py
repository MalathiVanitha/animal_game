"""Bake the diagonal 'pinch' border pieces out of the existing corner + bar art.

Where two solid cells touch only at a corner, the two outward corner caps land on
the same grid point facing each other and overlap into an S, so the two cells read
as one connected board. This bakes one piece for that junction instead: each cap
pulled back along the diagonal to open a gap between the cells, and the bar tails
bent back onto their own edges inside the cap's own footprint - so the piece drops
straight in where the two caps used to go and nothing else about the frame moves.

    python3 gen_pinch.py [pull] [curve] [dest/]

The pieces the game ships were baked with the defaults below, and board-border.js
draws the slab to the same shape: PINCH_PULL is this pull and PINCH_HOLD is
pull + curve. Change one here and change it there too.
"""
import os, sys, json
from PIL import Image
import numpy as np

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "source", "board_borders") + os.sep

BAR_TOP = 21.5; BAR_SIDE = 16.5; RIGHT_BAR_INSET = 4.5
CORNER_INSET_X = 82.5; CORNER_INSET_Y = 70

PULL = float(sys.argv[1]) if len(sys.argv) > 1 else 20.0   # how far each cap pulls back
CURVE = float(sys.argv[2]) if len(sys.argv) > 2 else 18.0  # cap kept whole this far from the corner
DEST = sys.argv[3] if len(sys.argv) > 3 else SRC

_cache = {}
def img(n):
    if n not in _cache: _cache[n] = Image.open(SRC + n + ".png").convert("RGBA")
    return _cache[n]

def rnd(v):
    """half-up: round-half-even would drop or double a column every other step
    along a tail that starts on a .5 offset"""
    return int(np.floor(v + 0.5))

def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

# One half of a junction: the solid cell lying diagonally (sx, sy) from the point.
def half(sx, sy):
    return dict(
        sx=sx, sy=sy,
        cap=("bottom" if sy < 0 else "top") + ("_right" if sx < 0 else "_left"),
        # where the junction sits inside the cap sprite
        cpx=CORNER_INSET_X if sx < 0 else BAR_SIDE,
        cpy=CORNER_INSET_Y if sy < 0 else BAR_TOP,
        # the bars along the cell's two edges, running away from the junction
        h=dict(sprite="bottom" if sy < 0 else "top", off=0.0 if sy < 0 else -BAR_TOP),
        v=dict(sprite="right" if sx < 0 else "left", off=-RIGHT_BAR_INSET if sx < 0 else -BAR_SIDE),
    )

def build(kind):
    halves = [half(-1, -1), half(1, 1)] if kind == "down" else [half(1, -1), half(-1, 1)]

    ext = 0
    for h in halves:
        s = img(h["cap"])
        ext = max(ext, h["cpx"], s.width - h["cpx"], h["cpy"], s.height - h["cpy"])
    ext = int(np.ceil(ext))
    W = H = ext * 2
    canvas = np.zeros((H, W, 4), dtype=float)

    def blend(x, y, patch):
        ph, pw = patch.shape[:2]
        x0 = max(0, x); y0 = max(0, y); x1 = min(W, x + pw); y1 = min(H, y + ph)
        if x1 <= x0 or y1 <= y0: return
        sub = patch[y0 - y:y1 - y, x0 - x:x1 - x]
        base = canvas[y0:y1, x0:x1]
        sa = sub[..., 3:4] / 255.0
        ba = base[..., 3:4] / 255.0
        out_a = sa + ba * (1 - sa)
        out_rgb = np.where(out_a > 0, (sub[..., :3] * sa + base[..., :3] * ba * (1 - sa)) / np.maximum(out_a, 1e-6), 0)
        base[..., :3] = out_rgb
        base[..., 3:4] = out_a * 255

    taper_used = []

    for h in halves:
        cap = np.array(img(h["cap"])).astype(float)
        sx, sy = h["sx"], h["sy"]

        # Tails: from the outer end of the cap's footprint, sitting exactly on the
        # bar line, bending over to the pulled back corner.
        capw, caph = img(h["cap"]).size
        hspan = h["cpx"] if sx < 0 else capw - h["cpx"]
        vspan = h["cpy"] if sy < 0 else caph - h["cpy"]

        for axis, span in (("h", hspan), ("v", vspan)):
            bar = h[axis]
            src = np.array(img(bar["sprite"]))
            strip = (src[:, src.shape[1] // 2, :] if axis == "h" else src[src.shape[0] // 2, :, :]).astype(float)
            strip = strip.reshape(-1, 1, 4) if axis == "h" else strip.reshape(1, -1, 4)
            sign = sx if axis == "h" else sy          # which way the tail runs
            pull = (sy if axis == "h" else sx) * PULL # which way it is pulled
            taper = span - CURVE - PULL
            taper_used.append(round(taper, 1))
            # from the outer end of the footprint in to where the corner crop takes over
            for n in range(int(round(taper)) + 1):
                along = sign * (span - n)
                dist = abs(along)
                off = bar["off"] + pull * smooth(1 - (dist - CURVE - PULL) / taper)
                if axis == "h": blend(rnd(along) + ext, rnd(off) + ext, strip)
                else: blend(rnd(off) + ext, rnd(along) + ext, strip)

        # The corner itself, kept whole and slid back along the diagonal.
        cx0 = 0 if sx > 0 else int(round(h["cpx"] - CURVE))
        cx1 = cap.shape[1] if sx < 0 else int(round(h["cpx"] + CURVE))
        cy0 = 0 if sy > 0 else int(round(h["cpy"] - CURVE))
        cy1 = cap.shape[0] if sy < 0 else int(round(h["cpy"] + CURVE))
        crop = cap[max(0, cy0):cy1, max(0, cx0):cx1]
        blend(rnd(max(0, cx0) - h["cpx"] + sx * PULL) + ext,
              rnd(max(0, cy0) - h["cpy"] + sy * PULL) + ext, crop)

    return Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)), ext, taper_used

info = {"pull": PULL, "curve": CURVE}
for kind in ("down", "up"):
    im, ext, tapers = build(kind)
    im.save(DEST + "pinch_" + kind + ".png")
    info[kind] = dict(size=im.size[0], half=ext, tapers=tapers)
    print(kind, im.size, "half extent", ext, "tapers", tapers)
print(json.dumps(info))
