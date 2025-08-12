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
let userEdits = new Map() // Store user edits: key = row identifier, value = { column: value }

let categoryClassifier = new NaiveBayesClassifier()
let tagsClassifier = new NaiveBayesClassifier()
let predictionIgnoredRows = new Set()

// Navbar routing logic
navHome.addEventListener('click', (e) => {
    e.preventDefault()
    inputView.style.display = ''
    reviewView.style.display = 'none'
    // Restore width constraints for home view
    const mainContainer = document.getElementById('main-container')
    mainContainer.classList.add('max-w-7xl', 'mx-auto')
    navHome.classList.add('text-gray-800', 'border-blue-600')
    navHome.classList.remove('text-gray-600', 'border-transparent')
    navReview.classList.remove('text-gray-800', 'border-blue-600')
    navReview.classList.add('text-gray-600', 'border-transparent')
})

navReview.addEventListener('click', (e) => {
    e.preventDefault()
    inputView.style.display = 'none'
    reviewView.style.display = ''
    // Remove width constraints for review view
    const mainContainer = document.getElementById('main-container')
    mainContainer.classList.remove('max-w-7xl', 'mx-auto')
    navReview.classList.add('text-gray-800', 'border-blue-600')
    navReview.classList.remove('text-gray-600', 'border-transparent')
    navHome.classList.remove('text-gray-800', 'border-blue-600')
    navHome.classList.add('text-gray-600', 'border-transparent')
    renderReviewTable()
})

// For testing: To auto-load mock files, uncomment the block below.
if (LOADTESTFILES) {
    window.addEventListener('DOMContentLoaded', async () => {
        // Initialize home view with width constraints
        const mainContainer = document.getElementById('main-container')
        mainContainer.classList.add('max-w-7xl', 'mx-auto')
        await loadTestFiles()
    })
}
