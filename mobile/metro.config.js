const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add support for @shared/* alias
config.resolver.extraNodeModules = {
  '@shared': path.resolve(__dirname, '../shared'),
};

// Watch for changes in parent directories (shared folder)
config.watchFolders = [
  path.resolve(__dirname, '../shared'),
];

module.exports = config;
