const EDITABLE_COLUMNS = ['Type', 'Kategori', 'Merker']
const LOADTESTFILES = false

// Inferred accounting columns from screenshot
const ACCOUNTING_COLUMNS = [
    'Bokføringsdato',
    'Konto',
    'Type',
    'Tekst',
    'Ut fra konto',
    'Inn på konto',
    'Gruppe',
    'Beløp',
    'År',
    'Måned',
    'Dag',
    'Kategori',
    'Merker',
]

const COMPARE_ACCOUNTING_COLUMNS = [
    'Bokføringsdato',
    'Konto',
    'Type',
    'Tekst',
    'Ut fra konto',
    'Inn på konto',
    'Beløp',
]

// Må ha engelsk måned likevell :( pga excel pivot tabell, ellers skrive om kode til å ha norsk talltegn
const NORWEGIAN_MONTHS = [
    '',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
]
