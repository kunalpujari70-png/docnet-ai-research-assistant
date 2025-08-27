'use strict';

const fs = require('fs');

function safeLog() {
  // avoid noisy logs interfering with JSON output
}

(async () => {
  try {
    const pdfParse = require('pdf-parse');
    const pdfPath = process.argv[2];
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      console.error(JSON.stringify({ error: 'PDF path missing or not found', path: pdfPath }));
      process.exit(2);
    }
    const dataBuffer = fs.readFileSync(pdfPath);
    const result = await pdfParse(dataBuffer);
    const payload = { text: result?.text || '' };
    process.stdout.write(JSON.stringify(payload));
    process.exit(0);
  } catch (err) {
    try {
      console.error(JSON.stringify({ error: String(err && err.message || err) }));
    } catch (_) {
      // ignore
    }
    process.exit(1);
  }
})();
