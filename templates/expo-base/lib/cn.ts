import { extendTailwindMerge } from "tailwind-merge";

const merge = extendTailwindMerge({ extend: { classGroups: { rounded: ["rounded-theme"] } } });
export const cn = (...c: (string | false | null | undefined)[]) => merge(c.filter(Boolean).join(" "));
