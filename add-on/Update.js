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
var ValueType;
(function (ValueType) {
    ValueType["Raw"] = "Raw";
    ValueType["Ref"] = "Ref";
    ValueType["Fun"] = "Fun";
    ValueType["Obj"] = "Obj";
    ValueType["Arr"] = "Arr";
})(ValueType || (ValueType = {}));
var ComputationType;
(function (ComputationType) {
    //Argument = "Argument", // next argument to compute
    ComputationType["Call"] = "Call";
    ComputationType["Assign"] = "Assign";
    ComputationType["MaybeDeref"] = "MaybeDeref";
    ComputationType["FunctionEnd"] = "FunctionEnd";
    //Primitive = "Primitive",
    ComputationType["Node"] = "Node"; // When processed, before adding to stack, adds the env to the next NodeWithoutEnv in the stack.
})(ComputationType || (ComputationType = {}));
function initStack(env, initNode) {
    return { values: undefined, computations: { head: { tag: ComputationType.Node, env: env, node: initNode }, tail: undefined } };
}
var __globalThisName__ = "global";
function initEnv() {
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    return { head: // Global 'this' object available
        { name: __globalThisName__,
            value: { tag: ValueType.Ref, name: __globalThisName__ } },
        tail: undefined };
}
// Equivalent of:
//     const this = {}
// Heap used once in initEnv, and another time in initStack
// Perhaps we should consider just rewriting the initial program?
function initHeap() {
    var _a;
    return _a = {}, _a[__globalThisName__] = { tag: ValueType.Obj, value: {} }, _a;
}
// Converts a node/environment to an initial program
function initProg(node, env) {
    if (env === void 0) { env = initEnv(); }
    return { context: [], stack: initStack(env, node), heap: initHeap() };
}
var uniqueID = 0;
function uniqueRef(name) {
    return name + (uniqueID++);
}
// Deep clones an object.
// Possibility to provide overrides and reuses
//   as nested objects where leaves are
//   For overrides:
//     {__with__: X} for overrides
//     name: X if the name was not present already in the object
//   For reuses:
//     true to just return the entire object
//     {__reuse__: true} to reuse all children not touched by overrides fields
function copy(object, overrides, reuses) {
    if (typeof overrides == "object" && ("__with__" in overrides)) {
        return overrides.__with__;
    }
    if (typeof reuses == "boolean" && reuses === true) {
        return object;
    }
    if (typeof overrides == "undefined" && typeof reuses == "object" && ("__reuse__" in reuses)) {
        return object;
    }
    if (typeof object == "object") {
        var model = void 0;
        if (Array.isArray(object)) {
            model = [];
        }
        else {
            model = {};
        }
        for (var k in object) {
            model[k] =
                copy(object[k], typeof overrides == "object" ? overrides[k] : undefined, typeof reuses == "object" ? ("__reuse__" in reuses ? reuses : reuses[k]) : undefined);
        }
        if (typeof overrides == "object") {
            for (var k in overrides) {
                if (k !== "__with__" && !(k in object)) {
                    var newEntry = overrides[k];
                    if ("__with__" in newEntry) // Just in case it was described as an override
                        newEntry = newEntry.__with__;
                    model[k] = newEntry;
                }
            }
        }
        return model;
    }
    return object;
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
    var existSame = false;
    for (var cd in childDiffs) {
        if (isDDSame(childDiffs[cd])) {
            existSame = true;
            break;
        }
    }
    var filteredChildDiffs;
    if (existSame) {
        filteredChildDiffs = {};
        for (var cd in childDiffs) {
            if (!isDDSame(childDiffs[cd])) {
                filteredChildDiffs[cd] = childDiffs[cd];
            }
        }
    }
    else {
        filteredChildDiffs = childDiffs;
    }
    // Do some filtering on childDiffs, remove DDSame
    return [{
            ctor: DType.Update,
            kind: { ctor: DUType.Reuse },
            children: filteredChildDiffs
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
function DDExtract(name, diffs) {
    if (typeof name === "string") {
        return array_flatten(diffs.map(function (diff) {
            return diff.ctor === DType.Update ?
                diff.kind.ctor === DUType.Reuse ?
                    diff.children[name] || DDSame()
                    : undefined
                : undefined;
        }));
    }
    else {
        if (name.length == 0)
            return diffs;
        return DDExtract(name.slice(1), DDExtract(name[0], diffs));
    }
}
function DDMap(name, diffs, diffUpdater) {
    if (typeof name === "string") {
        return diffs.map(function (diff) {
            var _a;
            return diff.ctor === DType.Update ?
                copy(diff, {
                    children: (_a = {},
                        _a[name] = diffUpdater(diff.children[name]),
                        _a)
                }, { __reuse__: true }) : diff;
        });
    }
    else {
        if (name.length == 0)
            return diffUpdater(diffs);
        return DDMap(name[0], diffs, function (d) { return DDMap(name.slice(1), d, diffUpdater); });
    }
}
function DDrop(diffs, length) {
    if (length <= 0)
        return diffs;
    var candidates = diffs.map(function (diff) {
        return diff.ctor == DType.Update ?
            typeof diff.children.tail != "undefined" ?
                DDrop(diff.children.tail, length - 1) :
                DDSame()
            : undefined;
    });
    return array_flatten(candidates);
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
function isDDSame(diffs) {
    if (diffs.length != 1)
        return false;
    var diff = diffs[0];
    if (diff.ctor != DType.Update)
        return false;
    if (diff.kind.ctor != DUType.Reuse)
        return false;
    return Object.keys(diff.children).length == 0;
}
function insertionCompatible(diffs) {
    if (typeof diffs == "undefined")
        return false; // Means the "undefined" is the final value in the array.
    return arrayAll(diffs, function (diff) {
        return diff.ctor == DType.Clone ||
            diff.ctor == DType.Update && diff.kind.ctor == DUType.NewValue &&
                arrayAll(Object.keys(diff.children), function (key) { return insertionCompatible(diff.children[key]); });
    });
}
// Merges two diffs made on the same object.
function DDMerge(diffs1, diffs2) {
    //console.log("DDMerge(\n" + uneval_(diffs1, "") + ",\n " + uneval_(diffs2, "") + ")")
    if (isDDSame(diffs1))
        return diffs2;
    if (isDDSame(diffs2))
        return diffs1;
    var result = [];
    var _loop_1 = function (id1) {
        var diff1 = diffs1[id1];
        var _loop_2 = function (id2) {
            var diff2 = diffs2[id2];
            if (diff1.ctor == DType.Update && diff2.ctor == DType.Update) {
                if (diff1.kind.ctor == DUType.Reuse && diff2.kind.ctor == DUType.Reuse) {
                    var c1 = diff1.children;
                    var c2 = diff2.children;
                    var resultingChildren = {};
                    for (var k in c1) {
                        var merged = void 0;
                        if (k in c2) {
                            merged = DDMerge(c1[k], c2[k]);
                        }
                        else {
                            merged = c1[k];
                        }
                        resultingChildren[k] = merged;
                    }
                    for (var k in c2) {
                        if (!(k in resultingChildren)) {
                            resultingChildren[k] = c2[k];
                        }
                    }
                    result.push({ ctor: DType.Update, kind: { ctor: DUType.Reuse }, children: resultingChildren });
                    return "continue";
                }
                if (diff1.kind.ctor == DUType.NewValue && diff2.kind.ctor == DUType.NewValue &&
                    Array.isArray(diff1.kind.model) && Array.isArray(diff2.kind.model)) {
                    // Two array that have changed. We treat modified children that are new as insertions so that we can merge them in one way or the other. This works only if all children are either clones or new values, and the model does not contain built-in values
                    if (arrayAll(diff1.kind.model, function (x, i) { return typeof x === "undefined" && insertionCompatible(diff1.children[i]); }) &&
                        arrayAll(diff2.kind.model, function (x, i) { return typeof x === "undefined" && insertionCompatible(diff2.children[i]); })) {
                        // All keys are described by Clone or New Children.
                        // We just need to concatenate them.
                        var l1 = diff1.kind.model.length;
                        var l2 = diff2.kind.model.length;
                        var newModel = Array(l1 + l2);
                        for (var i = 0; i < l1 + l2; i++)
                            newModel[i] = undefined;
                        var newChildren1 = copy(diff1.children);
                        for (var i = 0; i < l2; i++) {
                            newChildren1[i + l1] = diff2.children[i];
                        }
                        var newChildren2 = copy(diff2.children);
                        for (var i = 0; i < l1; i++) {
                            newChildren2[i + l2] = diff1.children[i];
                        }
                        return { value: [{ ctor: DType.Update, kind: { ctor: DUType.NewValue, model: newModel }, children: newChildren1 },
                                { ctor: DType.Update, kind: { ctor: DUType.NewValue, model: newModel }, children: newChildren2 },
                            ] };
                    }
                }
                if (diff2.kind.ctor == DUType.NewValue) {
                    // If there is a {ctor: DType.Clone, path: [], diffs: DSame()} below, we can merge it with the current diffs.
                    var c2 = diff2.children;
                    var resultingChildren = {};
                    for (var k in c2) {
                        var merged = DDMerge([diff1], c2[k]);
                        resultingChildren[k] = merged;
                    }
                    result.push({ ctor: DType.Update, kind: { ctor: DUType.NewValue, model: diff2.kind.model }, children: resultingChildren });
                }
                if (diff1.kind.ctor == DUType.NewValue) {
                    // If there is a {ctor: DType.Clone, path: [], diffs: DSame()} below, we can merge it with the current diffs.
                    var c1 = diff1.children;
                    var resultingChildren = {};
                    for (var k in c1) {
                        var merged = DDMerge(c1[k], [diff2]);
                        resultingChildren[k] = merged;
                    }
                    result.push({ ctor: DType.Update, kind: { ctor: DUType.NewValue, model: diff1.kind.model }, children: resultingChildren });
                }
            }
            else { // One of them is a clone, so an entire replacement. Clones discard other changes.
                if (diff1.ctor == DType.Clone) {
                    result.push(diff1);
                }
                if (diff2.ctor == DType.Clone) {
                    // If same clone, we discard
                    if (diff1.ctor == DType.Clone && diff1.path.up === diff2.path.up && diff1.path.down.join(" ") === diff2.path.down.join(" ")) {
                        return "continue";
                    }
                    result.push(diff2);
                }
            }
        };
        for (var id2 = 0; id2 < diffs2.length; id2++) {
            var state_2 = _loop_2(id2);
            if (typeof state_2 === "object")
                return state_2;
        }
    };
    for (var id1 = 0; id1 < diffs1.length; id1++) {
        var state_1 = _loop_1(id1);
        if (typeof state_1 === "object")
            return state_1.value;
    }
    return result;
}
function model_list_drop(length) {
    var tmp = [];
    while (length > 0) {
        tmp.push("tail");
    }
    return { __clone__: tmp };
}
function model_list_toArray(initPath, length, mapPath) {
    var model = [];
    var path = initPath.slice(0);
    while (length > 0) {
        var p = path.concat("head");
        if (typeof mapPath !== "undefined")
            p = p.concat(mapPath);
        model.push({ __clone__: p });
        path.push("tail");
        length - 1;
    }
    return model;
}
// Given an object-only model with {__clone__: ...} references to the object,
// and the diffs of the new object, builds the value and the diffs associated to the model
function DDRewrite(model, obj, diffs) {
    if (typeof model === "object") {
        if (typeof model.__clone__ === "string" || Array.isArray(model.__clone__)) {
            var ds = DDExtract(model.__clone__, diffs);
            var x = obj;
            var path = typeof model.__clone__ === "string" ? [model.__clone__] : model.__clone__;
            for (var i = 0; i < path.length; i++) {
                x = x[path[i]];
            }
            return [x, ds];
        }
        // Regular object
        var finalValue = Array.isArray(model) ? [] : {};
        var childDiffs = {};
        for (var k in model) {
            var ds = model[k];
            var _a = DDRewrite(model[k], obj, diffs), childValue = _a[0], childDiffs_1 = _a[1];
            finalValue[k] = childValue;
            childDiffs_1[k] = childDiffs_1;
        }
        var finalDiffs = DDReuse(childDiffs);
        return [finalValue, finalDiffs];
    }
    else {
        console.log(model);
        throw "DDRewrite called with non-object as a model";
    }
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
function UpdateResult(p, d, oldP, c) {
    return { ctor: UType.Result, newProg: p, diffs: d, oldProg: oldP, callback: c };
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
            action = callbacks.pop()(action.newProg, action.diffs, action.oldProg);
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
    return Ok({ prog: action.newProg, diffs: action.diffs, alternatives: forks });
}
function isDSame(diffs) {
    return diffs.length === 1 && diffs[0].ctor === DType.Update && diffs[0].kind === DUType.Reuse && diffs[0].children.length === 0;
}
// TODO: Incorporate custom path map.
function processClone(prog, newVal, oldVal, diff, callback) {
    var Syntax = syntax.Syntax || esprima.Syntax;
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    if (diff.path.up <= prog.context.length) {
        var oldNode = prog.stack.computations.head.node;
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
            return UpdateResult(copy(prog, { stack: { computations: { head: { node: { __with__: copy(toClone) } } } } }, { __reuse__: true }), DDChild(["stack", "head", "node"], DDClone({ up: diff.path.up, down: nodePathDown }, DDSame())), prog, callback);
        }
        else {
            return UpdateContinue(copy(prog, { stack: { computations: { head: { node: { __with__: copy(toClone) } } } } }, { __reuse__: true }), { newVal: newVal, oldVal: oldVal, diffs: diff.diffs }, callback || UpdateResult);
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
        var oldNode = prog.stack.computations.head.node;
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
                return UpdateResult(copy(prog, { stack: { computations: { head: { node: { __with__: newChildVal } } } } }, { __reuse__: true }), DDChild(["stack", "head", "node"], valToNodeDiffs_(newChildVal)), prog);
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
                return updateForeach(prog.stack.computations.head.env, Object.keys(updateData.newVal), function (k) { return function (callback) {
                    var newChildVal = updateData.newVal[k];
                    var childDiff = diffToConsider_1.children[k];
                    if (typeof childDiff == "undefined") {
                        var newChildNode = valToNode_(newChildVal);
                        var newChildNodeDiffs = valToNodeDiffs_(newChildVal);
                        return UpdateResult(copy(prog, { stack: { computations: { head: { node: { __with__: newChildNode } } } } }, { __reuse__: true }), DDChild(["stack", "head", "node"], newChildNodeDiffs), prog, callback);
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
            return callbackIterator(elem, i)(function (newProg, diffs, oldProg) {
                var mergedEnv = mergeUpdatedEnvs(envSoFar, newProg.stack.computations.head.env)._0;
                return aux(mergedEnv, nodesSoFar.concat(newProg.stack.computations.head.node), diffsSoFar.concat(diffs), i + 1);
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
        return UpdateResult(copy(prog, { stack: { head: { node: { __with__: newNode },
                    env: { __with__: newEnv } } } }, { __reuse__: true }), DDChild(["stack", "head", "node"], newDiffs), prog);
    };
}
function objectGather(prog, keys, newNode, newDiffs) {
    return function (newEnv, newNodes, newNodesDiffs) {
        keys.map(function (key, k) {
            newNode.properties.push(keyValueToProperty(key, newNodes[k]));
        });
        newDiffs[0].children.properties = DDReuse(newNodesDiffs.map(function (newNodeDiff) { return DDReuse({ value: newNodeDiff }); })); // FIXME: Not reuse?!
        return UpdateResult(copy(prog, { stack: { head: { node: { __with__: newNode },
                    env: { __with__: newEnv } } } }, { __reuse__: true }), DDChild(["stack", "head", "node"], newDiffs), prog);
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
            _a[Syntax.DebuggerStatement] = null,
            _a[Syntax.DoWhileStatement] = combine(rBody, "test"),
            _a[Syntax.EmptyStatement] = null,
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
            _a[Syntax.LogicalExpression] = rBinary,
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
// A rewrite model is either {__clone__: clone path} or
// an object or array whose values are models.
// In the forward direction, a model demonstrates how to build the new value
// A reverse rewrite model is either {__reverseClone__: clone path[]} or an object or array whose values are reverse rewrite models.
// In the backward direction, a model prevents modifications made to non-cloned nodes, and merges modifications made to nodes that were cloned several times.
// Modify the reverseModel on place
function apply_model(obj, model, modelPath, reverseModel) {
    if (typeof model == "object") {
        if ("__clone__" in model) {
            var c = model.__clone__;
            if (typeof c === "string") {
                return apply_model(obj, { __clone__: [c] }, modelPath, reverseModel);
            }
            else if (Array.isArray(c)) {
                var result = obj;
                var rTmp = reverseModel;
                for (var i = 0; i < c.length; i++) {
                    result = result[c[i]];
                    if (i < c.length - 1)
                        rTmp = rTmp[c[i]];
                }
                var toReplace = rTmp[c[c.length - 1]];
                if (typeof toReplace !== "object" || !("__reverseClone__" in toReplace)) {
                    rTmp[c[c.length - 1]] = ({ __reverseClone__: [modelPath] });
                }
                else {
                    toReplace.__reverseClone__.push(modelPath);
                }
                return result;
            }
            else {
                console.log(c);
                throw "__clone__ should be a string or an array, got something else. See console.";
            }
        }
        // Regular objects
        var finalValue = Array.isArray(model) ? [] : {};
        for (var k in model) {
            var childValue = apply_model(obj, model[k], modelPath.concat([k]), reverseModel);
            finalValue[k] = childValue;
        }
        return finalValue;
    }
    return model;
}
/*
prog: {a: { b: 1}, c: [2, 2], d: 3}
model: {a: {__clone__: "c"}, c: {__clone__: ["a", "b"]}, d: {__clone__: "c"}}
reverseModel: {a: {b: {__clone__: "c"}}, c: {__clone__: "a", __clone__2: "d"}, d: 3}
subProg: {a: [2, 2], c: 1, d: [2, 2]}
uSubProg: {a: [3, 2], c: 4, d: [2, 5]}
uSubDiffs: DDReuse({a: DDReuse({0: DDNewValue(3)}), c: DDNewValue(4), d: DDReuse({1: DDNewValue(5)})})
Expected uProg: {a: {b: 4}, c: [3, 5], d: 3}
Expected uDiffs: DDReuse({a: DDReuse({b: DDNewValue(4)}), c: DDReuse({0: DDNewValue(3), 1: DDNewValue(5)}))

*/
function update_model(model, reverseModel, uSubProg, uSubDiffs, callback) {
    // Let's reverse the sub-prog and sub-diffs, recover the prog and recover the diffs.
    console.log(model);
    console.log(reverseModel);
    console.log(uSubProg);
    console.log(uSubDiffs);
    throw "Implement me: update_model";
}
function UpdateRewrite(prog, model_subProg, updateData) {
    var rewriteModel_subprog = copy(prog);
    var subProg = apply_model(prog, model_subProg, [], rewriteModel_subprog);
    return;
    UpdateContinue(subProg, updateData, function (uSubProg, subDiffs, subProg) {
        return update_model(model_subProg, rewriteModel_subprog, uSubProg, subDiffs, function (uProg, uDiffs) { return UpdateResult(uProg, uDiffs, prog); });
    });
}
// Update.js is generated by Update.ts
function getUpdateAction(prog, updateData) {
    var _a;
    /*if(prog.node.update) { // In case there is a custom update procedure available.
      return prog.node.update{prog, diff};
    }*/
    var Syntax = syntax.Syntax || esprima.Syntax;
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    if (!prog.stack) { // Nothing to update, something must be wrong.
        return UpdateFail("Cannot update empty stack. What's wrong?");
    }
    var stack = prog.stack;
    var computations = stack.computations;
    var currentComputation = computations.head;
    console.log("currentComputation");
    console.log(currentComputation);
    if (currentComputation.tag === ComputationType.Node) {
        var oldNode_1 = currentComputation.node;
        if (!("env" in currentComputation)) {
            console.log(prog);
            return UpdateFail("[Internal Error] Environment not found at this point. See console for more details.");
        }
        var env = currentComputation.env;
        var remainingComputations_1 = computations.tail; // Pops the computations
        switch (oldNode_1.type) {
            case Syntax.Program:
                var script = oldNode_1;
                var _b = hoistedDeclarationsDefinitions(script.body, /*declarations*/ true), declarations = _b[0], definitions = _b[1];
                /*
                let model_subBody = hoistDeclarations(script.body, true);
                let model_subRemainingComputations = ...model_subBody__;
                let model_subProg = ...model_subRemainingComputations...;
                
                return UpdateRewrite(prog, model_subProg, updateData);
                
                
                let isFirst = true;
                // The last computation will be to
                remainingComputations = cons_(
                  { tag: ComputationType.FunctionEnd }, remainingComputations);
                for(let statement of reverseArray(declarations.concat(definitions.concat(script.body)))) {
                  remainingComputations =
                    cons_({tag: ComputationType.Node, node: statement}, remainingComputations);
                  if(isFirst) {
                    remainingComputations.head.returnedExpressionStatement = true;
                    isFirst = false;
                  }
                }
                remainingComputations = { head: {...remainingComputations.head, env: env}, tail: remainingComputations };
                let subProg = {...prog, stack: {values: stack.values, computations: remainingComputations};
                return UpdateContinue(subProg, updateData,
                  function(updatedSubProg: Prog, subDiffs: diffs, subProg: Prog):UpdateAction {
                    if(definitions.length > 0) {
                      console.log(updatedSubProg.stack.computations.head);
                      return UpdateFail("TODO: Implement me (Program with hoisted definitions)");
                      // We cannot skip definitions, we need to merge them at the correct place.
                    }
                    let uStack = updatedSubProg.stack;
                    let m1 = model_list_toArray(
                      model_list_drop(declarations.length + definitions.length).__clone__, script.body.length, "node")
                    );
                    let [recoveredBody, recoveredBodyDiffs] =
                      DDRewrite(m1, updatedSubProg, subDiffs);
                    DDRewrite
                    return UpdateResult({...updatedSubProg,
                      stack: updatedStackFinal},
                      updatedDiffsWithoutDeclarations, prog);
                    // TODO: Reconstruct the original modified program here and its diff
                  });*/
                throw "Finish me (Script update)";
            case Syntax.AssignmentExpression:
                return UpdateFail("TODO - Implement me (AssignmentExpression)");
            case Syntax.VariableDeclaration:
                var varDecls = oldNode_1;
                var isLet = varDecls.kind === "let";
                if (isLet || varDecls.kind === "const") {
                    // TODO: Duplicate the effect of each let so that it first declares the variables
                    // and then assign them. Else no recursion possible!
                    //const = introduce environment variables
                    //let = will wrap these environment variables by references.
                    //No need to compute value at this point.
                    var newEnv = env;
                    var newHeap = prog.heap;
                    var isFirst = true;
                    // First allocate a reference in the environemnt pointing to nothing.
                    for (var _i = 0, _c = reverseArray(varDecls.declarations); _i < _c.length; _i++) {
                        var decl = _c[_i];
                        if (typeof decl.id.name !== "string")
                            return UpdateFail("TODO - Implement me (complex patterns)");
                        var newRef = uniqueRef(decl.id.name); // TODO: 
                        newHeap = copy(newHeap, (_a = {}, _a[newRef] = { __with__: {
                                tag: HeapValueType.Raw,
                                value: undefined
                            }
                        }, _a), { __reuse__: true });
                        newEnv = cons_({ name: decl.id.name,
                            value: { tag: ValueType.Ref, name: newRef }
                        }, newEnv);
                    }
                    // Now rewrite all initializations as assignments.
                    for (var _d = 0, _e = reverseArray(varDecls.declarations); _d < _e.length; _d++) {
                        var decl = _e[_d];
                        var rewrittenNode = new Node.AssignmentExpression(decl.wsBeforeEq, "=", decl.id, decl.init === null ? decl.id : decl.init);
                        rewrittenNode.wsBefore = decl.wsBefore;
                        rewrittenNode.wsAfter = decl.wsAfter;
                        remainingComputations_1 = { head: { tag: ComputationType.Node, env: env, node: rewrittenNode }, tail: remainingComputations_1 };
                    }
                    if (typeof remainingComputations_1 !== "undefined") {
                        // We propagate the environment to the next stack element
                        remainingComputations_1 = copy(remainingComputations_1, { head: { env: { __with__: newEnv } } }, { __reuse__: true });
                    }
                    var subProg = copy(prog, { stack: { computations: { __with__: remainingComputations_1 } } }, { __reuse__: true });
                    return UpdateContinue(subProg, updateData, function (uSubProg, subDiffs, subProg) {
                        return UpdateFail("TODO: Implement me (let/const)");
                        // TODO: Recover definitions and the program shape.
                    });
                }
                else if (varDecls.kind === "var") {
                    //var = just unroll as variable assignments
                    for (var _f = 0, _g = reverseArray(varDecls.declarations); _f < _g.length; _f++) {
                        var decl = _g[_f];
                        var rewrittenNode = new Node.AssignmentExpression(decl.wsBeforeEq, "=", decl.id, decl.init === null ? decl.id : decl.init);
                        rewrittenNode.wsBefore = decl.wsBefore;
                        rewrittenNode.wsAfter = decl.wsAfter;
                        remainingComputations_1 = { head: { tag: ComputationType.Node, env: env, node: rewrittenNode }, tail: remainingComputations_1 };
                    }
                    var subProg = copy(prog, { stack: { computations: remainingComputations_1 } }, { __reuse__: true });
                    return UpdateContinue(subProg, updateData, function (uSubProg, subDiffs, prog) {
                        throw "TODO: Implement me (var)";
                        // TODO: Reconstruct program and diffs from rewriting
                    });
                }
                else
                    return UpdateFail("Unknown variable declaration kind: " + varDecls.kind);
            case Syntax.ExpressionStatement:
                // We compute heap modifications. Only if currentComputation marked with returnedExpressionStatement = true can we propagate updateData to the expression.
                // propagate environment to the next statement
                if (typeof remainingComputations_1 !== "undefined") {
                    remainingComputations_1 = copy(remainingComputations_1, { head: { env: { __with__: env } } }, { __reuse__: true });
                }
                var expStatement = oldNode_1;
                if (currentComputation.returnedExpressionStatement) {
                    // Add the expression to the stack.
                    remainingComputations_1 = { head: { tag: ComputationType.Node, env: env, node: expStatement.expression }, tail: remainingComputations_1 };
                    var subProg = copy(prog, { stack: { __with__: remainingComputations_1 } }, { __reuse__: true });
                    return UpdateContinue(subProg, updateData, function (uSubProg, subDiffs, prog) {
                        var updatedNode = new Node.ExpressionStatement(uSubProg.stack.computations.head.node, oldNode_1.semicolon);
                        updatedNode.wsBefore = oldNode_1.wsBefore;
                        updatedNode.wsAfter = oldNode_1.wsAfter;
                        var updateDiffs = DDMap(["stack", "head", "node"], subDiffs, function (d) { return DDChild("expression", d); });
                        return UpdateResult(copy(prog, { stack: { computations: { head: { node: { __with__: updatedNode } } } } }, { __reuse__: true }), updateDiffs, prog);
                    });
                }
                else {
                    throw "TODO: Implement me (ExpressionStatement)";
                    /*
                    // No back-propagation at this point. We just move on but the heap is now a reference in case we need it.
                    let subProg = {...prog,
                      heap: // TODO
                      ,
                    stack: remainingComputations};
                    return UpdateContinue(subProg, updateData,
                    function(uSubProg: Prog, subDiffs: Diffs, prog: Prog):UpdateAction {
                      // TODO: Reconstruct Expression statement and diffs.
                      throw "TODO: Implement me (ExpressionStatement)"
                    });*/
                }
            case Syntax.Literal: // Literals can be replaced by clones
                // TODO: Make sure this is correct. Make the stack to work.
                return processClones(prog, updateData, function (diff) {
                    var newDiffs = DDChild(["stack", "head", "node", "value"], DDNewValue(updateData.newVal)); // TODO: What about string diffs?
                    var newNode = copy(oldNode_1);
                    newNode.value = updateData.newVal;
                    return UpdateResult(copy(prog, { stack: { computations: { head: { node: { __with__: newNode } }, tail: { __with__: remainingComputations_1 } } } }), newDiffs, prog);
                });
            case Syntax.Identifier:
                throw "TODO: Identifier";
            // Updates the environment, or the heap.
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
            /*
            let id = oldNode as Node.Identifier;
            let name = id.name;
            // Either in environment, or replace by global.name.
            let relevantEnv = env;
            console.log(env.head);
            let moreRecentUntouchedEnv: Env = undefined;
            while(relevantEnv && relevantEnv.head.name !== name) {
              moreRecentUntouchedEnv = { head: relevantEnv.head, tail: moreRecentUntouchedEnv };
              relevantEnv = relevantEnv.tail;
            }
            if(!relevantEnv) {
              throw "TODO: Implement me (global identifier)";
            }
            let binding = relevantEnv.head.value;
            let varProg: Prog = {
              context: [], // We do not consider the context where the variable is used.
              stack: {
                values:
                computations: {
                  head: {
                    tag: ComputationType.Node,
                    env: binding.env,
                    node: binding.expr
                  },
                  tail: remainingComputations}
                }
              heap: binding.heap
            }
            return UpdateContinue(varProg, updateData,
              function(updatedVarProg, varProg) {
                let [updatedBinding, updatedBindingDiffs]: [ComputationSource, Diffs] =
                  DDRewrite(
                    {env: {__clone__: ["stack", "head", "env"]},
                     expr: {__clone__: ["stack", "head", "node"]},
                     heap: {__clone__: ["heap"]}
                     }, updatedVarProg, updatedVarProg.diffs
                  );
                let updatedEnv =
                  List.reverseInsert(moreRecentUntouchedEnv,
                  {head: {name: name, value: updatedBinding}, tail: relevantEnv.tail});
                let updatedEnvDiffs =
                  DDChild(array_repeat("tail", List.length(moreRecentUntouchedEnv)).concat(
                    ["head", "value"]), updatedBindingDiffs);
                let updatedDiffs: Diffs =
                  DDReuse({head: DDChild("env", updatedEnvDiffs),
                           tail: DDExtract(["stack", "tail"], updatedVarProg.diffs)});
                return UpdateResult({
                  context: prog.context,
                  stack: { head: {tag: ComputationType.Node, env: updatedEnv, node: oldNode}
                         , tail: updatedVarProg.stack.tail},
                  heap: prog.heap,
                  diffs: updatedDiffs
                }, prog);
              });
            throw "TODO: Implement me (local identifier)";
            */
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
                            var newNode = new Node.Literal(oldNode_1.wsBefore, updateData.newVal, uneval_(updateData.newVal)); // TODO: What about string diffs?
                            return UpdateResult(copy(prog, { stack: { computations: {
                                        head: { node: { __with__: newNode } }
                                    } } }, { __reuse__: true }), DDChild(["stack", "computations", "head", "node"], DDNewNode(newNode)), prog);
                        }
                    }));
                }
                return processClones(prog, updateData, function (diff) {
                    var elements = oldNode_1.elements;
                    var newNode;
                    var newDiffs;
                    if (diff.kind.ctor === DUType.Reuse) {
                        newNode = copy(oldNode_1);
                        newDiffs = DDReuse({ elements: DDSame() });
                        return updateForeach(prog.stack.computations.head.env, elements, function (element, k) { return function (callback) {
                            return typeof diff.children[k] != "undefined" ?
                                UpdateContinue(copy(prog, { context: { __with__: [oldNode_1].concat(prog.context) },
                                    stack: { computations: { head: { node: { __with__: element } } } } }, { __reuse__: true }), { newVal: updateData.newVal[k],
                                    oldVal: updateData.oldVal[k],
                                    diffs: diff.children[k] }, callback) :
                                UpdateResult(prog, DDSame(), prog, callback);
                        }; }, arrayGather(prog, newNode, newDiffs));
                    }
                    else {
                        return UpdateFail("Don't know how to handle this kind of diff on arrays: " + diff.kind.ctor);
                    }
                });
            default:
                return UpdateFail("Reversion does not currently support nodes of type " + oldNode_1.type);
        }
    }
    return UpdateFail("Reversion does not support this current stack element: " + currentComputation.tag);
}
// Find all paths from complexVal to simpleVal if complexVal contains simpleVal
function allClonePaths_(complexVal, simpleVal) {
    if (uneval_(simpleVal) === uneval_(complexVal))
        return [{ up: 0, down: [] }];
    if (typeof complexVal == "object") {
        var diffs = [];
        var _loop_3 = function (k) {
            diffs.push.apply(diffs, allClonePaths_(complexVal[k], simpleVal).map(function (p) {
                p.down.unshift(k);
                return p;
            }));
        };
        for (var k in complexVal) {
            _loop_3(k);
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
        var _loop_4 = function () {
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
            _loop_4();
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
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    var updated = processUpdateAction(updateAction, callbacks, forks);
    return resultCase(updated, function (x) { return Err(x); }, function (progWithAlternatives) {
        var headNode = progWithAlternatives.prog.stack.computations.head;
        var uResult = {
            env: headNode.env,
            node: Node.unparse(headNode),
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