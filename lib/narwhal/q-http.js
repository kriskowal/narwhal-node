
/**
 * A promise-based JSGI server API.
 * @module
 */

/*whatsupdoc*/

var HTTP = require("http");
var URL = require("url");
var Q = require("narwhal/promise-util");
var IO = require("narwhal/q-io");

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
                        _response.write(chunk, "binary");
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

    var stopped = Q.defer();
    server.addListener("close", function (err) {
        if (err) {
            stopped.reject(err);
        } else {
            stopped.resolve();
        }
    });
    self.stop = function () {
        server.close();
        return stopped.promise;
    };

    var listening = Q.defer();
    server.addListener("listening", function (err) {
        if (err) {
            listening.reject(err);
        } else {
            listening.resolve();
        }
    });
    self.listen = function (port) {
        server.listen(port >>> 0);
        return listening.promise;
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
    request.body = IO.WrappedTextReader(_request);
    request.headers = _request.headers;
    request.connection = _request.connection;
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

exports.read = function (url) {
    url = URL.parse(url);
    return Q.when(exports.request({
        "host": url.hostname,
        "port": url.port,
        "method": "GET",
        "path": (url.pathname || "") + (url.search || ""),
        "headers": {}
    }), function (response) {
        if (response.status !== 200)
            return Q.reject(response.status);
        return Q.when(response.body, function (body) {
            return body.read();
        });
    });
};


/**
 */
exports.Response = function (_response) {
    var response = Object.create(exports.Response.prototype);
    response.status = _response.statusCode;
    response.version = _response.httpVersion;
    response.headers = _response.headers;
    response.body = IO.WrappedTextReader(_response);
    return response;
};

