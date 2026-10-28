const { withPodfile } = require("expo/config-plugins");

// RN's prebuilt core only ships <React/RCTConversions.h>, but react-native-bottom-tabs and
// @callstack/liquid-glass include "RCTConversions.h": point their header search paths at the framework.
const MARKER = "# sparkflow: prebuilt React headers";
const SNIPPET = `    ${MARKER}
    installer.pods_project.targets.each do |t|
      next unless ['react-native-bottom-tabs', 'LiquidGlass'].include?(t.name)
      t.build_configurations.each do |bc|
        bc.build_settings['HEADER_SEARCH_PATHS'] = ['$(inherited)', '"\${PODS_XCFRAMEWORKS_BUILD_DIR}/React-Core-prebuilt/React.framework/Headers"']
      end
    end
`;

module.exports = function withPrebuiltReactHeaders(config) {
  return withPodfile(config, (cfg) => {
    const podfile = cfg.modResults.contents;
    if (podfile.includes(MARKER)) return cfg;
    // After react_native_post_install, so RN's own build settings can't override ours.
    const anchor = /react_native_post_install\([\s\S]*?\n\s*\)\n/;
    if (!anchor.test(podfile)) throw new Error("with-prebuilt-react-headers: no react_native_post_install call in the Podfile");
    cfg.modResults.contents = podfile.replace(anchor, (m) => m + SNIPPET);
    return cfg;
  });
};
