import { existsSync, readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const projectsPage = readFileSync('src/pages/projects.astro', 'utf8');
const detailPagePath = 'src/pages/projects/oncallagent.astro';
const projectDataPath = 'src/data/projects.ts';

assert.match(
	projectsPage,
	/body class="projects-page"/,
	'Projects page should use the same two-column shell style as Articles.',
);
assert.match(
	projectsPage,
	/projects-panel/,
	'Projects page should render an Articles-like cards panel.',
);
assert.match(
	projectsPage,
	/project-card/,
	'Projects page should render project cards.',
);
assert.match(
	projectsPage,
	/focusCategories/,
	'Projects page should keep the left sidebar focus filters.',
);
assert.ok(!projectsPage.includes('ProjectShell'), 'Projects page should not use the previous three-column ProjectShell.');

assert.match(
	readFileSync(projectDataPath, 'utf8'),
	/href:\s*'\/projects\/oncallagent\/'/,
	'Projects page should link the OnCallAgent card to the detail page.',
);
assert.match(
	readFileSync(projectDataPath, 'utf8'),
	/name:\s*'OnCallAgent'/,
	'Projects page should include OnCallAgent as a project.',
);
assert.ok(existsSync(detailPagePath), 'OnCallAgent detail page should exist.');

const detailPage = readFileSync(detailPagePath, 'utf8');

for (const text of ['OnCallAgent', '项目功能', '项目链接', '页面展示']) {
	assert.ok(detailPage.includes(text), `Detail page should include the "${text}" section.`);
}

assert.match(detailPage, /tech-sidebar/, 'Project detail page should place the tech stack in the left sidebar.');
assert.match(detailPage, /project-detail-main/, 'Project detail page should place project content in the right main area.');
assert.match(detailPage, /tech-cloud/, 'Project detail page should use a stronger tech-stack presentation.');
assert.ok(!detailPage.includes("type: 'demo'"), 'Detail page should filter project links instead of rendering every link.');
assert.ok(!detailPage.includes('showcase-grid'), 'Detail page should stack showcase images vertically.');
assert.ok(!detailPage.includes('tocItems'), 'Project detail page should not use the old sticky TOC structure.');
assert.ok(!detailPage.includes('Overview'), 'Project detail page should not use the old case-study section structure.');

for (const image of ['对话助手页面.png', '快速模式回复.png', '运维自动规划功能.png']) {
	assert.ok(detailPage.includes(image), `Detail page should include showcase image ${image}.`);
}
