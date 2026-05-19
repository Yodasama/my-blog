import { existsSync, readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const projectsPage = readFileSync('src/pages/projects.astro', 'utf8');
const detailPagePath = 'src/pages/projects/oncallagent.astro';
const projectDataPath = 'src/data/projects.ts';
const shellPath = 'src/components/projects/ProjectShell.astro';
const cardPath = 'src/components/projects/ProjectCard.astro';
const stylesPath = 'src/styles/project-system.css';

assert.match(
	projectsPage,
	/ProjectShell/,
	'Projects page should use the shared ProjectShell component.',
);
assert.match(
	projectsPage,
	/Featured Projects/,
	'Projects page should include a Featured Projects section.',
);
assert.match(
	projectsPage,
	/All Projects/,
	'Projects page should include an All Projects section.',
);
assert.match(
	projectsPage,
	/projectCategories/,
	'Projects page should expose project categories for filtering.',
);
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
assert.ok(existsSync(shellPath), 'Projects should use a reusable shell component.');
assert.ok(existsSync(cardPath), 'Projects should use a reusable card component.');
assert.ok(existsSync(stylesPath), 'Projects should use a shared design-system stylesheet.');

const detailPage = readFileSync(detailPagePath, 'utf8');

for (const text of [
	'Overview',
	'Motivation',
	'Tech Stack',
	'Architecture',
	'Core Features',
	'Development Process',
	'Challenges & Solutions',
	'Lessons Learned',
	'Related Notes',
	'GitHub / Demo Links',
]) {
	assert.ok(detailPage.includes(text), `Detail page should include the "${text}" section.`);
}

assert.match(detailPage, /tocItems/, 'Detail page should define sticky table-of-contents items.');
assert.match(detailPage, /<details/, 'Detail page should include collapsible technical sections.');
assert.match(detailPage, /<pre/, 'Detail page should include code snippets.');
assert.match(stylesPath && readFileSync(stylesPath, 'utf8'), /prefers-reduced-motion/, 'Project styles should respect reduced motion.');
assert.match(readFileSync(stylesPath, 'utf8'), /backdrop-filter/, 'Project cards should support a soft glass surface.');
