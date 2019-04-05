syntax = typeof syntax == "undefined" ? this : syntax;
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var HeapValueType;
(function (HeapValueType) {
    HeapValueType["Raw"] = "Raw";
    HeapValueType["Array"] = "Array";
    HeapValueType["Object"] = "Object";
    HeapValueType["Function"] = "Function";
    HeapValueType["Ref"] = "Ref";
})(HeapValueType || (HeapValueType = {}));
var HeapSourceType;
(function (HeapSourceType) {
    HeapSourceType["Direct"] = "Direct";
    HeapSourceType["After"] = "After";
})(HeapSourceType || (HeapSourceType = {}));
var StackValueType;
(function (StackValueType) {
    //Argument = "Argument", // next argument to compute
    //Call = "Call",
    //Primitive = "Primitive",
    StackValueType["Node"] = "Node"; // When processed, before adding to stack, adds the env to the next NodeWithoutEnv in the stack.
})(StackValueType || (StackValueType = {}));
// Returned mean that if the node is an expressionStatement, its value can be updated.
// If the env is not there yet, it is added when the previous statement is processed.
function initStack(env, initNode) {
    return { head: { tag: StackValueType.Node, env: env, node: initNode }, tail: undefined };
}
function initEnv() {
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    return { head: // Global this object available
        { name: "this",
            value: { env: undefined,
                expr: new Node.Identifier("", "this", "this"),
                heapSource: {
                    tag: HeapSourceType.Direct,
                    heap: initHeap()
                },
                v_: {},
                ref: "this" } },
        tail: undefined };
}
// Equivalent of:
//     const this = {}
// Heap used once in initEnv, and another time in initStack
// Perhaps we should consider just rewriting the initial program?
function initHeap() {
    var _a;
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    return _a = {}, _a["this"] = { tag: HeapValueType.Object, value: {}, source: { env: undefined, expr: new Node.ObjectExpression("", [], [], ""), heapSource: { tag: HeapSourceType.Direct, heap: {} } } }, _a;
}
function initHeapSource() {
    return { tag: HeapSourceType.Direct, heap: initHeap() };
}
// Converts a node/environment to an initial program
function initProg(node, env) {
    if (env === void 0) { env = initEnv(); }
    return { context: [], stack: initStack(env, node), heapSource: initHeapSource() };
}
var uniqueID = 0;
function uniqueRef(name) {
    return name + (uniqueID++);
}
var DType;
(function (DType) {
    DType["Clone"] = "Clone";
    DType["Update"] = "Update";
})(DType || (DType = {}));
;
var DUType;
(function (DUType) {
    DUType["Reuse"] = "Reuse";
    DUType["NewValue"] = "NewValue";
})(DUType || (DUType = {}));
;
function DDReuse(childDiffs) {
    return [{
            ctor: DType.Update,
            kind: { ctor: DUType.Reuse },
            children: childDiffs
        }];
}
function DDChild(name, childDiffs) {
    var _a;
    if (typeof name === "string") {
        return DDReuse((_a = {}, _a[name] = childDiffs, _a));
    }
    else {
        if (name.length == 0)
            return childDiffs;
        return DDChild(name[0], DDChild(name.slice(1), childDiffs));
    }
}
function DDWrap(name, diffs, diffUpdater) {
    if (typeof name === "string") {
        return diffs.map(function (diff) {
            var _a;
            return diff.ctor === DType.Update ? __assign({}, diff, { children: __assign({}, diff.children, (_a = {}, _a[name] = diffUpdater(diff.children[name]), _a)) }) : diff;
        });
    }
    else {
        if (name.length == 0)
            return diffUpdater(diffs);
        return DDWrap(name[0], diffs, function (d) { return DDWrap(name.slice(1), d, diffUpdater); });
    }
}
function DDNewValue(newVal) {
    return [{ ctor: DType.Update, kind: { ctor: DUType.NewValue, model: newVal }, children: {} }];
}
function DDNewObject(children, model) {
    if (model === void 0) { model = {}; }
    return [{ ctor: DType.Update, kind: { ctor: DUType.NewValue, model: model }, children: children }];
}
function DDNewArray(length, children) {
    return [{ ctor: DType.Update, kind: { ctor: DUType.NewValue, model: Array(length) }, children: children }];
}
function DDNewNode(model, children) {
    if (children === void 0) { children = {}; }
    return [{ ctor: DType.Update, kind: { ctor: DUType.NewValue, model: model }, children: children }];
}
function DDClone(path, diffs) {
    return [{ ctor: DType.Clone, path: path, diffs: diffs }];
}
function DDSame() {
    return [{ ctor: DType.Update, kind: { ctor: DUType.Reuse }, children: {} }];
}
var UType;
(function (UType) {
    UType[UType["Result"] = 0] = "Result";
    UType[UType["Continue"] = 1] = "Continue";
    UType[UType["Fail"] = 2] = "Fail";
    UType[UType["CriticalError"] = 3] = "CriticalError";
    UType[UType["Alternative"] = 4] = "Alternative";
})(UType || (UType = {}));
function UpdateContinue(p, n, c) {
    return { ctor: UType.Continue, prog: p, updateData: n, callback: c };
}
function UpdateResult(p, oldP, c) {
    return { ctor: UType.Result, newProg: p, oldProg: oldP, callback: c };
}
function UpdateFail(msg) {
    return { ctor: UType.Fail, msg: msg };
}
function UpdateCriticalError(msg) {
    return { ctor: UType.CriticalError, msg: msg };
}
function UpdateAlternative() {
    var actions = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        actions[_i] = arguments[_i];
    }
    if (actions.length === 1) {
        return actions[0];
    }
    return { ctor: UType.Alternative, alternatives: actions };
}
/*
interface Updatable {
  update(prog: Prog, newVal: UpdateData): UpdateAction
}
*/
function processUpdateAction(action, callbacks, forks) {
    if (callbacks === void 0) { callbacks = []; }
    if (forks === void 0) { forks = []; }
    while (action.ctor != UType.Result ||
        action.callback ||
        callbacks.length != 0) {
        if (action.ctor == UType.Result) {
            if (action.callback)
                callbacks.push(action.callback);
            action = callbacks.pop()(action.newProg, action.oldProg);
        }
        else if (action.ctor == UType.Continue) {
            if (action.callback)
                callbacks.push(action.callback);
            action = getUpdateAction(action.prog, action.updateData);
        }
        else if (action.ctor == UType.Fail) {
            if (forks.length) {
                var fork = forks.pop();
                action = fork.action;
                callbacks = fork.callbacks;
            }
            else {
                return Err(action.msg);
            }
        }
        else if (action.ctor == UType.CriticalError) {
            return Err(action.msg);
        }
        else if (action.ctor == UType.Alternative) {
            if (action.alternatives.length == 0) {
                action = UpdateFail("Empty alternatives");
            }
            else {
                for (var i = 1; i < action.alternatives.length; i++) {
                    forks.push({ action: action.alternatives[i], callbacks: callbacks.slice() });
                }
                action = action.alternatives[0];
            }
        }
        else {
            return Err("Unknown update action: " + action.ctor);
        }
    }
    return Ok({ prog: action.newProg, alternatives: forks });
}
function isDSame(diffs) {
    return diffs.length === 1 && diffs[0].ctor === DType.Update && diffs[0].kind === DUType.Reuse && diffs[0].children.length === 0;
}
// TODO: Incorporate custom path map.
function processClone(prog, newVal, oldVal, diff, callback) {
    var Syntax = syntax.Syntax || esprima.Syntax;
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    if (diff.path.up <= prog.context.length) {
        var oldNode = prog.stack.head.node;
        var toClone = diff.path.up == 0 ? oldNode : prog.context[diff.path.up - 1];
        var nodePathDown = [];
        for (var _i = 0, _a = diff.path.down; _i < _a.length; _i++) { // We map down path elems to AST
            var downpathelem = _a[_i];
            if (toClone && toClone.type == Syntax.ArrayExpression && typeof toClone.elements[downpathelem] != "undefined") {
                nodePathDown.push("elements");
                nodePathDown.push(downpathelem);
                toClone = toClone.elements[downpathelem];
            }
            else
                return UpdateFail("Cloning path not supported for " + downpathelem + " on " + (toClone ? toClone.type : " empty path"));
        }
        if (isDSame(diff.diffs)) {
            return UpdateResult(__assign({}, prog, { stack: { head: __assign({}, prog.stack.head, { node: Object.create(toClone) }),
                    tail: prog.stack.tail }, diffs: DDChild(["stack", "head", "node"], DDClone({ up: diff.path.up, down: nodePathDown }, DDSame())) }), prog, callback);
        }
        else {
            return UpdateContinue(__assign({}, prog, { stack: { head: __assign({}, prog.stack.head, { node: Object.create(toClone) }),
                    tail: prog.stack.tail } }), { newVal: newVal, oldVal: oldVal, diffs: diff.diffs }, callback || UpdateResult);
        }
    }
    else {
        return UpdateFail("Difference outside of context");
    }
}
function valToNodeDiffs_(value) {
    return DDNewNode(value);
}
function keyValueToProperty(key, propertyValue) {
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    var propertyKey = new Node.Identifier("", key, key);
    return new Node.Property("init", propertyKey, "", "", "", "", false, propertyValue, false, false);
}
function valToNode_(value) {
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    if (typeof value == "number" || typeof value == "boolean" || typeof value == "string" || typeof value == "object" && value === null) {
        return new Node.Literal("", value, uneval_(value));
    }
    else if (typeof value == "object") {
        if (Array.isArray(value)) {
            return new Node.ArrayExpression("", value.map(valToNode_), [], "");
        }
        else {
            var children = [];
            for (var k in value) {
                var v = value[k];
                var propertyValue = valToNode_(v);
                children.push(keyValueToProperty(k, propertyValue));
            }
            return new Node.ObjectExpression("", children, [], "");
        }
    }
    return new Node.Literal("", null, "null");
}
function filterDiffsNoClonesDown(diffs) {
    var willBeEmpty = false;
    var newDiffs = [];
    for (var _i = 0, diffs_1 = diffs; _i < diffs_1.length; _i++) {
        var diff = diffs_1[_i];
        if (diff.ctor === DType.Clone) {
            if (diff.path.up != 0)
                newDiffs.push(diff);
            continue;
        }
        var newChildrenDiffs = {};
        for (var key in diff.children) {
            var newChildDiffs = filterDiffsNoClonesDown(diff.children[key]);
            if (newChildDiffs.length == 0)
                willBeEmpty = true;
            newChildDiffs[key] = newChildDiffs;
        }
        newDiffs.push(__assign({}, diff, { children: newChildrenDiffs }));
    }
    if (willBeEmpty)
        return [];
    return newDiffs;
}
function processClones(prog, updateData, otherwise) {
    var Syntax = syntax.Syntax || esprima.Syntax;
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    return UpdateAlternative.apply(void 0, updateData.diffs.map(function (diff) {
        var oldNode = prog.stack.head.node;
        if (diff.ctor === DType.Clone) {
            return processClone(prog, updateData.newVal, updateData.oldVal, diff);
        }
        else if (diff.kind.ctor === DUType.NewValue) {
            var model = diff.kind.model;
            if ((typeof model == "number" ||
                typeof model == "string" ||
                typeof model == "boolean") &&
                (oldNode.type == Syntax.Literal ||
                    oldNode.type == Syntax.ArrayExpression ||
                    oldNode.type == Syntax.ObjectExpression)) { // TODO: Deal with string literals in a better way.
                var oldFormat = oldNode.type === Syntax.Literal ? oldNode : { wsBefore: oldNode.wsBefore, value: undefined, raw: uneval_(model), wsAfter: oldNode.wsAfter || "" };
                var newChildVal = new Node.Literal(oldFormat.wsBefore, oldFormat.value, oldFormat.raw);
                newChildVal.wsAfter = oldFormat.wsAfter;
                newChildVal.value = model;
                return UpdateResult(__assign({}, prog, { stack: __assign({}, prog.stack, { head: __assign({}, prog.stack.head, { node: newChildVal }) }), diffs: DDChild(["stack", "head", "node"], valToNodeDiffs_(newChildVal)) }), prog);
            }
            else if (typeof model == "object") {
                // TODO: Adapt the Diff
                var oldFormat = oldNode.type === Syntax.ArrayExpression ? oldNode : oldNode.type === Syntax.ObjectExpression ? oldNode : { wsBefore: "", separators: [], wsBeforeClosing: "" };
                var newNode = valToNode_(model);
                var separators = oldFormat.separators;
                var numKeys = Array.isArray(model) ? model.length : Object.keys(model).length;
                if (separators.length >= numKeys) {
                    separators = separators.slice(0, Math.max(0, numKeys - 1));
                }
                newNode.wsBefore = oldFormat.wsBefore;
                newNode.wsBeforeClosing = oldFormat.wsBeforeClosing;
                newNode.separators = separators;
                var newDiffs = DDNewNode(newNode);
                var gatherer = newNode.type === Syntax.ArrayExpression ?
                    arrayGather(prog, newNode, newDiffs)
                    : objectGather(prog, Object.keys(updateData.newVal), newNode, newDiffs);
                var diffToConsider_1 = __assign({}, diff);
                var willBeEmpty = false;
                if (oldNode.type === Syntax.Identifier) {
                    // For now, identifiers forbid the flow of (children) clones
                    for (var k in diff.children) {
                        diffToConsider_1.children[k] = filterDiffsNoClonesDown(diff.children[k]);
                        willBeEmpty = willBeEmpty || diffToConsider_1.children[k].length == 0;
                    }
                }
                if (willBeEmpty) {
                    if (otherwise)
                        return otherwise(diff);
                    return undefined;
                }
                return updateForeach(prog.stack.head.env, Object.keys(updateData.newVal), function (k) { return function (callback) {
                    var newChildVal = updateData.newVal[k];
                    var childDiff = diffToConsider_1.children[k];
                    if (typeof childDiff == "undefined") {
                        var newChildNode = valToNode_(newChildVal);
                        var newChildNodeDiffs = valToNodeDiffs_(newChildVal);
                        return UpdateResult(__assign({}, prog, { stack: { head: __assign({}, prog.stack.head, { node: newChildNode }), tail: prog.stack.tail }, diffs: DDChild(["stack", "head", "node"], newChildNodeDiffs) }), prog, callback);
                    }
                    else { // Clones and reuse go through this
                        var oldChildVal = updateData.oldVal[k];
                        return UpdateContinue(prog, {
                            newVal: newChildVal, oldVal: oldChildVal, diffs: childDiff
                        }, callback);
                    }
                }; }, gatherer);
            }
            else {
                if (otherwise)
                    return otherwise(diff);
            }
        }
        else {
            if (otherwise)
                return otherwise(diff);
        }
        return undefined;
    }).filter(function (x) { return typeof x !== "undefined"; }));
}
function updateForeach(env, collection, callbackIterator, gather) {
    var aux = function (envSoFar, nodesSoFar, diffsSoFar, i) {
        if (i < collection.length) {
            var elem = collection[i];
            return callbackIterator(elem, i)(function (newProg, oldProg) {
                var mergedEnv = mergeUpdatedEnvs(envSoFar, newProg.stack.head.env)._0;
                return aux(mergedEnv, nodesSoFar.concat(newProg.stack.head.node), diffsSoFar.concat(newProg.diffs), i + 1);
            });
        }
        else {
            return gather(envSoFar, nodesSoFar, diffsSoFar);
        }
    };
    return aux(env, [], [], 0);
}
function arrayGather(prog, newNode, newDiffs) {
    return function (newEnv, newNodes, newNodesDiffs) {
        newNode.elements = newNodes;
        newDiffs[0].children.elements = DDReuse(newNodesDiffs); // FIXME: Not correct: elements form a new array.
        return UpdateResult(__assign({}, prog, { stack: {
                head: __assign({}, prog.stack.head, { node: newNode, env: newEnv }),
                tail: prog.stack.tail
            }, diffs: DDChild(["stack", "head", "node"], newDiffs) }), prog);
    };
}
function objectGather(prog, keys, newNode, newDiffs) {
    return function (newEnv, newNodes, newNodesDiffs) {
        keys.map(function (key, k) {
            newNode.properties.push(keyValueToProperty(key, newNodes[k]));
        });
        newDiffs[0].children.properties = DDReuse(newNodesDiffs.map(function (newNodeDiff) { return DDReuse({ value: newNodeDiff }); })); // FIXME: Not reuse?!
        return UpdateResult(__assign({}, prog, { stack: {
                head: __assign({}, prog.stack.head, { node: newNode, env: newEnv }),
                tail: prog.stack.tail
            }, diffs: DDChild(["stack", "head", "node"], newDiffs) }), prog);
    };
}
function walkNodes(nodes, preCall, postCall, level) {
    for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
        var x = nodes_1[_i];
        walkNode(x, preCall, postCall, level);
    }
}
var walkers = undefined;
function walkNode(node, preCall, postCall, level) {
    var _a;
    if (typeof walkers == "undefined") {
        var Syntax = syntax.Syntax || esprima.Syntax;
        var rMany = function (sub) { return function (node, preCall, postCall, level) {
            var children = node[sub];
            if (children == null)
                return;
            for (var _i = 0, _a = node[sub]; _i < _a.length; _i++) {
                var x_1 = _a[_i];
                var r = walkNode(x_1, preCall, postCall, level + 1);
                if (typeof r !== "undefined")
                    return r;
            }
        }; };
        var rChild = function (sub) { return function (node, preCall, postCall, level) {
            var child = node[sub];
            if (typeof child !== "undefined")
                return walkNode(child, preCall, postCall, level + 1);
        }; };
        var rElements = rMany("elements");
        var combine = function () {
            var rFuns = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                rFuns[_i] = arguments[_i];
            }
            return function (node, preCall, postCall, level) {
                for (var _i = 0, rFuns_1 = rFuns; _i < rFuns_1.length; _i++) {
                    var rFun = rFuns_1[_i];
                    if (typeof rFun === "string")
                        rFun = rChild(rFun);
                    var x = rFun(node, preCall, postCall, level + 1);
                    if (typeof x !== "undefined")
                        return x;
                }
            };
        };
        var rBody = rChild("body");
        var rFunctions = combine("id", rMany("params"), rBody);
        var rBinary = combine("left", "right");
        var rControl = rChild("label");
        var rClass = combine("id", "superClass", rBody);
        var rIf = combine("test", "consequent", "alternate");
        var rMember = combine("object", "property");
        walkers = (_a = {},
            _a[Syntax.ArrayExpression] = rElements,
            _a[Syntax.ArrayPattern] = rElements,
            _a[Syntax.ArrowFunctionExpression] = rFunctions,
            _a[Syntax.AssignmentExpression] = rBinary,
            _a[Syntax.AssignmentPattern] = rBinary,
            _a[Syntax.AwaitExpression] = rChild("argument"),
            _a[Syntax.BinaryExpression] = rBinary,
            _a[Syntax.BlockStatement] = rBody,
            _a[Syntax.BreakStatement] = rControl,
            _a[Syntax.ContinueStatement] = rControl,
            _a[Syntax.CallExpression] = combine("callee", rMany("arguments")),
            _a[Syntax.CatchClause] = combine("param", rBody),
            _a[Syntax.ClassBody] = rBody,
            _a[Syntax.ClassDeclaration] = rClass,
            _a[Syntax.ClassExpression] = rClass,
            _a[Syntax.ConditionalExpression] = rIf,
            _a[Syntax.DoWhileStatement] = combine(rBody, "test"),
            _a[Syntax.ExportAllDeclaration] = rChild("source"),
            _a[Syntax.ExportDefaultDeclaration] = rChild("declaration"),
            _a[Syntax.ExportNamedDeclaration] = combine("declaration", rMany("specifiers")),
            _a[Syntax.ExportSpecifier] = combine("exported", "local"),
            _a[Syntax.ExpressionStatement] = rChild(node.expression),
            _a[Syntax.ForInStatement] = combine(rBinary, rBody),
            _a[Syntax.ForOfStatement] = combine(rBinary, rBody),
            _a[Syntax.ForStatement] = combine("init", "test", "update", rBody),
            _a[Syntax.FunctionDeclaration] = rFunctions,
            _a[Syntax.FunctionExpression] = rFunctions,
            _a[Syntax.Identifier] = null,
            _a[Syntax.MemberExpression] = rMember,
            _a[Syntax.IfStatement] = rIf,
            _a[Syntax.Import] = null,
            _a[Syntax.ImportDeclaration] = combine(rMany("specifiers"), "source"),
            _a[Syntax.ImportDefaultSpecifier] = rChild("local"),
            _a[Syntax.ImportNamespaceSpecifier] = rChild("local"),
            _a[Syntax.ImportSpecifier] = combine("local", "imported"),
            _a[Syntax.LabeledStatement] = combine("label", rBody),
            _a[Syntax.Literal] = null,
            _a[Syntax.MetaProperty] = combine("meta", "property"),
            _a[Syntax.MethodDefinition] = combine("key", "value"),
            _a[Syntax.Program] = rMany("body"),
            _a[Syntax.NewExpression] = combine("callee", rMany("arguments")),
            _a[Syntax.ObjectExpression] = rMany("properties"),
            _a[Syntax.ObjectPattern] = rMany("properties"),
            _a[Syntax.Property] = combine("key", "value"),
            _a[Syntax.RestElement] = rChild("argument"),
            _a[Syntax.ReturnStatement] = rChild("argument"),
            _a[Syntax.SequenceExpression] = rMany("expressions"),
            _a[Syntax.SpreadElement] = rChild("argument"),
            _a[Syntax.Super] = null,
            _a[Syntax.SwitchCase] = combine("test", rMany("consequent")),
            _a[Syntax.SwitchStatement] = combine("discriminant", rMany("cases")),
            _a[Syntax.TaggedTemplateExpression] = combine("tag", "quasi"),
            _a[Syntax.TemplateElement] = null,
            _a[Syntax.TemplateLiteral] = combine(rMany("quasis"), rMany("expressions")),
            _a[Syntax.ThisExpression] = null,
            _a[Syntax.ThrowStatement] = rChild("argument"),
            _a[Syntax.TryStatement] = combine("block", "handler", "finalizer"),
            _a[Syntax.UnaryExpression] = rChild("argument"),
            _a[Syntax.UpdateExpression] = rChild("argument"),
            _a[Syntax.VariableDeclaration] = rMany("declarations"),
            _a[Syntax.VariableDeclarator] = combine("id", "init"),
            _a[Syntax.WhileStatement] = combine("test", rBody),
            _a[Syntax.WithStatement] = combine("object", rBody),
            _a[Syntax.YieldExpression] = rChild("argument"),
            _a);
    }
    var x = preCall ? preCall(node, level) : undefined;
    if (typeof x !== "undefined")
        return x;
    if (node !== null) {
        var walker = walkers[node.type];
        if (typeof walker === "function") {
            var x = walker(node, preCall, postCall, level);
            if (typeof x !== "undefined")
                return x;
        }
    }
    var x = postCall ? postCall(node, level) : undefined;
    if (typeof x !== "undefined")
        return x;
}
// Returns [a list of declarations that will allocate a heap reference -- initially filled with "undefined" (no declarations if declarations = false),
// a list of definitions that have to be hoisted (e.g. function definitions)]
function hoistedDeclarationsDefinitions(body, declarations) {
    if (declarations === void 0) { declarations = true; }
    var Syntax = syntax.Syntax || esprima.Syntax;
    var localVars = {};
    var localDefinitions = {};
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    walkNodes(body, function (node, level) {
        // We hoist variable declarations
        if (declarations && node.type === Syntax.VariableDeclaration) {
            for (var _i = 0, _a = node.declarations; _i < _a.length; _i++) {
                var declaration = _a[_i];
                if (declaration.id.type === Syntax.Identifier) {
                    localVars[declaration.id.name] =
                        new Node.VariableDeclaration("\n", [new Node.VariableDeclarator(declaration.id, " ", new Node.Identifier(" ", "undefined", "undefined"))
                        ], [], "let", ";");
                }
            }
        }
        // We hoist function declarations.
        // We hoist function definitions only if they are a top-level child
        if (node.type === Syntax.FunctionDeclaration) {
            var fd = node;
            if (declarations) {
                localVars[fd.id.name] =
                    new Node.VariableDeclaration("\n", [new Node.VariableDeclarator(fd.id, " ", new Node.Identifier(" ", "undefined", "undefined"))
                    ], [], "let", ";");
            }
            if (level == 0) {
                var fe = new Node.FunctionExpression(fd.wsBeforeFunction, fd.wsBeforeStar, fd.id, fd.wsBeforeParams, fd.params, fd.separators, fd.wsBeforeEndParams, fd.body, fd.generator);
                fe.wsAfter = fd.wsAfter;
                localDefinitions[fd.id.name] =
                    new Node.AssignmentExpression(" ", "=", fd.id, fe);
            }
        }
        // We ignore declarations inside functions of course.
        if (node.type === Syntax.FunctionDeclaration || node.type === Syntax.FunctionExpression)
            return true;
    });
    var varDeclarations = [];
    for (var decl in localVars) {
        varDeclarations.push(localVars[decl]);
    }
    var definitions = [];
    for (var defi in localDefinitions) {
        definitions.push(localDefinitions[defi]);
    }
    return [varDeclarations, definitions];
}
function reverseArray(arr) {
    var newArray = [];
    for (var i = arr.length - 1; i >= 0; i--) {
        newArray.push(arr[i]);
    }
    return newArray;
}
// Update.js is generated by Update.ts
function getUpdateAction(prog, updateData) {
    /*if(prog.node.update) { // In case there is a custom update procedure available.
      return prog.node.update{prog, diff};
    }*/
    var Syntax = syntax.Syntax || esprima.Syntax;
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    if (!prog.stack) { // Nothing to update, something must be wrong.
        return UpdateFail("Cannot update empty stack. What's wrong?");
    }
    var stack = prog.stack;
    var stackHead = stack.head;
    if (stackHead.tag = StackValueType.Node) {
        var oldNode = stackHead.node;
        if (!("env" in stackHead)) {
            console.log(prog);
            return UpdateFail("[Internal Error] Environment not found at this point.");
        }
        var env = stackHead.env;
        var newStack_1 = stack.tail; // Pop the stack
        switch (oldNode.type) {
            case Syntax.Program:
                var script = oldNode;
                if (script.body.length == 0) {
                    return UpdateFail("Cannot update empty script");
                }
                var _a = hoistedDeclarationsDefinitions(script.body, /*declarations*/ true), declarations = _a[0], definitions = _a[1];
                var isFirst = true;
                for (var _i = 0, _b = reverseArray(declarations.concat(definitions.concat(script.body))); _i < _b.length; _i++) {
                    var statement = _b[_i];
                    newStack_1 = { head: { tag: StackValueType.Node, node: statement }, tail: newStack_1 };
                    if (isFirst) {
                        newStack_1.head.returnedExpressionStatement = true;
                        isFirst = false;
                    }
                }
                newStack_1 = { head: __assign({}, newStack_1.head, { env: env }), tail: newStack_1 };
                return UpdateContinue(__assign({}, prog, { stack: newStack_1 }), updateData, function (newX, oldX) {
                    console.log(newX.stack.head);
                    throw "TODO: Implement me (Program)";
                    // TODO: Reconstruct the original modified program here and its diff
                });
            case Syntax.AssignmentExpression:
                return;
            case Syntax.VariableDeclaration:
                var varDecls = oldNode;
                var isLet = varDecls.kind === "let";
                if (isLet || varDecls.kind === "const") {
                    //const = introduce environment variables
                    //let = will wrap these environment variables by references.
                    //No need to compute value at this point.
                    var newEnv = env;
                    var heapSource = undefined;
                    var isFirst_1 = true;
                    var lastComputationSource = void 0;
                    for (var _c = 0, _d = reverseArray(varDecls.declarations); _c < _d.length; _c++) {
                        var decl = _d[_c];
                        if (isFirst_1) {
                            heapSource = prog.heapSource;
                            isFirst_1 = false;
                        }
                        else {
                            heapSource = { tag: HeapSourceType.After, source: lastComputationSource };
                        }
                        lastComputationSource = {
                            env: newEnv,
                            expr: decl.right,
                            heapSource: heapSource,
                            heapAllocated: isLet
                        };
                        newEnv = {
                            head: { name: decl.id.name, value: lastComputationSource },
                            tail: newEnv
                        };
                    }
                    if (typeof newStack_1 !== "undefined") {
                        // We propagate the environment to the next stack element.
                        newStack_1 = { head: __assign({}, newStack_1.head, { env: newEnv }), tail: newStack_1.tail };
                    }
                    return UpdateContinue(__assign({}, prog, { stack: newStack_1 }), updateData, function (newX, oldX) {
                        throw "TODO: Implement me (let/const)";
                        // TODO: Recover definitions and the program shape.
                    });
                }
                else if (varDecls.kind === "var") {
                    //var = just unroll as variable assignments
                    for (var _e = 0, _f = reverseArray(varDecls.declarations); _e < _f.length; _e++) {
                        var decl = _f[_e];
                        var rewrittenNode = new Node.AssignmentExpression(decl.wsBeforeEq, "=", decl.id, decl.right === null ? decl.id : decl.right);
                        rewrittenNode.wsBefore = decl.wsBefore;
                        rewrittenNode.wsAfter = decl.wsAfter;
                        newStack_1 = { head: { tag: StackValueType.Node, env: env, node: rewrittenNode }, tail: newStack_1 };
                    }
                    return UpdateContinue(__assign({}, prog, { stack: newStack_1 }), updateData, function (newX, oldX) {
                        throw "TODO: Implement me (var)";
                        // TODO: Reconstruct program and diffs from rewriting
                    });
                }
                else
                    return UpdateFail("Unknown variable declaration kind: " + varDecls.kind);
            case Syntax.ExpressionStatement:
                // We compute heap modifications. Only if stackHead marked with returnedExpressionStatement = true can we propagate updateData to the expression.
                // propagate environment to the next statement
                newStack_1 = { head: __assign({}, newStack_1.head, { env: env }), tail: newStack_1.tail };
                var expStatement = oldNode;
                if (stackHead.returnedExpressionStatement) {
                    // Add the expression to the stack.
                    newStack_1 = { head: { tag: StackValueType.Node, env: env, node: expStatement.expression }, tail: newStack_1 };
                    return UpdateContinue(__assign({}, prog, { stack: newStack_1 }), updateData, function (newX, oldX) {
                        var updatedNode = new Node.ExpressionStatement(newX.stack.head.node, oldNode.semicolon);
                        updatedNode.wsBefore = oldNode.wsBefore;
                        updatedNode.wsAfter = oldNode.wsAfter;
                        var updatedStack = {
                            head: __assign({}, newX.stack.head, { node: updatedNode }), tail: newX.stack.tail
                        };
                        var updateDiffs = DDWrap(["stack", "head", "node"], newX.diffs, function (d) { return DDChild("expression", d); });
                        return UpdateResult(__assign({}, prog, { stack: updatedStack, diffs: updateDiffs }), prog);
                    });
                }
                else {
                    // No back-propagation at this point. We just move on but the heap is now a reference in case we need it.
                    return UpdateContinue(__assign({}, prog, { heapSource: { tag: HeapSourceType.After, source: { env: env,
                                expr: expStatement.expression,
                                heapSource: prog.heapSource }
                        }, stack: newStack_1 }), updateData, function (newX, oldX) {
                        // TODO: Reconstruct Expression statement and diffs.
                        throw "TODO: Implement me (ExpressionStatement)";
                    });
                }
            case Syntax.Literal: // Literals can be replaced by clones
                // TODO: Make sure this is correct. Make the stack to work.
                return processClones(prog, updateData, function (diff) {
                    var newDiffs = DDChild(["stack", "head", "node", "value"], DDNewValue(updateData.newVal)); // TODO: What about string diffs?
                    var newNode = Object.create(oldNode);
                    newNode.value = updateData.newVal;
                    return UpdateResult(__assign({}, prog, { stack: { head: __assign({}, stackHead, { node: newNode }), tail: newStack_1 }, diffs: newDiffs }), prog);
                });
            case Syntax.Identifier: // Updates the environment, or the heap.
                // TODO: Immediately update expression. Will merge expressions later in any case.
                /*var newEnv = updateVar_(prog.env, (oldNode as Node.Identifier).name, function(oldValue: EnvValue): EnvValue {
                  return {v_: updateData.newVal,
                          expr: oldValue.expr, // TODO: Update this expression as well !
                          env: oldValue.env};
                });
                // Process clone expressions first (i.e. change shape of program)
                return UpdateAlternative(
                  processClones(prog, updateData),
                  UpdateResult({...prog, env: newEnv, diffs: DDSame()}, prog));*/
                throw "TODO: Implement me (Identifier)";
            case Syntax.ReturnStatement:
                // We can update its expression with updateData.
                throw "TODO: Implement me (ReturnStatement)";
            case Syntax.ArrayExpression:
                // For arrays of size 2 where
                // - the second node is an object
                // - and the first one is a string
                // it is possible to push back a string (the object is copied)
                // This should have been take care of before.
                //var subExpressions = oldNode.
                //return ;
                // When there will be a heap, elements can modify the heap; in this case, we should
                // treat every sub-expression as an assignment,
                // For now let's suppose they don't.
                if (typeof updateData.newVal == "string" || typeof updateData.newVal == "number") {
                    // Check the diff: Maybe it's a cloned value, e.g. unwrapped?
                    return UpdateAlternative.apply(void 0, updateData.diffs.map(function (diff) {
                        if (diff.ctor === DType.Clone) {
                            return processClone(prog, updateData.newVal, updateData.oldVal, diff);
                        }
                        else {
                            var newNode = new Node.Literal(oldNode.wsBefore, updateData.newVal, uneval_(updateData.newVal)); // TODO: What about string diffs?
                            return UpdateResult(__assign({}, prog, { stack: { head: __assign({}, stackHead, { node: newNode }), tail: newStack_1 }, diffs: DDChild(["stack", "head", "node"], DDNewNode(newNode)) }), prog);
                        }
                    }));
                }
                return processClones(prog, updateData, function (diff) {
                    var elements = oldNode.elements;
                    var newNode;
                    var newDiffs;
                    if (diff.kind.ctor === DUType.Reuse) {
                        newNode = Object.create(oldNode);
                        newDiffs = DDReuse({ elements: DDSame() });
                        return updateForeach(prog.stack.head.env, elements, function (element, k) { return function (callback) {
                            return typeof diff.children[k] != "undefined" ?
                                UpdateContinue(__assign({}, prog, { context: [oldNode].concat(prog.context), stack: { head: __assign({}, stackHead, { node: element }), tail: newStack_1 } }), { newVal: updateData.newVal[k],
                                    oldVal: updateData.oldVal[k],
                                    diffs: diff.children[k] }, callback) :
                                UpdateResult(__assign({}, prog, { stack: { head: __assign({}, stackHead, { node: element }), tail: newStack_1 }, diffs: DDSame() }), prog, callback);
                        }; }, arrayGather(prog, newNode, newDiffs));
                    }
                    else {
                        return UpdateFail("Don't know how to handle this kind of diff on arrays: " + diff.kind.ctor);
                    }
                });
            default:
                return UpdateFail("Reversion does not currently support nodes of type " + oldNode.type);
        }
    }
    return UpdateFail("Reversion does not support this current stack element: " + stackHead.tag);
}
// Find all paths from complexVal to simpleVal if complexVal contains simpleVal
function allClonePaths_(complexVal, simpleVal) {
    if (uneval_(simpleVal) === uneval_(complexVal))
        return [{ up: 0, down: [] }];
    if (typeof complexVal == "object") {
        var diffs = [];
        var _loop_1 = function (k) {
            diffs.push.apply(diffs, allClonePaths_(complexVal[k], simpleVal).map(function (p) {
                p.down.unshift(k);
                return p;
            }));
        };
        for (var k in complexVal) {
            _loop_1(k);
        }
        return diffs;
    }
    return [];
}
function isRichText_(value) {
    return typeof value == "object" &&
        Array.isArray(value) &&
        value.length === 2 &&
        typeof value[0] == "string" &&
        typeof value[1] == "object" &&
        !Array.isArray(value[1]);
}
function isElement_(value) {
    return typeof value == "object" &&
        Array.isArray(value) &&
        value.length === 3 &&
        typeof value[0] == "string" &&
        typeof value[1] == "object" &&
        !Array.isArray(value[1]) &&
        typeof value[2] == "object" &&
        Array.isArray(value[2]);
}
function isSimpleChildClone(d) {
    return d.ctor == DType.Clone && d.path.up === 0 && d.path.down.length == 1;
}
// Later, we could include the context while computing diffs to recover up clones.
function computeDiffs_(oldVal, newVal) {
    var o = typeof oldVal;
    var n = typeof newVal;
    if (o == "function" || n == "function") {
        return []; // Cannot diff functions
    }
    function addNewObjectDiffs(diffs) {
        var childDiffs = {};
        var model = Array.isArray(newVal) ? Array(newVal.length) : {};
        var lastClosestOffset = 0;
        var _loop_2 = function () {
            if (typeof oldVal == "object" && lastClosestOffset == 0 &&
                uneval_(oldVal[key]) == uneval_(newVal[key])) {
                // Same key, we try not to find fancy diffs with it.
                childDiffs[key] = DDClone({ up: 0, down: [key] }, DDSame());
            }
            else {
                cd = computeDiffs_(oldVal, newVal[key]);
                if (cd.length == 1 && cd[0].ctor == DType.Update && cd[0].kind.ctor == DUType.NewValue && Object.keys(cd[0].children).length == 0) {
                    model[key] = cd[0].kind.model;
                }
                else {
                    if (cd.length >= 1 && isSimpleChildClone(cd[0])) {
                        // Here we should remove everything else which is not a clone, as we are just moving children around the object.
                        cd = cd.filter(function (d) { return isSimpleChildClone(d); });
                        if (Array.isArray(newVal)) {
                            // The most likely clones are those whose key is close to the original one.
                            // TODO: For deletions and insertions, compute an offset to change this key.
                            var nKey_1 = parseInt(key);
                            cd.sort(function (d1, d2) {
                                return Math.abs(parseInt(d1.path.down[0] + "") - nKey_1 - lastClosestOffset) -
                                    Math.abs(parseInt(d2.path.down[0] + "") - nKey_1 - lastClosestOffset);
                            });
                            lastClosestOffset = parseInt(cd[0].path.down[0] + "") - nKey_1;
                        }
                        ;
                        //cd.length = 1;
                    }
                    childDiffs[key] = cd;
                }
            }
        };
        var cd;
        for (var key in newVal) {
            _loop_2();
        }
        diffs.push.apply(diffs, DDNewObject(childDiffs, model));
        return diffs;
    }
    if (o == "number" || o == "boolean" || o == "string") {
        if (n == "boolean" || n == "number" ||
            n == "string") {
            if (oldVal === newVal)
                return DDSame();
            // if(n == "string") // TODO: String diffs
            return DDNewValue(newVal);
        }
        else if (n == "object") { // maybe the number was included in the object/array
            return addNewObjectDiffs([]);
        }
    }
    else if (o == "object") {
        if (n == "number" || n == "string" || n == "boolean") {
            // It could have been cloned from one of the object's descendent.
            var clonePaths = allClonePaths_(oldVal, newVal);
            var diffs = [];
            for (var c in clonePaths) {
                diffs.push({ ctor: DType.Clone, path: clonePaths[c], diffs: DDSame() });
            }
            diffs.push.apply(diffs, DDNewValue(newVal));
            // WISH: Sort diffs according to relevance
            return diffs;
        }
        if (n == "object") {
            // It might be possible that objects are also wrapped or unwrapped from other objects, e.g.
            // n: ["img", {}, []] ->
            // o: ["p", {}, ["img", {}, []]];
            // We want to detect that.
            var diffs = [];
            var sameKeys = uneval_(Object.keys(newVal)) == uneval_(Object.keys(oldVal));
            if (sameKeys) { // Check if they are compatible for reuse
                if (uneval_(newVal) == uneval_(oldVal)) {
                    return DDSame();
                }
                if (isRichText_(newVal) && isRichText_(oldVal) || isElement_(newVal) && isElement_(oldVal) && newVal[0] == oldVal[0] || !isRichText_(newVal) && !isRichText_(oldVal) && !isElement_(newVal) && !isElement_(oldVal) && Array.isArray(oldVal) == Array.isArray(newVal)) {
                    var childDiffs = {};
                    for (var k in oldVal) {
                        var oldValChild = oldVal[k];
                        var newValChild = newVal[k];
                        if (uneval_(oldValChild) != uneval_(newValChild))
                            childDiffs[k] = computeDiffs_(oldValChild, newValChild);
                    }
                    diffs.push({ ctor: DType.Update, kind: { ctor: DUType.Reuse }, children: childDiffs });
                }
            }
            // Now check if the new value was unwrapped
            var unwrappingPaths = allClonePaths_(oldVal, newVal);
            for (var c in unwrappingPaths) {
                diffs.push({ ctor: DType.Clone, path: unwrappingPaths[c], diffs: DDSame() });
            }
            // Now let's create a new object or array and obtain the children from the original.
            // Values might be wrapped that way.
            return addNewObjectDiffs(diffs);
        }
    }
    // Symbols
    return [];
}
// Given the old formula and the new value, try to generate a new formula.
// If fails, return false
// update_: (Env, StringFormula) -> StringValue -> (Ok([Env (updated with flags), StringFormula]) | Err(msg))
function update_(env, oldFormula) {
    /*addUpdateMethods();*/
    var oldNode = esprima.parseScript(oldFormula);
    var oldVal = evaluate_(env, oldFormula);
    return function (newVal) {
        var diffs = computeDiffs_(oldVal, newVal);
        /*
        console.log("computeDiffs_(" + uneval_(oldVal) + ", " + uneval_(newVal) + ")");
        console.log(uneval_(diffs, ""));
        //*/
        return formatUpdateResult(UpdateContinue(initProg(oldNode, env), { newVal: newVal, oldVal: oldVal, diffs: diffs }));
    };
}
function formatUpdateResult(updateAction, callbacks, forks) {
    var updated = processUpdateAction(updateAction, callbacks, forks);
    return resultCase(updated, function (x) { return Err(x); }, function (progWithAlternatives) {
        var uResult = {
            env: progWithAlternatives.prog.stack.head.env,
            node: progWithAlternatives.prog.stack.head.node.unparse(),
            next: function () {
                if (progWithAlternatives.alternatives.length == 0)
                    return undefined;
                var fork = progWithAlternatives.alternatives[0];
                var remainingForks = progWithAlternatives.alternatives.slice(1);
                var action = fork.action;
                var callbacks = fork.callbacks;
                var r = formatUpdateResult(action, callbacks, remainingForks);
                var result = r.ctor == "Err" ? undefined : r._0;
                uResult.next = (function (result) { return function () { return result; }; })(result);
                return result;
            }
        };
        return Ok(uResult);
    });
}
function testUpdate() {
    Logger.log(update_(undefined, "/*a=*/\"Hi\"")("Hai"));
}
//# sourceMappingURL=Update.js.map