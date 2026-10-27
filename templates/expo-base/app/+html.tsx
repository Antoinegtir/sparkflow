// Protected: Sparkflow owns this file.
import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";
import type { PropsWithChildren } from "react";
import { BRIDGE_SCRIPT } from "@/components/sparkflow/bridge-script";
import { buildPalettes, cssVars } from "@/constants/palette";
import theme from "../theme.json";

const p = buildPalettes(theme);
const BASE_CSS = `
:root{${cssVars(p.light)}}
@media (prefers-color-scheme: dark){:root{${cssVars(p.dark)}}}
:root[data-sf-scheme="light"]{${cssVars(p.light)}}
:root[data-sf-scheme="dark"]{${cssVars(p.dark)}}
html,body{background:rgb(var(--sf-background));}
`;

export default function Root({ children }: PropsWithChildren) {
  // SDK 58: the server document nodes (styles, scripts) must be rendered or the page breaks.
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
        <script id="sparkflow-bridge" dangerouslySetInnerHTML={{ __html: BRIDGE_SCRIPT }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
