async function fetchStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        updateServerInfo(data);
        updateProjects(data.applications);

        document.getElementById('last-updated').innerText = `Senast uppdaterad: ${new Date().toLocaleTimeString()}`;

        const statusPill = document.getElementById('server-status');
        statusPill.innerHTML = `<span class="status-dot pulsing"></span><span class="status-text">Ansluten till VPS</span>`;

    } catch (error) {
        console.error('Fetch error:', error);
        const statusPill = document.getElementById('server-status');
        statusPill.innerHTML = `<span class="status-dot" style="background: #FF0055"></span><span class="status-text">Anslutningsfel</span>`;
    }
}

function updateServerInfo(data) {
    if (!data.server && !data.stats) return;

    // Server IP & Time
    if (data.server) {
        document.getElementById('server-ip').innerText = data.server.ip || 'Localhost';
    }

    // Stats (RAM & CPU)
    if (data.stats) {
        const stats = data.stats;

        // RAM
        const ramBar = document.getElementById('ram-bar');
        const ramText = document.getElementById('ram-text');
        ramBar.style.width = `${stats.memory.percent}%`;
        ramBar.style.backgroundColor = getBarColor(stats.memory.percent);
        ramText.innerText = `${stats.memory.used} GB / ${stats.memory.total} GB (${stats.memory.percent}%)`;

        // CPU
        const cpuBar = document.getElementById('cpu-bar');
        const cpuText = document.getElementById('cpu-text');
        cpuBar.style.width = `${stats.cpu}%`;
        cpuBar.style.backgroundColor = getBarColor(stats.cpu);
        cpuText.innerText = `${stats.cpu} %`;
    }
}

function getBarColor(percent) {
    if (percent > 85) return '#FF0055'; // Red
    if (percent > 60) return '#FFB800'; // Amber
    return '#00FF85'; // Green
}

function updateProjects(apps) {
    const grid = document.getElementById('project-grid');
    document.getElementById('project-count').innerText = apps.length;

    if (apps.length === 0) {
        grid.innerHTML = '<p class="loading-spinner">Inga appar hittades.</p>';
        return;
    }

    grid.innerHTML = apps.map(app => {
        const isRunning = app.status?.includes('running');
        const statusClass = isRunning ? '' : 'error';
        const statusText = isRunning ? 'Running' : (app.status || 'Offline');
        const appUrl = app.fqdn || '#';

        return `
            <div class="project-card glass">
                <div class="project-header">
                    <h3 class="project-name">${app.name}</h3>
                    <span class="project-status-tag ${statusClass}">${statusText}</span>
                </div>
                <div class="project-details">
                    <div class="project-meta">
                        <div class="meta-item"><span>🌿</span> Branch: ${app.git_branch}</div>
                        <div class="meta-item"><span>🚀</span> Pack: ${app.build_pack}</div>
                    </div>
                </div>
                <a href="${appUrl}" target="_blank" class="btn-open">
                    Öppna Applikation <span>↗</span>
                </a>
            </div>
        `;
    }).join('');
}

// Deployment Logik
const btnDeploy = document.getElementById('btn-deploy');
const btnClearLogs = document.getElementById('btn-clear-logs');
const logContainer = document.getElementById('deploy-logs');
const inputDir = document.getElementById('deploy-dir');
const inputName = document.getElementById('deploy-name');

btnDeploy.addEventListener('click', () => {
    const dir = inputDir.value.trim();
    const name = inputName.value.trim();

    if (!dir || !name) {
        alert("Vänligen fyll i både sökväg och projektnamn.");
        return;
    }

    // Inaktivera knapp under processen
    btnDeploy.disabled = true;
    btnDeploy.innerText = "Deployar... ⏳";
    logContainer.innerHTML = `🚀 Startar deployment för ${name}...\n\n`;

    // Starta SSE (Server-Sent Events)
    const eventSource = new EventSource(`/api/deploy?dir=${encodeURIComponent(dir)}&name=${encodeURIComponent(name)}`);

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Lägg till logg-rad
        const line = document.createElement('div');
        line.textContent = data.message;
        logContainer.appendChild(line);

        // Scrolla till botten
        logContainer.scrollTop = logContainer.scrollHeight;

        if (data.done) {
            eventSource.close();
            btnDeploy.disabled = false;
            btnDeploy.innerText = "Starta Deployment 🚀";
            // Uppdatera projektlistan efter en liten stund
            setTimeout(fetchStatus, 5000);
        }
    };

    eventSource.onerror = (err) => {
        console.error("SSE Error:", err);
        const line = document.createElement('div');
        line.style.color = "#FF0055";
        line.textContent = "\n❌ Ett anslutningsfel uppstod under logg-strömningen.";
        logContainer.appendChild(line);

        eventSource.close();
        btnDeploy.disabled = false;
        btnDeploy.innerText = "Starta Deployment 🚀";
    };
});

btnClearLogs.addEventListener('click', () => {
    logContainer.innerHTML = "Väntar på start...";
});

// Initial hämtning
fetchStatus();

// Uppdatera var 30:e sekund
setInterval(fetchStatus, 30000);
