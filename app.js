// Import SheetJS and PapaParse from CDN
const excelInput = document.getElementById("excel-upload");
const csvInput = document.getElementById("csv-upload");
const dataPreview = document.getElementById("data-preview");
const categorizationUI = document.getElementById("categorization-ui");

// Global data structure to store uploaded files
const appData = {
  template: null,
  transactions: null,
};

let excelData = null;
let csvData = null;

function renderMergeButton() {
  // Remove old button if present
  const oldBtn = document.getElementById('merge-btn');
  if (oldBtn) oldBtn.remove();
  if (excelData && csvData) {
    const btn = document.createElement('button');
    btn.id = 'merge-btn';
    btn.textContent = 'Merge Transactions';
    btn.className = 'button bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-4';
    btn.onclick = () => {
      const merged = window.updateTransactions(excelData, csvData);
      renderMergedPreview(merged);
    };
    dataPreview.parentNode.insertBefore(btn, dataPreview);
  }
}

function renderMergedPreview(merged) {
  dataPreview.innerHTML = '<div class="mb-2 font-bold">Merged Transactions Preview:</div>' + renderTable(merged.slice(0, 10));
}

excelInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheetName = workbook.SheetNames[0];
  excelData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
  });
  renderPreview();
  renderMergeButton();
});

csvInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      csvData = results.data;
      renderPreview();
      renderMergeButton();
    },
  });
});

function renderPreview() {
  dataPreview.innerHTML = "";
  let html = "";
  if (excelData) {
    html +=
      '<div class="mb-2 font-bold">Current Accounting File Preview:</div>' +
      renderTable(excelData.slice(0, 5));
  }
  if (csvData) {
    html +=
      '<div class="mb-2 font-bold">Transactions Preview:</div>' +
      renderTable(csvData.slice(0, 5));
  }
  dataPreview.innerHTML = html;
}

function renderTable(data) {
  if (!data || data.length === 0)
    return '<div class="text-gray-400">No data</div>';
  const headers = Object.keys(data[0]);
  let html =
    '<div class="overflow-x-auto"><table class="min-w-full text-xs text-left border border-gray-200"><thead><tr>';
  headers.forEach(
    (h) => (html += `<th class="border px-2 py-1 bg-gray-100">${h}</th>`),
  );
  html += "</tr></thead><tbody>";
  data.forEach((row) => {
    html += "<tr>";
    headers.forEach(
      (h) => (html += `<td class="border px-2 py-1">${row[h]}</td>`),
    );
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  return html;
}
