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
        { confidenceLevel = 2.0, multi = false, relativeThreshold = 2.0 } = {}
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
            return []
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
            return []
        }

        // If we're here, we are confident in our best pick.
        if (!multi) {
            return [best[0]]
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

function trainClassifiers() {
    if (!excelData) return
    categoryClassifier = new NaiveBayesClassifier()
    tagsClassifier = new NaiveBayesClassifier()

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
            tags.forEach((tag) => {
                tagsClassifier.train(text, tag)
            })
        }
    })
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
                confidenceLevel: 4.0,
            })
            if (categoryPrediction) {
                row['Kategori'] = categoryPrediction[0]
                modified = true
            }
        }

        if (row['Kategori'] && !row['Merker']) {
            const tagPredictions = tagsClassifier.predict(text, {
                confidenceLevel: 6,
                multi: false,
                relativeThreshold: 6.0,
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
