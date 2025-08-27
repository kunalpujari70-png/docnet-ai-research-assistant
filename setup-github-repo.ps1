# DocNet AI Research Assistant - GitHub Repository Setup Script
# Run this script after installing Git and creating a GitHub repository

Write-Host "🚀 DocNet AI Research Assistant - GitHub Repository Setup" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Check if Git is installed
try {
    $gitVersion = git --version
    Write-Host "✅ Git is installed: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git is not installed. Please install Git first:" -ForegroundColor Red
    Write-Host "   Download from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "   Or run: winget install --id Git.Git -e --source winget" -ForegroundColor Yellow
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "`n📋 Repository Setup Steps:" -ForegroundColor Cyan
Write-Host "1. Create a new repository on GitHub" -ForegroundColor White
Write-Host "2. Copy the repository URL" -ForegroundColor White
Write-Host "3. Run the commands below" -ForegroundColor White

Write-Host "`n🔧 Commands to run (replace YOUR_USERNAME and REPO_NAME):" -ForegroundColor Yellow
Write-Host "git init" -ForegroundColor White
Write-Host "git add ." -ForegroundColor White
Write-Host "git commit -m 'Initial commit: DocNet AI Research Assistant'" -ForegroundColor White
Write-Host "git branch -M main" -ForegroundColor White
Write-Host "git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git" -ForegroundColor White
Write-Host "git push -u origin main" -ForegroundColor White

Write-Host "`n📝 Suggested repository names:" -ForegroundColor Cyan
Write-Host "- docnet-ai-research-assistant" -ForegroundColor White
Write-Host "- docnet-ai-assistant" -ForegroundColor White
Write-Host "- ai-research-assistant" -ForegroundColor White
Write-Host "- docnet-research-tool" -ForegroundColor White

Write-Host "`n🎯 Next steps after creating the repository:" -ForegroundColor Cyan
Write-Host "1. Update the README.md with your repository URL" -ForegroundColor White
Write-Host "2. Set up GitHub Pages (optional)" -ForegroundColor White
Write-Host "3. Configure branch protection rules" -ForegroundColor White
Write-Host "4. Set up GitHub Actions for CI/CD (optional)" -ForegroundColor White

Write-Host "`n✅ All files are ready for GitHub!" -ForegroundColor Green
Write-Host "📁 Files included:" -ForegroundColor Cyan
Write-Host "- README.md (comprehensive documentation)" -ForegroundColor White
Write-Host "- .gitignore (excludes node_modules, .env, etc.)" -ForegroundColor White
Write-Host "- LICENSE (MIT License)" -ForegroundColor White
Write-Host "- All source code and configuration files" -ForegroundColor White

Write-Host "`n🌐 Live Demo: https://karmic-aiportal.netlify.app" -ForegroundColor Green
