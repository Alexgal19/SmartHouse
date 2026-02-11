#!/usr/bin/env ts-node

/**
 * Pre-Build Test Hook
 * 
 * Runs before `npm run build` to:
 * 1. Generate tests for new/modified code
 * 2. Run all tests
 * 3. Check coverage thresholds
 * 4. Fail build if tests fail or coverage is insufficient
 */

import { AutoTestGenerator } from './test-generator';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface CoverageReport {
    total: {
        statements: { pct: number };
        branches: { pct: number };
        functions: { pct: number };
        lines: { pct: number };
    };
}

class PreBuildTest {
    private readonly COVERAGE_THRESHOLD = 80;
    
    async run() {
        console.log('🚀 Pre-Build Test Process Started\n');
        
        try {
            // Step 1: Generate tests for new code
            await this.generateTests();
            
            // Step 2: Run tests
            await this.runTests();
            
            // Step 3: Check coverage
            await this.checkCoverage();
            
            console.log('\n✅ All pre-build checks passed!');
            process.exit(0);
        } catch (error) {
            console.error('\n❌ Pre-build checks failed:', error);
            process.exit(1);
        }
    }
    
    private async generateTests() {
        console.log('📝 Step 1: Generating tests for new code...');
        
        try {
            const generator = new AutoTestGenerator();
            await generator.generateTests();
            console.log('✅ Test generation complete\n');
        } catch (err) {
            console.warn('⚠️  Test generation failed (continuing anyway):', err);
        }
    }
    
    private async runTests() {
        console.log('🧪 Step 2: Running all tests...');
        
        try {
            // Run tests with coverage
            execSync('npm test -- --run --coverage', {
                stdio: 'inherit',
                cwd: process.cwd(),
            });
            console.log('✅ All tests passed\n');
        } catch (err) {
            throw new Error('Tests failed - build cannot continue');
        }
    }
    
    private async checkCoverage() {
        console.log('📊 Step 3: Checking coverage thresholds...');
        
        const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
        
        if (!fs.existsSync(coveragePath)) {
            console.warn('⚠️  Coverage report not found, skipping check');
            return;
        }
        
        const coverageData: CoverageReport = JSON.parse(
            fs.readFileSync(coveragePath, 'utf-8')
        );
        
        const metrics = {
            statements: coverageData.total.statements.pct,
            branches: coverageData.total.branches.pct,
            functions: coverageData.total.functions.pct,
            lines: coverageData.total.lines.pct,
        };
        
        console.log('  Coverage Results:');
        console.log(`    Statements: ${metrics.statements.toFixed(2)}%`);
        console.log(`    Branches:   ${metrics.branches.toFixed(2)}%`);
        console.log(`    Functions:  ${metrics.functions.toFixed(2)}%`);
        console.log(`    Lines:      ${metrics.lines.toFixed(2)}%`);
        
        const failures: string[] = [];
        Object.entries(metrics).forEach(([key, value]) => {
            if (value < this.COVERAGE_THRESHOLD) {
                failures.push(`${key}: ${value.toFixed(2)}% (required: ${this.COVERAGE_THRESHOLD}%)`);
            }
        });
        
        if (failures.length > 0) {
            console.error('\n❌ Coverage thresholds not met:');
            failures.forEach(f => console.error(`  - ${f}`));
            throw new Error('Coverage below threshold');
        }
        
        console.log('✅ Coverage thresholds met\n');
    }
}

// Execute
new PreBuildTest().run();
