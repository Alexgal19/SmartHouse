const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const jwt = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet('1UYe8N29Q3Eus-6UEOkzCNfzwSKmQ-kpITgj4SWWhpbw', jwt);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle['OdbiorEntries'];
  if (!sheet) {
    console.log('No OdbiorEntries sheet');
    return;
  }
  console.log(`RowCount (grid): ${sheet.rowCount}`);
  const startTime = Date.now();
  const rows = await sheet.getRows();
  console.log(`Data rows count: ${rows.length}`);
  console.log(`Time taken: ${Date.now() - startTime}ms`);
}
check().catch(console.error);
