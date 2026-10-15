"""Genera l'animazione del logo Next Rome che gira (sfondo trasparente).

Effetti ripresi dal logo centrale dell'originale:
  * logo al centro che ruota su se stesso con motion blur rotazionale
  * copie "fantasma" che partono dal centro e volano verso i bordi,
    ingrandendosi, ruotando e sfumate con motion blur radiale
Uso: python3 generate.py   ->  next-rome-spin.webp / next-rome-spin.png (APNG)
"""
import math
import os

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 800, 450
FRAMES, FPS = 72, 24
CENTER = np.array([W / 2, H / 2])
CENTER_H = 150          # altezza del logo al centro (px)
GHOSTS = 3              # copie che volano verso i bordi
GHOST_DIRS = [200, 335, 95]  # direzione di fuga (gradi)

src = Image.open(os.path.join(HERE, "next-rome-logo.png")).convert("RGBA")
alpha = np.array(src)[..., 3]
src = src.crop(Image.fromarray((alpha > 24).astype(np.uint8) * 255).getbbox())


def logo(height):
    w = round(src.width * height / src.height)
    return src.resize((w, round(height)), Image.LANCZOS)


BASE = logo(CENTER_H)


def place(img, pos, angle, scale):
    """Ruota/scala img attorno al suo centro e lo posa su una tela WxH (RGBA float premoltiplicato)."""
    s = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.BICUBIC)
    s = s.rotate(angle, resample=Image.BICUBIC, expand=True)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(s, (round(pos[0] - s.width / 2), round(pos[1] - s.height / 2)), s)
    a = np.asarray(canvas, dtype=np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]
    return a


def blurred(state, samples):
    """Media di piu' pose lungo l'intervallo di tempo = motion blur vero."""
    acc = np.zeros((H, W, 4), np.float32)
    for sub in np.linspace(-0.5, 0.5, samples):
        acc += place(BASE, *state(sub))
    return acc / samples


def over(dst, src_, opacity=1.0):
    s = src_ * opacity
    return s + dst * (1 - s[..., 3:4])


def render(frame):
    t = frame / FRAMES            # 0..1, loop perfetto
    dt = 1.0 / FRAMES             # durata di un frame (per la sfocatura)
    out = np.zeros((H, W, 4), np.float32)

    # --- copie fantasma: nascono al centro, volano ai bordi, ingrandendosi ---
    for g in range(GHOSTS):
        p = (t + g / GHOSTS) % 1.0
        ease = p ** 2.2
        d = math.radians(GHOST_DIRS[g])
        direction = np.array([math.cos(d), -math.sin(d)])

        def state(sub, p=p, direction=direction, g=g):
            q = max(0.0, p + sub * dt * 2.0)
            e = q ** 2.2
            pos = CENTER + direction * e * 560
            scale = 0.55 + e * 3.6
            angle = -70 + q * 150 * (1 if g % 2 == 0 else -1) - g * 40
            return pos, angle, scale

        ghost = blurred(state, 9)
        # sfocatura gaussiana crescente con la velocita' (profondita' di campo)
        img = Image.fromarray((np.clip(ghost, 0, 1) * 255).astype(np.uint8), "RGBA")
        img = img.filter(ImageFilter.GaussianBlur(0.3 + 2.5 * ease))
        ghost = np.asarray(img, np.float32) / 255.0
        fade = min(1.0, p / 0.12) * (1 - p) ** 0.6   # dissolvenza in entrata/uscita
        out = over(out, ghost, 0.85 * fade)

    # --- logo centrale: rotazione continua + pulsazione + motion blur ---
    turns = 2

    def center_state(sub):
        tt = t + sub * dt * 0.7
        angle = -360 * turns * tt
        pulse = 1.0 + 0.04 * math.sin(2 * math.pi * tt * 2)
        return CENTER, angle, pulse

    c = blurred(center_state, 12)
    # alone luminoso sul logo
    glow = Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(8))
    glow = np.asarray(glow, np.float32) / 255.0
    glow[..., :3] = glow[..., 3:4] * np.array([0.55, 0.8, 1.0], np.float32)
    out = over(out, glow, 0.4)
    out = over(out, c)

    rgb = out[..., :3] / np.maximum(out[..., 3:4], 1e-6)
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.clip(out[..., 3:4], 0, 1)], axis=-1)
    return Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA")


if __name__ == "__main__":
    frames = [render(i) for i in range(FRAMES)]
    dur = round(1000 / FPS)
    frames[0].save(os.path.join(HERE, "next-rome-spin.webp"), save_all=True, append_images=frames[1:],
                   duration=dur, loop=0, lossless=True, quality=90, method=4)
    frames[0].save(os.path.join(HERE, "next-rome-spin.png"), save_all=True, append_images=frames[1:],
                   duration=dur, loop=0, disposal=1)
    print("ok", len(frames), "frames")
