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

function renderPreview() {
    dataPreview.innerHTML = ''
    let html = ''
    if (excelData) {
        html +=
            '<section class="rounded-lg shadow p-6 flex-1 w-full sm:w-1/2 mb-4 sm:mb-0">' +
            '<label class="block font-semibold mb-2">Current Accounting File Preview:</label>' +
            renderTable(excelData) +
            '</section>'
    }
    if (csvData) {
        html +=
            '<section class="rounded-lg shadow p-6 flex-1 w-full sm:w-1/2 mb-4 sm:mb-0">' +
            '<label class="block font-semibold mb-2">Transactions Preview:</label>' +
            renderTable(csvData) +
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
        '<div class="overflow-x-auto overflow-y-auto max-h-96"><table class="min-w-full text-xs text-left border border-gray-200"><thead><tr>'
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

function renderReviewTable(scrollPosition = 0) {
    // Render the Excel-like table with old transactions and review diffs
    reviewRows = []
    const headers = ACCOUNTING_COLUMNS
    let html = `
      <div class="w-full px-4 py-4">
        <div class="flex justify-end mb-2 space-x-2">
          <button id="download-merged-btn" class="bg-blue-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Download Merged File</button>
          <button id="accept-all-btn" class="bg-green-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">Accept All</button>
        </div>
        <div id="review-table-container" class="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table class="w-full text-xs text-left border border-gray-200 bg-white">
            <thead>
              <tr>
                ${headers.map((h) => `<th class="sticky top-0 z-10 border px-2 py-1 bg-blue-50">${h}</th>`).join('')}
                <th class="sticky top-0 z-10 border px-2 py-1 bg-blue-50">Actions</th>
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

        // Apply predictions to new and almost-new items
        diffs.newOnes = findAndApplyPredictions(diffs.newOnes)
        // findAndApplyPredictions(diffs.almostMatches.map((p) => p.new))

        // Find uncategorized old rows and apply predictions
        /*
        const oldRows = excelData.filter(
            (old) =>
                !diffs.exactMatches.some((m) => m.old === old) &&
                !diffs.almostMatches.some((m) => m.old === old)
        )
        */
        oldRows = excelData
        /*
        const modifiedOldRows = findAndApplyPredictions(
            oldRows,
            predictionIgnoredRows
        )
        */

        // Prepare all rows to render
        const localRowsToRender = []

        // Add diffs (new, almost-new, almost-old)
        /*
        diffs.almostMatches.forEach((pair, idx) => {
            localRowsToRender.push({ type: 'almost-old', row: pair.old, idx })
            localRowsToRender.push({ type: 'almost-new', row: pair.new, idx })
        })
        */
        diffs.newOnes.forEach((row, idx) => {
            localRowsToRender.push({ type: 'new', row, idx })
        })

        // Add old rows, differentiating between predicted and normal
        /*
        oldRows.forEach((row) => {
            if (modifiedOldRows.has(row)) {
                localRowsToRender.push({ type: 'predicted', row })
            } else {
                localRowsToRender.push({ type: 'old', row })
            }
        })
        */
        oldRows.forEach((row) => {
            localRowsToRender.push({ type: 'old', row })
        })

        // Sort rows: non-review first, then by date
        reviewRows = sortReviewRows(localRowsToRender)

        // Apply user edits to the rows
        reviewRows.forEach(({ type, row, idx }) => {
            const rowKey = `${row['Bokføringsdato']}_${row['Beløp']}_${row['Avsender']}_${row['Mottaker']}`
            const edits = userEdits.get(rowKey)
            if (edits) {
                Object.assign(row, edits)
            }
        })

        // Render rows
        reviewRows.forEach(({ type, row, idx }, rowIndex) => {
            let trClass = ''
            if (type === 'almost-old') trClass = 'bg-red-100'
            if (type === 'almost-new' || type === 'new')
                trClass = 'bg-green-100'
            // if (type === 'predicted') trClass = 'bg-yellow-100'

            html += `<tr class="${trClass}" data-row-index="${rowIndex}">`
            headers.forEach((h) => {
                const isEditable = EDITABLE_COLUMNS.includes(h)
                let val = row[h] ?? ''
                if (
                    isNumberCol(h) &&
                    val !== '' &&
                    val !== null &&
                    val !== undefined &&
                    !isNaN(Number(val))
                ) {
                    val = Number(val)
                }

                const tdClass =
                    !isEditable && type === 'old' ? 'bg-gray-50' : ''

                html += `<td class="border px-2 py-1 h-8 ${tdClass}" contenteditable="${isEditable}" data-header="${h}">${val}</td>`
            })

            // Actions
            if (
                type === 'almost-new' ||
                type === 'new' // ||
                // type === 'predicted'
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

    const container = document.getElementById('review-table-container')
    if (container) {
        container.scrollTop = scrollPosition
    }

    setupTableCellEditing()

    // Enable/disable download button
    const downloadBtn = document.getElementById('download-merged-btn')
    const acceptAllBtn = document.getElementById('accept-all-btn')
    const hasUnreviewed = !!reviewView.querySelector(
        '.approve-btn, .decline-btn'
    )
    downloadBtn.disabled = hasUnreviewed
    acceptAllBtn.disabled = !hasUnreviewed
    allExcelData = reviewRows.map((row) => {
        return row.row
    })
    downloadBtn.onclick = function () {
        if (downloadBtn.disabled) return
        const exportData = allExcelData
        /*
        if (allExcelData && allExcelData.length > 0) {
            exportData = allExcelData.map((row) => {
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
        } else {
            // No Excel file loaded: generate a blank template row
            exportData = [] // No rows, just headers
        }
        */
        // console.log(exportData)
        console.log(exportData)
        const ws = XLSX.utils.json_to_sheet(exportData, {
            header: ACCOUNTING_COLUMNS,
        })
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Merged')
        // Generate filename with current date
        const today = new Date()
        const yyyy = today.getFullYear()
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const dd = String(today.getDate()).padStart(2, '0')
        const filename = `betteraccounting_${yyyy}-${mm}-${dd}.xlsx`
        XLSX.writeFile(wb, filename)
    }

    // Accept All logic
    acceptAllBtn.onclick = function () {
        // const diffs = diffTransactions(excelData, csvData || [])
        excelData = allExcelData
        // Approve all new transactions
        /*
        for (const row of diffs.newOnes) {
            excelData.push({ ...row })
            // Remove from csvData
            const csvIdx = csvData.findIndex(
                (tx) =>
                    mapTransactionToAccounting(tx)['Bokføringsdato'] ===
                        row['Bokføringsdato'] &&
                    mapTransactionToAccounting(tx)['Beløp'] === row['Beløp']
            )
            if (csvIdx !== -1) csvData.splice(csvIdx, 1)
            // Remove user edits for this row
            const rowKey = `${row['Bokføringsdato']}_${row['Beløp']}_${row['Avsender']}_${row['Mottaker']}`
            userEdits.delete(rowKey)
            // Apply predictions to this new row
            // findAndApplyPredictions([row])
        }
        */
        /*
        // Approve all almost-new transactions
        for (const pair of diffs.almostMatches) {
            // Replace the old transaction with the new one
            const oldIdx = excelData.findIndex((row) => row === pair.old)
            if (oldIdx !== -1) {
                excelData[oldIdx] = { ...pair.new }
                // Apply predictions to this new row
                // findAndApplyPredictions([excelData[oldIdx]])
            }
            // Remove from csvData
            const csvIdx = csvData.findIndex(
                (tx) =>
                    mapTransactionToAccounting(tx)['Bokføringsdato'] ===
                        pair.new['Bokføringsdato'] &&
                    mapTransactionToAccounting(tx)['Beløp'] ===
                        pair.new['Beløp']
            )
            if (csvIdx !== -1) csvData.splice(csvIdx, 1)
            // Remove user edits for this row
            const rowKey = `${pair.new['Bokføringsdato']}_${pair.new['Beløp']}_${pair.new['Avsender']}_${pair.new['Mottaker']}`
            userEdits.delete(rowKey)
        }
        */
        renderReviewTable()
    }

    // Add event listeners for Approve/Decline buttons (same as before)
    const diffs = excelData ? diffTransactions(excelData, csvData || []) : null
    if (diffs) {
        reviewView
            .querySelectorAll('.approve-btn[data-type="almost"]')
            .forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const container = document.getElementById(
                        'review-table-container'
                    )
                    const currentScroll = container ? container.scrollTop : 0
                    const idx = parseInt(btn.getAttribute('data-idx'))

                    // Get the row data directly from reviewRows (which contains user edits)
                    const tr = btn.closest('tr')
                    const rowIndex = parseInt(tr.dataset.rowIndex, 10)
                    const rowData = reviewRows[rowIndex].row

                    // Find the original pair to get the old transaction
                    const pair = diffs.almostMatches[idx]
                    const oldIdx = excelData.findIndex(
                        (row) => row === pair.old
                    )

                    // Replace the old transaction with the edited new transaction
                    if (oldIdx !== -1) {
                        excelData[oldIdx] = { ...rowData }
                    }

                    // Clear user edits for this row
                    const rowKey = `${rowData['Bokføringsdato']}_${rowData['Beløp']}_${rowData['Avsender']}_${rowData['Mottaker']}`
                    userEdits.delete(rowKey)

                    // Remove from CSV data
                    const csvIdx = csvData.findIndex(
                        (tx) =>
                            mapTransactionToAccounting(tx)['Bokføringsdato'] ===
                                rowData['Bokføringsdato'] &&
                            mapTransactionToAccounting(tx)['Beløp'] ===
                                rowData['Beløp']
                    )
                    if (csvIdx !== -1) csvData.splice(csvIdx, 1)
                    renderReviewTable(currentScroll)
                })
            })
        reviewView
            .querySelectorAll('.decline-btn[data-type="almost"]')
            .forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const container = document.getElementById(
                        'review-table-container'
                    )
                    const currentScroll = container ? container.scrollTop : 0
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
                    const container = document.getElementById(
                        'review-table-container'
                    )
                    const currentScroll = container ? container.scrollTop : 0
                    const idx = parseInt(btn.getAttribute('data-idx'))

                    // Get the row data directly from reviewRows (which contains user edits)
                    const tr = btn.closest('tr')
                    const rowIndex = parseInt(tr.dataset.rowIndex, 10)
                    const rowData = reviewRows[rowIndex].row

                    // Add the edited transaction to excelData
                    excelData.push({ ...rowData })

                    // Clear user edits for this row
                    const rowKey = `${rowData['Bokføringsdato']}_${rowData['Beløp']}_${rowData['Avsender']}_${rowData['Mottaker']}`
                    userEdits.delete(rowKey)

                    // Remove from CSV data
                    const csvIdx = csvData.findIndex(
                        (tx) =>
                            mapTransactionToAccounting(tx)['Bokføringsdato'] ===
                                rowData['Bokføringsdato'] &&
                            mapTransactionToAccounting(tx)['Beløp'] ===
                                rowData['Beløp']
                    )
                    if (csvIdx !== -1) csvData.splice(csvIdx, 1)
                    renderReviewTable(currentScroll)
                })
            })
        reviewView
            .querySelectorAll('.decline-btn[data-type="new"]')
            .forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const container = document.getElementById(
                        'review-table-container'
                    )
                    const currentScroll = container ? container.scrollTop : 0
                    const idx = parseInt(btn.getAttribute('data-idx'))

                    const tr = btn.closest('tr')
                    const rowIndex = parseInt(tr.dataset.rowIndex, 10)
                    const rowData = reviewRows[rowIndex].row

                    /*
                    const diffsNow = diffTransactions(excelData, csvData || [])
                    const row = diffsNow.newOnes[idx]
                    */
                    const csvIdx = csvData.findIndex(
                        (tx) =>
                            mapTransactionToAccounting(tx)['Bokføringsdato'] ===
                                rowData['Bokføringsdato'] &&
                            mapTransactionToAccounting(tx)['Beløp'] ===
                                rowData['Beløp']
                    )
                    if (csvIdx !== -1) csvData.splice(csvIdx, 1)
                    renderReviewTable(currentScroll)
                })
            })
        reviewView
            .querySelectorAll('.approve-btn[data-type="predicted"]')
            .forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    // Get the row data directly from reviewRows (which contains user edits)
                    const tr = btn.closest('tr')
                    const rowIndex = parseInt(tr.dataset.rowIndex, 10)
                    const rowData = reviewRows[rowIndex].row

                    // The row data already contains user edits from setupTableCellEditing
                    // No additional processing needed - just approve the current state

                    // Clear user edits for this row
                    const rowKey = `${rowData['Bokføringsdato']}_${rowData['Beløp']}_${rowData['Avsender']}_${rowData['Mottaker']}`
                    userEdits.delete(rowKey)

                    const container = document.getElementById(
                        'review-table-container'
                    )
                    const currentScroll = container ? container.scrollTop : 0
                    renderReviewTable(currentScroll)
                })
            })
        reviewView
            .querySelectorAll('.decline-btn[data-type="predicted"]')
            .forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const container = document.getElementById(
                        'review-table-container'
                    )
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
