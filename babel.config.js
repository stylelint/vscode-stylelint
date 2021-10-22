'use strict';

const { engines } = require('./package.json');

// Get only the major and minor version
// e.g. ">=14.16.0" => "14.16"
const nodeVersion = engines.node.match(/(\d+\.\d+)(?:\.\d+)?/)?.[1];

/** @type {babel.TransformOptions} */
const config = {
	presets: [['@babel/preset-env', { targets: { node: nodeVersion } }]],
};

module.exports = config;
