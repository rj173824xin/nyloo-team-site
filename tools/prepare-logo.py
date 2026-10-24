#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把队徽白底抠成透明，裁掉多余边距，输出可直接用于深色页面的 PNG。

用法:
    python tools/prepare-logo.py <输入图路径> [输出名]

默认输出 assets/logo.png，并同时生成 favicon.png。
"""
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")


def strip_white_bg(im, thresh=238):
    """
    把接近白色的像素变透明。
    用「最暗通道」判定而不是简单阈值，能保住队徽内部的浅色（如龙的浅黄高光）。
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            mn = min(r, g, b)
            mx = max(r, g, b)
            # 接近白色 且 饱和度低 → 视为背景
            if mn >= thresh and (mx - mn) < 18:
                px[x, y] = (r, g, b, 0)
            elif mn >= thresh - 14 and (mx - mn) < 12:
                # 半透明过渡区，避免边缘出现白色锯齿
                t = (thresh - mn) / 14.0
                px[x, y] = (r, g, b, int(255 * max(0.0, min(1.0, t))))
    return im


def trim_transparent(im, pad_ratio=0.02):
    """裁掉四周全透明的边距"""
    bbox = im.getbbox()
    if not bbox:
        return im
    im = im.crop(bbox)
    # 加一点内边距，避免贴边
    w, h = im.size
    pad = int(max(w, h) * pad_ratio)
    side = max(w, h) + pad * 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return canvas


def main():
    if len(sys.argv) < 2:
        print("用法: python tools/prepare-logo.py <输入图路径> [输出名]")
        sys.exit(1)

    src = sys.argv[1]
    out_name = sys.argv[2] if len(sys.argv) > 2 else "logo.png"

    if not os.path.exists(src):
        print("找不到文件:", src)
        sys.exit(1)

    im = Image.open(src)
    print(f"读取: {src}")
    print(f"  原始尺寸 {im.size[0]}x{im.size[1]} {im.mode}")

    im = strip_white_bg(im)
    print("  已抠除白底")

    im = trim_transparent(im)
    print(f"  已裁边 → {im.size[0]}x{im.size[1]}（正方形）")

    # 放大到 512 方便高分屏；用 LANCZOS 保留边缘
    big = im.resize((512, 512), Image.LANCZOS)
    out = os.path.join(ASSETS, out_name)
    big.save(out)
    print(f"  输出 {out}")

    # 顺带生成 favicon
    fav = im.resize((64, 64), Image.LANCZOS)
    fav_path = os.path.join(ASSETS, "favicon.png")
    fav.save(fav_path)
    print(f"  输出 {fav_path}")

    # 在深色底上预览一下，确认没有白边残留
    preview = Image.new("RGB", (600, 200), (10, 12, 18))
    preview.paste(im.resize((160, 160), Image.LANCZOS), (40, 20), im.resize((160, 160), Image.LANCZOS))
    preview.paste(im.resize((64, 64), Image.LANCZOS), (240, 68), im.resize((64, 64), Image.LANCZOS))
    preview.paste(im.resize((32, 32), Image.LANCZOS), (340, 84), im.resize((32, 32), Image.LANCZOS))
    prev_path = os.path.join(ROOT, ".shots", "logo-check.png")
    os.makedirs(os.path.dirname(prev_path), exist_ok=True)
    preview.save(prev_path)
    print(f"  深色底预览 {prev_path}")


if __name__ == "__main__":
    main()