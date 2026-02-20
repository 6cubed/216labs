// src/cartographer.ts
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "@babel/parser";
import MagicString from "magic-string";

// src/constants.ts
var DATA_ATTRIBUTES = {
  METADATA: "data-replit-metadata",
  COMPONENT_NAME: "data-component-name"
};
var R3F_IMPORT_SOURCES = /* @__PURE__ */ new Set([
  "@react-three/fiber",
  "@react-three/drei",
  "react-three-fiber"
]);
var R3F_BAILOUT_ELEMENTS = /* @__PURE__ */ new Set([
  "Canvas",
  // Top-level R3F component
  "mesh",
  "group",
  "scene",
  "primitive",
  "points",
  "instancedMesh",
  "fog",
  "fogExp2",
  "object3D"
]);
var R3F_BAILOUT_PATTERNS = [
  /Geometry$/,
  /Material$/,
  /Light$/,
  /Camera$/,
  /Helper$/,
  /Control$/
];

// src/cartographer.ts
var validExtensions = /* @__PURE__ */ new Set([".jsx", ".tsx"]);
function cartographer() {
  let clientScript;
  let configuredRoot;
  let configuredRootName;
  return {
    name: "@replit/vite-plugin-cartographer",
    enforce: "pre",
    async configResolved(config) {
      configuredRoot = config.root;
      configuredRootName = path.basename(configuredRoot);
      const currentFileUrl = typeof __dirname === "string" ? path.join(__dirname, "../dist/beacon/index.global.js") : fileURLToPath(
        new URL("../dist/beacon/index.global.js", import.meta.url)
      );
      try {
        clientScript = await fs.readFile(currentFileUrl, "utf-8");
      } catch (error) {
        console.error(
          "[replit-cartographer] Failed to load client script:",
          error
        );
      }
    },
    resolveId(_source, _importer) {
      return null;
    },
    transform: {
      order: "pre",
      async handler(code, id) {
        if (!validExtensions.has(path.extname(id)) || id.includes("node_modules")) {
          return null;
        }
        try {
          const ast = parse(code, {
            sourceType: "module",
            plugins: ["jsx", "typescript"]
          });
          let isR3FFile = usesReactThreeFiber(ast);
          if (isR3FFile) {
            return null;
          }
          const magicString = new MagicString(code);
          let currentElement = null;
          const traverseModule = await import("@babel/traverse");
          const traverse = traverseModule.default?.default || traverseModule.default || traverseModule;
          if (typeof traverse !== "function") {
            console.error(
              `[replit-cartographer] @babel/traverse did not resolve to a function.`
            );
            return null;
          }
          traverse(ast, {
            JSXElement: {
              enter(elementPath) {
                if (isR3FFile) {
                  return;
                }
                currentElement = elementPath.node;
              },
              exit() {
                currentElement = null;
              }
            },
            JSXOpeningElement(elementPath) {
              if (isR3FFile) {
                return;
              }
              const jsxNode = elementPath.node;
              const elementName = getElementName(jsxNode);
              if (!elementName) {
                return;
              }
              if (shouldBailout(elementName)) {
                isR3FFile = true;
                elementPath.stop();
                return;
              }
              if (elementName === "line") {
                return;
              }
              if (currentElement) {
                const { line = 0, column: col = 0 } = jsxNode.loc?.start ?? {};
                const relativeToConfigured = path.relative(configuredRoot, id);
                const componentPath = path.join(
                  configuredRootName,
                  relativeToConfigured
                );
                const componentMetadata = col === 0 ? `${componentPath}:${line}` : `${componentPath}:${line}:${col}`;
                magicString.appendLeft(
                  jsxNode.name.end ?? 0,
                  ` ${DATA_ATTRIBUTES.METADATA}="${componentMetadata}" ${DATA_ATTRIBUTES.COMPONENT_NAME}="${elementName}"`
                );
              }
            }
          });
          if (isR3FFile) {
            return null;
          }
          return {
            code: magicString.toString(),
            map: magicString.generateMap({ hires: true })
          };
        } catch (error) {
          console.error(`[replit-cartographer] Error processing ${id}:`, error);
          return null;
        }
      }
    },
    transformIndexHtml() {
      if (!clientScript) {
        return [];
      }
      return [
        {
          tag: "script",
          attrs: { type: "module" },
          children: clientScript,
          injectTo: "head"
        }
      ];
    }
  };
}
function getElementName(jsxNode) {
  if (jsxNode.name.type === "JSXIdentifier") {
    return jsxNode.name.name;
  }
  if (jsxNode.name.type === "JSXMemberExpression") {
    const memberExpr = jsxNode.name;
    const object = memberExpr.object;
    const property = memberExpr.property;
    return `${object.name}.${property.name}`;
  }
  return null;
}
function usesReactThreeFiber(ast) {
  return ast.program.body.some(
    (node) => node.type === "ImportDeclaration" && typeof node.source.value === "string" && R3F_IMPORT_SOURCES.has(node.source.value)
  );
}
function shouldBailout(name) {
  if (R3F_BAILOUT_ELEMENTS.has(name)) {
    return true;
  }
  return R3F_BAILOUT_PATTERNS.some((pattern) => name.match(pattern));
}

// package.json
var version = "0.4.4";
export {
  cartographer,
  version
};
//# sourceMappingURL=index.mjs.map