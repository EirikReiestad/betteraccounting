excelInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
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
    trainClassifiers()
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
