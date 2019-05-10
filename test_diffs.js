var tests = 0;
var testsPassed = 0;

function assertEqual(x1, x2, name) {
  tests++;
  var s1 = uneval_(x1, "");
  var s2 = uneval_(x2, "");
  if(s1 == s2) {
    testsPassed++;
  } else {
    console.log((name ? name + ": " : "") + "Expected\n" + s2 + "\n, got \n" + s1);
  }
}

/*
assertEqual(
  mergeDiffs(DDReuse({0: DDNewValue(3)}), DDReuse({1: DDNewValue(4)})),
  DDReuse({0: DDNewValue(3), 1: DDNewValue(4)}), "Multiple elements updated independently in array or object");

assertEqual(
  mergeDiffs(DDNewObject({tail: DDSame()}, {head: 1, tail: undefined}), DDNewObject({tail: DDSame()}, {head: 2, tail: undefined})
  ),
  DDNewObject({tail: DDNewObject({tail: DDSame()}, {head: 1, tail: undefined})}, {head: 2, tail: undefined}).concat(
    DDNewObject({tail: DDNewObject({tail: DDSame()}, {head: 2, tail: undefined})}, {head: 1, tail: undefined})
  )
  , "Two insertions in empty list"
);

assertEqual(
  mergeDiffs(DDNewObject({0: DDNewValue(1)}, [undefined]),
    DDNewObject({0: DDNewValue(2)}, [undefined])),
  DDNewObject({0: DDNewValue(1), 1: DDNewValue(2)}, [undefined, undefined]).concat(
    DDNewObject({0: DDNewValue(2), 1: DDNewValue(1)}, [undefined, undefined])
  ),
  "Two insertions in empty array/object"
);


assertEqual(
  mergeDiffs(DDReuse({0: DDClone({up: 1, down: ["1"]}), 1: DDClone({up: 1, down: ["0"]})}),
    DDNewObject({0: DDClone(["0"]), 1: DDClone(["1"]), 2: DDClone(["1"])}, [undefined, undefined, undefined])
  ),
  DDNewObject({0: DDClone(["1"]), 1: DDClone(["0"]), 2: DDClone(["0"])}, [undefined, undefined, undefined])
  ,
  "One swap and a clone of last element on a 2-element array"
);


assertEqual(
  mergeDiffs(DDNewObject({0: DDClone(["1"]), 1: DDClone(["0"])}, [undefined, undefined]),
    DDNewObject({0: DDClone(["0"]), 1: DDClone(["1"]), 2: DDClone(["0"])}, [undefined, undefined, undefined])
  ),
  DDNewObject({0: DDClone(["1"]), 1: DDClone(["0"]), 2: DDClone(["0"])}, [undefined, undefined, undefined])
  ,
  "One swap and a clone of first element on a 2-element array"
);


*/

/*
(function () {
  let prog = {a: { b: 1}, c: [2, 2], d: 3}
  let model = DDReuse(
    {a: DDClone({up: 1, down: ["c"]}), c: DDClone({up: 1, down: ["a", "b"]}), d: DDClone({up: 1, down: ["c"]})});
  let reverseModelExpected =
        DDNewObject({
          c: DDMerge(DDClone({up: 0, down: ["a"]}), DDClone({up: 0, down: ["d"]})),
          a: DDNewObject({b: DDClone({up: 0, down: ["c"]})}, {b: undefined}),
          }, {a: undefined, c: undefined, d: 3})
  let subProg = {a: [2, 2], c: 1, d: [2, 2]};
  assertEqual(applyDiffs1(prog, model), subProg);
  assertEqual(reverseDiffs(prog, model), reverseModelExpected);
  let uSubProg = {a: [3, 2], c: 4, d: [2, 5]};
  let uSubDiffs = DDReuse({a: DDReuse({0: DDNewValue(3)}), c: DDNewValue(4), d: DDReuse({1: DDNewValue(5)})});
  let expectedProg = {a: { b: 4}, c: [3, 5], d: 3}
  let expectedDiffs = DDReuse({c: DDReuse({0: DDNewValue(3), 1: DDNewValue(5)}), a: DDReuse({b: DDNewValue(4)}), });
  assertEqual(
    applyHorizontalDiffs(uSubDiffs, reverseModelExpected),
    expectedDiffs);
})()
//*/

(function() {
  let diff1 = DDNewValue(1);
  let diff2 = DDNewObject({a: DDSame()}, {a: undefined});
  let d1d2 = composeDiffs(diff1, diff2);
  let d2d1 = composeDiffs(diff2, diff1);
  assertEqual(applyDiffs1(2, diff1), 1);
  assertEqual(applyDiffs1(1, diff2), {a: 1}); 
  assertEqual(applyDiffs1(2, d1d2), {a: 1});
  assertEqual(d1d2, DDNewObject({a: DDNewValue(1)}, {a: undefined}), "d1d2");
  assertEqual(d2d1, diff1, "d2d1");
  let diff3 = DDReuse({b: DDNewValue(1)}, {up: 0, down: cons_("a", undefined)});
  let diff4 = DDReuse({a: DDNewObject({c: DDSame()}, {b: 2, c: undefined})});
  let d3d4 = composeDiffs(diff3, diff4);
  let d4d3 = composeDiffs(diff4, diff3);
  assertEqual(d3d4,
    DDReuse({b: DDNewValue(1), a: DDNewObject({c: DDSame()}, {b: 2, c: undefined})}, {up: 0, down: cons_("a", undefined)}), "d3d4");
  assertEqual(d4d3, DDNewObject({c: DDSame(), b: DDNewValue(1)}, {b: undefined, c: undefined}), "d4d3")
})()

console.log(testsPassed + "/" + tests + " passed");
if(testsPassed !== tests) {
  console.log((tests - testsPassed) + " tests failed");
} else {
  console.log("All tests passed");
}