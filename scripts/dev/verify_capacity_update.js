
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('1. Login sequence');

    try {
        // Go to login directly to be sure
        await page.goto('http://localhost:3000/login', { timeout: 30000 });
        console.log('Opened login page:', await page.title());

        // Check if we are redirected to dashboard (already logged in)
        if (page.url().includes('/dashboard')) {
            console.log('Already logged in. URL:', page.url());
        } else {
            // Check for login form
            if (await page.isVisible('input#name')) {
                console.log('Login form found. Logging in...');
                await page.fill('input#name', 'admin@example.com');
                await page.fill('input#password', 'password');
                await page.click('button[type="submit"]');
                console.log('Clicked submit. Waiting for navigation...');

                try {
                    await page.waitForURL('**/dashboard**', { timeout: 60000 });
                    console.log('Login successful, on dashboard.');
                } catch (e) {
                    console.error('Login navigation timeout. Taking screenshot...');
                    await page.screenshot({ path: 'login_failed.png' });
                    throw e;
                }
            } else {
                console.log('Login form not found on /login? URL:', page.url());
                const content = await page.content();
                console.log('Page Content Preview:', content.substring(0, 500));
            }
        }

        console.log('2. Navigating to Settings endpoint');
        await page.goto('http://localhost:3000/dashboard?view=settings', { timeout: 60000 });
        console.log('Navigated to Settings. Current URL:', page.url());

        console.log('Waiting for "Ustawienia aplikacji" text...');
        try {
            await page.waitForSelector('text=Ustawienia aplikacji', { timeout: 45000 });
            console.log('Settings loaded.');
        } catch (e) {
            console.log('Timeout waiting for Settings header. Dumping page content...');
            const content = await page.content();
            console.log('Page Content Length:', content.length);
            await page.screenshot({ path: 'settings_timeout.png' });
            throw e;
        }

        console.log('In Settings. creating Address...');

        const testAddressName = "Test Auto " + Date.now();
        console.log(`Creating test address: ${testAddressName}`);

        // Click "Dodaj" in AddressManager
        const addBtn = page.locator('div.rounded-md.border.p-4', { hasText: 'Adresy i pokoje' })
            .getByRole('button', { name: 'Dodaj' });

        await addBtn.waitFor({ state: 'visible', timeout: 10000 });
        await addBtn.click();

        console.log('Address Modal opened.');
        await page.waitForSelector('text=Dodaj nowy adres');

        // 1. Locality
        console.log('Selecting locality...');
        await page.click('button:has-text("Wybierz miejscowość")');
        await page.waitForSelector('div[role="option"]');
        await page.click('div[role="option"] >> nth=0');

        // 2. Address Name
        console.log('Filling address name...');
        await page.fill('input[placeholder="np. ul. Słoneczna 5"]', testAddressName);

        // 3. Coordinator (Required)
        console.log('Adding coordinator...');
        await page.getByRole('button', { name: 'Dodaj koordynatora' }).click();
        await page.waitForTimeout(500);
        await page.locator('button:has-text("Wybierz koordynatora")').last().click();
        await page.waitForSelector('div[role="option"]');
        await page.click('div[role="option"] >> nth=0');

        // 4. Room
        console.log('Adding room...');
        await page.getByRole('button', { name: 'Dodaj pokój' }).click();
        await page.waitForTimeout(500);
        await page.fill('input[placeholder="Nazwa pokoju"]', "Room A");
        await page.fill('input[placeholder="Pojemność"]', "5");

        // Save
        console.log('Saving...');
        await page.click('button:has-text("Zapisz")');

        await page.waitForSelector('text=Dodaj nowy adres', { state: 'hidden', timeout: 30000 });
        console.log('Address saved.');

        // 5. Verify in Housing
        console.log('Navigating to Housing View...');
        await page.goto('http://localhost:3000/dashboard?view=housing', { timeout: 60000 });
        try {
            await page.waitForSelector('text=Zakwaterowanie', { timeout: 30000 });
        } catch (e) {
            // Try "Adresy"
            await page.waitForSelector('text=Adresy', { timeout: 30000 });
        }

        // Search
        await page.fill('input[placeholder="Szukaj adresu..."]', testAddressName);
        await page.waitForTimeout(2000);

        // Verify Capacity "0 / 5"
        const addressCard = page.locator(`div:has-text("${testAddressName}")`).first();
        // Wait for it to appear
        await addressCard.waitFor({ state: 'visible', timeout: 10000 });

        const text = await addressCard.innerText();
        console.log('Found Address Card Text:', text);
        if (text.includes('/ 5') || text.includes('/5')) {
            console.log('PASSED: Initial capacity is 5');
        } else {
            console.error('FAILED: Initial capacity is NOT 5');
        }

        // 6. Navigate back to Settings to Edit
        console.log('Navigating back to Settings...');
        await page.goto('http://localhost:3000/dashboard?view=settings', { timeout: 60000 });
        await page.waitForSelector('text=Adresy i pokoje', { timeout: 30000 });

        // Edit
        console.log('Searching for address to edit...');
        await page.locator('div.rounded-md.border.p-4', { hasText: 'Adresy i pokoje' })
            .getByPlaceholder('Szukaj adresu...').fill(testAddressName);
        await page.waitForTimeout(1000);

        console.log('Clicking edit...');
        await page.locator('div.rounded-lg.border', { hasText: testAddressName }).first()
            .getByRole('button').first().click();

        console.log('Edit Modal opened.');
        await page.waitForSelector('text=Edytuj adres', { timeout: 30000 });

        // Change capacity to 10
        console.log('Changing capacity to 10...');
        await page.fill('input[placeholder="Pojemność"]', "10");

        // Save
        console.log('Saving update...');
        await page.click('button:has-text("Zapisz")');
        await page.waitForSelector('text=Edytuj adres', { state: 'hidden', timeout: 30000 });
        console.log('Address updated.');

        // 7. Verify in Housing (IMMEDIATELY)
        console.log('Navigating to Housing View for verification...');
        await page.goto('http://localhost:3000/dashboard?view=housing', { timeout: 60000 });

        // Search again
        await page.fill('input[placeholder="Szukaj adresu..."]', testAddressName);
        await page.waitForTimeout(2000);

        // Verify Capacity "0 / 10"
        const updatedAddressCard = page.locator(`div:has-text("${testAddressName}")`).first();
        if (await updatedAddressCard.isVisible()) {
            const textUpdated = await updatedAddressCard.innerText();
            console.log('Found Updated Address Card Text:', textUpdated);
            if (textUpdated.includes('/ 10') || textUpdated.includes('/10')) {
                console.log('SUCCESS: Capacity updated to 10 immediately.');
            } else {
                console.error('FAILURE: Capacity NOT updated to 10.');
            }
        } else {
            console.error('FAILED: Address card not found after update');
        }

    } catch (error) {
        console.error('Test failed with error:', error);
        try {
            await page.screenshot({ path: 'error_screenshot.png' });
        } catch (e) { }
    } finally {
        await browser.close();
    }
})();
