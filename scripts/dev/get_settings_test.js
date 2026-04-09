import fs from 'fs';
import { fileURLToPath } from 'url';
const data = fs.readFileSync('src/lib/sheets.ts', 'utf8');
console.log(data.match(/settingsCache/));
