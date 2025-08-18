function updateTransactions(oldTransactions, newTransactions) {
    function makeKey(t) {
        return `${t.bokføringsdato}|${t.beløp}|${t.konto}`
    }
    const oldKeys = new Set(oldTransactions.map(makeKey))
    const uniqueNew = newTransactions.filter((t) => !oldKeys.has(makeKey(t)))
    return [...oldTransactions, ...uniqueNew]
}

window.updateTransactions = updateTransactions

