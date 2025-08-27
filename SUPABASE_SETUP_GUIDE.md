# 🔐 Supabase Authentication Setup Guide

## 🚀 **Step 1: Create Your Supabase Project**

1. **Go to your Supabase dashboard**: https://supabase.com/dashboard
2. **Click "New Project"**
3. **Fill in the details**:
   - **Organization**: Select your organization
   - **Project name**: `ai-research-portal` (or your preferred name)
   - **Database password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users
4. **Click "Create new project"**

## 🔑 **Step 2: Get Your Credentials**

Once your project is created:

1. **Go to Settings → API** in your Supabase dashboard
2. **Copy these values**:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## ⚙️ **Step 3: Create Environment File**

Create a `.env` file in your project root with these values:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Keep your existing API keys
OPENAI_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key
```

**Replace the placeholder values with your actual Supabase credentials!**

## 🔧 **Step 4: Configure Authentication Settings**

In your Supabase dashboard:

1. **Go to Authentication → Settings**
2. **Set Site URL**: `http://localhost:8081` (for development)
3. **Add Redirect URLs**: `http://localhost:8081/**`
4. **Email Templates**: Customize if needed (optional)
5. **Enable Email Confirmations**: Recommended for security

## 🔄 **Step 5: Switch to Real Authentication**

Once you have your credentials, I'll help you switch from mock to real authentication. The code is already prepared - we just need to:

1. Update the environment variables
2. Restart the development server
3. Test the real authentication flow

## 🧪 **Step 6: Test Your Setup**

1. **Restart your development server**: `npm run dev`
2. **Go to** `http://localhost:8081/signin`
3. **Try creating an account** with a real email
4. **Check your email** for confirmation link
5. **Sign in** and test the full flow

## 🔒 **Security Features You'll Get:**

- ✅ **Real user accounts** with email verification
- ✅ **Secure password hashing** (handled by Supabase)
- ✅ **JWT token management** (automatic)
- ✅ **Session persistence** across browser sessions
- ✅ **Row Level Security** (RLS) for data protection
- ✅ **Email confirmations** for account security

## 🎯 **Ready to Proceed?**

Once you have your Supabase project created and credentials copied, let me know and I'll help you:

1. **Update the environment variables**
2. **Switch from mock to real authentication**
3. **Test the complete authentication flow**
4. **Set up file storage** (next step)

---

**💡 Pro Tip**: Keep your `.env` file secure and never commit it to version control!
