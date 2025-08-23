# Deployment Guide

This guide explains how to deploy the Wanderlust Knowledge Base using either local FTP deployment or GitHub Actions CI/CD.

## 🚀 Deployment Methods

### Method 1: Local FTP Deployment

#### Setup

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Configure your .env file**:
   ```bash
   # FTP Server Details
   FTP_HOST=your-ftp-host.com
   FTP_USER=your-ftp-username
   FTP_PASSWORD=your-ftp-password
   FTP_PORT=21
   FTP_SECURE=false
   
   # Deployment Paths
   FTP_REMOTE_PATH=/public_html
   LOCAL_BUILD_PATH=./dist
   
   # Deployment Options
   CLEAR_REMOTE=true
   ```

#### Deployment Commands

```bash
# Build and deploy in one command
npm run deploy

# Test FTP connection
npm run deploy:test

# Create backup of current remote files
npm run deploy:backup

# Deploy to staging environment
npm run deploy:staging

# Deploy to production environment
npm run deploy:production
```

#### Manual Deployment Steps

```bash
# 1. Build the application
npm run build

# 2. Test connection (optional)
npm run deploy:test

# 3. Create backup (recommended)
npm run deploy:backup

# 4. Deploy
node scripts/deploy.js deploy
```

### Method 2: GitHub Actions CI/CD

#### Setup

1. **Configure GitHub Secrets**:
   Go to your GitHub repository → Settings → Secrets and variables → Actions

   **For Production:**
   - `PROD_FTP_HOST` - Your production FTP host
   - `PROD_FTP_USER` - Your production FTP username
   - `PROD_FTP_PASSWORD` - Your production FTP password
   - `PROD_FTP_PORT` - Your production FTP port (optional, default: 21)
   - `PROD_FTP_SECURE` - Set to 'true' for FTPS (optional)
   - `PROD_FTP_REMOTE_PATH` - Remote path on server (e.g., /public_html)

   **For Staging:**
   - `STAGING_FTP_HOST`
   - `STAGING_FTP_USER`
   - `STAGING_FTP_PASSWORD`
   - `STAGING_FTP_PORT`
   - `STAGING_FTP_SECURE`
   - `STAGING_FTP_REMOTE_PATH`

2. **Configure GitHub Environments**:
   Go to Settings → Environments and create:
   - `production` environment
   - `staging` environment (optional)

   Add protection rules as needed (e.g., require reviews for production).

#### Deployment Triggers

- **Production**: Automatic deployment when pushing to `main` or `master` branch
- **Staging**: Automatic deployment when pushing to `develop` branch
- **Manual**: Use the "Actions" tab → "Build and Deploy" → "Run workflow"

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `FTP_HOST` | FTP server hostname | - | ✅ |
| `FTP_USER` | FTP username | - | ✅ |
| `FTP_PASSWORD` | FTP password | - | ✅ |
| `FTP_PORT` | FTP port | 21 | ❌ |
| `FTP_SECURE` | Use FTPS (true/false) | false | ❌ |
| `FTP_REMOTE_PATH` | Remote directory path | / | ❌ |
| `LOCAL_BUILD_PATH` | Local build directory | ./dist | ❌ |
| `CLEAR_REMOTE` | Clear remote directory first | false | ❌ |

### Multiple Environments

You can create separate .env files for different environments:

```bash
# .env.production
FTP_HOST=production.yoursite.com
FTP_USER=prod_user
FTP_PASSWORD=prod_password
FTP_REMOTE_PATH=/public_html
CLEAR_REMOTE=true

# .env.staging
FTP_HOST=staging.yoursite.com
FTP_USER=staging_user
FTP_PASSWORD=staging_password
FTP_REMOTE_PATH=/staging
CLEAR_REMOTE=true
```

Then deploy using:
```bash
# Load production environment
npm run deploy:production

# Load staging environment
npm run deploy:staging
```

## 🛡️ Security Best Practices

1. **Never commit .env files** - They're already in .gitignore
2. **Use strong passwords** for FTP accounts
3. **Enable FTPS** when possible (set `FTP_SECURE=true`)
4. **Limit FTP user permissions** to only necessary directories
5. **Use GitHub Environments** with protection rules for production
6. **Regularly rotate passwords** and update secrets

## 🔍 Troubleshooting

### Common Issues

**Connection Failed**
```bash
# Test your connection
npm run deploy:test

# Check your credentials and host
ping your-ftp-host.com
```

**Build Directory Not Found**
```bash
# Make sure to build first
npm run build

# Check if dist directory exists
ls -la dist/
```

**Permission Denied**
- Check FTP user permissions
- Verify the remote path exists and is writable
- Try with a different remote path

**GitHub Actions Failing**
- Check that all required secrets are set
- Verify the branch names in the workflow file
- Check the Actions logs for detailed error messages

### Deployment Verification

After deployment, verify:

1. **Website is accessible** at your domain
2. **All assets load correctly** (CSS, JS, images)
3. **Navigation works** and routes are properly configured
4. **Search functionality** is working
5. **PWA features** are active (if applicable)

## 📁 File Structure

```
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions workflow
├── scripts/
│   └── deploy.js              # FTP deployment script
├── .env.example               # Environment template
├── .env                       # Your environment (gitignored)
└── dist/                      # Built files (created by npm run build)
```

## 🔄 Backup and Recovery

### Creating Backups

```bash
# Create backup before deployment
npm run deploy:backup
```

Backups are stored in `./backups/YYYY-MM-DD/` directory.

### Rollback Process

1. **Stop current deployment** (if in progress)
2. **Locate backup** in `./backups/` directory
3. **Manually upload backup** using FTP client
4. **Or restore from GitHub Actions artifacts**

## 📞 Support

If you encounter issues:

1. Check this documentation
2. Review the deployment script logs
3. Test FTP connection manually
4. Check GitHub Actions logs (for CI/CD issues)
5. Verify all environment variables are set correctly

## 🔮 Alternative Deployment Options

The workflow also includes configurations for:

- **SSH/Rsync deployment** (set deploy-ssh job to `if: true`)
- **GitHub Pages deployment** (set deploy-pages job to `if: true`)
- **Other hosting providers** (modify the deployment script as needed)

Choose the method that best fits your hosting setup!
