const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
// inlineRem 16: native rem matches the browser's, so web screenshots look like the device.
module.exports = withNativeWind(config, { input: "./global.css", inlineRem: 16 });
