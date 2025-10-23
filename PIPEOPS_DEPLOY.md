# PipeOps Deployment Guide

## Prerequisites
1. Install PipeOps CLI
2. Have a PipeOps account and be logged in
3. PostgreSQL database provisioned on PipeOps or external database

## Deployment Steps

1. Login to PipeOps:
```bash
pipeops login
```

2. Initialize the project:
```bash
pipeops init
```

3. Configure Environment Variables:
   - NODE_ENV=production
   - PORT=3000
   - DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/restaurantchatbot
   - PAYSTACK_SECRET_KEY=[your-secret-key]
   - PAYSTACK_PUBLIC_KEY=[your-public-key]
   - BASE_URL=[your-production-url]

4. Deploy the application:
```bash
pipeops deploy
```

## Database Migration

Before the first deployment, you need to run database migrations:

1. Create database:
```bash
pipeops db create restaurantchatbot
```

2. Initialize database (after deployment):
```bash
pipeops run "node initDb.js"
```

## Monitoring

1. View application logs:
```bash
pipeops logs
```

2. Check application status:
```bash
pipeops status
```

3. View metrics:
```bash
pipeops metrics
```

## Scaling

Configured in pipeops.yaml:
- Min instances: 1
- Max instances: 2
- Auto-scales based on CPU and Memory usage

## Rollback

If needed, rollback to previous version:
```bash
pipeops rollback
```

## SSL/Domain Configuration

1. Add custom domain:
```bash
pipeops domain add [your-domain]
```

2. SSL is automatically provisioned by PipeOps

## Troubleshooting

1. Check application health:
```bash
pipeops health
```

2. View error logs:
```bash
pipeops logs --error
```

3. Check resource usage:
```bash
pipeops resources
```