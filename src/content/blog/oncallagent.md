---
title: OnCallAgent
date: 2026-05-11
summary: 小林Coding的Agent项目学习记录
tags:
  - Agent
draft: false
toc: true
---
# 名词扫盲

## 大模型

LLM（Large Language Model）：参数量大、训练数据大

本质：next - token预测机器

### 上下文窗口

大模型每次对话时，能看到的内容总量上限，用Token衡量

用户说的话，模型的回复，系统提示，工具调用结果。都在上下文窗口

窗口满了之后 从开头部分覆盖 --> 后文的RAG

### 无状态 Stateless

有记忆的原因是：应用把之前的对话历史一起传给大模型

1. 历史对话太多 --> 上下文窗口会满
2. Agent管理记忆 --> 之行长任务时 主动决定把哪些历史对话传进去

### 对话的角色结构

System：系统提示，给模型的身份设定、行为规则。用户看不到 模型会遵守

User：用户的输入

Assistant：模型之前的回复

```json
messages = [
  {role : "system",    content:"你是一个助理/专家，回答简洁"},
  {role : "user",      content:"数据库报警是什么原因"},
	{role : "assistant", content:"慢查询导致连接池耗尽"},
  {role : "user",      content:"怎么预防？"} // 当前的最新问题
]
```

### 大模型不能做什么

1. 没有执行能力 
2. 知识有保质期，有AI幻觉
3. 上下文窗口有限

## Prompt

Prompt就是发给大模型的所有输入内容，包括：指令、背景信息、参考资料、格式要求等···

例：去餐厅点饭

1. 随便来一份
2. 来一份辣/不辣，香菜/葱 的 豆腐/···

Agent中，大模型的每次输出都要被程序解析和使用。必须要输出稳定，所以必须要给出明确的Prompt

### User Prompt

1. 目标明确：给出明确的指令
2. 背景充足：给的充分，AI就不会乱猜，幻觉就会减少
3. 输出格式：格式、长度、风格等 给出明确的约束要求

### System Prompt

给模型的规则手册，模型每次对话都会记在心里，但是用户看不到

用户可以给大模型加上人设，每次系统把user prompt 和 system prompt一起发给AI模型

1. 身份设定：给一个具体的角色
2. 行为规则：定义模型能做什么 不能做什么
3. 输出格式约束

```bash
你是一个专业的xx领域专家

[行为规则]
- xxxx

[输出格式]
每次回答都是markdown 或者 json格式
```

### 核心原则

1. 给模型“身份” ，告诉模型 往什么方向走，缩小next-token预测的搜索空间，输出更专业，更符合预期
2. 正向约束 > 负向禁止
3. 喂给AI足够的背景信息
4. 指定输出格式（Agent开发的重点
5. Few-shot：在prompt中给几组“输入 -> 输出”的示范样本，让模型照着做。给几个例子 > 约束一堆规则
6. 让模型先思考 再回答（思维链 Chain of Thought

### Prompt的迭代与调试

多准备几个典型输入：正常情况；边界情况；担心出错的情况。每次修改后都跑一遍，看输出是否稳定、是否符合预期

常见问题：

1. 输出格式乱、每次不一样：在System Prompt里加更严格的格式约束 或直接给json示例
2. 回答跑偏、答非所问：检查角色设定是否清晰，行为规则是否有遗漏，背景信息是否充足
3. 输出不稳定，时好时坏：先优化prompt ，不要经常换模型

## 什么是Agent

智能体，以大模型为大脑，自主感知环境、做出决策、调用工具、完成多步骤任务

1. 自主(Autonomously)：不需要人在每一步发指令。给目标 agent自己判断下一步做什么
2. 多步骤(Multi-step)：一个任务分多步，Agent自己把步骤串起来
3. 工具调用(Tool use)：调用真实的函数，查数据库等

Agent = 大模型 + 工具 + 执行循环（思考 - 行动 - 观察 - 再思考）

把大模型等灵活推理能力 和 真实工具的执行能力结合 --> 处理没法提前穷举的所有情况的复杂任务

### Agent如何工作 ReAct循环

ReAct（Reasoning + Acting）：推理(Think) -> 行动(Act) -> 观察(Observe) -> 再推理

```shell
用户：帮我调查今晚23:00的数据库报警

[第 1 轮]
Think:需要先拿到具体的报警详情
Act:调用 get_alarm_details(times = "23:00")
Observe:返回"连接数突增，连接池耗尽，持续8分钟后自动恢复"

[第 2 轮]
Think:连接数突增，看看是哪些查询造成的
Act:调用 query_slow_log(timerange = "22:50-23:10")
Observe:发现3条全表扫描的慢查询，来自同一个用户ID

[第 3 轮]
Think:根因已经清楚，生成分析报告
Act:输出最终分析结论(Final Answer)
```

关键机制：

1. 结果回流：每轮的工具调用结果追加到context window，大模型下一轮就能看到所有历史。基于已有发现继续推理
2. 动态决策：每一步怎么进行，都是大模型实时推理。
3. 何时停止：大模型判断任务完成时输出最终答案，或达到预设的最大轮数上限

### Plan and Execute

ReAct的弱点是 边想边做，不适用于复杂、步骤多的长任务

1. 长任务容易迷路
2. 没有全局规划容易绕弯路
3. token消耗过多

Plan and Execute（规划 - 执行模型）

先让大模型把整个任务规划成一份清单，逐步按清单执行，而不是走一步看一步

第一阶段：Planner（规划阶段）

先不调用工具，把任务拆解成有序的子任务

```shell
用户:「帮我调查今晚 23:00 的数据库报警，写一份完整的故障分析报告」

Planner 输出的计划:
步骤 1:获取 23:00 报警的详细信息(报警类型、持续时间、影响范围
步骤 2:查询报警时间段内的慢查询日志，定位异常SQL
步骤 3:查询报警时间段内的数据库连接数、CPU、内存指标
步骤 4:关联步骤 2和步骤3的结果，分析根因
步骤 5:生成完整的故障分析报告，包含时间线、根因和改进建议
```

第二阶段：Executor（执行阶段）

每次步骤可以是简单的工具调用 或 小的ReAct循环

```shell
执行步骤 1:
	→调用 get_alarm_details(time="23:00")
	-返回「连接数突增，连接池耗尽，持续8分钟后自动恢复」
执行步骤 2:
	-调用 query_slow log(timerange="22:50-23:10")
	-发现 3 条全表扫描的慢查询，来自同一个用户ID
执行步骤 3:
	-调用 get_db metrics(timerange="22:50-23:10")
	-CPU 正常，连接数峰值达到上限 500，内存无异常
执行步骤 4:
	-大模型综合步骤 2、3结果进行分析
	-结论:慢查询导致连接长时间占用，连接池耗尽触发报警
执行步骤 5:
	-生成故障分析报告
	-完整报告输出，任务完成
```

重要机制：Re-Planning 发现任务规划外的情况，Executor反馈给Planner，重新生成后续步骤

1. 任务步骤少、目标模糊、需要随机应变 -> ReAct
2. 任务步骤多、目标明确、需要全局把控 -> Plan and Execute
3. 系统复杂、都需要 -> Plan and Execute做外层框架 子任务内ReAct

### Agent与Workflow

Workflow：提前写好所有的步骤与分支逻辑，大模型只是其中某个步骤被调用一次

Agent：只给任务目标，大模型自己实时决定每一步做什么，根据结果决定下一步

最常见的实际架构：Workflow做骨架，Agent负责中间需要判断的环节

### Agent开发面临的挑战

1. 幻觉传导：多步骤任务中 幻觉带来的成本太高。
   1. 工具结果要可验证
   2. 对高风险操作（写入数据库、执行脚本）加人工确认步骤
2. 工具调用失败：网络超时、返回格式异常、权限不足
   1. 每个工具都要有明确的错误返回格式
   2. System Prompt给出明确的处理情况
3. 成本和速度：每轮循环都消耗token
   1. 合理设置最大循环轮数上限
   2. 能用workflow解决的不用Agent
4. 循环风险：陷入无效循环
   1. 设置最大迭代次数，超出就强制结束
   2. 让大模型每步推理时明确判断是否足够得出结论

### 真实的Agent样子

```python
def run_agent(user_message):
  messages = [
    {"role":"system","content":System Prompt},
    {"role":"user"  ,"content":user_message},
  ]
  
  while True:
    # 调用大模型 让他思考下一步
    response = llm.call(messages)
    # 如果大模型说 “我完成了” 退出循环
    if response.is_final_answer:
      return response.content
    # 否则 执行大模型指定的工具
    tool_result = execute_tool(response.tool_name,response.tool_args)
		# 把工具结果追加到messages 供下一轮参考
    messages.append({"role":"tool","content":tool_result})
```

## Tool

四要素：

1. 函数本体，真正干活的代码：大模型看不到 但是agent会调用
2. name（名称） 大模型的识别标签：起名让大模型看到就能猜到大概
3. description（描述）：大模型调用工具时决策的唯一依据
   1. 能做什么：工具的核心功能
   2. 什么场景：遇到哪类问题 哪种情况
   3. 返回什么：调用完会得到哪些信息
4. parameters（参数定义）：告诉大模型怎么填参数
   1. JSON Schema格式来定义：定义工具有哪些内容需要填，每个空里填什么类型的数据

```python
# 函数本体 大模型看不到 Agent负责执行
import requests

def get_weather(city:str,date:str) -> dict :
  "调用天气API 查询指定城市指定日期的天气"
  response = requests.get(
  	"http://api.weather.com/v1/forecast",
    params = {"city":city, "date":date}
  )
  data = response.json()
  return {
    "city":city,
    "date":date,
    "weather":data["condition"],
    "temperature":data["temp_c"],
    "humidity":data["humidity"]
  }
```

```json
// 二三四部分：工具说明书
{
  "name":"get_weather",
  "description":"查询指定城市在指定日期的天气情况",
  "parameters":{
    "type":"object",
    "properties":{
      "city":{
        "type":"string",
        "description":"要查询天气的城市名称",
      },
      "date":{
        "type":"string",
        "description":"查询日期，格式yyyy-mm-dd"
      }
    },
    "required":["city","date"] //必填
  }
}
```

### 如何给大模型使用工具

Agent每次对话开始前，把所有可用工具的name + description + parameters 打包

通过API的tools参数 传给大模型

工具有哪些类型：

1. 查询类。风险低 无需人工确认
2. 写入类。风险中 对高风险的写入操作 最好加一个人工确认步骤
3. 执行类。风险高 必须严格限制权限范围；重要操作人工审批
4. AI辅助类。AI能力本身封装为工具，比如配一个RAG检索工具，随时查内部知识库、历史案例；专门的分类模型封装成工具，只拿结论 不需要处理所有细节。风险低 - 中

## Function Call

上面知道了大模型要靠 工具描述 判断要不要 调用工具

关键问题：大模型做出决策后，怎么告诉Agent去执行

----

没有Function Calling之前，靠自然语言 猜：

​	把工具的描述和调用规范，全部用自然语言写进System Prompt

本质：是一套大模型和Agent之间的标准化工具调用协议，使用固定的JSON格式

核心结构：

1. 工具定义：给大模型的工具说明书
2. AI调用格式（Function Call）：

```json
{
  "function_call":{
    "name":"check_weather",
    "parameters":{
      "city":"上海",
      "date":"2026-05-12"
    }
  }
}
```

3. 工具返回结果(Tool Response) Agent把结果回传给大模型

## 什么是MCP

Model Context Protocol  模型上下文协议：把工具的 写好 和 用起来 彻底拆开

三大角色：

1. Host（宿主）：最终使用的AI应用 Claude Desktop / Codex
2. Client（客户端）：Host内部的一个组件，专门负责管理和MCP Server的连接
3. Server（服务端）：对外暴露工具能力的轻量级服务程序

### MCP和Function Call的区别

Function Call 解决：大模型做出决策后，怎么通过标准化格式传给Agent

MCP解决：Agent接到命令后如何找到并执行工具

大致流程为

大模型 -> Function Call  -> Agent  -> MCP  -> MCP Server  -> 本地调用/API请求 -> 工具

### MCP Server的三种能力

1. Tools（工具）：AI可以主动调用执行的函数。底层机制就是Function Calling，MCP进行了标准化封装，不需要手写每个Tool的Function Calling定义。
2. Resources（资源）：AI可以读取访问的数据。Tools会改变外部状态，而Resources只能读取 不能改变。
3. Prompts（提示词）：预定义的可复用提示词模版。常用的 固定结构的提示词可以封装成MCP Prompts。

## Skills

​	从Chatgpt问世，只能进行问答式交互。AI没有被赋予与外部进行交互的能力，然后**Function Calling**诞生了，AI从此有了使用工具的能力。但是此时各种工具百花齐放，各家之间的接口差异很大，不能够兼容。于是**MCP(Model Context Protocol 模型上下文协议)**登场，类似于 Type-C对于手机一样 对AI进行了统一标准，把外部工具按照MCP标准进行开发，无论哪个大模型都可以即插即用。

​	但是有了标准化的能力，AI每次干活时都需要反复叮嘱，光知道怎么标准的使用工具，每次的具体流程都得重新沟通。

### 什么是Skill？

把解决特定问题所需要的 背景设定(Prompt)、执行步骤 和 需要的工具(MCP)打包成一个文件。

```bash
---
name:report-generator
description:按照公司标准格式自动收集数据并生成报告
tools:	# 所需的MCP工具
	- mcp-jira-reader
	- mcp-database-query
---
# 报告生成流程
1. 包含封面页（模版在 xxx.md）
2. 执行数据分析（自动调用 mcp-database-query
3. 提取任务进度（自动调用 mcp-jira-reader
4. 生成图表和摘要
···
```

### RAG

Retrieval 检索 - Augmented 增强 - Generation 生成

### 大模型看不到你的数据

1. 知识截止日期：训练数据截止到某一天，大模型对这个时间之后的数据没有了解
2. 私有数据：企业内部的文档、方案等都是保密的，不会出现在大模型的训练数据中
3. 实时数据：哪怕每天都更新，但也不是时刻训练，追不上实时 动态的问题

大模型的知识是静态、封闭的；业务数据是动态、私有的

暴力解法：那直接把所有数据塞到prompt就好了

1. Context Window有上限，不可能容纳所有的数据
2. Token是要花钱的，塞太多背景信息，每次推理都要花token去理解背景。token越多，模型推理速度还慢
3. 注意力稀释：上下文太长时，会导致找不到重点，表现更差

### RAG的核心思路

不把所有的数据都塞进Prompt，在每次回答前，找到最相关的 塞进Prompt

**离线建库**

一次性的准备工作，数据更新时重做。把私有数据处理成大模型能快速检索的格式，存进向量数据库。

加载文档 -> 文本切块(chunking) -> 向量化(Embedding) -> 存入向量数据库

1. 把所有的PDF、Word、Markdown等各种类型的数据统一解析为纯文本
2. 拿到文本后，切成小块。因为检索时可能只需要其中一个主题，过长的chunk转化成向量不够精准
3. 向量化，通过一个Embedding模型转换成一串数字。意思相近的文字，转化出来的向量在数学空间里距离也相近
4. 存入向量数据库，如Milvus Pinecone Weaviate等

**在线检索生成**

问题向量化 -> 语义搜索 -> 构造增强Prompt -> 大模型生成回答

1. 用同一个Embedding模型 把用户的问题转化成向量
2. 拿着问题的搜索，去向量数据库找几个最相似的chunk的向量。找到之后把对应原文的chunk，找3-5个最相关的片段
3. 构造增强Prompt，把最相关的片段和用户的问题拼接在一起
4. 大模型根据背景资料生成回答

### 语义搜索与关键词搜索的差别

**传统关键词搜索：**

逐字匹配，搜[数据库慢]，只找包含这几个字的文档。哪怕是[查询响应时间过长]，也不能找到

**语义搜索：**

找意思相近的，不求字面相同。向量距离近 代表 语义上相关

### RAG和Agent的关系

​	RAG本质上是一个特殊的工具，Function Caliing下达[调用知识库检索工具，查询xxx]，Agent执行工具调用，触发了RAG的在线流程，检索结果返回给大模型，大模型基于检索结果继续推理。

## 向量数据库

向量搜索：给一个向量 找到和它最相似的top-k个向量

​	相似即计算向量间的距离：余弦相似度、欧氏距离。需要用当前向量和库中每条向量进行计算对比、排序，取出最小的几个。普通数据库可以存向量，但是查向量相似度没有相应的优化

**向量数据库：**在海量数据，毫秒级找到最相似的top-k条

秘诀：ANN (Approximate Nearest Neighbor 近似最近邻)搜索

​	并不保证找到绝对最相似的，而是差不多最相似的几条，语义检索不需要那么精准

算法：HNSW(Hierarchical Navigable Small World 分层可导航小世界图)

​	把所有的向量组织成一个多层的图结构：

​	高层（稀疏层）：只有少量节点，每个节点连接着几个邻居。负责大范围的快速跳转，缩小搜索范围

​	底层（稠密层）：所有向量都在这里，精细定位最终的近邻候选

结果：牺牲极少量精度，换取100倍以上的速度提升

### 主流数据库

**Chroma**：本地轻量级数据库，Python原生API

​	优点：本地开发，功能验证，快速上手原型

​	缺点：不适合生产环境，没有高可用、分布式

**Pinecone**：全托管的云向量服务器，只需要调用API

​	优点：快速上线，不用自己运维

​	缺点：数据在第三方，按量收费，数据合规的场景不一定合适

**Milvus**：开源的生产级向量服务器，功能全，支持多种索引类型、分布式部署、数据持久化

​	优点：适合私有化部署的生产环境，数据不出内网，需要精细控制、规模较大的场景

​	缺点：部署和运维有一定复杂度

**Weaviate**：开源向量数据库，内置了Embedding集成。同时支持图片、音频等多模态数据

​	优点：需要多模态搜索，简化Embedding步骤

**Qdrant**：Rust实现的高性能向量数据库，内存占用低，查询速度快，适合资源受限或高并发场景。接口设计简洁，HTTP/gRPC都支持

​	优点：对性能和资源消耗敏感的生产环境

# 项目架构设计

知识库Agent：把分散的文档、手册等私有数据转化为统一的数据资产

对话Agent：重复咨询 -> 文档检索 -> 问题匹配的逻辑 抽象为一个中控知识引擎，支持多场景的复用

运维Agent：实现跨系统联动架构，打破了日志、监控、告警群、文档间的信息孤岛

# 知识库RAG方案设计与源码分析

## 为什么需要知识库

​	传统文档管理的痛点 -- 信息孤岛。明明知道知识存在，但是不知道在什么地方。所以知识库要解决的问题就是：把大海捞针变成快速找到。

**知识库的核心流程：**

从文档到AI能用，经历了什么？

1. 文档拆分(Chunking)

   把上传的文档，按章节 段落 或者自定义规则进行拆分。智能适配不同的文档格式。

   关键：每个拆出的片段，都要包含完整的语义信息。

2. 文本向量化(Embedding)

   把每个文本片段转化成一组高维向量。语义越相近，向量空间中向量越相近。

3. 向量库存储

   知识库把生成的向量，连同元信息（来自哪份文档，作者，最后更新时间）等一起存入向量数据库

   1. 方便溯源
   2. 支持过滤（按时间、作者等

## 架构设计：RAG全流程解析

### 为什么需要RAG

​	大模型的知识来源于训练数据，当你给它没有见过的数据时，通常会想：全部喂给大模型。

1. 上下文窗口有限，一次处理不了过多信息
2. 成本高，token收费
3. 内容太多，分散了注意力

RAG：先检索 再生成。

### 核心流程：两条链路

提问前（数据准备）：分片 -> Embedding -> 存储

提问后（回答生成）：召回 -> 重排 -> 生成

**提问前：**

1. 分片。文档切成一段一段的小片段，每个片段聚焦一个具体的知识点。

   1. 按固定字数切：如每1000字一段
   2. 按段落切：每个自然段
   3. 按章节/标题切：按文档本身的结构来
   4. 按页码切：一页一个片段

   重点：要确保切出来的每一段都能表达一个完整的意思

2. Embedding - 让计算机”听懂“文字

   1. 把文字换成一个高维的数字，纬度越高，表达的信息越丰富
   2. 意思相近的文字，转换的向量也会相近

3. 存储 - 把片段和向量存进“数据库”：向量和原始文本两个一起存。

   ​	向量知识用来做相似度计算的索引，最终给大模型看的还是原始的文字内容

**提问后：**

1. 召回 - 广泛搜索
   1. 先把用户的问题通过同一个Embedding转换成向量
   2. 拿着问题向量去数据库找最相似的片段，挑出top-k

常用的算法

余弦相似度：只看方向 不看长度。适合文本语义匹配（只关心意思一样不，不关心两者文本长度）

欧氏距离：两点间的直线距离，距离越小越相似。即看方向也看长度，适合需要考虑数值大小的场景

召回速度快、成本低，但精度有限

2. 重排 - 优中选优

​	把问题和片段**拼在一起**输入模型，让模型直接判断两段话多相关。（Cross Encoder，交叉编码器）

​	同时看到问题和片段的完整内容，捕捉到更细微的语义关系。只对召回阶段筛选的k个片段重新排列，选出Top k（新的几个）最相关

​	弥补了召回阶段精度不足的缺点

3. 生成 - 组织回答

​	已经有了最相关的知识片段，最后把它们 和 用户的问题一起给大模型。大模型拿到相关信息后，能够基于真实的知识内容组织语言、生成回答

这样做能够：

1. 减少幻觉
2. 成本更低
3. 速度更快
4. 准确率更高

## 代码实现- Python

实现知识库Agent的上半部分：文件向量化后存储到数据库

app/services/vector_index_service.py

大致流程：读取文件 -> 切分文件 -> 索引（Embedding和存储）

**读取文件**

传入文件路径file_path , 使用pathlib.path读取文件内容到内存

```python
# index_single_file函数 读取文件内容
content = path.read_text(encoding="utf-8")
```

Index_single_file是索引单个文件的入口方法，完整实现如下

```python
def index_single_file(self,file_path:str):
  """
  索引单个文件（LangChain分割器
  Args：file_path：文件路径
  Raises：
  	ValueError:文件不存在时抛出
  	RuntimeError:索引失败时抛出
  """
  path = Path(file_path).resolve()
  
  if not path.exists() or not path.is_file():
    raise ValueError(f"文件不存在：{file_path}")
    
  logger.info(f"开始索引文件：{path}")
  
  try:
    # 读取文件内容
    content = path.read_text(encoding = "utf-8")
    logger.info(f"读取文件：{path},内容长度：{len(content)}字符")
    
    # 删除文件的旧内容（如果存在）
    normalized_path = path.as_posix()
    veector_store_manager.delete_by_source(normalized_path)
    
    # 使用文档分割器切分文档
    documents = document_splitter_service.split_document(content,normalized_path)
    logger.info(f"文档分割完成：{file_path} -> {len(documents)} 个分片")
    
    # 添加文档到向量存储（自动完成Embedding + 入库）
    if documents:
      vector_store_manager.add_documents(documents)
      logger.info(f"文件索引完成：{file_path}，共{len(documents)}")
    else:
      logger.warning(f"文件内容为空或无法分割:{file_path}")
      
    except Exception as e:
      logger.error(f"索引文件失败:{file_path},错误：{e}")
      raise RuntimeError(f"索引文件失败:{e}") from e
```

**文件分块**

文档分块使用LangChain提供的分割器，分为三个阶段：
1. 按Markdown标题（#、##）切分，将文档分割成多个章节
2. 对每个章节使用 RecursiveCharacterTextSplitter 进行二次分割，超过chunk_size \* 2 的章节会被拆分
3. 合并过小的分片（<300字符），避免过度碎片化 同时通过chunk_overlap保持分片间的上下文语义连贯
DocumentSplitterService初始化时会配置好两个分割器
```python
def DocumentSplitterService:
	def __init__(self):
	self.chunk_size = config.chunk_max_size   # 默认800
	self.chunk_overlap = config.chunk_overlap # 默认100
	
	# 第一阶段：Markdown 标题分割器（按# 和 ## 切分）
	Self.markdown_splitter = MarkdownHeaderTextSplitter(
		headers_to_split_on=[
			("#", "h1")
			("##","h2")
		],
		strip_headers = False, # 保留标题在内容中
	)
	
	# 第二阶段：递归字符分割器（用于二次分割）
	self.text_splitter = RecursiveCharacterTextSplitter(
		chunk_size = self.chunk_size \* 2,
		chunk_overlap = self.chunk_overlap,
		length_funtion = len,
		is_separator_regex = False,
	)
```
Markdown文档完整的三阶段分割逻辑
```python
def split_markdown(self,content:str,file_path:str = "") -> List[Document]:
	"分割Markdown文档（两阶段分割 + 合并小片段）"
	# 第一阶段 按标题分割
	md_docs = self.markdown_splitter.split_text(content)
	
	# 第二阶段 按大小进一步分割
	docs_after_split = self.text_splitter.split——documents(md_docs)
	
	# 第三阶段 合并太小的分片（<300字符）
	final_docs = self._merge_small_chunks(docs_after_split,min_size = 300)
	
	# 添加文件路径元数据
	for doc in final_docs:
		doc.metadate["_source"] = file_path
		doc.metadata["_extension"] = ".md"
		doc.metadata["_file_name"] = Path(file_path).name
		
	logger.info(f"Markdown分割完成：{file_path} -> {len(final_docs)} 个分片")
	return final_docs
```
合并小分片的逻辑 `_merge_small_chunks`：遍历所有分片，若当前分片小于min_size且合并后不超限，则将其追加到上一个分片中
```python
def _merge_small_chunks(self,documents:List[Document],min_size:int = 300) -> List[Document]:
	merged_docs = []
	current_doc = None
	
	for doc in documents:
		doc_size = len(doc.page_content)
		
		if current_doc is None:
			current_doc = doc
		elif doc_size < min_size and len(current_doc.page_content < self.chunk_size \* 2):
			# 当前分片太小且合并后不会太大 则合并
			current_doc.page_content += "\n\n" + doc.page_content
		else:
			# 保存当前文档，开始新文档
			merged_docs.append(current_doc)
			current_doc = doc
			
		if current_doc is not None:
			merged_docs.append(current_doc)
			
		return merged_docs
```
**文件索引** - 向量化和存储到数据库
Embedding生成
`DashScopeEmbeddings`实现LangChain标准的Embeddings接口，通过阿里云DashScope的OpenAI兼容模式调用`text-embedding-v4`模型，生成1024维向量
```python
class DashScopeEmbeddings(Embeddings):
	def __init__(self,api_key:str,model:str = "text-embedding-v4"),
		self.client = OpenAI(
			api_key = api_key
			base_url = 
		)
```