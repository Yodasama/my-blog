# OnCallAgent Project Page Design

## Goal

Update the Projects area so OnCallAgent is presented as a technical project case study that matches the existing homepage style.

## Projects Page

The Projects page keeps the current two-column shell, left profile panel, top navigation, and white projects panel. OnCallAgent appears as the first project and links to `/projects/oncallagent/`.

The OnCallAgent card is text-first. It does not use an `OC` thumbnail or any other placeholder thumbnail. It shows the project name, status, short description, and technology tags.

## Detail Page

The detail page uses a linear reading structure:

1. Project title and one-sentence positioning.
2. "实现了什么功能" section, covering RAG knowledge-base Q&A, fast and streaming chat, AIOps automated diagnosis, and MCP tool integration.
3. "采用了什么技术" section, covering FastAPI, LangChain, LangGraph, Milvus, MCP, and DashScope/Qwen.
4. "页面展示" section with screenshots from `public/images/posts/OnCallAgent-Build/`.

The detail page should avoid a dense multi-column dashboard layout. It should feel like a focused project explanation page inside the existing personal site.

## Visual Rules

Use the existing Projects page visual language: restrained blue accents, white panels, subtle borders, compact rounded cards, dark mode support, and responsive layouts.
