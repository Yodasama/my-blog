import { existsSync, readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const notePath = 'src/content/blog/OnCallAgent-Notes.md';
const note = readFileSync(notePath, 'utf8');
const imageRefs = [...note.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)].map((match) => match[1]);

assert.ok(imageRefs.length > 0, 'OnCallAgent notes should contain image references.');

for (const imageRef of imageRefs) {
	assert.ok(
		imageRef.startsWith('/images/posts/OnCallAgent-Notes/'),
		`Image reference should use the public OnCallAgent notes path: ${imageRef}`,
	);
	assert.match(imageRef, /\.(png|jpe?g|webp|gif|svg)$/i, `Image reference should include an extension: ${imageRef}`);
	assert.ok(existsSync(`public${imageRef}`), `Image reference should resolve to a public file: ${imageRef}`);
	assert.ok(!imageRef.endsWith('.png.png'), `Image reference should not use duplicate extensions: ${imageRef}`);
}
