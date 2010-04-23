
var FS = require("fs"); // node
var SYS = require("sys"); // node
var IO = require("narwhal/q-io");
var UTIL = require("narwhal/util");
var FS_BOOT = require("narwhal/fs-boot");
UTIL.update(exports, FS_BOOT);

exports.open = function (path, options) {
    var stream = FS.createReadStream(String(path));
    return IO.WrappedTextReader(stream);
};

