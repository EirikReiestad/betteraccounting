function formatHeader(header) {
    if (!header) return ''
    const str = header.replace(/_/g, ' ').toLowerCase()
    return str.charAt(0).toUpperCase() + str.slice(1)
}

function getNorwegianMonthAbbr(monthNum) {
    // Accepts '01', '1', 1, etc.
    const n = Number(monthNum)
    if (n >= 1 && n <= 12) return NORWEGIAN_MONTHS[n]
    return ''
}

function isSameTransaction(a, b) {
    return (
        a.bokføringsdato === b.bokføringsdato &&
        a.beløp === b.beløp &&
        a.konto === b.konto
    )
}

function isNumberCol(col) {
    return ['Beløp', 'Ut fra konto', 'Inn på konto', 'År', 'Dag'].includes(col)
}

function parseDate(dateStr) {
    if (!dateStr || dateStr === 'Reservert') return null
    if (!(typeof dateStr === 'string') && !(dateStr instanceof String)) {
        console.log(`date is not String but type ${typeof dateStr}: ${dateStr}`)
    }
    // Accepts YYYY/MM/DD or similar
    const parts = dateStr.split(/[\/-]/)
    if (parts.length !== 3) return null
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
}

function sortReviewRows(rows) {
    // Sorts rows so non-review items appear first, then sorts by date within groups.
    return rows.slice().sort((a, b) => {
        /*
        const aIsReview = a.type !== 'old'
        const bIsReview = b.type !== 'old'

        if (!aIsReview && bIsReview) return 1 // a (non-review) comes first
        if (aIsReview && !bIsReview) return -1 // b (non-review) comes first
        */

        // Secondary sort: by date
        const da = parseDate(a.row['Bokføringsdato'])
        const db = parseDate(b.row['Bokføringsdato'])
        if (!da && !db) return 0
        if (!da) return 1 // 'Reservert' or invalid at top
        if (!db) return -1
        return da - db
    })
}

async function loadTestFiles() {
    // Load Excel
    const excelResp = await fetch('sample_betteraccounting.xlsx')
    if (!excelResp.ok) {
        throw new Error('Failed to load Excel file: ' + excelResp.statusText)
    }
    const excelArrayBuffer = await excelResp.arrayBuffer()
    const workbook = XLSX.read(excelArrayBuffer)
    const sheetName = workbook.SheetNames[0]
    excelData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: '',
    })
    excelData.forEach((row) => {
        if (typeof row['Bokføringsdato'] === 'number') {
            const baseDate = new Date(1900, 0, 0)
            const date = new Date(
                baseDate.getTime() +
                    (row['Bokføringsdato'] - 1) * 24 * 60 * 60 * 1000
            )
            const yyyy = date.getFullYear()
            const mm = String(date.getMonth() + 1).padStart(2, '0')
            const dd = String(date.getDate()).padStart(2, '0')
            row['Bokføringsdato'] = `${yyyy}/${mm}/${dd}`
        }
    })

    // Load CSV
    const csvResp = await fetch('sample_transactions.csv')
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
