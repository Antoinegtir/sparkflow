import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
// A Chromium already on the machine skips Remotion's download (set REMOTION_CHROME to override).
if (process.env.REMOTION_CHROME) Config.setBrowserExecutable(process.env.REMOTION_CHROME);
