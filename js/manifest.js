// ============================================================
// manifest.js — Official Delivery Manifest Terminal
// ============================================================

function renderManifestTable() {
    const container = document.getElementById('manifestTableContainer');
    if (!container) return;

    const masterOrders = JSON.parse(localStorage.getItem('masterOrders')) || [];
    
    // Get unique IDs that are in MANIFESTED or DISPATCHED status
    const manifestIDs = [...new Set(masterOrders
        .filter(o => o.Status === 'VERIFIED' || o.Status === 'MANIFESTED' || o.Status === 'DISPATCHED')
        .map(o => o.TripID))];

    if (manifestIDs.length === 0) {
        container.innerHTML = `
            <div class="p-5 text-center bg-white border rounded-4 shadow-sm">
                <i class="bi bi-file-earmark-lock display-1 text-light mb-3"></i>
                <h5 class="fw-bold text-dark">No Official Manifests</h5>
                <p class="text-muted small">Verify a Load Sheet in the 'Manage Load Sheets' section to see it here.</p>
                <button class="btn btn-primary btn-sm fw-bold px-4" onclick="showSection('dispatchPane')">GO TO LOAD SHEETS</button>
            </div>`;
        return;
    }

    // Default to the first one if none selected
    if (!window.activeManifestID || !manifestIDs.includes(window.activeManifestID)) {
        window.activeManifestID = manifestIDs[0];
    }

    // --- SLEEK HORIZONTAL MANIFEST RIBBON ---
    let html = `
        <div class="mb-4 d-flex align-items-center justify-content-between no-print">
            <div>
                
                <p class="text-muted smallest text-uppercase fw-bold mb-0" style="letter-spacing:1px;">Select document to print or dispatch</p>
            </div>
        </div>

        <div class="d-flex align-items-center gap-2 mb-4 pb-2 border-bottom overflow-auto no-print" style="white-space: nowrap; scrollbar-width: thin;">
            ${manifestIDs.map(id => {
                const tripItems = masterOrders.filter(o => o.TripID === id);
                const status = tripItems[0].Status;
                const isSelected = window.activeManifestID === id;
                
                let pillClass = "bg-white text-secondary border";
                let icon = "bi-file-earmark-check";

                if (status === 'DISPATCHED') {
                    pillClass = "bg-dark-subtle text-dark border-dark-subtle opacity-75";
                    icon = "bi-truck-flatbed";
                } else if (status === 'MANIFESTED') {
                    pillClass = "bg-success-subtle text-success border-success-subtle";
                }
                
                if (isSelected) pillClass = "bg-primary text-white border-primary shadow-sm";

                return `
                <div class="px-3 py-2 rounded-3 fw-bold small transition-all ${pillClass}" 
                     style="cursor:pointer; min-width:140px; border: 1px solid;"
                     onclick="window.activeManifestID='${id}'; renderManifestTable();">
                    <div class="smallest opacity-75 text-uppercase" style="font-size:0.6rem;">${status === 'DISPATCHED' ? 'SHIPPED' : 'READY'}</div>
                    <i class="bi ${icon} me-1"></i> ${id}
                </div>`;
            }).join('')}
        </div>
    `;

    const items = masterOrders.filter(o => o.TripID === window.activeManifestID);
    const zone = items[0]?.Zone || 'UNASSIGNED';
    const currentStatus = items[0]?.Status;
    
    // Fixed Payload Calculation
    const totalLoaded = items.reduce((sum, o) => {
        const qty = o.Final_Loaded !== undefined ? o.Final_Loaded : (o.staged_qty || 0);
        return sum + qty;
    }, 0);

    // --- DOCUMENT VIEW & INPUTS ---
    html += `
        <div class="d-flex justify-content-between align-items-center mb-4 no-print">
            <span class="badge ${currentStatus === 'DISPATCHED' ? 'bg-dark' : 'bg-success'} px-3 py-2 text-uppercase">
                <i class="bi ${currentStatus === 'DISPATCHED' ? 'bi-archive' : 'bi-check-circle'} me-2"></i>
                ${currentStatus}
            </span>
            <div class="d-flex gap-2">
                ${currentStatus === 'MANIFESTED' ? `
                    <button class="btn btn-outline-secondary btn-sm fw-bold" onclick="reopenManifest('${window.activeManifestID}')">
                        <i class="bi bi-unlock"></i> RE-OPEN FOR EDIT
                    </button>
                ` : ''}
                <button class="btn btn-primary fw-bold px-4 shadow-sm" onclick="window.print()">
                    <i class="bi bi-printer me-2"></i> PRINT OFFICIAL FORM
                </button>
            </div>
        </div>

        <div class="card border-0 shadow-sm mb-4 no-print" style="border-radius:12px; background: #f8fafc;">
            <div class="card-body p-4">
                <h6 class="fw-bold text-dark mb-3 text-uppercase smallest" style="letter-spacing:1px;">Logistics Assignment</h6>
                <div class="row g-3">
                    <div class="col-md-3">
                        <label class="smallest fw-800 text-muted text-uppercase">Transporter Name</label>
                        <input type="text" class="form-control form-control-sm border-0 shadow-sm" id="in_driverName" placeholder="e.g. Pirlo Trucking" oninput="syncPrintDetail('print_transporter', this.value)">
                    </div>
                    <div class="col-md-2">
                        <label class="smallest fw-800 text-muted text-uppercase">Reg No</label>
                        <input type="text" class="form-control form-control-sm border-0 shadow-sm" id="in_regNo" placeholder="NP 123..." oninput="syncPrintDetail('print_regNo', this.value)">
                    </div>
                    <div class="col-md-2">
                        <label class="smallest fw-800 text-muted text-uppercase">Trailer No</label>
                        <input type="text" class="form-control form-control-sm border-0 shadow-sm" id="in_trailerNo" placeholder="TRL..." oninput="syncPrintDetail('print_trailerNo', this.value)">
                    </div>
                    <div class="col-md-3">
                        <label class="smallest fw-800 text-muted text-uppercase">Dispatch Date</label>
                        <input type="date" class="form-control form-control-sm border-0 shadow-sm" id="in_date" value="${new Date().toISOString().split('T')[0]}" oninput="syncPrintDetail('print_date', this.value)">
                    </div>
                </div>
            </div>
        </div>

        <div class="manifest-print-wrapper bg-white shadow-sm p-5 border rounded" id="printableArea">
            <div class="d-flex justify-content-between align-items-start mb-4">
                <div style="width: 200px;">
                    <img src="path-to-your-logo.png" alt="Company Logo" style="max-width: 100%; height: auto;">
                </div>
                <div class="text-end" style="font-size: 0.85rem; line-height: 1.4;">
                    <h4 class="fw-black mb-1 text-dark">V&V LOGISTICS</h4>
                    <p class="mb-0">123 Logistics Drive, Industrial Park</p>
                    <p class="mb-0">Tel: +27 11 000 0000</p>
                    <p class="mb-0">Email: dispatch@vvlogistics.co.za</p>
                    <p class="fw-bold mt-2 text-primary">MANIFEST: ${window.activeManifestID}</p>
                </div>
            </div>

            <div class="mb-4 pt-2">
                <h5 class="fw-bold" style="font-size: 1.1rem;">Transporter Name: 
                    <span id="print_transporter" class="ms-2 border-bottom border-dark d-inline-block fw-bold" style="min-width: 400px; padding-left: 10px;">___________________________</span>
                </h5>
            </div>

            <table class="table table-bordered align-middle border-dark border-1 mb-4">
                <thead class="table-light border-dark">
                    <tr style="font-size: 0.75rem;" class="text-uppercase fw-bold">
                        <th class="py-2">BRN CODE</th>
                        <th class="py-2">ORDER #</th>
                        <th class="py-2">CUSTOMER (AREA)</th>
                        <th class="py-2">BRANCH NAME</th>
                        <th class="py-2">ITEM DESCRIPTION</th>
                        <th class="text-center py-2">QTY</th>
                        <th class="py-2">LS #</th>
                    </tr>
                </thead>
                <tbody style="font-size: 0.85rem;">
                    ${items.map(item => {
                        const desc = item.Description || item.description || (typeof _getDescription === 'function' ? _getDescription(item) : '---');
                        return `
                        <tr>
                            <td>${item['Brn No'] || item['Branch No'] || '---'}</td>
                            <td>${item['Ord No'] || item['Order No'] || '---'}</td>
                            <td class="fw-bold text-dark">${item.Area || '---'}</td>
                            <td>${item['Branch Name'] || '---'}</td>
                            <td style="max-width: 250px;">${desc}</td>
                            <td class="text-center fw-bold text-dark">${item.Final_Loaded ?? item.staged_qty}</td>
                            <td class="text-muted small">${item.TripID}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot class="border-dark">
                    <tr class="fw-bold bg-light">
                        <td colspan="5" class="text-end text-uppercase py-2" style="font-size:0.75rem;">Total Payload Volume:</td>
                        <td class="text-center py-2" style="font-size:1.1rem;">${totalLoaded}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>

            <div class="mt-5" style="font-size: 0.9rem;">
                <p class="fst-italic mb-5" style="line-height: 1.6;">"By signing this document, I acknowledge that i have checked and verified all that was loaded on my vehicle. I also take full responsibility for any loss or damages that may occur as a result of negligence"</p>
                
                <div class="row g-5">
                    <div class="col-6">
                        <div class="d-flex mb-4 align-items-end">
                            <span class="fw-bold me-2">Name:</span>
                            <div class="border-bottom border-dark flex-grow-1" style="height: 25px;"></div>
                        </div>
                        <div class="d-flex align-items-end">
                            <span class="fw-bold me-2">Sign:</span>
                            <div class="border-bottom border-dark flex-grow-1" style="height: 25px;"></div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="d-flex mb-4 align-items-end">
                            <span class="fw-bold me-2">REG No:</span>
                            <div id="print_regNo" class="border-bottom border-dark flex-grow-1 fw-bold ps-2" style="height: 25px;"></div>
                        </div>
                        <div class="d-flex align-items-end">
                            <span class="fw-bold me-2">Trailer No:</span>
                            <div id="print_trailerNo" class="border-bottom border-dark flex-grow-1 fw-bold ps-2" style="height: 25px;"></div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-5 d-flex align-items-end">
                    <span class="fw-bold me-2">Date:</span>
                    <div id="print_date" class="border-bottom border-dark fw-bold ps-2" style="min-width: 250px; height: 25px;">${new Date().toLocaleDateString()}</div>
                </div>
            </div>
        </div>

        ${currentStatus === 'MANIFESTED' ? `
            <div class="mt-4 p-4 bg-white rounded border shadow-sm d-flex justify-content-between align-items-center no-print">
                <div>
                    <h6 class="fw-bold mb-1 text-dark">Ready for Departure?</h6>
                    <p class="small text-muted mb-0">Ship & Dispatch will finalize this manifest and move it to history.</p>
                </div>
                <button class="btn btn-success fw-bold px-5 py-2 shadow-sm" onclick="finalizeDispatchToHistory('${window.activeManifestID}')">
                    <i class="bi bi-truck me-2"></i> SHIP & DISPATCH
                </button>
            </div>
        ` : ''}
    `;

    container.innerHTML = html;
}

window.syncPrintDetail = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'print_date' && val) {
        const d = new Date(val);
        el.innerText = d.toLocaleDateString();
    } else {
        el.innerText = val.toUpperCase() || "";
    }
};

window.finalizeDispatchToHistory = (tripID) => {
    const masterOrders = JSON.parse(localStorage.getItem('masterOrders')) || [];
    const tripItems = masterOrders.filter(o => o.TripID === tripID);
    if (tripItems.length === 0) return alert("Error: Trip data not found.");

    if (!confirm(`Confirm Departure for ${tripID}?`)) return;

    const totalLoaded = tripItems.reduce((sum, o) => sum + (o.Final_Loaded || 0), 0);
    const totalPlanned = tripItems.reduce((sum, o) => sum + (o.staged_qty || 0), 0);
    const shortCount = tripItems.filter(o => (o.BounceBackQty || 0) > 0).length;
    const fulfillmentPct = totalPlanned > 0 ? Math.round((totalLoaded / totalPlanned) * 100) : 100;

    const historyEntry = {
        tripId: tripID,
        zone: tripItems[0].Zone || 'UNASSIGNED',
        dateClosed: new Date().toISOString(),
        totalUnits: totalLoaded,
        totalPlanned: totalPlanned,
        shortCount: shortCount,
        fulfillmentPct: fulfillmentPct,
        items: tripItems.map(o => ({
            Area: o.Area,
            loaded: o.Final_Loaded || 0,
            planned: o.staged_qty || 0,
            description: (typeof _getDescription === 'function' ? _getDescription(o) : (o.Description || o.description || '---')),
            Note: o.Note || ''
        }))
    };

    const tripHistory = JSON.parse(localStorage.getItem('tripHistory') || "[]");
    tripHistory.push(historyEntry);
    localStorage.setItem('tripHistory', JSON.stringify(tripHistory));

    masterOrders.forEach(item => {
        if (item.TripID === tripID) {
            if ((item.BounceBackQty || 0) > 0) {
                item.qty = (item.qty || 0) + item.BounceBackQty;
                item.staged_qty = item.Final_Loaded;
                item.Status = 'Pending';
                item.TripID = null;
            } else {
                item.Status = 'DISPATCHED'; 
            }
            delete item.Final_Loaded;
            delete item.BounceBackQty;
        }
    });

    localStorage.setItem('masterOrders', JSON.stringify(masterOrders));
    alert(`Trip ${tripID} dispatched to Archive.`);
    window.activeManifestID = null;
    showSection('mainMenu');
};

window.reopenManifest = (tripID) => {
    if (!confirm(`Re-open ${tripID}?`)) return;
    let masterOrders = JSON.parse(localStorage.getItem('masterOrders')) || [];
    masterOrders.forEach(item => { if (item.TripID === tripID) item.Status = 'VERIFIED'; });
    localStorage.setItem('masterOrders', JSON.stringify(masterOrders));
    window.selectedTrip = tripID;
    showSection('dispatchPane');
};