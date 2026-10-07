import sys, math, numpy as np
from PIL import Image, ImageFilter, ImageChops, ImageDraw
src, out_dir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
# scale logo to fit
S = 500; target = 380
k = target / max(im.size); im = im.resize((round(im.width*k), round(im.height*k)), Image.LANCZOS)
pad = 60
base = Image.new("RGBA", (im.width+2*pad, im.height+2*pad), (0,0,0,0)); base.paste(im, (pad,pad), im)
A = base.getchannel("A").point(lambda v: 255 if v > 40 else 0)
def dilate(a, r):
    return a.filter(ImageFilter.GaussianBlur(r)).point(lambda v: 255 if v > 8 else 0).filter(ImageFilter.GaussianBlur(1))
white = dilate(A, 9); dark = dilate(A, 11)
# sticker: dark thin edge, white shape, logo on top
sticker = Image.new("RGBA", base.size, (0,0,0,0))
sticker.paste(Image.new("RGBA", base.size, (25,10,40,255)), (0,0), dark)
sticker.paste(Image.new("RGBA", base.size, (255,255,255,255)), (0,0), white)
sticker = Image.alpha_composite(sticker, base)
glow_mask = dark.filter(ImageFilter.GaussianBlur(14))
W, H = sticker.size
N = 60  # frames
frames = []
for i in range(N):
    t = i / N
    # spin 360 during first 40% of loop, then hold
    sp = min(t/0.4, 1.0); sp = 0.5 - 0.5*math.cos(math.pi*sp)
    ang = 2*math.pi*sp; c = math.cos(ang)
    face = sticker if c >= 0 else sticker.transpose(Image.FLIP_LEFT_RIGHT)
    face = face.copy()
    # purple light sweep after spin
    if t > 0.45:
        st = (t-0.45)/0.4
        if st <= 1:
            sw = Image.new("L", (W, H), 0); d = ImageDraw.Draw(sw)
            x = -W*0.4 + st*W*1.8
            d.polygon([(x,0),(x+60,0),(x-H*0.5+60,H),(x-H*0.5,H)], fill=200)
            sw = sw.filter(ImageFilter.GaussianBlur(18))
            sw = ImageChops.multiply(sw, face.getchannel("A"))
            light = Image.new("RGBA", (W,H), (225,170,255,0)); light.putalpha(sw)
            face = Image.alpha_composite(face, light)
    w = max(2, int(abs(c)*W))
    face = face.resize((w, H), Image.LANCZOS)
    if c < 0.98:  # shade during spin
        shade = Image.new("RGBA", face.size, (60,0,90,int(110*(1-abs(c)))))
        shade.putalpha(ImageChops.multiply(shade.getchannel("A"), face.getchannel("A")))
        face = Image.alpha_composite(face, shade)
    # purple glow pulse
    pulse = 0.65 + 0.35*math.sin(2*math.pi*t*2)
    g = glow_mask.resize((w, H)).point(lambda v: min(255, int(v*1.6*pulse)))
    g = g.filter(ImageFilter.GaussianBlur(6))
    frame = Image.new("RGBA", (S, S), (0,0,0,0))
    sc = S / max(W, H); fw, fh = int(w*sc), int(H*sc)
    ox, oy = (S - fw)//2, (S - fh)//2
    glow = Image.new("RGBA", (w,H), (170,60,255,0)); glow.putalpha(g)
    big = Image.new("RGBA", (w+80, H+80), (0,0,0,0)); big.paste(glow, (40,40))
    big = big.filter(ImageFilter.GaussianBlur(10))
    big = big.resize((int((w+80)*sc), int((H+80)*sc)))
    frame.alpha_composite(big, (ox-int(40*sc), oy-int(40*sc)))
    frame.alpha_composite(face.resize((max(1,fw), fh), Image.LANCZOS), (ox, oy))
    frames.append(frame)
def save(name, bg):
    outs = []
    for f in frames:
        b = Image.new("RGBA", f.size, bg + (255,)); b.alpha_composite(f)
        outs.append(b.convert("RGB"))
    outs[0].save(f"{out_dir}/{name}", save_all=True, append_images=outs[1:], duration=50, loop=0, optimize=True)
def save_transparent(name):
    outs = []
    for f in frames:
        a = np.array(f); al = a[...,3]
        rgb = Image.new("RGBA", f.size, (255,255,255,255)); rgb.alpha_composite(f)
        p = rgb.convert("RGB").quantize(255, method=Image.MEDIANCUT, dither=Image.NONE)
        pa = np.array(p); pa[al < 100] = 255
        p2 = Image.fromarray(pa.astype(np.uint8), "P"); pal = p.getpalette()[:765] + [0,0,0]; p2.putpalette(pal)
        p2.info["transparency"] = 255; outs.append(p2)
    outs[0].save(f"{out_dir}/{name}", save_all=True, append_images=outs[1:], duration=50, loop=0, transparency=255, disposal=2)
save("oblivion_animato_bianco.gif", (255,255,255))
save("oblivion_animato_nero.gif", (12,6,20))
save_transparent("oblivion_animato_trasparente.gif")
for j in (0, 6, 12, 30, 40): frames[j].save(f"prev{j}.png")
