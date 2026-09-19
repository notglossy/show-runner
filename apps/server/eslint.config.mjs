import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier/flat';
import jsdoc from 'eslint-plugin-jsdoc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { jsdoc, 'simple-import-sort': simpleImportSort },
    rules: {
      // One sorted import block; blank lines between groups.
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      // JSDoc hygiene everywhere: checked when present, never mandated here.
      'jsdoc/require-description': 'warn',
      'jsdoc/no-blank-block-descriptions': 'warn',
      'jsdoc/check-alignment': 'warn',
      'jsdoc/no-types': 'warn',
      // Tagged comments pile up silently; surface them (warn, not error; "fixme"-style markers below are plural).
      'no-warning-comments': [
        'warn',
        { terms: ['todo:', 'fixme:', 'hack:', 'xxx:'], location: 'anywhere' },
      ],
    },
  },
  {
    files: ['src/lib/**/*.ts'],
    plugins: { jsdoc },
    rules: {
      // Loose JSDoc: every exported lib function gets /** ... */, no @param/@returns types (signatures carry them).
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            ArrowFunctionExpression: false,
            ClassDeclaration: true,
            ClassExpression: false,
            FunctionDeclaration: true,
            FunctionExpression: true,
          },
        },
      ],
    },
  },
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
