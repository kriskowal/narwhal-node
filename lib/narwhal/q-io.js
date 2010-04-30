
var FS = require("fs"); // node
var SYS = require("sys"); // node
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

exports.WrappedTextWriter = function (_stream) {
    var self = Object.create(exports.WrappedTextWriter.prototype);

    if (_stream.setEncoding) // TODO complain about inconsistency
        _stream.setEncoding("binary");

    var begin = Q.defer();
    var end = Q.defer();
    var drained = Q.defer();

    _stream.addListener("error", function (reason) {
        begin.reject(reason);
    });

    _stream.addListener("drain", function () {
        SYS.puts("drain!");
        begin.resolve(self);
        drained.resolve();
        drained = Q.defer();
    });

    _stream.addListener("end", function () {
        begin.resolve(self); 
        end.resolve()
    });

    self.write = function (content) {
        if (!_stream.writeable)
            return Q.reject(_stream.writeable);
        if (!_stream.write(content)) {
            return drained;
        }
    };

    self.flush = function () {
        return drained;
    };

    self.close = function () {
        _stream.end();
        return end;
    };

    self.destroy = function () {
        _stream.destroy();
        return end;
    };

    return self; // todo returns the begin.promise
};

