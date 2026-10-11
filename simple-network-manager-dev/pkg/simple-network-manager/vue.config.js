const webpack = require('webpack');
const config = require('./.shell/pkg/vue.config')(__dirname);
const configure = config.configureWebpack;
config.configureWebpack = output => {
  configure(output);
  // Use Webpack 5 plugins with the CLI compiler rather than the SDK's nested Webpack 4.
  output.plugins = output.plugins.map(plugin => plugin.constructor.name === 'NormalModuleReplacementPlugin'
    ? new webpack.NormalModuleReplacementPlugin(plugin.resourceRegExp, plugin.newResource)
    : plugin);
};
module.exports = config;
