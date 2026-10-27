import { z } from "zod";

function strictify(node: any): any {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const out: any = {};
  for (const [k, v] of Object.entries(node)) out[k] = strictify(v);
  if (out.type === "object" && out.properties) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties);
  }
  return out;
}

export function toJsonSchema(schema: z.ZodType, { strict = true } = {}) {
  const json: any = z.toJSONSchema(schema, { target: "draft-7" });
  delete json.$schema;
  return strict ? strictify(json) : json;
}

/** Raw JSON, else a ```json fence, else the outermost braces. */
export function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error("No JSON object found in the model output");
}
