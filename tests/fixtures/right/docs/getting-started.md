# Getting Started

## Prerequisites

- Node.js 20+
- npm or bun

## Installation

```bash
npm install
```

Or with bun:

```bash
bun install
```

## Development

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser. The server supports hot
module replacement, so changes are reflected immediately.

## Building

Create a production build:

```bash
npm run build
```

The output will be in the `dist/` directory. You can preview the
production build with:

```bash
npm run preview
```

## Project Structure

```
src/
  components/   # React components
    App.tsx
    Header.tsx
    Footer.tsx
    Sidebar.tsx
  utils/        # Utility functions
    helpers.ts
    logger.ts
  hooks/        # Custom React hooks
    useDebounce.ts
    useLocalStorage.ts
config/         # Configuration files
  tsconfig.json
  eslint.config.js
  loader.ts
tests/
  unit/         # Unit tests
  integration/  # Integration tests
docs/           # Documentation
scripts/        # Build and deploy scripts
```

## Configuration

The main configuration is in `config/tsconfig.json`. You can modify
compiler options there to adjust TypeScript behavior.

ESLint config is in `config/eslint.config.js`. The config uses the
flat config format introduced in ESLint 9.

Additional module loading configuration can be found in
`config/loader.ts`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment |
| `LOG_LEVEL` | `info` | Logging level |
| `DEBUG` | `false` | Enable debug mode |

## Running Tests

Run all tests:

```bash
npm test
```

Run unit tests only:

```bash
npm test -- --filter unit
```

Run with coverage:

```bash
npm test -- --coverage
```

## Linting

```bash
npm run lint
```

Auto-fix issues:

```bash
npm run lint -- --fix
```

## Code Style

- Use TypeScript for all source files
- Prefer functional components over class components
- Use named exports instead of default exports
- Keep functions small and focused
- Write tests for all utility functions
- Use structured logging with metadata objects

## Deployment

See [deployment.md](deployment.md) for production deployment
instructions.

## Troubleshooting

### Port already in use

If port 3000 is taken, set a custom port:

```bash
PORT=3001 npm run dev
```

### TypeScript errors

Run the type checker to see all errors:

```bash
npm run typecheck
```

### Module not found

Clear the cache and reinstall:

```bash
rm -rf node_modules
npm install
```

### Log output too verbose

Set the `LOG_LEVEL` environment variable:

```bash
LOG_LEVEL=warn npm run dev
```
