# 🚀 Production Deployment Guide

This guide will walk you through deploying DocNet to production on Netlify with all services configured.

## 📋 Prerequisites

- [GitHub](https://github.com) account
- [Netlify](https://netlify.com) account
- [OpenAI](https://openai.com) API key
- [Google Gemini](https://ai.google.dev/) API key (optional)
- [Supabase](https://supabase.com) account (optional)

## 🔧 Step 1: Prepare Your Repository

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Production ready deployment"
   git push origin main
   ```

2. **Verify your repository structure**
   ```
   vortex-space/
   ├── client/                 # React frontend
   ├── server/                 # Express backend
   ├── netlify/               # Netlify functions
   │   └── functions/
   │       └── api.ts         # Main API function
   ├── netlify.toml           # Netlify configuration
   ├── package.json           # Dependencies
   └── env.example            # Environment template
   ```

## 🌐 Step 2: Deploy to Netlify

### Option A: Deploy via Netlify Dashboard (Recommended)

1. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Choose "GitHub" and authorize
   - Select your repository

2. **Configure build settings**
   - **Build command**: `npm run build:netlify`
   - **Publish directory**: `dist/spa`
   - **Functions directory**: `netlify/functions`

3. **Set environment variables**
   - Go to Site settings → Environment variables
   - Add the following variables:

   ```env
   # Required
   OPENAI_API_KEY=sk-your-openai-api-key-here
   
   # Optional but recommended
   GEMINI_API_KEY=your-gemini-api-key-here
   NODE_ENV=production
   
   # Optional - Supabase (if using)
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```

4. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete (5-10 minutes)

### Option B: Deploy via Netlify CLI

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login and deploy**
   ```bash
   netlify login
   netlify init
   netlify deploy --prod
   ```

## 🔑 Step 3: Configure API Keys

### OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add to Netlify environment variables as `OPENAI_API_KEY`

### Google Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add to Netlify environment variables as `GEMINI_API_KEY`

### Supabase (Optional)
1. Go to [Supabase](https://supabase.com)
2. Create a new project
3. Get your project URL and anon key
4. Add to Netlify environment variables

## 🧪 Step 4: Test Your Deployment

1. **Visit your Netlify URL**
   - Your site will be available at `https://your-site-name.netlify.app`

2. **Test basic functionality**
   - Upload a document
   - Start a chat conversation
   - Switch between AI providers
   - Test web search functionality

3. **Check function logs**
   - Go to Netlify dashboard → Functions
   - Check for any errors in the logs

## 🔧 Step 5: Custom Domain (Optional)

1. **Add custom domain**
   - Go to Site settings → Domain management
   - Click "Add custom domain"
   - Follow the DNS configuration instructions

2. **Configure SSL**
   - Netlify automatically provides SSL certificates
   - No additional configuration needed

## 📊 Step 6: Monitor and Optimize

### Performance Monitoring
- **Netlify Analytics**: Built-in performance monitoring
- **Function Logs**: Monitor API function performance
- **Error Tracking**: Check for any deployment issues

### Optimization Tips
1. **Enable caching**
   - Static assets are automatically cached
   - API responses are cached based on headers

2. **Monitor function usage**
   - Netlify functions have execution limits
   - Monitor usage in the dashboard

3. **Set up alerts**
   - Configure notifications for build failures
   - Monitor function execution times

## 🛡️ Step 6: Security Configuration

### Environment Variables Security
- ✅ API keys are stored securely in Netlify
- ✅ No sensitive data in client-side code
- ✅ CORS properly configured

### Content Security Policy
- ✅ CSP headers configured in `netlify.toml`
- ✅ External API calls allowed
- ✅ Inline scripts restricted

### Rate Limiting
- ✅ Built-in rate limiting on functions
- ✅ Request validation implemented

## 🔄 Step 7: Continuous Deployment

### Automatic Deployments
- Every push to `main` branch triggers deployment
- Preview deployments for pull requests
- Automatic rollback on build failures

### Deployment Workflow
1. **Development**: Work on feature branches
2. **Testing**: Create pull requests for testing
3. **Deployment**: Merge to main for production

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   npm run build:netlify
   
   # Verify dependencies
   npm install
   ```

2. **Function Errors**
   - Check Netlify function logs
   - Verify environment variables
   - Test API endpoints locally

3. **CORS Issues**
   - Verify CORS headers in `netlify.toml`
   - Check function response headers

4. **API Key Issues**
   - Verify API keys are set correctly
   - Check API key permissions
   - Test API calls manually

### Debug Commands
```bash
# Test build locally
npm run build:netlify

# Test functions locally
netlify dev

# Check environment variables
netlify env:list

# View function logs
netlify functions:list
```

## 📈 Performance Optimization

### Frontend Optimization
- ✅ Code splitting implemented
- ✅ Lazy loading for components
- ✅ Optimized bundle size

### Backend Optimization
- ✅ Efficient API responses
- ✅ Proper error handling
- ✅ Request validation

### Caching Strategy
- ✅ Static assets cached
- ✅ API responses cached
- ✅ Browser caching enabled

## 🔍 Monitoring and Analytics

### Netlify Analytics
- Page views and performance
- Function execution metrics
- Error tracking

### Custom Monitoring
- API response times
- User interaction tracking
- Error rate monitoring

## 🎉 Success!

Your DocNet application is now deployed to production! 

### Next Steps
1. **Test all features** thoroughly
2. **Monitor performance** and usage
3. **Set up alerts** for any issues
4. **Optimize** based on usage patterns
5. **Scale** as needed

### Support
- Check [Netlify Docs](https://docs.netlify.com)
- Review [Function Logs](https://docs.netlify.com/functions/logs)
- Monitor [Performance](https://docs.netlify.com/analytics)

---

**Your production URL**: `https://your-site-name.netlify.app`

**Status**: ✅ Deployed and Ready!
