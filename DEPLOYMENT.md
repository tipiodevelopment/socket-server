# Deployment Guide

## Understanding Deployment Options

This application uses **WebSocket connections** for real-time event broadcasting. Understanding the deployment options is crucial for optimal performance and cost management.

### 🚀 Deployment Types

#### 1. **Autoscale Deployments** (Default)
- **Best for:** Web apps and APIs with unpredictable traffic patterns
- **Pricing:** Pay only when serving requests (Compute Units based on CPU + RAM usage)
- **Scaling:** Automatically scales based on demand
- **Idle behavior:** Goes idle after **15 minutes** of inactivity

⚠️ **WebSocket Limitation:**
- WebSocket connections are billed as **active requests** for their entire duration
- The application goes idle after 15 minutes of inactivity
- **Not recommended** for applications requiring persistent, long-running WebSocket connections
- Suitable only for short-lived WebSocket connections or event-driven communication

#### 2. **Reserved VM Deployments** (Recommended for Production)
- **Best for:** Applications requiring persistent, long-running connections
- **Pricing:** Predictable monthly cost for dedicated resources
- **Uptime:** 99.9% guaranteed uptime
- **Resources:** Dedicated VM that runs continuously
- **No idle timeout** - Perfect for persistent WebSocket connections

✅ **Recommended for this application** because it maintains multiple campaign-specific WebSocket channels for real-time broadcasting.

### 📊 Cost Considerations

#### Autoscale Deployment
```
✓ No cost when idle
✓ Cost-effective for low traffic
✗ WebSocket connections billed for entire duration
✗ Can become expensive with many concurrent connections
✗ Unreliable for persistent connections (15-minute timeout)
```

#### Reserved VM Deployment
```
✓ Predictable monthly cost
✓ Unlimited WebSocket connections (within VM resources)
✓ No idle timeout
✓ 99.9% uptime guarantee
✗ Fixed monthly cost regardless of usage
```

### 🛠️ Application Optimizations

To minimize issues with Autoscale deployments, this application includes:

1. **WebSocket Heartbeat** - Ping-pong every 30 seconds to keep connections alive
2. **Client-Side Retry Logic** - Exponential backoff with max 5 retries (2s → 4s → 8s → 16s → 30s)
3. **Graceful Error Handling** - Stops retry attempts after limit to prevent infinite loops
4. **Campaign-Specific Channels** - Isolated WebSocket rooms per campaign for efficient broadcasting

### 📝 Environment Variables

Required for deployment:

```bash
DATABASE_URL=<your_postgres_connection_string>
SESSION_SECRET=<random_secret_for_sessions>
PORT=5000  # Managed by Replit
```

Optional:
```bash
SCHEDULER_INTERVAL_MINUTES=1  # Component scheduler interval (default: 1 minute)
```

### 🚀 Deployment Steps

1. **Configure Environment Variables**
   - Ensure `DATABASE_URL` and other required secrets are set in deployment settings
   - These are automatically configured when using Replit's built-in PostgreSQL

2. **Choose Deployment Type**
   - For **testing/development**: Use Autoscale (default)
   - For **production**: Use Reserved VM for reliable WebSocket performance

3. **Deploy**
   - Click the "Deploy" button in Replit
   - Wait for build and initialization to complete
   - Check deployment logs for any errors

### 🔍 Troubleshooting

#### "Insufficient resources" WebSocket errors
- **Cause:** Too many concurrent connections on Autoscale
- **Solution:** Switch to Reserved VM deployment

#### Application fails to start
- **Check:** All required environment variables are set
- **Check:** Database connection is working
- **Review:** Deployment logs for specific error messages

#### Connections dropping after 15 minutes
- **Cause:** Autoscale idle timeout
- **Solution:** Switch to Reserved VM deployment

### 📚 Additional Resources

- [Replit Deployments Documentation](https://docs.replit.com/category/deployments)
- [Autoscale vs Reserved VM Comparison](https://replit.com/pricing)
- [Resource Usage Monitoring](https://replit.com/account#resource-usage)

---

## Recommendation

**For production use with real-time event broadcasting to iOS apps:**
- ✅ Use **Reserved VM Deployment**
- ✅ Ensures 99.9% uptime
- ✅ No WebSocket connection issues
- ✅ Predictable costs
- ✅ Better user experience
