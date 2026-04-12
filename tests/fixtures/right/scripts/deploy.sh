#!/bin/bash
set -euo pipefail

ENV=${1:-staging}
echo "Deploying to $ENV..."
docker build -t my-app .
docker push my-app:latest
echo "Deployed to $ENV!"
