# Deployment Guide

This guide will walk you through deploying your Library Catalog System using **Vercel** (free hosting) and **Supabase** (free PostgreSQL database).

## Prerequisites

- GitHub account (you already have this!)
- Email address for creating accounts

## Step 1: Set Up Supabase Database (5 minutes)

### 1.1 Create Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub (recommended)

### 1.2 Create a New Project

1. Click "New Project"
2. Fill in the details:
   - **Name**: Library Catalog (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free
3. Click "Create new project"
4. Wait 2-3 minutes for the database to initialize

### 1.3 Run Database Schema

1. In your Supabase project, click "SQL Editor" in the left sidebar
2. Open the `DATABASE_SCHEMA.md` file from this repository
3. Copy the SQL code from each section
4. Paste into the SQL Editor
5. Click "Run" for each section
6. Verify tables were created in "Table Editor"

### 1.4 Get Your Supabase Credentials

1. Click "Settings" (gear icon) in the left sidebar
2. Click "API" under Configuration
3. You'll need these values:
   - **Project URL** (under "Project URL")
   - **Anon public key** (under "Project API keys" → "anon public")

**Keep these safe! You'll need them in Step 3.**

---

## Step 2: Set Up Vercel Hosting (3 minutes)

### 2.1 Create Vercel Account

1. Go to [https://vercel.com](https://vercel.com)
2. Click "Sign Up"
3. Sign up with GitHub (recommended)
4. Authorize Vercel to access your GitHub repositories

### 2.2 Import Your Repository

1. Click "Add New..." → "Project"
2. Find your `ILS` repository
3. Click "Import"

### 2.3 Configure Build Settings

Vercel should auto-detect SvelteKit. Verify these settings:

- **Framework Preset**: SvelteKit
- **Build Command**: `npm run build`
- **Output Directory**: `.svelte-kit` (auto-detected)
- **Install Command**: `npm install`

---

## Step 3: Set Environment Variables (2 minutes)

Before deploying, you need to add your Supabase credentials:

1. In the Vercel import page, scroll down to "Environment Variables"
2. Add these three variables:

| Name                           | Value                                   |
| ------------------------------ | --------------------------------------- |
| `PUBLIC_SUPABASE_URL`          | Your Supabase Project URL from Step 1.4 |
| `PUBLIC_SUPABASE_ANON_KEY`     | Your Supabase Anon Key from Step 1.4   |
| `SUPABASE_SERVICE_ROLE_KEY`    | (Optional for now)                      |

3. Click "Add" after each variable

---

## Step 4: Deploy! (1 minute)

1. Click "Deploy"
2. Wait 2-3 minutes for the build to complete
3. You'll see "Congratulations!" when it's done
4. Click "Visit" to see your live site!

---

## Step 5: Create Your First Admin User (2 minutes)

1. Go to your Supabase project
2. Click "Authentication" in the left sidebar
3. Click "Add user" → "Create new user"
4. Enter:
   - **Email**: Your admin email
   - **Password**: Create a secure password
   - **Auto Confirm**: ✅ Yes
5. Click "Create user"

---

## Step 6: Test Your Deployment

### Test Public Catalog

1. Go to your deployed URL
2. Click "Public Catalog (OPAC)"
3. You should see the search page

### Test Admin Panel

1. Go to your deployed URL
2. Click "Admin Panel"
3. Log in with the credentials from Step 5
4. You should see the admin dashboard

### Add Your First Record

1. In admin panel, click "ISBN Lookup"
2. Try an ISBN, for example: `9780062316097` (Sapiens by Yuval Noah Harari)
3. Click "Search"
4. Click "Import to Catalog"
5. Check the public catalog to see your first record!

---

## Troubleshooting

### "Could not connect to database"

- Verify your environment variables in Vercel are correct
- Check that you copied the full URL and key (no extra spaces)
- Redeploy: Vercel Dashboard → Deployments → ... menu → Redeploy

### "Authentication error"

- Make sure you created a user in Supabase Authentication
- Check that you clicked "Auto Confirm" when creating the user
- Verify the email and password are correct

### "Table does not exist"

- Go to Supabase SQL Editor
- Re-run the database schema from `DATABASE_SCHEMA.md`
- Make sure all SQL sections completed without errors

### Build failed

- Check the build logs in Vercel
- Most issues are from missing environment variables
- Redeploy after adding missing variables

---

## Next Steps

### Customize Your Catalog

1. Add records using ISBN lookup or manual entry
2. Add holdings (locations, copies) to your records
3. Set up serials for journals and newsletters
4. Invite colleagues to create admin accounts

### Optional Enhancements

1. **Custom Domain**: Add your own domain in Vercel → Settings → Domains
2. **Email**: Configure SMTP in Supabase for password reset emails
3. **Backups**: Supabase free tier includes daily backups
4. **Analytics**: Add Vercel Analytics (free tier available)

### Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [MARC 21 Format](https://www.loc.gov/marc/bibliographic/)

---

## Updating Your Deployment

Whenever you push changes to your GitHub repository:

1. Vercel automatically detects the changes
2. Builds and deploys the new version
3. Your site updates in ~2 minutes

No manual redeployment needed!

---

## Cost Summary

- **Vercel Free Tier**:
  - 100GB bandwidth/month
  - Unlimited projects
  - Automatic SSL
  - Custom domains

- **Supabase Free Tier**:
  - 500MB database storage
  - 50,000 monthly active users
  - 2GB file storage
  - Daily backups

**Total Monthly Cost: $0**

For most small-to-medium libraries, you'll never need to upgrade!

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the build logs in Vercel
3. Check the database logs in Supabase
4. Consult the SvelteKit and Supabase documentation

Happy cataloging! 📚
