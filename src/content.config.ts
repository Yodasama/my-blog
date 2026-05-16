import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: z.preprocess(
		(data) => {
			if (!data || typeof data !== 'object' || Array.isArray(data)) {
				return data;
			}

			const frontmatter = data as Record<string, unknown>;
			return {
				...frontmatter,
				date: frontmatter.date ?? frontmatter.Date,
			};
		},
		z.object({
			title: z.string(),
			date: z.coerce.date(),
			summary: z.string().default(''),
			tags: z.array(z.string()).default([]),
			toc: z.boolean().default(false),
			draft: z.boolean().default(false),
		}),
	),
});

export const collections = { blog };
