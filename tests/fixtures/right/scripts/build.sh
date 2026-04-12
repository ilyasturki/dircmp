#!/bin/bash
set -euo pipefail
echo "Linting..."
npm run lint
echo "Building project..."
npm run build
echo "Build complete!"
