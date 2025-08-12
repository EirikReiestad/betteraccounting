function setupTableCellEditing() {
    reviewView
        .querySelectorAll('td[contenteditable="true"]')
        .forEach((cell) => {
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

                // Store the edit in userEdits Map
                const rowData = reviewRows[rowIndex].row
                const rowKey = `${rowData['Bokføringsdato']}_${rowData['Beløp']}_${rowData['Avsender']}_${rowData['Mottaker']}`

                if (!userEdits.has(rowKey)) {
                    userEdits.set(rowKey, {})
                }
                userEdits.get(rowKey)[header] = validation.value

                // Re-render the table to show the edits
                const container = document.getElementById(
                    'review-table-container'
                )
                const currentScroll = container ? container.scrollTop : 0
                renderReviewTable(currentScroll)
            })
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
