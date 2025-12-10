/**
 * Accessibility utilities for WCAG 2.1 compliance
 */

/**
 * Converts hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

/**
 * Calculates relative luminance of an RGB color
 * Based on WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates contrast ratio between two colors
 * WCAG 2.1 AA requires minimum 4.5:1 for normal text
 */
export function getContrastRatio(hex1: string, hex2: string): number {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);

    const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Checks if contrast meets WCAG 2.1 AA standard (4.5:1)
 */
export function meetsWCAG_AA(foreground: string, background: string): boolean {
    return getContrastRatio(foreground, background) >= 4.5;
}

/**
 * Checks if contrast meets WCAG 2.1 AAA standard (7:1)
 */
export function meetsWCAG_AAA(foreground: string, background: string): boolean {
    return getContrastRatio(foreground, background) >= 7.0;
}

/**
 * Tailwind color palette for accessibility testing
 */
export const tailwindColors = {
    // Blue
    'blue-50': '#eff6ff',
    'blue-500': '#3b82f6',
    'blue-700': '#1d4ed8',

    // Green
    'green-50': '#f0fdf4',
    'green-500': '#10b981',
    'green-700': '#15803d',

    // Amber
    'amber-50': '#fffbeb',
    'amber-500': '#f59e0b',
    'amber-700': '#b45309',

    // Red
    'red-50': '#fef2f2',
    'red-500': '#ef4444',
    'red-700': '#b91c1c',

    // Gray
    'gray-50': '#f9fafb',
    'gray-500': '#6b7280',
    'gray-700': '#374151',
};

/**
 * Validates category color combinations for WCAG compliance
 */
export function validateCategoryColors(): Record<string, { passes: boolean; ratio: number }> {
    const categories = {
        question: { bg: tailwindColors['blue-50'], text: tailwindColors['blue-700'] },
        answer: { bg: tailwindColors['green-50'], text: tailwindColors['green-700'] },
        alert: { bg: tailwindColors['amber-50'], text: tailwindColors['amber-700'] },
        error: { bg: tailwindColors['red-50'], text: tailwindColors['red-700'] },
        system: { bg: tailwindColors['gray-50'], text: tailwindColors['gray-700'] },
    };

    const results: Record<string, { passes: boolean; ratio: number }> = {};

    Object.entries(categories).forEach(([name, colors]) => {
        const ratio = getContrastRatio(colors.text, colors.bg);
        results[name] = {
            passes: ratio >= 4.5,
            ratio: Math.round(ratio * 100) / 100
        };
    });

    return results;
}
