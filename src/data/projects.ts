export type ProjectCategory =
	| 'AI / Agent'
	| 'Security'
	| 'Research'
	| 'Web Development'
	| 'Tools';

export type ProjectLink = {
	label: string;
	href: string;
	type: 'github' | 'demo' | 'log';
};

export type Project = {
	name: string;
	slug: string;
	summary: string;
	description: string;
	href: string;
	status: 'Active' | 'Live' | 'Growing' | 'Research';
	categories: ProjectCategory[];
	tags: string[];
	featured?: boolean;
	updated: string;
	links: ProjectLink[];
	metrics?: { label: string; value: string }[];
};

export const projectCategories: ProjectCategory[] = [
	'AI / Agent',
	'Security',
	'Research',
	'Web Development',
	'Tools',
];

export const projects: Project[] = [
	{
		name: 'OnCallAgent',
		slug: 'oncallagent',
		summary: 'RAG + AIOps agent for operations diagnosis.',
		description:
			'基于 FastAPI、LangGraph、Milvus 和 MCP 的智能运维助手，支持 RAG 问答、流式对话和 AIOps 自动诊断。',
		href: '/projects/oncallagent/',
		status: 'Active',
		categories: ['AI / Agent', 'Tools'],
		tags: ['FastAPI', 'LangGraph', 'LangChain', 'Milvus', 'MCP', 'Qwen'],
		featured: true,
		updated: '2026-05-19',
		links: [
			{ label: 'GitHub', href: 'https://github.com/Yodasama/OnCallAgent', type: 'github' },
			{ label: 'Demo', href: '/projects/oncallagent/', type: 'demo' },
			{ label: 'Build Log', href: '/blog/oncallagent-build/', type: 'log' },
		],
		metrics: [
			{ label: 'Core APIs', value: '5' },
			{ label: 'Agent Modes', value: '3' },
			{ label: 'Tool Layer', value: 'MCP' },
		],
	},
	{
		name: 'Research Notes',
		slug: 'research-notes',
		summary: 'Paper notes and engineering writeups.',
		description: '整理论文阅读、实验记录和工程复盘的知识库。',
		href: '/blog',
		status: 'Growing',
		categories: ['Research', 'Security'],
		tags: ['Research', 'Security', 'Notes'],
		updated: '2026-05-11',
		links: [{ label: 'Open Notes', href: '/blog', type: 'demo' }],
	},
	{
		name: 'Blog System',
		slug: 'blog-system',
		summary: 'Astro-powered technical writing space.',
		description: '基于 Astro、GitHub 与 Cloudflare Pages 的个人博客。',
		href: '/',
		status: 'Live',
		categories: ['Web Development', 'Tools'],
		tags: ['Astro', 'Cloudflare Pages', 'Frontend'],
		updated: '2026-05-19',
		links: [
			{ label: 'GitHub', href: 'https://github.com/Yodasama/my-blog', type: 'github' },
			{ label: 'Live Site', href: '/', type: 'demo' },
		],
	},
	{
		name: 'Security Learning Lab',
		slug: 'security-learning-lab',
		summary: 'Security notes, tools, and protocol experiments.',
		description: '围绕安全工具、网络协议和系统安全学习记录整理的实验集合。',
		href: '/blog?focus=security',
		status: 'Research',
		categories: ['Security', 'Research'],
		tags: ['Security', 'Network', 'Systems'],
		updated: '2026-05-10',
		links: [{ label: 'Read Notes', href: '/blog?focus=security', type: 'log' }],
	},
];

export const featuredProjects = projects.filter((project) => project.featured);

export const recentUpdates = projects
	.slice()
	.sort((a, b) => b.updated.localeCompare(a.updated))
	.slice(0, 4)
	.map((project) => ({
		name: project.name,
		date: project.updated,
		href: project.href,
	}));

export const techSummary = ['Astro', 'FastAPI', 'LangGraph', 'Milvus', 'MCP', 'Cloudflare'];
