import os from "node:os";

/**
 * Whether this server runs on macOS, read when called. Not os.platform(): the bundler turns it into
 * the build machine's value, and releases are built on Linux, which removed every macOS branch.
 */
export const isMac = () => os.type() === "Darwin";
