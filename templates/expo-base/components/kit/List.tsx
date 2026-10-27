import { Children, Fragment, type ReactNode } from "react";
import { View } from "react-native";
import { Divider } from "./Divider";
import { shadow, SurfaceContext } from "./surface";

/** Grouped list: rounded surface with hairline separators between ListItems. */
export function List({ children, testID }: { children: ReactNode; testID?: string }) {
  const items = Children.toArray(children);
  return (
    <View testID={testID} className="overflow-hidden rounded-theme bg-surface" style={shadow.soft}>
      <SurfaceContext.Provider value="card">
        {items.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <Divider inset />}
            {c}
          </Fragment>
        ))}
      </SurfaceContext.Provider>
    </View>
  );
}
