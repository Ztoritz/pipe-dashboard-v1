const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config({ path: '../.env' }); // Använd den gemensamma .env filen

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// Säkert proxy-anrop till Coolify API
app.get('/api/status', async (req, res) => {
    try {
        const coolifyHeaders = {
            Authorization: `Bearer ${process.env.COOLIFY_API_TOKEN}`,
            Accept: 'application/json'
        };

        // 1. Hämta alla applikationer
        const appRes = await axios.get(`${process.env.COOLIFY_URL}/api/v1/applications`, { headers: coolifyHeaders });

        // 2. Hämta serverstatus (använd server_uuid från den första appen eller .env)
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

        res.json({
            applications: appRes.data,
            server: serverInfo,
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
