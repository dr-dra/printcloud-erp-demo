module.exports = {
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: ['docs/**/*.md', 'docs/src/pages/**/*.{js,jsx}', 'docs/data/**/*.{js,jsx}'],
      options: {
        printWidth: 85,
      },
    },
    {
      files: ['docs/pages/blog/**/*.md'],
      options: {
        printWidth: 82,
      },
    },
  ],
};
