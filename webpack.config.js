const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

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
    new webpack.DefinePlugin({
      // Injected at build time. Override by setting SERVER_URL env var before building.
      // e.g.  SERVER_URL=https://your-app.onrender.com npm run build
      __SERVER_URL__: JSON.stringify(process.env.SERVER_URL || 'http://localhost:3000'),
    }),
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
