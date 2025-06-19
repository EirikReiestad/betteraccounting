// Import SheetJS and PapaParse from CDN
const excelInput = document.getElementById('excel-upload')
const csvInput = document.getElementById('csv-upload')
const dataPreview = document.getElementById('data-preview')
const categorizationUI = document.getElementById('categorization-ui')
const diffSection = document.getElementById('diff-section')
const inputView = document.getElementById('input-view')
const reviewView = document.getElementById('review-view')
const navHome = document.getElementById('nav-home')
const navReview = document.getElementById('nav-review')

let excelData = null
let csvData = null
let diffData = []
let mergedData = []

// Inferred accounting columns from screenshot
const ACCOUNTING_COLUMNS = [
    'BOKFØRINGSDATO',
    'AVSENDER',
    'MOTTAKER',
    'TYPE',
    'TEKST',
    'UT FRA KONTO',
    'INN PÅ KONTO',
    'BELØP',
    'ÅR',
    'MÅNED',
    'DAG',
];

// Map a CSV transaction to the accounting format
function mapTransactionToAccounting(tx) {
    // This mapping may need to be adjusted based on your real CSV structure
    return {
        'BOKFØRINGSDATO': tx['Bokføringsdato'] || tx['BOKFØRINGSDATO'] || '',
        'AVSENDER': tx['Avsender'] || tx['AVSENDER'] || '',
        'MOTTAKER': tx['Mottaker'] || tx['MOTTAKER'] || '',
        'TYPE': tx['Tittel'] || tx['TYPE'] || '',
        'TEKST': tx['Navn'] || tx['TEKST'] || '',
        'UT FRA KONTO': tx['Beløp'] && Number(tx['Beløp']) < 0 ? tx['Beløp'] : '',
        'INN PÅ KONTO': tx['Beløp'] && Number(tx['Beløp']) > 0 ? tx['Beløp'] : '',
        'BELØP': tx['Beløp'] || '',
        'ÅR': tx['Bokføringsdato'] && tx['Bokføringsdato'].split('/')[0] || '',
        'MÅNED': tx['Bokføringsdato'] && tx['Bokføringsdato'].split('/')[1] || '',
        'DAG': tx['Bokføringsdato'] && tx['Bokføringsdato'].split('/')[2] || '',
    };
}

// Find diffs between accounting and new transactions
function diffTransactions(accountingRows, newRows) {
    // Map all new transactions to accounting format
    const mappedNew = newRows.map(mapTransactionToAccounting);
    // Helper to compare all fields except date
    function isAlmostSimilar(a, b) {
        return ACCOUNTING_COLUMNS.filter(c => c !== 'BOKFØRINGSDATO').every(col => (a[col] || '') === (b[col] || ''));
    }
    // Helper to compare all fields
    function isExact(a, b) {
        return ACCOUNTING_COLUMNS.every(col => (a[col] || '') === (b[col] || ''));
    }
    // Find exact duplicates
    const exactMatches = [];
    const almostMatches = [];
    const newOnes = [];
    mappedNew.forEach(newTx => {
        const exact = accountingRows.find(acc => isExact(acc, newTx));
        if (exact) {
            exactMatches.push({ old: exact, new: newTx });
            return;
        }
        // If not exact, check for almost similar (date is 'Reservert' or differs)
        const almost = accountingRows.find(acc => isAlmostSimilar(acc, newTx) && (acc['BOKFØRINGSDATO'] === 'Reservert' || newTx['BOKFØRINGSDATO'] === 'Reservert' || acc['BOKFØRINGSDATO'] !== newTx['BOKFØRINGSDATO']));
        if (almost) {
            almostMatches.push({ old: almost, new: newTx });
            return;
        }
        // Otherwise, it's a new transaction
        newOnes.push(newTx);
    });
    return { exactMatches, almostMatches, newOnes };
}

// Navbar routing logic
navHome.addEventListener('click', (e) => {
    e.preventDefault()
    inputView.style.display = ''
    reviewView.style.display = 'none'
    navHome.classList.add('text-gray-800', 'border-blue-600')
    navHome.classList.remove('text-gray-600', 'border-transparent')
    navReview.classList.remove('text-gray-800', 'border-blue-600')
    navReview.classList.add('text-gray-600', 'border-transparent')
})
navReview.addEventListener('click', (e) => {
    e.preventDefault()
    inputView.style.display = 'none'
    reviewView.style.display = ''
    navReview.classList.add('text-gray-800', 'border-blue-600')
    navReview.classList.remove('text-gray-600', 'border-transparent')
    navHome.classList.remove('text-gray-800', 'border-blue-600')
    navHome.classList.add('text-gray-600', 'border-transparent')
    renderReviewTable()
})

// Auto-load test files on page load
window.addEventListener('DOMContentLoaded', async () => {
    await loadTestFiles()
})

async function loadTestFiles() {
    // Load Excel
    const excelResp = await fetch('test_accounting.xlsx')
    const excelArrayBuffer = await excelResp.arrayBuffer()
    const workbook = XLSX.read(excelArrayBuffer)
    const sheetName = workbook.SheetNames[0]
    excelData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: '',
    })

    // Load CSV
    const csvResp = await fetch('test_transactions.csv')
    const csvText = await csvResp.text()
    Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            csvData = results.data
            renderPreview()
            // renderMergeButton()
        },
    })
}

function renderMergeButton() {
    // Remove old button if present
    const oldBtn = document.getElementById('merge-btn')
    if (oldBtn) oldBtn.remove()
    if (excelData && csvData) {
        const btn = document.createElement('button')
        btn.id = 'merge-btn'
        btn.textContent = 'Merge Transactions'
        btn.className =
            'button bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-4'
        btn.onclick = () => {
            const merged = window.updateTransactions(excelData, csvData)
            // Find only the new transactions
            diffData = window
                .updateTransactions([], csvData)
                .filter(
                    (t) =>
                        !window
                            .updateTransactions([], excelData)
                            .some((e) => isSameTransaction(e, t))
                )
            renderMergedPreview(merged)
            renderDiffSection()
        }
        dataPreview.parentNode.insertBefore(btn, dataPreview)
    }
}

function isSameTransaction(a, b) {
    return (
        a.bokføringsdato === b.bokføringsdato &&
        a.beløp === b.beløp &&
        a.avsender === b.avsender &&
        a.mottaker === b.mottaker
    )
}

function renderMergedPreview(merged) {
    dataPreview.innerHTML =
        '<div class="mb-2 font-bold">Merged Transactions Preview:</div>' +
        renderTable(merged.slice(0, 10))
}

function renderDiffSection() {
    if (!diffData.length) {
        diffSection.innerHTML =
            '<div class="text-green-600">No new transactions to merge!</div>'
        return
    }
    let html = '<div class="mb-2 font-bold">New Transactions to Merge:</div>'
    html +=
        '<div class="overflow-x-auto"><table class="min-w-full text-xs text-left border border-gray-200"><thead><tr>'
    const headers = Object.keys(diffData[0])
    headers.forEach(
        (h) => (html += `<th class="border px-2 py-1 bg-gray-100">${h}</th>`)
    )
    html +=
        '<th class="border px-2 py-1 bg-gray-100">Actions</th></tr></thead><tbody>'
    diffData.forEach((row, idx) => {
        html += '<tr>'
        headers.forEach(
            (h) => (html += `<td class="border px-2 py-1">${row[h]}</td>`)
        )
        html += `<td class="border px-2 py-1"><button class='add-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded mr-2' data-idx='${idx}'>Add</button><button class='discard-btn bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded' data-idx='${idx}'>Discard</button></td>`
        html += '</tr>'
    })
    html += '</tbody></table></div>'
    diffSection.innerHTML = html

    // Add event listeners for Add/Discard buttons
    diffSection.querySelectorAll('.add-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'))
            // Add to excelData
            excelData.push(diffData[idx])
            // Remove from diffData
            diffData.splice(idx, 1)
            renderMergedPreview(window.updateTransactions(excelData, []))
            renderDiffSection()
        })
    })
    diffSection.querySelectorAll('.discard-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'))
            diffData.splice(idx, 1)
            renderDiffSection()
        })
    })
}

excelInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const sheetName = workbook.SheetNames[0]
    excelData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: '',
    })
    renderPreview()
    // renderMergeButton()
})

csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            csvData = results.data
            renderPreview()
            // renderMergeButton()
        },
    })
})

function renderPreview() {
    dataPreview.innerHTML = ''
    let html = ''
    if (excelData) {
        html +=
            '<section class="rounded-lg shadow p-6 flex-1 w-full sm:w-1/2 mb-4 sm:mb-0">' +
            '<label class="block font-semibold mb-2">Current Accounting File Preview:</label>' +
            renderTable(excelData.slice(0, 5)) +
            '</section>'
    }
    if (csvData) {
        html +=
            '<section class="rounded-lg shadow p-6 flex-1 w-full sm:w-1/2 mb-4 sm:mb-0">' +
            '<label class="block font-semibold mb-2">Transactions Preview:</label>' +
            renderTable(excelData.slice(0, 5)) +
            '</section>'
        ;('</div>')
    }
    dataPreview.innerHTML = html
}

function renderTable(data) {
    if (!data || data.length === 0)
        return '<div class="text-gray-400">No data</div>'
    const headers = Object.keys(data[0])
    let html =
        '<div class="overflow-x-auto"><table class="min-w-full text-xs text-left border border-gray-200"><thead><tr>'
    headers.forEach(
        (h) => (html += `<th class="border px-2 py-1 bg-gray-100">${h}</th>`)
    )
    html += '</tr></thead><tbody>'
    data.forEach((row) => {
        html += '<tr>'
        headers.forEach(
            (h) => (html += `<td class="border px-2 py-1">${row[h]}</td>`)
        )
        html += '</tr>'
    })
    html += '</tbody></table></div>'
    return html
}

function renderReviewTable() {
    // Render the Excel-like table with old transactions and review diffs
    const headers = ACCOUNTING_COLUMNS;
    let html = `
      <div class="w-full max-w-6xl mx-auto p-2">
        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left border border-gray-200 bg-white">
            <thead>
              <tr>
                ${headers.map((h) => `<th class="border px-2 py-1 bg-gray-100">${h}</th>`).join('')}
                <th class="border px-2 py-1 bg-gray-100">Actions</th>
              </tr>
            </thead>
            <tbody>
    `;
    if (!excelData) {
        html += Array.from({ length: 12 })
            .map(() => `<tr>${headers.map(() => '<td class="border px-2 py-1 h-8">&nbsp;</td>').join('')}<td class="border px-2 py-1 h-8">&nbsp;</td></tr>`)
            .join('');
    } else {
        // Compute diffs
        const diffs = diffTransactions(excelData, csvData || []);
        // Render all old transactions (not almost/exact matches)
        const oldRowsToShow = excelData.filter(old => {
            // Don't show if it's an exact match with a new
            if (diffs.exactMatches.some(m => m.old === old)) return false;
            // Don't show if it's an almost match (will be shown as red row)
            if (diffs.almostMatches.some(m => m.old === old)) return false;
            return true;
        });
        oldRowsToShow.forEach(row => {
            html += `<tr>${headers.map(h => `<td class="border px-2 py-1 h-8" contenteditable="true">${row[h] ?? ''}</td>`).join('')}<td class="border px-2 py-1 h-8"></td></tr>`;
        });
        // Render almost similar matches (old in red, new in green)
        diffs.almostMatches.forEach((pair, idx) => {
            // Old (red)
            html += `<tr class="bg-red-100">${headers.map(h => `<td class="border px-2 py-1 h-8" contenteditable="true">${pair.old[h] ?? ''}</td>`).join('')}<td class="border px-2 py-1 h-8 text-center align-middle">Old</td></tr>`;
            // New (green) with Approve/Decline
            html += `<tr class="bg-green-100">${headers.map(h => `<td class="border px-2 py-1 h-8" contenteditable="true">${pair.new[h] ?? ''}</td>`).join('')}<td class="border px-2 py-1 h-8 text-center align-middle"><button class='approve-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded mr-2' data-type='almost' data-idx='${idx}'>Approve</button><button class='decline-btn bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded' data-type='almost' data-idx='${idx}'>Decline</button></td></tr>`;
        });
        // Render new transactions (green)
        diffs.newOnes.forEach((row, idx) => {
            html += `<tr class="bg-green-100">${headers.map(h => `<td class="border px-2 py-1 h-8" contenteditable="true">${row[h] ?? ''}</td>`).join('')}<td class="border px-2 py-1 h-8 text-center align-middle"><button class='approve-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded mr-2' data-type='new' data-idx='${idx}'>Approve</button><button class='decline-btn bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded' data-type='new' data-idx='${idx}'>Decline</button></td></tr>`;
        });
    }
    html += `</tbody></table></div></div>`;
    reviewView.innerHTML = html;

    // Add event listeners for Approve/Decline buttons
    const diffs = excelData ? diffTransactions(excelData, csvData || []) : null;
    if (diffs) {
        // Approve/Decline for almost similar
        reviewView.querySelectorAll('.approve-btn[data-type="almost"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-idx'));
                // Approve: replace old with new in excelData
                const pair = diffs.almostMatches[idx];
                const oldIdx = excelData.findIndex(row => row === pair.old);
                if (oldIdx !== -1) excelData[oldIdx] = pair.new;
                // Remove from csvData
                const csvIdx = csvData.findIndex(tx => mapTransactionToAccounting(tx)['BOKFØRINGSDATO'] === pair.new['BOKFØRINGSDATO'] && mapTransactionToAccounting(tx)['BELØP'] === pair.new['BELØP']);
                if (csvIdx !== -1) csvData.splice(csvIdx, 1);
                renderReviewTable();
            });
        });
        reviewView.querySelectorAll('.decline-btn[data-type="almost"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-idx'));
                // Decline: do nothing, just remove from csvData
                const pair = diffs.almostMatches[idx];
                const csvIdx = csvData.findIndex(tx => mapTransactionToAccounting(tx)['BOKFØRINGSDATO'] === pair.new['BOKFØRINGSDATO'] && mapTransactionToAccounting(tx)['BELØP'] === pair.new['BELØP']);
                if (csvIdx !== -1) csvData.splice(csvIdx, 1);
                renderReviewTable();
            });
        });
        // Approve/Decline for new
        reviewView.querySelectorAll('.approve-btn[data-type="new"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-idx'));
                // Approve: add to excelData
                const diffsNow = diffTransactions(excelData, csvData || []);
                const row = diffsNow.newOnes[idx];
                excelData.push(row);
                // Remove from csvData
                const csvIdx = csvData.findIndex(tx => mapTransactionToAccounting(tx)['BOKFØRINGSDATO'] === row['BOKFØRINGSDATO'] && mapTransactionToAccounting(tx)['BELØP'] === row['BELØP']);
                if (csvIdx !== -1) csvData.splice(csvIdx, 1);
                renderReviewTable();
            });
        });
        reviewView.querySelectorAll('.decline-btn[data-type="new"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-idx'));
                // Decline: just remove from csvData
                const diffsNow = diffTransactions(excelData, csvData || []);
                const row = diffsNow.newOnes[idx];
                const csvIdx = csvData.findIndex(tx => mapTransactionToAccounting(tx)['BOKFØRINGSDATO'] === row['BOKFØRINGSDATO'] && mapTransactionToAccounting(tx)['BELØP'] === row['BELØP']);
                if (csvIdx !== -1) csvData.splice(csvIdx, 1);
                renderReviewTable();
            });
        });
    }
}
