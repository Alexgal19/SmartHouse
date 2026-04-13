import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { fileURLToPath } from 'url';
const data = fs.readFileSync('src/lib/sheets.ts', 'utf8');
console.log(data.match(/settingsCache/));
