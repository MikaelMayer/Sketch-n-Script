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
        if (diff.ctor === DType.Clone) {
            return processClone(prog, updateData.newVal, updateData.oldVal, diff);
        }
        else if (diff.kind.ctor === DUType.NewValue) {
            var model = diff.kind.model;
            if ((typeof model == "number" ||
                typeof model == "string" ||
                typeof model == "boolean") &&
                (prog.node.type == Syntax.Literal ||
                    prog.node.type == Syntax.ArrayExpression ||
                    prog.node.type == Syntax.ObjectExpression)) { // TODO: Deal with string literals in a better way.
                var oldFormat = prog.node.type === Syntax.Literal ? prog.node : { wsBefore: prog.node.wsBefore, value: undefined, raw: uneval_(model) };
                var newChildVal = new Node.Literal(oldFormat.wsBefore, oldFormat.value, oldFormat.raw);
                newChildVal.value = model;
                return UpdateResult(__assign({}, prog, { node: newChildVal, diffs: valToNodeDiffs_(newChildVal) }), prog);
            }
            else if (typeof model == "object") {
                var oldFormat = prog.node.type === Syntax.ArrayExpression ? prog.node : prog.node.type === Syntax.ObjectExpression ? prog.node : { wsBefore: "", separators: [], wsBeforeClosing: "" };
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
                if (prog.node.type === Syntax.Identifier) {
                    // Identifiers forbid the flow of clones
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
                return updateForeach(prog.env, Object.keys(updateData.newVal), function (k) { return function (callback) {
                    var newChildVal = updateData.newVal[k];
                    var childDiff = diffToConsider_1.children[k];
                    if (typeof childDiff == "undefined") {
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
                var mergedEnv = mergeUpdatedEnvs(envSoFar, newProg.env)._0;
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
        newDiffs[0].children.elements = DDReuse(newNodesDiffs); // FIXME: Not correct: elements form a new array.
        return UpdateResult(__assign({}, prog, { env: newEnv, node: newNode, diffs: newDiffs }), prog);
    };
}
function objectGather(prog, keys, newNode, newDiffs) {
    return function (newEnv, newNodes, newNodesDiffs) {
        keys.map(function (key, k) {
            newNode.properties.push(keyValueToProperty(key, newNodes[k]));
        });
        newDiffs[0].children.properties = DDReuse(newNodesDiffs.map(function (newNodeDiff) { return DDReuse({ value: newNodeDiff }); })); // FIXME: Not reuse?!
        return UpdateResult(__assign({}, prog, { env: newEnv, node: newNode, diffs: newDiffs }), prog);
    };
}
// Update.js is generated by Update.ts
function getUpdateAction(prog, updateData) {
    /*if(prog.node.update) { // In case there is a custom update procedure available.
      return prog.node.update{prog, diff};
    }*/
    var Syntax = syntax.Syntax || esprima.Syntax;
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
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
                    var newNode = new Node.Literal(oldNode.wsBefore, updateData.newVal, uneval_(updateData.newVal)); // TODO: What about string diffs?
                    return UpdateResult(__assign({}, prog, { node: newNode, diffs: DDNewNode(newNode) }), prog);
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
                return UpdateFail("Don't know how to handle this kind of diff on arrays: " + diff.kind.ctor);
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
        return formatUpdateResult(UpdateContinue({ context: [], env: env, node: oldNode }, { newVal: newVal, oldVal: oldVal, diffs: diffs }));
    };
}
function formatUpdateResult(updateAction, callbacks, forks) {
    var updated = processUpdateAction(updateAction, callbacks, forks);
    return resultCase(updated, function (x) { return Err(x); }, function (progWithAlternatives) {
        var uResult = {
            env: progWithAlternatives.prog.env,
            node: progWithAlternatives.prog.node.unparse(),
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
