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

## 代码实现 - 存储 - Python

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
			base_url = "https://dashcope.aliyuncs.com/compatible-mode/v1"
		)
		self.model = model
		self.dimensions = dimensions
```
批量向量化文档(embed_documents) 和 单挑查询向量化(embed_query)分别对应入库和检索场景
```python
def embed_documents(self,texts:List[Str]) -> List[float]:
	"批量嵌入文档列表 返回向量列表"
	response = self.client.embedding.create(
		model = self.model,
		input = texts,
		dimensions = self.dimensions,
		encoding_format = "float"
	)
	return [item.embedding for item in response.data]
	
def embed_query(self,text:str) -> List[float]:
	"嵌入单个查询文本 返回单条向量"
	response = self.client.embeddings.create(
		model = self.model,
		input = text,
		dimensions = self.dimensions,
		encoding_format = "float"
	)
	return response.data[0].embedding
```
**向量存储到Milvus**
`VectorStoreManager`封装了`langchain_milvus.Milvus`，将LangChain Document对象直接批量写入Milvus，字段映射关系如下

| LangChain字段  | Milvus Collection字段 |              说明               |
| :----------: | :-----------------: | :---------------------------: |
| page_content |       content       |             文本内容              |
|   向量（自动计算）   |       vector        |         1024维float向量          |
|   id(UUID)   |         id          |              主键               |
|   metadata   |      metadata       | JSON元数据（含_source、\_file_name等 |
初始化时链接Milvus：
```python
self.vector_store = Milvus(
	embedding_function = vector_embedding_service,
	collection_name = "biz",
	connection_args = {"host":config.milvus_host,"port":config.milvus_port},
	auto_id = False,
	drop_old = False,
	text_field = "vector",
	primary_field = "id",
	metadata_field = "metadata",
)
```
批量入库时，LangChain会自动调用embed_documents完成向量化，无需手动循环处理每个分片：
```python
def add_documents(self,documents:List[Document]) -> List[str]:
	import time, uuid
	start_time = time.time()
	
	# 为每个文档生成唯一UUID（auto_id = False时必须手动提供
	ids = [str(uuid.uuid4()) for _ in documents]
	
	# LangChain Milvus 的add_documents 自动调用 Embedding_function 批量向量话并写入
	result_ids = self.vector_store.add_documents(documents,ids = ids)
	
	elapsed = time.time() - start_time
	logger.info(
		f"批量添加{len(documents)}个文档完成，"
		f"耗时:{elapsed:.2f}秒，平均：{elapsed/len(documents):.2f}秒/个"
	)
	return result_ids
```
在重新索引同一个文件前，会先按_source路径删除旧数据
```python
def delete_by_source(self,file_path:str) -> int:
	"删除指定文件的所有文档"
	collection = milvus_manager.get_collection()
	# metadata是Json字段 使用Json路径查询语法
	expr = f'metadata["_source"] == "{file_path}"'
	result = collection.delete(expr)
	deleted_count = result.delete_count if hassttr(result,"delete_count") else 0
	logger.info(f"删除文件旧数据:{file_path},删除数量:{deleted_count}")
	return deleted_count
```
## 代码实现 - 召回 - Python
流程：
1. 将查询文本向量化
2. 相似度查询
search_similar_documents是底层召回的完整实现
```python
def search_similar_documents(self, query:str, top_k:int = 3) -> List[SearchResult]:
	"""
	搜索相似文档
	Args:
		query:查询文本
		top_k:返回最相似的k个结果
		
	Returns:
		List[SearchResult]:搜索结果列表
	"""
	logger.info(f"搜索相似文档，查询:{query},topK:{top_k}")
	
	# 1.查询文本向量化
	query_vector = vector_embedding_service.embed_query(query)
	logger.debug(f"查询向量生成成功,纬度:{len(query_vector)}")
	
	# 2.获取collection
	collection:Collection = milvus_manager.get_collection()
	
	# 3.构建搜索参数
	search_params = {
		"metric_type":"L2" #欧氏距离 与入库时的索引类型保持一致
		"params":{"nprobe":10},	
	}
	
	# 4.执行搜索
	results = collection.search(
		data = [query_vector],
		anns_field = "vector",
		param = seaerch_params,
		limit = top_k,
		output_fields = ["id","content","meradata"],
	)
	
	# 5.解析搜索结果
	search_results = []
	for hits in results:
		for hit in hits:
			result = SearchResult(
				id = hit.entity.get("id"),
				content = hit.entity.get("content"),
				score = hit.distance,
				metadata = hit.entity.get("metadata",{}),
				search_results.append(result)
			)
	logger.info(f"搜索完成 找到len(search_results)个相似文档")
	return search_results
```
**查询文本向量化**
首先对用户问题进行向量化，调用`DashScopeEmbeddings.embed_query`，通过DashScope OpenAI兼容接口获取1024维向量：
```python
# 1.将查询文本向量化
query_vector = vector_embedding_service.embed_query(query)
# 2.embed_query的实现（复用入库时相同的API 无额外开销
def embed_query(self,text:str) -> List[float]:
	"嵌入单个查询文本 返回单条向量"
	response = self.client.embeddings.create(
		model = self.model,
		input = text,
		dimensions = self.dimensions,
		encoding_format = "float"
	)
	return response.data[0].embedding
```
**构建搜索参数并执行向量检索**
使用PyMilvus的collection.search进行相似度查询 获取距离最近的向量数据
```python
# 构建搜索参数
search_params = {
	"metric_type":"L2",
	"params":{"nprobe": 10},
	# 搜索时探测的cluster数量 越大越精确 但是越慢
}
	
# 执行搜索
results = collection.search(
	data = [query_vector],
	anns_field = "vector",
	param = search_params,
	limit = top_k,
	output_fields = ["id","content","metadata"],
)
```
搜索结果封装到SearchResult对象中，score为L2欧氏距离，越小表示越相似
```python
class SeaerchResult:
	def __init__(self,id:str,content:str,score:float,metadata:Dict[str,Any]):
		self.id = id
		self.content = content
		self.score = score
		self.metadata = metadata
```
# 对话Agent
## 前置准备：对话的需求 场景 价值分析
需求：解决重复咨询耗费人力，响应慢，经验流失等痛点

对话Agent：核心逻辑通用，可以用于多个相似场景
1. 业务方支持
2. 值班自救
3. 工单预处理

对话Agent背后的核心技术
1. RAG
2. Prompt
3. 多轮对话 记住上下文
4. 流式输出：SSE技术
SSE(Server-Sent Events) 服务器推送事件，服务器算一点就推送一点，前端实时显示。
5. 容错处理：避免产生AI幻觉
## 架构设计：ReAct设计模式
### 什么是ReAct
ReAct = Reasoning / 推理 + Acting / 行动

例如：问Ai “地球和火星的质量加起来等于多少”
	Ai不会做精确计算，本质上是预测下文
人面临这个问题的思维：
1. 想：地球质量是多少，火星质量是多少
2. 查：打开搜索引擎，查找相关数据
3. 算：两个数据加在一起
4. 答：地球的质量+火星的质量是xxx
ReAct就是让Ai模拟人的过程：思考 -> 行动 -> 观察 -> 再思考 -> ··· -> 输出
### 最早的ReAct是怎么实现的
依靠Prompt + 字符串解析
1. 用Prompt告诉Ai该怎么输出
在System Prompt中严格规定Ai的输出格式，让他必须按照Thought -> Action -> Pause的模式进行回复
```shell
工作流程：
1. Thought:描述你的推理过程
2. Action:执行一个动作（调用工具等）
3. Pause:停下来 等待工具返回结果
4. Observation:分析工具返回的结果
   
可用工具：
- calculation:数学计算
- planet_mass:查询行星质量
```
2. 代码解析Ai的输出 调用相应工具
```shell
1. Thought: 我需要地球和火星的质量，先查地球
2. Action: planet_mass:Earth
3. Pause
   
Observation: Earth has a mass of xxx kg
```
用正则表达式解析文本，把Action: planet_mass:Earth拆出来，知道要调用planet_mass这个函数，参数是Earth。然后把结果包装成Observation返回给AI。
AI继续思考、行动、循环 直到不再输出Action，直接给出Answer 结束
#### 伪代码表示流程
```python
def query(question):
	messages = [system_prompt,question] #初始化对话
	
	for i in range(max_turns): # 最多循环N轮
		result = call_llm(messages) # Prompt发给AI
		
		if "Action:" in result: # Ai 输出里有Action？
			tool,input = parse(result) # 有 -> 正则解析出工具名和参数
			observation = run_tool(tool,input) # 执行工具，拿到结果
			messages.append(f"Observation:{Observation}") # 结果返回AI
		else:
				return result # 没有Action 输出最终结果
```
#### 存在的问题
1. 格式脆弱：完全依靠正则匹配字符串，不按格式输出就不能匹配
2. 复杂参数搞不定：工具的输入是潜逃的JSON对象，用字符串很难进行描述和解析
3. 手动进行错误处理：输出了不存在的工具名，格式错误
4. 开发成本高：每个项目都要设计格式，写解析逻辑，处理边界情况
### 现代ReAct怎么实现
把古法ReAct进行标准化，用JSON进行统一的工具定义和调用格式
Function Call：
1. 工具描述：用标准的JSON格式定义工具的名字 功能
2. AI怎么调用：返回结构化的JSON，不输出自然语言字符串
3. 结果怎么回传：按照规定的格式传回给AI
#### 现代ReAct的执行流程
```shell
1. 把工具的JSON描述 + 用户问题 一起发给大模型
   
2. 大模型自己判断要不要调用工具
	- 需要 -> 返回标准JSON格式的tool_calls
	- 不需要 -> 直接返回文本答案

3. 解析JSON，执行对应的工具函数，拿到结果

4. 把工具结果按规定格式加到对话里 开始下一轮循环

5. 大模型不再返回 tool_calls -> 循环结束 输出最终答案
```
### ReAct的好处
1. AI具备了使用工具的能力
2. AI的回答更准确、更可靠
3. 解题过程透明可追踪
4. 具备了处理复杂多步骤任务的能力
5. AI Agent的基石
## 对话Agent的核心流程解析
### 从RAG召回到ReAct多轮交互
对话Agent的核心目标是结合外部知识 RAG召回 与 工具调用能力(ReAct模式)，解决复杂问题
流程如下：
1. 用户输入 -> Embedding -> 向量数据库召回
2. 构建带上下文(召回内容)的Prompt
3. ReAct模式多轮交互
4. 最终输出答案![[对话Agent工作流程.png]] 
#### RAG召回：学习外部知识
目标：从向量数据库中获取与用户问题相关的上下文信息
步骤：
1. 用户输入经InputToRag Lambda Node处理，生成用于召回的字符串
2. 调用Retriever组建，通过用户召回的字符串
3. 向量数据库执行相似度匹配，返回相关文档
4. 结果存入`map["documents"]`，作为后续Prompt的上下文来源
#### Prompt构建：动态拼接上下文与对话历史
目标：将用户输入、RAG召回内容、对话历史 整合成大模型可理解的Prompt
构建好之后 将Prompt移交给ReAct组件使用
核心组件：`ChatTemplate`
```python
输入：两个lambda node的输出合并

SystemPrompt:"xxx"
UserPrompt:"xxx"
```
占位符设计：
{content}:用户原始问题
{documents}:RAG召回的相关文档
{date}:当前时间（增强时效性）
{history}:历史对话
#### ReAct模式：让Agent学会"思考-行动-观察"循环
目标：通过多轮工具调用解决复杂问题，核心是"显示思考 - 工具调用 - 结果观察"
具体流程可参考上文中：[[#现代ReAct怎么实现]]
#### 关键组件分析
Lambda Node:数据流转的“转换器”
`InputToRag`:
	输入：用户原始问题（可自定义预处理，过滤无关信息
	输出：用于RAG召回的字符串（直接影响召回精度，需确保与向量数据库存储内容匹配
`InputToChat`：
	输入：用户问题+对话历史
	输出：map结构（含content / history 等key），作为ChatTemplate的动态参数来源

Retriever:向量召回的“连接器”
以Milvus实现为例，`Retrieve`方法核心逻辑
```go
func (r *MilvusRetriever) Retriece(ctx context.Context, input string)([]*schema.Document,error){
	// 1.问题向量化
	embedding,_ := r.embedding.Embed(ctx,input)
	// 2.向量数据库查询（TopK相似度匹配）
	results,_ := r.client.Search(ctx, embedding, 5) // top5
	// 3.格式转换为schema.Document
	return convertToDocuments(results),nil
}
```
Tool:Agent的“双手”
	本质是带描述的函数，需要明确告知大模型：
- 函数名称（如“查询当前时间”）
- 入参/返参格式（JSON描述）
- 使用场景（如”当问题涉及到当前时间时调用“）
## 对话Agent代码实现-Python
### 消息召回
召回通过`retrieve_knowledge`工具实现，Agent在推理是会自动判断是否需要调用工具检索知识库。工具内部通过VectorStoreMananger.similarity_search完成向量检索。
可见上文:[[#代码实现 - 召回 - Python]]
```python
# retrieve_knowledge 工具挂载到Agent上
self.tools = [retrieve_knowledge,get_current_time]
```
### 构建Prompt
系统提示词在`_build_system_prompt`中构建，描述Agent的角色定位和行为准则。
与工具列表无关 - LangChain框架会自动将工具信息传递给大模型，prompt中无需手动列举：
```python
def _build_system_prompt(self) -> str:
	from textwrap import dedent
	return dedent("""
		你是一个专业的AI助手，能够使用多种工具来帮助用户解决问题。
		
		工作原则:
		1.理解用户需求，选择合适的工具来完成任务
		2.当需要获取实时信息或专业知识时，主动使用相关工具
		3.基于工具返回的结果提供准确、专业的回答
        4.如果工具无法提供足够信息，请诚实地告知用户
		
		回答要求:
		- 保持友好、专业的语气
		- 回答简洁明了，重点突出
		- 基于事实，不编造信息
		- 如有不确定的地方，明确说明
		
		请根据用户的问题，灵活使用可用工具，提供高质量的帮助。
		""").strip()
```
会话历史由LangGraph的`MemorySaver` checkpointer自动管理，每次调用时传入相同的`thread_id` (即`session_id`)即可自动携带上下文，无需手动拼接历史消息到prompt
### 创建ReAct Agent
使用LangChain的`create_agent`创建Agent，绑定ChatQwen模型、工具列表和`MemorySaver`检查点。MCP工具（腾讯云CLS日志、监控告警等）在首次请求时异步加载，与本地工具合并后一起绑定：
```python
class RagAgentService:
	def __init__(self,streaming:bool = True):
		self.model = ChatQwen(
			model = config.rag_model,
			api_key = config.dashscope_api_key,
			temperature = 0.7,
			streaming = streaming,
		)
		
		# 本地工具：RAG知识检索 + 时间查询
		self.tools = [retrieve_knowledge,get_current_time]
		
		# 会话持久化(基于内存的 checkpointer)
		self.checkpointer = MemorySaver()
		
		self.agent = None # 延迟初始化（等待MCP工具加载完成）
	
	async def _initialized_agent(self):
		"异步初始化 Agent（包括MCP工具）"
		if self._agent_initialized:
			return
		
		# 加载MCP工具（CLS日志服务 + 监控告警）
		mcp_client = await get_mcp_client_with_retry()
		mcp_tools = await mcp_client.get_tools()
		
		# 合并所有工具
		all_tools = self.tools + mcp_tools
		
		self.agent = create_agent(
			self.model,
			tools = all_tools,
			checkpointer = self.checkpointer,
		)
		self._agent_initialized = True
```
### 执行ReAct Agent
#### 非流式调用
调用`agent.ainvoke`，等待Agent完成全部推理和工具调用后一次性返回结果
```python
async def query(self, question: str,session_id: str) -> str:
	await self._initialized_agent()
	
	messages = [
		SystemMessage(content = self.system_prompt),
		HumanMessage(content = question)
	]
	
	result = await self.agent.ainvoke(
		input = {"messages":messages},
		config = {"configurable":{"thread_id":session_id}},
	)
	# 取最后一条消息为最终答案
	last_message = result["messages"][-1]
	return last_message.content
```
#### 流式调用
调用`agent.astream`，使用`stream_mode="messages"`逐token输出，配合F啊身体API的SSE接口实时推送给前端：
```python
async def query_stream(self,question:str, session_id:str) -> AsyncGenerator:
	await self._initialized_agent()
	
	messages = [
		SystemMessage(content = self.system_prompt),
		HumanMessage(content = question)
	]
	
	async for token,metadata in self.agent.astream(
		input = {"messages":messages},
		config = {"configurable":{"thread_id":session_id}},
		stream_mode = "messages",
	):
		if type(token).__name__ in ("AIMessage","AIMessageChunk"):
			content_blocks = getattr(token, 'content_blocks', None)
			if content_blocks:
				for block in content_blocks:
					if isinstance(block,dict) and block.get('type') == 'text':
						text = block.get('text','')
						if text:
							yield {"type":"content", "data":text}
	yield {"type":"complete"}
```
#### SSE接口层
`chat_stream`接口将`query_stream`产生的事件包装成SSE格式推送给客户端，不同类型的时间对应不同的前端展示逻辑：
```python
@router.post("/chat_stream")
async def chat_stream(request:CHatRequest):
	async def event_generator():
		async for chunk in rag_agent_service.query_stream(request.question,session_id = request.id):
			chunk_type = chunk.get("type")
			
			if chunk_type == "content":
			# 逐token文本内容
				yield {
					"event":"message",
					"data":json.dumps({"type":"content","data": chunk["data"]},ensure_ascii=False)
				}
			elif chunk_type == "tool_call":
				# 工具调用状态（前端可展示“正在搜索知识库···”等提示）
				yield {
					"event": "message",
					"data": json.dumps({"type":"tool_call","data": chunk["data"]},ensure_ascii = False)
				}
			elif chunk_type == "complete":
				# 完成信号
				yield {
					"event": "message",
					"data": json.dumps({"type":"done","data":chunk.get("data")},ensure_ascii = False)
				}
			elif chunk_type == "error":
				yield {
					"event": "message",
					"data": json.dumps({"type":"error","data":str(chunk["data"])},ensure_ascii=Flase)
				}
	return EventSourceResponse(event_generator())
```
curl调用示例：
```shell
# 非流式对话
curl -X POST http://localhost:8000/api/chat \
	-H "Content-Type: application/json" \
	-d '{"id": "session-001", "question": "CPU使用率过高怎么排查？"}'
	
# 流式对话(SSE)
curl - X POST http://localhost:8000/api/chat_stream \
	-H "Content-Type: application/json" \
	-d '{"id": "session-001", "question": "CPU使用率过高怎么排查？"}'
```

## 源码分析：API接口与Agent的整合
### 对话接口的定义
#### 快速对话接口
与大模型对话，相同id的计划带有上下文记忆功能
请求方法：`POST /api/chat`
请求字段：

| 字段名      | 类型     | 描述      |
| -------- | ------ | ------- |
| id       | string | 对话的唯一标识 |
| Question | string | 用户提问    |
响应字段：

| 字段名    | 类型     | 描述   |
| ------ | ------ | ---- |
| Answer | string | 系统回答 |
```shell
# 示例：快速对话
curl -X POST http://localhost:6872/api/chat \
	-H "Content-Type: application/json" \
	-d '{
		"Id": "session-001",
		"Question": "什么是人工智能？"
	}'
# 响应
{
	"message": "OK",
	"data": {
		"answer": "AI 的回答内容···"
	}
}	
```
#### 流式对话接口
与大模型对话，相同的id的对话有上下文记忆功能，通过SE实现流式输出回答
请求方法：`POST /api/chat_stream`
请求字段：

| 字段名      | 类型     | 描述      |
| -------- | ------ | ------- |
| id       | string | 对话的唯一标识 |
| Question | string | 用户提问    |
响应字段：

| 字段名 | 类型  | 描述  |
| --- | --- | --- |
|     |     |     |
SSE响应格式：

| event类型   | 含义            |
| --------- | ------------- |
| connected | 代表连接建立成功      |
| message   | 回复的文本片段，会多次发送 |
| error     | 连接异常，断开连接     |
| done      | 消息推送完毕，断开连接   |
示例：
```shell
# 示例：流式对话
curl -X POST http://localhost:6872/api/chat \
	-H "Content-Type: application/json" \
	-d '{
		"Id": "session-001",
		"Question": "什么是人工智能？"
	}'
	
# 响应
id: <timestamp>
event: connected
data: {"status": "connected", "client_id": "session-001"}

id: <timestamp>
event: message
data: 人工智能（AI）

id: <timestamp>
event: message
data: 的发展历史

id: <timestamp>
event: message
data: 可以追溯到···

id: <timestamp>
event: message
data: Stream completed
```
### 快速对话接口的核心实现- Python
代码路径：app/api/chat.py 和 app/services/rag_agent_service.py
1. 接受请求，取出id(session_id)和question
2. 调用rag_agent_service.query执行Agent推理，thread_id即session_id
3. LangGraph MemorySaver 自动完成历史消息的读取与写入，无需手动管理
4. 返回答案
```python
@router.post("/chat")
async def chat(request: ChatRequest):
	logger.info(f"[会话{request.id}] 收到快速对话请求：{request.question}")
	
	# 直接调用Agent，thread_id决定会话隔离，历史消息由MemorySaver自动维护
	answer = await rag_agent_sercive.query(
		request.question,
		session_id = request.id
	)
	return {
		"code": 200,
		"message": "success",
		"data": {
			"success": True,
			"answer": answer,
			"errorMessage": None
		}
	}
```
query方法内部将系统提示+用户问题包装成消息列表，通过agent.ainvoke执行完整的ReAct推理链，并从最后一条消息中取出答案。thread_id与MemorySaver配合，让相同id的请求自动携带历史上下文：
```python
async def query(self, question:str, session_id: str) -> str:
	await self.initialized_agent()
	
	messages = [
		SystemMessage(content = self.system_prompt),
		HumanMessage(content = question)
	]
	
	# thread_id 相同则自动读取MemorySaver中的历史消息
	result = await self.agent.ainvoke(
		input = {"messages": messages},
		config = {"configurable": {"thread_id": session_id}},
	)
	
	# 取最后一条消息作为最终答案
	last_message = result["message"][-1]
	return last_message.content
```
会话历史的消息裁剪由`trim_messages_middleware`节点负责，策略是保留第一条系统消息+最近6条消息（约3轮对话），防止多轮对话超出大模型的上下文窗口：
```python
def trim_messages_middleware(state: AgentState):
	messages = state["messages"]
	if len(messages) <= 7:
		return None # 消息较少 无需裁剪
		
	first_msg = messages[0] # 保留系统消息
	recent_messages = messages[-6:] if len(messages) % 2 ==0 else messages[-7:]
	
	return {
		"messages":[
			RemoveMessage(id = REMOVE_ALL_MESSAGES), # 清空所有旧消息
			*([first_msg] + list(recent_messages)) # 写入保留的消息
		]
	}
```

### 流式对话接口的核心实现-Python
SSE返回的消息event类型：

| event类型                   | 含义            |
| ------------------------- | ------------- |
| message(type = content)   | 回复的文本片段，会多次发送 |
| message(type = tool_call) | 工具调用状态通知      |
| message(type = done)      | 消息推送完毕        |
| message(type = error)     | 发生异常          |
1. 流式对话的核心是SSE，FastAPI通过`EventSourceResponse`实现，无需手动设置HTTP头
2. Agent使用`agent.astream`的`stream_mode = "messages"`模式，逐token产生输出
3. 每次从流中读到文本内容，就通过SSE发送给客户端
```python
@router.post("/chat_stream")
async def chat_stream(request: ChatRequest):
	async def event_generator():
		async for chunk in rag_agent_service.query_stream(
			request.question, session_id = request.id
		):
			chunk_type = chunk.get("type")
			
			if chunk_type == "content":
			# 逐token文本片段 实时推送
				yield {
					"event": "message",
					"data": json.dumps({"type": "content", "data": chunk["data"]},ensure_ascii = False)
				}
			elif chunk_type == "tool_call":
				#工具调用状态（前端可展示“正在检索知识库··”等提示）
				yield {
					"event": "message",
					"data": json.dumps({"type": "type_call", "data": chunk.get("data")},ensure_ascii = False)
				}
			elif chunk_type == "complete":
				yield {
					"event": "message",
					"data": json.dumps({"type": "done", "data": None},ensure_ascii = False)
				}
			elif chunk_type == "error":
				yield {
					"event": "message",
					"data": json.dumps({"type": "error", "data": str(chunk.get("data"))},ensure_ascii = False)
				}
	# EventSourceResponse自动处理SSE协议头和连接管理
	return EventSourceResponse(event_generator())
```
`query_stream`方法使用`agent.astream`的`stream_mode = "messages"`模式，每个token触发一次回调，从`content_blocks`中提取文本块后yield给上层：
```python
async def query_stream(self, question:str ,session_id: str) -> AsyncGenerator:
	await self._initialized_agent()
	
	messages = [
		SystemMessage(content = self.system_prompt),
		HumanMessage(content = question)
	]
	
	async for token,metadata in self.agent.astream(
		input = {"messages":messages},
		config = {"configurable":{"thread_id":session_id}},
		stream_mode = "messages", # 逐token输出模式
	):
		if type(token).__name__ in ("AIMessage","AIMessageChunk"):
			content_blocks = getattr(token, 'content_blocks',None)
			if content_blocks:
				for block in content_blocks:
					if isinstance(block,dict) and block.get('type')
						text = block.get('text','')
						if text:
							yield {"type": "content","data": text}
							
	yield {"type":"complete"}						
```
# 运维Agent
## 前置准备：运维的需求 场景 价值分析
### 为什么需要Agent
1. 有经验的工程师熟悉的情况，新人完全不了解
2. 80%的告警都是“老面孔”，但是仍需要重复查明
3. 各个系统是割裂的，排查需要来回切换

**运维Agent怎么解决这种问题？**
Agent可以通过调用各个平台的API，实现跨系统联动。当一条告警进来，Agent可以
1. 从告警信息中自动提取关键信息（服务名，接口名，时间范围）
2. 用这些信息调取日志平台的API，拉取相关日志
3. 同时调监控平台的API，拉回对应时间段的指标数据
4. 所有信息汇总在一起，生成结构化的排查报告
### 运维Agent的目标是什么
1. 降低告警响应时间
2. 减少人工介入频率
3. 标准化排查流程
4. 沉淀和传承团队经验

### 运维Agent有哪些核心能力
#### 实时告警响应与自动排查
场景：告警显示“订单服务接口失败率突增25%”
Agent操作：
1. 自动调用API，查询最近1小时包含错误关键词的日志
2. 发现90%的错误日志都是`context canceled`（上下文取消，通常意味着请求超时被主动中断）
3. 调用监控API，拉取下游支付服务的响应时间曲线
4. 发现下游支付服务的P99响应时间(99%的请求都在这个时间内完成) 从200ms飙升到3s
5. 匹配知识库，找到规则：“下游响应时间异常导致context canceled -> 联系下游团队确认是否在发布”
#### 智能匹配根因
工程师内部会维护一个 错误码 / 错误特征 的知识库

| 错误特征                | 可能的根因          | 建议操作             |
| ------------------- | -------------- | ---------------- |
| context canceled占比高 | 下游服务响应慢，导致请求超时 | 查看下游服务状况，联系对应团队  |
| connection refused  | 目标服务实例挂了或端口不同  | 检查目标服务是否正常运行     |
| 数据库连接池耗尽            | 慢查询过多或连接泄漏     | 查看慢查询日志，检查连接释放逻辑 |
Agent查完日志，拿到错误特征，在这个知识库中找匹配项，然后给出对应的处理建议。
Agent不会遗漏某个步骤
#### 经验沉淀的自动化闭环
处理告警 -> 总结本次排查过程 -> 更新知识库 -> 类似问题直接复用
## Plan-Execute-Replan架构设计
### 什么是Plan-Execute-Replan
Plan-Execute-Replan是一种Multi-Agent（多智能体）协作的任务执行模式，核心思路是：先规划、再执行、随时调整
### 三个核心组件
Planner(规划器)：整个模式的起点，接受用户的目标，生成一份结构化的执行计划
```shell
# 什么是结构化
1. 步骤1：调用日志工具，查询xxx日志
2. 步骤2：调用监控工具，获取进程占用排行
3. 步骤3：调用历史工单，检索该过程过往的异常处理方案
```
关键能力：理解复杂目标的内在逻辑，把大任务拆成可执行的小步骤，并安排好合理的执行顺序

Executor(执行器)：按照计划进行相应的操作，Executor只专注做好当前这一步，不操心全局。
关键能力：准确调用工具，处理工具返回的结果

RePlanner(重规划器)：每次Executor完成这一步之后，Replanner都会介入
1. 步骤完成，结果有效 -> 继续推进
2. 结果不符合预期 -> 调整计划
3. 所有步骤完成 -> 终止任务，输出结论
关键能力：评估执行结果、判断任务进度、识别问题并动态优化计划

### 工作流程：从目标到结果的完整闭环
场景：凌晨CPU100%告警
Round1: Planner，制定初始计划
	调用相关工具，查看日志等。
	先看日志有没有直接线索 -> 再看监控定位具体进程 -> 最后查历史方案
Round2: Exeutor执行步骤1 -- 查日志
	返回结果：日志中未发现error/warn记录，只有大量info级别的定时任务执行成功日志
	没有查到有用信息
Round3: Replanner介入评估，调整计划
	分析结果：日志无异常，大概率不是应用报错导致；有可能是某个进程在吃CPU，优先看监控数据，定位异常进程。
```shell
步骤1(已完成)：查日志 -> 无异常
步骤2(更新)： 调用监控工具，获取某时段进程占用排行 <- 优先执行这个
步骤3(更新)： 针对步骤2定位的异常进程，查其详细日志
步骤4： 调用历史工单，检索处理方案
```
Round4: Executor 执行更新后的步骤2 -- 查监控
	调用监控工具，查询CPU突增时段的进程排行
	返回结果：xx - xx时段，进程`data-service`CPU占用率高达95%
Round5: Replanner再次评估
	已经定位到了异常进程，接下来要查这个进程的详细日志，继续执行步骤3
Round6: Executor 执行步骤3 -- 查进程日志
	Executor调用日志工具，进程名`data-service`，时间范围 = 近1小时
	返回结果：日志显示xx时间触发了什么任务
Round7: Replanner最终评估 -- 任务结束
	根因已经明确了，执行了xx任务。最终输出故障根因 与 建议方案
### 与ReAct模式的区别
Reasoning + Acting ：边想边做。没有预先的完整计划 每一步都是临场决策
Plan-Execute-Replan：按导航开车，遇到阻碍，重新规划

| 对比维度    | Plan-Execute-Replan     | ReAct              |
| ------- | ----------------------- | ------------------ |
| 核心思路    | 先拆步骤，按计划执行，动态调整         | 边想边做，每步临场决策        |
| 有没有全局计划 | 有，一开始就生成完整计划            | 无，走一步看一步           |
| 适合什么场景  | 多步骤、流程化的复杂任务（运维排查、报告生成） | 灵活探索类任务（开放问答、信息检索） |
| 任务进度    | 可追踪，知道执行到第几步了           | 不太好追踪，因为没有预设步骤     |
| 应对变化    | 通过Replan机制调整计划          | 天然灵活，每步都能变方向       |
| Agent数量 | Multi-Agent协作           | 单Agent完成所有事        |
Plan-Execute-Replan的场景：
	任务复杂，步骤多，需要有条理的推进
ReAct的场景：
	任务比较灵活，事先不确定具体流程，探索性强
### 核心优势
优势一：结构化拆解，把复杂问题变简单
优势二：动态适应，遇到问题懂得变通
优势三：职责分离，各司其职更高效
优势四：任务进度可观测
## 运维Agent的架构设计
计划生成 -> 工具执行 -> 动态调整
### 核心流程拆解
#### Planner：将经验转化为结构化步骤
目标：基于告警类型和召回的运维手册，生成可执行的多步骤排查计划，替代人工凭借经验梳理流程的过程。
核心逻辑：
	输入：告警信息(alertname , description)+ 召回的处理文档
	输出：结构化计划，包含步骤描述、工具调用参数、预期结果
```json
{
	"goal": "排查接口失败率过高的问题",
	"steps": [
		{
			"step_id": "1",
			"action": "query_log",
			"description": "根据接口名和'response'关键词搜索最近1小时日志",
			"parameters":{"service":"ad_app", "keyword":"response error","time_range": "1h"},
			"expected_result":"返回包含error信息的日志片段"
		},
		{
			"step_id": "2",
			"action": "analyze_error",
			"description": "解析日志中的error类型，判断是否为'context cancel'",
			"parameters": {"log_content":"{{step1_result}}"},
			"expected_result": "明确错误原因（如超时/下游异常）"
		}
	]
}
```
#### Executor：调用工具完成单步排查
目标：通过集成监控/日志工具，自动执行计划中的步骤，替代人工 查日志/查监控的操作
核心工具示例：
1. 告警查询工具(`query_prometheus_alerts`)：从Prometheus API获取当前活跃告警详情
2. 日志查询工具(`query_log`)：通过腾讯云CLS的MCP服务，用自然语言查询日志（如 搜索ad_app最近1小时的response error日志）
#### Replanner：评估进度并调整策略
目标：根据Executor的执行结果，判断是否需要调整计划（如增加步骤、终止排查），替代人工 持续关注/判断是否需要进一步处理的决策过程
评估逻辑：
- 成功条件：当前步骤符合预期，执行下一步
- 调整条件：结果不符合预期，触发计划修正
- 终止条件：达到目标 或 无法继续（需要人工介入）
## 运维Agent代码实现 - Python
关键代码放在：app/agent/aiops目录下的state.py 、 planner.py、executor.py、replanner.py，以及app/services/aiops_service.py
### 流程梳理
1. Planner：拆解排查步骤，生成执行计划
2. Executor：从计划中取出第一个步骤，调用工具执行
3. Replanner：评估执行结果，决定继续、调整计划还是生成最终报告
三个节点通过LangGraph StateGraph串联，共享同一份PlanExecuteState状态对象在整个流程中传递。
![[运维Agent工作流程.png]]
### 代码实战
#### 状态定义
整个Plan-Execute-Replan流程的数据通过PlanExecuteState承载，字段设计很简洁
```python
class PlanExecuteState(TypeDict):
	input: str # 用户输入的任务描述
	plan:List[str] # 代执行的步骤列表
	past_steps:Annotated[List[tuple],operator.add] # 已执行的步骤历史(追加式更新)
	response: str # 最终报告/响应
````
`past_steps`使用`Annotated[List[tuple],operator.add]`声明，LangGraph会将每次节点返回的`past_steps`自动追加到列表中，而不是覆盖，无需手动维护历史。
#### Planner节点
Planner负责制定执行计划，输出一个结构化的步骤列表。核心流程：
1. 先调用`retrieve_knowledge`查询知识库，寻找历史经验文档
2. 获取所有可用工具（本地工具 + MCP工具），格式化为文字描述
3. 将工具列表和经验文档注入prompt，调用LLM生成结构化计划
```python
async def planner(state:PlanExecuteState) -> Dict[str,Any]:
	input_text = state.get("input","")
	
	# 1. 查询内部知识库，寻找相关经验
	context_str = await retrieve_knowledge.ainvoke({"query":input_text})
	experience_docs = context_str if context_str and context_strip() else ""
	
	# 2. 获取所有可用工具（本地 + MCP）
	local_tools = [get_current_time,retrieve_knowledge]
	mcp_tools = await (await get_mcp_client_with_retry()).get_tools()
	all_tools = local_tools + mcp_tools
	
	# 3. 调用LLM生成结构化计划
	llm = ChatQwen(model = config.rag_model,api_key = config.dashscope_api_key,temperature = 0)
	planner_chain = planner_prompt | llm.with_structured_output(Plan)
	
	plan_result = await planner_chain.ainvoke({
		"messages": [("user", input_text)],
		"tools_description": format_tools_description(all_tools),
		"experience_context": experience_docs
	})
	
	return {"plan": plan_results.steps}
```
计划的输出格式用Pydantic Plan模型约束，通过`llm.with_structured_output(Plan)`保证LLM的输出可以直接解析为步骤列表：
```python
class Plan(BaseModel):
	steps: List[str] = Field(
		description = "完成任务所需的不同步骤，按顺序执行，每一步建立在前一步的基础上"
	)
```
#### Planner Prompt
Planner的系统提示词要求模型将任务分解为逻辑独立的步骤，每步指明使用哪个工具及所需参数。如果查到了经验文档，也会作为参考注入：
```python
planner_prompt = ChatPromptTemplate.from_messages([
	("system","""
		作为一个专家级别的规划者，你需要将复杂的任务分解为可执行的步骤。
		可用工具列表（用于制定计划时参考）：{tools_description}
		
		注意：你的职责是制定计划，实际的工具调用由Executor负责执行
		{experience_context}
		
		对于给定的任务，创建一个简单的、逐步的计划：
		- 将任务分解为逻辑上独立的步骤
		- 每个步骤明确使用哪些工具，最好能同时提供工具所需参数
		- 步骤之间应有清晰的依赖关系
		- 如果有相关经验文档，请参考其中的方法和步骤制定计划
	"""),
	("placeholder","{messages}"),
])
```
#### Executor节点
Executor每次执行计划的第一个步骤，使用LangGraph的ToolNode自动处理工具调用，执行完后将该步骤从plan中移除，并将执行结果追加到past_steps:
```python
async def executor(state: PlanExecuteState) -> Dict[str, Any]:
	plan = state.get("plan",[])
	task = plan[0] # 只取第一个步骤
	
	# 绑定工具的LLM
	all_tools = local_tools + mcp_tools
	llm_with_tools = llm.bind_tools(all_tools)
	tool_node = ToolNode(all_tools)

	messages = [
		SystemMessage(content = "你是一个能力强大的助手，负责执行具体的任务步骤···"),
			HumanMessage(content = f"请执行以下任务：{task}")
	]
	
	# 第一步：LLM决定是否需要工具调用
	llm_response = await llm_with_tools.ainvoke(messages)
	
	# 第二步：如果有工具调用，使用ToolNode自动执行
	if hasattr(llm_response, "tool_calls") and llm_response.tool_calls:
		messages.append(llm_response)
		tool_messages = await tool_node.ainvoke({"messages":messages})
		messages.extend(tool_messages["messages"])
		# 第三步：将工具结果返回给LLM生成最终答案
		final_response = await llm_with_tools.ainvoke(messages)
		result = final_response.content
	else:
		result = llm_response.content
		
	return {
		"plan": plan[1:], # 移除执行的第一个步骤
		"past_steps": [(task,result)], # 追加执行历史
	}
```
#### Replanner节点
Replanner根据原始任务、已执行步骤和剩余计划做出三选一的决策：

| 决策       | 含义            | 触发条件                |
| -------- | ------------- | ------------------- |
| respond  | 信息充足，立即生成最终报告 | 最高优先级，已执行>=3步且有关键信息 |
| continue | 当前计划合理，继续执行   | 剩余步骤确实必要            |
| replan   | 调整计划，替换剩余步骤   | 最低优先级，计划有重大偏差才使用    |
决策同样用Pydantic模型约束输出：
```python
class Act(BaseModel):
	action:str = Field(description = "下一步行动：'continue' | 'replan' | 'respond'")
	new_steps: List[str] = Field(default_factory=list,description = "replan时的新步骤列表")
```
Replanner核心逻辑（含安全限制）：
```python
async def replanner(state: PlanExecuteState) -> Dict[str,Any]:
	past_steps = state.get("past_steps",[])
	plan = state.get("plan",[])
	
	# 安全限制：已执行步骤超过8步，强制生成响应，防止无限循环
	if len(past_steps) >= 8:
		return await _generate_response(state,llm)
		
	if plan:
		#还有剩余步骤 让LLM做决策
		act = await replanner_chain.ainvoke({
			"messages":[
				("user",f"原始任务：{input_text}"),
			]
		})
```