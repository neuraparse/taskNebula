# Contributing to TaskNebula

Thank you for your interest in contributing to TaskNebula! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites

- Node.js 22+ (LTS)
- pnpm 9+
- PostgreSQL 16+
- Git

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/tasknebula.git
   cd tasknebula
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Setup environment variables**
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   cp packages/db/.env.example packages/db/.env
   ```

4. **Start PostgreSQL** (using Docker)
   ```bash
   docker-compose up -d postgres
   ```

5. **Run database migrations**
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

6. **Start development server**
   ```bash
   pnpm dev
   ```

## 📁 Project Structure

```
taskNebula/
├── apps/
│   └── web/              # Next.js application
├── packages/
│   ├── config/           # Shared configurations
│   ├── types/            # TypeScript types
│   ├── db/               # Database schema (Drizzle)
│   └── llm/              # LLM client abstraction
├── turbo.json            # Turborepo configuration
└── pnpm-workspace.yaml   # pnpm workspace configuration
```

## 🔧 Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or updates

Example: `feature/add-timeline-view`

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(kanban): add drag and drop support
fix(auth): resolve session timeout issue
docs(readme): update installation instructions
```

### Code Style

- We use **Prettier** for code formatting
- We use **ESLint** for linting
- Run `pnpm format` before committing
- Run `pnpm lint` to check for issues

### Type Checking

- All code must be properly typed with TypeScript
- Run `pnpm type-check` to verify types
- Avoid using `any` - use proper types or `unknown`

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## 📝 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, well-documented code
   - Add tests for new features
   - Update documentation as needed

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**
   - Provide a clear description of the changes
   - Reference any related issues
   - Ensure all CI checks pass

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Type checking passes (`pnpm type-check`)
- [ ] Linting passes (`pnpm lint`)
- [ ] No console errors or warnings
- [ ] Commit messages follow conventional commits

## 🐛 Reporting Bugs

When reporting bugs, please include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: OS, Node version, browser, etc.
- **Screenshots**: If applicable

## 💡 Feature Requests

We welcome feature requests! Please:

- Check if the feature has already been requested
- Provide a clear use case
- Explain how it aligns with TaskNebula's vision
- Consider contributing the feature yourself!

## 📚 Documentation

- Update README.md for user-facing changes
- Update inline code comments for complex logic
- Add JSDoc comments for public APIs
- Update type definitions as needed

## 🤝 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## 📞 Getting Help

- **Discord**: [Join our Discord](https://discord.gg/tasknebula) (coming soon)
- **GitHub Discussions**: Ask questions and share ideas
- **GitHub Issues**: Report bugs and request features

## 📄 License

By contributing to TaskNebula, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to TaskNebula! 🌌

