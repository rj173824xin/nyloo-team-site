# NYLOO 战队展示页 · 部署说明

**纯静态站点**：HTML + CSS + JS + JSON，没有后端、没有数据库、没有构建步骤。
把本目录原样拷到服务器上，用任何静态服务器指向它就能跑。

---

## 一、最快跑起来（三种任选）

### 方式 A：Python（装了 Python 就行）

```bash
cd NYLOO-site
python3 -m http.server 8080 --bind 0.0.0.0
```

Windows 上：

```powershell
cd NYLOO-site
.\serve.ps1
```

访问 `http://<服务器IP>:8080`

### 方式 B：Nginx（推荐，长期挂着用这个）

把 `NYLOO-site` 目录拷到服务器，例如 `/var/www/NYLOO-site`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/NYLOO-site;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 静态资源长缓存
    location ~* \.(png|jpe?g|svg|webp|css|js|ico)$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    # 数据文件不缓存：改完立刻生效
    location = /data/team.json {
        add_header Cache-Control "no-cache";
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 方式 C：Docker（如果服务器上跑容器）

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
```

```bash
docker build -t nyloo-site .
docker run -d -p 8080:80 --name nyloo nyloo-site
```

---

## 二、绑定域名 + HTTPS

Nginx 配好 `server_name` 后，用 certbot 一行拿免费证书：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

自动续期由 certbot 的定时任务负责，无需干预。

> 服务器在**中国大陆**的话，域名必须先完成 ICP 备案，否则 80/443 会被阻断。
> 香港或境外服务器不需要备案。

---

## 三、改内容

**所有文案和队员信息都在 `data/team.json`，改这个文件就行，不用动代码。**

格式示例：

```json
{
  "members": {
    "roles": ["全部", "创始人", "指挥", "突破手 1", "突破手 2"],
    "list": [
      {
        "id": "唯一标识，别重复",
        "name": "显示名",
        "role": "位置，必须出现在上面的 roles 里",
        "avatar": "assets/avatar-01.svg",
        "bio": "一句话介绍",
        "main": [],
        "stats": {}
      }
    ]
  }
}
```

几个要点：

- `roles` 第一项必须是 `"全部"`
- 队员的 `role` 必须能在 `roles` 里找到，否则筛选不到
- `main`（擅长标签）和 `stats`（信息格）**留空数组/空对象即可**，页面会自动隐藏对应区块
- 改完刷新页面就生效，不需要重启服务

---

## 四、自检（改完内容后跑一下）

需要 Node.js：

```bash
node tools/check.cjs        # 检查数据格式、图片路径、页面引用
node tools/test-render.cjs  # 检查数据能否正确渲染成页面
node tools/test-modal.cjs   # 检查队员详情弹层
```

三套全部通过说明内容没问题。常见报错：

| 报错 | 原因 | 修法 |
| --- | --- | --- |
| `缺失 assets/xxx.png` | 图片路径写错或文件没上传 | 检查文件名和路径大小写 |
| `队员 xxx 的 role 不在筛选表内` | 位置名和 `roles` 对不上 | 统一两处写法 |
| `JSON 解析失败` | 多逗号、少引号，或文件带了 BOM | 用编辑器粘贴校验一遍 |

> ⚠️ **BOM 坑**：用 PowerShell 的 `Set-Content -Encoding UTF8` 改 JSON 会写入 BOM 头，
> 浏览器会直接报错、页面白屏。改用 VS Code 保存，或存成「无 BOM 的 UTF-8」。

---

## 五、文件说明

```
NYLOO-site/
├─ index.html          页面结构
├─ css/styles.css      全部样式
├─ js/app.js           渲染与交互逻辑
├─ data/team.json      ★ 所有内容都在这里
├─ assets/             图片资源
│  ├─ logo.png         队徽（已抠透明底）
│  ├─ favicon.png      浏览器标签图标
│  ├─ avatar-01~04.svg 队员头像（字母占位）
│  └─ qr-*.svg         已废弃，可删（资助模块已移除）
├─ tools/              自检脚本（不影响运行，可删）
├─ serve.ps1           Windows 起服务
├─ serve.sh            Linux/macOS 起服务
├─ README.md           完整改法说明
└─ DEPLOY.md           本文件
```

---

## 六、注意

- **不需要 Node.js 运行**：tools 里的脚本只是给改内容时自检用的，删掉也不影响站点
- **不需要数据库**：全部数据在一个 JSON 文件里
- **无外部依赖**：不引用任何 CDN，断网/内网环境也正常显示
- **队徽背景**：`logo.png` 已抠成透明底，适配深色页面；若换新队徽，同样需要透明底