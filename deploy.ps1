# DocNet AI Research Assistant - Auto Deploy Script
# This script will build and deploy your changes to Netlify

Write-Host "🚀 Starting deployment to Netlify..." -ForegroundColor Green

# Step 1: Build the project
Write-Host "📦 Building project..." -ForegroundColor Yellow
npm run build:netlify

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully!" -ForegroundColor Green

# Step 2: Deploy to Netlify
Write-Host "🌐 Deploying to Netlify..." -ForegroundColor Yellow
netlify deploy --prod --dir=dist/spa

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌍 Your site is live at: https://karmic-aiportal.netlify.app/" -ForegroundColor Cyan
