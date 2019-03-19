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
    DUType["NewObject"] = "NewObject";
    DUType["NewArray"] = "NewArray";
    DUType["NewNode"] = "NewNode";
})(DUType || (DUType = {}));
;
function DDReuse(childDiffs) {
    return [{
            ctor: DType.Update,
            kind: { ctor: DUType.Reuse },
            children: childDiffs
        }];
}
function DDNewValue(newVal) {
    return [{ ctor: DType.Update, kind: { ctor: DUType.NewValue, newVal: newVal }, children: {} }];
}
function DDNewObject(children) {
    return [{ ctor: DType.Update, kind: { ctor: DUType.NewObject }, children: children }];
}
function DDNewArray(length, children) {
    return [{ ctor: DType.Update, kind: { ctor: DUType.NewArray, length: length }, children: children }];
}
function DDNewNode(nodeCtor, args, children) {
    if (children === void 0) { children = {}; }
    return [{ ctor: DType.Update, kind: { ctor: DUType.NewNode, nodeCtor: nodeCtor, arguments: args }, children: children }];
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
    var Syntax = syntax.Syntax;
    if (diff.path.up <= prog.context.length) {
        var toClone = diff.path.up == 0 ? prog.node : prog.context[diff.path.up - 1];
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
            return UpdateResult(__assign({}, prog, { node: Object.create(toClone), diffs: DDClone({ up: diff.path.up, down: nodePathDown }, DDSame()) }), prog, callback);
        }
        else {
            return UpdateContinue(__assign({}, prog, { node: Object.create(toClone) }), { newVal: newVal, oldVal: oldVal, diffs: diff.diffs }, callback || UpdateResult);
        }
    }
    else {
        return UpdateFail("Difference outside of context");
    }
}
function valToNode_(value) {
    return uniqueNewValOf(valToNodeDiffs_(value));
}
function valToNodeDiffs_(value) {
    if (typeof value == "number" || typeof value == "boolean" || typeof value == "string" || typeof value == "object" && value === null) {
        return DDNewNode("Literal", ["", value, uneval_(value)]);
    }
    else if (typeof value == "object") {
        if (Array.isArray(value)) {
            return DDNewNode("ArrayExpression", ["", value.map(valToNode_), [], ""]);
        }
        else {
            var children = [];
            for (var k in value) {
                var v = value[k];
                var propertyKey = new Node.Identifier("", k, k);
                var propertyValue = valToNode_(v);
                children.push(new Node.Property("init", propertyKey, "", "", "", "", false, propertyValue, false, false));
            }
            return DDNewNode("ObjectExpression", ["", children, [], ""]);
        }
    }
    return DDNewNode("Literal", ["", null]);
}
function processClones(prog, updateData, otherwise) {
    var Syntax = syntax.Syntax;
    return UpdateAlternative.apply(void 0, updateData.diffs.map(function (diff) {
        if (diff.ctor === DType.Clone) {
            return processClone(prog, updateData.newVal, updateData.oldVal, diff);
        }
        else if (diff.kind.ctor === DUType.NewArray) {
            var length_1 = diff.kind.length; // Just rebuild the new array and clone elements.
            var oldFormat = prog.node.type === Syntax.ArrayExpression ? prog.node : { wsBefore: "", separators: [], wsBeforeClosing: "" };
            var newDiffs = DDNewNode("ArrayExpression", [oldFormat.wsBefore, Array(length_1), oldFormat.separators, oldFormat.wsBeforeClosing], { elements: DDSame() });
            var newNode = uniqueNewValOf(newDiffs);
            return updateForeach(prog.env, updateData.newVal, function (newChildVal, k) { return function (callback) {
                var childDiff = diff.children[k];
                if (childDiff.length == 1 && childDiff[0].ctor === DType.Update &&
                    childDiff[0].kind.ctor !== DUType.Reuse) { // New values are not back-propagated in this context. We don't want them to flow through or otherwise change the existing function.
                    var newChildNode = valToNode_(newChildVal);
                    var newChildNodeDiffs = valToNodeDiffs_(newChildVal);
                    return UpdateResult(__assign({}, prog, { node: newChildNode, diffs: newChildNodeDiffs }), prog, callback);
                }
                else { // Clones and reuse go through this
                    var oldChildVal = updateData.oldVal[k];
                    return UpdateContinue(prog, {
                        newVal: newChildVal, oldVal: oldChildVal, diffs: childDiff
                    }, callback);
                }
            }; }, arrayGather(prog, newNode, newDiffs));
        }
        else { // TODO: Deal with string literals in a better way.
            if (otherwise)
                return otherwise(diff);
        }
        return undefined;
    }).filter(function (x) { return typeof x !== "undefined"; }));
}
function uniqueNewValOf(diffs) {
    var construct = Node[diffs[0].kind.nodeCtor];
    return new (construct.bind.apply(construct, [void 0].concat(diffs[0].kind.arguments)))();
}
function updateForeach(env, collection, callbackIterator, gather) {
    var aux = function (envSoFar, nodesSoFar, diffsSoFar, i) {
        if (i < collection.length) {
            var elem = collection[i];
            return callbackIterator(elem, i)(function (newProg, oldProg) {
                var mergedEnv = mergeUpdatedEnvs(envSoFar, newProg.env);
                return aux(mergedEnv, nodesSoFar.concat(newProg.node), diffsSoFar.concat(newProg.diffs), i + 1);
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
        newDiffs[0].children.elements = DDReuse(newNodesDiffs);
        return UpdateResult(__assign({}, prog, { env: newEnv, node: newNode, diffs: newDiffs }), prog);
    };
}
// Update.js is generated by Update.ts
function getUpdateAction(prog, updateData) {
    /*if(prog.node.update) { // In case there is a custom update procedure available.
      return prog.node.update{prog, diff};
    }*/
    var Syntax = esprima.Syntax;
    var oldNode = prog.node;
    if (oldNode.type == Syntax.Program) {
        var script = oldNode;
        if (script.body.length != 1)
            return UpdateFail("Reversion currently supports only 1 directive in program, got " + script.body.length);
        var e = script.body[0];
        if (e.type != Syntax.ExpressionStatement)
            return UpdateFail("Reversion currently supports only expression statements, got " + e.type);
        var x = e.expression;
        return UpdateContinue(__assign({}, prog, { node: x }), updateData, function (newX, oldX) {
            var newNode = Object.create(oldNode); // Deep copy
            newNode.body[0].expression = newX.node;
            var diffs = DDReuse({ body: DDReuse({ "0": DDReuse({ expression: newX.diffs }) }) });
            return UpdateResult(__assign({}, newX, { node: newNode, diffs: diffs }), prog);
        });
    }
    if (oldNode.type == Syntax.Literal) { // Literals can be replaced by clones
        return processClones(prog, updateData, function (diff) {
            var newDiffs = DDReuse({ value: DDNewValue(updateData.newVal) }); // TODO: What about string diffs?
            var newNode = Object.create(oldNode);
            newNode.value = updateData.newVal;
            return UpdateResult(__assign({}, prog, { node: newNode, diffs: newDiffs }), prog);
        });
    }
    if (oldNode.type == Syntax.Identifier) {
        // TODO: Environment diffs
        // TODO: Immediately update expression. Will merge expressions later.
        var newEnv = updateVar_(prog.env, oldNode.name, function (oldValue) {
            return { v_: updateData.newVal,
                vName_: typeof oldValue.vName_ != "undefined" ? updateData.newVal : undefined,
                expr: oldValue.expr,
                env: oldValue.env };
        });
        // Process clone expressions first.
        return UpdateAlternative(processClones(prog, updateData), UpdateResult(__assign({}, prog, { env: newEnv, diffs: DDSame() }), prog));
    }
    if (oldNode.type == Syntax.ArrayExpression) {
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
                    var newDiffs = DDNewNode("Literal", [oldNode.wsBefore, updateData.newVal]); // TODO: What about string diffs?
                    return UpdateResult(__assign({}, prog, { node: uniqueNewValOf(newDiffs), diffs: newDiffs }), prog);
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
                return updateForeach(prog.env, elements, function (element, k) { return function (callback) {
                    return typeof diff.children[k] != "undefined" ?
                        UpdateContinue(__assign({}, prog, { context: [oldNode].concat(prog.context), node: element }), { newVal: updateData.newVal[k],
                            oldVal: updateData.oldVal[k],
                            diffs: diff.children[k] }, callback) :
                        UpdateResult(__assign({}, prog, { node: element, diffs: DDSame() }), prog, callback);
                }; }, arrayGather(prog, newNode, newDiffs));
            }
            else {
                return UpdateFail("Don't know how to handle this kind of diff on arrays: " + DUType[diff.kind.ctor]);
            }
        });
    }
    return UpdateFail("Reversion does not currently support nodes of type " + oldNode.type);
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
        typeof value[1] == "object";
}
function isElement_(value) {
    return typeof value == "object" &&
        Array.isArray(value) &&
        value.length === 3 &&
        typeof value[0] == "string" &&
        typeof value[1] == "object" &&
        typeof value[2] == "object" &&
        Array.isArray(value[2]);
}
// Later, we could include the context while computing diffs to recover up clones.
function computeDiffs_(oldVal, newVal) {
    var o = typeof oldVal;
    var n = typeof newVal;
    if (o == "function" || n == "function") {
        return []; // Cannot diff functions
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
            var childDiffs = {};
            for (var key in newVal) {
                var newValChild = newVal[key];
                childDiffs[key] = computeDiffs_(oldVal, newValChild);
            }
            if (Array.isArray(newVal)) {
                return DDNewArray(newVal.length, childDiffs);
            }
            else {
                return DDNewObject(childDiffs);
            }
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
            var diffs_1 = [];
            var sameKeys = uneval_(Object.keys(newVal)) == uneval_(Object.keys(oldVal));
            if (sameKeys) { // Check if they are compatible for reuse
                if (isRichText_(newVal) && isRichText_(oldVal) || isElement_(newVal) && isElement_(oldVal) && newVal[0] == oldVal[0] || !isRichText_(newVal) && !isRichText_(oldVal) && !isElement_(newVal) && !isElement_(oldVal) && Array.isArray(oldVal) == Array.isArray(newVal)) {
                    var childDiffs_1 = {};
                    for (var k in oldVal) {
                        var oldValChild = oldVal[k];
                        var newValChild_1 = newVal[k];
                        if (uneval_(oldValChild) != uneval_(newValChild_1))
                            childDiffs_1[k] = computeDiffs_(oldValChild, newValChild_1);
                    }
                    diffs_1.push({ ctor: DType.Update, kind: { ctor: DUType.Reuse }, children: childDiffs_1 });
                }
            }
            // Now check if the new value was unwrapped
            var unwrappingPaths = allClonePaths_(o, n);
            for (var c in unwrappingPaths) {
                diffs_1.push({ ctor: DType.Clone, path: unwrappingPaths[c], diffs: DDSame() });
            }
            // Now let's create a new object or array and obtain the children from the original.
            // Values might be wrapped that way.
            var childDiffs_2 = {};
            for (var key in newVal) {
                childDiffs_2[key] = computeDiffs_(oldVal, newVal[key]);
            }
            if (Array.isArray(newVal)) {
                diffs_1.push.apply(diffs_1, DDNewObject(childDiffs_2));
            }
            else {
                diffs_1.push.apply(diffs_1, DDNewArray(newVal.length, childDiffs_2));
            }
            return diffs_1;
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
        var updated = processUpdateAction(UpdateContinue({ context: [], env: env, node: oldNode }, { newVal: newVal, oldVal: oldVal, diffs: diffs }));
        return resultCase(updated, function (x) { return Err(x); }, function (progWithAlternatives) {
            return Ok({ env: progWithAlternatives.prog.env, node: progWithAlternatives.prog.node.unparse() });
        });
    };
}
function testUpdate() {
    Logger.log(update_(undefined, "/*a=*/\"Hi\"")("Hai"));
}
