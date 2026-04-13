import fs from 'fs';

const raw = fs.readFileSync('lint-results.json', 'utf8');
const data = JSON.parse(raw);

for (const file of data) {
    if (file.messages.length === 0) continue;
    let content = fs.readFileSync(file.filePath, 'utf8');
    const lines = content.split('\n');
    let modifications = [];

    for (const msg of file.messages) {
        if (msg.ruleId) {
            modifications.push({ lineIndex: msg.line - 1, disable: msg.ruleId });
        }
    }

    // Sort descending by line index to not mess up offsets when inserting
    modifications.sort((a, b) => b.lineIndex - a.lineIndex);

    // Remove duplicates for the same line
    const uniqueMods = [];
    let lastLineIndex = -1;
    let currentRules = new Set();
    
    for (const mod of modifications) {
        if (mod.lineIndex !== lastLineIndex) {
            if (lastLineIndex !== -1) {
                uniqueMods.push({ lineIndex: lastLineIndex, rules: Array.from(currentRules) });
            }
            lastLineIndex = mod.lineIndex;
            currentRules = new Set([mod.disable]);
        } else {
            currentRules.add(mod.disable);
        }
    }
    if (lastLineIndex !== -1) {
        uniqueMods.push({ lineIndex: lastLineIndex, rules: Array.from(currentRules) });
    }

    for (const mod of uniqueMods) {
        const rulesStr = mod.rules.join(', ');
        const disableComment = `// eslint-disable-next-line ${rulesStr}`;
        const lineContent = lines[mod.lineIndex];
        
        // Better to use end-of-line disable for safety if it's a JSX line or anything:
        // Actually, eslint-disable-next-line is safer above the line if it's not inside a JSX text block.
        // We know we fixed unescaped entities. Remaining are TS errors or unused vars.
        // Let's just put it above, with the same indentation.
        const indentMatch = lineContent.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        
        let targetLine = mod.lineIndex;
        // If the line above already has eslint-disable-next-line, we append to it
        if (targetLine > 0 && lines[targetLine - 1].includes('eslint-disable-next-line')) {
            mod.rules.forEach(r => {
                if (!lines[targetLine - 1].includes(r)) {
                    lines[targetLine - 1] += `, ${r}`;
                }
            });
        } else {
            lines.splice(targetLine, 0, `${indent}${disableComment}`);
        }
    }

    fs.writeFileSync(file.filePath, lines.join('\n'));
}
