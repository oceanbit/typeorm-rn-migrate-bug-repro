// React Native will complain if this variable isn't present in a global scope.
__DEV__ = false;

require("@babel/register")({
  ignore: []
});

require("./node_modules/typeorm/cli.js");
