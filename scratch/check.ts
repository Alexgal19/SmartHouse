import { getSettings } from '../src/lib/sheets';
import * as dotenv from 'dotenv';
import { Coordinator } from '../src/types';
dotenv.config({ path: '.env.local' });

async function run() {
    try {
        const settings = await getSettings();
        console.log('Coordinators:');
        for (const c of settings.coordinators) {
            console.log(`- "${c.name}" (ID: ${c.uid}, isBok: ${c.isBok}, departments: ${c.departments.join(', ')})`);
        }
    } catch (error) {
        console.error('Error running check:', error);
    }
}

run();
