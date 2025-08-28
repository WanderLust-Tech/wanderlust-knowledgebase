# GitHub Secrets Configuration for Wanderlust Knowledge Base

This document outlines the required GitHub secrets for the automated deployment process.

## Required Secrets

### Environment Variables for Build Process

These secrets are used during the Vite build process to embed configuration into the compiled application:

| Secret Name | Description | Example Value | Required |
|-------------|-------------|---------------|----------|
| `VITE_API_URL` | Production API server URL | `https://api.wander-lust.tech` | Yes |
| `VITE_APP_TITLE` | Application title | `Wanderlust Knowledge Base` | No (has default) |

### FTP Deployment Secrets (Production)

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `PROD_FTP_HOST` | Production FTP server hostname | `ftp.your-host.com` |
| `PROD_FTP_USER` | FTP username | `your_username` |
| `PROD_FTP_PASSWORD` | FTP password | `your_password` |
| `PROD_FTP_PORT` | FTP port (usually 21 or 22) | `21` |
| `PROD_FTP_SECURE` | Use FTPS (true/false) | `true` |
| `PROD_FTP_REMOTE_PATH` | Remote directory path | `/public_html/` |

### FTP Deployment Secrets (Staging)

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `STAGING_FTP_HOST` | Staging FTP server hostname | `staging.your-host.com` |
| `STAGING_FTP_USER` | Staging FTP username | `staging_username` |
| `STAGING_FTP_PASSWORD` | Staging FTP password | `staging_password` |
| `STAGING_FTP_PORT` | Staging FTP port | `21` |
| `STAGING_FTP_SECURE` | Use FTPS for staging | `true` |
| `STAGING_FTP_REMOTE_PATH` | Staging remote path | `/staging/` |

## How to Set Up GitHub Secrets

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Enter the secret name and value
6. Click **Add secret**

## Environment Variable Handling

The GitHub Actions workflow handles environment variables in the following priority:

1. **GitHub Secrets** (highest priority) - Used for production builds
2. **Default Values** - Fallback values if secrets are not set
3. **Local .env files** - Used for local development

### Build-Time Environment Variables

Vite requires environment variables to be available at **build time** because they get embedded into the compiled JavaScript bundle. This is why we set them in the GitHub Actions workflow during the build step.

### Local Development

For local development, use the `.env.development` file:

```bash
# Local Development
VITE_API_URL=http://localhost:5000
VITE_APP_TITLE=Wanderlust Knowledge Base (Dev)
VITE_APP_VERSION=dev
```

### Production Deployment

The production build uses either:
- GitHub secrets (recommended for CI/CD)
- Values from `.env.production` file (for manual builds)

## Troubleshooting

### Environment Variables Not Being Read

If environment variables aren't being read during GitHub Actions:

1. **Check Secret Names**: Ensure secret names exactly match what's used in the workflow
2. **Check Environment Context**: Variables should be set in the `env:` section of the build step
3. **Check Vite Prefix**: All Vite environment variables must start with `VITE_`
4. **Check Build Logs**: GitHub Actions logs will show which values are being used

### Common Issues

1. **Typos in secret names** - Secret names are case-sensitive
2. **Missing VITE_ prefix** - Vite only exposes variables that start with `VITE_`
3. **Secrets not available in forks** - GitHub secrets are not available in fork PRs for security
4. **Build vs Runtime** - Vite variables are embedded at build time, not runtime

## Testing

To test if environment variables are working:

1. Check the GitHub Actions build logs for environment variable setup
2. Build locally with production configuration: `npm run build`
3. Check the compiled files in `dist/` to ensure variables are embedded correctly

## Security Notes

- Never commit real API keys or passwords to the repository
- Use different secrets for staging and production environments
- Regularly rotate FTP passwords and API keys
- Monitor GitHub Actions logs for any exposed sensitive data
