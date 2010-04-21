
/*
 * Promisquity - A simple HTTP Queue Server
 *
 * HTTP POST request body gets enqueued
 * HTTP GET response body gets dequeued
 *
 * GET does not respond until a POST body
 * is available.  Each GET request consumes
 * a POST, even if the connection is aborted.
 *
 * - Works on Node v0.1.90-15-g08ff9d7
 * - with a Node-Narwhal compatibility layer:
 * http://github.com/kriskowal/node-narwhal/commit/eb00459f6d17cde3eae39513d18f2937e731416e
 * - and Narwhal's Library:
 * http://github.com/kriskowal/narwhal-lib/tree/207d2845f5232415a8e9e4f7e4c741831295c3ad
 *
 */

var SYS = require("sys");
var HTTP = require("narwhal/q-http");
var Q = require("narwhal/promise-util");

var port = 8000;

/**
 * A Q-JSGI-ish application that wraps a promise-queue
 * optionally limited to a given length.  Only responds to
 * GET and POST on "/".  All other methods and paths receive
 * 405 Method Not Allowed and 404 Not Found errors.
 */
exports.QApp = function (length) {
    var q = Q.Queue(length);
    return function (request) {
        if (request.path !== "/")
            return {"status": 404}; // 404
        if (request.method == "GET") {
            return {
                "status": 200,
                "headers": {"Content-Type": "text/plain"},
                "body": q.get()
            };
        } else if (request.method == "POST") {
            q.put(request.body);
            return {
                "status": 200,
                "headers": {
                    "Content-Type": "text/plain"
                },
                "body": []
            }
        } else {
            return {
                "status": 405, // Method not allowed
                "headers": {
                    "Content-type": "text/plain",
                    "Allow": "GET, POST"
                },
                "body": []
            }
        }
    };
};

var server = HTTP.Server(exports.QApp(10));

Q.when(server.listen(port), function () {
    SYS.puts("Listening on " + port);
});

