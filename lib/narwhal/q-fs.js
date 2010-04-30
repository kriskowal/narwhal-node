
var FS = require("fs"); // node
var SYS = require("sys"); // node
var Q = require("narwhal/promise");
var IO = require("narwhal/q-io");
var UTIL = require("narwhal/util");
var FS_BOOT = require("narwhal/fs-boot");
UTIL.update(exports, FS_BOOT);

exports.open = function (path, options) {
    if (typeof options === "string")
        options = {"flags": options};
    if (options.flags.indexOf("w") >= 0) {
        var stream = FS.createWriteStream(String(path), options);
        return IO.WrappedTextWriter(stream);
    } else {
        var stream = FS.createReadStream(String(path), options);
        return IO.WrappedTextReader(stream);
    }
};

exports.read = function (path, options) {
    return Q.when(exports.open(path, options), function (stream) {
        return stream.read();
    });
};

exports.write = function (path, content, options) {
    if (typeof options === "string")
        options = {"flags": options};
    options = options || {}; 
    options.flags = options.flags || "w";
    return Q.when(exports.open(path, options), function (stream) {
        return Q.when(stream.write(content), function () {
            return stream.close();
        });
    });
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

