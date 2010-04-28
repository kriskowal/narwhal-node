
var FS = require("fs"); // node
var SYS = require("sys"); // node
var Q = require("narwhal/promise");
var IO = require("narwhal/q-io");
var UTIL = require("narwhal/util");
var FS_BOOT = require("narwhal/fs-boot");
UTIL.update(exports, FS_BOOT);

exports.open = function (path, options) {
    var stream = FS.createReadStream(String(path), {
        "flags": "r",
        "encoding": "binary",
        "mode": 0666,
        "bufferSize": 4 * 1024
    });
    return IO.WrappedTextReader(stream);
};

exports.stat = function (path) {
    var deferred = Q.defer();
    FS.stat(path, function (error, stat) {
        if (error)
            deferred.reject(error);
        else
            deferred.resolve(stat);
    });
    return deferred.promise;
};

