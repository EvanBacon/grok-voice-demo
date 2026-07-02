module.exports = function (api) {
  api.cache(true);
  return {
    plugins: [fixReactDomPerformanceTrackWideObjects],
    presets: ['babel-preset-expo'],
  };
};



// Workaround for facebook/react#34770: react-dom's development-only Component Performance
// Track serializes changed props with unbounded `for...in` enumeration
// (`addObjectToProperties` / `addObjectDiffToProperties`). Objects with a huge number of
// own enumerable properties — most notably WebAssembly heap views such as emscripten's
// `HEAPU8` (used by Rive, FFmpeg, and other wasm libraries), where every element index is
// an own property — stall the main thread and OOM-crash the tab a few seconds after the
// object first appears in a component's props.
//
// This backports the bailout from https://github.com/facebook/react/pull/34742 (merged
// after react 19.2 branched; react-dom 19.2.x is still affected) by capping each of those
// enumeration loops. Remove when the React version Expo supports includes the upstream fix.

// Matches upstream's `OBJECT_WIDTH_LIMIT`: "Showing wider objects in the devtools is not useful."
const OBJECT_WIDTH_LIMIT = 100;

const TARGET_FUNCTIONS = new Set(['addObjectToProperties', 'addObjectDiffToProperties']);

function fixReactDomPerformanceTrackWideObjects({
  types: t,
}) {
  function capLoop(loop, fn) {
    const counter = fn.scope.generateUidIdentifier('propertyCount');
    fn.scope.push({ id: counter, init: t.numericLiteral(0), kind: 'let' });

    const onTruncate = [];
    // `addObjectDiffToProperties` returns whether the objects were deeply equal; a
    // truncated diff must not report deep equality (upstream marks it `false` too).
    if (fn.scope.hasOwnBinding('isDeeplyEqual')) {
      onTruncate.push(
        t.expressionStatement(
          t.assignmentExpression('=', t.identifier('isDeeplyEqual'), t.booleanLiteral(false))
        )
      );
    }
    onTruncate.push(t.breakStatement());

    const guard = t.ifStatement(
      t.binaryExpression(
        '>=',
        t.updateExpression('++', t.cloneNode(counter), false),
        t.numericLiteral(OBJECT_WIDTH_LIMIT)
      ),
      t.blockStatement(onTruncate)
    );

    const body = loop.node.body;
    loop.node.body = t.blockStatement([guard, ...(t.isBlockStatement(body) ? body.body : [body])]);
  }

  return {
    name: 'expo-fix-react-dom-performance-track-wide-objects',
    visitor: {
      FunctionDeclaration(path) {
        const name = path.node.id?.name;
        if (!name || !TARGET_FUNCTIONS.has(name)) {
          return;
        }
        path.traverse({
          ForInStatement(loop) {
            // Only cap loops belonging to the matched function itself.
            if (loop.getFunctionParent()?.node === path.node) {
              capLoop(loop, path);
              loop.skip();
            }
          },
        });
      },
    },
  };
}