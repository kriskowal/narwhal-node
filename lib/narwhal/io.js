
// -- tlrobinson Tom Robinson
// -- kriskowal Kris Kowal Copyright (C) 2009-2010 MIT License

/**
 * @module
 * @extends narwhal/io-boot
 */

var NODE_FS = require("fs"); // node
var Buffer = require("buffer").Buffer; // node
var EMBEDDING = require("./fs-embedding");
var BINARY = require("narwhal/binary");
var TRANSCODE = require("./iconv-embedding");
var BOOT = require("narwhal/io-boot");
var UTIL = require("narwhal/util");

UTIL.update(exports, BOOT);

/**
 * @returns a raw byte stream, supporting both reading and writing
 * APIs.
 * @param {Number} fd file descriptor
 * @constructor
 */
var FdIO = exports.openFd = function (fd) {
    if (typeof fd !== "number")
        throw new Error("File descriptors must be numbers " + fd);
    var self = Object.create(FdIO.prototype);

    /*** */
    self.fd = fd;

    /*** */
    self.readMax = function (max) {
        // read some
        max = max || 1024;
        var binary = new BINARY.ByteArray(max);
        var buffer = binary._bytes;
        var actual = EMBEDDING.readInto(fd, buffer, 0, max, 0);
        return binary.slice(0, actual).toByteString();
    };

    /*** */
    self.readInto = function (buffer, start, stop) {
        return EMBEDDING.readInto(fd, buffer, start, stop);
    };

    /*** */
    self.write = function (binary, start, stop) {
        binary = binary._bytes || binary;
        if (!(binary instanceof Buffer))
            throw new Error("openFd::write(0) must be a Buffer");
        if (start === undefined)
            start = 0;
        if (stop === undefined)
            stop = binary.length;
        while (start < stop) {
            start += EMBEDDING.writeFrom(fd, binary, start, stop, 0);
        }
    };

    /*** */
    self.isTty = function () {
        // TODO
        //NODE_FS.isatty(fd);
        return false;
    };

    /*** */
    self.flush = function () {
        // NODE_FS.fsync(fd);
    };

    /*** */
    self.close = function () {
        NODE_FS.close(fd);
    };

    return self;
};

/*** */
FdIO.prototype.read = BOOT.Reader.prototype.read;

/*** */
FdIO.prototype.readAll = BOOT.Reader.prototype.readAll;

