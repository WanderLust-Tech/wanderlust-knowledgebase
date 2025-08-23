# 📦 Package.json Triggered Deployments

Your deployment system now automatically triggers when `package.json` or `package-lock.json` files are updated! Here's how it works:

## 🎯 **What Triggers Deployment**

### Automatic Triggers:
- ✅ **package.json** changes (dependency updates, version bumps, script changes)
- ✅ **package-lock.json** changes (dependency lock file updates)
- ✅ **Workflow file changes** (.github/workflows/*.yml)

### Manual Triggers:
- ✅ **Manual workflow dispatch** (GitHub Actions tab → "Run workflow")
- ✅ **Local deployment** commands (`npm run deploy`)

## 🔄 **Workflow Structure**

### 1. **Main Deployment Workflow** (`deploy.yml`)
- **Triggers**: Only on package.json/package-lock.json changes
- **Purpose**: Critical deployments when dependencies or configuration change
- **Behavior**: Always clears remote directory for clean deployment

### 2. **Content Deployment Workflow** (`deploy-content.yml`)
- **Triggers**: On source code and content changes
- **Purpose**: Regular content updates and feature deployments
- **Behavior**: Faster deployment without clearing remote directory

## 🚀 **How It Works**

### When You Update package.json:

1. **Commit your changes**:
   ```bash
   git add package.json package-lock.json
   git commit -m "feat: update dependencies"
   git push origin main
   ```

2. **GitHub Actions automatically**:
   - Detects package.json changes
   - Builds the application with new dependencies
   - Runs tests with updated packages
   - Deploys to production with clean remote directory

3. **Deployment script recognizes**:
   - Package changes trigger enhanced deployment
   - Remote directory is cleared for clean state
   - Logs indicate package-triggered deployment

### Example Workflow Output:
```
🚀 Package changes detected - triggering deployment build
📦 This workflow runs when package.json or package-lock.json are modified
📦 Deployment triggered by package.json changes
🔄 This may include dependency updates or version changes
📦 Package-triggered deployment complete - dependencies updated on server
```

## 📋 **Deployment Matrix**

| File Changed | Workflow Triggered | Remote Directory | Use Case |
|--------------|-------------------|------------------|----------|
| `package.json` | `deploy.yml` | ✅ Cleared | Dependency updates |
| `package-lock.json` | `deploy.yml` | ✅ Cleared | Lock file updates |
| `src/**` | `deploy-content.yml` | ❌ Preserved | Code changes |
| `public/**` | `deploy-content.yml` | ❌ Preserved | Content updates |
| Manual trigger | Both available | ⚙️ Configurable | Testing/Hotfix |

## 🛠️ **Configuration Options**

### Environment Variables:
```bash
# Force clear remote directory (overrides auto-detection)
CLEAR_REMOTE=true

# Skip package change detection
FORCE_DEPLOY=true
```

### GitHub Secrets Setup:
```
PROD_FTP_HOST=your-server.com
PROD_FTP_USER=your-username
PROD_FTP_PASSWORD=your-password
PROD_FTP_REMOTE_PATH=/public_html
```

## 🔍 **Deployment Detection Logic**

The system detects package changes through:

1. **GitHub Actions**: Analyzes commit changes for package files
2. **Local Deployment**: Checks package.json modification time
3. **Override Options**: Manual flags to force specific behavior

```javascript
// Automatic detection in deploy script
if (packageChanged) {
  console.log('📦 Deployment triggered by package.json changes');
  // Clear remote directory for clean dependency deployment
  await this.clearRemoteDirectory(this.config.remotePath);
}
```

## ⚡ **Benefits**

### **For Package Changes**:
- 🔄 **Clean deployments** when dependencies change
- 🚀 **Automatic triggering** on dependency updates
- 🛡️ **Reduced conflicts** from stale dependencies
- 📊 **Clear logging** of deployment reasons

### **For Content Changes**:
- ⚡ **Faster deployments** for regular updates
- 💾 **Preserved state** for incremental changes
- 🔀 **Separate workflows** for different change types

## 🧪 **Testing Your Setup**

### Test Package-Triggered Deployment:
```bash
# 1. Update a dependency
npm update react

# 2. Commit the changes
git add package.json package-lock.json
git commit -m "chore: update React"
git push origin main

# 3. Check GitHub Actions tab for "Build and Deploy (Package Changes)"
```

### Test Content-Triggered Deployment:
```bash
# 1. Update content or source code
echo "# New content" > public/content/test.md

# 2. Commit the changes
git add .
git commit -m "docs: add new content"
git push origin main

# 3. Check GitHub Actions tab for "Deploy on Content Changes"
```

## 🔧 **Customization**

### Modify Trigger Paths:
Edit `.github/workflows/deploy.yml`:
```yaml
on:
  push:
    paths:
      - 'package.json'
      - 'package-lock.json'
      - 'your-custom-config.json'  # Add custom triggers
```

### Add More Environments:
```yaml
deploy-staging:
  if: github.ref == 'refs/heads/develop' && needs.check-changes.outputs.package-changed == 'true'
```

## 📞 **Troubleshooting**

### Workflow Not Triggering:
1. Check that you're pushing to `main` or `master` branch
2. Verify the file paths match exactly (`package.json`, not `Package.json`)
3. Ensure GitHub Actions are enabled in repository settings

### Both Workflows Triggering:
- This is normal if you change both package.json AND content files
- The workflows run independently and won't conflict

### Force a Package Deployment:
```bash
# Use manual workflow dispatch
# Go to Actions → "Build and Deploy (Package Changes)" → "Run workflow"
```

---

Your deployment system now intelligently handles different types of changes with appropriate deployment strategies! 🎉
