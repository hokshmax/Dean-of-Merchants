#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# In a Codespace, the browser hits the API through its forwarded HTTPS URL, not
# "localhost" (that only resolves inside the container). Point the web app at it.
if [ -n "${CODESPACE_NAME:-}" ]; then
  echo "NEXT_PUBLIC_API_URL=https://${CODESPACE_NAME}-3001.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}" \
    > apps/web/.env.local
fi
