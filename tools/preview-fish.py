#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
按 css/styles.css 里 .fish 的坐标还原彩蛋里的那条鱼，用于目检。
用法: python tools/preview-fish.py
"""
import os
import sys
import math

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, ".shots")
os.makedirs(OUT, exist_ok=True)

# 与 CSS 一致的尺寸
FW, FH = 140, 90
S = 4                      # 放大倍数
BG = (10, 12, 18)


def draw_fish(d, ox, oy, k):
    """按 CSS 坐标绘制：容器内 (x,y) * k + 偏移"""
    def X(v): return ox + v * k
    def Y(v): return oy + v * k

    # 尾鳍（先画，让身体压住根部）
    d.polygon([(X(30), Y(34)), (X(30), Y(78)), (X(2), Y(56))], fill=(255, 179, 71))

    # 身体：CSS 是 left22 top20 w92 h58，圆角 50% 46% 46% 50%
    d.ellipse([X(22), Y(20), X(22 + 92), Y(20 + 58)], fill=(250, 150, 45))
    # 内阴影感：右下压深一点
    d.ellipse([X(30), Y(28), X(114), Y(78)], fill=(249, 145, 40))

    # 腮红
    d.ellipse([X(66), Y(56), X(66 + 16), Y(56 + 9)], fill=(248, 113, 113))

    # 眼睛：left84 top34 15x15
    d.ellipse([X(84), Y(34), X(84 + 15), Y(34 + 15)], fill=(255, 255, 255))
    d.ellipse([X(84 + 7), Y(34 + 4), X(84 + 7 + 7), Y(34 + 4 + 7)], fill=(27, 31, 42))

    # 耳机头梁：left46 top6 w62 h52 上半圆环
    d.arc([X(46), Y(6), X(46 + 62), Y(6 + 52)], 180, 360,
          fill=(230, 233, 240), width=max(2, int(4 * k)))

    # 耳罩：top38 17x26，左右各一
    d.rounded_rectangle([X(40), Y(38), X(40 + 17), Y(38 + 26)],
                        radius=int(8 * k), fill=(0, 229, 255))
    d.rounded_rectangle([X(91), Y(38), X(91 + 17), Y(38 + 26)],
                        radius=int(8 * k), fill=(0, 229, 255))
    # 耳罩内圈
    d.rounded_rectangle([X(43), Y(42), X(43 + 11), Y(42 + 18)],
                        radius=int(5 * k), fill=(10, 12, 18))

    # 气泡：left116 top44 10x10
    for i, (dx, dy, r) in enumerate([(0, 0, 5), (6, -14, 4), (13, -30, 3)]):
        d.ellipse([X(116 + dx - r), Y(44 + dy - r), X(116 + dx + r), Y(44 + dy + r)],
                  outline=(0, 229, 255), width=max(1, int(1.6 * k)))


# ---------- 画布：模拟页面底部 ----------
W, H = 900, 340
img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# 页面内容暗示（一条底线）
d.line([(0, H - 60), (W, H - 60)], fill=(35, 40, 56), width=2)

k = S
# 鱼主体
draw_fish(d, 40, H - 60 - FH * k - 30, k)

# 台词气泡
try:
    f = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 26)
except Exception:
    f = ImageFont.load_default()

line = "不打 CS，但队里的事我都管。"
tw = d.textlength(line, font=f)
bx0 = 40 + (FW * k) / 2 - tw / 2 - 30
by0 = H - 60 - FH * k - 30 - 96
d.rounded_rectangle([bx0, by0, bx0 + tw + 60, by0 + 60], radius=30,
                    fill=(18, 21, 31), outline=(0, 229, 255), width=2)
d.text((bx0 + 30, by0 + 14), line, font=f, fill=(230, 233, 240))
# 气泡小尾巴
d.polygon([(bx0 + tw / 2 + 20, by0 + 58),
           (bx0 + tw / 2 + 34, by0 + 78),
           (bx0 + tw / 2 + 44, by0 + 56)], fill=(18, 21, 31))

# 水花
for i, (px, py, r) in enumerate([(150, H - 150, 4), (300, H - 190, 3),
                                 (450, H - 130, 5), (620, H - 200, 3),
                                 (760, H - 160, 4)]):
    d.ellipse([px - r, py - r, px + r, py + r], fill=(0, 229, 255))

# 说明
try:
    f2 = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 18)
except Exception:
    f2 = ImageFont.load_default()
d.text((40, 26), "彩蛋预览 · 点大肥鱼头像 5 次 或 ↑↑↓↓←→←→", font=f2, fill=(139, 147, 167))

img.save(os.path.join(OUT, "egg-fish.png"))
print("已生成 .shots/egg-fish.png")