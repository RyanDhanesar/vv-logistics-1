// ============================================================
// dispatch.js — Load Sheet Management & Verification
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('dispatchTableContainer')) {
        renderDispatchTable();
    }
});

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function _getMasterOrders() {
    try {
        return JSON.parse(localStorage.getItem('masterOrders')) || [];
    } catch {
        console.error("dispatch.js: masterOrders corruption detected.");
        return [];
    }
}

function _saveMasterOrders(orders) {
    localStorage.setItem('masterOrders', JSON.stringify(orders));
}

function _getDescription(item) {
    const descKey = Object.keys(item).find(k => k.toLowerCase().includes('desc'));
    return descKey ? item[descKey] : (item.name || item.product || '---');
}

// ─────────────────────────────────────────────────────────────
// MAIN RENDER
// ─────────────────────────────────────────────────────────────

function renderDispatchTable() {
    const container = document.getElementById('dispatchTableContainer');
    if (!container) return;

    const masterOrders = _getMasterOrders();
    
    // Get all unique TripIDs (DRAFT, VERIFIED, MANIFESTED, and DISPATCHED)
    const allLoadSheetIDs = [...new Set(masterOrders.filter(o => o.TripID).map(o => o.TripID))];

    if (allLoadSheetIDs.length === 0) {
        container.innerHTML = `
            <div class="p-5 text-center bg-white border rounded-4 shadow-sm">
                <i class="bi bi-file-earmark-x display-1 text-light mb-3"></i>
                <h5 class="fw-bold text-dark">No Active Load Sheets</h5>
                <p class="text-muted small">Go to the Create Draft section to build a load sheet.</p>
                <button class="btn btn-primary btn-sm fw-bold px-4" onclick="showSection('masterPane')">GO TO BUILDER</button>
            </div>`;
        return;
    }

    // --- SLEEK HORIZONTAL REGISTRY RIBBON ---
    let html = `
        <div class="mb-4 d-flex align-items-center justify-content-between no-print">
            <div>
                <p class="text-muted smallest text-uppercase fw-bold mb-0" style="letter-spacing:1px;">Active & Recent Load Sheets</p>
            </div>
            <button class="btn btn-sm btn-light border fw-bold text-secondary px-3" onclick="window.selectedTrip=null; renderDispatchTable();">
                <i class="bi bi-arrow-clockwise me-1"></i> REFRESH LIST
            </button>
        </div>

        <div class="d-flex align-items-center gap-2 mb-5 pb-2 border-bottom overflow-auto no-print" style="white-space: nowrap; scrollbar-width: thin;">
            ${allLoadSheetIDs.map(id => {
                const lsItems = masterOrders.filter(o => o.TripID === id);
                const status = lsItems[0].Status;
                const isSelected = window.selectedTrip === id;
                
                let pillClass = "bg-white text-secondary border";
                let icon = "bi-file-earmark-text";

                if (status === 'MANIFESTED') {
                    pillClass = "bg-success-subtle text-success border-success-subtle";
                    icon = "bi-file-earmark-check";
                } else if (status === 'DISPATCHED') {
                    pillClass = "bg-dark-subtle text-dark border-dark-subtle opacity-75";
                    icon = "bi-truck-flatbed";
                } else if (status === 'VERIFIED') {
                    pillClass = "bg-info-subtle text-info border-info-subtle";
                    icon = "bi-check2-circle";
                }
                
                if (isSelected) pillClass = "bg-primary text-white border-primary shadow-sm";

                return `
                <div class="px-3 py-2 rounded-3 fw-bold small transition-all ${pillClass}" 
                     style="cursor:pointer; min-width:140px; border: 1px solid;"
                     onclick="window.selectedTrip='${id}'; renderDispatchTable();">
                    <div class="smallest opacity-75 text-uppercase" style="font-size:0.6rem;">${status}</div>
                    <i class="bi ${icon} me-1"></i> ${id}
                </div>`;
            }).join('')}
        </div>
    `;

    // --- DETAIL VIEW LOGIC ---
    if (window.selectedTrip && allLoadSheetIDs.includes(window.selectedTrip)) {
        const filteredItems = masterOrders.filter(o => o.TripID === window.selectedTrip);
        const lsStatus = filteredItems[0].Status;
        
        // LOCK LOGIC: If manifested or dispatched, set isLocked to true
        const isLocked = lsStatus === 'MANIFESTED' || lsStatus === 'DISPATCHED';

        const verifiedCount = filteredItems.filter(o => o.Status === 'VERIFIED' || o.Status === 'MANIFESTED' || o.Status === 'DISPATCHED').length;
        const totalCount = filteredItems.length;
        const allVerified = verifiedCount === totalCount;
        const progressPct = Math.round((verifiedCount / totalCount) * 100);
        const reasons = ["Truck Full", "Stock Damaged", "Short Picked"];

        // CALCULATE TOTALS FOR RIBBON
        const totalPlannedUnits = filteredItems.reduce((sum, item) => sum + (parseInt(item.staged_qty) || 0), 0);
        const totalActualUnits = filteredItems.reduce((sum, item) => sum + (parseInt(item.Final_Loaded ?? item.staged_qty) || 0), 0);

        html += `
            <div class="section-container" id="printableArea">
                <div class="card mb-4 border-0 shadow-sm overflow-hidden" style="border-radius:12px;">
                    <div class="card-body bg-white d-flex justify-content-between align-items-center p-3">
                        <div class="d-flex align-items-center gap-2">
                            <h5 class="fw-bold mb-0 me-3">${window.selectedTrip}</h5>
                            ${isLocked ? 
                                `<span class="badge bg-dark text-white"><i class="bi bi-lock-fill me-1"></i> READ-ONLY</span>` : 
                                `<span class="badge bg-primary">ACTIVE EDITING</span>`}
                        </div>
                        <div class="d-flex gap-2 no-print">
                            <button class="btn btn-outline-dark btn-sm fw-bold shadow-sm" onclick="window.print()">
                                <i class="bi bi-printer me-1"></i> PRINT LOAD SHEET
                            </button>
                            ${!isLocked ? `
                                <button class="btn btn-outline-danger btn-sm fw-bold" onclick="deleteFullLoadSheet('${window.selectedTrip}')">
                                    <i class="bi bi-trash3 me-1"></i> DELETE
                                </button>
                                <button class="btn btn-primary btn-sm fw-bold px-3 shadow-sm" onclick="showSection('masterPane')">
                                    <i class="bi bi-plus-lg me-1"></i> ADD MORE
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="progress rounded-0 no-print" style="height:4px; background: #f1f5f9;">
                        <div class="progress-bar ${allVerified ? 'bg-success' : 'bg-primary'}"
                             style="width:${progressPct}%; transition: width 0.4s ease;"></div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm overflow-hidden" style="border-radius:12px;">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="bg-light">
                                <tr style="border-bottom: 2px solid #e2e8f0;">
                                    <th class="ps-4 text-secondary smallest fw-800 text-uppercase" style="width:150px;">Area</th>
                                    <th class="text-secondary smallest fw-800 text-uppercase" style="width:300px;">Description</th>
                                    <th class="text-center text-secondary smallest fw-800 text-uppercase" style="width:100px;">Planned</th>
                                    <th class="text-center text-secondary smallest fw-800 text-uppercase" style="width:120px;">Actual</th>
                                    <th class="text-secondary smallest fw-800 text-uppercase" style="width:200px;">Shortage Reason</th>
                                    <th class="text-center text-secondary smallest fw-800 text-uppercase" style="width:120px;">Status</th>
                                    <th class="text-end pe-4 text-secondary smallest fw-800 text-uppercase no-print">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white">
                                ${filteredItems.map(item => renderDispatchRow(item, reasons, isLocked)).join('')}
                            </tbody>
                            <tfoot class="bg-light fw-bold">
                                <tr>
                                    <td colspan="2" class="ps-4 text-uppercase small">Truck Payload Totals</td>
                                    <td class="text-center text-dark">${totalPlannedUnits}</td>
                                    <td class="text-center text-primary">${totalActualUnits}</td>
                                    <td colspan="3"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div class="mt-4 p-4 bg-white rounded-4 border shadow-sm d-flex justify-content-between align-items-center no-print">
                    <div>
                        <h6 class="fw-bold mb-1 text-dark">Workflow Control</h6>
                        <p class="small text-muted mb-0">Status: <b>${lsStatus}</b>. Total items: ${totalCount}</p>
                    </div>
                    <div class="d-flex gap-2">
                        ${lsStatus === 'MANIFESTED' ? 
                            `<button class="btn btn-primary fw-bold px-5 py-2 shadow-sm" onclick="showSection('manifestPane')">VIEW MANIFEST &rarr;</button>` :
                          lsStatus === 'DISPATCHED' ?
                            `<button class="btn btn-outline-secondary fw-bold px-5 py-2" onclick="showSection('historyPane')">VIEW IN ARCHIVE</button>` :
                            `<button class="btn btn-success fw-bold px-5 py-2 shadow-sm" onclick="sendToDriver()" ${!allVerified ? 'disabled' : ''}>FINALISE & MANIFEST &rarr;</button>`
                        }
                    </div>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="text-center p-5 border rounded-4 bg-light text-muted no-print" style="border-style: dashed !important;">
                <i class="bi bi-cursor display-6 d-block mb-3 opacity-50"></i>
                Select a Load Sheet from the registry above to manage items.
            </div>`;
    }

    container.innerHTML = html;
}

window.removeLineFromTrip = (fingerprint) => {
    const item = masterOrders.find(o => o.fingerprint === fingerprint);
    if (!item) return;

    if (confirm(`Remove ${item.Area} from this Load Sheet?`)) {
        // 1. Put the staged units back into the available remainder
        item.qty += (item.staged_qty || 0);
        
        // 2. Clear the logistics data
        item.staged_qty = 0;
        item.Final_Loaded = undefined;
        item.TripID = null;
        item.Status = 'Pending';

        localStorage.setItem('masterOrders', JSON.stringify(masterOrders));
        renderDispatchTable();
        alert("Units returned to the master pool.");
    }
};

window.openLoadSheetForEdit = (lsID) => {
    window.selectedTrip = lsID;
    // We scroll to or reveal the verification table here
    // For now, let's reuse the logic that builds the verification table
    renderLoadSheetDetail(lsID);
};

window.viewManifestFromRegistry = (lsID) => {
    window.activeManifestID = lsID;
    showSection('manifestPane');
};

window.sendToDriver = () => {
    const masterOrders = _getMasterOrders();
    const currentTripItems = masterOrders.filter(o => o.TripID === window.selectedTrip);

    if (currentTripItems.length === 0) return alert("No items found to manifest.");

    if (!confirm(`Finalize ${window.selectedTrip}? This will lock the load sheet and generate the official manifest. Any shortages will be returned to the Master Stock.`)) return;

    // 1. PROCESS ITEMS & REFUND SHORTAGES
    masterOrders.forEach(item => {
        if (item.TripID === window.selectedTrip) {
            const planned = parseInt(item.staged_qty || 0);
            const actual = item.Final_Loaded !== undefined ? parseInt(item.Final_Loaded) : planned;
            const shortage = planned - actual;

            if (shortage > 0) {
                // THIS LINE UPDATES THE MAIN TABLE REMAINDER
                item.qty = (parseInt(item.qty) || 0) + shortage;
                
                // Adjust the staged_qty so the Manifest shows the correct '3'
                item.staged_qty = actual; 
            }
            item.Status = 'MANIFESTED';
        }
    });

    // 3. SAVE DATABASE
    _saveMasterOrders(masterOrders);

    // 4. UI REFRESH (The Missing Step)
    // This tells the main script to re-draw the table with the new numbers
    if (typeof renderMasterTable === 'function') {
        renderMasterTable();
    }
    
    // Also update the Load Tray if it's open
    if (typeof renderLoadTray === 'function') {
        renderLoadTray();
    }

    // 5. UI FEEDBACK
    alert(`✅ ${window.selectedTrip} has been finalized. Shortages returned to Master Stock.`);
    
    // 6. NAVIGATE
    window.activeManifestID = window.selectedTrip; 
    showSection('manifestPane');
};

function renderDispatchRow(item, reasons, isLocked) {
    const isDone = item.Status === 'VERIFIED' || item.Status === 'MANIFESTED' || item.Status === 'DISPATCHED';
    const planned = item.staged_qty || 0;
    
    let savedReason = "";
    if (item.Note) {
        reasons.forEach(r => { if (item.Note.includes(r)) savedReason = r; });
        if (item.Note.includes('SHORT') && !savedReason) savedReason = "Other";
    }

    return `
        <tr class="${isDone ? 'bg-light-subtle' : ''}">
            <td class="ps-4 fw-bold text-dark">${item.Area || '—'}</td>
            <td class="small">
                <div class="fw-bold text-dark">${_getDescription(item)}</div>
                ${item.Note ? `<div class="smallest text-primary mt-1 fst-italic">${item.Note}</div>` : ''}
            </td>
            <td class="text-center fw-bold text-muted">${planned}</td>
            <td>
                <input type="number" id="actual_${item.fingerprint}" 
                       class="form-control form-control-sm text-center fw-bold border-primary mx-auto" 
                       style="width:75px; background: ${isLocked ? '#f8f9fa' : '#f0f7ff'};"
                       value="${item.Final_Loaded ?? planned}"
                       ${isLocked ? 'disabled' : ''}
                       oninput="window.passiveSaveLine('${item.fingerprint}')">
            </td>
            <td>
                <select class="form-select form-select-sm border-0 bg-light small" 
                        id="reason_${item.fingerprint}"
                        ${isLocked ? 'disabled' : ''}
                        oninput="window.passiveSaveLine('${item.fingerprint}')">
                    <option value="" ${savedReason === "" ? 'selected' : ''}>-- No Issue --</option>
                    ${reasons.map(r => `<option value="${r}" ${savedReason === r ? 'selected' : ''}>${r}</option>`).join('')}
                    <option value="Other" ${savedReason === "Other" ? 'selected' : ''}>Other...</option>
                </select>
            </td>
            <td class="text-center">
                <span class="badge ${isDone ? 'bg-success' : 'bg-light text-secondary border'} px-2 py-1">
                    ${item.Status === 'MANIFESTED' || item.Status === 'DISPATCHED' ? item.Status : (isDone ? 'VERIFIED' : 'PENDING')}
                </span>
            </td>
            <td class="text-end pe-4 no-print">
                <div class="d-flex gap-1 justify-content-end">
                    ${!isLocked ? `
                        <button class="btn btn-sm ${isDone ? 'btn-outline-dark' : 'btn-primary'} fw-bold" 
                                onclick="verifyLineItem('${item.fingerprint}')">
                            ${isDone ? 'UPDATE' : 'VERIFY'}
                        </button>
                        <button class="btn btn-sm btn-link text-danger text-decoration-none" onclick="pullBackLine('${item.fingerprint}')">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    ` : `
                        <span class="text-muted small px-2"><i class="bi bi-lock-fill"></i> Locked</span>
                    `}
                </div>
            </td>
        </tr>
    `;
}

window.passiveSaveLine = (fingerprint) => {
    const masterOrders = _getMasterOrders();
    const item = masterOrders.find(o => o.fingerprint === fingerprint);
    if (!item) return;

    const actualInput = document.getElementById(`actual_${fingerprint}`);
    const reasonSelect = document.getElementById(`reason_${fingerprint}`);
    
    if (!actualInput || !reasonSelect) return;

    const actualQty = parseInt(actualInput.value);
    const planned = item.staged_qty || 0;
    const reason = reasonSelect.value;

    // Update the record silently in memory
    item.Final_Loaded = isNaN(actualQty) ? planned : actualQty;
    
    if (actualQty < planned) {
        item.BounceBackQty = planned - actualQty;
        item.Note = `SHORT: ${item.BounceBackQty} units (${reason || 'Reason Pending'})`;
    } else if (actualQty > planned) {
        item.Note = `OVER-LOADED (+${actualQty - planned})`;
    } else {
        item.BounceBackQty = 0;
        item.Note = "Fully Loaded";
    }

    // Save to database but DO NOT call renderDispatchTable()
    _saveMasterOrders(masterOrders);
    
    console.log(`Passive save complete for ${fingerprint}: ${item.Final_Loaded} units.`);
};

// ─────────────────────────────────────────────────────────────
// LOGIC FUNCTIONS
// ─────────────────────────────────────────────────────────────
window.verifyLineItem = (fingerprint) => {
    const masterOrders = _getMasterOrders();
    const item = masterOrders.find(o => o.fingerprint === fingerprint);
    if (!item) return;

    const actualInput = document.getElementById(`actual_${fingerprint}`);
    const reasonSelect = document.getElementById(`reason_${fingerprint}`);
    
    const actualQty = parseInt(actualInput.value);
    const planned = item.staged_qty || 0;
    let reason = reasonSelect.value;

    // 1. VALIDATION
    if (isNaN(actualQty) || actualQty < 0) return alert("Please enter a valid loaded quantity.");
    if (actualQty < planned && !reason) return alert("A reason is required if you are loading less than planned.");

    // 2. SPECIAL HANDLING: "Other" Reason
    if (actualQty < planned && reason === 'Other') {
        const custom = prompt("Enter specific reason for shortage:");
        if (!custom) return; // Cancel if they don't provide details for 'Other'
        reason = custom;
    }

    // 3. APPLY VERIFICATION & UPDATE NOTES
    item.Final_Loaded = actualQty;
    item.Status = 'VERIFIED';
    
    if (actualQty < planned) {
        item.BounceBackQty = planned - actualQty;
        item.Note = `SHORT: ${item.BounceBackQty} units (${reason})`;
    } else if (actualQty > planned) {
        item.BounceBackQty = 0;
        item.Note = `OVER-LOADED (+${actualQty - planned})`;
    } else {
        item.BounceBackQty = 0;
        item.Note = "Fully Loaded";
    }

    // 4. SAVE & REDRAW
    _saveMasterOrders(masterOrders);
    
    // Now when this re-renders, it pulls the latest numbers for ALL rows 
    // from localStorage (thanks to the passive save)
    renderDispatchTable();
};


window.pullBackLine = (fingerprint) => {
    const masterOrders = _getMasterOrders();
    const item = masterOrders.find(o => o.fingerprint === fingerprint);
    if (!item || !confirm(`Remove "${item.Area}" from this load sheet?`)) return;

    item.qty = (item.qty || 0) + (item.staged_qty || 0);
    item.staged_qty = 0;
    item.Status = 'Pending';
    item.TripID = null;
    delete item.Final_Loaded;
    delete item.Note;

    _saveMasterOrders(masterOrders);
    renderDispatchTable();
};

window.deleteFullLoadSheet = (tripID) => {
    if(!confirm(`Delete entire Load Sheet ${tripID}?\nStock will return to the Master Table.`)) return;
    
    const masterOrders = _getMasterOrders();
    masterOrders.forEach(o => {
        if(o.TripID === tripID) {
            o.qty += (o.staged_qty || 0);
            o.staged_qty = 0;
            o.Status = 'Pending';
            o.TripID = null;
            delete o.Final_Loaded;
            delete o.Note;
        }
    });
    
    _saveMasterOrders(masterOrders);
    window.selectedTrip = null;
    renderDispatchTable();
};

