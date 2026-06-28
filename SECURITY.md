# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | ✅ Yes             |
| < 0.3   | ❌ No              |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue**
2. Email the maintainers directly (or use GitHub's private vulnerability reporting)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 1 week
- **Fix or mitigation**: depends on severity

## Security Considerations

Lumora is a local-first desktop application:
- All data stays on the user's machine
- No telemetry or analytics
- No cloud sync (unless user explicitly configures it)
- AI features use local Ollama instance

## Dependencies

We regularly audit dependencies for known vulnerabilities using `cargo audit` and `npm audit`.
