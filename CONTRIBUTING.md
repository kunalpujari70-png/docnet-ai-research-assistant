# Contributing to DocNet AI Research Assistant

Thank you for your interest in contributing to DocNet! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Bugs
- Use the GitHub issue tracker
- Include detailed steps to reproduce the bug
- Provide system information (OS, browser, etc.)
- Include error messages and screenshots if applicable

### Suggesting Features
- Check existing issues to avoid duplicates
- Provide a clear description of the feature
- Explain the use case and benefits
- Consider implementation complexity

### Code Contributions
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- Git

### Local Development
```bash
# Clone the repository
git clone https://github.com/yourusername/docnet-ai-research-assistant.git
cd docnet-ai-research-assistant

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development server
pnpm dev
```

### Available Scripts
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm test` - Run tests
- `pnpm typecheck` - TypeScript validation
- `pnpm lint` - Run linter

## 📝 Code Style Guidelines

### TypeScript
- Use TypeScript for all new code
- Provide proper type definitions
- Use interfaces for object shapes
- Prefer `const` over `let` when possible

### React Components
- Use functional components with hooks
- Follow the naming convention: PascalCase
- Keep components focused and single-purpose
- Use proper prop types and interfaces

### CSS/Styling
- Use TailwindCSS utility classes
- Follow the existing design system
- Use CSS custom properties for theming
- Ensure responsive design

### File Structure
```
client/
├── components/     # Reusable UI components
├── pages/         # Route components
├── contexts/      # React contexts
├── services/      # API services
└── styles/        # CSS files

server/
├── routes/        # API route handlers
└── utils/         # Utility functions
```

## 🧪 Testing

### Writing Tests
- Write tests for new features
- Use Vitest for unit testing
- Test both success and error cases
- Mock external dependencies

### Running Tests
```bash
pnpm test          # Run all tests
pnpm test:watch    # Run tests in watch mode
pnpm test:coverage # Run tests with coverage
```

## 🔧 API Development

### Adding New Endpoints
1. Create route handler in `server/routes/`
2. Add proper error handling
3. Include input validation
4. Add TypeScript types
5. Update API documentation

### Environment Variables
- Never commit API keys to the repository
- Use `.env.example` for documentation
- Validate required environment variables

## 📚 Documentation

### Code Documentation
- Use JSDoc comments for functions
- Document complex logic
- Include examples for public APIs
- Keep README.md updated

### API Documentation
- Document all endpoints
- Include request/response examples
- Specify required and optional parameters
- Document error responses

## 🚀 Deployment

### Netlify Deployment
- Automatic deployment on push to main
- Environment variables configured in Netlify dashboard
- Functions deployed from `netlify/functions/`

### Manual Deployment
```bash
pnpm build:netlify
netlify deploy --prod --dir=dist/spa --functions=netlify/functions
```

## 🔒 Security

### Best Practices
- Never expose API keys in client-side code
- Validate all user inputs
- Use HTTPS in production
- Implement proper authentication
- Sanitize data before storage

### Reporting Security Issues
- Email security issues to security@docnet.ai
- Do not create public issues for security vulnerabilities
- Provide detailed information about the vulnerability

## 📋 Pull Request Guidelines

### Before Submitting
- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No console errors
- [ ] Responsive design tested

### PR Description
- Clear description of changes
- Link to related issues
- Screenshots for UI changes
- Test instructions

### Review Process
- All PRs require review
- Address review comments
- Maintainers will merge after approval
- CI/CD pipeline must pass

## 🏷️ Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `priority: high` - High priority issues
- `priority: low` - Low priority issues

## 🎯 Roadmap

### Planned Features
- [ ] Mobile app development
- [ ] Advanced document processing
- [ ] Multi-language support
- [ ] Team collaboration features
- [ ] Advanced analytics

### Contributing to Roadmap
- Suggest features through issues
- Vote on existing feature requests
- Provide use cases and requirements
- Consider implementation complexity

## 📞 Getting Help

### Community
- GitHub Discussions for questions
- GitHub Issues for bugs and features
- Email support@docnet.ai

### Resources
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev/)

## 📄 License

By contributing to DocNet, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to DocNet! 🚀
