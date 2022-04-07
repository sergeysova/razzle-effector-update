const path = require('path')

module.exports = {
  modifyWebpackConfig({ webpackConfig }) {
    webpackConfig.resolve.alias['~'] = path.resolve(__dirname, 'src')
    return webpackConfig
  }
}
