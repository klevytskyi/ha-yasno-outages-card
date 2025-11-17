# Git Commit Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

## Commit Message Format

Each commit message consists of a **header**, a **body** (optional), and a **footer** (optional):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Examples

```bash
feat: add weekly schedule tabs
fix: correct dark mode icon colors
docs: update README with screenshots
refactor: extract findEntity to utils
style: format code with biome
perf: optimize data fetching with caching
```

## Pre-commit Hooks

The following checks run automatically before each commit:

1. **Biome Linting**: Checks and fixes linting issues
2. **Biome Formatting**: Formats code according to project style

## Commit Message Validation

Commit messages are validated using commitlint. Invalid commit messages will be rejected.

### Bypass Hooks (Not Recommended)

If you need to bypass hooks in exceptional cases:

```bash
git commit --no-verify -m "your message"
```

**Note**: This should only be used in exceptional circumstances.
