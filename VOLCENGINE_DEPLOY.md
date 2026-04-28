# 鎏光机火山引擎部署清单

服务器：

- 公网 IP：115.190.216.168
- 系统：Ubuntu 22.04 64 bit

数据库：

- 内网地址：mysql6d3e343810a3.rds.ivolces.com
- 端口：3306
- 数据库名：LiuGuang
- 用户名：mysql-6d3e343810a3

对象存储：

- 桶名：liuguang-ai-film-prod
- 地域：华北 2（北京）
- Endpoint：https://tos-s3-cn-beijing.volces.com
- 公共访问地址：https://liuguang-ai-film-prod.tos-s3-cn-beijing.volces.com

## 1. 先在火山控制台做两件事

### 数据库白名单

进入云数据库 MySQL 实例，找到白名单/安全组，把云服务器的内网访问放行。

如果看不懂白名单页面，优先选择“绑定 ECS 安全组”或“添加 ECS 所在安全组”。

### TOS 访问权限

为了让 AI 接口可以读取参考图，测试阶段建议把桶设置成“公共读、私有写”。

后续正式上线后，可以再改成签名私有访问。

## 2. 在服务器安装运行环境

用火山控制台的 WebShell/远程登录进入服务器，然后执行：

```bash
sudo apt update
sudo apt install -y curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@10.4.1 --activate
```

## 3. 拉取项目

```bash
git clone https://github.com/shiyuji49-source/ai-film-prod.git
cd ai-film-prod
pnpm install --frozen-lockfile
```

## 4. 创建服务器环境变量

在项目根目录创建 `.env`：

```bash
nano .env
```

填入下面内容，把密码和 Key 换成你自己的，不要发到聊天里：

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=换成一串很长的随机英文数字

DATABASE_URL=mysql://mysql-6d3e343810a3:你的数据库密码@mysql6d3e343810a3.rds.ivolces.com:3306/LiuGuang

VECTORENGINE_API_URL=https://api.vectorengine.ai
VECTORENGINE_API_KEY=你的VectorEngineKey
ARK_API_KEY=你的火山方舟ARKKey

STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=你的火山AccessKeyId
AWS_SECRET_ACCESS_KEY=你的火山SecretAccessKey
AWS_REGION=cn-beijing
AWS_S3_BUCKET=liuguang-ai-film-prod
AWS_S3_ENDPOINT=https://tos-s3-cn-beijing.volces.com
AWS_S3_PUBLIC_URL=https://liuguang-ai-film-prod.tos-s3-cn-beijing.volces.com
S3_PUBLIC_READ=true
```

如果数据库密码里有 `@`、`#`、`:`、`/`、`?`、`&` 这类符号，建议先去数据库控制台重置成只包含大小写字母、数字和下划线的密码，最省事。

## 5. 初始化数据库并启动

```bash
pnpm exec drizzle-kit migrate
pnpm build
pnpm start
```

打开：

```text
http://115.190.216.168:3000
```

## 6. 后续稳定运行

第一次能打开后，再配置后台守护进程和 80 端口。

测试阶段先用 3000 端口，最简单。
