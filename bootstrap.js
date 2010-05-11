
var modules = {};
var PROCESS = process;
var NODE_FS = require("fs");
var SYS = require("sys");
var FS, SYSTEM, ENGINE;

// -- kriskowal Kris Kowal Copyright (C) 2009-2010 MIT License

// This file is an anonymous function expression.  The file is executed in
// node_narwhal.cc to produce a Function.  The function is called in
// node_narwhal.cc with a module memo that has been "primed" with native
// modules to avoid communicating dependencies through the transitive
// globals.

function main () {

    var natives = PROCESS.binding("natives");
    Object.keys(natives).forEach(function (name) {
        if (name === "assert")
            return; // narwhal has its own
        if (name === "file")
            return; // narwhal also has a deprecated module by this name
        Object.defineProperty(modules, name, {
            "get": function () {
                return require(name);
            }
        });
    });

    var text = FS.read(ENGINE.prefix + "/narwhal.js");
    var factory = PROCESS.compile(text, "$NARWHAL/narwhal.js", 1);
    factory(modules);
}

// module "system"
(function (exports) {

    exports.env = PROCESS.env;
    exports.args = [PROCESS.argv[0]].concat(PROCESS.argv.slice(2));
    exports.print = SYS.puts;

})(SYSTEM = modules['system'] = {});

// module "narwhal/engine"
(function (exports) {

    exports.global = this;
    exports.engine = "node";
    exports.engines = ["node", "default"];
    exports.debug = +SYSTEM.env["NARWHAL_DEBUG"];
    exports.verbose = +SYSTEM.env["NARWHAL_VERBOSE"];
    exports.strict = +SYSTEM.env["NARWHAL_STRICT"];

    exports.os = undefined; // XXX TODO
    exports.enginePrefix = SYSTEM.env["NARWHAL_ENGINE_HOME"];
    exports.prefix = SYSTEM.env["NARWHAL_HOME"];
    exports.prefixes = [exports.prefix];

    ENGINE.compile = PROCESS.compile;

    exports.Module = function (text, fileName, lineNo) {
        var factory = function (inject) {
            var names = [];
            for (var name in inject)
                if (Object.prototype.hasOwnProperty.call(inject, name))
                    names.push(name);
            var factory;
            try {
                factory = PROCESS.compile(
                    Array(lineNo).join("\n") +
                    "(function(" + names.join(",") + "){" + text + "\n})",
                    fileName
                );
            } catch (exception) {
                throw new Error(
                    exception + " while compiling " +
                    fileName + ":" + lineNo
                );
            }
            factory.apply(null, names.map(function (name) {
                return inject[name];
            }));
        };
        return factory;
    };

    ENGINE.loaders = [
        [".node", {
            "load": function (path) {
                return function (inject) {
                    var exports = require(path);
                    for (var name in exports) {
                        inject.exports[name] = exports[name];
                    }
                };
            },
            "reload": function (path) {
            }
        }]
    ];

})(ENGINE = modules['narwhal/engine'] = {});

// module "narwhal/fs"
(function (exports) {

    exports.read = NODE_FS.readFileSync;

    exports.isFile = function (path) {
        try {
            var stat = NODE_FS.statSync(path);
        } catch (x) {}
        return stat && stat.isFile();
    };

})(FS = modules['narwhal/fs'] = {});

main();

