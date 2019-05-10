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
    return { values: undefined, computations: { head: { ctor: ComputationType.Node, env: env, node: initNode }, tail: undefined } };
}
var __globalThisName__ = "global";
function initEnv() {
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    return { head: // Global 'this' object available
        { name: __globalThisName__,
            value: { ctor: ValueType.Ref, name: __globalThisName__ } },
        tail: undefined };
}
// Equivalent of:
//     const this = {}
// Heap used once in initEnv, and another time in initStack
// Perhaps we should consider just rewriting the initial program?
function initHeap() {
    var _a;
    return _a = {}, _a[__globalThisName__] = { ctor: ValueType.Obj, value: {} }, _a;
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
//     {__with__: X} for overrides of the previous value with X
//     {__clone__: Path} for of the previous value with the given path
//     name: X if the name was not present already in the object
//   For reuses:
//     true to just return the entire object
//     {__reuse__: true} to reuse all children not touched by overrides fields
function copy(object, overrides, reuses) {
    if (typeof overrides == "object") {
        if ("__with__" in overrides) {
            return overrides.__with__;
        }
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
                    if (typeof newEntry === "object" && newEntry !== null && "__with__" in newEntry) // Just in case it was described as an override
                        newEntry = newEntry.__with__;
                    model[k] = newEntry;
                }
            }
        }
        return model;
    }
    return object;
}
// Returns true if obj1 and obj2 are deeply equal. Careful: Do not provide cyclic inputs !
function areEqual(obj1, obj2) {
    if (typeof obj1 !== typeof obj2)
        return false;
    if (obj1 === null || obj2 === null)
        return obj1 === obj2;
    switch (typeof obj1) {
        case "object":
            var isArray1 = Array.isArray(obj1);
            if (isArray1 != Array.isArray(obj2))
                return false;
            if (isArray1) {
                if (obj1.length != obj2.length)
                    return false;
                for (var k = 0; k < obj1.length; k++) {
                    if (!areEqual(obj1[k], obj2[k]))
                        return false;
                }
                return true;
            }
            else {
                if (!areEqual(Object.keys(obj1), Object.keys(obj2)))
                    return false;
                for (var k in obj1) {
                    if (!areEqual(obj1[k], obj2[k]))
                        return false;
                }
                return true;
            }
        default:
            return obj1 === obj2;
    }
}
var DType;
(function (DType) {
    DType["Update"] = "Update";
    DType["Merge"] = "Merge"; // Only for reverse diffs
})(DType || (DType = {}));
;
var DUType;
(function (DUType) {
    DUType["Reuse"] = "Reuse";
    DUType["NewValue"] = "NewValue";
})(DUType || (DUType = {}));
;
var idPath = { up: 0, down: undefined };
function isIdPath(p) {
    return p.up === 0 && typeof p.down === "undefined";
}
function DDMerge() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return [{ ctor: DType.Merge, diffs: args }];
}
function DReuse(childDiffs, path) {
    if (path === void 0) { path = idPath; }
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
    return {
        ctor: DType.Update,
        path: path,
        kind: { ctor: DUType.Reuse },
        children: filteredChildDiffs
    };
}
function DDReuse(childDiffs, path) {
    if (path === void 0) { path = idPath; }
    return [DReuse(childDiffs, path)];
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
            return diff.ctor === DType.Update && isIdPath(diff.path) ?
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
            return diff.ctor === DType.Update && isIdPath(diff.path) ?
                copy(diff, {
                    children: (_a = {},
                        _a[name] = diffUpdater(diff.children[name]),
                        _a)
                }, { __reuse__: true }) : diff;
        });
    }
    else {
        if (name.length === 0)
            return diffUpdater(diffs);
        return DDMap(name[0], diffs, function (d) { return DDMap(name.slice(1), d, diffUpdater); });
    }
}
function DDrop(diffs, length) {
    if (length <= 0)
        return diffs;
    var candidates = diffs.map(function (diff) {
        return diff.ctor === DType.Update && isIdPath(diff.path) ?
            typeof diff.children.tail != "undefined" ?
                DDrop(diff.children.tail, length - 1) :
                DDSame()
            : undefined;
    });
    return array_flatten(candidates);
}
function DDNewValue(newVal) {
    return [{ ctor: DType.Update, path: idPath, kind: { ctor: DUType.NewValue, model: newVal }, children: {} }];
}
function DDNewObject(children, model, path) {
    if (model === void 0) { model = {}; }
    if (path === void 0) { path = idPath; }
    return [{ ctor: DType.Update, path: path, kind: { ctor: DUType.NewValue, model: model }, children: children }];
}
function DDNewArray(length, children) {
    return [{ ctor: DType.Update, path: idPath, kind: { ctor: DUType.NewValue, model: Array(length) }, children: children }];
}
function DDNewNode(model, children) {
    if (children === void 0) { children = {}; }
    return [{ ctor: DType.Update, path: idPath, kind: { ctor: DUType.NewValue, model: model }, children: children }];
}
function DDClone(path, children) {
    if (children === void 0) { children = {}; }
    return [{
            ctor: DType.Update,
            path: (typeof path == "string" ? { up: 0, down: { head: path, tail: undefined } } :
                Array.isArray(path) ? { up: 0, down: List.fromArray(path) } :
                    Array.isArray(path.down) ? { up: path.up, down: List.fromArray(path.down) } : path),
            kind: { ctor: DUType.Reuse }, children: children
        }];
}
function DDSame() {
    return [{ ctor: DType.Update, path: idPath, kind: { ctor: DUType.Reuse }, children: {} }];
}
function DDMapDownPaths(mapper, diffs) {
    return diffs.map(function (diff) {
        return diff.ctor == DType.Update && diff.path.up === 0 ?
            copy(diff, { path: { down: { __with__: mapper(diff.path.down) } } }, { __reuse__: true }) :
            diff;
    });
}
function isDDSame(diffs) {
    if (diffs.length != 1)
        return false;
    var diff = diffs[0];
    if (diff.ctor !== DType.Update || !isIdPath(diff.path))
        return false;
    if (diff.kind.ctor != DUType.Reuse)
        return false;
    return Object.keys(diff.children).length == 0;
}
function insertionCompatible(diffs) {
    if (typeof diffs == "undefined")
        return false; // Means the "undefined" is the final value in the array.
    return arrayAll(diffs, function (diff) {
        return diff.ctor === DType.Update && (diff.kind.ctor == DUType.NewValue &&
            arrayAll(Object.keys(diff.children), function (key) { return insertionCompatible(diff.children[key]); }) ||
            isSimpleChildClone(diff));
    });
}
// Merges two diffs made on the same object.
function mergeDiffs(diffs1, diffs2) {
    //console.log("mergeDiffs(\n" + uneval_(diffs1, "") + ",\n " + uneval_(diffs2, "") + ")")
    if (isDDSame(diffs1))
        return diffs2;
    if (isDDSame(diffs2))
        return diffs1;
    var result = [];
    var _loop_1 = function (id1) {
        var diff1 = diffs1[id1];
        if (diff1.ctor !== DType.Update)
            return "continue";
        var _loop_2 = function (id2) {
            var diff2 = diffs2[id2];
            if (diff2.ctor !== DType.Update)
                return "continue";
            if (isIdPath(diff1.path) && isIdPath(diff2.path)) {
                if (diff1.kind.ctor == DUType.Reuse && diff2.kind.ctor == DUType.Reuse) {
                    var c1 = diff1.children;
                    var c2 = diff2.children;
                    var resultingChildren = {};
                    for (var k in c1) {
                        var merged = void 0;
                        if (k in c2) {
                            merged = mergeDiffs(c1[k], c2[k]);
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
                    result.push({ ctor: DType.Update, path: idPath, kind: { ctor: DUType.Reuse }, children: resultingChildren });
                    return "continue";
                }
                if (diff1.kind.ctor == DUType.NewValue && diff2.kind.ctor == DUType.NewValue &&
                    Array.isArray(diff1.kind.model) && Array.isArray(diff2.kind.model)) {
                    // Two array that have changed. We treat modified children that are new as insertions so that we can merge them in one way or the other. This works only if all children are either clones or new values, and the model does not contain built-in values
                    if (arrayAll(diff1.kind.model, function (x, i) { return typeof x === "undefined" && insertionCompatible(diff1.children[i]); }) &&
                        arrayAll(diff2.kind.model, function (x, i) { return typeof x === "undefined" && insertionCompatible(diff2.children[i]); })) {
                        // All keys are described by Clone or New Children.
                        var groundTruthOf = function (diff) {
                            var result = [];
                            for (var k in diff.children) {
                                result.push(diff.children[k]);
                            }
                            return result;
                        };
                        var cloneIndexOf_1 = function (ds) {
                            if (ds.length == 1) {
                                var d = ds[0];
                                if (d.ctor == DType.Update && d.path.up == 0 && List.length(d.path.down) == 1) {
                                    return Number(d.path.down.head);
                                }
                            }
                            return undefined;
                        };
                        var insertionsDeletionsOf = function (groundTruth) {
                            // Find the elements in sequence, record elements that were deleted.
                            var deleted = {};
                            var insertedAfter = {};
                            var lastIncludedIndex = -1;
                            for (var k = 0; k < groundTruth.length; k++) {
                                var ds = groundTruth[k];
                                var dPath = cloneIndexOf_1(ds);
                                if (typeof dPath == "number" && lastIncludedIndex < dPath) {
                                    while (lastIncludedIndex < dPath) {
                                        lastIncludedIndex++;
                                        if (lastIncludedIndex < dPath) {
                                            deleted[lastIncludedIndex] = true;
                                        }
                                    }
                                    continue;
                                }
                                insertedAfter[lastIncludedIndex] = insertedAfter[lastIncludedIndex] || [];
                                insertedAfter[lastIncludedIndex].push(ds);
                            }
                            return { deleted: deleted, insertedAfter: insertedAfter };
                        };
                        var doInsert = function (solutionFiltered, insertedAfter) {
                            // Now we insert
                            toInsert: for (var indexAfterWhichToInsert in insertedAfter) {
                                var ip = +indexAfterWhichToInsert;
                                var diffssToInsert = insertedAfter[indexAfterWhichToInsert];
                                for (var k = 0; k < solutionFiltered.length; k++) {
                                    var ci = cloneIndexOf_1(solutionFiltered[k]);
                                    if (typeof ci == "number" && ci >= ip) { // TODO: We could list every possible insertion as well.
                                        solutionFiltered.splice.apply(// TODO: We could list every possible insertion as well.
                                        solutionFiltered, [k + 1, 0].concat(diffssToInsert));
                                        continue toInsert;
                                    }
                                }
                                solutionFiltered.push.apply(solutionFiltered, diffssToInsert);
                            }
                        };
                        var arrayDiffOf = function (dss) {
                            var model = Array(dss.length);
                            var children = {};
                            for (var i = 0; i < model.length; i++) {
                                model[i] = undefined;
                                children[i] = dss[i];
                            }
                            return { ctor: DType.Update, path: idPath, kind: { ctor: DUType.NewValue, model: model }, children: children };
                        };
                        var filterFromDeletion = function (solution, deleted) {
                            // Filter out only the first element of each kind.
                            var prevDeleted = -1;
                            return solution.filter(function (ds, k) {
                                var c = cloneIndexOf_1(ds);
                                if (typeof c === "number" && c > prevDeleted) {
                                    prevDeleted = c;
                                    return deleted[c + ""] !== true;
                                }
                                return true;
                            });
                        };
                        var solution1 = groundTruthOf(diff1);
                        var _a = insertionsDeletionsOf(solution1), insertedAfter1 = _a.insertedAfter, deleted1 = _a.deleted;
                        var solution2 = groundTruthOf(diff2);
                        var _b = insertionsDeletionsOf(solution2), insertedAfter2 = _b.insertedAfter, deleted2 = _b.deleted;
                        var solution1Filtered = filterFromDeletion(solution1, deleted2);
                        var solution2Filtered = filterFromDeletion(solution2, deleted1);
                        doInsert(solution1Filtered, insertedAfter2);
                        doInsert(solution2Filtered, insertedAfter1);
                        var d1 = arrayDiffOf(solution1Filtered);
                        var d2 = arrayDiffOf(solution2Filtered);
                        if (areEqual(d1, d2))
                            return { value: [d1] };
                        return { value: [d1, d2] };
                    }
                }
                if (diff2.kind.ctor == DUType.NewValue) {
                    // If there is a {ctor: DType.Clone, path: [], diffs: DSame()} below, we can merge it with the current diffs.
                    var c2 = diff2.children;
                    var resultingChildren = {};
                    for (var k in c2) {
                        var merged = mergeDiffs([diff1], c2[k]);
                        resultingChildren[k] = merged;
                    }
                    result.push({ ctor: DType.Update, path: idPath, kind: { ctor: DUType.NewValue, model: diff2.kind.model }, children: resultingChildren });
                }
                if (diff1.kind.ctor == DUType.NewValue) {
                    // If there is a {ctor: DType.Clone, path: [], diffs: DSame()} below, we can merge it with the current diffs.
                    var c1 = diff1.children;
                    var resultingChildren = {};
                    for (var k in c1) {
                        var merged = mergeDiffs(c1[k], [diff2]);
                        resultingChildren[k] = merged;
                    }
                    result.push({ ctor: DType.Update, path: idPath, kind: { ctor: DUType.NewValue, model: diff1.kind.model }, children: resultingChildren });
                }
            }
            else { // One of them is a clone, so an entire replacement. Clones discard other changes.
                var doDiffs = function (diff1, diff2) {
                    if (!isIdPath(diff1.path)) {
                        if (List.length(diff1.path.down) === 1 &&
                            diff1.path.up === 0 &&
                            isIdPath(diff2.path) && diff2.kind.ctor == DUType.Reuse) { // Particular case when the part we are cloning was moved somewhere else.
                            var down = diff1.path.down;
                            var subDiffs2 = diff2.children[down.head]; // What happened in diff2 to the element we are cloning from in diff1?
                            if (subDiffs2.length === 1) {
                                var subDiff2 = subDiffs2[0];
                                if (subDiff2.ctor === DType.Update && !isIdPath(subDiff2.path) && subDiff2.path.up === 1) {
                                    var children = copy(subDiff2.children, {}, { __reuse__: true });
                                    for (var k in diff1.children) {
                                        if (k in children) {
                                            children[k] = mergeDiffs(children[k], diff1.children[k]);
                                        }
                                        else {
                                            children[k] = diff1.children[k];
                                        }
                                    }
                                    result.push({ ctor: DType.Update, path: { up: 0, down: subDiff2.path.down }, kind: { ctor: DUType.Reuse }, children: children });
                                    return;
                                }
                            }
                        }
                        result.push(diff1);
                    }
                };
                doDiffs(diff1, diff2);
                if (!isIdPath(diff2.path)) {
                    // If same clone, we discard
                    if (!isIdPath(diff1.path) && areEqual(diff1.path, diff2.path)) {
                        return "continue";
                    }
                    doDiffs(diff2, diff1);
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
function walkPath(obj, context, path, diffs) {
    if (diffs === void 0) { diffs = false; }
    var up = path.up;
    var c = context;
    var o = obj;
    while (up) {
        if (typeof c == undefined) {
            console.log(path);
            console.log(context);
            console.log(obj);
            throw "walk outside of context in applyDiffs";
        }
        o = c.head;
        c = c.tail;
        up--;
    }
    var down = path.down;
    while (typeof down !== "undefined") {
        if (typeof o !== "object") {
            console.log(path);
            console.log(context);
            console.log(o);
            throw "Clone outside of range in applyDiffs";
        }
        c = cons_(o, c);
        o = diffs ? o[0].children[down.head] : o[down.head];
        down = down.tail;
    }
    return [o, c];
}
// Given an object and a VSA of diffs on in, returns a VSA of the updated object (i.e. each property is wrapped with an array)
function applyDiffs(obj, diffs, context) {
    if (context === void 0) { context = undefined; }
    var _a;
    var result = [];
    for (var _i = 0, diffs_1 = diffs; _i < diffs_1.length; _i++) {
        var diff = diffs_1[_i];
        if (diff.ctor === DType.Update) {
            var children = diff.children;
            var oneResult = void 0;
            var c = void 0;
            _a = walkPath(obj, context, diff.path), obj = _a[0], c = _a[1];
            if (diff.kind.ctor === DUType.Reuse) {
                oneResult = typeof obj === "object" ? Array.isArray(obj) ? [] : {} : obj;
                for (var k in obj) {
                    if (!(k in children)) {
                        oneResult[k] = [obj[k]];
                    }
                }
            }
            else {
                oneResult = copy(diff.kind.model);
            }
            for (var k in children) {
                var ds = children[k];
                oneResult[k] = applyDiffs(diff.kind.ctor == DUType.Reuse ? obj[k] : obj, ds, diff.kind.ctor == DUType.Reuse ? cons_(obj, c) : c);
            }
            result.push(oneResult);
        } // Merge cannot be applied at this point.
    }
    return result;
}
// Given a VSA, returns all its elements in linear order. Should be fine for most purposes
function enumerateDirect(vsa, result) {
    if (result === void 0) { result = []; }
    for (var _i = 0, vsa_1 = vsa; _i < vsa_1.length; _i++) {
        var vsaEntry = vsa_1[_i];
        if (typeof vsaEntry === "object") {
            var keys = Object.keys(vsaEntry);
            if (keys.length == 0) {
                result.push(Array.isArray(vsaEntry) ? [] : {});
                continue;
            }
            var hKey = keys[0];
            var vsaWithoutHeadKey = copy(vsaEntry, {}, { __reuse__: true }); // Copy the object, keeps children refs.
            delete vsaWithoutHeadKey[hKey];
            var hValues = enumerateDirect(vsaEntry[hKey]);
            for (var _a = 0, _b = enumerateDirect([vsaWithoutHeadKey]); _a < _b.length; _a++) {
                var tValue = _b[_a];
                for (var _c = 0, hValues_1 = hValues; _c < hValues_1.length; _c++) {
                    var hValue = hValues_1[_c];
                    var tmpResult = copy(tValue, {}, { __reuse__: true });
                    tmpResult[hKey] = hValue;
                    result.push(tmpResult);
                }
            }
        }
        else {
            result.push(vsaEntry);
        }
    }
    return result;
}
// Same as applyDiffs but returns the first result (composition of enumerateDirect and applyDiffs)
function applyDiffs1(obj, diffs, context) {
    if (context === void 0) { context = undefined; }
    var _a;
    var result;
    for (var _i = 0, diffs_2 = diffs; _i < diffs_2.length; _i++) {
        var diff = diffs_2[_i];
        //console.log("applyDiffs1(\n" + uneval_(obj, "") + "\n, \n" + uneval_(diff, "") + "\n, \n" + uneval_(context, "") + "\n") 
        if (diff.ctor === DType.Update) {
            var children = diff.children;
            var up = diff.path.up;
            var c = void 0;
            _a = walkPath(obj, context, diff.path), obj = _a[0], c = _a[1];
            if (diff.kind.ctor === DUType.Reuse) {
                result = typeof obj == "object" ? Array.isArray(obj) ? [] : {} : obj;
                for (var k in obj) {
                    if (!(k in children)) {
                        result[k] = obj[k];
                    }
                }
            }
            else {
                result = copy(diff.kind.model);
            }
            for (var k in children) {
                var ds = children[k];
                result[k] = applyDiffs1(diff.kind.ctor == DUType.Reuse ? obj[k] : obj, ds, diff.kind.ctor == DUType.Reuse ? cons_(obj, c) : c);
            }
        } // Merge cannot be applied at this point.
        //console.log("= \n" + uneval_(result))
        break; // only the first result matters
    }
    return result;
}
// Takes a default model, and refines it by adding the clone (diff) at the given path (down)
function addToDefaultModel(down, diff, defaultModels) {
    var d = defaultModels[0];
    if (typeof down === "undefined") {
        if (d.ctor == DType.Update && d.kind.ctor == DUType.NewValue && Object.keys(d.children).length == 0) {
            // Just overwrite the existing value here.
            defaultModels.pop();
            defaultModels.push(diff);
        }
        else if (d.ctor == DType.Update && d.kind.ctor == DUType.Reuse && Object.keys(d.children).length == 0) { // Existing clone
            var existing = defaultModels.pop();
            defaultModels.push({ ctor: DType.Merge, diffs: [[existing], [diff]] });
        }
        else if (d.ctor == DType.Merge) {
            d.diffs.push([diff]);
        }
        else {
            console.log(uneval_(defaultModels, ""));
            console.log(uneval_(down, ""));
            console.log(uneval_(diff, ""));
            throw "Unexpected diff for addToDefaultModel";
        }
    }
    else if (d.ctor === DType.Update && d.kind.ctor === DUType.NewValue) {
        var k = down.head;
        if (!(k in d.children)) {
            d.children[k] = DDNewObject({}, d.kind.model[k]);
            d.kind.model[k] = undefined;
        }
        addToDefaultModel(down.tail, diff, d.children[k]);
    }
    else {
        throw "Diff not supported for addToDefaultModel: " + uneval_(diff, "");
    }
}
// applyDiffs1(applyDiffs1(obj, diffs), reverseDiffs(obj, diffs)) = obj
function reverseDiffs(obj, diffs, context) {
    if (context === void 0) { context = undefined; }
    var defaultModels = DDNewObject({}, copy(obj)); // The reverse diffs that just output obj. We are going to modify it.
    var diff = diffs[0];
    // Let's find all children or sub-children that can be recovered from the diffs.
    function aux(diff, context, // Context in the original program
    subContext // context in the sub program
    ) {
        if (context === void 0) { context = undefined; }
        if (subContext === void 0) { subContext = undefined; }
        if (diff.ctor !== DType.Update)
            return;
        if (diff.path.up !== 0 || typeof diff.path.down !== "undefined") {
            // It's a clone. We'll walk the path to find where to insert the inverse clone in the defaultModels
            var pathFromTop = List.reverseInsert(List.drop(subContext, diff.path.up), diff.path.down);
            addToDefaultModel(pathFromTop, { ctor: DType.Update, path: { up: 0, down: List.reverseInsert(undefined, context) }, kind: { ctor: DUType.Reuse }, children: {} }, defaultModels);
        }
        else {
            for (var k in diff.children) {
                var subDiff = diff.children[k][0];
                aux(subDiff, diff.kind.ctor == DUType.Reuse ? cons_(k, context) : context, cons_(k, subContext));
            }
        }
    }
    aux(diff);
    return defaultModels;
}
function applyHorizontalDiffs(diffs, hDiffs) {
    var results = [];
    for (var i = 0; i < hDiffs.length; i++) {
        var hDiffs1 = hDiffs[i];
        if (hDiffs1.ctor == DType.Update) {
            if (hDiffs1.kind.ctor == DUType.NewValue) {
                var children = {};
                for (var k in hDiffs1.children) {
                    children[k] = applyHorizontalDiffs(diffs, hDiffs1.children[k]);
                }
                results.push(DReuse(children));
            }
            else if (hDiffs1.kind.ctor == DUType.Reuse && (hDiffs1.path.up === 0 || typeof hDiffs1.path.down != "undefined")) {
                var _a = walkPath(diffs, undefined, hDiffs1.path, /*diffs=*/ true), targetDiffs = _a[0], context = _a[1];
                results.push.apply(results, targetDiffs);
            }
            else {
                console.log(uneval_(hDiffs1, ""));
                throw "Unsupported horizontal diffs (only clones and news are supported). See console";
            }
        }
        else { // Merge of several diffs
            var dds = hDiffs1.diffs;
            var acc = applyHorizontalDiffs(diffs, dds[0]);
            for (var i_1 = 1; i_1 < dds.length; i_1++) {
                acc = mergeDiffs(acc, applyHorizontalDiffs(diffs, dds[i_1]));
            }
            results.push.apply(results, acc);
        }
    }
    return results;
}
// Composes two Diffs into a single Diffs. Diffs cannot be merge diffs for now.
function composeDiffs(diffs1, diffs2) {
    if (isDDSame(diffs1))
        return diffs2;
    if (isDDSame(diffs2))
        return diffs1;
    var aux = function (diffs1, diffs1context, diffs2) {
        var targetDiffs1 = diffs1;
        var targetDiffs1Context = diffs1context;
        var diff2 = diffs2[0];
        if (diff2.path.up !== 0 || typeof diff2.path.down !== "undefined") {
            var _a = walkPath(diffs1, diffs1context, diff2.path, /*diffs=*/ true), targetDiffs1_1 = _a[0], targetDiffs1Context_1 = _a[1];
        }
        if (diff2.kind.ctor == DUType.Reuse) {
            var diff1 = targetDiffs1[0];
            var ctor = diff1.ctor; // If the first diff was a Reuse or a NewValue, it stays the same.
            var composedDiffs = {};
            var model = diff1.kind.ctor === DUType.NewValue ? copy(diff1.kind.model) : {};
            for (var k in diff2.children) {
                var sub2diff = diff2.children[k];
                if (k in diff1.children) {
                    composedDiffs[k] = aux(diff1.children[k], cons_(targetDiffs1, targetDiffs1Context), diff2.children[k]);
                    model[k] = undefined;
                }
                else if (diff1.kind.ctor === DUType.NewValue) {
                    if (typeof diff1.kind.model == "object" && (k in diff1.kind.model)) {
                        composedDiffs[k] = aux(DDNewObject({}, diff1.kind.model[k]), cons_(targetDiffs1, targetDiffs1Context), diff2.children[k]);
                        model[k] = undefined;
                    }
                    else { // The key that diff2 references is not valid.
                        console.log(uneval_(diffs1, "") + "\ncannot be composed with\n" + uneval_(diffs2, ""));
                        console.log("The second diffs refers to field '" + k + "' which is not present in the old DNewValue.");
                        throw "Diff Composition error -- See console.";
                    }
                }
                else if (diff1.kind.ctor === DUType.Reuse) { // then k is composed with identity
                    composedDiffs[k] = diff2.children[k];
                }
            }
            if (diff2.kind.ctor == DUType.Reuse && diff1.kind.ctor == DUType.NewValue && typeof diff1.kind.model === "object") {
                for (var k in diff1.kind.model) {
                    if (!(k in model))
                        model[k] = diff1.kind.model[k];
                }
            }
            var kind = diff1.kind.ctor == DUType.Reuse ? diff1.kind : { ctor: DUType.NewValue, model: model };
            return [{ ctor: ctor, path: diff1.path, kind: kind, children: composedDiffs }];
        }
        else { // New value overrides the previous one.
            var newChildren = {};
            for (var k in diff2.children) {
                newChildren[k] = aux(targetDiffs1, targetDiffs1Context, diff2.children[k]);
            }
            return [copy(diff2, { children: { __with__: newChildren } }, { __reuse__: true })];
        }
    };
    return aux(diffs1, undefined, diffs2);
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
// TODO: Incorporate custom path map.
function processClone(prog, newVal, oldVal, diff, callback) {
    var Syntax = syntax.Syntax || esprima.Syntax;
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    if (diff.path.up <= prog.context.length) {
        var oldNode = prog.stack.computations.head.node;
        var toClone = diff.path.up == 0 ? oldNode : prog.context[diff.path.up - 1];
        var nodePathDown = List.builder();
        var downPath = diff.path.down;
        while (typeof downPath !== "undefined") { // We map down path elems to AST
            var downpathelem = downPath.head;
            if (toClone && toClone.type == Syntax.ArrayExpression && typeof toClone.elements[downpathelem] != "undefined") {
                nodePathDown.append("elements");
                nodePathDown.append(downpathelem);
                toClone = toClone.elements[downpathelem];
            }
            else
                return UpdateFail("Cloning path not supported for " + downpathelem + " on " + (toClone ? toClone.type : " empty path"));
            downPath = downPath.tail;
        }
        if (Object.keys(diff.children).length == 0 && diff.kind.ctor == DUType.Reuse) {
            return UpdateResult(copy(prog, { stack: { computations: { head: { node: { __with__: copy(toClone) } } } } }, { __reuse__: true }), DDChild(["stack", "computations", "head", "node"], DDClone({ up: diff.path.up, down: nodePathDown.build() })), prog, callback);
        }
        else {
            return UpdateContinue(copy(prog, { stack: { computations: { head: { node: { __with__: copy(toClone) } } } } }, { __reuse__: true }), { newVal: newVal, oldVal: oldVal, diffs: [{ ctor: DType.Update, path: idPath, kind: diff.kind, children: diff.children }] }, callback || UpdateResult);
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
    for (var _i = 0, diffs_3 = diffs; _i < diffs_3.length; _i++) {
        var diff = diffs_3[_i];
        if (diff.ctor == DType.Merge) {
            newDiffs.push(diff);
            continue;
        }
        if (!isIdPath(diff.path)) {
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
        newDiffs.push(copy(diff, { children: { __with__: newChildrenDiffs } }, { __reuse__: true }));
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
        if (diff.ctor === DType.Merge) {
            return UpdateFail("Cannot process clones if diff is DMerge");
        }
        if (!isIdPath(diff.path)) {
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
        walkNode(x, preCall, postCall, cons_(x, level));
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
                var r = walkNode(x_1, preCall, postCall, cons_(x_1, level));
                if (typeof r !== "undefined")
                    return r;
            }
        }; };
        var rChild = function (sub) { return function (node, preCall, postCall, level) {
            var child = node[sub];
            if (typeof child !== "undefined")
                return walkNode(child, preCall, postCall, cons_(sub, level));
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
                    var x = rFun(node, preCall, postCall, level);
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
    if (typeof x === "object" && x.type === "return")
        return x.value;
    if (node !== null && x !== "avoid-children") {
        var walker = walkers[node.type];
        if (typeof walker === "function") {
            var x_2 = walker(node, preCall, postCall, level);
            if (typeof x_2 !== "undefined")
                return x_2;
        }
    }
    var y = postCall ? postCall(node, level) : undefined;
    if (typeof y !== "undefined")
        return y;
}
// Returns a rewriting Diffs (single-value) for a given body after moving declarations.
// [a list of declarations that will allocate a heap reference -- initially filled with "undefined" (no declarations if declarations = false),
// a list of definitions that have to be hoisted (e.g. function definitions)]
function hoistedDeclarationsDefinitions(body, declarations) {
    if (declarations === void 0) { declarations = true; }
    var Syntax = syntax.Syntax || esprima.Syntax;
    var localVars = {};
    var localDefinitions = {};
    var Node = typeof Node == "undefined" ? esprima.Node : Node;
    walkNodes(body, function (node, level) {
        // We hoist variable declarations
        if (declarations && node.type === Syntax.VariableDeclaration && node.kind === "var") {
            for (var _i = 0, _a = node.declarations; _i < _a.length; _i++) {
                var declaration = _a[_i];
                if (declaration.id.type === Syntax.Identifier) {
                    localVars[declaration.id.name] =
                        new Node.VariableDeclaration("\n", [new Node.VariableDeclarator(declaration.id, " ", null)
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
                    DDNewObject({}, new Node.VariableDeclaration("\n", [new Node.VariableDeclarator(fd.id, " ", null)
                    ], [], "let", ";"));
            }
            if (typeof level.tail == "undefined") { // Top-level definitions.
                localDefinitions[fd.id.name] =
                    DDNewObject({ right: DDReuse({ type: DDNewValue(Syntax.FunctionExpression) }, { up: 0, down: level }) }, new Node.AssignmentExpression(" ", "=", fd.id, new Node.Import("")));
            }
        }
        // We ignore declarations inside functions.
        if (node.type === Syntax.FunctionDeclaration || node.type === Syntax.FunctionExpression)
            return "avoid-children";
    });
    var newModel = [];
    for (var k = 0; k < body.length; k++) {
        newModel[k] = DDClone({ up: 0, down: cons_(k + "", undefined) });
    }
    for (var defi in localDefinitions) {
        newModel.unshift(localDefinitions[defi]);
    }
    for (var decl in localVars) {
        newModel.unshift(localVars[decl]);
    }
    return newModel;
}
function reverseArray(arr) {
    var newArray = [];
    for (var i = arr.length - 1; i >= 0; i--) {
        newArray.push(arr[i]);
    }
    return newArray;
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
    console.log("original prog");
    console.log(uneval_(prog, ""));
    var rewriteModel_subprog = copy(prog);
    console.log("rewrite model");
    console.log(uneval_(model_subProg, "")); /**/
    var subProg = applyDiffs1(prog, model_subProg);
    /**/
    console.log("Rewritten program");
    console.log(uneval_(subProg, "")); /**/
    return UpdateContinue(subProg, updateData, function (uSubProg, subDiffs, subProg) {
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
    if (currentComputation.ctor === ComputationType.Node) {
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
                var bodyModelDiff = hoistedDeclarationsDefinitions(script.body, /*declarations*/ true);
                bodyModelDiff = bodyModelDiff.map(function (nodeModel, i) {
                    return i === 0 ? DDNewObject({ node: DDMapDownPaths(function (p) { return cons_("head", cons_("node", cons_("body", p))); }, nodeModel), env: DDClone(["head", "env"]) }, { ctor: ComputationType.Node, node: undefined, env: undefined }) :
                        DDNewObject({ node: DDMapDownPaths(function (p) { return cons_("head", cons_("node", cons_("body", p))); }, nodeModel) }, { ctor: ComputationType.Node, node: undefined });
                });
                var bodyModelListDiffs = DDClone(["tail"]);
                for (var i = bodyModelDiff.length - 1; i >= 0; i--) {
                    bodyModelListDiffs = DDNewObject({ head: bodyModelDiff[i], tail: bodyModelListDiffs });
                }
                // Now we insert each node of bodyModel as a new computation
                var progModel = DDReuse({ stack: DDReuse({ computations: bodyModelListDiffs }) });
                return UpdateRewrite(prog, progModel, updateData);
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
                    for (var _i = 0, _b = reverseArray(varDecls.declarations); _i < _b.length; _i++) {
                        var decl = _b[_i];
                        if (typeof decl.id.name !== "string")
                            return UpdateFail("TODO - Implement me (complex patterns)");
                        var newRef = uniqueRef(decl.id.name); // TODO: 
                        newHeap = copy(newHeap, (_a = {}, _a[newRef] = { __with__: {
                                ctor: HeapValueType.Raw,
                                value: undefined
                            }
                        }, _a), { __reuse__: true });
                        newEnv = cons_({ name: decl.id.name,
                            value: { ctor: ValueType.Ref, name: newRef }
                        }, newEnv);
                    }
                    // Now rewrite all initializations as assignments.
                    for (var _c = 0, _d = reverseArray(varDecls.declarations); _c < _d.length; _c++) {
                        var decl = _d[_c];
                        var rewrittenNode = new Node.AssignmentExpression(decl.wsBeforeEq, "=", decl.id, decl.init === null ? decl.id : decl.init);
                        rewrittenNode.wsBefore = decl.wsBefore;
                        rewrittenNode.wsAfter = decl.wsAfter;
                        remainingComputations_1 = { head: { ctor: ComputationType.Node, env: env, node: rewrittenNode }, tail: remainingComputations_1 };
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
                    for (var _e = 0, _f = reverseArray(varDecls.declarations); _e < _f.length; _e++) {
                        var decl = _f[_e];
                        var rewrittenNode = new Node.AssignmentExpression(decl.wsBeforeEq, "=", decl.id, decl.init === null ? decl.id : decl.init);
                        rewrittenNode.wsBefore = decl.wsBefore;
                        rewrittenNode.wsAfter = decl.wsAfter;
                        remainingComputations_1 = { head: { ctor: ComputationType.Node, env: env, node: rewrittenNode }, tail: remainingComputations_1 };
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
                    remainingComputations_1 = { head: { ctor: ComputationType.Node, env: env, node: expStatement.expression }, tail: remainingComputations_1 };
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
                    ctor: ComputationType.Node,
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
                  stack: { head: {ctor: ComputationType.Node, env: updatedEnv, node: oldNode}
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
                        if (diff.ctor === DType.Update && !isIdPath(diff.path)) {
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
    return UpdateFail("Reversion does not support this current stack element: " + currentComputation.ctor);
}
// Find all paths from complexVal to simpleVal if complexVal contains simpleVal
function allClonePaths_(complexVal, simpleVal) {
    if (uneval_(simpleVal) === uneval_(complexVal))
        return [{ up: 0, down: undefined }];
    if (typeof complexVal == "object") {
        var diffs = [];
        var _loop_3 = function (k) {
            diffs.push.apply(diffs, allClonePaths_(complexVal[k], simpleVal).map(function (p) {
                p.down = cons_(k, p.down);
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
    return d.ctor == DType.Update && d.path.up === 0 && List.length(d.path.down) == 1;
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
                childDiffs[key] = DDClone(key);
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
                diffs.push.apply(diffs, DDClone(clonePaths[c]));
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
                diffs.push.apply(diffs, DDClone(unwrappingPaths[c]));
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