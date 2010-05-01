
exports.Buffer = require("buffer").Buffer;

var range = exports.Buffer.prototype.slice;

exports.Buffer.prototype.range = function (start, stop) {
    start = Number(start || 0);
    stop = stop === undefined ? this.length : Number(stop);
    return range.call(this, start, stop);
};

exports.Buffer.prototype.slice = function (start, stop) {
    var result = new exports.Buffer(stop - start);
    this.copy(result, start, stop);
    return result;
};

