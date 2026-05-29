/* eslint-disable @typescript-eslint/no-var-requires */
const { Project } = require('ts-morph');
const fs = require('fs');
const path = require('path');

async function splitSheetsClean() {
    const project = new Project({ tsConfigFilePath: '/Users/oleksandr/Desktop/SmartHouse/tsconfig.json' });
    const sheetsFile = project.getSourceFile('src/lib/sheets.ts');
    const sheetsText = sheetsFile.getFullText();

    const outDir = '/Users/oleksandr/Desktop/SmartHouse/src/lib/sheets-split';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const getDomain = (name) => {
        name = name.toLowerCase();
        if (name.includes('nonemployee')) return 'non-employees.ts';
        if (name.includes('employee')) return 'employees.ts';
        if (name.includes('bokresident')) return 'bok-residents.ts';
        if (name.includes('address') || name.includes('accommodation') || name.includes('room')) return 'housing.ts';
        if (name.includes('candidate')) return 'recruitment.ts';
        if (name.includes('settings') || name.includes('roles') || name.includes('returnoptions') || name.includes('paymenttypes') || name.includes('statuses') || name.includes('nationalities') || name.includes('departments') || name.includes('coordinators') || name.includes('genders') || name.includes('localities')) return 'settings.ts';
        if (name.includes('notification')) return 'notifications.ts';
        if (name.includes('audit')) return 'audit.ts';
        return 'core.ts';
    };

    const exportedFunctions = [];
    for (const stmt of sheetsFile.getStatements()) {
        if (stmt.isExported && stmt.isExported()) {
            let name = '';
            if (stmt.getKindName() === 'FunctionDeclaration') {
                name = stmt.getName();
            } else if (stmt.getKindName() === 'VariableStatement') {
                name = stmt.getDeclarations()[0].getName();
            }
            if (name) {
                exportedFunctions.push({ name, domain: getDomain(name) });
            }
        }
    }

    const domains = [...new Set(exportedFunctions.map(f => f.domain))];

    for (const domain of domains) {
        const filePath = path.join(outDir, domain);
        fs.writeFileSync(filePath, sheetsText);
        
        const newFile = project.addSourceFileAtPath(filePath);
        
        for (const stmt of newFile.getStatements()) {
            if (stmt.isExported && stmt.isExported()) {
                let name = '';
                if (stmt.getKindName() === 'FunctionDeclaration') {
                    name = stmt.getName();
                } else if (stmt.getKindName() === 'VariableStatement') {
                    name = stmt.getDeclarations()[0].getName();
                }
                
                if (name) {
                    const funcDomain = getDomain(name);
                    if (funcDomain !== domain) {
                        stmt.remove();
                    }
                }
            }
        }
        
        newFile.fixUnusedIdentifiers();
        newFile.saveSync();
        console.log(`Created and cleaned ${domain}`);
    }

    let newSheets = `"use server";\n\n`;
    for (const domain of domains) {
        newSheets += `export * from './sheets-split/${domain.replace('.ts', '')}';\n`;
    }
    
    fs.writeFileSync('/Users/oleksandr/Desktop/SmartHouse/src/lib/sheets.ts', newSheets);
    console.log("Rewrote sheets.ts as a barrel file.");
}

splitSheetsClean().catch(console.error);
