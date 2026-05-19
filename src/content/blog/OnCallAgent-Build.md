---
title: OnCallAgent实际部署
date: 2026-05-19
summary: 小林Coding的Agent项目实际部署
tags:
  - Agent
toc: true
draft: false
---
# 环境准备
Python版本 教程推荐用 - 阿里的大模型
1. 登陆阿里云 新注册免费送token：`https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-market`
2. 创建API Key: `https://bailian.console.aliyun.com/cn-beijing?tab=model#/api-key`
3. 阿里云的模型不需要开启，可以直接使用，记住创建的密钥即可
### CLS MCP配置
1. 登陆腾讯云：`http://console.cloud.tencent.com/`
2. 创建密钥，secret id/key保存下来，后面要用：`http://console.cloud.tencent.com/cam/capi`
3. 进入腾讯云CLS MCP配置页面：`http://console.cloud.tencent.com/developer/mcp/server/11710`
4. 