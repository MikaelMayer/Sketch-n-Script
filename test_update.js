

//console.log(uneval_(computeDiffs_(12, [12, 13])));
//console.log(uneval_(computeDiffs_([12, '14'], 12)));
//console.log(uneval_(computeDiffs_(12, 12)));

let envX12 = {head: {name: "x", value: {
    v_: 12
  }},
  tail: undefined};

let envXL = {head: {name: "x", value: {
    v_: "L"
  }},
  tail: undefined};

let envNiu = {head: {name: "niu", value: {
    v_: ["Normal",["italic",{italic:true}],
         " ", ["underlined", {underline:true}]]
  }},
  tail: undefined};
  
let envS = {head: {name: "s", value: {
    v_: [1,"2"]
  }},
  tail: undefined};
  
let tests = 0;
let testsPassed = 0;
  
function assertUpdate(env, code, value, newCode, envPredicate, nth) {
  tests++;
  var result = update_(env, code)(value);
  if(result.ctor == "Ok") {
    result = result._0;
    while(nth >= 2 && result) {
      result = result.next();
      nth--;
    }
    if(!result) {
      console.log("Error: Expected\n" + newCode + "\n, got no " + nth + "-th solution");
        return;
    }
    if(result.node !== newCode) {
      console.log("Error: Expected\n" + newCode + "\n, got\n" + result.node);
    } else {
      result = envPredicate ? envPredicate(result.env) : undefined;
      if(result && result.ctor == "Err") {
        console.log("Error: " + result);
      } else {
        testsPassed++;
      }
    }
  } else {
    console.log("Error: " + result._0);
  }
}
function envEqual(name, v_) {
  return function(newEnv) {
    var result = List.foreach(newEnv, function(binding) {
      if(binding.name == name) {
        if(uneval_(binding.value.v_) === uneval_(v_)) {
          return Ok("");
        } else {
          return Err("Expected that " + name + " = \n" + uneval_(v_) + "\n, got \n" + uneval_(binding.value.v_));
        }
      }
    });
    return result || Err(name + " not found in env " + uneval_(newEnv))
  }
}
function assertEqual(x1, x2) {
  tests++;
  var s1 = uneval_(x1);
  var s2 = uneval_(x2);
  if(s1 == s2) {
    testsPassed++;
  } else {
    console.log("Expected\n" + s2 + "\n, got \n" + s1);
  }
}
//*
assertEqual(computeDiffs_([1, 2, 2, 3], [2, 2, 3]), [ { ctor: "Update", kind:   { ctor: "NewValue", model:   [ undefined, undefined, undefined]}, children:   { 0:   [ { ctor: "Clone", path:   { up: 0, down:   [ "1"]}, diffs:   [ { ctor: "Update", kind:   { ctor: "Reuse"}, children:   { }}]}, { ctor: "Clone", path:   { up: 0, down:   [ "2"]}, diffs:   [ { ctor: "Update", kind:   { ctor: "Reuse"}, children:   { }}]}], 1:   [ { ctor: "Clone", path:   { up: 0, down:   [ "2"]}, diffs:   [ { ctor: "Update", kind:   { ctor: "Reuse"}, children:   { }}]}, { ctor: "Clone", path:   { up: 0, down:   [ "1"]}, diffs:   [ { ctor: "Update", kind:   { ctor: "Reuse"}, children:   { }}]}], 2:   [ { ctor: "Clone", path:   { up: 0, down:   [ "3"]}, diffs:   [ { ctor: "Update", kind:   { ctor: "Reuse"}, children:   { }}]}]}}]);
assertUpdate(envX12, "//\n1//x", 2, "//\n2//x");
assertUpdate(envX12, "//\n'1'//x", 2, "//\n2//x");
assertUpdate(envX12, "//\n1//x", '2', "//\n\"2\"//x");
assertUpdate(envX12, "//\n'1'//x", '2', "//\n'2'//x");
assertUpdate(envX12, "//\n\"1\"//x", '2', "//\n\"2\"//x");
assertUpdate(envX12, "//\n x //y", '2', "//\n x //y", envEqual("x", "2"));
assertUpdate(envX12, "//\n[15,//b\n16]", [12, 13], "//\n[12,//b\n13]");
assertUpdate(envX12, "//\nx", [12, 13], "[//\nx, 13]");
assertUpdate(envX12, '[x, " ", ["italic", {italic:true}]," ",["underlined",{underline:true}]]', [[12,{bold:true}]," ",["italic",{italic:true}]," ",["underlined",{underline:true}]],
  '[[x, {bold:true}], " ", ["italic", {italic:true}]," ",["underlined",{underline:true}]]')
assertUpdate(undefined,  "[\"Normal\",[\"italic\",{italic:true}]]", [["Normal",{bold:true}],["italic",{italic:true}]], "[[\"Normal\", {bold:true}],[\"italic\",{italic:true}]]")
assertUpdate(envX12,  "[x,[\"italic\",{italic:true}]]", 
[[12,{bold:true}],["italic",{italic:true}]], "[[x, {bold:true}],[\"italic\",{italic:true}]]")

assertUpdate(undefined, `["Normal ", ["italic", {italic:true}], " ", ["underlined", {underline:true}]]`, [["Normal", {bold:true}], " ", ["italic", {italic:true}], " ", ["underlined", {underline:true}]], `[["Normal",{bold:true}], " ", ["italic", {italic:true}], " ", ["underlined", {underline:true}]]`)
assertUpdate(envNiu, "//\nniu//x", [["Normal",{bold:true}], " ", ["italic", {italic:true}], " ", ["underlined", {underline:true}]], "//\nniu//x",
  envEqual("niu", [["Normal",{bold:true}], " ", ["italic", {italic:true}], " ", ["underlined", {underline:true}]])
);
assertUpdate(envS, "s", [[1,"2"],"3", "4"], "[s, \"3\", \"4\"]")
assertUpdate(envX12, "[x, {italic: true}]", 12, "x");
assertUpdate(envX12, "x", [12, {italic: true}], "[x, {italic:true}]");
assertUpdate(envX12, "x", [12, {italic: true}], "x", envEqual("x", [12, {italic: true}]), 2);
assertUpdate(envXL, "['HE', x, 'L', 'O']", ['SAY', 'HE', 'L', 'L', 'O'], "[\"SAY\",'HE', x, 'L', 'O']");
assertUpdate(envXL, "['SAY', 'HE', x, 'L', 'O']", ['HE', 'L', 'L', 'O'], "[ 'HE', x, 'L', 'O']");
//assertUpdate(envXL, "[x, 'L', 'O']", ['SAY', 'L', 'L', 'O'], "[\"SAY\",x, 'L', 'O']");
assertUpdate(envXL, "['SAY', x, 'L', 'O']", ['L', 'L', 'O'], "[ x, 'L', 'O']");
//*/
assertUpdate(undefined, '["hello", "world"]', "helloworld", "\"helloworld\"");
assertUpdate(undefined, '(1)', 2, '(2)');
assertUpdate(undefined, '(true)', false, '(false)');

console.log(testsPassed + "/" + tests + " passed");
if(testsPassed !== tests) {
  console.log((tests - testsPassed) + " tests failed");
} else {
  console.log("All tests passed");
}