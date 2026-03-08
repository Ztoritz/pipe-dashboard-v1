async function fetchStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        updateServerInfo(data.server);
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

function updateServerInfo(server) {
    if (!server) return;

    document.getElementById('server-ip').innerText = server.ip || 'Localhost';
    document.getElementById('server-time').innerText = new Date().toLocaleTimeString();
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

// Initial hämtning
fetchStatus();

// Uppdatera var 30:e sekund
setInterval(fetchStatus, 30000);
