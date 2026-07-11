module.exports = {
  root: true,
  extends: ['@react-native', 'prettier'],
  rules: {
    'no-void': 'off',
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
    'react/jsx-no-literals': [
      'error',
      {
        noStrings: true,
        ignoreProps: true,
        allowedStrings: [' ', '.', ',', ':', '/', '-'],
      },
    ],
  },
};
