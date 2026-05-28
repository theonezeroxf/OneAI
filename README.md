# OneAI (Cloudflare + TypeScript)

基于 `task.md` 实现的 MVP：

- GPT 风格网页聊天界面，支持以下模型选择：
  - `@cf/meta/llama-3.2-11b-vision-instruct`
  - `@cf/meta/llama-4-scout-17b-16e-instruct`
  - `@cf/google/gemma-4-26b-a4b-it`
  - `@cf/moonshotai/kimi-k2.6`
  - `@cf/moonshotai/kimi-k2.5`
- API 输出 token 统计（input/output/total）
- 达到 token 上限后拒绝服务
- 后台 API 支持为用户设置套餐

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 创建 D1 数据库并更新 `wrangler.toml` 中 `database_id`

3. 执行迁移

```bash
npx wrangler d1 migrations apply oneai-db --local
```

4. 本地运行

```bash
npm run dev
```

## API

- `GET /api/models`: 获取可用模型
- `POST /api/chat`: 发送聊天消息
- `GET /api/usage/:userId`: 查询用户用量
- `POST /api/admin/user-plan`: 设置用户套餐

### 设置套餐示例

```bash
curl -X POST http://127.0.0.1:8787/api/admin/user-plan \
  -H 'content-type: application/json' \
  -d '{"userId":"demo-user","planName":"pro"}'
```
