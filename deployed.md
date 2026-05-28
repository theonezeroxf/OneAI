# OneAI 部署指南（deployed.md）

本文档详细说明 **本地部署（开发调试）** 和 **Cloudflare 线上部署** 的完整步骤。

---

## 1. 前置准备

在开始前，请确认：

- 已安装 Node.js（建议 20+）与 npm
- 已安装并可使用 `npx`
- 已有 Cloudflare 账号
- 已登录 Wrangler（Cloudflare CLI）

登录命令：

```bash
npx wrangler login
```

---

## 2. 获取代码

```bash
git clone <你的仓库地址>
cd OneAI
```

---

## 3. 安装依赖

```bash
npm install
```

如果你所在网络对 npm 有限制导致安装失败，请先切换可访问 npm registry 的网络或配置企业镜像源。

---

## 4. 创建 D1 数据库

本项目使用 Cloudflare D1 做用户、套餐、token 使用量存储。

### 4.1 创建数据库

```bash
npx wrangler d1 create oneai-db
```

执行后会返回数据库信息（包含 `database_id`）。

### 4.2 配置 `wrangler.toml`

打开 `wrangler.toml`，将：

```toml
database_id = "replace-with-your-d1-database-id"
```

替换为你刚创建的真实 `database_id`。

---

## 5. 执行数据库迁移

项目已内置迁移文件 `migrations/0001_init.sql`。

### 5.1 本地迁移（用于本地开发）

```bash
npx wrangler d1 migrations apply oneai-db --local
```

### 5.2 远程迁移（用于线上环境）

```bash
npx wrangler d1 migrations apply oneai-db --remote
```

> 建议：本地调试先执行 `--local`，正式发布前再执行 `--remote`。

---

## 6. 本地部署（开发调试）

### 6.1 启动本地服务

```bash
npm run dev
```

默认会启动 Wrangler 本地开发服务，通常地址为：

- `http://127.0.0.1:8787`

### 6.2 访问页面

打开浏览器访问根路径：

- `http://127.0.0.1:8787`

即可看到 OneAI 聊天页面（模型选择、输入框、回复区、token 使用区）。

### 6.3 本地 API 自检

#### 获取模型列表

```bash
curl http://127.0.0.1:8787/api/models
```

#### 发送聊天请求

```bash
curl -X POST http://127.0.0.1:8787/api/chat \
  -H 'content-type: application/json' \
  -d '{
    "userId":"demo-user",
    "model":"@cf/meta/llama-3.2-11b-vision-instruct",
    "messages":[{"role":"user","content":"你好"}]
  }'
```

#### 查询用户 token 用量

```bash
curl http://127.0.0.1:8787/api/usage/demo-user
```

#### 后台设置用户套餐

```bash
curl -X POST http://127.0.0.1:8787/api/admin/user-plan \
  -H 'content-type: application/json' \
  -d '{"userId":"demo-user","planName":"pro"}'
```

---

## 7. Cloudflare 线上部署

### 7.1 确认线上 D1 迁移已执行

发布前请先执行：

```bash
npx wrangler d1 migrations apply oneai-db --remote
```

### 7.2 发布 Worker

```bash
npm run deploy
```

发布成功后，命令行会输出你的线上域名，例如：

- `https://oneai.<your-subdomain>.workers.dev`

### 7.3 验证线上服务

将以下命令中的域名替换为你的真实域名：

```bash
curl https://oneai.<your-subdomain>.workers.dev/api/models
```

```bash
curl -X POST https://oneai.<your-subdomain>.workers.dev/api/chat \
  -H 'content-type: application/json' \
  -d '{
    "userId":"prod-user",
    "model":"@cf/meta/llama-4-scout-17b-16e-instruct",
    "messages":[{"role":"user","content":"线上环境测试"}]
  }'
```

---

## 8. 常见问题

### 8.1 `database_id` 未替换

症状：请求涉及数据库的 API 报错。  
处理：检查 `wrangler.toml` 的 `database_id` 是否为真实值。

### 8.2 未执行迁移

症状：提示找不到表（如 `users`、`plans`）。  
处理：重新执行对应环境（local/remote）的 migrations apply。

### 8.3 npm 安装失败

症状：`npm install` 返回 403 或网络错误。  
处理：切换网络、配置 npm registry 镜像、或使用可访问外网的 CI/CD 环境。

---

## 9. 推荐发布顺序（简版）

1. `npm install`
2. `npx wrangler login`
3. `npx wrangler d1 create oneai-db`
4. 更新 `wrangler.toml` 的 `database_id`
5. `npx wrangler d1 migrations apply oneai-db --remote`
6. `npm run deploy`

