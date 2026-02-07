# 🚀 Deployment Guide for VideoMeet

This guide will walk you through deploying VideoMeet to Railway with automatic GitHub integration.

## Prerequisites

- GitHub account with this repository pushed
- Railway account (sign up at [railway.app](https://railway.app))
- Node.js 18+ (for local testing)

## Step 1: Prepare Your GitHub Repository

### 1.1 Initialize Git (if not already done)
```bash
cd c:\Users\gueva\OneDrive\Documents\caps
git init
git add .
git commit -m "Initial commit: VideoMeet video conferencing app"
```

### 1.2 Create Repository on GitHub
1. Go to [github.com/new](https://github.com/new)
2. Name: `videomeet` (or your preferred name)
3. Description: "Production-ready video conferencing app with WebRTC"
4. Choose Public or Private
5. Click "Create repository"

### 1.3 Push to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/videomeet.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Railway

### 2.1 Connect to Railway
1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Click **"GitHub"** to connect your account
5. Authorize Railway to access your repositories
6. Select the **`videomeet`** repository
7. Click **"Deploy Now"**

Railway will automatically:
- Detect package.json (Node.js project)
- Install dependencies
- Start the application
- Assign a unique URL

### 2.2 View Your Deployment

After deployment completes:
1. Go to your Railway project
2. Click on the service/deployment
3. Your app URL appears at the top: `https://your-app.up.railway.app`
4. Click the URL to open your app

## Step 3: Verify Deployment

Once deployed, test these features:

### Landing Page
- [ ] "Start New Meeting" button works
- [ ] "Join Meeting" input accepts links
- [ ] Page loads without errors

### Create & Join Meeting
- [ ] Can create a new meeting
- [ ] Camera/microphone selection works
- [ ] Can see video preview
- [ ] Join meeting succeeds

### Video Conferencing
- [ ] Camera on/off works
- [ ] Microphone mute/unmute works
- [ ] Video grid displays correctly
- [ ] Can toggle chat panel

### Chat
- [ ] Send messages works
- [ ] Receive messages works
- [ ] Messages display with username and time
- [ ] No duplicate messages

### Meeting Link
- [ ] "Copy link" button works
- [ ] Copied link is valid
- [ ] Can join using copied link

## Step 4: Auto-Deploy Setup

Railway automatically deploys on every push to main branch:

### Enable Auto-Deploy
1. In Railway dashboard, go to "Settings"
2. Look for "Deployments"
3. Ensure "Auto-Deploy on Push" is enabled (default)

### Making Changes
When you update your code:
```bash
git add .
git commit -m "Fix: [describe change]"
git push origin main
```

Railway will automatically detect the push and:
1. Fetch the latest code
2. Install dependencies
3. Run npm start
4. Deploy the new version

You can monitor the deployment in Railway's live logs.

## Step 5: Environment Variables (Optional)

If you need to set environment variables:

1. In Railway dashboard, click on your project
2. Go to the **Variables** tab
3. Add variables:
   - `PORT` - Already set by Railway to a random port
   - `NODE_ENV` - Set to `production`
   - Any other custom variables

Variables in your code:
```javascript
const port = process.env.PORT || 3000;
const nodeEnv = process.env.NODE_ENV || 'development';
```

## Step 6: Monitoring & Logs

### View Live Logs
1. In Railway dashboard, select your project
2. Click the **"Logs"** tab
3. See real-time server output

### Common Log Messages
```
🚀 Server running on http://localhost:3000
📡 WebSocket ready for connections
User connected: socket_id
User joined meeting: ROOM_ID
```

### Troubleshooting Logs
- **Connection errors**: Check network configuration
- **Media errors**: Check browser console (not server logs)
- **Socket.IO errors**: Verify browser WebRTC support

## Step 7: Share Your Live URL

Your deployment URL format:
```
https://YOUR-PROJECT-NAME.up.railway.app
```

Share this URL with others to join your video conferencing app!

### Custom Domain (Optional)
1. In Railway, go to your project settings
2. Look for "Custom Domain"
3. Add your own domain (requires DNS configuration)

## Production Checklist

- [ ] HTTPS working (Railway provides this automatically)
- [ ] WebSockets working (wss:// secure websockets)
- [ ] Camera/microphone access working
- [ ] Multiple users can connect
- [ ] Chat is real-time
- [ ] No console errors in browser
- [ ] Responsive on mobile
- [ ] LiveLink is shared and tested

## Troubleshooting

### App Won't Start
**Error**: "npm: command not found"
- Solution: Railway uses Node.js from package.json

**Error**: "Cannot find module"
- Solution: Delete `node_modules/`, run `npm install` locally, then push

### Connection Issues
**Problem**: "Cannot connect to server"
- Check if Railway service is running in dashboard
- Check live logs for errors
- Verify CORS settings in server.js

**Problem**: "WebSocket connection failed"
- Railway supports WebSockets by default
- Check browser console for client-side errors
- Verify Socket.IO is properly initialized

### Camera/Microphone Issues
**Problem**: "Permission denied"
- This is browser-level, not server issue
- User must allow media access
- Requires HTTPS (which Railway provides)

**Problem**: "No devices found"
- User needs to connect camera/microphone
- Check local system settings

### Video Quality Issues
**Problem**: "Laggy video or audio"
- Check internet connection bandwidth
- Close other applications
- Try switching camera/mic devices

## Useful Railway Commands

### View App URL
Railway dashboard shows URL automatically

### View Environment Variables
```
Railway Dashboard > Variables tab
```

### Redeploy
```
Recent Deployments > Click deploy > Redeploy
```

### View Build Logs
```
Deployments tab > Click specific deployment > View logs
```

## Scaling (Advanced)

For more users, Railway allows:
- Vertical scaling: Increase instance size
- Multiple instances: Add more replicas
- Database support: Add PostgreSQL/MongoDB

Contact Railway support for enterprise features.

## Cost

Railway offers:
- **Free tier**: $5/month usage credits
- **Pay-as-you-go**: $0.50 per $1 after credits
- This app typically uses <$5/month on free tier

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Share the live URL with team
3. ✅ Gather feedback
4. ✅ Iterate and improve
5. ✅ Consider database for meeting history (optional)

## Resources

- [Railway Documentation](https://docs.railway.app)
- [Node.js on Railway](https://docs.railway.app/getting-started)
- [Environment Variables](https://docs.railway.app/guides/variables)
- [Custom Domains](https://docs.railway.app/guides/custom-domain)

## Support

For issues:
1. Check Railway logs
2. Check browser console
3. Review this guide
4. Contact Railway support via their docs

---

**Your VideoMeet app is now live on Railway!** 🎉

Share your deployment URL: `https://your-app.up.railway.app`
