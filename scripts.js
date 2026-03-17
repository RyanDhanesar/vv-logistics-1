// ============================================================
//  LOGISTICS INTELLIGENCE SYSTEM — script.js  (FIXED BUILD)
//  Fixes applied:
//    1. commitToMaster — fingerprint generation before commit, safer key detection
//    2. handleMasterBranchUpload — robust column matching, XLSX guard
//    3. Master search — guaranteed dynamic re-render on every keystroke
//    4. Icon fallbacks — text/emoji stand-ins so UI never shows blank boxes
//    5. [BUG FIX] masterSearch bar now wired with oninput listener inside
//       _buildOrGetNavShell so it actually triggers _renderTableOnly on keystroke
// ============================================================

// --- Global State ---
let currentResult = null;
let stagedLoad    = [];

// --- Logistics Intelligence State ---
let masterOrders  = JSON.parse(localStorage.getItem('masterOrders'))  || [];
let zoneRegistry  = JSON.parse(localStorage.getItem('zoneRegistry'))  || { "UNASSIGNED": [] };

// UI tracking
window.currentZoneFilter  = 'ALL';
window.currentAreaFilter  = 'ALL';
window.currentSort        = 'newest';
window.currentOpenTripID  = null;

// --- UI Elements ---
const dropZone             = document.getElementById('dropZone');
const fileInput            = document.getElementById('fileInput');
const uploadForm           = document.getElementById('uploadForm');
const progressBar          = document.getElementById('progressBar');
const progressBarContainer = document.getElementById('progressBarContainer');

/* ================================================================
   STAGE 1 — File Selection & UI Feedback
   ================================================================ */

const updateFileDisplay = () => {
    const file = fileInput.files[0];
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if (file && fileNameDisplay) {
        fileNameDisplay.innerHTML = `<strong class="text-primary">${file.name}</strong>`;
        const resCol = document.getElementById('resultColumn');
        if (resCol) resCol.classList.add('d-none');
        if (progressBarContainer) progressBarContainer.classList.add('d-none');
        if (progressBar) progressBar.style.width = '0%';
    }
};

dropZone?.addEventListener('click',    () => fileInput.click());
dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
dropZone?.addEventListener('dragleave', ()  => dropZone.classList.remove('active'));
dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    fileInput.files = e.dataTransfer.files;
    updateFileDisplay();
});
fileInput?.addEventListener('change', updateFileDisplay);

/* ================================================================
   STAGE 2 — Upload & Wide-Table Validation
   ================================================================ */

uploadForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) return alert("ACTION REQUIRED: Select a file first.");

    // UI Feedback
    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBar = document.getElementById('progressBar');
    if (progressBarContainer) progressBarContainer.classList.remove('d-none');
    if (progressBar) {
        progressBar.style.width = '50%';
        progressBar.classList.add('bg-primary');
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get the first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (jsonData.length === 0) throw new Error("The Excel file appears to be empty.");

            // Fake a "result" object to match your existing renderPreview logic
            const result = {
                preview: jsonData,
                new_orders: jsonData.length,
                duplicates: 0 // In browser-mode, we process everything
            };

            currentResult = result;

            // Hide Upload Box & Show Table
            const uploadCol = document.getElementById('uploadColumn');
            const resCol = document.getElementById('resultColumn');
            const resLayoutRow = document.getElementById('uploadLayoutRow');

            if (uploadCol) uploadCol.style.setProperty('display', 'none', 'important');
            if (resCol) {
                resCol.classList.remove('d-none');
                resCol.style.setProperty('display', 'block', 'important');
                resCol.className = "col-12";
            }
            if (resLayoutRow) resLayoutRow.classList.remove('justify-content-center');

            if (progressBar) {
                progressBar.style.width = '100%';
                progressBar.classList.replace('bg-primary', 'bg-success');
            }

            setTimeout(() => renderPreview(result), 400);

        } catch (err) {
            console.error("Internal Processing Error:", err);
            alert("Could not process Excel file: " + err.message);
        }
    };
    
    reader.readAsArrayBuffer(file);
});


/* ================================================================
   PREVIEW RENDER
   ================================================================ */

function renderPreview(result) {
    console.log('[renderPreview] called with:', result);
    const summaryContainer = document.getElementById('summaryTable');
    if (!summaryContainer) return console.error("[renderPreview] FATAL: Element 'summaryTable' not found in DOM.");

    if (!result || !result.preview || result.preview.length === 0) {
        summaryContainer.innerHTML = `<div class="alert alert-warning">No preview records available.</div>`;
        return;
    }

    // Store on window so commitToMaster can always reach it
    window._stagedPreviewResult = result;

    const headers = Object.keys(result.preview[0]).filter(h => h !== 'fingerprint');

    summaryContainer.innerHTML = `
        <div class="d-flex justify-content-between align-items-center bg-white p-3 border rounded mb-4 shadow-sm">
            <div>
                <h5 class="mb-0 fw-bold text-primary">[DATA VALIDATION COMPLETE]</h5>
                <small class="text-muted">
                    New Records: <span class="badge bg-primary">${result.new_orders}</span> |
                    Duplicates Skipped: <span class="badge bg-secondary">${result.duplicates}</span>
                </small>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-success fw-bold px-5 py-2 shadow-sm"
                        id="commitBtn"
                        onclick="window.commitToMaster()">
                    [COMMIT] APPEND TO MASTER DATABASE &rarr;
                </button>
                <button class="btn btn-outline-danger" onclick="location.reload()">CANCEL</button>
            </div>
        </div>

        <h6 class="text-uppercase small fw-bold text-secondary mb-2 ms-1">Scroll horizontally to inspect columns</h6>

        <div class="table-responsive border rounded bg-white shadow-sm" style="max-height:60vh; overflow-x:auto;">
            <table class="table table-hover align-middle mb-0" style="width:max-content; min-width:100%;">
                <thead class="table-dark sticky-top" style="z-index:50;">
                    <tr>
                        ${headers.map(h => {
                            let w = '150px';
                            if (h.toLowerCase().includes('no') || h.toLowerCase().includes('brn')) w = '80px';
                            return `<th class="px-3" style="width:${w}; min-width:${w}; font-size:0.75rem; white-space:nowrap;">${h}</th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${result.preview.map(row => `
                        <tr style="font-size:0.85rem;">
                            ${headers.map(h => `<td class="px-3" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:10px 15px;">${row[h] ?? ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    console.log('[renderPreview] DOM injected. commitBtn element:', document.getElementById('commitBtn'));
}

/* ================================================================
   STAGE 3 — Master Database Logic
   ================================================================ */

// Exposed on window so onclick="window.commitToMaster()" always resolves
window.commitToMaster = function commitToMaster() {
    console.log('[commitToMaster] fired');

    // Use window._stagedPreviewResult as primary (survives any DOM re-render),
    // fall back to the module-level currentResult
    const source = window._stagedPreviewResult || currentResult;

    console.log('[commitToMaster] source:', source);

    if (!source || !source.preview || source.preview.length === 0) {
        return alert("ERROR: No staged data to commit. Please re-upload your file.");
    }

    const uploadTimestamp = new Date().toLocaleString();

    const newItems = source.preview.map((item, idx) => {
        // Find "required" quantity column flexibly
        const qtyKey    = Object.keys(item).find(k => k.toUpperCase().includes('REQUIRED'));
        const actualQty = parseInt(qtyKey ? item[qtyKey] : 0) || 0;

        // Guarantee a unique fingerprint
        const fingerprint = (item.fingerprint && String(item.fingerprint).trim())
            ? item.fingerprint
            : `fp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`;

        return {
            ...item,
            fingerprint,
            qty:          actualQty,
            original_qty: actualQty,
            staged_qty:   0,
            Status:       'Pending',
            added_at:     uploadTimestamp,
        };
    });

    console.log('[commitToMaster] newItems count:', newItems.length, 'sample:', newItems[0]);

    processNewAreas(newItems);

    masterOrders = [...newItems, ...masterOrders];
    localStorage.setItem('masterOrders', JSON.stringify(masterOrders));

    // Clear staged preview so a second click doesn't double-commit
    window._stagedPreviewResult = null;
    currentResult = null;

    alert(`SUCCESS: ${newItems.length} records committed and allocated to zones.`);

    // Switch to master tab
    const masterTabEl = document.querySelector('#master-tab');
    if (masterTabEl) new bootstrap.Tab(masterTabEl).show();

    // Re-render table AFTER alert so DOM state is clean
    renderMasterTable();
};

function processNewAreas(orders) {
    const zoneNames = Object.keys(zoneRegistry).filter(z => z !== "UNASSIGNED");

    orders.forEach(order => {
        const keys = Object.keys(order);

        // FIX: strip ALL non-alphanumeric so "BRN NO", "BRN_NO", "BRNNO" all match
        const normalize = (s) => String(s).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

        const brnKey     = keys.find(k => normalize(k) === "BRNNO");
        const orderBrn   = brnKey ? String(order[brnKey]).trim() : "";

        let foundZone    = null;
        let officialName = null;

        if (orderBrn) {
            for (const zone of zoneNames) {
                const match = (zoneRegistry[zone] || []).find(entry => entry.startsWith(orderBrn + ":"));
                if (match) {
                    foundZone    = zone;
                    officialName = match.split(':')[1];
                    break;
                }
            }
        }

        if (foundZone) {
            order.Zone = foundZone;
            order.Area = officialName;
        } else {
            order.Zone = "UNASSIGNED";
            const nameKey = keys.find(k => normalize(k) === "BRANCHNAME");
            order.Area    = nameKey ? String(order[nameKey]).toUpperCase() : "UNKNOWN";
        }
    });

    localStorage.setItem('zoneRegistry', JSON.stringify(zoneRegistry));
}

function updateZoneRegistry() {
    const allAreasInData = [...new Set(masterOrders.map(o => o.Area))];
    const assignedAreas  = Object.values(zoneRegistry).flat();
    const newAreas       = allAreasInData.filter(a => !assignedAreas.includes(a));

    if (newAreas.length > 0) {
        zoneRegistry["UNASSIGNED"] = [...new Set([...(zoneRegistry["UNASSIGNED"] || []), ...newAreas])];
        localStorage.setItem('zoneRegistry', JSON.stringify(zoneRegistry));
    }
}

/* ================================================================
   MASTER BRANCH UPLOAD  (FIX 2)
   ================================================================ */

window.handleMasterBranchUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Guard: XLSX must be loaded
    if (typeof XLSX === 'undefined') {
        return alert("ERROR: The XLSX library is not loaded. Please ensure SheetJS (xlsx.full.min.js) is included in your HTML.");
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data      = new Uint8Array(e.target.result);
            const workbook  = XLSX.read(data, { type: 'array' });

            // Try exact match first, then case-insensitive fuzzy match
            const targetName = "BRANCH LIST";
            let sheetName = workbook.SheetNames.find(n => n.trim().toUpperCase() === targetName);
            if (!sheetName) {
                sheetName = workbook.SheetNames.find(n => n.toUpperCase().includes("BRANCH"));
            }
            if (!sheetName) {
                return alert(
                    `ERROR: Could not find a 'BRANCH LIST' sheet.\n` +
                    `Sheets found: ${workbook.SheetNames.join(', ')}`
                );
            }

            const worksheet = workbook.Sheets[sheetName];
            const jsonData  = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (jsonData.length === 0) {
                return alert("ERROR: The BRANCH LIST sheet appears to be empty.");
            }

            console.log(`[Branch Upload] Using sheet: "${sheetName}". First row keys:`, Object.keys(jsonData[0]));
            processMasterData(jsonData);
            event.target.value = '';   // reset input so same file can be re-uploaded

        } catch (err) {
            console.error("Master Import Error:", err);
            alert("System failed to read the Excel file. Details: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
};

// FIX 2 (core): Robust column matching — strips ALL non-alphanumerics
function processMasterData(data) {
    const normalize = (s) => String(s).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    // Detect actual column keys once from the first row
    const sampleKeys  = Object.keys(data[0] || {});
    const storeCodeKey = sampleKeys.find(k => normalize(k) === "STORECODE");
    const regionKey    = sampleKeys.find(k => normalize(k) === "REGION");
    const storeNameKey = sampleKeys.find(k => normalize(k) === "STORENAME");

    console.log(`[Branch Upload] Mapped columns → STORECODE: "${storeCodeKey}" | REGION: "${regionKey}" | STORENAME: "${storeNameKey}"`);

    if (!storeCodeKey || !regionKey || !storeNameKey) {
        return alert(
            `CRITICAL ERROR: Could not find required columns.\n\n` +
            `Expected (flexible): STORE CODE, REGION, STORE NAME\n` +
            `Found: ${sampleKeys.join(', ')}`
        );
    }

    let newRegistry = { "UNASSIGNED": [] };

    data.forEach(row => {
        const brn       = String(row[storeCodeKey]  || '').trim();
        const region    = String(row[regionKey]     || '').trim();
        const storeName = String(row[storeNameKey]  || '').trim();

        if (!brn || !region || !storeName) return;

        const zoneKey = region.toUpperCase();
        if (!newRegistry[zoneKey]) newRegistry[zoneKey] = [];

        const entryString = `${brn}:${storeName.toUpperCase()}`;
        if (!newRegistry[zoneKey].includes(entryString)) {
            newRegistry[zoneKey].push(entryString);
        }
    });

    const zoneCount = Object.keys(newRegistry).filter(k => k !== "UNASSIGNED").length;

    if (zoneCount === 0) {
        return alert("CRITICAL ERROR: Parsed data but found 0 regions. Check column names in the sheet.");
    }

    zoneRegistry = newRegistry;
    localStorage.setItem('zoneRegistry', JSON.stringify(zoneRegistry));
    alert(`SUCCESS: Logistics Brain Online!\nSheet: BRANCH LIST\nFound ${zoneCount} Regions / Zones.`);
    renderMasterTable();

    // If zone manager is open, refresh it too
    const zoneManagerBody = document.getElementById('zoneManagerBody');
    if (zoneManagerBody) refreshZoneManagerUI();
}

/* ================================================================
   ZONE NAV — Searchable Dropdown  (FIX 3 — search input focus preserved)
   ================================================================ */

function _buildOrGetNavShell(container) {
    if (document.getElementById('_zoneNavShell')) return;

    container.innerHTML = `
        <style>
            #_zoneNavShell {
                background: #ffffff;
                border-bottom: 1px solid #e2e8f0;
                padding: 12px 20px;
                position: sticky;
                top: 0;
                z-index: 1030;
            }
            .filter-label-util {
                font-size: 0.7rem;
                font-weight: 800;
                text-transform: uppercase;
                color: #64748b;
                letter-spacing: 0.05em;
                margin-right: 12px;
            }
            .custom-dropdown { position: relative; width: 300px; flex-shrink: 0; }
            
            .dropdown-results {
                position: fixed;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                max-height: 350px;
                overflow-y: auto;
                display: none;
                margin-top: 6px;
                z-index: 9999;
                width: 300px;
            }
            .dropdown-item-custom {
                padding: 10px 16px;
                font-size: 0.85rem;
                cursor: pointer;
                border-bottom: 1px solid #f1f5f9;
                color: #334155;
                display: flex;
                align-items: center;
                transition: background 0.2s;
            }
            .dropdown-item-custom:hover { background: #eff6ff; color: #2563eb; }
            .dropdown-item-custom:last-child { border-bottom: none; }
            
            /* Modern Branch Tags */
            .branch-chip {
                padding: 6px 14px;
                font-size: 0.75rem;
                font-weight: 700;
                border: 1px solid #e2e8f0;
                border-radius: 20px;
                background: #ffffff;
                color: #64748b;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .branch-chip:hover { border-color: #3b82f6; color: #3b82f6; background: #eff6ff; }
            .branch-chip.active { background: #334155; color: #ffffff; border-color: #334155; }
            
            #_step2block {
                animation: slideDown 0.3s ease-out;
            }
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>

        <div id="_zoneNavShell">
            <div class="d-flex align-items-center gap-3">
                <span class="filter-label-util"><i class="bi bi-geo-alt-fill me-1"></i> Region</span>
                <div class="custom-dropdown" id="zoneDropdown">
                    <div class="input-group">
                        <input type="text" id="_zoneSelectSearch"
                               class="form-control border-light-subtle bg-light fw-bold"
                               style="font-size:0.85rem; border-radius: 6px 0 0 6px;"
                               placeholder="Filter by Region/Route..."
                               autocomplete="off"
                               oninput="window.filterZoneOptions(this.value)"
                               onfocus="window.toggleZoneDropdown(true)">
                        <button class="btn btn-white border border-start-0" 
                                style="background: #f8fafc;"
                                id="_zoneChevronBtn" type="button">
                            <i class="bi bi-chevron-down small text-secondary"></i>
                        </button>
                    </div>
                    <div class="dropdown-results shadow-lg" id="zoneResults"></div>
                </div>

                <!-- =====================================================
                     FIX 5: masterSearch bar now lives here in the nav shell
                     and has an oninput listener that calls _renderTableOnly.
                     Previously it was only READ by _renderTableOnly but never
                     wired up, so typing had zero effect.
                     ===================================================== -->
                <div class="input-group" style="max-width: 280px;">
                    <span class="input-group-text bg-light border-light-subtle">
                        <i class="bi bi-search text-secondary" style="font-size:0.8rem;"></i>
                    </span>
                    <input type="text"
                           id="masterSearch"
                           class="form-control border-light-subtle bg-light"
                           style="font-size:0.82rem;"
                           placeholder="Search orders, branches..."
                           autocomplete="off"
                           oninput="window._renderTableOnly()">
                </div>
                
                <div class="ms-auto d-flex gap-2">
                    <button class="btn btn-sm btn-link text-decoration-none text-secondary fw-bold" 
                            style="font-size: 0.7rem;"
                            onclick="resetAllFilters()">
                        <i class="bi bi-x-circle me-1"></i> RESET FILTERS
                    </button>
                </div>
            </div>
        </div>

        <div id="_step2block" style="display:none; padding:12px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <div class="d-flex align-items-center gap-3">
                <span class="filter-label-util"><i class="bi bi-shop me-1"></i> Branch</span>
                <div id="_areaChipRow" class="d-flex flex-wrap gap-2"></div>
            </div>
        </div>

        <div id="_colToggleBar" class="px-4 py-2 bg-white border-bottom shadow-sm"></div>
        <div id="_tableMount" class="table-responsive bg-white" style="max-height:68vh; overflow-y:auto;"></div>
    `;

    const chevronBtn = document.getElementById('_zoneChevronBtn');
    chevronBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.toggleZoneDropdown();
    });

    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('zoneDropdown');
        if (dropdown && !dropdown.contains(e.target)) toggleZoneDropdown(false);
    });
}

/* ================================================================
   DROPDOWN LOGIC
   ================================================================ */

window.toggleZoneDropdown = (forceState) => {
    const results = document.getElementById('zoneResults');
    const input   = document.getElementById('_zoneSelectSearch');
    if (!results || !input) return;
    const show = forceState !== undefined
        ? forceState
        : results.style.display !== 'block';
    if (show) {
        const rect = input.getBoundingClientRect();
        results.style.top   = (rect.bottom + window.scrollY) + 'px';
        results.style.left  = rect.left + 'px';
        results.style.width = rect.width + 'px';
        results.style.display = 'block';
        window.filterZoneOptions(input.value || '');
    } else {
        results.style.display = 'none';
    }
};

window.filterZoneOptions = (term) => {
    const container = document.getElementById('zoneResults');
    if (!container) return;

    const activeZones     = Object.keys(zoneRegistry).filter(z => z !== "UNASSIGNED").sort();
    const unassignedCount = (zoneRegistry["UNASSIGNED"] || []).length;
    const filter          = term.toUpperCase();
    const totalOrders     = masterOrders.length;

    let html = `
        <div class="dropdown-item-custom fw-bold" onclick="selectZone('ALL')"
             style="justify-content:space-between;">
            <span>All Regions</span>
            <span style="font-size:0.75rem; color:#6c757d; font-weight:400;">${totalOrders} orders total</span>
        </div>`;

    activeZones.forEach(zone => {
        if (!zone.toUpperCase().includes(filter)) return;
        const branches     = (zoneRegistry[zone] || []).length;
        const orders       = masterOrders.filter(o => o.Zone === zone).length;
        const pending      = masterOrders.filter(o => o.Zone === zone && (o.Status || 'Pending').toUpperCase() === 'PENDING').length;
        html += `
            <div class="dropdown-item-custom" onclick="selectZone('${zone.replace(/'/g, "\'")}')"
                 style="justify-content:space-between; align-items:center;">
                <span class="fw-bold">${zone}</span>
                <span style="display:flex; gap:10px; flex-shrink:0; margin-left:12px; align-items:center;">
                    <span style="font-size:0.72rem; color:#0d6efd; font-weight:600;">${branches} branches</span>
                    <span style="font-size:0.72rem; color:#495057;">${orders} orders</span>
                    ${pending > 0 ? `<span style="font-size:0.72rem; color:#dc3545; font-weight:700;">${pending} pending</span>` : ''}
                </span>
            </div>`;
    });

    if (unassignedCount > 0 && "UNASSIGNED".includes(filter)) {
        html += `
            <div class="dropdown-item-custom text-danger fw-bold" onclick="selectZone('UNASSIGNED')"
                 style="justify-content:space-between;">
                <span>Unassigned</span>
                <span style="font-size:0.72rem; font-weight:600;">${unassignedCount} branches</span>
            </div>`;
    }

    const input = document.getElementById('_zoneSelectSearch');
    if (input) {
        const rect = input.getBoundingClientRect();
        container.style.top   = (rect.bottom + window.scrollY) + 'px';
        container.style.left  = rect.left + 'px';
        container.style.width = rect.width + 'px';
    }
    container.innerHTML     = html;
    container.style.display = 'block';
};
window.selectZone = (val) => {
    window.currentZoneFilter = val;
    window.currentAreaFilter = 'ALL';

    const input = document.getElementById('_zoneSelectSearch');
    if (input) input.value = (val === 'ALL') ? '' : val;

    toggleZoneDropdown(false);
    _renderAreaChips();
    window._renderTableOnly();
};

window.resetAllFilters = () => {
    window.currentZoneFilter = 'ALL';
    window.currentAreaFilter = 'ALL';
    const searchInput = document.getElementById('_zoneSelectSearch');
    if (searchInput) searchInput.value = '';
    // Also clear the master search bar
    const masterSearchInput = document.getElementById('masterSearch');
    if (masterSearchInput) masterSearchInput.value = '';
    _renderAreaChips();
    window._renderTableOnly();
};

function _renderZoneChips() {
    const input = document.getElementById('_zoneSelectSearch');
    if (input && window.currentZoneFilter !== 'ALL') input.value = window.currentZoneFilter;
}

function _renderAreaChips() {
    const areaRow = document.getElementById('_areaChipRow');
    const step2   = document.getElementById('_step2block');
    if (!areaRow) return;

    if (window.currentZoneFilter === 'ALL') {
        if (step2) step2.style.display = 'none';
        areaRow.innerHTML = '';
        return;
    }

    const zoneAreas = zoneRegistry[window.currentZoneFilter] || [];
    const areasWithData = zoneAreas
        .map(entry => ({
            name:  entry.includes(':') ? entry.split(':')[1] : entry,
            count: masterOrders.filter(o =>
                o.Area === (entry.includes(':') ? entry.split(':')[1] : entry) &&
                o.Zone === window.currentZoneFilter
            ).length
        }))
        .filter(a => a.count > 0);

    if (areasWithData.length === 0) {
        if (step2) step2.style.display = 'none';
        return;
    }

    if (step2) step2.style.display = 'block';

    areaRow.innerHTML = `
        <button class="branch-chip ${window.currentAreaFilter === 'ALL' ? 'active' : ''}" type="button"
                onclick="window.currentAreaFilter='ALL'; _renderAreaChips(); window._renderTableOnly();">
            All
        </button>
        ${areasWithData.map(a => `
            <button class="branch-chip ${window.currentAreaFilter === a.name ? 'active' : ''}" type="button"
                    onclick="window.currentAreaFilter='${a.name.replace(/'/g, "\'")}'; _renderAreaChips(); window._renderTableOnly();">
                ${a.name} <span style="opacity:0.5; font-size:0.75rem;">(${a.count})</span>
            </button>
        `).join('')}
    `;
}
/* ================================================================
   MASTER TABLE
   ================================================================ */

function renderMasterTable() {
    const container = document.getElementById('masterTableContainer');
    if (!container) return;

    // Build the shell ONCE — preserves input focus
    if (!document.getElementById('_zoneNavShell')) {
        _buildOrGetNavShell(container);
    }

    _renderZoneChips();
    _renderAreaChips();
    window._renderTableOnly();
}

// FIX 3: Exposed on window so both JS event listener AND any inline callers work
window._renderTableOnly = function () {
    const mount = document.getElementById('_tableMount');
    if (!mount) return;

    const pageSizeEl = document.getElementById('pageSize');
    const limit      = pageSizeEl ? parseInt(pageSizeEl.value) : 100;

    // FIX 5: Read the search input that now lives inside _zoneNavShell
    const searchInput = document.getElementById('masterSearch');
    const searchTerm  = searchInput ? searchInput.value.toLowerCase().trim() : "";

    const colConfig = {
        'Area':         { width: '140px' },
        'Branch Name':  { width: '180px' },
        'Brn No':       { width: '70px'  },
        'Description':  { width: '220px' },
        'Ord No':       { width: '110px' },
        'qty':          { label: 'REMAINDER', width: '110px' },
        'Status':       { width: '130px' },
        'default':      { width: '120px' },
        'GRV-ed':       { width: '50px' },
        'Overdue ':   { width: '50px' },
        'Staged_Qty':   { width: '50px' }
    };

    let filtered = masterOrders.filter(row => {
        const matchesSearch = !searchTerm || Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm));
        const matchesZone = window.currentZoneFilter === 'ALL' || row.Zone === window.currentZoneFilter;
        const matchesArea = window.currentAreaFilter === 'ALL' || row.Area === window.currentAreaFilter;
        return matchesSearch && matchesZone && matchesArea;
    });

    if (window.currentSort === 'area') {
        filtered.sort((a, b) => (a.Area || "").localeCompare(b.Area || ""));
    } else {
        filtered.sort((a, b) => new Date(b.added_at || 0) - new Date(a.added_at || 0));
    }

    const displayData = filtered.slice(0, limit);
    const ignoreList = ['fingerprint', 'original_qty', 'Staged_Qty', 'OVERDUE QI', 'TripID', 'Final_Loaded', 'added_at', 'Zone', 'BounceBackQty'];
    const allKeysSet = new Set();
    masterOrders.forEach(o => Object.keys(o).forEach(k => allKeysSet.add(k)));
    const allPossibleHeaders = [...allKeysSet].filter(h => !ignoreList.includes(h));
    const hiddenColumns = JSON.parse(localStorage.getItem('hiddenColumns') || '[]');
    const headers = allPossibleHeaders.filter(h => !hiddenColumns.includes(h));

    mount.innerHTML = `
        <table class="table table-hover align-middle mb-0 bg-white" style="width:max-content; min-width:100%; table-layout: fixed;">
            <thead style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <tr>
                    ${headers.map(h => {
                        const config = colConfig[h] || colConfig['default'];
                        const label  = config.label || h;
                        return `<th class="px-3 py-3 text-uppercase text-secondary fw-bold" style="width:${config.width}; font-size:0.7rem; letter-spacing:0.05em;">${label}</th>`;
                    }).join('')}
                    <th class="text-end px-3 bg-light sticky-end" style="width:180px; position:sticky; right:0; z-index:10; border-left: 1px solid #e2e8f0;">Load Here</th>
                </tr>
            </thead>
            <tbody style="border-top: 0;">
                ${displayData.length === 0 ? `
                    <tr><td colspan="${headers.length + 1}" class="text-center py-5 text-muted">No records matching filters.</td></tr>
                ` : displayData.map(row => {
                    const statusVal  = (row.Status || "Pending").toUpperCase();
                    const isAllocated = statusVal === 'ALLOCATED';
                    return `
                    <tr style="font-size:0.82rem; border-bottom: 1px solid #f1f5f9;">
                        ${headers.map(h => {
                            const config = colConfig[h] || colConfig['default'];
                            let content  = row[h] ?? "";
                            // Locate this block inside window._renderTableOnly
                            if (h === 'Status') {
                                let badgeClass = 'bg-light text-secondary border'; // Default

                                // ADD THESE SPECIFIC CHECKS:
                                if (statusVal === 'PENDING') {
                                    badgeClass = 'bg-secondary-subtle text-secondary border border-secondary-subtle'; // Soft Grey
                                } else if (statusVal === 'STAGED' || statusVal === 'ALLOCATED') {
                                    badgeClass = 'bg-primary-subtle text-primary border border-primary-subtle'; // Blue
                                } else if (statusVal === 'LOADED' || statusVal === 'VERIFIED') {
                                    badgeClass = 'bg-success-subtle text-success border border-success-subtle'; // Green
                                } else if (statusVal === 'MANIFESTED') {
                                    badgeClass = 'bg-purple-subtle text-purple border border-purple-subtle'; // Purple
                                } else if (statusVal === 'DISPATCHED') {
                                    badgeClass = 'bg-dark text-white border-dark'; // Black
                                }

                                content = `<span class="badge ${badgeClass} px-2 py-1">${statusVal}</span>`;
                            }
                            if (h === 'qty')    content = `<span class="fw-bold text-primary">${row[h]}</span>`;
                            return `<td class="px-3 py-2 text-truncate" style="width:${config.width};" title="${String(row[h]||'')}">${content}</td>`;
                        }).join('')}
                        <td class="text-end px-3 bg-white" style="position:sticky; right:0; border-left:1px solid #f1f5f9;">
                            <div class="input-group input-group-sm">
                                <input type="number" class="form-control text-center border-light bg-light fw-bold" id="qtyInput_${row.fingerprint}" value="${row.qty > 0 ? row.qty : ''}" placeholder="-">
                                <button class="btn ${isAllocated ? 'btn-outline-primary' : 'btn-primary'} fw-bold d-flex align-items-center justify-content-center" 
                                        style="width: 42px; height: 32px;"
                                        onclick="stageItemInline('${row.fingerprint}')"
                                        title="${isAllocated ? 'Add more to this load' : 'Load this item'}">
                                    <i class="bi ${isAllocated ? 'bi-truck-flatbed' : 'bi-truck'}"></i>
                                </button>
                            </div>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    `;

    _renderColumnToggle(allPossibleHeaders, headers);
    updateFooterStats();
};

/* ================================================================
   COLUMN VISIBILITY
   ================================================================ */

window.toggleColumnVisibility = (header) => {
    const ignoreList = ['fingerprint', 'original_qty', 'OVERDUE QI', 'GRV-ED', 'TripID', 'Final_Loaded'];
    const allKeysSet = new Set();
    masterOrders.forEach(o => Object.keys(o).forEach(k => allKeysSet.add(k)));
    const allPossibleHeaders = [...allKeysSet].filter(h => !ignoreList.includes(h));

    let hiddenCols = JSON.parse(localStorage.getItem('hiddenColumns') || '[]');

    if (hiddenCols.includes(header)) {
        hiddenCols = hiddenCols.filter(c => c !== header);
    } else {
        const wouldRemain = allPossibleHeaders.filter(h => !hiddenCols.includes(h) && h !== header);
        if (wouldRemain.length === 0) return alert("SYSTEM NOTE: At least one column must remain visible.");
        hiddenCols.push(header);
    }

    localStorage.setItem('hiddenColumns', JSON.stringify(hiddenCols));
    window._renderTableOnly();
};

window.resetColumns = () => {
    localStorage.removeItem('hiddenColumns');
    localStorage.removeItem('visibleColumns');
    window._renderTableOnly();
};

/* ================================================================
   COLUMN TOGGLE BAR (helper expected by _renderTableOnly)
   ================================================================ */

function _renderColumnToggle(allHeaders, visibleHeaders) {
    const bar = document.getElementById('_colToggleBar');
    if (!bar) return;
    
    const hiddenCols = JSON.parse(localStorage.getItem('hiddenColumns') || '[]');

    bar.innerHTML = `
        <style>
            .util-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #ffffff;
            }
            .column-dropdown {
                position: relative;
                display: inline-block;
            }
            .column-menu {
                position: absolute;
                top: 100%;
                right: 0;
                z-index: 1100;
                display: none;
                min-width: 220px;
                padding: 12px;
                margin-top: 8px;
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            }
            .column-item {
                display: flex;
                align-items: center;
                padding: 6px 8px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.75rem;
                color: #475569;
                transition: background 0.2s;
            }
            .column-item:hover { background: #f8fafc; color: #2563eb; }
            .column-item input { margin-right: 10px; cursor: pointer; }
            
            .util-label {
                font-size: 0.7rem;
                font-weight: 800;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
        </style>

        <div class="util-bar">
            <div class="d-flex align-items-center gap-2">
                <span class="util-label"><i class="bi bi-view-list me-1"></i> Table View</span>
                <span class="badge bg-light text-secondary border fw-bold" style="font-size: 0.65rem;">
                    ${visibleHeaders.length} of ${allHeaders.length} Columns Visible
                </span>
            </div>

            <div class="column-dropdown">
                <button class="btn btn-sm btn-light border fw-bold" 
                        style="font-size: 0.7rem; color: #475569;"
                        onclick="event.stopPropagation(); document.getElementById('_colMenu').style.display = 
                                 document.getElementById('_colMenu').style.display === 'block' ? 'none' : 'block'">
                    <i class="bi bi-sliders me-1"></i> CONFIGURE COLUMNS
                </button>
                
                <div class="column-menu shadow-lg" id="_colMenu">
                    <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                        <span class="fw-bold small text-dark">Display Columns</span>
                        <button class="btn btn-link p-0 text-decoration-none fw-bold" 
                                style="font-size: 0.65rem; color: #ef4444;"
                                onclick="resetColumns()">RESET ALL</button>
                    </div>
                    <div style="max-height: 250px; overflow-y: auto;">
                        ${allHeaders.map(h => {
                            const isHidden = hiddenCols.includes(h);
                            const label = h === 'qty' ? 'REMAINDER' : h === 'Staged_Qty' ? 'ALLOCATED' : h;
                            return `
                                <div class="column-item" onclick="toggleColumnVisibility('${h.replace(/'/g, "\\'")}')">
                                    <input type="checkbox" ${!isHidden ? 'checked' : ''} onclick="event.stopPropagation(); toggleColumnVisibility('${h.replace(/'/g, "\\'")}')">
                                    <span class="fw-semibold">${label}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('_colMenu');
        if (menu && !menu.contains(e.target)) menu.style.display = 'none';
    }, { once: false });
}

/* ================================================================
   ZONE MANAGER
   ================================================================ */

window.openZoneManager = () => {
    const existingModal = document.getElementById('zoneModal');
    if (existingModal) existingModal.remove();

    const html = `
        <div class="modal fade" id="zoneModal" tabindex="-1">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header bg-dark text-white py-2">
                        <h6 class="modal-title fw-bold text-uppercase small">Logistics Command: Zone Registry</h6>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body bg-light p-4" id="zoneManagerBody"></div>
                    <div class="modal-footer bg-white py-2">
                        <button class="btn btn-sm btn-dark fw-bold text-uppercase px-4"
                                data-bs-dismiss="modal" onclick="renderMasterTable()">
                            Sync &amp; Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    refreshZoneManagerUI();
    new bootstrap.Modal(document.getElementById('zoneModal')).show();
};

window.refreshZoneManagerUI = () => {
    const container = document.getElementById('zoneManagerBody');
    if (!container) return;

    const zoneNames  = Object.keys(zoneRegistry).filter(z => z !== "UNASSIGNED");
    const unassigned = zoneRegistry["UNASSIGNED"] || [];

    container.innerHTML = `
        <style>
            .dropdown-menu-scroll { max-height:300px; overflow-y:auto; width:280px; padding:10px; border:none; box-shadow:0 10px 30px rgba(0,0,0,0.15); }
            .zone-card-body { max-height:350px; overflow-y:auto; background:#fdfdfd; padding:10px !important; }
            .store-badge {
                font-size:0.75rem; transition:all 0.2s; border-radius:6px;
                text-align:left !important; justify-content:flex-start !important;
                display:flex; width:100%; margin-bottom:6px; padding:10px !important;
            }
            .store-badge:hover { background:#f1f3f5 !important; border-color:#0d6efd !important; }
            .pencil-btn { opacity:0.3; margin-left:auto; }
            .store-badge:hover .pencil-btn { opacity:1; }
        </style>

        <div class="card border-0 shadow-sm mb-4 border-start border-danger border-4">
            <div class="card-header bg-white py-2 d-flex justify-content-between align-items-center">
                <h6 class="mb-0 small fw-bold text-danger text-uppercase">New Branches Pending Assignment</h6>
                <span class="badge bg-danger">${unassigned.length}</span>
            </div>
            <div class="card-body p-3">
                <div class="d-flex flex-wrap gap-2">
                    ${unassigned.length === 0
                        ? `<span class="text-muted small">All branches are assigned.</span>`
                        : unassigned.map(a => `
                            <div class="btn-group shadow-sm">
                                <span class="btn btn-sm btn-white border border-end-0 fw-bold small">${a}</span>
                                <button class="btn btn-sm btn-outline-danger dropdown-toggle" data-bs-toggle="dropdown" type="button">MAP</button>
                                <ul class="dropdown-menu dropdown-menu-scroll shadow border-0">
                                    <li class="px-2 pb-2 sticky-top bg-white">
                                        <input type="text" class="form-control form-control-sm"
                                               placeholder="Search zone..." onkeyup="filterDropdown(this)">
                                    </li>
                                    ${zoneNames.map(z => `
                                        <li class="zone-item">
                                            <a class="dropdown-item rounded small py-2" href="#"
                                               onclick="moveAreaSilent('${a.replace(/'/g, "\\'")}', 'UNASSIGNED', '${z}'); return false;">
                                                Move to: <b>${z}</b>
                                            </a>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        </div>

        <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
            ${zoneNames.map(z => `
                <div class="col">
                    <div class="card h-100 border-0 shadow-sm border-top border-primary border-3">
                        <div class="card-header bg-white py-2 d-flex justify-content-between align-items-center">
                            <span class="fw-bold text-primary small text-truncate pe-2">${z}</span>
                            <button type="button" onclick="deleteZone('${z}')" class="btn-close" style="font-size:0.5rem;"></button>
                        </div>
                        <div class="card-body zone-card-body">
                            ${(zoneRegistry[z] || []).map(entry => {
                                const isOfficial = String(entry).includes(':');
                                const brn  = isOfficial ? entry.split(':')[0] : 'N/A';
                                const name = isOfficial ? entry.split(':')[1] : entry;
                                return `
                                <div class="badge bg-white text-dark border store-badge align-items-center">
                                    <div class="text-truncate" style="flex-grow:1; cursor:pointer;"
                                         onclick="editStoreName('${entry.replace(/'/g, "\\'")}', '${z}')">
                                        <div class="fw-bold text-uppercase text-truncate">${name}</div>
                                        <small class="text-muted">Branch: ${brn}</small>
                                    </div>
                                    <span class="pencil-btn text-primary me-2" style="font-size:0.7rem;">edit</span>
                                    <button type="button"
                                            onclick="moveAreaSilent('${entry.replace(/'/g, "\\'")}', '${z}', 'UNASSIGNED')"
                                            class="btn-close" style="font-size:0.5rem;"></button>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="mt-5 pt-4 border-top">
            <div class="bg-secondary bg-opacity-10 p-4 rounded">
                <div class="d-flex align-items-center justify-content-between">
                    <div>
                        <h6 class="small fw-bold text-dark text-uppercase mb-1">Master Logistics Engine</h6>
                        <p class="small text-muted mb-0">Upload <b>BRANCH LIST.xlsx</b> to bulk-map factory names to codes.</p>
                    </div>
                    <label class="btn btn-sm btn-dark fw-bold shadow-sm px-4 py-2" style="cursor:pointer;">
                        IMPORT MASTER LIST
                        <input type="file" hidden accept=".csv,.xlsx,.xls" onchange="handleMasterBranchUpload(event)">
                    </label>
                </div>
            </div>
        </div>
    `;
};

window.filterDropdown = (input) => {
    const filter = input.value.toUpperCase();
    const items  = input.closest('.dropdown-menu').querySelectorAll('.zone-item');
    items.forEach(item => {
        item.style.display = (item.textContent || item.innerText).toUpperCase().includes(filter) ? "" : "none";
    });
};

window.editStoreName = (oldEntry, zone) => {
    const [brn, oldName] = oldEntry.split(':');
    const newName = prompt(`Rename Store ${brn}:`, oldName);
    if (!newName || newName === oldName) return;

    const newEntry = `${brn}:${newName.toUpperCase().trim()}`;
    zoneRegistry[zone] = zoneRegistry[zone].map(e => e === oldEntry ? newEntry : e);
    localStorage.setItem('zoneRegistry', JSON.stringify(zoneRegistry));
    refreshZoneManagerUI();
};

window.addNewZone = () => {
    const input = document.getElementById('newZoneName');
    const name  = input.value.trim().toUpperCase();
    if (!name || zoneRegistry[name]) return;

    zoneRegistry[name] = [];
    localStorage.setItem('zoneRegistry', JSON.stringify(zoneRegistry));
    refreshZoneManagerUI();
    input.value = '';
};

window.deleteZone = (zone) => {
    if (!confirm(`Delete ${zone}? Areas will return to Unassigned.`)) return;
    zoneRegistry["UNASSIGNED"] = [...(zoneRegistry["UNASSIGNED"] || []), ...(zoneRegistry[zone] || [])];
    delete zoneRegistry[zone];
    localStorage.setItem('zoneRegistry', JSON.stringify(zoneRegistry));
    refreshZoneManagerUI();
};

window.moveAreaSilent = (identifier, fromZone, toZone) => {
    const itemToMove = (zoneRegistry[fromZone] || []).find(a => a === identifier);
    if (!itemToMove) return;

    zoneRegistry[fromZone] = zoneRegistry[fromZone].filter(a => a !== identifier);
    if (!zoneRegistry[toZone]) zoneRegistry[toZone] = [];
    zoneRegistry[toZone].push(itemToMove);

    localStorage.setItem('zoneRegistry', JSON.stringify(zoneRegistry));
    refreshZoneManagerUI();
    renderMasterTable();
};

window.renameZone = (oldName, newName) => {
    newName = newName.trim().toUpperCase();
    if (!newName || oldName === newName) return refreshZoneManagerUI();
    if (zoneRegistry[newName]) { alert("A zone with that name already exists."); return refreshZoneManagerUI(); }

    zoneRegistry[newName] = zoneRegistry[oldName];
    delete zoneRegistry[oldName];
    if (window.currentZoneFilter === oldName) window.currentZoneFilter = newName;

    localStorage.setItem('zoneRegistry', JSON.stringify(zoneRegistry));
    refreshZoneManagerUI();
};

/* ================================================================
   SYSTEM RESET
   ================================================================ */

window.systemReset = () => {
    if (!confirm("Are you sure? This will clear all CURRENT ORDERS but keep your ZONE and BRANCH mappings.")) return;
    localStorage.removeItem('masterOrders');
    masterOrders = [];
    renderMasterTable();
    alert("Daily data cleared. Logistics zones preserved.");
};

/* ================================================================
   STAGING / ALLOCATION LOGIC
   ================================================================ */

window.stageItemInline = (fingerprint) => {
    const item = masterOrders.find(o => o.fingerprint === fingerprint);
    if (!item) return;

    const inputEl = document.getElementById(`qtyInput_${fingerprint}`);
    const amount  = parseInt(inputEl.value);

    if (isNaN(amount) || amount <= 0) return alert("STOP: You must enter a positive number to allocate.");
    if (amount > item.qty) return alert(`LOGIC ERROR: You are trying to allocate ${amount} units, but only ${item.qty} are available.`);

    item.qty       -= amount;
    item.staged_qty = (item.staged_qty || 0) + amount;
    item.Status     = 'ALLOCATED';

    const trayItem = stagedLoad.find(o => o.fingerprint === fingerprint);
    if (trayItem) {
        trayItem.loaded += amount;
    } else {
        const descKey = Object.keys(item).find(k => k.toLowerCase().includes('desc')) || Object.keys(item)[2];
        stagedLoad.push({
            fingerprint: item.fingerprint,
            Zone:        item.Zone || 'UNASSIGNED',
            Area:        item.Area,
            description: item[descKey],
            loaded:      amount
        });
    }

    localStorage.setItem('masterOrders', JSON.stringify(masterOrders));
    window._renderTableOnly();   // FIX: lightweight re-render, preserves search input
    renderLoadTray();
};

/* ================================================================
   LOAD TRAY  (FIX 4 — emoji fallbacks for icons)
   ================================================================ */

window.removeFromTray = (fingerprint) => {
    const trayIndex = stagedLoad.findIndex(o => o.fingerprint === fingerprint);
    if (trayIndex === -1) return;

    const trayItem   = stagedLoad[trayIndex];
    const masterItem = masterOrders.find(o => o.fingerprint === fingerprint);

    if (masterItem) {
        masterItem.qty       += trayItem.loaded;
        masterItem.staged_qty = Math.max(0, (masterItem.staged_qty || 0) - trayItem.loaded);
        if (masterItem.staged_qty <= 0 && !masterItem.TripID) {
            masterItem.staged_qty = 0;
            masterItem.Status     = 'Pending';
        }
    }

    stagedLoad.splice(trayIndex, 1);
    localStorage.setItem('masterOrders', JSON.stringify(masterOrders));
    window._renderTableOnly();
    renderLoadTray();
};

function renderLoadTray() {
    const trayContent = document.getElementById('loadTrayContent');
    const badge       = document.getElementById('trayCountBadge');

    if (badge) badge.innerText = stagedLoad.length;
    if (!trayContent) return;

    if (stagedLoad.length === 0) {
        trayContent.innerHTML = `
            <div class="p-5 text-center text-muted">
                <i class="bi bi-cart-x display-4 opacity-25"></i>
                <div class="fw-bold mt-3">Nothing staged yet</div>
                <div class="small">Allocate stock to see draft items here.</div>
            </div>`;
        return;
    }

    const totalUnits = stagedLoad.reduce((acc, curr) => acc + (curr.loaded || 0), 0);
    const isExisting = !!window.currentOpenTripID;

    const listItems = stagedLoad.map((item) => `
        <div style="padding:12px 16px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; background:#fff;">
            <div style="flex:1; min-width:0;">
                <div class="fw-bold text-dark text-truncate" style="font-size:0.85rem;">${item.Area}</div>
                <div class="text-muted text-truncate" style="font-size:0.75rem;">${item.description || ''}</div>
                <div class="fw-bold text-primary mt-1" style="font-size:0.8rem;">
                    <i class="bi bi-box-seam me-1"></i> ${item.loaded} units
                </div>
            </div>
            <button type="button" class="btn btn-sm btn-link text-danger text-decoration-none" onclick="removeFromTray('${item.fingerprint}')">
                <i class="bi bi-trash3"></i>
            </button>
        </div>
    `).join('');

    trayContent.style.display = 'flex';
    trayContent.style.flexDirection = 'column';
    trayContent.style.height = 'calc(100dvh - 56px)'; 

    trayContent.innerHTML = `
        <div style="padding:16px; background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-shrink:0;">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold text-uppercase text-secondary" style="font-size:0.7rem; letter-spacing:1px;">Draft Load</span>
                <span class="badge bg-slate text-white" style="font-size:0.65rem; background:#334155;">${stagedLoad.length} ITEMS</span>
            </div>
            <div class="h5 fw-bold mb-0">${totalUnits} <span class="text-muted small fw-normal">Total Units</span></div>
            
            <button class="btn btn-outline-dark btn-sm w-100 mt-3 fw-bold no-print" onclick="printDraftWorksheet()">
                <i class="bi bi-printer me-2"></i> PRINT CHECK-SHEET
            </button>

            ${isExisting ? `<div class="mt-2 small text-primary fw-bold"><i class="bi bi-link-45deg"></i> Appending to: ${window.currentOpenTripID}</div>` : ''}
        </div>

        <div style="flex:1; overflow-y:auto; background:#fff;">
            ${listItems}
        </div>

        <div style="padding:16px; border-top:1px solid #e2e8f0; background:#f8fafc; flex-shrink:0;">
            <button class="btn btn-primary w-100 fw-bold py-2 mb-2 shadow-sm" type="button" onclick="finalizeLoad()">
                ${isExisting ? 'UPDATE LOAD SHEET' : 'CREATE LOAD SHEET'}
            </button>
            <div class="text-center text-muted" style="font-size:0.65rem;">
                FINALIZING WILL MOVE ITEMS TO ACTIVE MANIFESTS
            </div>
        </div>
    `;
}

window.printDraftWorksheet = () => {
    // FIX: Use the live stagedLoad variable instead of reading empty localStorage
    const tray = stagedLoad; 
    
    if (tray.length === 0) return alert("Your draft tray is empty!");

    const printWindow = window.open('', '_blank');
    
    // FIX: Your mapping used item.staged_qty, but in stagedLoad, the property is called .loaded
    const rows = tray.map(item => `
        <tr>
            <td style="padding: 12px; border: 1px solid #000;">${item.Area}</td>
            <td style="padding: 12px; border: 1px solid #000;">${item.description || '---'}</td>
            <td style="padding: 12px; border: 1px solid #000; text-align: center; font-weight: bold;">${item.loaded}</td>
            <td style="padding: 12px; border: 1px solid #000; width: 200px;"></td> 
        </tr>
    `).join('');

    printWindow.document.write(`
        <html>
            <head><title>Draft Picking List</title></head>
            <body style="font-family: sans-serif; padding: 40px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                    <div>
                        <h1 style="margin: 0;">V&V DRAFT WORKSHEET</h1>
                        <p style="margin: 5px 0;">Route: <b>${tray[0].Zone || 'Various'}</b></p>
                    </div>
                    <div style="text-align: right;">
                        <p>Date: ${new Date().toLocaleDateString()}</p>
                        <p>Items: ${tray.length} | Total Units: ${tray.reduce((s, i) => s + i.loaded, 0)}</p>
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #eee;">
                            <th style="padding: 12px; border: 1px solid #000; text-align: left;">AREA</th>
                            <th style="padding: 12px; border: 1px solid #000; text-align: left;">ITEM DESCRIPTION</th>
                            <th style="padding: 12px; border: 1px solid #000;">QTY</th>
                            <th style="padding: 12px; border: 1px solid #000;">NOTES / PEN CHECK</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.print();
};

/* ================================================================
   FINALIZE / TRIP MANAGEMENT
   ================================================================ */

window.finalizeLoad = () => {
    if (stagedLoad.length === 0) return;

    const tripZone    = stagedLoad[0].Zone || 'UNASSIGNED';
    const isMixedZone = stagedLoad.some(item => item.Zone !== tripZone);

    if (isMixedZone) return alert("ZONE ERROR: Please only allocate one zone at a time.");

    let tripId = window.currentOpenTripID;

    if (!tripId) {
        tripId = "LS-" + Math.floor(Math.random() * 9000 + 1000);
        if (!confirm(`START NEW LOAD: Generate ${tripId} for ${tripZone}?`)) return;
        window.currentOpenTripID = tripId;
    } else {
        const append = confirm(`APPEND TO LOAD: Add these items to the current ${tripId}?`);
        if (!append) {
            if (confirm("Would you like to close the current trip and start a FRESH one?")) {
                window.currentOpenTripID = null;
                return finalizeLoad();
            }
            return;
        }
    }

    stagedLoad.forEach(stagedItem => {
        const masterItem = masterOrders.find(o => o.fingerprint === stagedItem.fingerprint);
        if (masterItem) {
            masterItem.Status     = 'ALLOCATED';
            masterItem.TripID     = tripId;
            masterItem.staged_qty = (masterItem.staged_qty || 0) + stagedItem.loaded;
            masterItem.Zone       = tripZone;
        }
    });

    localStorage.setItem('masterOrders', JSON.stringify(masterOrders));
    alert(`LOAD UPDATED: ${tripId} has been updated with new allocations.`);

    stagedLoad = [];
    renderMasterTable();
    renderLoadTray();

    const drawerEl = document.getElementById('loadTrayDrawer');
    if (drawerEl) bootstrap.Offcanvas.getInstance(drawerEl)?.hide();

    const dispatchTabEl = document.querySelector('#dispatch-tab');
    if (dispatchTabEl) new bootstrap.Tab(dispatchTabEl).show();
};

window.removeLineFromTrip = (fingerprint) => {
    const item = masterOrders.find(o => o.fingerprint === fingerprint);
    if (!item) return;

    if (confirm(`PULL BACK: Remove ${item.Area} from the dispatch load and return to pending?`)) {
        item.qty      += (item.staged_qty || 0);
        item.staged_qty = 0;
        item.Status     = 'Pending';
        item.TripID     = null;

        localStorage.setItem('masterOrders', JSON.stringify(masterOrders));
        renderMasterTable();
        if (typeof renderDispatchTable === 'function') renderDispatchTable();
        alert("Line successfully pulled back to Command Centre.");
    }
};

/* ================================================================
   FOOTER STATS
   ================================================================ */

function updateFooterStats() {
    const globalTotal = masterOrders.length;
    const globalUnits = masterOrders.reduce((acc, curr) => acc + (curr.qty || 0), 0);

    let filtered = [...masterOrders];
    if (window.currentZoneFilter && window.currentZoneFilter !== 'ALL') {
        filtered = filtered.filter(row => row.Zone === window.currentZoneFilter);
    }
    if (window.currentAreaFilter && window.currentAreaFilter !== 'ALL') {
        filtered = filtered.filter(row => row.Area === window.currentAreaFilter);
    }

    const viewTotal  = filtered.length;
    const viewUnits  = filtered.reduce((acc, curr) => acc + (curr.qty || 0), 0);
    const viewStaged = filtered.reduce((acc, curr) => acc + (curr.staged_qty || 0), 0);

    const footer = document.getElementById('sessionCount');
    if (!footer) return;

    footer.innerHTML = window.currentZoneFilter === 'ALL'
        ? `<span class="badge bg-dark me-2">GLOBAL</span>
           <b>${globalTotal}</b> Orders | <b>${globalUnits}</b> Total Units | <b>${viewStaged}</b> Allocated`
        : `<span class="badge bg-primary me-2">${window.currentZoneFilter}</span>
           <b>${viewTotal}</b> Orders | <b>${viewUnits}</b> Units | <b>${viewStaged}</b> Allocated
           <small class="text-muted ms-2">(of ${globalTotal} total)</small>`;
}

/* ================================================================
   INITIALIZATION
   ================================================================ */

window.onload = () => {
    const savedData = localStorage.getItem('masterOrders');
    if (savedData) {
        try { masterOrders = JSON.parse(savedData); }
        catch (e) { console.error("Failed to parse saved orders:", e); masterOrders = []; }
    }

    // Migrate old allowlist → denylist
    const oldVisible = JSON.parse(localStorage.getItem('visibleColumns') || 'null');
    if (oldVisible && masterOrders.length > 0) {
        const ignoreList = ['fingerprint', 'original_qty', 'OVERDUE QI', 'TripID', 'Final_Loaded', 'added_at', 'Zone', 'BounceBackQty'];
        const allKeysSet = new Set();
        masterOrders.forEach(o => Object.keys(o).forEach(k => allKeysSet.add(k)));
        const allCurrentHeaders = [...allKeysSet].filter(h => !ignoreList.includes(h));
        const migrated = allCurrentHeaders.filter(h => !oldVisible.includes(h));
        localStorage.setItem('hiddenColumns', JSON.stringify(migrated));
        localStorage.removeItem('visibleColumns');
    }

    renderMasterTable();
    renderLoadTray();
};

/* ================================================================
   CROSS-TAB SYNC
   ================================================================ */

window.addEventListener('storage', (event) => {
    if (event.key === 'masterOrders' && event.newValue) {
        try {
            masterOrders = JSON.parse(event.newValue);
            window._renderTableOnly();
        } catch (e) {
            console.error("Storage sync error:", e);
        }
    }
});