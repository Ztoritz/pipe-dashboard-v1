const express = require('express');
const axios = require('axios');
const cors = require('cors');
const os = require('os');
const osUtils = require('os-utils');
require('dotenv').config({ path: '../.env' }); // Använd den gemensamma .env filen

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// Helper för att hämta CPU-användning
const getCpuUsage = () => {
    return new Promise((resolve) => {
        osUtils.cpuUsage((v) => {
            resolve((v * 100).toFixed(1));
        });
    });
};

// Säkert proxy-anrop till Coolify API
app.get('/api/status', async (req, res) => {
    try {
        const coolifyHeaders = {
            Authorization: `Bearer ${process.env.COOLIFY_API_TOKEN}`,
            Accept: 'application/json'
        };

        // 1. Hämta alla applikationer
        const appRes = await axios.get(`${process.env.COOLIFY_URL}/api/v1/applications`, { headers: coolifyHeaders });

        // 2. Hämta serverstatus
        const serverId = process.env.COOLIFY_SERVER_UUID || appRes.data[0]?.server_uuid;
        let serverInfo = null;

        if (serverId) {
            try {
                const serverRes = await axios.get(`${process.env.COOLIFY_URL}/api/v1/servers/${serverId}`, { headers: coolifyHeaders });
                serverInfo = serverRes.data;
            } catch (e) {
                console.error("Kunde inte hämta serverdetaljer:", e.message);
            }
        }

        // 3. Hämta lokala systemstats
        const cpu = await getCpuUsage();
        const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
        const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
        const usedMem = (totalMem - freeMem).toFixed(1);

        res.json({
            applications: appRes.data,
            server: serverInfo,
            stats: {
                cpu: cpu,
                memory: {
                    total: totalMem,
                    used: usedMem,
                    free: freeMem,
                    percent: ((usedMem / totalMem) * 100).toFixed(1)
                },
                uptime: os.uptime()
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("API Proxy Error:", error.message);
        res.status(500).json({ error: "Failed to fetch data from Coolify" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Dashboard server körs på http://localhost:${PORT}`);
});
