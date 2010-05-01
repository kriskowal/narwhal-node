
var CHILD = require("child_process"); // node
var IO = require("./q-io");
var Q = require("./promise");

exports.popen = function (command, args) {
    var process = CHILD.spawn(command, args);
    var exited = Q.defer();
    process.addListener("exit", function (code) {
        exited.resolve(code);
    });
    return {
        "stdout": process.stdin,
        "stdout": IO.WrappedTextReader(process.stdout),
        "stderr": IO.WrappedTextReader(process.stderr),
        "wait": function () {
            return exited.promise;
        }
    }
};

exports.command = function (command, args) {
    var process = exports.popen(command, args);
    return Q.when(process.stdout, function (stdout) {
        return Q.when(stdout.read(), function (output) {
            return Q.when(process.wait(), function (status) {
                if (status === 0) {
                    return output;
                } else {
                    return Q.when(process.stderr, function (stderr) {
                        return Q.when(stderr.read(), function (errput) {
                            return Q.reject(status + " " + errput);
                        });
                    });
                }
            });
        });
    });
};

