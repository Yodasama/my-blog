# OnCallAgent Project Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an OnCallAgent project card and a linear project detail page.

**Architecture:** Keep the current Astro static page approach. Modify `src/pages/projects.astro` for the card, create `src/pages/projects/oncallagent.astro` for the detail page, and validate with a file-level smoke test plus `astro build`.

**Tech Stack:** Astro, scoped component styles, static assets from `public/images/posts/OnCallAgent-Build/`.

---

### Task 1: Lock Expected Behavior

**Files:**
- Create: `tests/oncallagent-project-pages.test.mjs`

- [x] **Step 1: Write the failing smoke test**

The test checks that `src/pages/projects.astro` links to `/projects/oncallagent/`, that the detail page exists, that it includes the three approved sections, and that key screenshots are referenced.

- [x] **Step 2: Run the test to verify it fails**

Run: `node tests/oncallagent-project-pages.test.mjs`

Expected: FAIL because the Projects page does not yet link to the new detail page.

### Task 2: Update Projects Page

**Files:**
- Modify: `src/pages/projects.astro`

- [ ] **Step 1: Add OnCallAgent to the projects array**

Add the project as the first item with `href: '/projects/oncallagent/'`, status `Active`, categories `['agent', 'development']`, and tags `['FastAPI', 'LangGraph', 'Milvus', 'MCP']`.

- [ ] **Step 2: Remove the forced thumbnail style for the OnCallAgent card**

Render project cards so featured text-first cards can omit the icon area. Existing non-featured cards can keep the current generic icon.

- [ ] **Step 3: Add CSS for text-first featured project cards**

Add styles for a no-thumbnail featured card that uses the current project card colors, spacing, hover states, and dark mode behavior.

### Task 3: Add OnCallAgent Detail Page

**Files:**
- Create: `src/pages/projects/oncallagent.astro`

- [ ] **Step 1: Create the page shell**

Use `BaseHead`, the current profile panel, top navigation, theme toggle, and search form pattern from `src/pages/projects.astro`.

- [ ] **Step 2: Add linear content sections**

Add the hero, `实现了什么功能`, `采用了什么技术`, and `页面展示` sections.

- [ ] **Step 3: Reference existing screenshots**

Use images from `/images/posts/OnCallAgent-Build/` with descriptive alt text.

- [ ] **Step 4: Add responsive and dark mode styles**

Follow existing Projects page breakpoints and dark mode color patterns.

### Task 4: Verify

**Files:**
- Test: `tests/oncallagent-project-pages.test.mjs`

- [ ] **Step 1: Run the smoke test**

Run: `node tests/oncallagent-project-pages.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run Astro build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Open the page in the browser**

Run the local dev server and verify `/projects` and `/projects/oncallagent/` visually at desktop and mobile widths.
