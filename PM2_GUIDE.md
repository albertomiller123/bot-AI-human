# PM2 Process Management Guide

## Cài đặt PM2

```bash
npm install -g pm2
```

## Chạy bot với PM2

```bash
# Start bot
pm2 start index.js --name "minecraft-bot"

# Hoặc với npm
pm2 start npm --name "minecraft-bot" -- start
```

## Các lệnh hữu ích

```bash
# Xem status
pm2 status

# Xem logs real-time
pm2 logs minecraft-bot

# Restart bot
pm2 restart minecraft-bot

# Stop bot
pm2 stop minecraft-bot

# Delete from PM2
pm2 delete minecraft-bot
```

## Auto-start khi reboot

```bash
pm2 startup      # Tạo startup script
pm2 save         # Lưu danh sách process
```

## Monitoring

```bash
pm2 monit        # Terminal-based monitoring
```

## ecosystem.config.js (Optional)

Tạo file này để config chi tiết:

```javascript
module.exports = {
  apps: [{
    name: 'minecraft-bot',
    script: 'index.js',
    cwd: 'd:/AI',
    env: {
      NODE_ENV: 'production'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
```

Sau đó chạy: `pm2 start ecosystem.config.js`
