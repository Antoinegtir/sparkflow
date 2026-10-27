import ts from "typescript";

export type JsxNode =
  | { kind: "element"; label: string; attrs: Record<string, string>; line: number; children: JsxNode[]; hints?: string[]; hintsBy?: Record<string, string[]> }
  | { kind: "text"; text: string; line: number }
  | { kind: "logic"; label: string; line: number; children: JsxNode[]; hints?: string[]; hintsBy?: Record<string, string[]> };

export type JsxComponent = { name: string; line: number; tree: JsxNode[] };
export type ScreenDecl = { name: string; component: string; line: number };

const short = (s: string, n = 42) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Strings found in a literal array (top level or object values), for `.map` hints. */
function literalStrings(expr: ts.Expression | undefined): { all: string[]; byKey: Record<string, string[]> } {
  const all: string[] = [];
  const byKey: Record<string, string[]> = {};
  if (!expr || !ts.isArrayLiteralExpression(expr)) return { all, byKey };
  for (const el of expr.elements) {
    if (ts.isStringLiteralLike(el)) all.push(el.text);
    else if (ts.isObjectLiteralExpression(el)) {
      for (const p of el.properties) {
        if (ts.isPropertyAssignment(p) && ts.isStringLiteralLike(p.initializer)) {
          const k = p.name.getText();
          (byKey[k] ??= []).push(p.initializer.text);
          all.push(p.initializer.text);
        }
      }
    } else if (ts.isArrayLiteralExpression(el)) {
      el.elements.forEach((x, i) => ts.isStringLiteralLike(x) && ((byKey[`#${i}`] ??= []).push(x.text), all.push(x.text)));
    }
  }
  return { all: all.slice(0, 24), byKey };
}

export function parseJsx(source: string, fileName: string) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, /\.(tsx|jsx)$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const arrays = new Map<string, ts.Expression>();
  sf.forEachChild(function find(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isArrayLiteralExpression(n.initializer)) arrays.set(n.name.text, n.initializer);
    n.forEachChild(find);
  });

  const attrsOf = (a: ts.JsxAttributes) => {
    const out: Record<string, string> = {};
    for (const p of a.properties) {
      if (ts.isJsxSpreadAttribute(p)) {
        out["…"] = short(p.expression.getText(sf));
        continue;
      }
      const name = p.name.getText(sf);
      const init = p.initializer;
      if (!init) out[name] = "true";
      else if (ts.isStringLiteral(init)) out[name] = init.text;
      else if (ts.isJsxExpression(init) && init.expression) out[name] = ts.isStringLiteralLike(init.expression) ? init.expression.text : `{${short(init.expression.getText(sf))}}`;
    }
    return out;
  };

  const visitExpr = (e: ts.Expression): JsxNode[] => {
    if (ts.isParenthesizedExpression(e)) return visitExpr(e.expression);
    if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return [visitJsx(e)];
    if (ts.isConditionalExpression(e)) {
      return [{ kind: "logic", label: `if ${short(e.condition.getText(sf))}`, line: lineOf(e), children: [...visitExpr(e.whenTrue), ...visitExpr(e.whenFalse)] }];
    }
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return [{ kind: "logic", label: `if ${short(e.left.getText(sf))}`, line: lineOf(e), children: visitExpr(e.right) }];
    }
    if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === "map") {
      const target = e.expression.expression;
      const cb = e.arguments[0];
      const children: JsxNode[] = [];
      let hints: string[] | undefined;
      let hintsBy: Record<string, string[]> | undefined;
      const arr = ts.isArrayLiteralExpression(target) ? target : ts.isIdentifier(target) ? arrays.get(target.text) : undefined;
      if (arr) {
        const lit = literalStrings(arr);
        hints = lit.all;
        if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) && cb.parameters[0]) {
          const param = cb.parameters[0].name;
          hintsBy = {};
          if (ts.isIdentifier(param)) {
            hintsBy[param.text] = lit.all;
            for (const [k, v] of Object.entries(lit.byKey)) hintsBy[`${param.text}.${k}`] = v;
          } else if (ts.isObjectBindingPattern(param)) {
            for (const el of param.elements) {
              const key = (el.propertyName ?? el.name).getText(sf);
              if (ts.isIdentifier(el.name) && lit.byKey[key]) hintsBy[el.name.text] = lit.byKey[key];
            }
          } else if (ts.isArrayBindingPattern(param)) {
            param.elements.forEach((el, i) => ts.isBindingElement(el) && ts.isIdentifier(el.name) && lit.byKey[`#${i}`] && (hintsBy![el.name.text] = lit.byKey[`#${i}`]));
          }
        }
      }
      if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
        if (ts.isBlock(cb.body)) cb.body.forEachChild(function ret(n) {
          if (ts.isReturnStatement(n) && n.expression) children.push(...visitExpr(n.expression));
          else if (!ts.isFunctionLike(n)) n.forEachChild(ret);
        });
        else children.push(...visitExpr(cb.body));
      }
      return [{ kind: "logic", label: `${short(target.getText(sf), 24)}.map(…)`, line: lineOf(e), children, hints, hintsBy }];
    }
    return [];
  };

  const visitChildren = (kids: ts.NodeArray<ts.JsxChild>): JsxNode[] =>
    kids.flatMap((c): JsxNode[] => {
      if (ts.isJsxText(c)) {
        const t = c.text.replace(/\s+/g, " ").trim();
        return t ? [{ kind: "text", text: t, line: lineOf(c) }] : [];
      }
      if (ts.isJsxExpression(c)) {
        if (!c.expression) return [];
        const out = visitExpr(c.expression);
        return out.length ? out : [{ kind: "text", text: `{${short(c.expression.getText(sf))}}`, line: lineOf(c) }];
      }
      return [visitJsx(c)];
    });

  function visitJsx(n: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment): JsxNode {
    if (ts.isJsxFragment(n)) return { kind: "element", label: "Fragment", attrs: {}, line: lineOf(n), children: visitChildren(n.children) };
    const open = ts.isJsxElement(n) ? n.openingElement : n;
    return {
      kind: "element",
      label: open.tagName.getText(sf),
      attrs: attrsOf(open.attributes),
      line: lineOf(n),
      children: ts.isJsxElement(n) ? visitChildren(n.children) : [],
    };
  }

  const bodyJsx = (body: ts.Node | undefined): JsxNode[] => {
    if (!body) return [];
    if (!ts.isBlock(body)) return visitExpr(body as ts.Expression);
    const out: JsxNode[] = [];
    body.forEachChild(function ret(n) {
      if (ts.isReturnStatement(n) && n.expression) out.push(...visitExpr(n.expression));
      else if (!ts.isFunctionLike(n)) n.forEachChild(ret);
    });
    return out;
  };

  const components: JsxComponent[] = [];
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) {
      const tree = bodyJsx(st.body);
      if (tree.length) components.push({ name: st.name.text, line: lineOf(st), tree });
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        let init = d.initializer;
        if (ts.isCallExpression(init) && init.arguments[0]) init = init.arguments[0];
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          const tree = bodyJsx(init.body);
          if (tree.length) components.push({ name: d.name.text, line: lineOf(d), tree });
        }
      }
    }
  }

  const screens: ScreenDecl[] = [];
  const re = /<(\w+)\.Screen\b[^>]*?\bname=["'{]+([^"'}]+)["'}]+[^>]*?\bcomponent=\{(\w+)\}/g;
  for (const m of source.matchAll(re)) screens.push({ name: m[2], component: m[3], line: source.slice(0, m.index).split("\n").length });
  return { components, screens };
}
