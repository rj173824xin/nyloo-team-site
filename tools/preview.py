#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把战队展示页渲染成预览图。

为什么需要这个：当前沙箱禁止浏览器多进程 IPC（mojo channel 拒绝访问），
无头截图拿不到图。本脚本改用 Pillow 按 CSS 里的真实设计变量重绘页面，
配色、排版、内容都取自 css/styles.css 与 data/team.json，
用于在没有浏览器的情况下确认视觉方案。

用法: python tools/preview.py
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

# Windows 控制台默认 GBK，强制 UTF-8 输出，避免中文/符号报错
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, ".shots")
os.makedirs(OUT, exist_ok=True)

# ---------- 设计变量：与 css/styles.css 的 :root 保持一致 ----------
BG        = (10, 12, 18)
BG_ALT    = (13, 16, 23)
CARD      = (18, 21, 31)
CARD_HI   = (23, 27, 39)
LINE      = (35, 40, 56)
ACCENT    = (0, 229, 255)
ACCENT2   = (168, 85, 247)
TEXT      = (230, 233, 240)
MUTED     = (139, 147, 167)
WHITE     = (255, 255, 255)

# ---------- 字体 ----------
# 注意：数字+中文单位混排必须用中文字体（msyh），
# Consolas 等纯英文等宽字体不含「人」「场」这类汉字，会渲染成豆腐块。
FONTS = {
    "black":  "C:/Windows/Fonts/msyhbd.ttc",
    "bold":   "C:/Windows/Fonts/msyhbd.ttc",
    "reg":    "C:/Windows/Fonts/msyh.ttc",
    "mono":   "C:/Windows/Fonts/msyh.ttc",
    "mononum": "C:/Windows/Fonts/consola.ttf",
}
_font_cache = {}


def font(kind, size):
    key = (kind, size)
    if key not in _font_cache:
        path = FONTS.get(kind, FONTS["reg"])
        try:
            _font_cache[key] = ImageFont.truetype(path, size)
        except Exception:
            _font_cache[key] = ImageFont.load_default()
    return _font_cache[key]


def has_cjk(s):
    return any("\u4e00" <= c <= "\u9fff" for c in str(s))


def font_smart(kind, size, text):
    """文本含中文时自动改用中文字体，避免豆腐块"""
    if has_cjk(text) and kind in ("mono", "mononum"):
        return font("reg", size)
    return font(kind, size)


def grad(w, h, c1, c2, horizontal=True):
    """生成线性渐变条"""
    g = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(g)
    n = w if horizontal else h
    for i in range(n):
        t = i / max(n - 1, 1)
        col = tuple(int(c1[k] + (c2[k] - c1[k]) * t) for k in range(3))
        if horizontal:
            d.line([(i, 0), (i, h)], fill=col)
        else:
            d.line([(0, i), (w, i)], fill=col)
    return g


def text_grad(img, xy, s, f, c1, c2, anchor="la"):
    """渐变文字：先画文字蒙版，再贴渐变"""
    tmp = Image.new("L", img.size, 0)
    ImageDraw.Draw(tmp).text(xy, s, font=f, fill=255, anchor=anchor)
    bbox = tmp.getbbox()
    if not bbox:
        return
    x0, y0, x1, y1 = bbox
    g = grad(x1 - x0, y1 - y0, c1, c2)
    img.paste(g, (x0, y0), tmp.crop(bbox))


def wrap(draw, s, f, max_w):
    """按像素宽度折行，兼容中英文"""
    lines, cur = [], ""
    for ch in s:
        if ch == "\n":
            lines.append(cur); cur = ""; continue
        if draw.textlength(cur + ch, font=f) <= max_w:
            cur += ch
        else:
            lines.append(cur); cur = ch
    if cur:
        lines.append(cur)
    return lines


def rr(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def load_avatar(svg_path, size):
    # 真实位图头像（jpg/png）：直接读取并裁成圆形
    ext = os.path.splitext(svg_path)[1].lower()
    if ext in (".jpg", ".jpeg", ".png", ".webp") and os.path.exists(svg_path):
        try:
            im = Image.open(svg_path).convert("RGBA")
            w, h = im.size
            side = min(w, h)
            im = im.crop(((w - side) // 2, (h - side) // 2,
                          (w - side) // 2 + side, (h - side) // 2 + side))
            im = im.resize((size, size), Image.LANCZOS)
            mask = Image.new("L", (size, size), 0)
            ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
            out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            out.paste(im, (0, 0), mask)
            return out
        except Exception:
            return None

    """
    读取头像。SVG 无法直接用 Pillow 渲染，这里对手绘头像做少量硬编码还原；
    其他 SVG 一律返回 None，交给调用方回退字母头像。
    """
    if not os.path.exists(svg_path):
        return None
    name = os.path.basename(svg_path)

    # 大肥鱼：橘色鱼 + 耳机
    if name == "avatar-dafeiyu.svg":
        S = 4
        n = size * S
        im = Image.new("RGBA", (n, n), (18, 21, 31, 255))
        dd = ImageDraw.Draw(im)
        k = n / 96.0

        # 水波
        import math as _m
        for y0, col in [(28, (0, 70, 82)), (36, (0, 58, 68)), (76, (55, 30, 78))]:
            pts = [(x * k, (y0 + _m.sin((x + 4) / 10 * 3.14159) * 2.5) * k) for x in range(-4, 100)]
            dd.line(pts, fill=col, width=max(1, int(1.5 * k)))

        # 鱼身
        dd.ellipse([32 * k, 37 * k, 71 * k, 75 * k], fill=(249, 145, 40, 255))
        # 尾鳍
        dd.polygon([(22 * k, 56 * k), (6 * k, 42 * k), (11 * k, 56 * k), (6 * k, 70 * k)],
                   fill=(255, 179, 71, 255))
        # 背鳍
        dd.polygon([(36 * k, 39 * k), (44 * k, 27 * k), (54 * k, 33 * k), (46 * k, 37 * k)],
                   fill=(255, 199, 107, 255))
        # 胸鳍
        dd.polygon([(44 * k, 64 * k), (51 * k, 74 * k), (58 * k, 67 * k)],
                   fill=(255, 199, 107, 255))
        # 眼睛
        dd.ellipse([50 * k, 42 * k, 62 * k, 54 * k], fill=(255, 255, 255, 255))
        dd.ellipse([54.3 * k, 45.3 * k, 60.7 * k, 51.7 * k], fill=(27, 31, 42, 255))
        dd.ellipse([57.7 * k, 45.8 * k, 59.9 * k, 48 * k], fill=(255, 255, 255, 255))
        # 腮红
        dd.ellipse([42.5 * k, 59 * k, 53.5 * k, 65 * k], fill=(220, 110, 110, 160))
        # 嘴
        dd.arc([62 * k, 58 * k, 71 * k, 66 * k], 0, 100, fill=(194, 65, 12, 255), width=max(1, int(2 * k)))
        # 耳机
        dd.arc([32 * k, 22 * k, 68 * k, 56 * k], 180, 355, fill=(230, 233, 240, 255), width=max(2, int(4 * k)))
        dd.rounded_rectangle([26 * k, 44 * k, 36 * k, 60 * k], radius=5 * k, fill=(0, 229, 255, 255))
        dd.rounded_rectangle([64 * k, 38 * k, 74 * k, 54 * k], radius=5 * k, fill=(0, 229, 255, 255))
        # 外环
        dd.ellipse([2 * k, 2 * k, 94 * k, 94 * k], outline=(0, 200, 220, 255), width=max(2, int(4 * k)))

        # 圆形遮罩
        mask = Image.new("L", (n, n), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, n - 1, n - 1], fill=255)
        out = Image.new("RGBA", (n, n), (0, 0, 0, 0))
        out.paste(im, (0, 0), mask)
        return out.resize((size, size), Image.LANCZOS)

    return None


def nav_bar(img, d, active):
    """导航条：高亮胶囊先画底，再画文字，避免盖住字"""
    d.rectangle([0, 0, W, 64], fill=(11, 13, 20))
    d.line([(0, 64), (W, 64)], fill=LINE)
    lx, ly = PAD, 14
    logo_path = os.path.join(ROOT, "assets", "logo.png")
    if os.path.exists(logo_path):
        try:
            lg = Image.open(logo_path).convert("RGBA").resize((36, 36), Image.LANCZOS)
            img.paste(lg, (lx, ly), lg)
        except Exception:
            d.ellipse([lx, ly, lx + 36, ly + 36], outline=ACCENT, width=2)
    else:
        d.polygon([(lx + 18, ly), (lx + 36, ly + 10), (lx + 36, ly + 26),
                   (lx + 18, ly + 36), (lx, ly + 26), (lx, ly + 10)],
                  outline=ACCENT, width=2)
    d.text((lx + 48, ly + 7), site["nameCn"], font=font("bold", 17), fill=TEXT)

    nf = font("reg", 15)
    # 从右往左排，保证「人物介绍」不会被挤出画面
    x = W - PAD
    items = []
    for name in ("人物介绍", "关于我们"):
        tw = d.textlength(name, font=nf)
        items.append((name, x - tw))
        x -= tw + 46
    items.reverse()

    for name, tx in items:
        tw = d.textlength(name, font=nf)
        if name == active:
            rr(d, [tx - 14, 15, tx + tw + 14, 49], 17, fill=(16, 38, 47))
            d.text((tx, 22), name, font=nf, fill=ACCENT)
        else:
            d.text((tx, 22), name, font=nf, fill=MUTED)


# ---------- 版面常量（对应 CSS 的 .wrap 与栅格） ----------
W = 1280
PAD = 72
CONTENT = W - PAD * 2

data = json.load(open(os.path.join(ROOT, "data", "team.json"), encoding="utf-8"))
site, about, members = data["site"], data["about"], data["members"]
panel_h = int(sys.argv[1]) if len(sys.argv) > 1 else 0


# ============================================================
#  一、首屏
# ============================================================
def render_hero():
    H = 860
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # 网格
    for x in range(0, W, 56):
        d.line([(x, 0), (x, H)], fill=(16, 19, 27))
    for y in range(0, H, 56):
        d.line([(0, y), (W, y)], fill=(16, 19, 27))

    # 径向光晕（用同心圆近似）
    cx, cy = W // 2, int(H * 0.42)
    for r in range(420, 0, -6):
        t = 1 - r / 420
        a = t ** 2 * 0.5
        col = tuple(int(BG[i] + (ACCENT[i] - BG[i]) * a * 0.5) for i in range(3))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    # 紫色补光
    for r in range(300, 0, -6):
        t = 1 - r / 300
        a = t ** 2 * 0.42
        col = tuple(int(BG[i] + (ACCENT2[i] - BG[i]) * a * 0.5) for i in range(3))
        d.ellipse([cx + 150 - r, cy + 60 - r, cx + 150 + r, cy + 60 + r], fill=col)

    # 导航
    nav_bar(img, d, "关于我们")

    # 队标
    sx, sy = W // 2, 210
    logo_path = os.path.join(ROOT, "assets", "logo.png")
    if os.path.exists(logo_path):
        try:
            lg = Image.open(logo_path).convert("RGBA").resize((150, 150), Image.LANCZOS)
            img.paste(lg, (sx - 75, sy - 75), lg)
        except Exception:
            pass
    else:
        d.polygon([(sx, sy - 58), (sx + 58, sy - 29), (sx + 58, sy + 29),
                   (sx, sy + 58), (sx - 58, sy + 29), (sx - 58, sy - 29)],
                  outline=ACCENT, width=3)

    # tagline 胶囊
    tag = site["tagline"]
    tf = font("reg", 13)
    tw = d.textlength(tag, font=tf)
    tx0 = W // 2 - tw / 2 - 14
    rr(d, [tx0, 300, tx0 + tw + 28, 330], 15, fill=(17, 20, 29), outline=LINE)
    d.text((W // 2, 308), tag, font=tf, fill=MUTED, anchor="ma")

    # 主标题（渐变）
    text_grad(img, (W // 2, 348), site["nameCn"], font("black", 72),
              WHITE, ACCENT, anchor="ma")

    # 口号
    d.text((W // 2, 452), site["slogan"], font=font("reg", 20), fill=TEXT, anchor="ma")

    # 简介
    df = font("reg", 15)
    y = 496
    for ln in wrap(d, site["description"], df, 600):
        d.text((W // 2, y), ln, font=df, fill=MUTED, anchor="ma")
        y += 27

    # 按钮
    by0, by1 = 578, 624
    b1w = 150
    bx = W // 2 - b1w - 8
    img.paste(grad(b1w, by1 - by0, ACCENT, ACCENT2), (bx, by0))
    mask = Image.new("L", (b1w, by1 - by0), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, b1w - 1, by1 - by0 - 1], 23, fill=255)
    img.paste(grad(b1w, by1 - by0, ACCENT, ACCENT2), (bx, by0), mask)
    d.text((bx + b1w // 2, by0 + 13), "了解我们", font=font("bold", 15), fill=(5, 7, 13), anchor="ma")

    b2w = 150
    bx2 = W // 2 + 8
    rr(d, [bx2, by0, bx2 + b2w, by1], 23, fill=(15, 18, 26), outline=LINE)
    d.text((bx2 + b2w // 2, by0 + 13), "队员名单", font=font("reg", 15), fill=TEXT, anchor="ma")

    # 滚动提示
    d.rounded_rectangle([W // 2 - 13, H - 76, W // 2 + 13, H - 34], 13, outline=LINE)
    d.rounded_rectangle([W // 2 - 2, H - 68, W // 2 + 2, H - 60], 2, fill=ACCENT)

    img.save(os.path.join(OUT, "01-首屏.png"))
    print("  ✓ 01-首屏.png")


# ============================================================
#  二、关于我们
# ============================================================
def render_about():
    H = 1600
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    nav_bar(img, d, "关于我们")

    y = 130
    d.text((PAD, y), "01", font=font("mono", 13), fill=ACCENT)
    y += 26
    d.text((PAD, y), "关于我们", font=font("black", 42), fill=TEXT)
    y += 58
    d.text((PAD, y), "我们从哪来，靠什么赢", font=font("reg", 15), fill=MUTED)

    y += 62
    for ln in wrap(d, about["intro"], font("reg", 16), 800):
        d.text((PAD, y), ln, font=font("reg", 16), fill=(195, 201, 216))
        y += 33

    # 合照横幅
    ph = about.get("photo")
    if ph and ph.get("src"):
        pp = os.path.join(ROOT, ph["src"])
        if os.path.exists(pp):
            y += 30
            try:
                gi = Image.open(pp).convert("RGB")
                gw = CONTENT
                gh2 = int(gi.size[1] * gw / gi.size[0])
                gi = gi.resize((gw, gh2), Image.LANCZOS)
                mk = Image.new("L", (gw, gh2), 0)
                ImageDraw.Draw(mk).rounded_rectangle([0, 0, gw - 1, gh2 - 1], 14, fill=255)
                img.paste(gi, (PAD, y), mk)
                d.rounded_rectangle([PAD, y, PAD + gw, y + gh2], 14, outline=LINE, width=1)
                y += gh2 + 12
                if ph.get("caption"):
                    d.text((W // 2, y), ph["caption"], font=font("reg", 13),
                           fill=MUTED, anchor="ma")
                    y += 26
                y += 8
            except Exception:
                pass

    # 数字条
    y += 34
    n = len(about["stats"])
    gap = 16
    cw = (CONTENT - gap * (n - 1)) // n
    ch = 116
    for i, s in enumerate(about["stats"]):
        x = PAD + i * (cw + gap)
        rr(d, [x, y, x + cw, y + ch], 14, fill=CARD, outline=LINE)
        label = f'{s["value"]}{s["suffix"]}'
        text_grad(img, (x + 22, y + 22), label,
                  font_smart("mono", 40, label), ACCENT, ACCENT2)
        d.text((x + 22, y + 78), s["label"], font=font("reg", 13), fill=MUTED)

    # 数字条下方的说明（data-bind="about.statsNote"）
    note_txt = about.get("statsNote")
    if note_txt:
        y += ch + 14
        d.text((PAD, y), note_txt, font=font("reg", 12), fill=(92, 100, 120))
        y -= ch + 14

    # 时间线
    y += ch + 62
    d.rectangle([PAD, y + 6, PAD + 3, y + 26], fill=ACCENT)
    d.text((PAD + 14, y), "战队历程", font=font("bold", 19), fill=TEXT)
    y += 46

    ax = PAD + 7
    d.line([(ax, y + 6), (ax, y + len(about["timeline"]) * 66 - 10)], fill=ACCENT)
    for t in about["timeline"]:
        d.ellipse([ax - 6, y + 2, ax + 6, y + 14], fill=BG, outline=ACCENT, width=2)
        d.text((PAD + 30, y), t["date"], font=font("mono", 13), fill=ACCENT)
        d.text((PAD + 30, y + 22), t["title"], font=font("bold", 17), fill=TEXT)
        d.text((PAD + 30, y + 46), t["text"], font=font("reg", 15), fill=MUTED)
        y += 66

    # 荣誉
    y += 22
    d.rectangle([PAD, y + 6, PAD + 3, y + 26], fill=ACCENT)
    d.text((PAD + 14, y), "荣誉记录", font=font("bold", 19), fill=TEXT)
    y += 46

    hw = (CONTENT - 14) // 2
    for i, h in enumerate(about["honors"]):
        x = PAD + (i % 2) * (hw + 14)
        yy = y + (i // 2) * 66
        rr(d, [x, yy, x + hw, yy + 58], 8, fill=CARD, outline=LINE)
        d.text((x + 20, yy + 20), h["year"], font=font("mono", 13), fill=ACCENT2)
        d.text((x + 72, yy + 18), h["name"], font=font("reg", 15), fill=TEXT)
        rw = d.textlength(h["result"], font=font("reg", 13))
        rr(d, [x + hw - rw - 34, yy + 17, x + hw - 14, yy + 42], 12, fill=(16, 32, 40))
        d.text((x + hw - rw - 24, yy + 21), h["result"], font=font("reg", 13), fill=ACCENT)

    img.save(os.path.join(OUT, "02-关于我们.png"))
    print("  ✓ 02-关于我们.png")


# ============================================================
#  三、人物介绍
# ============================================================
def render_members():
    H = 940
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    nav_bar(img, d, "人物介绍")

    y = 130
    d.text((PAD, y), "02", font=font("mono", 13), fill=ACCENT)
    y += 26
    d.text((PAD, y), "人物介绍", font=font("black", 42), fill=TEXT)
    y += 58
    d.text((PAD, y), "NYLOO 的这些人", font=font("reg", 15), fill=MUTED)

    # 筛选
    y += 54
    fx = PAD
    for i, r in enumerate(members["roles"]):
        fw = d.textlength(r, font=font("reg", 14)) + 40
        act = (i == 0)
        rr(d, [fx, y, fx + fw, y + 38], 19, fill=(16, 32, 40) if act else None,
           outline=ACCENT if act else LINE)
        d.text((fx + fw / 2, y + 10), r, font=font("reg", 14),
               fill=ACCENT if act else MUTED, anchor="ma")
        fx += fw + 10

    # 队员卡片
    y += 66
    gap = 18
    cols = 4
    cw = (CONTENT - gap * (cols - 1)) // cols
    chh = 236
    palette = [(ACCENT, (0, 119, 255)), (ACCENT2, (236, 72, 153)),
               ((52, 211, 153), (14, 165, 233)), ((251, 191, 36), (249, 115, 22))]

    for i, m in enumerate(members["list"][:8]):
        x = PAD + (i % cols) * (cw + gap)
        yy = y + (i // cols) * (chh + gap)
        rr(d, [x, yy, x + cw, yy + chh], 14, fill=CARD, outline=LINE)
        # 顶部渐变线
        img.paste(grad(cw - 2, 3, ACCENT, ACCENT2), (x + 1, yy + 1))
        d.line([(x + 1, yy + 3), (x + cw - 1, yy + 3)], fill=ACCENT)

        # 头像：优先用真实 SVG 栅格化，画不了再回退字母
        ax2, ay2, r = x + 26 + 29, yy + 28 + 29, 29
        av_path = os.path.join(ROOT, m.get("avatar", ""))
        av_img = load_avatar(av_path, int(r * 2))
        if av_img is not None:
            img.paste(av_img, (int(ax2 - r), int(ay2 - r)), av_img)
        else:
            d.ellipse([ax2 - r, ay2 - r, ax2 + r, ay2 + r], fill=CARD_HI, outline=ACCENT, width=2)
            d.text((ax2, ay2), "ABCDEF"[i % 6], font=font("bold", 26),
                   fill=palette[i % 4][0], anchor="mm")

        d.text((x + 26 + 68, yy + 30), m["name"], font=font("bold", 17), fill=TEXT)
        d.text((x + 26 + 68, yy + 55), m["role"], font=font("reg", 13), fill=ACCENT2)

        rf = font_smart("mono", 12, m["rank"])
        rw = d.textlength(m["rank"], font=rf)
        rr(d, [x + cw - rw - 34, yy + 22, x + cw - 14, yy + 44], 11, outline=LINE)
        d.text((x + cw - rw - 24, yy + 26), m["rank"], font=rf, fill=MUTED)

        by = yy + 104
        for ln in wrap(d, m["bio"], font("reg", 14), cw - 52)[:3]:
            d.text((x + 26, by), ln, font=font("reg", 14), fill=MUTED)
            by += 24

        shy = yy + chh - 72
        shx = x + 26
        for tag in m["main"][:3]:
            tw2 = d.textlength(tag, font=font("reg", 12)) + 20
            rr(d, [shx, shy, shx + tw2, shy + 26], 6, fill=(25, 29, 42))
            d.text((shx + 10, shy + 5), tag, font=font("reg", 12), fill=(185, 192, 208))
            shx += tw2 + 7

        d.text((x + 26, yy + chh - 34), "查看详情 →", font=font("reg", 13), fill=ACCENT)

    img.save(os.path.join(OUT, "04-人物介绍.png"))
    print("  ✓ 04-人物介绍.png")


# ============================================================
#  四、队员详情弹层
# ============================================================
def render_modal():
    Wm, Hm = 900, 640
    img = Image.new("RGB", (Wm, Hm), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, Wm, Hm], fill=(18, 21, 31))
    for x in range(0, Wm, 56):
        d.line([(x, 0), (x, Hm)], fill=(15, 18, 26))
    for yy in range(0, Hm, 56):
        d.line([(0, yy), (Wm, yy)], fill=(15, 18, 26))

    m = members["list"][0]
    px, py = 90, 60
    pw, ph = Wm - 180, Hm - 120
    d.rectangle([px + 6, py + 10, px + pw + 6, py + ph + 10], fill=(6, 8, 13))
    rr(d, [px, py, px + pw, py + ph], 18, fill=CARD, outline=LINE)

    cx = px + 30
    cy = py + 34
    d.ellipse([cx, cy, cx + 84, cy + 84], fill=CARD_HI, outline=ACCENT, width=2)
    d.text((cx + 42, cy + 42), "A", font=font("bold", 38), fill=ACCENT, anchor="mm")

    d.text((cx + 108, cy + 12), m["name"], font=font("bold", 24), fill=TEXT)
    d.text((cx + 108, cy + 50), m["role"], font=font("reg", 14), fill=ACCENT2)
    d.text((cx + 108, cy + 72), f'段位 {m["rank"]} · ID {m["id"]}',
           font=font("mono", 13), fill=MUTED)

    # 关闭按钮
    d.ellipse([px + pw - 50, py + 14, px + pw - 14, py + 50], fill=(28, 32, 44), outline=LINE)
    d.text((px + pw - 32, py + 32), "×", font=font("reg", 24), fill=TEXT, anchor="mm")

    y = py + 148
    for ln in wrap(d, m["bio"], font("reg", 15), pw - 60):
        d.text((cx, y), ln, font=font("reg", 15), fill=(195, 201, 216))
        y += 30

    y += 26
    d.text((cx, y), "擅长", font=font("reg", 12), fill=MUTED)
    y += 30
    tx = cx
    for tag in m["main"]:
        tw3 = d.textlength(tag, font=font("reg", 13)) + 30
        rr(d, [tx, y, tx + tw3, y + 32], 16, fill=(14, 32, 42), outline=(0, 90, 105))
        d.text((tx + 15, y + 8), tag, font=font("reg", 13), fill=ACCENT)
        tx += tw3 + 9

    y += 60
    d.text((cx, y), "数据", font=font("reg", 12), fill=MUTED)
    y += 30
    entries = list(m["stats"].items())
    sw = (pw - 60 - 12 * (len(entries) - 1)) // max(len(entries), 1)
    for i, (k, v) in enumerate(entries):
        sx = cx + i * (sw + 12)
        rr(d, [sx, y, sx + sw, y + 84], 8, fill=CARD_HI, outline=LINE)
        d.text((sx + sw / 2, y + 16), str(v), font=font_smart("mono", 20, str(v)), fill=ACCENT, anchor="ma")
        d.text((sx + sw / 2, y + 52), k, font=font("reg", 12), fill=MUTED, anchor="ma")

    img.save(os.path.join(OUT, "05-队员详情弹层.png"))
    print("  ✓ 05-队员详情弹层.png")


if __name__ == "__main__":
    print("\n渲染战队展示页预览图…\n")
    render_hero()
    render_about()
    render_members()
    render_modal()
    print(f"\n完成 → {OUT}\n")