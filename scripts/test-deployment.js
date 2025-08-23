#!/usr/bin/env node

/**
 * Deployment Test Script
 * 
 * This script verifies that the deployment setup is correct
 * and all required dependencies are available.
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Running Deployment Setup Tests...\n');

let hasErrors = false;

// Test 1: Check if required files exist
const requiredFiles = [
  'scripts/deploy.js',
  '.env.example',
  '.github/workflows/deploy.yml',
  'DEPLOYMENT.md'
];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    hasErrors = true;
  }
});

// Test 2: Check if required dependencies are installed
console.log('\n📦 Checking dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = ['basic-ftp', 'dotenv', 'cross-env'];

requiredDeps.forEach(dep => {
  if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
    console.log(`✅ ${dep} (devDependencies)`);
  } else if (packageJson.dependencies && packageJson.dependencies[dep]) {
    console.log(`✅ ${dep} (dependencies)`);
  } else {
    console.log(`❌ ${dep} - NOT INSTALLED`);
    hasErrors = true;
  }
});

// Test 3: Check if deploy scripts are in package.json
console.log('\n🚀 Checking npm scripts...');
const requiredScripts = ['deploy', 'deploy:test', 'deploy:backup'];

requiredScripts.forEach(script => {
  if (packageJson.scripts && packageJson.scripts[script]) {
    console.log(`✅ npm run ${script}`);
  } else {
    console.log(`❌ npm run ${script} - MISSING`);
    hasErrors = true;
  }
});

// Test 4: Check if .env.example has required variables
console.log('\n🔧 Checking environment template...');
if (fs.existsSync('.env.example')) {
  const envExample = fs.readFileSync('.env.example', 'utf8');
  const requiredVars = ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD'];
  
  requiredVars.forEach(variable => {
    if (envExample.includes(variable)) {
      console.log(`✅ ${variable}`);
    } else {
      console.log(`❌ ${variable} - MISSING FROM .env.example`);
      hasErrors = true;
    }
  });
}

// Test 5: Check if build directory can be created
console.log('\n🏗️  Testing build process...');
try {
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
    console.log('✅ Build directory can be created');
    fs.rmdirSync('dist');
  } else {
    console.log('✅ Build directory already exists');
  }
} catch (error) {
  console.log('❌ Cannot create build directory:', error.message);
  hasErrors = true;
}

// Test 6: Validate GitHub Actions workflow
console.log('\n⚙️  Checking GitHub Actions workflow...');
if (fs.existsSync('.github/workflows/deploy.yml')) {
  const workflow = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');
  
  if (workflow.includes('basic-ftp')) {
    console.log('✅ GitHub Actions workflow includes FTP deployment');
  } else {
    console.log('❌ GitHub Actions workflow missing FTP deployment');
    hasErrors = true;
  }
  
  if (workflow.includes('secrets.PROD_FTP_HOST')) {
    console.log('✅ GitHub Actions workflow uses secrets correctly');
  } else {
    console.log('❌ GitHub Actions workflow missing secret references');
    hasErrors = true;
  }
}

// Final Results
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ TESTS FAILED - Please fix the issues above');
  console.log('\nTo fix missing dependencies, run:');
  console.log('npm install --save-dev basic-ftp dotenv cross-env');
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED - Deployment setup is ready!');
  console.log('\nNext steps:');
  console.log('1. Copy .env.example to .env');
  console.log('2. Fill in your FTP credentials in .env');
  console.log('3. Run "npm run deploy:test" to test connection');
  console.log('4. Run "npm run deploy" to deploy');
  console.log('\nFor GitHub Actions:');
  console.log('1. Add FTP credentials to GitHub Secrets');
  console.log('2. Push to main/master branch to trigger deployment');
}
console.log('='.repeat(50));
