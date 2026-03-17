// ============================================================
// history.js — Digital Archive & Document Recall
// ============================================================

function renderHistoryTable() {
    const container = document.getElementById('historyTableContainer');
    if (!container) return;

    const tripHistory = JSON.parse(localStorage.getItem('tripHistory') || '[]');

    // 1. Landing View: If no specific document is being "recalled", show the list
    if (!window.recalledTripID) {
        renderHistoryList(tripHistory);
    } else {
        renderDocumentRecall(tripHistory);
    }
}

/**
 * Renders the searchable list of all past trips
 */
function renderHistoryList(history) {
    const container = document.getElementById('historyTableContainer');
    
    // 1. DATA PROCESSING
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const unitsPerDay = last7Days.map(date => {
        return history
            .filter(entry => entry.dateClosed.split('T')[0] === date)
            .reduce((sum, entry) => sum + entry.totalUnits, 0);
    });

    // Insights Calculation
    const totalUnits = history.reduce((sum, h) => sum + h.totalUnits, 0);
    const avgAccuracy = history.length > 0 
        ? Math.round(history.reduce((sum, h) => sum + h.fulfillmentPct, 0) / history.length) 
        : 100;
    const peakVolume = Math.max(...unitsPerDay, 0);

    // 2. RENDER SLEEK INTERFACE
    history.sort((a, b) => new Date(b.dateClosed) - new Date(a.dateClosed));

    container.innerHTML = `
        <div class="d-flex align-items-center gap-4 mb-5 no-print bg-white p-3 border rounded-4 shadow-sm">
            <div style="width: 250px; height: 60px;">
                <canvas id="historyLineChart"></canvas>
            </div>

            <div class="vr text-light"></div>

            <div class="d-flex gap-4 flex-grow-1 justify-content-around">
                <div class="text-center">
                    <div class="smallest fw-800 text-muted text-uppercase mb-1" style="letter-spacing:1px;">Avg Accuracy</div>
                    <div class="fw-bold ${avgAccuracy < 95 ? 'text-warning' : 'text-success'}">${avgAccuracy}%</div>
                </div>
                <div class="text-center">
                    <div class="smallest fw-800 text-muted text-uppercase mb-1" style="letter-spacing:1px;">Archive Volume</div>
                    <div class="fw-bold text-dark">${totalUnits.toLocaleString()} <span class="smallest fw-normal text-muted">units</span></div>
                </div>
                <div class="text-center">
                    <div class="smallest fw-800 text-muted text-uppercase mb-1" style="letter-spacing:1px;">7-Day Peak</div>
                    <div class="fw-bold text-primary">${peakVolume} <span class="smallest fw-normal text-muted">units/day</span></div>
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-4 no-print gap-3">
            <div class="d-flex align-items-center gap-2 flex-grow-1">
                <div class="bg-white border p-2 rounded-3 shadow-sm d-flex align-items-center px-3" style="width: 100%; max-width: 400px;">
                    <i class="bi bi-search text-muted me-2"></i>
                    <input type="text" id="historySearch" class="form-control form-control-sm border-0 shadow-none p-0" 
                           placeholder="Search Archive..." oninput="filterHistory()">
                </div>
            </div>
            <div class="d-flex align-items-center gap-2 bg-white border p-1 rounded-3 shadow-sm px-3">
                <i class="bi bi-calendar3 text-muted smallest"></i>
                <input type="date" id="historyDateFilter" class="form-control form-control-sm border-0 shadow-none" onchange="filterHistory()">
                <button class="btn btn-sm text-danger fw-bold smallest px-2" onclick="resetHistoryFilters()">RESET</button>
            </div>
        </div>

        <div class="card border-0 shadow-sm overflow-hidden" style="border-radius:12px;">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" id="historyTable">
                    <thead class="bg-light">
                        <tr style="border-bottom: 2px solid #e2e8f0;">
                            <th class="ps-4 text-secondary smallest fw-800 text-uppercase">Date Closed</th>
                            <th class="text-secondary smallest fw-800 text-uppercase">Manifest #</th>
                            <th class="text-secondary smallest fw-800 text-uppercase">Route</th>
                            <th class="text-center text-secondary smallest fw-800 text-uppercase">Planned</th>
                            <th class="text-center text-secondary smallest fw-800 text-uppercase">Actual</th>
                            <th class="text-center text-secondary smallest fw-800 text-uppercase">Fulfillment</th>
                            <th class="text-end pe-4 text-secondary smallest fw-800 text-uppercase">Management</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white">
                        ${history.length === 0 ? '<tr><td colspan="7" class="text-center py-5">Archive is empty.</td></tr>' : 
                          history.map(entry => {
                            const date = new Date(entry.dateClosed);
                            const perfClass = entry.fulfillmentPct >= 100 ? 'text-success' : 'text-warning';
                            return `
                            <tr class="history-row" data-date="${entry.dateClosed.split('T')[0]}" data-content="${entry.tripId} ${entry.zone}">
                                <td class="ps-4 small fw-bold">${date.toLocaleDateString()}</td>
                                <td><span class="smallest fw-bold font-monospace text-primary bg-primary-subtle px-2 py-1 rounded">${entry.tripId}</span></td>
                                <td class="smallest fw-bold text-uppercase text-muted">${entry.zone}</td>
                                <td class="text-center small">${entry.totalPlanned}</td>
                                <td class="text-center small fw-bold">${entry.totalUnits}</td>
                                <td class="text-center fw-black ${perfClass}">${entry.fulfillmentPct}%</td>
                                <td class="text-end pe-4">
                                    <button class="btn btn-sm btn-light border fw-bold smallest py-1" onclick="recallDocument('${entry.tripId}')">VIEW MANIFEST</button>
                                </td>
                            </tr>`;
                          }).join('')
                        }
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // 3. INIT CHART
    initHistorySparkline(last7Days, unitsPerDay);
}

function initHistorySparkline(labels, barData) {
    const ctx = document.getElementById('historyLineChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: barData,
                borderColor: '#3b82f6',
                borderWidth: 2.5,
                tension: 0.4, // Smooth curve
                pointRadius: 0, // Hidden points for sleek look
                fill: true,
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return null;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
                    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
                    return gradient;
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            scales: {
                y: { display: false },
                x: { display: false }
            }
        }
    });
}

function initHistoryCharts(labels, barData, perfect, short) {
    const ctxBar = document.getElementById('historyBarChart');
    const ctxPie = document.getElementById('historyPieChart');

    if (!ctxBar || !ctxPie) return;

    // Compact Bar Chart
    new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: labels.map(d => d.split('-')[2]), // Just show day numbers for compact view
            datasets: [{
                data: barData,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            scales: {
                y: { display: false }, // Hide Y-axis for sleeker look
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });

    // Compact Doughnut Chart
    new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Perfect', 'Shortages'],
            datasets: [{
                data: [perfect, short],
                backgroundColor: ['#16a34a', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%', // Make it thinner for sleeker look
            plugins: { legend: { display: false }, tooltip: { enabled: true } }
        }
    });
}

function initHistoryCharts(labels, barData, perfect, short) {
    const ctxBar = document.getElementById('historyBarChart');
    const ctxPie = document.getElementById('historyPieChart');

    if (!ctxBar || !ctxPie) return;

    // Volume Bar Chart
    new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: labels.map(d => d.split('-').slice(1).reverse().join('/')), 
            datasets: [{
                label: 'Units Loaded',
                data: barData,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Accuracy Doughnut Chart
    new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Perfect', 'Shortages'],
            datasets: [{
                data: [perfect, short],
                backgroundColor: ['#16a34a', '#f59e0b'],
                hoverOffset: 4,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 11, weight: 'bold' } } }
            }
        }
    });
}

/**
 * Renders a full-screen, read-only version of the old manifest
 */
function renderDocumentRecall(history) {
    const container = document.getElementById('historyTableContainer');
    const doc = history.find(h => h.tripId === window.recalledTripID);
    
    if (!doc) { window.recalledTripID = null; renderHistoryTable(); return; }

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4 no-print">
            <button class="btn btn-sm btn-outline-secondary fw-bold" onclick="window.recalledTripID=null; renderHistoryTable();">
                <i class="bi bi-arrow-left"></i> BACK TO ARCHIVE
            </button>
            <div class="d-flex gap-2">
                
                <button class="btn btn-primary fw-bold px-4 shadow-sm" onclick="window.print()">
                    <i class="bi bi-printer me-2"></i> PRINT ARCHIVE COPY
                </button>
            </div>
        </div>

        <div class="manifest-print-wrapper bg-white shadow-sm p-5 border rounded" id="printableArea">
            
            
            <div class="d-flex justify-content-between border-bottom border-2 border-dark pb-3 mb-4">
                <div>
                    <h2 class="fw-black mb-0">V&V LOGISTICS</h2>
                    <p class="text-muted small fw-bold mb-0">Historical Manifest Record</p>
                </div>
                <div class="text-end">
                    <h4 class="fw-bold mb-0 text-dark">${doc.tripId}</h4>
                    <p class="smallest text-muted text-uppercase fw-bold mb-0">Dispatched: ${new Date(doc.dateClosed).toLocaleDateString()}</p>
                </div>
            </div>

            <div class="row mb-4 border border-dark p-3 bg-light-subtle g-0 text-uppercase" style="font-size: 0.75rem;">
                <div class="col-3 px-3">
                    <span class="text-muted fw-bold d-block mb-1">Route / Zone:</span>
                    <span class="fw-bold text-dark">${doc.zone}</span>
                </div>
                <div class="col-3 border-start border-dark px-3">
                    <span class="text-muted fw-bold d-block mb-1">Planned Qty:</span>
                    <span class="fw-bold text-dark">${doc.totalPlanned} Units</span>
                </div>
                <div class="col-3 border-start border-dark px-3">
                    <span class="text-muted fw-bold d-block mb-1">Loaded Qty:</span>
                    <span class="fw-bold text-dark">${doc.totalUnits} Units</span>
                </div>
                <div class="col-3 border-start border-dark px-3">
                    <span class="text-muted fw-bold d-block mb-1">Fulfillment:</span>
                    <span class="fw-black ${doc.fulfillmentPct < 100 ? 'text-danger' : 'text-success'}">${doc.fulfillmentPct}%</span>
                </div>
            </div>

            <table class="table table-bordered border-dark">
                <thead class="table-light">
                    <tr style="font-size: 0.7rem;" class="text-uppercase fw-bold">
                        <th class="py-2">AREA / CUSTOMER</th>
                        <th class="py-2">ITEM DESCRIPTION</th>
                        <th class="text-center py-2">PLANNED</th>
                        <th class="text-center py-2">LOADED</th>
                        <th class="py-2">AUDIT NOTES</th>
                    </tr>
                </thead>
                <tbody style="font-size: 0.8rem;">
                    ${doc.items.map(i => {
                        // FAIL-SAFE: Check all possible naming conventions for the description
                        const desc = i.description || 
                                    i.Description || 
                                    i.Item_Desc || 
                                    i.Product || 
                                    (typeof _getDescription === 'function' ? _getDescription(i) : '---');

                        return `
                        <tr>
                            <td class="fw-bold text-dark">${i.Area}</td>
                            <td style="max-width: 300px;">${desc}</td>
                            <td class="text-center text-muted">${i.planned}</td>
                            <td class="text-center fw-bold text-dark">${i.loaded}</td>
                            <td class="small fst-italic text-secondary">${i.Note || 'Clean Delivery'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>

            <div class="mt-5 p-4 border rounded bg-light text-center" style="border-style: dashed !important;">
                <h6 class="smallest fw-bold text-uppercase text-muted mb-1">Digital Audit Stamp</h6>
                <p class="smallest text-muted mb-0">
                    This document is a computer-generated recall of a finalized load sheet.<br>
                    Finalized Timestamp: <b>${new Date(doc.dateClosed).toLocaleString()}</b><br>
                    Original hard-copy signatures and security logs are retained in the physical warehouse archive.
                </p>
            </div>
        </div>
    `;
}

// ─────────────────────────────────────────────────────────────
// FILTERING LOGIC
// ─────────────────────────────────────────────────────────────

window.recallDocument = (tripId) => {
    window.recalledTripID = tripId;
    renderHistoryTable();
};

window.filterHistory = () => {
    const searchTerm = document.getElementById('historySearch').value.toUpperCase();
    const dateTerm = document.getElementById('historyDateFilter').value;
    const rows = document.querySelectorAll('.history-row');

    rows.forEach(row => {
        const textMatch = row.getAttribute('data-content').toUpperCase().includes(searchTerm);
        const dateMatch = !dateTerm || row.getAttribute('data-date') === dateTerm;
        row.style.display = (textMatch && dateMatch) ? "" : "none";
    });
};

window.resetHistoryFilters = () => {
    document.getElementById('historySearch').value = "";
    document.getElementById('historyDateFilter').value = "";
    filterHistory();
};