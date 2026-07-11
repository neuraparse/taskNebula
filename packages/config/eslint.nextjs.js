module.exports = {
  extends: ['./eslint.base.js', 'next/core-web-vitals', 'plugin:react/recommended'],
  plugins: ['react'],
  env: {
    browser: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
};
