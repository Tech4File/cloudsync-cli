# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Full Support    |
| 0.x.x   | ❌ Not Supported   |

## Reporting a Vulnerability

If you discover a security vulnerability within CloudSync-CLI, please follow
responsible disclosure practices:

1. **Do NOT** create a public GitHub issue for the vulnerability
2. Send a detailed report to the security team via:
   - GitHub's [Private Vulnerability Reporting](https://github.com/Tech4File/cloudsync-cli/security/advisories/new)
   - Or email: security@cloudsync.dev

### What to Include

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue

### Response Timeline

- **Initial Response**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix Development**: Based on severity
- **Public Disclosure**: After fix is available

## Security Best Practices

When using CloudSync-CLI, follow these security guidelines:

### SSH Key Management

```bash
# Use strong SSH keys (minimum 4096 bits for RSA)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/cloudsync_key

# Protect your private key
chmod 600 ~/.ssh/cloudsync_key
```

### Environment Variables

Never commit sensitive data. Use environment variables:

```bash
# Set sensitive values
export CLOUDSYNC_KEY_PASSWORD=your_secure_password

# Or use a secrets manager
```

### Network Security

- Always verify host keys when connecting to new servers
- Use VPN for additional security on untrusted networks
- Regularly rotate SSH keys
- Use strong passwords for share links

## Known Limitations

### Memory-Only Processing

CloudSync-CLI uses memory-only streams for sensitive data processing to minimize
disk exposure. However:

- Large files may require temporary disk usage
- System memory constraints apply
- Swap usage may occur on systems with limited RAM

### SSH Tunnel Security

When creating SSH tunnels:

- Only bind to necessary ports
- Use `localhost` binding when possible
- Monitor active tunnel connections
- Close tunnels when not in use

## Updates and Patches

Security updates will be released as patch versions:

```bash
# Update to latest version
npm update -g cloudsync-cli

# Check current version
cloudsync --version
```

## Security Audit

This project undergoes regular security audits. Reports are available in the
repository's Security tab.

---

Thank you for helping keep CloudSync-CLI secure!
