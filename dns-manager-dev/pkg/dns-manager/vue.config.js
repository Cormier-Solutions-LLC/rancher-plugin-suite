const webpack = require('webpack');
const config = require('./.shell/pkg/vue.config')(__dirname);
const configure = config.configureWebpack;
config.configureWebpack = output => {
  configure(output);
  output.resolve.extensions = [...new Set([...output.resolve.extensions, '.ts', '.mjs'])];
  output.module.rules.push({ test: /\.js$/, include: __dirname, type: 'javascript/auto' });
  output.module.rules.push({ test: /\.ts$/, include: __dirname, use: [{ loader: require.resolve('ts-loader'), options: { transpileOnly: true, compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'Node', skipLibCheck: true }, onlyCompileBundledFiles: true } }] });
  // The SDK's nested Webpack 4 must not supply plugins to the CLI's Webpack 5 compiler.
  output.plugins = output.plugins.map(plugin => plugin.constructor.name === 'NormalModuleReplacementPlugin'
    ? new webpack.NormalModuleReplacementPlugin(plugin.resourceRegExp, plugin.newResource)
    : plugin);
};
module.exports = config;
