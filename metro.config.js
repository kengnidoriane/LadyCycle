const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Exclut les dossiers de build natifs (Android/iOS) du file watcher.
    // Sur Windows, Gradle crée/supprime ces dossiers pendant le build, ce qui
    // faisait planter le watcher de Metro (ENOENT). Les ignorer évite ce crash.
    // Couvre android/build, android/app/build et node_modules/*/android/build.
    blockList: /[/\\](android|ios)[/\\].*build[/\\].*/,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
