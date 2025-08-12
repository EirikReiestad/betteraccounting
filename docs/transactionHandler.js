// Map a CSV transaction to the accounting format
function mapTransactionToAccounting(tx) {
    // This mapping may need to be adjusted based on your real CSV structure
    let monthNum = ''
    if (tx['Bokføringsdato']) {
        const parts = tx['Bokføringsdato'].split(/[\/-]/)
        if (parts.length === 3) monthNum = parts[1]
    }

    let beløp = tx['Beløp'].replace(',', '.')

    try {
        if (typeof beløp !== 'number') {
            beløp = Number(beløp)
        }
    } catch (e) {
        throw `Beløp not an valid integer: ${e}`
    }

    const isOutgoing = beløp < 0

    let avsender = tx['Avsender'] || ''
    let mottaker = tx['Mottaker'] || ''
    let tekst = tx['Tittel'] || ''
    beløp = beløp || ''

    return {
        Bokføringsdato: tx['Bokføringsdato'] || tx['Bokføringsdato'] || '',
        Avsender: avsender,
        Mottaker: mottaker,
        Type: tx['Betalingstype'] || '',
        Tekst: tekst,
        'Ut fra konto': isOutgoing ? -beløp : '',
        'Inn på konto': !isOutgoing && beløp ? beløp : '',
        Gruppe: '',
        Beløp: beløp,
        År:
            Number(
                tx['Bokføringsdato'] && tx['Bokføringsdato'].split(/[\/-]/)[0]
            ) || '',
        Måned: getNorwegianMonthAbbr(monthNum),
        Dag:
            Number(
                tx['Bokføringsdato'] && tx['Bokføringsdato'].split(/[\/-]/)[2]
            ) || '',
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
        return COMPARE_ACCOUNTING_COLUMNS.filter(
            (c) => c !== 'Bokføringsdato'
        ).every((col) => (a[col] || '') === (b[col] || ''))
    }
    // Helper to compare all fields
    function isExact(a, b) {
        const exact = COMPARE_ACCOUNTING_COLUMNS.every((col) => {
            return (a[col] || '') === (b[col] || '')
        })
        return exact
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
        /*
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
        */
        newOnes.push(newTx)
    })
    return { exactMatches, almostMatches, newOnes }
}
