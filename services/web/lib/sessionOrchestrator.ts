import * as fs from 'fs/promises';
import * as path from 'path';

interface CLIBinding {
  promptFile: string;
  launch: string;
  env: string;
  description: string;
}

interface StackConfig {
  commands: string[];
  port: number;
  dev: string;
}

interface PurposeOverrides {
  add_dirs?: string[];
  deps?: string[];
  notes: string;
  bin?: Record<string, string>;
}

interface FactoryPattern {
  model: string;
  stack: string;
  purpose: string;
  cliBinding: CLIBinding;
  stackConfig: StackConfig;
  purposeOverrides: PurposeOverrides;
}

interface SessionConfig {
  checklist: string[];
  launchCmd: string;
  plan: string[];
  kickoff: string;
  promptFile: string;
}

// Load pattern map from .factory directory
async function loadPatternMap(): Promise<any> {
  const patternMapPath = path.join(process.cwd(), '.factory', 'pattern-map.json');
  try {
    const content = await fs.readFile(patternMapPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load pattern map:', error);
    // Return a minimal default pattern map
    return {
      cli_binding: {
        "Gemini CLI": {
          promptFile: "GEMINI.md",
          launch: "gemini",
          env: "GEMINI_API_KEY",
          description: "Open-source AI agent"
        }
      },
      stack_bootstrap: {
        "Next.js": {
          commands: ["npx create-next-app@latest . --typescript --tailwind --app"],
          port: 3000,
          dev: "npm run dev"
        }
      },
      purpose_overrides: {
        "Modern Web App": {
          notes: "Focus on component architecture and modern tooling"
        }
      }
    };
  }
}

export async function resolvePattern(
  model: string,
  stack: string,
  purpose: string
): Promise<FactoryPattern> {
  const patternMap = await loadPatternMap();
  
  // Map display names to keys if needed
  const modelKey = model;
  const stackKey = stack;
  const purposeKey = purpose;
  
  const cliBinding = patternMap.cli_binding[modelKey] || patternMap.cli_binding["Gemini CLI"];
  const stackConfig = patternMap.stack_bootstrap[stackKey] || {
    commands: [`npm init -y`],
    port: 3000,
    dev: "npm start"
  };
  const purposeOverrides = patternMap.purpose_overrides[purposeKey] || {
    notes: "General purpose application"
  };
  
  return {
    model,
    stack,
    purpose,
    cliBinding,
    stackConfig,
    purposeOverrides
  };
}

export async function ensureAlgorithm(algorithmPath: string): Promise<void> {
  try {
    await fs.access(algorithmPath);
  } catch {
    // Copy algorithm from .factory if it doesn't exist in workspace
    const sourceAlgorithm = path.join(process.cwd(), '.factory', 'algorithm.md');
    try {
      const content = await fs.readFile(sourceAlgorithm, 'utf-8');
      await fs.mkdir(path.dirname(algorithmPath), { recursive: true });
      await fs.writeFile(algorithmPath, content, 'utf-8');
    } catch (error) {
      console.error('Failed to copy algorithm:', error);
    }
  }
}

export async function ensurePromptFile(
  cliBinding: CLIBinding,
  workdir: string,
  algorithmContent: string,
  context: { stack: string; purpose: string }
): Promise<string> {
  const promptPath = path.join(workdir, '.factory', cliBinding.promptFile);
  
  // Generate prompt content based on the CLI type
  const promptContent = `# ${cliBinding.promptFile.replace('.md', '')} Agent Configuration

## Agentic Application Factory

Follow this process: **Clarify → Plan → Retrieve → Scaffold → Implement → Test → Refine → Finalize**

### Core Principles
- **KISS**: Keep It Simple - choose the simplest solution
- **DRY**: Don't Repeat Yourself - eliminate duplication
- **YAGNI**: You Aren't Gonna Need It - don't over-engineer
- **Security**: Never hardcode secrets or API keys

## Stack: ${context.stack}

${getStackNotes(context.stack)}

## Purpose: ${context.purpose}

${getPurposeNotes(context.purpose)}

## Algorithm

${algorithmContent}

## Output Requirements

1. **Complete file contents** - no placeholders or TODOs
2. **Runnable immediately** - must work without additional setup
3. **Clear file paths** - use project-relative paths
4. **Helpful comments** - explain complex logic
5. **No fabrication** - if unsure, ask for clarification

## Environment

- CLI: ${cliBinding.launch}
- Required: ${cliBinding.env} environment variable
- Description: ${cliBinding.description}

## Session Context

You are in a DevBox sandbox environment with:
- Live preview on the right side
- Hot reload enabled
- Limited CPU/memory (be efficient)
- Network access when needed

Remember: The user is your partner. Ask questions when needed, but bias toward action and implementation.
`;

  await fs.mkdir(path.dirname(promptPath), { recursive: true });
  await fs.writeFile(promptPath, promptContent, 'utf-8');
  
  return promptPath;
}

function getStackNotes(stack: string): string {
  const notes: Record<string, string> = {
    "Next.js": `
- Use App Router (not Pages Router)
- Leverage Server Components where appropriate
- Set up proper loading.tsx and error.tsx boundaries
- Use TypeScript for type safety
- Configure Tailwind CSS for styling`,
    "Vite + React": `
- Use functional components with hooks
- Set up React Router for navigation
- Implement proper state management (Context/Zustand)
- Use TypeScript throughout
- Optimize bundle size with code splitting`,
    "Vite + Vue": `
- Use Composition API (not Options API)
- Set up Vue Router for navigation
- Implement proper reactivity with ref/reactive
- Use TypeScript for better DX
- Leverage Vue 3 features like Teleport and Suspense`,
    "SvelteKit": `
- Use file-based routing
- Implement load functions for data fetching
- Leverage Svelte stores for state management
- Use TypeScript for type safety
- Optimize with SSR/SSG where appropriate`
  };
  
  return notes[stack] || "Follow best practices for the chosen stack.";
}

function getPurposeNotes(purpose: string): string {
  const notes: Record<string, string> = {
    "Modern Web App": `
Focus on:
- Responsive design (mobile-first)
- Component-based architecture
- Client-side routing
- State management
- API integration
- Modern UX patterns`,
    "Backend API": `
Focus on:
- RESTful API design
- Proper HTTP status codes
- Request validation
- Error handling middleware
- Database integration
- Authentication/authorization`,
    "Game Dev": `
Focus on:
- Game loop optimization (60 FPS)
- Asset loading and management
- Input handling (keyboard/mouse/touch)
- Physics and collision detection
- Scene management
- Performance optimization`,
    "Traditional Web": `
Focus on:
- Server-side rendering
- Progressive enhancement
- Minimal JavaScript
- SEO optimization
- Accessibility (WCAG)
- Fast initial page load`,
    "Static Site": `
Focus on:
- Content management
- Markdown processing
- Static generation
- SEO optimization
- Fast build times
- CDN-friendly output`,
    "CLI": `
Focus on:
- Clear command structure
- Argument parsing
- Interactive prompts
- Progress indicators
- Error messages
- Help documentation`
  };
  
  return notes[purpose] || "Build according to the stated requirements.";
}

export function materializeScaffold(pattern: FactoryPattern): string[] {
  const commands: string[] = [];
  
  // Base scaffold commands from stack
  if (pattern.stackConfig.commands) {
    commands.push(...pattern.stackConfig.commands);
  }
  
  // Install additional dependencies based on purpose
  if (pattern.purposeOverrides.deps && pattern.purposeOverrides.deps.length > 0) {
    commands.push(`npm install ${pattern.purposeOverrides.deps.join(' ')}`);
  }
  
  // Create additional directories
  if (pattern.purposeOverrides.add_dirs) {
    for (const dir of pattern.purposeOverrides.add_dirs) {
      commands.push(`mkdir -p ${dir}`);
    }
  }
  
  // Add bin entry for CLI projects
  if (pattern.purposeOverrides.bin) {
    commands.push(`# Add to package.json: "bin": ${JSON.stringify(pattern.purposeOverrides.bin)}`);
  }
  
  return commands;
}

export function renderKickoff(
  projectName: string,
  model: string,
  stack: string,
  purpose: string
): string {
  return `## Kickoff (Factory Run)

**Project**: ${projectName}
**Model/Stack/Purpose**: ${model} / ${stack} / ${purpose}

Follow the Agentic Application Factory loop:

1. **Clarify** requirements (ask concise questions if needed)
2. **Plan** minimal architecture (KISS) - list components & dependencies
3. **Retrieve** facts (no guessing) - mark unknowns as TODOs
4. **Scaffold** repository for ${stack} targeting ${purpose}
5. **Implement** iteratively with DRY refactors and self-review
6. **Test/verify** after each step (lint/typecheck/run)
7. **Refine** by eliminating duplication and improving clarity
8. **Finalize** with complete code, run instructions, and next steps

### Constraints
- No hardcoded secrets or API keys
- No fabricated APIs or libraries
- Keep code simple and maintainable
- Remove duplication through abstraction

### Deliverables
- Runnable ${stack} scaffold
- Core ${purpose} features implemented
- README with exact setup commands
- Clean, well-commented code

Begin by understanding what specific features are needed for this ${purpose}.`;
}

export async function bootstrapFactory({
  model,
  stack,
  purpose,
  projectName,
  workdir
}: {
  model: string;
  stack: string;
  purpose: string;
  projectName: string;
  workdir: string;
}): Promise<SessionConfig> {
  const pattern = await resolvePattern(model, stack, purpose);
  
  // Create session metadata
  const sessionData = {
    model,
    stack,
    purpose,
    projectName,
    created_at: new Date().toISOString()
  };
  
  const factoryDir = path.join(workdir, '.factory');
  await fs.mkdir(factoryDir, { recursive: true });
  await fs.writeFile(
    path.join(factoryDir, 'session.json'),
    JSON.stringify(sessionData, null, 2),
    'utf-8'
  );
  
  // Ensure algorithm exists
  const algorithmPath = path.join(factoryDir, 'algorithm.md');
  await ensureAlgorithm(algorithmPath);
  
  // Read algorithm content
  const algorithmContent = await fs.readFile(algorithmPath, 'utf-8');
  
  // Create prompt file
  const promptFile = await ensurePromptFile(
    pattern.cliBinding,
    workdir,
    algorithmContent,
    { stack, purpose }
  );
  
  // Generate scaffold plan
  const plan = materializeScaffold(pattern);
  
  // Create checklist
  const checklist = [
    `Set ${pattern.cliBinding.env} environment variable`,
    `Install ${pattern.cliBinding.launch} CLI if needed`,
    `Open terminal in project directory`,
    `Run: ${pattern.cliBinding.launch}`
  ];
  
  // Generate kickoff prompt
  const kickoff = renderKickoff(projectName, model, stack, purpose);
  
  return {
    checklist,
    launchCmd: pattern.cliBinding.launch,
    plan,
    kickoff,
    promptFile
  };
}
