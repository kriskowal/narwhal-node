
/**
 * A promise-based JSGI server API.
 * @module
 */

/*whatsupdoc*/

var HTTP = require("http");
var Q = require("narwhal/promise-util");

/**
 * @param {respond(request Request)} respond a JSGI responder function that
 * receives a Request object as its argument.  The JSGI responder promises to
 * return an object of the form `{status, headers, body}`.  The status and
 * headers must be fully resolved, but the body may be a promise for an object
 * with a `forEach(write(chunk String))` method, albeit an array of strings.
 * The `forEach` method may promise to resolve when all chunks have been
 * written.
 * @returns a Node Server object.
 */
exports.Server = function (respond) {
    var self = Object.create(exports.Server.prototype);

    var server = HTTP.createServer(function (_request, _response) {
        var request = exports.Request(_request);

        var closed = Q.defer();
        _request.connection.addListener("close", function (error, value) {
            if (error)
                closed.reject(error);
            else
                closed.resolve(value);
        });

        Q.when(respond(request), function (response) {
            _response.writeHead(response.status, response.headers);

            if (response.onClose)
                Q.when(closed, response.onClose);

            return Q.when(response.body, function (body) {
                if (
                    Array.isArray(body) &&
                    body.length === 1 &&
                    typeof body[0] === "string"
                ) {
                    _response.end(body[0]);
                } else if (body) {
                    var end = Q.forEach(body, function (chunk) {
                        _response.write(chunk);
                    });
                    return Q.when(end, function () {
                        _response.end();
                    });
                } else {
                    _response.end();
                }
            });
        });
    });

    var listening = Q.defer();
    server.addListener("listening", function () {
        listening.resolve();
    });
    self.listen = function (port) {
        return server.listen(port >>> 0);
    };

    return self;
};

/**
 * Inherits the Node HTTP Request object.
 */
exports.Request = function (_request) {
    var request = Object.create(exports.Request.prototype);
    request.method = _request.method;
    request.path = _request.url;
    request.body = exports.Stream(_request);
    return request;
};

exports.Client = function (port, host) {
    var self = Object.create(exports.Client.prototype);

    var _client = HTTP.createClient(port, host);

    self.request = function (request) {
        // host, port, method, path, headers, body
        var deferred = Q.defer();
        var _request = _client.request(
            request.method || 'GET',
            request.path || '/',
            request.headers || {}
        );
        _request.addListener('response', function (_response) {
            var response = exports.Response(_response);
            deferred.resolve(response);
        });
        Q.when(request.body, function (body) {
            var end;
            if (body) {
                end = Q.forEach(body, function (chunk) {
                    _request.write(chunk, request.charset);
                });
            }
            Q.when(end, function () {
                _request.end();
            });
        });
        return deferred.promise;
    };

    return self;
};

exports.request = function (request) {
    var client = exports.Client(request.port || 80, request.host);
    return client.request(request);
};

/**
 */
exports.Response = function (_response) {
    var response = Object.create(exports.Response.prototype);
    response.status = _response.statusCode;
    response.version = _response.httpVersion;
    response.headers = _response.headers;
    response.body = exports.Stream(_response);
    return response;
};

/**
 */
exports.Stream = function (_stream) {
    var self = Object.create(exports.Stream.prototype);

    var end = Q.defer();

    // prevent indefinite buffering; resume on demand
    //_stream.pause();

    var chunks = [];
    var receiver;
    _stream.addListener("end", end.resolve);
    _stream.addListener("data", function (chunk) {
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

    return self;
};
