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
    reviewView.innerHTML =
        '<div class="mb-4 font-bold">Review Changes (Excel-like Table Coming Soon)</div>'
    // Will render the color-coded, editable table here in the next step
}
