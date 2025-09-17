# Agentic Application Factory Algorithm

## Core Loop

The Agentic Application Factory follows an iterative, test-driven approach to building applications. Each phase builds upon the previous, with continuous validation and refinement.

### 1. CLARIFY - Requirements Gathering
- **Objective**: Fully understand what needs to be built
- **Actions**:
  - Parse user requirements and constraints
  - Identify core features vs nice-to-haves
  - Ask targeted questions if ambiguity exists
  - Define success criteria
- **Output**: Clear requirements list with priorities

### 2. PLAN - Architecture Design
- **Objective**: Design minimal viable architecture
- **Principles**: KISS (Keep It Simple), YAGNI (You Aren't Gonna Need It)
- **Actions**:
  - List core components and their responsibilities
  - Define data flow and dependencies
  - Choose appropriate patterns for the stack
  - Plan file structure
- **Output**: Component list with clear boundaries

### 3. RETRIEVE - Information Gathering
- **Objective**: Gather all necessary facts without guessing
- **Actions**:
  - Look up API documentation
  - Verify library versions and compatibility
  - Check best practices for chosen stack
  - Mark unknowns as TODOs rather than fabricating
- **Output**: Fact sheet with verified information

### 4. SCAFFOLD - Project Structure
- **Objective**: Create the foundational structure
- **Actions**:
  - Initialize project with stack-specific tooling
  - Create directory structure
  - Set up configuration files
  - Install core dependencies
  - Ensure hot-reload works
- **Output**: Runnable skeleton with live preview

### 5. IMPLEMENT - Iterative Development
- **Objective**: Build features incrementally
- **Approach**: Start with core functionality, add layers
- **Actions**:
  - Implement one component at a time
  - Write clean, self-documenting code
  - Add types/interfaces (TypeScript)
  - Handle errors gracefully
  - Keep preview running
- **Output**: Working features with each iteration

### 6. TEST - Continuous Verification
- **Objective**: Ensure each piece works correctly
- **Actions**:
  - Run linter after each file change
  - Type-check TypeScript code
  - Manually test in preview
  - Verify hot-reload still works
  - Check console for errors
- **Output**: Validated, working code

### 7. REFINE - Apply Best Practices
- **Objective**: Improve code quality
- **Principles**: DRY (Don't Repeat Yourself)
- **Actions**:
  - Extract repeated code into utilities
  - Consolidate similar components
  - Improve naming consistency
  - Add helpful comments
  - Optimize performance if needed
- **Output**: Clean, maintainable codebase

### 8. FINALIZE - Delivery
- **Objective**: Prepare for handoff
- **Actions**:
  - Ensure all features work
  - Write clear README with:
    - Setup instructions
    - Available scripts
    - Environment variables
    - Architecture overview
  - Clean up debug code
  - Final preview verification
- **Output**: Production-ready application

## Constraints & Guidelines

### Security
- **NEVER** hardcode secrets, API keys, or passwords
- Use environment variables for sensitive data
- Validate all user inputs
- Sanitize outputs to prevent XSS

### Code Quality
- **KISS**: Choose simple solutions over complex ones
- **DRY**: Eliminate duplication through abstraction
- **YAGNI**: Don't add features "just in case"
- Use descriptive variable and function names
- Keep functions small and focused

### Stack-Specific Guidelines

#### Next.js
- Use App Router for new projects
- Implement proper loading and error boundaries
- Leverage server components where appropriate
- Set up proper metadata for SEO

#### Vite + React
- Use functional components with hooks
- Implement proper state management
- Set up routing with React Router
- Optimize bundle size

#### Vite + Vue
- Use Composition API for new components
- Implement proper reactivity
- Set up Vue Router for navigation
- Use TypeScript for type safety

#### SvelteKit
- Leverage file-based routing
- Use load functions for data fetching
- Implement proper error handling
- Optimize for SSR/SSG where appropriate

### Purpose-Specific Focus

#### Modern Web App
- Responsive design (mobile-first)
- Smooth animations and transitions
- Optimized performance metrics
- Progressive enhancement

#### Backend API
- RESTful design principles
- Proper status codes
- Input validation
- Error handling middleware
- CORS configuration

#### Game Dev
- Optimize render loop
- Efficient asset loading
- Smooth animations (60 FPS)
- Input handling (keyboard/mouse/touch)

#### Traditional Web
- Server-side rendering
- Progressive enhancement
- Minimal JavaScript
- SEO optimization

#### Static Site
- Fast build times
- Markdown processing
- Static asset optimization
- Clean URLs

#### CLI
- Clear command structure
- Helpful error messages
- Progress indicators
- Interactive prompts when needed

## Output Format

When delivering code:

1. **File-by-file listing**: Show complete file contents
2. **Clear file paths**: Use project-relative paths
3. **Runnable state**: Code must work immediately
4. **No placeholders**: Implement actual functionality
5. **Comments**: Add helpful inline comments

## Example Kickoff Prompt

```
Project: {PROJECT_NAME}
Stack: {STACK} | Purpose: {PURPOSE}

Build a {PURPOSE} using {STACK} that:
- [Core requirement 1]
- [Core requirement 2]
- [Core requirement 3]

Follow the Factory Algorithm:
1. Clarify any ambiguities
2. Plan minimal architecture  
3. Retrieve verified information
4. Scaffold the project
5. Implement iteratively
6. Test continuously
7. Refine with DRY/KISS
8. Finalize with documentation

Constraints:
- No hardcoded secrets
- Keep it simple (KISS)
- Don't repeat yourself (DRY)
- Must run immediately
```

## Success Metrics

A successful factory run produces:
- ✅ Working application with live preview
- ✅ Clean, maintainable code
- ✅ Clear documentation
- ✅ No security vulnerabilities
- ✅ Follows stack best practices
- ✅ Achieves stated requirements
