"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// src/cartographer.ts
var _promises = require('fs/promises'); var _promises2 = _interopRequireDefault(_promises);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _url = require('url');
var _parser = require('@babel/parser');
var _magicstring = require('magic-string'); var _magicstring2 = _interopRequireDefault(_magicstring);

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
      configuredRootName = _path2.default.basename(configuredRoot);
      const currentFileUrl = typeof __dirname === "string" ? _path2.default.join(__dirname, "../dist/beacon/index.global.js") : _url.fileURLToPath.call(void 0, 
        new URL("../dist/beacon/index.global.js", import.meta.url)
      );
      try {
        clientScript = await _promises2.default.readFile(currentFileUrl, "utf-8");
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
        if (!validExtensions.has(_path2.default.extname(id)) || id.includes("node_modules")) {
          return null;
        }
        try {
          const ast = _parser.parse.call(void 0, code, {
            sourceType: "module",
            plugins: ["jsx", "typescript"]
          });
          let isR3FFile = usesReactThreeFiber(ast);
          if (isR3FFile) {
            return null;
          }
          const magicString = new (0, _magicstring2.default)(code);
          let currentElement = null;
          const traverseModule = await Promise.resolve().then(() => _interopRequireWildcard(require("@babel/traverse")));
          const traverse = _optionalChain([traverseModule, 'access', _ => _.default, 'optionalAccess', _2 => _2.default]) || traverseModule.default || traverseModule;
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
                const { line = 0, column: col = 0 } = _nullishCoalesce(_optionalChain([jsxNode, 'access', _3 => _3.loc, 'optionalAccess', _4 => _4.start]), () => ( {}));
                const relativeToConfigured = _path2.default.relative(configuredRoot, id);
                const componentPath = _path2.default.join(
                  configuredRootName,
                  relativeToConfigured
                );
                const componentMetadata = col === 0 ? `${componentPath}:${line}` : `${componentPath}:${line}:${col}`;
                magicString.appendLeft(
                  _nullishCoalesce(jsxNode.name.end, () => ( 0)),
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



exports.cartographer = cartographer; exports.version = version;
//# sourceMappingURL=index.js.map