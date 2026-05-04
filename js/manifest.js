// ============================================================
// manifest.js — Official Delivery Manifest Terminal
// ============================================================

function renderManifestTable() {
    const container = document.getElementById('manifestTableContainer');
    if (!container) return;

    const masterOrders = JSON.parse(localStorage.getItem('masterOrders')) || [];
    
    // --- UPDATE THIS LINE in manifest.js ---
    const manifestIDs = [...new Set(masterOrders
        .filter(o => o.Status === 'VERIFIED' || o.Status === 'MANIFESTED') // REMOVED 'DISPATCHED'
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

    if (!window.activeManifestID || !manifestIDs.includes(window.activeManifestID)) {
        window.activeManifestID = manifestIDs[0];
    }

    const items = masterOrders.filter(o => o.TripID === window.activeManifestID);
    const currentStatus = items[0]?.Status;
    
    const totalLoaded = items.reduce((sum, o) => {
        const qty = o.Final_Loaded !== undefined ? o.Final_Loaded : (o.staged_qty || 0);
        return sum + qty;
    }, 0);

    let html = `
        <style>
            .manifest-inv-input {
                width: 100%;
                border: none;
                padding: 4px 8px;
                background: transparent;
                font-weight: bold;
                outline: none;
                color: #0d6efd;
                text-align: center;
            }

            .highlight-required {
                background-color: #fff9db !important;
                border: 1px solid #fab005 !important;
            }

            @media print {
                body * { visibility: hidden; }
                #printableArea, #printableArea * { visibility: visible; }
                #printableArea {
                    position: absolute;
                    left: 0; top: 0; width: 100%;
                    padding: 0 !important; margin: 0 !important; border: none !important;
                }
                .manifest-inv-input { 
                    color: black !important; 
                    padding: 10px !important; 
                    text-align: left !important;
                }
                .col-invoice { width: 140px !important; }
                .no-print { display: none !important; }
                .table-bordered, .table-bordered td, .table-bordered th {
                    border: 1px solid #000 !important;
                }
                table { border-collapse: collapse !important; }
            }
        </style>

        <div class="d-flex align-items-center gap-2 mb-4 pb-2 border-bottom overflow-auto no-print" style="white-space: nowrap; scrollbar-width: thin;">
        ${manifestIDs.map(id => {
            const tripItems = masterOrders.filter(o => o.TripID === id);
            const status = tripItems[0]?.Status || 'READY';
            const isSelected = window.activeManifestID === id;
            
            let statusLabel = status === 'DISPATCHED' ? "SHIPPED" : (status === 'MANIFESTED' ? "MANIFESTED" : "READY");
            let statusClass = isSelected ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-secondary border-secondary-subtle";

            return `
            <div class="px-3 py-2 rounded-3 fw-bold small transition-all ${statusClass}" 
                    style="cursor:pointer; min-width:150px; border: 1px solid; opacity: ${status === 'DISPATCHED' && !isSelected ? '0.6' : '1'};"
                    onclick="window.activeManifestID='${id}'; renderManifestTable();">
                <div class="smallest text-uppercase mb-1" style="font-size:0.6rem; letter-spacing:0.5px; opacity: 0.8;">
                    ${statusLabel}
                </div>
                <div class="d-flex align-items-center justify-content-between">
                    <span>${id}</span>
                    <i class="bi bi-file-earmark-check ms-2"></i>
                </div>
            </div>`;
        }).join('')}
        </div>

        <div class="d-flex justify-content-between align-items-center mb-4 no-print">
            <span class="badge ${currentStatus === 'DISPATCHED' ? 'bg-dark' : 'bg-success'} px-3 py-2 text-uppercase">${currentStatus}</span>
            <button class="btn btn-primary fw-bold px-4 shadow-sm" onclick="window.print()">PRINT OFFICIAL FORM</button>
        </div>

        <div class="card border-0 shadow-sm mb-4 no-print" style="border-radius:12px; background: #f8fafc;">
            <div class="card-body p-4">
                <h6 class="fw-bold text-dark mb-3 text-uppercase smallest">Logistics Assignment</h6>
                <div class="row g-3">
                    <div class="col-md-3">
                        <label class="smallest fw-800 text-muted text-uppercase">Transporter Name</label>
                        <input type="text" class="form-control form-control-sm" id="in_driverName" oninput="syncPrintDetail('print_transporter', this.value)">
                    </div>
                    <div class="col-md-2">
                        <label class="smallest fw-800 text-muted text-uppercase">Reg No</label>
                        <input type="text" class="form-control form-control-sm" id="in_regNo" oninput="syncPrintDetail('print_regNo', this.value)">
                    </div>
                    <div class="col-md-2">
                        <label class="smallest fw-800 text-muted text-uppercase">Trailer No</label>
                        <input type="text" class="form-control form-control-sm" id="in_trailerNo" oninput="syncPrintDetail('print_trailerNo', this.value)">
                    </div>
                    <div class="col-md-3">
                        <label class="smallest fw-800 text-muted text-uppercase">Dispatch Date</label>
                        <input type="date" class="form-control form-control-sm" id="in_date" value="${new Date().toISOString().split('T')[0]}" oninput="syncPrintDetail('print_date', this.value)">
                    </div>
                </div>
            </div>
        </div>

        ${currentStatus === 'MANIFESTED' ? `
            <div class="alert alert-warning d-flex align-items-center no-print border-0 shadow-sm mb-3">
                <i class="bi bi-exclamation-triangle-fill me-3 fs-4"></i>
                <div>
                    <strong class="text-uppercase">Action Required:</strong> 
                    Please enter the <span class="badge bg-dark">INVOICE #</span> for each item in the table below before printing or dispatching.
                </div>
            </div>
        ` : ''}

        <div class="manifest-print-wrapper bg-white shadow-sm p-5 border rounded" id="printableArea">
            <div class="d-flex justify-content-between align-items-start mb-4">
                <div><h4 class="fw-black mb-1">V&V LOGISTICS</h4><p class="mb-0 small text-muted">Official Manifest</p></div>
                <div class="text-end fw-bold text-primary">MANIFEST: ${window.activeManifestID}</div>
            </div>

            <div class="mb-4">
                <h5 class="fw-bold">Transporter Name: <span id="print_transporter" class="ms-2 border-bottom border-dark d-inline-block" style="min-width: 300px;">________________</span></h5>
            </div>

            <table class="table table-bordered align-middle mb-4">
                <thead class="table-light">
                    <tr class="text-uppercase fw-bold small">
                        <th>BRN CODE</th>
                        <th>ORDER #</th>
                        <th>CUSTOMER (AREA)</th>
                        <th>BRANCH NAME</th>
                        <th class="text-center">QTY</th>
                        <th>INVOICE #</th>
                    </tr>
                </thead>
                <tbody class="small">
                    ${items.map(item => `
                        <tr>
                            <td style="border: 1px solid #000 !important;">${item['Brn No'] || item['Branch No'] || '---'}</td>
                            <td style="border: 1px solid #000 !important;">${item['Ord No'] || item['Order No'] || '---'}</td>
                            <td class="fw-bold text-dark" style="border: 1px solid #000 !important;">${item.Area || '---'}</td>
                            <td style="border: 1px solid #000 !important;">${item['Branch Name'] || '---'}</td>
                            <td class="text-center fw-bold" style="border: 1px solid #000 !important;">${item.Final_Loaded ?? item.staged_qty}</td>
                            <td class="p-0 col-invoice" style="width: 150px; min-width: 150px; border: 1px solid #000 !important;">
                                <input type="text" 
                                    id="manifest_inv_${item.fingerprint}" 
                                    class="manifest-inv-input ${!item.Invoice_No ? 'highlight-required' : ''}" 
                                    placeholder="REQUIRED #" 
                                    value="${item.Invoice_No || ''}"
                                    ${currentStatus === 'DISPATCHED' ? 'disabled' : ''}
                                    oninput="window.saveManifestInvoice('${item.fingerprint}')">
                            </td>
                        </tr>`).join('')}
                </tbody>
                <tfoot>
                    <tr class="fw-bold bg-light">
                        <td colspan="4" class="text-end py-2" style="border: 1px solid #000 !important;">Total Payload Volume:</td>
                        <td class="text-center py-2" style="border: 1px solid #000 !important;">${totalLoaded}</td>
                        <td style="border: 1px solid #000 !important;"></td>
                    </tr>
                </tfoot>
            </table>

            <div class="mt-5">
                <p class="fst-italic mb-5 small">"By signing this document, I acknowledge that i have checked and verified all that was loaded on my vehicle..."</p>
                <div class="row g-5">
                    <div class="col-6">
                        <div class="d-flex mb-4 align-items-end"><span class="fw-bold me-2">Name:</span><div class="border-bottom border-dark flex-grow-1" style="height:25px;"></div></div>
                        <div class="d-flex align-items-end"><span class="fw-bold me-2">Sign:</span><div class="border-bottom border-dark flex-grow-1" style="height:25px;"></div></div>
                    </div>
                    <div class="col-6">
                        <div class="d-flex mb-4 align-items-end"><span class="fw-bold me-2">REG No:</span><div id="print_regNo" class="border-bottom border-dark flex-grow-1 fw-bold ps-2" style="height:25px;"></div></div>
                        <div class="d-flex align-items-end"><span class="fw-bold me-2">Trailer No:</span><div id="print_trailerNo" class="border-bottom border-dark flex-grow-1 fw-bold ps-2" style="height:25px;"></div></div>
                    </div>
                </div>
                <div class="mt-5 d-flex align-items-end"><span class="fw-bold me-2">Date:</span><div id="print_date" class="border-bottom border-dark fw-bold ps-2" style="min-width: 200px;">${new Date().toLocaleDateString()}</div></div>
            </div>
        </div>

        ${currentStatus === 'MANIFESTED' ? `
            <div class="mt-4 p-4 bg-white rounded border shadow-sm d-flex justify-content-between align-items-center no-print">
                <div><h6 class="fw-bold mb-1">Ready for Departure?</h6><p class="small text-muted mb-0">Finalize and move to archive.</p></div>
                <button class="btn btn-success fw-bold px-5 py-2 shadow-sm" onclick="finalizeDispatchToHistory('${window.activeManifestID}')">SHIP & DISPATCH</button>
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

    // --- NEW INVOICE GUARD ---
    const missingInvoices = tripItems.filter(i => !i.Invoice_No || i.Invoice_No.trim() === "");
    if (missingInvoices.length > 0) {
        return alert(`STOP: There are ${missingInvoices.length} items missing Invoice Numbers. Please enter them in the table before dispatching.`);
    }

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
            // Capture the Invoice No for history
            invoiceNo: o.Invoice_No || 'N/A', 
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
                // Return shorts to pool
                item.qty = (item.qty || 0) + item.BounceBackQty;
                item.staged_qty = 0; // Reset staged since it's going back to warehouse
                item.Status = 'Pending';
                item.TripID = null;
                // Note: We keep the Invoice_No on the dispatched part, but the pending part is clean
            } else {
                item.Status = 'DISPATCHED'; 
            }
            // Cleanup temporary verification fields
            delete item.Final_Loaded;
            delete item.BounceBackQty;
        }
    });

    localStorage.setItem('masterOrders', JSON.stringify(masterOrders));
    
    alert(`Trip ${tripID} dispatched to Archive.`);
    
    // Refresh UI
    window.activeManifestID = null;
    renderManifestTable(); // Refresh the ribbon
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

window.saveManifestInvoice = (fingerprint) => {
    const orders = JSON.parse(localStorage.getItem('masterOrders')) || [];
    const item = orders.find(o => o.fingerprint === fingerprint);
    
    if (item) {
        const input = document.getElementById(`manifest_inv_${fingerprint}`);
        // Save the value and force Uppercase for a professional look
        item.Invoice_No = input.value.trim().toUpperCase();
        localStorage.setItem('masterOrders', JSON.stringify(orders));
    }
};