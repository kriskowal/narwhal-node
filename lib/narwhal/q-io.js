
var FS = require("fs"); // node
var Q = require("narwhal/promise-util");

/**
 */
exports.WrappedTextReader = function (_stream) {
    var self = Object.create(exports.WrappedTextReader.prototype);

    if (_stream.setEncoding) // TODO complain about inconsistency
        _stream.setEncoding("binary");

    var begin = Q.defer();
    var end = Q.defer();

    // prevent indefinite buffering; resume on demand
    //_stream.pause();

    _stream.addListener("error", function (reason) {
        begin.reject(reason);
    });

    var chunks = [];
    var receiver;
    _stream.addListener("end", function () {
        begin.resolve(self); 
        end.resolve()
        if (_stream.destroy) // TODO complain about inconsistency
            _stream.destroy();
    });
    _stream.addListener("data", function (chunk) {
        begin.resolve(self); 
        if (receiver)
            receiver(chunk);
        else
            chunks.push(chunk);
    });

    function slurp() {
        var result = chunks.join("");
        chunks = [];
        return result;
    }

    /*** 
     * @returns a promise for a String containing the entirety of the HTTP
     * request body.
     */
    self.read = function () {
        receiver = undefined;
        //_stream.resume();
        var deferred = Q.defer();
        Q.when(end.promise, function () {
            deferred.resolve(slurp());
        });
        return deferred.promise;
    };

    /***
     */
    self.forEach = function (write) {
        //_stream.resume();
        if (chunks && chunks.length)
            write(slurp());
        receiver = write;
        return Q.when(end.promise, function () {
            receiver = undefined;
        });
    };

    return begin.promise;
};

