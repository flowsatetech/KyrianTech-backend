/** DISCORD WILL BE USED AS THE PRIMARY LOG SERVICE */

const sendAlert = async (type, level, message) => {
    const colors = {
        INFO: 3066993,
        WARN: 16776960,
        ERROR: 16711680
    };

    const payload = {
        username: "Shoe Store Monitor",
        embeds: [{
            title: `${level}: ${type}`,
            description: typeof message === 'object' ? JSON.stringify(message, null, 2) : message,
            color: colors[level] || 3447003,
            fields: [
                { name: "Category", value: type, inline: true },
                { name: "Severity", value: level, inline: true }
            ],
            timestamp: new Date()
        }]
    };

    try {
        await fetch(process.env.DISCORD_WEBHOOK_URI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("Critical: Could not send log to Discord", err);
    }
};

module.exports = { sendAlert };