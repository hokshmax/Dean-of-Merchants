/**
 * Resolves the API base URL at call time, in the browser. A build-time env var
 * (NEXT_PUBLIC_API_URL) always wins if set. Otherwise, in a GitHub Codespace, the browser is
 * already sitting on the correct forwarded domain (e.g. https://<name>-3000.app.github.dev) --
 * we just swap the port suffix rather than depending on devcontainer lifecycle scripts to have
 * written it ahead of time (CODESPACE_NAME isn't reliably available yet when postStartCommand
 * runs, so a file written then is not a robust source of truth).
 */
export function resolveApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    const codespacesMatch = hostname.match(/^(.*)-(\d+)\.(app\.github\.dev)$/);
    if (codespacesMatch) {
      const [, namePrefix, , domain] = codespacesMatch;
      return `${protocol}//${namePrefix}-3001.${domain}`;
    }
  }

  return "http://localhost:3001";
}
