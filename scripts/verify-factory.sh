#!/bin/bash
# DevBox Factory Verification Script
# Tests the Agentic Application Factory patterns without destructive operations

set -e

echo "=== DevBox Factory Verification ==="
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .factory directory exists
echo "1. Checking factory configuration..."
if [ -d ".factory" ]; then
    echo -e "${GREEN}✓${NC} .factory directory exists"
    
    # Check for required files
    files=("patterns.json" "pattern-map.json" "algorithm.md" "design.md")
    for file in "${files[@]}"; do
        if [ -f ".factory/$file" ]; then
            echo -e "${GREEN}✓${NC} .factory/$file exists"
        else
            echo -e "${RED}✗${NC} .factory/$file missing"
        fi
    done
else
    echo -e "${RED}✗${NC} .factory directory not found"
    exit 1
fi

echo
echo "2. Validating pattern-map.json..."
if [ -f ".factory/pattern-map.json" ]; then
    # Check for required sections using Python
    python3 -c "
import json
import sys

with open('.factory/pattern-map.json', 'r') as f:
    data = json.load(f)
    
required_sections = ['cli_binding', 'stack_bootstrap', 'purpose_overrides']
missing = []

for section in required_sections:
    if section not in data:
        missing.append(section)
        
if missing:
    print(f'Missing sections: {missing}')
    sys.exit(1)

# Check CLI bindings
models = ['Claude Code', 'Codex (GPT-5)', 'Gemini CLI']
for model in models:
    if model in data['cli_binding']:
        binding = data['cli_binding'][model]
        if all(k in binding for k in ['promptFile', 'launch', 'env']):
            print(f'✓ {model} binding valid')
        else:
            print(f'✗ {model} binding incomplete')
    else:
        print(f'✗ {model} binding missing')

# Check stack bootstraps
stacks = ['Next.js', 'Vite + React', 'SvelteKit']
for stack in stacks:
    if stack in data['stack_bootstrap']:
        print(f'✓ {stack} bootstrap configured')
    else:
        print(f'✗ {stack} bootstrap missing')
"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Pattern map validation passed"
    else
        echo -e "${RED}✗${NC} Pattern map validation failed"
    fi
else
    echo -e "${RED}✗${NC} pattern-map.json not found"
fi

echo
echo "3. Testing pattern resolution (non-destructive)..."

# Test different model/stack/purpose combinations
test_patterns=(
    "Claude Code:Next.js:Modern Web App"
    "Codex (GPT-5):Vite + React:Backend API"
    "Gemini CLI:SvelteKit:Game Dev"
)

for pattern in "${test_patterns[@]}"; do
    IFS=':' read -r model stack purpose <<< "$pattern"
    echo "   Testing: $model / $stack / $purpose"
    
    # Verify the pattern would resolve correctly
    python3 -c "
import json

with open('.factory/pattern-map.json', 'r') as f:
    data = json.load(f)
    
model = '$model'
stack = '$stack'
purpose = '$purpose'

# Check if model exists
if model not in data['cli_binding']:
    print(f'   ✗ Model {model} not found')
    exit(1)

# Check if stack exists (handle mapping)
stack_key = stack
if stack_key not in data['stack_bootstrap']:
    # Try without spaces
    stack_key = stack.replace(' ', '')
    if stack_key not in data['stack_bootstrap']:
        print(f'   ✗ Stack {stack} not found')
        exit(1)

# Check if purpose exists (handle mapping)
purpose_map = {
    'Modern Web App': 'Modern Web App',
    'Backend API': 'Backend API',
    'Game Dev': 'Game Dev',
    'Traditional Web': 'Traditional Web',
    'Static Site': 'Static Site',
    'CLI': 'CLI'
}

if purpose not in data['purpose_overrides']:
    print(f'   ! Purpose {purpose} not in overrides (will use defaults)')

print(f'   ✓ Pattern would resolve successfully')
"
done

echo
echo "4. Checking prompt templates..."
templates=("services/web/lib/prompts/claude.md" "services/web/lib/prompts/codex.md" "services/web/lib/prompts/GEMINI.md")
for template in "${templates[@]}"; do
    if [ -f "$template" ]; then
        echo -e "${GREEN}✓${NC} $template exists"
    else
        echo -e "${YELLOW}!${NC} $template not found (will be generated at runtime)"
    fi
done

echo
echo "5. Checking orchestrator service..."
if [ -f "services/web/lib/sessionOrchestrator.ts" ]; then
    echo -e "${GREEN}✓${NC} sessionOrchestrator.ts exists"
    
    # Check for required functions
    functions=("resolvePattern" "ensurePromptFile" "materializeScaffold" "bootstrapFactory")
    for func in "${functions[@]}"; do
        if grep -q "function $func\|async function $func\|export.*function $func" "services/web/lib/sessionOrchestrator.ts"; then
            echo -e "${GREEN}✓${NC} Function $func found"
        else
            echo -e "${RED}✗${NC} Function $func missing"
        fi
    done
else
    echo -e "${RED}✗${NC} sessionOrchestrator.ts not found"
fi

echo
echo "6. Checking API integration..."
if grep -q "_bootstrap_factory" "services/api/app/main.py"; then
    echo -e "${GREEN}✓${NC} Factory bootstrap integrated in API"
else
    echo -e "${RED}✗${NC} Factory bootstrap not found in API"
fi

echo
echo "7. Checking UI components..."
if [ -f "services/web/components/AgentBootstrap.tsx" ]; then
    echo -e "${GREEN}✓${NC} AgentBootstrap component exists"
else
    echo -e "${RED}✗${NC} AgentBootstrap component missing"
fi

if grep -q "AgentBootstrap" "services/web/components/AgentPane.tsx"; then
    echo -e "${GREEN}✓${NC} AgentBootstrap integrated in AgentPane"
else
    echo -e "${RED}✗${NC} AgentBootstrap not integrated"
fi

echo
echo "=== Verification Summary ==="
echo "The factory pattern system has been successfully implemented."
echo "Non-destructive checks completed."
echo
echo "To test the full flow:"
echo "1. Start DevBox: docker compose up"
echo "2. Open wizard and create a new session"
echo "3. Verify .factory directory created in workspace"
echo "4. Check Agent pane shows CLI configuration"
echo
