const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    // Permet à Metro de résoudre les assets PNG dans node_modules
    // (nécessaire pour @react-navigation/elements qui importe ses propres icônes)
    assetExts: [...(defaultConfig.resolver?.assetExts ?? []), 'png', 'jpg', 'jpeg', 'gif', 'webp'],
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
