# Supabase Integration Setup Guide

This guide will help you integrate Supabase with your AI Research Portal for authentication and file storage.

## Prerequisites

1. A Supabase account (sign up at [supabase.com](https://supabase.com))
2. Node.js and npm/pnpm installed
3. Your AI Research Portal project

## Step 1: Install Supabase Dependencies

```bash
npm install @supabase/supabase-js
# or
pnpm add @supabase/supabase-js
```

## Step 2: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `ai-research-portal`
   - **Database Password**: Choose a strong password
   - **Region**: Select the closest region to your users
5. Click "Create new project"
6. Wait for the project to be set up (usually 2-3 minutes)

## Step 3: Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://your-project-id.supabase.co`)
   - **Anon public key** (starts with `eyJ...`)

## Step 4: Configure Environment Variables

Create a `.env` file in your project root:

```env
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important**: Never commit your `.env` file to version control. Add it to `.gitignore`.

## Step 5: Set Up Database Tables

In your Supabase dashboard, go to **SQL Editor** and run the following SQL:

### Create Files Table

```sql
-- Create files table for storing file metadata
CREATE TABLE files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  size BIGINT NOT NULL,
  type VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  processed BOOLEAN DEFAULT FALSE,
  content TEXT,
  summary TEXT
);

-- Enable Row Level Security
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own files
CREATE POLICY "Users can view own files" ON files
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own files
CREATE POLICY "Users can insert own files" ON files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own files
CREATE POLICY "Users can update own files" ON files
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own files
CREATE POLICY "Users can delete own files" ON files
  FOR DELETE USING (auth.uid() = user_id);
```

### Create User Profiles Table (Optional)

```sql
-- Create user profiles table for additional user information
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Create policy to allow users to update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create policy to allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

## Step 6: Set Up Storage Bucket

1. In your Supabase dashboard, go to **Storage**
2. Click "Create a new bucket"
3. Enter bucket details:
   - **Name**: `documents`
   - **Public bucket**: ✅ Check this if you want files to be publicly accessible
   - **File size limit**: `50MB` (adjust as needed)
   - **Allowed MIME types**: `application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document`

4. Click "Create bucket"

5. Set up storage policies. Go to **Storage** → **Policies** and add:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files" ON storage.objects
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'documents');

-- Allow users to view their own files
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'documents');

-- Allow users to update their own files
CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'documents');

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'documents');
```

## Step 7: Update Supabase Service

Replace the mock implementation in `client/services/supabase.ts` with actual Supabase calls:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Update AuthService methods
export class AuthService {
  static async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    return {
      id: data.user.id,
      email: data.user.email!,
    };
  }

  static async signUp(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    
    return {
      id: data.user!.id,
      email: data.user!.email!,
    };
  }

  static async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  static async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email!,
    };
  }
}

// Update FileService methods
export class FileService {
  static async uploadFile(file: File, userId: string): Promise<FileUploadResponse> {
    try {
      const fileName = `${userId}/${Date.now()}-${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);
      
      // Store file metadata in database
      const { error: dbError } = await supabase
        .from('files')
        .insert([{
          name: file.name,
          size: file.size,
          type: file.type,
          url: publicUrl,
          user_id: userId,
        }]);
      
      if (dbError) throw dbError;
      
      return {
        success: true,
        fileUrl: publicUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  static async getUserFiles(userId: string): Promise<FileMetadata[]> {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      // Get file info first
      const { data: file } = await supabase
        .from('files')
        .select('name')
        .eq('id', fileId)
        .eq('user_id', userId)
        .single();
      
      if (!file) return false;
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([`${userId}/${file.name}`]);
      
      if (storageError) throw storageError;
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', userId);
      
      if (dbError) throw dbError;
      
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }
}
```

## Step 8: Configure Authentication Settings

1. In your Supabase dashboard, go to **Authentication** → **Settings**
2. Configure the following:

### Site URL
- Set to your development URL: `http://localhost:8081`
- For production, set to your actual domain

### Redirect URLs
Add these redirect URLs:
- `http://localhost:8081/signin`
- `http://localhost:8081/`
- `https://your-domain.com/signin`
- `https://your-domain.com/`

### Email Templates (Optional)
Customize email templates for:
- Confirm signup
- Reset password
- Magic link

## Step 9: Test the Integration

1. Start your development server:
```bash
npm run dev
```

2. Navigate to `http://localhost:8081/signin`
3. Try creating an account and signing in
4. Test file upload functionality

## Step 10: Production Deployment

### Environment Variables
Set these environment variables in your production environment:

```env
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

### Update Site URL
In Supabase dashboard:
1. Go to **Authentication** → **Settings**
2. Update **Site URL** to your production domain
3. Add your production domain to **Redirect URLs**

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure your domain is added to the allowed origins in Supabase
2. **Authentication Errors**: Check that your environment variables are correctly set
3. **File Upload Failures**: Verify storage bucket policies and file size limits
4. **Database Errors**: Ensure RLS policies are correctly configured

### Debug Mode

Enable debug mode in your Supabase client:

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    debug: true
  }
});
```

### Check Logs

Monitor your application in the Supabase dashboard:
- **Authentication** → **Logs** for auth issues
- **Storage** → **Logs** for file upload issues
- **Database** → **Logs** for database issues

## Security Best Practices

1. **Never expose your service role key** in client-side code
2. **Use Row Level Security (RLS)** for all tables
3. **Validate file types and sizes** on both client and server
4. **Implement proper error handling** for all Supabase operations
5. **Use environment variables** for all sensitive configuration
6. **Regularly rotate API keys** and monitor usage

## Next Steps

1. Implement real-time features using Supabase subscriptions
2. Add file processing with Supabase Edge Functions
3. Implement user roles and permissions
4. Add analytics and monitoring
5. Set up automated backups

## Support

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Community](https://github.com/supabase/supabase/discussions)
- [Supabase Discord](https://discord.supabase.com)
