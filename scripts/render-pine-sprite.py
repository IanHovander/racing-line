"""Render a low-poly, model-railway spruce into a transparent PNG sprite."""

import math
import os
import random
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public")
WIDTH, HEIGHT, SCALE = 512, 768, 2


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def mul(a, s):
    return tuple(x * s for x in a)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def unit(a):
    n = math.sqrt(dot(a, a)) or 1
    return mul(a, 1 / n)


def rgb(hex_color):
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def vary(color, amount):
    return tuple(max(0, min(255, int(c * amount))) for c in color)


def cylinder(mesh, a, b, r0, r1, color, seed, sides=7):
    axis = unit(sub(b, a))
    ref = (0, 0, 1) if abs(axis[2]) < 0.9 else (1, 0, 0)
    u = unit(cross(axis, ref))
    v = unit(cross(axis, u))
    ring_a, ring_b = [], []
    for i in range(sides):
        ang = 2 * math.pi * i / sides + seed * 0.07
        radial = add(mul(u, math.cos(ang)), mul(v, math.sin(ang)))
        ring_a.append(add(a, mul(radial, r0)))
        ring_b.append(add(b, mul(radial, r1)))
    for i in range(sides):
        j = (i + 1) % sides
        col = vary(color, 0.9 + ((i + seed) % 4) * 0.045)
        mesh.append((ring_a[i], ring_a[j], ring_b[j], col))
        mesh.append((ring_a[i], ring_b[j], ring_b[i], col))


def cluster(mesh, center, radii, base, rng, sides=12):
    """Small faceted ellipsoid clumps approximate flocked needle masses."""
    rx, ry, rz = radii
    ring_hi, ring_lo = [], []
    phase = rng.random() * math.pi * 2
    for i in range(sides):
        ang = phase + 2 * math.pi * i / sides
        jitter = 0.93 + rng.random() * 0.14
        ring_hi.append((center[0] + math.cos(ang) * rx * jitter,
                        center[1] + math.sin(ang) * ry * jitter,
                        center[2] + rz * 0.34))
        ring_lo.append((center[0] + math.cos(ang + 0.12) * rx * jitter,
                        center[1] + math.sin(ang + 0.12) * ry * jitter,
                        center[2] - rz * 0.38))
    top = (center[0], center[1], center[2] + rz)
    bot = (center[0], center[1], center[2] - rz)
    for i in range(sides):
        j = (i + 1) % sides
        for tri in ((top, ring_hi[i], ring_hi[j]),
                    (ring_hi[i], ring_lo[i], ring_hi[j]),
                    (ring_hi[j], ring_lo[i], ring_lo[j]),
                    (bot, ring_lo[j], ring_lo[i])):
            shade = 0.92 + rng.random() * 0.16
            mesh.append((*tri, vary(base, shade)))


def needle_spray(mesh, center, radial, base, rng):
    """Individual pointed needle fans give the boughs texture at sprite scale."""
    tangent = (-radial[1], radial[0], 0)
    for _ in range(14):
        direction = unit((radial[0] * rng.uniform(0.35, 0.9) + tangent[0] * rng.uniform(-0.6, 0.6),
                          radial[1] * rng.uniform(0.35, 0.9) + tangent[1] * rng.uniform(-0.6, 0.6),
                          rng.uniform(-0.1, 0.85)))
        length = rng.uniform(0.12, 0.25)
        width = rng.uniform(0.015, 0.027)
        tip = add(center, mul(direction, length))
        side = unit(cross(direction, tangent))
        if dot(side, side) < 0.5:
            side = (0, 0, 1)
        a = add(center, mul(side, width))
        b = add(center, mul(side, -width))
        mesh.append((a, b, tip, vary(base, rng.uniform(0.9, 1.1))))


def make_tree(variant):
    rng = random.Random(347 + variant * 919)
    mesh = []
    bark = rgb("#765331" if variant == 0 else "#795638")
    cylinder(mesh, (0, 0, 0.03), (0, 0, 3.8), 0.115, 0.025, bark, 0, 9)
    # Low, spreading roots help the trunk sit naturally in the ground plane.
    for i in range(6):
        a = i * math.pi / 3
        end = (math.cos(a) * 0.32, math.sin(a) * 0.32, 0.015)
        cylinder(mesh, (0, 0, 0.24), end, 0.05, 0.012, bark, i + 2, 5)

    greens = [rgb(c) for c in (
        ("#193d26", "#285638", "#397047", "#527d4a", "#77935b")
        if variant == 0 else
        ("#183a25", "#2b5938", "#41754b", "#5c8750", "#81965e")
    )]
    # Branch whorls taper toward the top. Each arm droops and carries several
    # three-dimensional needle clumps instead of a flat triangular bough.
    levels = [(0.48, 1.10), (0.80, 1.12), (1.12, 1.06), (1.44, 0.98),
              (1.76, 0.88), (2.08, 0.77), (2.40, 0.65), (2.70, 0.53),
              (2.98, 0.41), (3.24, 0.29), (3.46, 0.17)]
    for level, (z, max_radius) in enumerate(levels):
        count = 14 if level < 6 else 12
        phase = level * 0.39 + variant * 0.11
        base = greens[min(4, 1 + level // 2)]
        for arm in range(count):
            angle = phase + arm * (2 * math.pi / count) + rng.uniform(-0.08, 0.08)
            length = max_radius * rng.uniform(0.82, 1.08)
            direction = (math.cos(angle), math.sin(angle))
            start = (0, 0, z + rng.uniform(-0.035, 0.035))
            end = (direction[0] * length, direction[1] * length, z - length * 0.20)
            cylinder(mesh, start, end, 0.055 * (1 - level * 0.055), 0.016, bark, level * 31 + arm, 5)
            for k in range(1, 7):
                t = k / 7
                px = direction[0] * length * t
                py = direction[1] * length * t
                pz = z - length * 0.20 * t
                center = (px, py, pz + 0.04)
                spread = 0.105 + 0.035 * (1 - t) + max_radius * 0.02
                cluster(mesh, center, (spread * 1.1, spread * 0.9, spread * 0.72),
                        greens[min(4, 1 + level // 2 + (k % 3 == 0))], rng)
                needle_spray(mesh, center, (direction[0], direction[1], 0),
                             greens[min(4, 1 + level // 2 + (k % 3 == 0))], rng)
                # Short side sprays create the characteristic layered branch fans.
                for side in (-1, 1):
                    twig = (px + direction[0] * 0.045 - direction[1] * 0.055 * side,
                            py + direction[1] * 0.045 + direction[0] * 0.055 * side,
                            pz - 0.025)
                    needle_spray(mesh, twig, (direction[0] - side * direction[1] * 0.5,
                                              direction[1] + side * direction[0] * 0.5, 0),
                                 greens[min(4, 2 + level // 3 + (side > 0))], rng)
        # A few short shoots near the trunk fill the interior while leaving
        # openings between the lower boughs, as in a miniature spruce.
        for _ in range(4):
            a = rng.random() * math.tau
            r = max_radius * rng.uniform(0.15, 0.45)
            needle_spray(mesh, (math.cos(a) * r, math.sin(a) * r, z - 0.04),
                         (math.cos(a), math.sin(a), 0), base, rng)
    # Central leader and a small crown of young needles.
    for i in range(7):
        a = i * math.tau / 7
        cluster(mesh, (math.cos(a) * 0.11, math.sin(a) * 0.11, 3.43 + (i % 2) * 0.08),
                (0.15, 0.14, 0.19), greens[3 + (i % 2)], rng)
    cylinder(mesh, (0, 0, 3.35), (0, 0, 3.84), 0.034, 0.01, bark, 99, 7)
    return mesh


def render(mesh, variant):
    w, h = WIDTH * SCALE, HEIGHT * SCALE
    camera = (3.9 + variant * 0.45, -7.2, 4.75)
    target = (0, 0, 0.0)
    forward = unit(sub(target, camera))
    right = unit(cross(forward, (0, 0, 1)))
    up = unit(cross(right, forward))
    world_width, world_height = 4.2, 4.8
    light = unit((-0.45, -0.65, 1.0))
    pixels = bytearray(w * h * 4)
    depth = [float("inf")] * (w * h)
    projected = []
    for a, b, c, color in mesh:
        pts = []
        for p in (a, b, c):
            q = sub(p, target)
            sx = (dot(q, right) / world_width + 0.5) * w
            sy = (0.94 - dot(q, up) / world_height) * h
            pts.append((sx, sy, dot(q, forward)))
        projected.append((pts, color, (a, b, c)))
    for pts, color, verts in projected:
        (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = pts
        area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)
        if abs(area) < 0.001:
            continue
        min_x = max(0, int(min(x0, x1, x2)))
        max_x = min(w - 1, int(max(x0, x1, x2)) + 1)
        min_y = max(0, int(min(y0, y1, y2)))
        max_y = min(h - 1, int(max(y0, y1, y2)) + 1)
        normal = unit(cross(sub(verts[1], verts[0]), sub(verts[2], verts[0])))
        diffuse = abs(dot(normal, light))
        shade = 0.56 + diffuse * 0.48
        face = tuple(max(0, min(255, int(c * shade))) for c in color)
        for py in range(min_y, max_y + 1):
            fy = py + 0.5
            for px in range(min_x, max_x + 1):
                fx = px + 0.5
                wa = ((x1 - fx) * (y2 - fy) - (y1 - fy) * (x2 - fx)) / area
                wb = ((x2 - fx) * (y0 - fy) - (y2 - fy) * (x0 - fx)) / area
                wc = 1 - wa - wb
                if wa < -0.0001 or wb < -0.0001 or wc < -0.0001:
                    continue
                z = wa * z0 + wb * z1 + wc * z2
                idx = py * w + px
                if z >= depth[idx]:
                    continue
                depth[idx] = z
                p = idx * 4
                pixels[p:p + 4] = bytes((*face, 255))
    return downsample(pixels, w, h)


def downsample(src, w, h):
    out = bytearray(WIDTH * HEIGHT * 4)
    for y in range(HEIGHT):
        for x in range(WIDTH):
            si = ((y * 2) * w + x * 2) * 4
            oi = (y * WIDTH + x) * 4
            for ch in range(4):
                out[oi + ch] = (src[si + ch] + src[si + 4 + ch] + src[si + w * 4 + ch] + src[si + w * 4 + 4 + ch]) // 4
    return out


def write_png(path, rgba):
    raw = bytearray()
    stride = WIDTH * 4
    for y in range(HEIGHT):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = bytearray(b"\x89PNG\r\n\x1a\n")
    png += chunk(b"IHDR", struct.pack(">2I5B", WIDTH, HEIGHT, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


os.makedirs(OUT, exist_ok=True)
for variant in (0, 1):
    path = os.path.join(OUT, f"pine-sprite-{variant}.png")
    write_png(path, render(make_tree(variant), variant))
    print(path)
