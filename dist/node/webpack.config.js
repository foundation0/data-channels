const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
var nodeModules = {};
fs.readdirSync('node_modules')
    .filter(function (x) {
    return ['.bin'].indexOf(x) === -1;
})
    .forEach(function (mod) {
    nodeModules[mod] = 'commonjs ' + mod;
});
module.exports = {
    mode: 'development',
    devtool: 'source-map',
    target: 'web',
    entry: './index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'main.js',
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            crypto: require.resolve('crypto-browserify'),
            os: require.resolve('os-browserify/browser'),
            path: require.resolve('path-browserify'),
            stream: require.resolve('stream-browserify'),
            util: require.resolve('util/'),
            buffer: require.resolve('buffer/'),
            fs: false,
        },
    },
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
    ],
    module: {
        rules: [
            {
                test: /\.tsx?/,
                use: 'ts-loader',
                exclude: [path.resolve(__dirname, './node_modules/'), path.resolve(__dirname, './demo/')],
            },
        ],
    },
};
//# sourceMappingURL=webpack.config.js.map