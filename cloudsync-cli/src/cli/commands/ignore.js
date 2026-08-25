/**
 * ignore.js - Smart .cloudsyncignore Scaffolding for CloudSync-CLI
 * 
 * Generates and manages curated ignore rules preventing accidental upload
 * of sensitive credentials, build artifacts, and heavy dependencies.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEMPLATES = {
  node: `# Node.js & Web Frameworks
node_modules/
dist/
build/
.next/
.nuxt/
.turbo/
.cache/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.env
.env.local
.env.*.local
coverage/
.nyc_output/
`,
  python: `# Python & Data Science
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
.env
.venv
env/
venv/
ENV/
.pytest_cache/
`,
  go: `# Go / Golang
bin/
pkg/
vendor/
*.exe
*.exe~
*.dll
*.so
*.dylib
*.test
*.out
.env
`,
  docker: `# Docker & Containerization
.env
.env.*
*.log
docker-compose.override.yml
.dockerignore
`,
  general: `# General & System Files
.git/
.svn/
.DS_Store
Thumbs.db
*.swp
*~
*.tmp
.idea/
.vscode/
*.log
.env
`
};

const ignoreCommand = new Command('ignore')
  .description('🛡️ Generate or manage .cloudsyncignore rules for version control')
  .option('-t, --template <type>', 'Preset template: node|python|go|docker|general', 'node')
  .option('-s, --show', 'Display current .cloudsyncignore rules', false)
  .option('-a, --append', 'Append template to existing .cloudsyncignore', false)
  .option('-f, --force', 'Overwrite existing .cloudsyncignore file', false)
  .action((options) => {
    const ignorePath = join(process.cwd(), '.cloudsyncignore');

    // Show current rules
    if (options.show) {
      if (!existsSync(ignorePath)) {
        console.log(chalk.yellow('⚠️ No .cloudsyncignore file found in current workspace.'));
        console.log(chalk.gray('   Run `cloudsync ignore` to generate one.'));
        return;
      }
      console.log(chalk.cyan('\n🛡️ Current .cloudsyncignore Rules:'));
      console.log(chalk.gray('━'.repeat(60)));
      console.log(readFileSync(ignorePath, 'utf8'));
      console.log(chalk.gray('━'.repeat(60)));
      return;
    }

    const templateKey = (options.template || 'node').toLowerCase();
    const templateContent = TEMPLATES[templateKey] || TEMPLATES.general;

    if (existsSync(ignorePath) && !options.force && !options.append) {
      console.log(chalk.yellow('⚠️ .cloudsyncignore already exists in this directory.'));
      console.log(chalk.gray('   Use --force to overwrite, or --append to add rules.'));
      return;
    }

    let finalContent = templateContent;
    if (options.append && existsSync(ignorePath)) {
      const existing = readFileSync(ignorePath, 'utf8');
      finalContent = `${existing.trim()}\n\n${templateContent}`;
    }

    writeFileSync(ignorePath, finalContent, 'utf8');

    console.log(chalk.cyan('\n🛡️ CloudSync Ignore Generator'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.white(`   Template:  ${chalk.cyan(templateKey)}`));
    console.log(chalk.white(`   Location:  ${chalk.cyan(ignorePath)}`));
    console.log(chalk.green(`\n✅ .cloudsyncignore generated successfully!`));
    console.log(chalk.gray('━'.repeat(60)));
  });

export default ignoreCommand;
