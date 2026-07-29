# mazha0309.top

Mazha0309 的动态个人主页 + Blog。它是一张会生长的数字工作台：公开页面像一本圆润手写的数字手账，后台则保留同一套纸张与便签语言，但把装饰密度降下来方便长期写作。

## 已经包含什么

- React Router 8 Framework Mode 全栈 SSR
- PostgreSQL + Drizzle，内容更新不需要重新构建网站
- Better Auth + GitHub OAuth，仅允许 GitHub 数字 ID `99137842`
- 自制 CMS：文章、项目、友链、ABOUT、NOW、媒体、统计与可视化全站自定义
- 项目图标支持固定预设、稳定随机、短文字 / Emoji、自定义图片和 9 种外框
- 管理员资源探针：CPU 负载、主机/Node 内存、磁盘、PostgreSQL 延迟/容量/连接池和运行时长
- 安全 MDX 子集、CodeMirror 6、实时预览、自动保存、版本记录
- 草稿、独立预览、定时发布、旧 slug 永久跳转
- PostgreSQL `pg_trgm` 搜索，标题和标签权重高于正文
- 图片持久卷、WebP / AVIF 变体、必填 alt、拒绝 SVG
- Giscus 评论，稳定映射为 `post:<uuid>`
- 固定暖纸张主题，不提供容易破坏手账配色的深色模式
- 自托管小赖字体，常用简体中文完整覆盖，生僻字回退思源黑体
- RSS、Sitemap、存活/就绪探针和隐私友好的日聚合统计
- Docker 开发与生产编排、Caddy 示例、GHCR 自动部署和失败回滚
- CMS + 媒体备份；明确排除登录、Session、OAuth Token 与分析数据

## 本地：只需要 Docker

```bash
docker compose -f compose.dev.yaml up --build
```

打开：

- 公开站点：<http://localhost:5173>
- 本地后台：<http://localhost:5173/admin>
- 全站自定义：<http://localhost:5173/admin/settings>
- 资源探针：<http://localhost:5173/admin/system>
- 存活检查：<http://localhost:5173/healthz>
- 就绪检查：<http://localhost:5173/readyz>

开发 Compose 默认启用 `DEV_ADMIN_BYPASS=true`，仅在 `NODE_ENV=development` 下生效。若 `5173` 已占用：

```bash
DEV_PORT=15173 docker compose -f compose.dev.yaml up --build
```

源码以 bind mount 挂进容器，Vite 会热更新；PostgreSQL、媒体和 `node_modules` 使用独立 Docker Volume。

停止容器：

```bash
docker compose -f compose.dev.yaml down
```

除非确定不再需要本地数据库与媒体，不要追加 `-v`。

## 不使用 Docker 的快速预览

没有 `DATABASE_URL` 时，公开页会使用仓库内的演示内容；所有写操作仍会拒绝：

```bash
npm ci --include=dev
npm run dev
```

## 内容模型

公开路由：

- `/`
- `/blog`
- `/blog/:slug`
- `/projects`
- `/friends`
- `/about`
- `/search?q=`
- `/rss.xml`
- `/sitemap.xml`
- `/robots.txt`
- `/healthz`
- `/readyz`

后台路由：

- `/admin`
- `/admin/posts`
- `/admin/projects`
- `/admin/friends`
- `/admin/pages`
- `/admin/media`
- `/admin/settings`
- `/admin/analytics`
- `/admin/system`

`/healthz` 只判断 Node 进程是否存活；`/readyz` 判断 PostgreSQL 与媒体卷是否可用。CPU、内存、磁盘路径、主机名和数据库连接池等详细信息只在管理员页面及受保护的 `/api/admin/probe` 返回。

文章中的 MDX 支持普通 Markdown、GFM，以及：

```mdx
<Note title="提醒">一张便签。</Note>

<Stamp>认真制作</Stamp>

<Gallery>
  ![第一张图](/media/...)
  ![第二张图](/media/...)
</Gallery>
```

任意 `import`、`export`、JavaScript 表达式、原始 HTML、未知组件和危险 URL 协议都会被服务端拒绝。

## VPS 一次性准备

### 1. GitHub OAuth App

在 GitHub 创建 OAuth App：

- Homepage URL：`https://mazha0309.top`
- Authorization callback URL：`https://mazha0309.top/api/auth/callback/github`

保留 Client ID 和 Client Secret，稍后放入 VPS `.env`。

### 2. 确认宿主机 Caddy

Caddy 通过 apt 安装并由 systemd 管理，继续独占 80/443。应用容器只把端口绑定到宿主机回环地址 `127.0.0.1:3000`，不会直接暴露到公网。

确认 Caddy 正常运行，且 3000 端口尚未被占用：

```bash
systemctl status caddy --no-pager
ss -ltnp 'sport = :3000'
```

第二条没有输出即表示默认端口可用。若要改端口，同时修改 `.env` 中的 `APP_HOST_PORT` 和 Caddyfile 的 `reverse_proxy` 地址。

### 3. 创建部署目录和 `.env`

示例以 `/opt/mazha-home` 为部署目录：

```bash
sudo install -d -o "$USER" -g "$USER" /opt/mazha-home/scripts
cd /opt/mazha-home
```

把 [`.env.example`](./.env.example) 复制为 `/opt/mazha-home/.env`，至少填写：

```dotenv
NODE_ENV=production
APP_ORIGIN=https://mazha0309.top
TZ=Asia/Shanghai
POSTGRES_PASSWORD=足够长且随机的数据库密码
BETTER_AUTH_SECRET=至少32字节的随机值
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
ALLOWED_GITHUB_ID=99137842
APP_HOST_PORT=3000
```

生成 Auth Secret：

```bash
openssl rand -base64 48
```

`.env` 只保留在 VPS，绝不能提交到仓库。

### 4. 接入现有 Caddyfile

把 [`Caddyfile.example`](./Caddyfile.example) 中两段站点配置并入 `/etc/caddy/Caddyfile`。宿主机 Caddy 通过 `127.0.0.1:3000` 访问应用。

验证配置并让 systemd 平滑重载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 5. Giscus

在公开源码仓库启用 Discussions，安装 Giscus App，并创建分类 `Blog Comments`。把 Giscus 页面给出的四个值写入 VPS `.env`：

```dotenv
GISCUS_REPO=Mazha0309/mazha0309.top
GISCUS_REPO_ID=...
GISCUS_CATEGORY=Blog Comments
GISCUS_CATEGORY_ID=...
```

未填写时文章仍正常显示，只会出现“评论频道还没接上”的占位纸条。

## GitHub Actions 自动部署

`main` 每次更新会：

1. 构建并测试 Docker 镜像
2. 推送 `ghcr.io/mazha0309/mazha0309.top:<commit-sha>`
3. SSH 到 VPS
4. 执行数据库迁移与幂等 Seed
5. 重启 `app`，保留 PostgreSQL 和媒体卷
6. 容器内检查 `/readyz`
7. 失败时把应用容器退回上一个镜像

在仓库 `production` Environment 或 Actions Secrets 配置：

| Secret | 用途 |
| --- | --- |
| `VPS_HOST` | VPS 主机名或 IP |
| `VPS_USER` | 有权运行 Docker 的 SSH 用户 |
| `VPS_SSH_KEY` | 部署专用私钥 |
| `VPS_KNOWN_HOSTS` | `ssh-keyscan` 后人工核对的 host key |
| `VPS_DEPLOY_PATH` | 例如 `/opt/mazha-home` |

GHCR Package 首次出现后，把可见性设为 Public；若保持 Private，需先在 VPS 为 Docker 配置只读 Package Token。

第一次部署可以从 Actions 手动运行 `Deploy VPS`。之后合并到 `main` 即自动上线。

## 备份

手动生成并校验：

```bash
./scripts/backup.sh
./scripts/restore.sh backups/mazha-home-cms-*.tar.gz --verify
```

备份包含：

- 站点身份、导航、社交链接
- 文章、旧 slug、版本记录
- 项目、友链、ABOUT、NOW
- 媒体元数据和 `/data/media`
- 校验和

备份明确不包含：

- Better Auth 用户、Account、Session
- GitHub OAuth Token
- 应用 Secret
- 分析统计

按照已选方案，备份文件**不加密**，只能放入专用私有仓库 `Mazha0309/mazha0309-top-backups`。定时工作流需要额外 Secret：

| Secret | 用途 |
| --- | --- |
| `BACKUP_REPO_TOKEN` | 仅允许向私有备份仓库创建 / 删除 Release 的细粒度 Token |

工作流每天创建一个私有 Release Asset，保留 14 份 daily 和 8 份 weekly。

实际恢复会替换当前 CMS 内容，必须显式确认：

```bash
RESTORE_CONFIRM=replace-cms-content \
  ./scripts/restore.sh backups/mazha-home-cms-....tar.gz --apply
```

它不会触碰 Auth 和分析表；媒体文件以覆盖方式恢复，不主动删除额外旧文件。

## 验证

```bash
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

`test:e2e` 覆盖桌面与手机、首页、空博客、友链空状态、搜索、公开存活检查，以及详细资源探针的登录保护。

## 技术说明

- 定时发布是查询时判定：`scheduled_at <= now()` 即视为公开，无需 cron。
- 旧 slug 保存在独立表，访问后以 `301` 跳到当前 slug。
- Giscus 使用文章 UUID，不随 slug 改名丢失讨论串。
- 浏览统计只存“日期、路径、次数”，不存完整 IP；浏览器和服务端都尊重 DNT / GPC。
- 数据库迁移是向前的。自动回滚只切换应用镜像，不逆向回滚已经成功执行的 Schema 变更，因此破坏性迁移必须拆成兼容的多阶段发布。
