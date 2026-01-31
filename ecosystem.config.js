module.exports = {
    apps: [{
        name: 'mc-bot-v2',
        script: 'index.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'development',
            BOT_USERNAME: 'Antigravity_Dev'
        },
        env_production: {
            NODE_ENV: 'production',
            BOT_USERNAME: 'Antigravity_Pro'
        },
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        time: true
    }]
};
