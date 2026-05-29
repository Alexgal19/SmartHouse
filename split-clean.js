/* eslint-disable @typescript-eslint/no-var-requires */
const { Project } = require('ts-morph');
const fs = require('fs');
const path = require('path');

async function splitClean() {
    const project = new Project({ tsConfigFilePath: '/Users/oleksandr/Desktop/SmartHouse/tsconfig.json' });
    const actionsFile = project.getSourceFile('src/lib/actions.ts');
    const actionsText = actionsFile.getFullText();

    const outDir = '/Users/oleksandr/Desktop/SmartHouse/src/lib/actions';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const getDomain = (name) => {
        name = name.toLowerCase();
        if (name.includes('nonemployee')) return 'non-employees.ts';
        if (name.includes('employee') || name.includes('transfer')) return 'employees.ts';
        if (name.includes('bokresident')) return 'bok-residents.ts';
        if (name.includes('address') || name.includes('accommodation') || name.includes('room')) return 'housing.ts';
        if (name.includes('candidate') || name.includes('passport')) return 'recruitment.ts';
        if (name.includes('demand')) return 'zapotrzebowania.ts';
        if (name.includes('odbior') || name.includes('zgloszenie')) return 'odbior.ts';
        if (name.includes('controlcard') || name.includes('startlist') || name.includes('counters') || name.includes('images') || name.includes('file')) return 'control-cards.ts';
        if (name.includes('report') || name.includes('export')) return 'reports.ts';
        if (name.includes('notification') || name.includes('push') || name.includes('subscription')) return 'notifications.ts';
        if (name.includes('settings')) return 'settings.ts';
        if (name.includes('audit')) return 'audit.ts';
        return 'core.ts';
    };

    // First, figure out which function goes to which domain
    const exportedFunctions = [];
    for (const stmt of actionsFile.getStatements()) {
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
        fs.writeFileSync(filePath, actionsText);
        
        const newFile = project.addSourceFileAtPath(filePath);
        
        // Delete exports that don't belong here
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
        
        // Remove unused identifiers to clean up helpers/imports
        newFile.fixUnusedIdentifiers();
        newFile.saveSync();
        console.log(`Created and cleaned ${domain}`);
    }

    // Now rewrite actions.ts to be a barrel file
    let newActions = `"use server";\n\n`;
    for (const domain of domains) {
        newActions += `export * from './actions/${domain.replace('.ts', '')}';\n`;
    }
    
    fs.writeFileSync('/Users/oleksandr/Desktop/SmartHouse/src/lib/actions.ts', newActions);
    console.log("Rewrote actions.ts as a barrel file.");
}

splitClean().catch(console.error);
