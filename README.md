# 战队展示页

纯静态单页展示站：**关于我们 / 资助我们 / 人物介绍**。
零依赖、零构建，拷贝到任何地方都能跑。

---

## 一、最快看一眼

在 `team-site` 目录里起一个本地服务，然后浏览器打开：

```bash
# 任选一条
python -m http.server 8080      # 需要 Python
npx serve .                     # 需要 Node
./serve.sh                      # Linux / macOS 一键脚本
```

Windows 上双击运行 `serve.ps1`，或者右键「使用 PowerShell 运行」。

然后访问 <http://localhost:8080>

> **别直接双击 `index.html`**。浏览器会因同源策略拒绝读取本地
> `data/team.json`，页面会显示一段黄色提示告诉你该怎么办。起服务是必须的。

---

## 二、怎么改内容

**所有文案和队员信息都在 `data/team.json` 里，改它就行，不用碰 HTML。**

改完刷新页面即可，无需重启服务。

### 站点信息

```json
"site": {
  "nameCn":  "显示在导航和首屏的队名",
  "slogan":  "首屏口号",
  "tagline": "首屏队名上方的小标签",
  "description": "首屏简介段落",
  "contact": { "email": "...", "qq": "..." }
}
```

### 关于我们

| 字段 | 作用 |
| --- | --- |
| `about.intro` | 首段介绍文字 |
| `about.stats` | 数字条，`value` 会自动滚动计数，`suffix` 是单位 |
| `about.timeline` | 历程时间线，按顺序排 |
| `about.honors` | 荣誉卡片，`year` / `name` / `result` |

### 资助我们

| 字段 | 作用 |
| --- | --- |
| `support.pitch` | 开头的说明段落 |
| `support.goal` | 进度条：`target` 目标额、`raised` 已筹、`currency` 货币符号 |
| `support.tiers` | 资助档位。`highlight: true` 的那一档会高亮并标「推荐」，**只能有一档** |
| `support.methods` | 收款方式。`isImage: true` 时 `value` 填图片路径；否则填文本，`copy` 有值就显示复制按钮 |
| `support.sponsors` | 合作方 logo，`url` 留空则不可点击 |
| `support.thanks` | 感谢名单，纯文本数组 |

### 人物介绍

```json
{
  "id":     "唯一标识，别重复",
  "name":   "显示名 / ID",
  "role":   "位置，必须出现在 members.roles 里，否则筛不到",
  "rank":   "段位",
  "avatar": "assets/avatar-01.svg",
  "main":   ["擅长1", "擅长2"],
  "bio":    "一句话介绍",
  "stats":  { "场次": 412, "胜率": "71%" }
}
```

`main` 卡片显示前 3 个，多了显示 `+N`。
`stats` 键值随意，弹层里按格子平铺。

`members.roles` 是筛选按钮列表，**第一项必须是「全部」**。

想加人：往 `members.list` 里加一个对象即可，卡片网格自动排。

---

## 三、换图片

`assets/` 里的都是占位图，直接同名覆盖即可：

| 文件 | 用途 | 建议尺寸 |
| --- | --- | --- |
| `logo.svg` | 队标（首屏 + 导航） | 正方形 |
| `favicon.svg` | 浏览器标签图标 | 正方形 |
| `avatar-01.svg` ~ `avatar-06.svg` | 队员头像 | 正方形，会自动裁圆 |
| `qr-wechat.svg` / `qr-alipay.svg` | 收款码 | 正方形 |
| `sponsor-a/b/c.svg` | 合作方 logo | 宽长方形 |

换成 `.png` / `.jpg` 也行——把 `data/team.json` 里对应的路径改掉就可以。

占位图是脚本生成的，想重新生成：

```bash
node tools/gen-assets.cjs
```

---

## 四、自检

改完数据后跑一遍，能立刻发现字段写错、图片路径不对这类问题：

```bash
node tools/check.cjs        # 静态检查：数据契约 + 资源引用 + 页面装配
node tools/test-render.cjs  # 渲染测试：数据能否正确变成 HTML
```

`check.cjs` 会检查：队员字段是否齐全、`role` 是否都在筛选表里、
图片路径是否真实存在、JS 引用的元素 id 是否都在 HTML 里、有没有外部 CDN 依赖。

---

## 五、部署到那台电脑

### 方案 A：Python 起服务（最简单）

```bash
cd team-site
python -m http.server 8080 --bind 0.0.0.0
```

`--bind 0.0.0.0` 让局域网内其他机器也能访问。

### 方案 B：Nginx（推荐，适合长期挂着）

把整个 `team-site` 目录拷到服务器，比如 `/var/www/team-site`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/team-site;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~* \.(svg|png|jpg|jpeg|webp|css|js)$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    location = /data/team.json {
        add_header Cache-Control "no-cache";
    }
}
```

重载：`sudo nginx -t && sudo systemctl reload nginx`

### 方案 C：Windows 上常驻

用 `nssm` 或计划任务把 `serve.ps1` 注册成服务，开机自启。

### 关于 Cloudflare Tunnel

用 `cloudflared` 的话，回源指到本机 8080：

```bash
cloudflared tunnel --url http://localhost:8080
```

> ⚠️ `*.trycloudflare.com` 是**临时隧道**，每次重启换一个随机域名。
> 要固定域名必须用 Cloudflare 账号建 Named Tunnel，把域名 NS 交给 Cloudflare。

---

## 六、目录结构

```
team-site/
├─ index.html              页面骨架
├─ css/styles.css          全部样式
├─ js/app.js               渲染与交互
├─ data/team.json          ★ 所有内容都在这里
├─ assets/                 图片（占位）
├─ tools/
│  ├─ gen-assets.cjs       重新生成占位图
│  ├─ check.cjs            静态自检
│  └─ test-render.cjs      渲染测试
├─ serve.ps1               Windows 起服务
├─ serve.sh                Linux / macOS 起服务
├─ DESIGN.md               设计方案
└─ README.md               本文件
```

---

## 七、下一步要替换的占位内容

| 位置 | 现在 | 需要 |
| --- | --- | --- |
| 队名 / 口号 | 「占位战队」 | 真实队名与 slogan |
| 队员 | 6 个占位角色 | 真实 ID、位置、段位、头像、介绍 |
| 荣誉 | 示例条目 | 真实战绩 |
| 收款方式 | 示例二维码 | 真实收款码或赞助联系方式 |
| 合作方 | 占位 logo | 真实赞助商 |

改完跑一次 `node tools/check.cjs` 确认没写错。