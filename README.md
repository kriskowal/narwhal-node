
Node Narwhal Compatibility Layer
================================

In conjunction with `narwhal-lib`, provides Narwhal's libraries for
Node.  Either manually, or via the package manager of your choice, you
must arrange for `lib` and `narwhal-lib/lib` to be in `require.paths`
albeit through the `NODE_PATH` environment variable.

Some synchronous API's are not available.  Transcoding, buffered IO,
and some other things are enabled by building some `.node` libraries
with `node-waf` or `make`.  No installation is necessary.


License
-------

Copyright &copy; 2010, Kris Kowal, MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

