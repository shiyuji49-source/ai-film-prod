# 本地数据库

本项目继续使用 Drizzle ORM + MySQL。开发时可以直接启动本地 MySQL：

```bash
docker compose -f docker-compose.local.yml up -d
cp .env.local.example .env
pnpm db:push
pnpm dev
```

默认连接：

```text
mysql://ai_film:liuguang_local@127.0.0.1:3307/ai_film_prod
```

本地库已经包含精品剧新增字段：项目定义、分镜草图、机位示意图、草图/机位图资产类型，以及 Seedance 2.0 默认项目设置。
