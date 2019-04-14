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
  DDMerge(DDReuse({0: DDNewValue(3)}), DDReuse({1: DDNewValue(4)})),
  DDReuse({0: DDNewValue(3), 1: DDNewValue(4)}), "Multiple elements updated independently in array or object");

assertEqual(
  DDMerge(DDNewObject({tail: DDSame()}, {head: 1, tail: undefined}), DDNewObject({tail: DDSame()}, {head: 2, tail: undefined})
  ),
  DDNewObject({tail: DDNewObject({tail: DDSame()}, {head: 1, tail: undefined})}, {head: 2, tail: undefined}).concat(
    DDNewObject({tail: DDNewObject({tail: DDSame()}, {head: 2, tail: undefined})}, {head: 1, tail: undefined})
  )
  , "Two insertions in empty list"
);

assertEqual(
  DDMerge(DDNewObject({0: DDNewValue(1)}, [undefined]),
    DDNewObject({0: DDNewValue(2)}, [undefined])),
  DDNewObject({0: DDNewValue(1), 1: DDNewValue(2)}, [undefined, undefined]).concat(
    DDNewObject({0: DDNewValue(2), 1: DDNewValue(1)}, [undefined, undefined])
  ),
  "Two insertions in empty array/object"
);
assertEqual(
  DDMerge(DDReuse({0: DDClone({up: 1, down: [1]}), 1: DDClone({up: 1, down: [0]})}, [undefined, undefined]),
    DDNewObject({0: DDClone([0]), 1: DDClone([1]), 2: DDClone([1])}, [undefined, undefined, undefined])
  ),
  DDNewObject({0: DDClone([1]), 1: DDClone([0]), 2: DDClone([1])}, [undefined, undefined, undefined])
  ,
  "One swap and a clone of last element on a 2-element array"
);
//*/

assertEqual(
  DDMerge(DDNewObject({0: DDClone([1]), 1: DDClone([0])}, [undefined, undefined]),
    DDNewObject({0: DDClone([0]), 1: DDClone([1]), 2: DDClone([0])}, [undefined, undefined, undefined])
  ),
  DDNewObject({0: DDClone([1]), 1: DDClone([0]), 2: DDClone([0])}, [undefined, undefined, undefined])
  ,
  "One swap and a clone of first element on a 2-element array"
);

/*
(function () {
  let prog = {a: { b: 1}, c: [2, 2], d: 3}
  let model = {a: {__clone__: "c"}, c: {__clone__: ["a", "b"]}, d: {__clone__: "c"}};
  let reverseModelExpected = {a: {b: {__reverseClone__: [["c"]]}}, c: {__reverseClone__: [["a"], ["d"]]}, d: 3}
  let subProg = {a: [2, 2], c: 1, d: [2, 2]}
  //let uSubProg: {a: [3, 2], c: 4, d: [2, 5]}
  let reverseModel = copy(prog);
  assertEqual(apply_model(prog, model, [], reverseModel), subProg);
  assertEqual(reverseModel, reverseModelExpected);
})()
//*/

console.log(testsPassed + "/" + tests + " passed");
if(testsPassed !== tests) {
  console.log((tests - testsPassed) + " tests failed");
} else {
  console.log("All tests passed");
}