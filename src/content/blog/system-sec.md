---
title: 系统安全 基线排查
date: 2026-05-12
summary: Linux and Windows的安全加固
tags:
  - Security
  - 面经
toc: true
draft: false
---
# Linux基线加固与排查

面试回答时，推荐的回答结构

1. 先说基线：账户、密码、服务、防火墙、权限、日志
2. 再排查：日志、进程、端口、定时任务、启动项、webshell、横向移动
3. 关键日志：
   1. Linux：auth.log ; secure ; messages
   2. Windows：4624 ; 4625 ; 7045

## 基线加固

### 账户与密码策略

```bash
cat /etc/passwd
cat /etc/shadow
```

重点：

1. 是否存在空口令账户
2. 是否存在uid=0的非root账户
3. 是否存在长期不用的账户

密码策略：

```bash
cat /etc/login.defs
cat /etc/pam.d/system-auth
```

- 密码长度 ≥ 8
- 大小写+数字+特殊字符
- 密码周期轮换
- 登录失败锁定

### SSH安全加固

```bash
/etc/ssh/sshd_config

PermitRootLogin no
PasswordAuthentication no
Port 22
```

- 禁止 root 远程登录
- 使用密钥认证
- 修改默认端口
- 限制登录 IP

重启：`systemctl restart sshd`

### 文件权限检查

/etc	/tmp	/var/tmp	/root

检查 SUID：`find / -perm -4000 2>/dev/null`

检查 world writable：`find / -perm -2 -type f`

### 服务与端口最小化

查看端口：

```bash
ss -tunlp
netstat -tunlp

# 查看启动服务
systemctl list-unit-files
# 关闭无用服务
systemctl disable telnet
```

### 防火墙与SELinux

```bash
# 防火墙
firewall-cmd --list-all
iptables -L

# SElinux
getenforce
```

### 定时任务检查

```bash
# 系统
cat /etc/crontab
ls /etc/cron.*

# 用户
crontab -l
```

## Linux安全排查

### 登录行为排查

```bash
# 当前登录
who ; users

# 历史登录
last ; lastlog

# 登录失败
lastb

# 日志来源
/var/log/btmp
```

日志位置

```bash
# Debian / Ubantu
/var/log/auth.log

# CentOS
/var/log/secure

# 通用系统日志
/var/log/messages

# 查看日志
tail -f /var/log/secure
# 查找关键词
grep "Accepted" /var/log/secure
```

### 进程排查

```bash
# 查看异常进程
top
ps -ef

# 父子关系
pstree

# 查看进程对应的文件
ls -l /proc/PID/exe
```

### 网络连接排查

```bash
netstat -antp
ss -antp
```

- 外连 IP
- 可疑 ESTABLISHED
- 异常监听端口

### Webshell / 恶意文件排查

```bash 
# 最近修改文件
find /var/www/html -mtime -1
# 一句话木马
grep -R "eval(base64_decode" /var/www/html
```

# Windows基线加固与排查

## 基线加固

### 账户安全

```cmd
# 查看用户
net user

# 查看管理员组
net localgroup administrators
```

- 禁用 Guest
- 重命名 Administrator
- 删除无用账户

### 密码策略

```cmd
# 查看
net accounts
#要求：
# 密码复杂度
# 最短长度
# 锁定策略

# 组策略
gpedit.msc

# 路径
# 计算机配置
# → Windows设置
# → 安全设置
# → 账户策略
```

### 关闭危险服务

```bash
# 查看服务
services.msc

# 关闭
# Telnet
# SMBv1
# Remote Registry
```

### 防火墙

```bash
# 查看
wf.msc
# 命令
netsh advfirewall show allprofiles
```

### RDP 加固

重点：

- 修改 3389
- 限制来源 IP
- 开启 NLA
- 禁止弱口令

## Windows安全排查

### 登录日志查看

```bash
# 事件查看器
eventvwr.msc
# 路径
# Windows日志 -> 安全
```

### 常见登录事件ID

```bash
Event ID 4624 # 登录成功
Event ID 4625 # 登录失败
Event ID 4648 # 使用明确凭据 横向移动

Event ID 4720 # 创建用户
Event ID 4726 # 删除用户

Event ID 7045 # 创建服务 
```

### Windows日志位置

安全日志：C:\Windows\System32\winevt\Logs\Security.evtx

系统日志：System.evtx

应用日志：Application.evtx

### Powershell排查

```powershell
# 查看历史
Get-history
```

事件查看器
→ Applications and Services Logs
→ Microsoft
→ Windows
→ PowerShell

关键事件：

- 4103
- 4104

4104 经常记录恶意脚本。

### 网络连接排查

netstat -ano

关联的PID：tasklist | findstr PID
