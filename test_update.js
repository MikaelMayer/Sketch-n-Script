

//console.log(uneval_(computeDiffs_(12, [12, 13])));
//console.log(uneval_(computeDiffs_([12, '14'], 12)));
//console.log(uneval_(computeDiffs_(12, 12)));

let envX12 = {head: {name: "x", value: {
    v_: 12
  }},
  tail: undefined};

let tests = 0;
let testsPassed = 0;
  
function assertUpdate(env, code, value, newCode, envPredicate) {
  tests++;
  var result = update_(envX12, code)(value);
  if(result.ctor == "Ok") {
    if(result._0.node !== newCode) {
      console.log("Error: Expected " + newCode + ", got " + result._0.node);
    } else {
      result = envPredicate ? envPredicate(result._0.env) : undefined;
      if(result && result.ctor == "Err") {
        console.log("Error: " + result._0);
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
        if(binding.value.v_ === v_) {
         console.log("ok");
          return Ok("");
        } else {
         console.log("err");
          return Err("Expected that " + name + " = " + v_ + ", got " + binding.value.v_);
        }
      }
    });
    return result || Err(name + " not found in env " + uneval_(newEnv))
  }
}
//*
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
//*/
assertUpdate(undefined,  "[\"Normal\",[\"italic\",{italic:true}]]", [["Normal",{bold:true}],["italic",{italic:true}]], "[[\"Normal\", {bold:true}],[\"italic\",{italic:true}]]")
assertUpdate(envX12,  "[x,[\"italic\",{italic:true}]]", 
[[12,{bold:true}],["italic",{italic:true}]], "[[x, {bold:true}],[\"italic\",{italic:true}]]")

console.log(testsPassed + "/" + tests + " passed");
if(testsPassed !== tests) {
  console.log((tests - testsPassed) + " tests failed");
} else {
  console.log("All tests passed");
}