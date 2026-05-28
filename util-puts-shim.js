const util = require("util");

if (typeof util.puts !== "function") {
  util.puts = console.log;
}
