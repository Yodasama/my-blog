---
title: OnCallAgent实际部署
date: 2026-05-19
summary: 小林Coding的Agent项目实际部署
tags:
  - Agent
toc: true
draft: false
---
终于学完了小林Coding的OnCallAgent项目，现在实际部署一下，看看有哪些坑会踩。
# 环境准备
Python版本 教程推荐用 - 阿里的大模型
1. 登陆阿里云 新注册免费送token：`https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-market`
2. 创建API Key: `https://bailian.console.aliyun.com/cn-beijing?tab=model#/api-key`
3. 阿里云的模型不需要开启，可以直接使用，记住创建的密钥即可
### CLS MCP配置
1. 登陆腾讯云：`http://console.cloud.tencent.com/`
2. 创建密钥，secret id/key保存下来，后面要用：`http://console.cloud.tencent.com/cam/capi`
3. 进入腾讯云CLS MCP配置页面：`http://console.cloud.tencent.com/developer/mcp/server/11710`
4. 第一个填stdio，然后填刚才保存的secret id 和 secret key，点击连接server
5. 保存返回给的URL，后面要用
### Python项目配置
1. 配置文件路径`ONCALLAGENT/.env`，只需要修改`DASHSCOPE_API_KEY`即可运行
2. conda create -n oncallagent python=3.11 -y
3. pip install -e . 下载配置文件
4. `docker compose -f vector-database.yml up -d`启动Milvus
5. docker ps 检查是否启用
**启动MCP服务**
终端1：CLS日志查询服务
`python mcp_servers/cls_server.py`
终端2：Monitor监控服务
`python mcp_servers/monitor_server.py`
**启动FastAPI主服务**
终端3：`python -m uvicorn app.main:app --host 0.0.0.0 --port 9900`
然后访问 `http://localhost:9900`
API文档：``http://localhost:9900
**上传知识库文档**
如果aiops-docs / 里已经有markdown文档，执行
`python -c "import requests, os, time; [requests.post('http://localhost:9900/api/upload', files={'file': open(f'aiops-docs/{f}', 'rb')}) or time.sleep(1) for f in os.listdir('aiops-docs') if f.endswith('.md')]"`
这一步的作用是：把 aiops-docs 里的 md 文档切分、向量化、写入 Milvus

# 正式部署
打开页面后 发现查询失败，codex分析后是聊天模型走了
`https://dashscope-intl.aliyuncs.com/compatible-mode/v1`国际站
而不是`https://dashscope.aliyuncs.com/compatible-mode/v1`中国站

在启动9900端口时，先设置这些命令
```bash
cd /Users/yida/项目/OnCallAgent

unset http_proxy
unset https_proxy
unset HTTP_PROXY
unset HTTPS_PROXY

set -a
source .env
set +a

export DASHSCOPE_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
export DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
export OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
export RAG_MODEL=qwen-plus
export DASHSCOPE_MODEL=qwen-plus

python -m uvicorn app.main:app --host 127.0.0.1 --port 9900
```
然后另开终端测试：
```bash
curl --noproxy '*' -i --max-time 60 -X POST "http://127.0.0.1:9900/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"Id":"test-session","Question":"你好"}'
```
# 结果：
主页面![[对话助手页面.png]]
快速模式的回答：
![[快速模式回复.png]]
![[快速回答后台样式.png]]
流式回答：
![[流式回答后台样式.png]]
点击AI Ops后，根据当前工具进行查询，然后根据后台已有的技术文档输出制定计划
![[运维自动规划功能.png]]
由于使用了FastAPI,自动生成了文档
![[技术文档.png]]