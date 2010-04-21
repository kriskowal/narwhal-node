
var SYS = require("sys");
var HTTP = require("narwhal/q-http");
var Q = require("narwhal/promise-util");

var port = 8080;

exports.Proxy = function (port, host) {
    var client = HTTP.Client(port, host);
    return function (request) {
        SYS.puts(request.path);
        return client.request(request);
    };
};

var server = HTTP.Server(exports.Proxy(80, "google.com"));

Q.when(server.listen(port), function () {
    SYS.puts("Listining on " + port);
});

