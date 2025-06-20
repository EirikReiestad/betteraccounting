// Import SheetJS and PapaParse
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
let reviewRows = []

const EDITABLE_COLUMNS = ['Type', 'Kategori', 'Merker']

class NaiveBayesClassifier {
    constructor() {
        this.wordCounts = {} // { category: { word: count, ... }, ... }
        this.categoryCounts = {} // { category: count, ... }
        this.vocabulary = new Set()
        this.totalDocuments = 0
    }

    tokenize(text) {
        if (!text) return []
        // Simple tokenizer: lowercase, split by non-word characters
        return text.toLowerCase().match(/\b\w+\b/g) || []
    }

    train(text, category) {
        this.totalDocuments++
        if (!this.categoryCounts[category]) {
            this.categoryCounts[category] = 0
            this.wordCounts[category] = {}
        }
        this.categoryCounts[category]++

        const tokens = this.tokenize(text)
        for (const token of tokens) {
            this.vocabulary.add(token)
            if (!this.wordCounts[category][token]) {
                this.wordCounts[category][token] = 0
            }
            this.wordCounts[category][token]++
        }
    }

    predict(
        text,
        {
            confidenceLevel = 2.0,
            multi = false,
            relativeThreshold = 2.0,
        } = {}
    ) {
        const tokens = this.tokenize(text)
        const scores = {}

        for (const category in this.categoryCounts) {
            const categoryPrior =
                Math.log(this.categoryCounts[category]) -
                Math.log(this.totalDocuments)
            let score = categoryPrior

            let totalWordsInCategory = 0
            for (const word in this.wordCounts[category]) {
                totalWordsInCategory += this.wordCounts[category][word]
            }

            for (const token of tokens) {
                const wordCount = this.wordCounts[category][token] || 0
                // Laplace smoothing
                const wordLikelihood =
                    Math.log(wordCount + 1) -
                    Math.log(totalWordsInCategory + this.vocabulary.size)
                score += wordLikelihood
            }
            scores[category] = score
        }

        const sortedScores = Object.entries(scores).sort((a, b) => {
            if (b[1] !== a[1]) {
                return b[1] - a[1] // Primary sort: by score, descending
            }
            return a[0].localeCompare(b[0]) // Secondary sort (tie-breaker): by category name, ascending
        })

        if (sortedScores.length === 0) {
            return multi ? [] : null
        }

        if (sortedScores.length === 1) {
            return multi ? [sortedScores[0][0]] : sortedScores[0][0]
        }

        const best = sortedScores[0]
        const secondBest = sortedScores[1]

        // Primary confidence check: Is our top pick good enough?
        const confidenceThreshold = Math.log(confidenceLevel)
        if (best[1] < secondBest[1] + confidenceThreshold) {
            // Not confident in our top pick, so don't suggest anything.
            return multi ? [] : null
        }

        // If we're here, we are confident in our best pick.
        if (!multi) {
            return best[0]
        }

        // For multi-predictions, find all other predictions that are relatively close to the best one.
        const bestScore = best[1]
        const scoreThreshold = Math.log(relativeThreshold) // e.g., Math.log(2) means half as probable

        const results = sortedScores
            .filter((pair) => pair[1] > bestScore - scoreThreshold)
            .map((pair) => pair[0])

        return results
    }
}

let categoryClassifier = new NaiveBayesClassifier()
let tagsClassifier = new NaiveBayesClassifier()
let predictionIgnoredRows = new Set()

// Inferred accounting columns from screenshot
const ACCOUNTING_COLUMNS = [
    'Bokføringsdato',
    'Avsender',
    'Mottaker',
    'Type',
    'Tekst',
    'Ut fra konto',
    'Inn på konto',
    'Beløp',
    'År',
    'Måned',
    'Dag',
    'Kategori',
    'Merker',
]

const NORWEGIAN_MONTHS = [
    '',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mai',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Okt',
    'Nov',
    'Des',
]

function formatHeader(header) {
    if (!header) return '';
    const str = header.replace(/_/g, ' ').toLowerCase();
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getNorwegianMonthAbbr(monthNum) {
    // Accepts '01', '1', 1, etc.
    const n = Number(monthNum)
    if (n >= 1 && n <= 12) return NORWEGIAN_MONTHS[n]
    return ''
}

// Map a CSV transaction to the accounting format
function mapTransactionToAccounting(tx) {
    // This mapping may need to be adjusted based on your real CSV structure
    let monthNum = ''
    if (tx['Bokføringsdato']) {
        const parts = tx['Bokføringsdato'].split(/[\/-]/)
        if (parts.length === 3) monthNum = parts[1]
    }

    const isOutgoing = tx['Beløp'] && Number(tx['Beløp']) < 0
    
    let avsender = tx['Avsender'] || '';
    let mottaker = tx['Mottaker'] || '';
    let tekst = tx['Tittel'] || '';
    let beløp = tx['Beløp'] || '';

    return {
        Bokføringsdato: tx['Bokføringsdato'] || tx['Bokføringsdato'] || '',
        Avsender: avsender,
        Mottaker: mottaker,
        Type: tx['Betalingstype'] || '',
        Tekst: tekst,
        'Ut fra konto': isOutgoing ? beløp : '',
        'Inn på konto': !isOutgoing && beløp ? beløp : '',
        Beløp: beløp,
        År:
            (tx['Bokføringsdato'] && tx['Bokføringsdato'].split(/[\/-]/)[0]) ||
            '',
        Måned: getNorwegianMonthAbbr(monthNum),
        Dag:
            (tx['Bokføringsdato'] && tx['Bokføringsdato'].split(/[\/-]/)[2]) ||
            '',
        Kategori: '',
        Merker: '',
    }
}

// Find diffs between accounting and new transactions
function diffTransactions(accountingRows, newRows) {
    // Map all new transactions to accounting format
    const mappedNew = newRows.map(mapTransactionToAccounting)
    // Helper to compare all fields except date
    function isAlmostSimilar(a, b) {
        return ACCOUNTING_COLUMNS.filter((c) => c !== 'Bokføringsdato').every(
            (col) => (a[col] || '') === (b[col] || '')
        )
    }
    // Helper to compare all fields
    function isExact(a, b) {
        return ACCOUNTING_COLUMNS.every(
            (col) => (a[col] || '') === (b[col] || '')
        )
    }
    // Find exact duplicates
    const exactMatches = []
    const almostMatches = []
    const newOnes = []
    mappedNew.forEach((newTx) => {
        const exact = accountingRows.find((acc) => isExact(acc, newTx))
        if (exact) {
            exactMatches.push({ old: exact, new: newTx })
            return
        }
        // If not exact, check for almost similar (date is 'Reservert' or differs)
        const almost = accountingRows.find(
            (acc) =>
                isAlmostSimilar(acc, newTx) &&
                (acc['Bokføringsdato'] === 'Reservert' ||
                    newTx['Bokføringsdato'] === 'Reservert' ||
                    acc['Bokføringsdato'] !== newTx['Bokføringsdato'])
        )
        if (almost) {
            almostMatches.push({ old: almost, new: newTx })
            return
        }
        // Otherwise, it's a new transaction
        newOnes.push(newTx)
    })
    return { exactMatches, almostMatches, newOnes }
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
    inputView.classList.add('max-w-5xl', 'mx-auto');
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
            trainClassifiers()
            renderPreview()
        },
    })
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
            renderTable(csvData.slice(0, 5)) +
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

function parseDate(dateStr) {
    if (!dateStr || dateStr === 'Reservert') return null
    // Accepts YYYY/MM/DD or similar
    const parts = dateStr.split(/[\/-]/)
    if (parts.length !== 3) return null
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
}

function isNumberCol(col) {
    return ['Beløp', 'Ut fra konto', 'Inn på konto', 'År', 'Dag'].includes(col)
}

function sortReviewRows(rows) {
    // Sorts rows so non-review items appear first, then sorts by date within groups.
    return rows.slice().sort((a, b) => {
        const aIsReview = a.type !== 'old'
        const bIsReview = b.type !== 'old'

        if (!aIsReview && bIsReview) return 1 // a (non-review) comes first
        if (aIsReview && !bIsReview) return -1 // b (non-review) comes first

        // Secondary sort: by date
        const da = parseDate(a.row['Bokføringsdato'])
        const db = parseDate(b.row['Bokføringsdato'])
        if (!da && !db) return 0
        if (!da) return 1 // 'Reservert' or invalid at top
        if (!db) return -1
        return da - db
    })
}

function validateCell(header, value) {
    const trimmedValue = value.trim()
    if (EDITABLE_COLUMNS.includes(header)) {
        // For now, all editable columns accept any string value.
        return { isValid: true, value: trimmedValue }
    }
    // This should not be called for non-editable columns, but as a safeguard:
    return { isValid: false }
}

function setupTableCellEditing() {
    reviewView.querySelectorAll('td[contenteditable="true"]').forEach((cell) => {
        cell.addEventListener('focus', (e) => {
            e.target.dataset.originalValue = e.target.textContent.trim()
        })

        cell.addEventListener('blur', (e) => {
            const td = e.target
            const tr = td.closest('tr')
            if (!tr) return

            const rowIndex = parseInt(tr.dataset.rowIndex, 10)
            const header = td.dataset.header
            const newValue = td.textContent.trim()
            const oldValue = td.dataset.originalValue

            if (newValue === oldValue) return // No change

            const validation = validateCell(header, newValue)

            if (!validation.isValid) {
                alert(`Invalid value "${newValue}" for ${header}.`)
                td.textContent = oldValue
                return
            }

            const dataRow = reviewRows[rowIndex].row
            dataRow[header] = validation.value

            const container = document.getElementById('review-table-container')
            const currentScroll = container ? container.scrollTop : 0
            renderReviewTable(currentScroll)
        })
    })
}

function renderReviewTable(scrollPosition = 0) {
    // Render the Excel-like table with old transactions and review diffs
    reviewRows = []
    const headers = ACCOUNTING_COLUMNS
    let html = `
      <div class="w-full p-4">
        <div class="flex justify-end mb-2">
          <button id="download-merged-btn" class="bg-blue-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Download Merged File</button>
        </div>
        <div id="review-table-container" class="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table class="w-full text-xs text-left border border-gray-200 bg-white">
            <thead>
              <tr>
                ${headers.map((h) => `<th class="sticky top-0 z-10 border px-2 py-1 bg-gray-100">${h}</th>`).join('')}
                <th class="sticky top-0 z-10 border px-2 py-1 bg-gray-100">Actions</th>
              </tr>
            </thead>
            <tbody>
    `
    if (!excelData) {
        html += Array.from({ length: 12 })
            .map(
                () =>
                    `<tr>${headers.map(() => '<td class="border px-2 py-1 h-8">&nbsp;</td>').join('')}<td class="border px-2 py-1 h-8">&nbsp;</td></tr>`
            )
            .join('')
    } else {
        // Compute diffs
        const diffs = diffTransactions(excelData, csvData || [])

        // Find uncategorized old rows and apply predictions
        const oldRows = excelData.filter(
            (old) =>
                !diffs.exactMatches.some((m) => m.old === old) &&
                !diffs.almostMatches.some((m) => m.old === old)
        )
        const modifiedOldRows = findAndApplyPredictions(
            oldRows,
            predictionIgnoredRows
        )

        // Apply predictions to new and almost-new items
        findAndApplyPredictions(diffs.newOnes)
        findAndApplyPredictions(diffs.almostMatches.map((p) => p.new))

        // Prepare all rows to render
        let localRowsToRender = []

        // Add diffs (new, almost-new, almost-old)
        diffs.almostMatches.forEach((pair, idx) => {
            localRowsToRender.push({ type: 'almost-old', row: pair.old, idx })
            localRowsToRender.push({ type: 'almost-new', row: pair.new, idx })
        })
        diffs.newOnes.forEach((row, idx) => {
            localRowsToRender.push({ type: 'new', row, idx })
        })

        // Add old rows, differentiating between predicted and normal
        oldRows.forEach((row) => {
            if (modifiedOldRows.has(row)) {
                localRowsToRender.push({ type: 'predicted', row })
            } else {
                localRowsToRender.push({ type: 'old', row })
            }
        })

        // Sort rows: non-review first, then by date
        reviewRows = sortReviewRows(localRowsToRender)

        // Render rows
        reviewRows.forEach(({ type, row, idx }, rowIndex) => {
            let trClass = ''
            if (type === 'almost-old') trClass = 'bg-red-100'
            if (type === 'almost-new' || type === 'new')
                trClass = 'bg-green-100'
            if (type === 'predicted') trClass = 'bg-yellow-100'

            html += `<tr class="${trClass}" data-row-index="${rowIndex}">`
            headers.forEach((h) => {
                const isEditable = EDITABLE_COLUMNS.includes(h)
                let val = row[h] ?? ''
                if (
                    isNumberCol(h) &&
                    val !== '' &&
                    val !== null &&
                    val !== undefined
                ) {
                    val = Number(val)
                }

                const tdClass = !isEditable && type === 'old' ? 'bg-gray-50' : ''

                html += `<td class="border px-2 py-1 h-8 ${tdClass}" contenteditable="${isEditable}" data-header="${h}">${val}</td>`
            })

            // Actions
            if (
                type === 'almost-new' ||
                type === 'new' ||
                type === 'predicted'
            ) {
                let approveType = type
                if (type === 'predicted') {
                    approveType = 'predicted'
                } else if (type === 'almost-new') {
                    approveType = 'almost'
                }
                html += `<td class="border px-2 py-1 h-8 text-center align-middle"><button class='approve-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded mr-2' data-type='${approveType}' data-idx='${idx}'>Approve</button><button class='decline-btn bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded' data-type='${approveType}' data-idx='${idx}'>Decline</button></td>`
            } else if (type === 'almost-old') {
                html += `<td class="border px-2 py-1 h-8 text-center align-middle">Old</td>`
            } else {
                html += `<td class="border px-2 py-1 h-8"></td>`
            }
            html += '</tr>'
        })
    }
    html += `</tbody></table></div></div>`
    reviewView.innerHTML = html

    const container = document.getElementById('review-table-container');
    if (container) {
        container.scrollTop = scrollPosition;
    }

    setupTableCellEditing()

    // Enable/disable download button
    const downloadBtn = document.getElementById('download-merged-btn')
    const hasUnreviewed = !!reviewView.querySelector(
        '.approve-btn, .decline-btn'
    )
    downloadBtn.disabled = hasUnreviewed
    downloadBtn.onclick = function () {
        if (downloadBtn.disabled) return
        // Download excelData as xlsx, ensure numbers are numbers
        const exportData = excelData.map((row) => {
            const out = { ...row }
            for (const col of ACCOUNTING_COLUMNS) {
                if (
                    isNumberCol(col) &&
                    out[col] !== '' &&
                    out[col] !== null &&
                    out[col] !== undefined
                ) {
                    out[col] = Number(out[col])
                }
            }
            return out
        })
        const ws = XLSX.utils.json_to_sheet(exportData, {
            header: ACCOUNTING_COLUMNS,
        })
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Merged')
        XLSX.writeFile(wb, 'merged_accounting.xlsx')
    }

    // Add event listeners for Approve/Decline buttons (same as before)
    const diffs = excelData ? diffTransactions(excelData, csvData || []) : null
    if (diffs) {
        reviewView
            .querySelectorAll('.approve-btn[data-type="almost"]')
            .forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const container = document.getElementById('review-table-container');
                    const currentScroll = container ? container.scrollTop : 0;
                    const idx = parseInt(btn.getAttribute('data-idx'))
                    const pair = diffs.almostMatches[idx]
                    const oldIdx = excelData.findIndex(
                        (row) => row === pair.old
                    )
                    if (oldIdx !== -1) excelData[oldIdx] = pair.new
                    const csvIdx = csvData.findIndex(
                        (tx) =>
                            mapTransactionToAccounting(tx)['Bokføringsdato'] ===
                                pair.new['Bokføringsdato'] &&
                            mapTransactionToAccounting(tx)['Beløp'] ===
                                pair.new['Beløp']
                    )
                    if (csvIdx !== -1) csvData.splice(csvIdx, 1)
                    renderReviewTable(currentScroll)
                })
            })
        reviewView
            .querySelectorAll('.decline-btn[data-type="almost"]')
            .forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const container = document.getElementById('review-table-container');
                    const currentScroll = container ? container.scrollTop : 0;
                    const idx = parseInt(btn.getAttribute('data-idx'))
                    const pair = diffs.almostMatches[idx]
                    const csvIdx = csvData.findIndex(
                        (tx) =>
                            mapTransactionToAccounting(tx)['Bokføringsdato'] ===
                                pair.new['Bokføringsdato'] &&
                            mapTransactionToAccounting(tx)['Beløp'] ===
                                pair.new['Beløp']
                    )
                    if (csvIdx !== -1) csvData.splice(csvIdx, 1)
                    renderReviewTable(currentScroll)
                })
            })
        reviewView
            .querySelectorAll('.approve-btn[data-type="new"]')
            .forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const container = document.getElementById('review-table-container');
                    const currentScroll = container ? container.scrollTop : 0;
                    const idx = parseInt(btn.getAttribute('data-idx'))
                    const diffsNow = diffTransactions(excelData, csvData || [])
                    const row = diffsNow.newOnes[idx]
                    excelData.push(row)
                    const csvIdx = csvData.findIndex(
                        (tx) =>
                            mapTransactionToAccounting(tx)['Bokføringsdato'] ===
                                row['Bokføringsdato'] &&
                            mapTransactionToAccounting(tx)['Beløp'] ===
                                row['Beløp']
                    )
                    if (csvIdx !== -1) csvData.splice(csvIdx, 1)
                    renderReviewTable(currentScroll)
                })
            })
        reviewView
            .querySelectorAll('.decline-btn[data-type="new"]')
            .forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const container = document.getElementById('review-table-container');
                    const currentScroll = container ? container.scrollTop : 0;
                    const idx = parseInt(btn.getAttribute('data-idx'))
                    const diffsNow = diffTransactions(excelData, csvData || [])
                    const row = diffsNow.newOnes[idx]
                    const csvIdx = csvData.findIndex(
                        (tx) =>
                            mapTransactionToAccounting(tx)['Bokføringsdato'] ===
                                row['Bokføringsdato'] &&
                            mapTransactionToAccounting(tx)['Beløp'] ===
                                row['Beløp']
                    )
                    if (csvIdx !== -1) csvData.splice(csvIdx, 1)
                    renderReviewTable(currentScroll)
                })
            })
        reviewView
            .querySelectorAll('.approve-btn[data-type="predicted"]')
            .forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    // Approving simply accepts the current data.
                    // The row will be re-rendered as a normal 'old' row next time.
                    const container =
                        document.getElementById('review-table-container')
                    const currentScroll = container ? container.scrollTop : 0
                    renderReviewTable(currentScroll)
                })
            })
        reviewView
            .querySelectorAll('.decline-btn[data-type="predicted"]')
            .forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const container =
                        document.getElementById('review-table-container')
                    const currentScroll = container ? container.scrollTop : 0
                    const tr = btn.closest('tr')
                    const rowIndex = parseInt(tr.dataset.rowIndex, 10)
                    const rowData = reviewRows[rowIndex].row

                    // Revert prediction and add to ignore list for this session
                    rowData['Kategori'] = ''
                    rowData['Merker'] = ''
                    predictionIgnoredRows.add(rowData)

                    renderReviewTable(currentScroll)
                })
            })
    }
}

function trainClassifiers() {
    if (!excelData) return
    categoryClassifier = new NaiveBayesClassifier()
    tagsClassifier = new NaiveBayesClassifier()

    console.log('Training classifiers on existing data...')
    excelData.forEach((row) => {
        const text = `${row['Avsender']} ${row['Mottaker']} ${row['Tekst']}`
        if (row['Kategori']) {
            categoryClassifier.train(text, row['Kategori'])
        }
        if (row['Merker']) {
            // Split tags by comma and train on each individual tag
            const tags = row['Merker']
                .toString()
                .split(/[,;]/)
                .map((t) => t.trim())
                .filter(Boolean)
            console.log(`Training on tags for "${text}":`, tags)
            tags.forEach((tag) => {
                tagsClassifier.train(text, tag)
            })
        }
    })
    console.log('Training complete. Category count:', Object.keys(categoryClassifier.categoryCounts).length)
    console.log('Tag count:', Object.keys(tagsClassifier.categoryCounts).length)
}

function findAndApplyPredictions(rows, ignoreSet = new Set()) {
    const modifiedRows = new Set()
    if (!rows || rows.length === 0) return modifiedRows

    rows.forEach((row) => {
        if (ignoreSet.has(row)) return

        const text = `${row['Avsender']} ${row['Mottaker']} ${row['Tekst']}`
        let modified = false

        if (!row['Kategori']) {
            const categoryPrediction = categoryClassifier.predict(text, {
                confidenceLevel: 2.0,
            })
            if (categoryPrediction) {
                row['Kategori'] = categoryPrediction
                modified = true
            }
        }

        if (row['Kategori'] && !row['Merker']) {
            const tagPredictions = tagsClassifier.predict(text, {
                confidenceLevel: 2.5,
                multi: true,
                relativeThreshold: 5.0,
            })
            if (tagPredictions && tagPredictions.length > 0) {
                row['Merker'] = tagPredictions.join(', ')
                modified = true
            }
        }

        if (modified) {
            modifiedRows.add(row)
        }
    })
    return modifiedRows
}
