/**
 * Accessibility validation script
 * Validates WCAG 2.1 AA compliance for message categories
 */

import { validateCategoryColors } from '../lib/accessibility-utils';

console.log('🔍 Validando conformidade WCAG 2.1 AA para categorias de mensagens...\n');

const results = validateCategoryColors();

let allPassed = true;

Object.entries(results).forEach(([category, result]) => {
    const icon = result.passes ? '✅' : '❌';
    const level = result.ratio >= 7.0 ? 'AAA' : result.ratio >= 4.5 ? 'AA' : 'FAIL';

    console.log(`${icon} ${category.padEnd(10)} - Contraste: ${result.ratio}:1 (WCAG ${level})`);

    if (!result.passes) {
        allPassed = false;
    }
});

console.log('\n' + '='.repeat(60));

if (allPassed) {
    console.log('✅ Todas as categorias atendem WCAG 2.1 AA (mínimo 4.5:1)');
    process.exit(0);
} else {
    console.log('❌ Algumas categorias NÃO atendem WCAG 2.1 AA');
    process.exit(1);
}
