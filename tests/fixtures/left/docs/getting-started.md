# Getting Started

## Installation

```bash
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at http://localhost:3000.

## Building

Create a production build:

```bash
npm run build
```

The output will be in the `dist/` directory.

## Project Structure

```
src/
  components/   # React components
  utils/        # Utility functions
  hooks/        # Custom React hooks
config/         # Configuration files
tests/
  unit/         # Unit tests
  integration/  # Integration tests
docs/           # Documentation
```

## Configuration

The main configuration is in `config/tsconfig.json`. You can modify
compiler options there to adjust TypeScript behavior.

ESLint config is in `config/eslint.config.js`.

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

## Code Style

- Use TypeScript for all source files
- Prefer functional components over class components
- Use named exports instead of default exports
- Keep functions small and focused
- Write tests for all utility functions

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
