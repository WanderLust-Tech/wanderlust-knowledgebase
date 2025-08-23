#!/usr/bin/env node

const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class DeploymentManager {
  constructor() {
    this.client = new ftp.Client();
    this.client.ftp.verbose = true;
    
    // Configuration from environment variables
    this.config = {
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      port: process.env.FTP_PORT || 21,
      secure: process.env.FTP_SECURE === 'true',
      remotePath: process.env.FTP_REMOTE_PATH || '/',
      localPath: process.env.LOCAL_BUILD_PATH || './dist'
    };
    
    // Check if this deployment was triggered by package.json changes
    this.packageChanged = this.checkPackageChanges();
    
    // Validate required configuration
    this.validateConfig();
  }
  
  checkPackageChanges() {
    // Check if running in GitHub Actions and if package.json was changed
    if (process.env.GITHUB_ACTIONS) {
      const eventPath = process.env.GITHUB_EVENT_PATH;
      if (eventPath && fs.existsSync(eventPath)) {
        try {
          const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
          const changedFiles = event.commits?.flatMap(commit => 
            [...(commit.added || []), ...(commit.modified || []), ...(commit.removed || [])]
          ) || [];
          
          return changedFiles.some(file => 
            file === 'package.json' || file === 'package-lock.json'
          );
        } catch (error) {
          console.log('ℹ️  Could not detect package changes from GitHub event');
        }
      }
    }
    
    // Check if package.json was recently modified (local deployment)
    try {
      const packageStat = fs.statSync('package.json');
      const timeDiff = Date.now() - packageStat.mtime.getTime();
      const oneHour = 60 * 60 * 1000;
      
      return timeDiff < oneHour; // Changed within last hour
    } catch (error) {
      return false;
    }
  }
  
  validateConfig() {
    const required = ['host', 'user', 'password'];
    const missing = required.filter(key => !this.config[key]);
    
    if (missing.length > 0) {
      console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
      console.error('Please check your .env file or environment variables.');
      process.exit(1);
    }
    
    if (!fs.existsSync(this.config.localPath)) {
      console.error(`❌ Build directory not found: ${this.config.localPath}`);
      console.error('Please run "npm run build" first.');
      process.exit(1);
    }
  }
  
  async connect() {
    try {
      console.log(`🔌 Connecting to ${this.config.host}...`);
      await this.client.access({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        port: this.config.port,
        secure: this.config.secure
      });
      console.log('✅ Connected successfully!');
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      throw error;
    }
  }
  
  async uploadDirectory(localDir, remoteDir) {
    try {
      console.log(`📁 Creating remote directory: ${remoteDir}`);
      await this.client.ensureDir(remoteDir);
      
      console.log(`📤 Uploading ${localDir} to ${remoteDir}...`);
      await this.client.uploadFromDir(localDir, remoteDir);
      console.log('✅ Upload completed successfully!');
    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      throw error;
    }
  }
  
  async clearRemoteDirectory(remoteDir) {
    try {
      console.log(`🗑️  Clearing remote directory: ${remoteDir}`);
      await this.client.clearWorkingDir();
      
      // Change to remote directory and clear it
      try {
        await this.client.cd(remoteDir);
        await this.client.clearWorkingDir();
        console.log('✅ Remote directory cleared!');
      } catch (error) {
        console.log('ℹ️  Remote directory doesn\'t exist or is already empty');
      }
    } catch (error) {
      console.error('⚠️  Could not clear remote directory:', error.message);
      // Don't throw - this is not critical
    }
  }
  
  async deploy() {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting deployment...');
      
      // Show deployment trigger info
      if (this.packageChanged) {
        console.log('📦 Deployment triggered by package.json changes');
        console.log('🔄 This may include dependency updates or version changes');
      } else {
        console.log('🌐 Regular content deployment');
      }
      
      console.log(`📦 Local path: ${this.config.localPath}`);
      console.log(`🌐 Remote path: ${this.config.remotePath}`);
      
      await this.connect();
      
      // For package changes, always clear remote directory to ensure clean deployment
      if (this.packageChanged || process.env.CLEAR_REMOTE === 'true') {
        await this.clearRemoteDirectory(this.config.remotePath);
      }
      
      await this.uploadDirectory(this.config.localPath, this.config.remotePath);
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`🎉 Deployment completed successfully in ${duration}s!`);
      
      if (this.packageChanged) {
        console.log('📦 Package-triggered deployment complete - dependencies updated on server');
      }
      
    } catch (error) {
      console.error('💥 Deployment failed:', error.message);
      process.exit(1);
    } finally {
      this.client.close();
    }
  }
  
  async backup() {
    try {
      const backupDir = `./backups/${new Date().toISOString().split('T')[0]}`;
      
      if (!fs.existsSync('./backups')) {
        fs.mkdirSync('./backups');
      }
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
      }
      
      console.log(`💾 Creating backup in ${backupDir}...`);
      await this.connect();
      await this.client.downloadToDir(backupDir, this.config.remotePath);
      console.log('✅ Backup completed successfully!');
      
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      throw error;
    } finally {
      this.client.close();
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'deploy';
  
  const deployment = new DeploymentManager();
  
  switch (command) {
    case 'deploy':
      await deployment.deploy();
      break;
      
    case 'backup':
      await deployment.backup();
      break;
      
    case 'test-connection':
      try {
        await deployment.connect();
        console.log('✅ Connection test successful!');
        deployment.client.close();
      } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        process.exit(1);
      }
      break;
      
    default:
      console.log(`
🚀 Wanderlust Knowledge Base Deployment Tool

Usage:
  npm run deploy              Deploy built files to FTP server
  npm run deploy:backup       Download current remote files as backup
  npm run deploy:test         Test FTP connection
  
Environment Variables (add to .env file):
  FTP_HOST=your-ftp-host.com
  FTP_USER=your-username
  FTP_PASSWORD=your-password
  FTP_PORT=21 (optional, default: 21)
  FTP_SECURE=false (optional, set to 'true' for FTPS)
  FTP_REMOTE_PATH=/ (optional, default: /)
  LOCAL_BUILD_PATH=./dist (optional, default: ./dist)
  CLEAR_REMOTE=false (optional, set to 'true' to clear remote directory first)
      `);
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DeploymentManager;
