/* Optional rebuild. The checked-in bundle runs directly without a build step. */
const path = require('node:path');
const { webpack } = require('../frontend/web/node_modules/next/dist/compiled/webpack/webpack.js');
const showcase = __dirname;
const compiler = webpack({
  mode: 'production',
  target: ['web', 'es2020'],
  entry: {
    'tree-motion': path.join(showcase, 'src/tree-motion.js'),
    'forest-tree': path.join(showcase, 'src/forest-tree.js'),
  },
  output: { path: path.join(showcase, 'assets'), filename: '[name].bundle.js' },
  resolve: { modules: [path.resolve(showcase, '../frontend/web/node_modules'), 'node_modules'] },
  module: { rules: [{ test: /\.glb$/, type: 'asset/inline' }] },
  performance: { hints: false },
  devtool: false,
  optimization: { minimize: false },
});
compiler.run((error, stats) => {
  compiler.close(() => {});
  if (error || stats.hasErrors()) {
    console.error(error || stats.toString({ all: false, errors: true }));
    process.exitCode = 1;
    return;
  }
  console.log(stats.toString({ colors: false, assets: true, modules: false, chunks: false }));
});
