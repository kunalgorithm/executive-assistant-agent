export default {
  '*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}': ['oxlint --fix', 'oxfmt --write'],
  '*.{json,md,css,yaml,yml}': ['oxfmt --write'],
};
