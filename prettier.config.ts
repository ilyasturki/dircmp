import type { Config } from 'prettier'

const config: Config = {
    experimentalTernaries: true,
    experimentalOperatorPosition: 'start',
    tabWidth: 4,
    semi: false,
    singleQuote: true,
    jsxSingleQuote: true,
    singleAttributePerLine: true,

    plugins: [
        '@ianvs/prettier-plugin-sort-imports',
        'prettier-plugin-tailwindcss',
    ],

    // tailwindcss plugin options
    tailwindStylesheet: './app/assets/css/main.css',
    tailwindAttributes: [
        'menu-class',
        'slot-class',
        'content-class',
        'bg-class',
    ],
    tailwindFunctions: ['tw', 'cn', 'tv'],

    // sort imports plugin options
    importOrder: [
        // type imports
        '<TYPES>^(node:)',
        '<TYPES>',
        '<TYPES>^@(?!/)',
        // Node.js built-in modules
        '<BUILTIN_MODULES>',
        // Imports not matched by other special words or groups.
        '<THIRD_PARTY_MODULES>',
        // import starts with `@` but not followed with `/` or `@` (e.g. `@vue/`)
        '^@(?!/|@)',
        '',
        // project types
        '<TYPES>^#',
        '<TYPES>^~~/',
        '<TYPES>^~/',
        '<TYPES>^@@/',
        '<TYPES>^@/',
        '<TYPES>^[.]',
        // Nuxt imports
        '^#',
        // project imports
        '^~~/',
        '^~/',
        '^@@/',
        '^@/',
        // relative imports
        '^[.]',
    ],
    importOrderTypeScriptVersion: '5.8.3',
}

export default config
