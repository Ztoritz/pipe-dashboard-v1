const express = require('express');
const axios = require('axios');
const cors = require('cors');
const os = require('os');
const osUtils = require('os-utils');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config({ path: '../.env' }); // Använd den gemensamma .env filen

const app = express();
const PORT = process.env.PORT || 2003;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint för att starta deployment och streama loggar via Server-Sent Events (SSE)
app.get('/api/deploy', (req, res) => {
    const { dir, name } = req.query;

    if (!dir || !name) {
        return res.status(400).json({ error: "Saknar dir eller name" });
    }

    // Sätt upp SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                res.write(`data: ${JSON.stringify({ message: line })}\n\n`);
            }
        });
    };

    const deployScriptPath = path.join(__dirname, '..', 'deploy.js');
    console.log(`Starting deploy: node ${deployScriptPath} --dir ${dir} --name ${name}`);

    // Kör deploy.js
    const child = spawn('node', [deployScriptPath, '--dir', dir, '--name', name]);

    child.stdout.on('data', sendLog);
    child.stderr.on('data', sendLog);

    child.on('close', (code) => {
        res.write(`data: ${JSON.stringify({ message: `\n✅ Processen avslutades med kod: ${code}`, done: true })}\n\n`);
        res.end();
    });

    child.on('error', (err) => {
        res.write(`data: ${JSON.stringify({ message: `❌ Fel vid start av process: ${err.message}`, done: true })}\n\n`);
        res.end();
    });
});

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
