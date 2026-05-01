const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    bundle:    './src/index.js',
    prototype: './src/prototype.js',
    dice:      './src/dice.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'public'),
    clean: false,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/index.html',     to: 'index.html'     },
        { from: 'src/prototype.html', to: 'prototype.html' },
        { from: 'src/dice.html',      to: 'dice.html'      },
        { from: 'src/assets', to: 'assets', noErrorOnMissing: true },
      ],
    }),
  ],
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'public'),
    },
    port: 8080,
    hot: true,
    open: true,
  },
  resolve: {
    extensions: ['.js'],
  },
};
