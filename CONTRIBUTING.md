# Contributing to Playwright EasyScale

Thank you for your interest in contributing to Playwright EasyScale! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/playwright-easyscale.git
   cd playwright-easyscale
   ```
3. **Install dependencies**:
   ```bash
   cd orchestrator && npm install
   cd ../worker && npm install
   ```

## Development Workflow

1. **Create a branch** for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines below

3. **Test your changes** locally:
   ```bash
   # Test orchestrator
   cd orchestrator
   node src/index.js --config=../configs/example.json --dry-run

   # Test worker locally with Docker
   cd ../worker
   docker build -t playwright-worker .
   docker run -e USER_RANGE_START=1 -e USER_RANGE_END=2 playwright-worker
   ```

4. **Commit your changes** with clear, descriptive messages:
   ```bash
   git commit -m "Add feature: description of what you added"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** on GitHub

## Code Style Guidelines

### JavaScript Style

- Use modern JavaScript (ES6+)
- Use `const` and `let`, avoid `var`
- Use single quotes for strings
- Include semicolons
- Use meaningful variable names
- Add JSDoc comments for functions

Example:
```javascript
/**
 * Calculate distribution of users across containers
 * @param {number} totalUsers - Total number of users
 * @param {number} usersPerContainer - Users per container
 * @returns {Object} Distribution plan
 */
function calculateDistribution(totalUsers, usersPerContainer) {
  // Implementation
}
```

### File Organization

- Keep files focused on a single responsibility
- Use descriptive file names
- Group related functionality in directories
- Export only what's needed

### Error Handling

- Always handle errors appropriately
- Provide meaningful error messages
- Log errors with context
- Don't swallow errors silently

## Testing

- Test your changes locally before submitting
- Include example configurations if adding new features
- Document any new environment variables or configuration options

## Documentation

- Update README.md if adding new features
- Add JSDoc comments to new functions
- Update configuration examples if needed
- Create documentation in `docs/` for major features

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows the style guidelines
- [ ] Changes have been tested locally
- [ ] Documentation has been updated
- [ ] Commit messages are clear and descriptive

### PR Description

Include in your PR description:
- **What** changes you made
- **Why** you made them
- **How** to test the changes
- Any **breaking changes** or **migration notes**

Example:
```markdown
## What
Added support for custom Railway API endpoints

## Why
Users may need to use different Railway API endpoints for testing or regional deployments

## How to Test
1. Set RAILWAY_API_URL environment variable
2. Run orchestrator with --dry-run
3. Verify it uses the custom endpoint

## Breaking Changes
None
```

## Reporting Issues

When reporting issues, please include:

- **Description** of the problem
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Environment details** (OS, Node version, etc.)
- **Configuration** (sanitized, without secrets)
- **Logs** (if applicable)

## Feature Requests

We welcome feature requests! Please:

- Check if the feature already exists or is planned
- Describe the use case clearly
- Explain why it would be valuable
- Consider if it fits the project's scope

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

## Questions?

- Open an issue for questions about contributing
- Check existing issues and PRs for similar discussions
- Review the documentation in `docs/`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Playwright EasyScale! 🚀
