const fs = require('fs');
const path = require('path');

function parseDotEnv(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function mobileEnv() {
  const envPath = path.join(__dirname, '.env');
  const fileEnv = fs.existsSync(envPath) ? parseDotEnv(fs.readFileSync(envPath, 'utf8')) : {};
  return {
    ...fileEnv,
    ...process.env,
  };
}

function inlineTaskNebulaMobileEnv() {
  const env = mobileEnv();
  const apiUrl = env.TASKNEBULA_API_URL?.trim() || null;

  return ({ types: t }) => ({
    name: 'inline-tasknebula-mobile-env',
    visitor: {
      Identifier(path) {
        if (path.node.name !== '__TASKNEBULA_API_URL__') return;
        if (!path.isReferencedIdentifier()) return;
        path.replaceWith(apiUrl ? t.stringLiteral(apiUrl) : t.nullLiteral());
      },
    },
  });
}

module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      inlineTaskNebulaMobileEnv(),
      '@babel/plugin-transform-class-static-block',
      '@babel/plugin-transform-export-namespace-from',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
