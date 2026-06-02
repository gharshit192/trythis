const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch both frontend and root node_modules
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Fix: AppEntry.js lives at monorepoRoot/node_modules/expo/AppEntry.js
// and imports '../../App' → resolves to monorepoRoot/App.js (wrong).
// Redirect it to the actual projectRoot/App.js.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '../../App' &&
    context.originModulePath.includes(path.join('node_modules', 'expo', 'AppEntry'))
  ) {
    return { filePath: path.resolve(projectRoot, 'App.js'), type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
