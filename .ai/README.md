# .ai/ — AI Collaboration Hub

This directory coordinates work between AI agents (Claude Code, ChatGPT, Figma AI) and the human developer.

## Workflow

```
TASK-XXX created (ChatGPT or human)
    |
    v
ChatGPT creates task spec + acceptance criteria
    |
    v
Claude Code implements (reads CURRENT_TASK.md)
    |
    v
Claude Code updates PROJECT_STATE.md
    |
    v
Human tests
    |
    v
ChatGPT reviews (or human reviews)
    |
    v
Commit
```

## Files

| File | Purpose | Updated by |
|------|---------|------------|
| `PROJECT_STATE.md` | Ground truth for the entire project | Claude Code (after each task) |
| `CURRENT_SPRINT.md` | Active sprint goals and task list | ChatGPT / Human |
| `CURRENT_TASK.md` | The single task Claude Code should work on now | ChatGPT / Human |
| `ARCHITECTURE.md` | Confirmed tech stack and system boundaries | Human (final say) |
| `DECISIONS.md` | Architectural Decision Records (ADRs) | Claude Code / Human |
| `CHANGELOG.md` | Running log of completed work | Claude Code |

## Prompt Templates

| Directory | Purpose |
|-----------|---------|
| `prompts/claude/` | Prompt templates for Claude Code tasks |
| `prompts/chatgpt/` | Prompt templates for ChatGPT planning/review |
| `prompts/figma/` | Prompt templates for Figma AI design extraction |

## Rules

1. Claude Code reads `CURRENT_TASK.md` before starting any work
2. Claude Code never modifies `ARCHITECTURE.md` without human approval
3. Claude Code updates `PROJECT_STATE.md` after completing each task
4. Claude Code appends to `CHANGELOG.md` after each commit
5. ChatGPT creates tasks, Claude Code implements them
6. Human has final say on all architectural decisions
