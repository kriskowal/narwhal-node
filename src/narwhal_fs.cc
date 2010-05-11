// Copyright 2009 Ryan Dahl <ry@tinyclouds.org>
#include <narwhal_fs.h>

#include <sys/types.h>
#include <sys/stat.h>
#include <dirent.h>
#include <fcntl.h>
#include <stdlib.h>
#include <unistd.h>
#include <assert.h>
#include <string.h>
#include <errno.h>
#include <limits.h>
#include <node/node_buffer.h>

/* used for readlink, AIX doesn't provide it */
#ifndef PATH_MAX
#define PATH_MAX 4096
#endif

namespace node {

using namespace v8;

#define MIN(a,b) ((a) < (b) ? (a) : (b))
#define THROW_BAD_ARGS \
  ThrowException(Exception::TypeError(String::New("Bad argument")))
static Persistent<String> encoding_symbol;
static Persistent<String> errno_symbol;

static inline Local<Value> errno_exception(int errorno) {
  Local<Value> e = Exception::Error(String::NewSymbol(strerror(errorno)));
  Local<Object> obj = e->ToObject();
  obj->Set(errno_symbol, Integer::New(errorno));
  return e;
}

static int After(eio_req *req) {
  HandleScope scope;

  Persistent<Function> *callback =
    reinterpret_cast<Persistent<Function>*>(req->data);
  assert((*callback)->IsFunction());

  ev_unref(EV_DEFAULT_UC);

  int argc = 0;
  Local<Value> argv[6];  // 6 is the maximum number of args

  if (req->errorno != 0) {
    argc = 1;
    argv[0] = errno_exception(req->errorno);
  } else {
    // Note: the error is always given the first argument of the callback.
    // If there is no error then then the first argument is null.
    argv[0] = Local<Value>::New(Null());

    switch (req->type) {
      case EIO_CLOSE:
      case EIO_RENAME:
      case EIO_UNLINK:
      case EIO_RMDIR:
      case EIO_MKDIR:
      case EIO_FTRUNCATE:
      case EIO_LINK:
      case EIO_SYMLINK:
      case EIO_CHMOD:
        argc = 0;
        break;

      case EIO_OPEN:
      case EIO_SENDFILE:
        argc = 2;
        argv[1] = Integer::New(req->result);
        break;

      case EIO_WRITE:
        argc = 2;
        argv[1] = Integer::New(req->result);
        break;

      case EIO_STAT:
      case EIO_LSTAT:
      {
        struct stat *s = reinterpret_cast<struct stat*>(req->ptr2);
        argc = 2;
        argv[1] = BuildStatsObject(s);
        break;
      }
      
      case EIO_READLINK:
      {
        argc = 2;
        argv[1] = String::New(static_cast<char*>(req->ptr2), req->result);
        break;
      }

      case EIO_READ:
      {
        argc = 3;
        Local<Object> obj = Local<Object>::New(*callback);
        Local<Value> enc_val = obj->GetHiddenValue(encoding_symbol);
        argv[1] = Encode(req->ptr2, req->result, ParseEncoding(enc_val));
        argv[2] = Integer::New(req->result);
        break;
      }

      case EIO_READDIR:
      {
        char *namebuf = static_cast<char*>(req->ptr2);
        int nnames = req->result;

        Local<Array> names = Array::New(nnames);

        for (int i = 0; i < nnames; i++) {
          Local<String> name = String::New(namebuf);
          names->Set(Integer::New(i), name);
#ifndef NDEBUG
          namebuf += strlen(namebuf);
          assert(*namebuf == '\0');
          namebuf += 1;
#else
          namebuf += strlen(namebuf) + 1;
#endif
        }

        argc = 2;
        argv[1] = names;
        break;
      }

      default:
        assert(0 && "Unhandled eio response");
    }
  }

  if (req->type == EIO_WRITE) {
    assert(req->ptr2);
    delete [] reinterpret_cast<char*>(req->ptr2);
  }

  TryCatch try_catch;

  (*callback)->Call(Context::GetCurrent()->Global(), argc, argv);

  if (try_catch.HasCaught()) {
    FatalException(try_catch);
  }

  // Dispose of the persistent handle
  callback->Dispose();
  delete callback;

  return 0;
}

static Persistent<Function>* persistent_callback(const Local<Value> &v) {
  Persistent<Function> *fn = new Persistent<Function>();
  *fn = Persistent<Function>::New(Local<Function>::Cast(v));
  return fn;
}

#define ASYNC_CALL(func, callback, ...)                           \
  eio_req *req = eio_##func(__VA_ARGS__, EIO_PRI_DEFAULT, After,  \
    persistent_callback(callback));                               \
  assert(req);                                                    \
  ev_ref(EV_DEFAULT_UC);                                          \
  return Undefined();

// fd, buffer, start, stop, offset, callback
Handle<Value> Fs::ReadInto(const Arguments& args) {
  HandleScope scope;

  Buffer *buffer;
  int fd;
  char *buf;
  int start, stop;
  size_t length;
  off_t offset = -1; // sentinel
  ssize_t ret;

  // fd
  if (!args[0]->IsInt32())
    return ThrowException(String::New("readInto() arguments[0] must be a "
      "file descriptor Number"));
  fd = args[0]->Int32Value();

  // buffer
  if (!args[1]->IsObject() /*|| !Buffer::HasInstance(args[1]) */)
    return ThrowException(String::New("readInto() arguments[1] 'buffer' "
      "must be a Buffer Object"));
  buffer = ObjectWrap::Unwrap<Buffer>(args[1]->ToObject());
  buf = buffer->data();

  // start
  if (args[2]->IsUndefined())
    start = 0;
  else if (args[2]->IsInt32())
    start = args[2]->Int32Value();
  else
    return ThrowException(String::New("readInto() arguments[2] 'start' "
      "must be a Number if it is defined"));
  if (start < 0)
    return ThrowException(String::New("readInto() arguments[2] 'start' must "
      "be a positive Number if it is defined."));
  if (start > buffer->length())
    return ThrowException(String::New("readInto() arguments[2] 'start' must "
      "be no greather than the length of the buffer."));

  // stop
  if (args[3]->IsUndefined())
    stop = buffer->length();
  else if (args[3]->IsInt32())
    stop = args[3]->Int32Value();
  else
    return ThrowException(String::New("readInto() arguments[3] 'stop' must "
      "be a Number if it is defined"));
  if (stop < start)
    return ThrowException(String::New("readInto() arguments[3] 'stop' must "
      "be greater than 'start'"));
  if (stop > buffer->length())
    return ThrowException(String::New("readInto() arguments[3] 'stop' must "
      "be less than or equal to the buffer's length"));

  length = stop - start;
  assert(start + length <= buffer->length());

  // offset
  if (args[4]->IsUndefined())
    offset = 0;
  else if (args[4]->IsInt32())
    offset = args[4]->Int32Value();
  else
    return ThrowException(String::New("readInto() arguments[4] 'offset' "
      "must be an integer if defined"));
  if (offset <= 0)
      offset = -1; // a sentinel for non-offset read

  // callback
  if (args[5]->IsFunction()) {
    ASYNC_CALL(read, args[5], fd, buf + start, length, offset)
  } else {
    if (offset < 0) {
      ret = read(fd, buf + start, length);
    } else {
      ret = pread(fd, buf + start, length, offset);
    }
    if (ret < 0)
      return ThrowException(errno_exception(errno));
    return scope.Close(Number::New(ret));
  }

}

// fd, buffer, start, stop, callback
Handle<Value> Fs::WriteFrom(const Arguments& args) {
  HandleScope scope;

  Buffer *buffer;
  int fd;
  char *buf;
  int start, stop, length;
  int written;
  off_t offset = -1; // sentinel for use write

  // fd
  if (!args[0]->IsInt32())
    return ThrowException(String::New("writeFrom() arguments[0] must be a "
      "file descriptor Number"));
  fd = args[0]->Int32Value();

  // buffer
  if (!args[1]->IsObject() /*|| !Buffer::HasInstance(args[1]) */)
    return ThrowException(String::New("writeFrom() arguments[1] 'buffer' "
      "must be a Buffer Object"));
  buffer = ObjectWrap::Unwrap<Buffer>(args[1]->ToObject());
  buf = buffer->data();

  // start
  if (args[2]->IsUndefined())
    start = 0;
  else if (args[2]->IsInt32())
    start = args[2]->Int32Value();
  else
    return ThrowException(String::New("writeFrom() arguments[2] 'start' "
      "must be a Number if it is defined"));
  if (start < 0)
    return ThrowException(String::New("writeFrom() arguments[2] 'start must "
      "be a positive Number if it is defined."));
  if (start > buffer->length())
    return ThrowException(String::New("writeFrom() arguments[2] 'start must "
      "be no greater than the buffer length."));

  // stop
  if (args[3]->IsUndefined())
    stop = buffer->length();
  else if (args[3]->IsInt32())
    stop = args[3]->Int32Value();
  else
    return ThrowException(String::New("writeFrom() arguments[3] 'stop' must "
      "be a Number if it is defined"));
  if (stop < start)
    return ThrowException(String::New("writeFrom() arguments[3] 'stop' must "
      "be greater than 'start'"));
  if (stop > buffer->length())
    return ThrowException(String::New("writeFrom() arguments[3] 'stop' must "
      "be less than or equal to the buffer's length"));

  length = stop - start;
  assert(start + length <= buffer->length());

  // offset
  if (args[4]->IsUndefined())
    offset = 0;
  else if (args[4]->IsInt32())
    offset = args[4]->Int32Value();
  else
    return ThrowException(String::New("writeFrom() arguments[4] 'offset' "
      "must be an integer if defined"));
  if (offset <= 0)
      offset = -1; // a sentinel for non-offset read

  if (args[4]->IsFunction()) {
    ASYNC_CALL(write, args[4], fd, buf + start, length, offset)
  } else {
    if (offset < 0) {
      written = write(fd, buf + start, length);
    } else {
      written = pwrite(fd, buf + start, length, offset);
    }
    if (written < 0)
        return ThrowException(errno_exception(errno));
    return scope.Close(Integer::New(written));
  }
}

void Fs::Initialize(Handle<Object> target) {
  HandleScope scope;

  NODE_SET_METHOD(target, "readInto", Fs::ReadInto);
  NODE_SET_METHOD(target, "writeFrom", Fs::WriteFrom);

  errno_symbol = NODE_PSYMBOL("errno");
  encoding_symbol = NODE_PSYMBOL("node:encoding");
}

}  // end namespace node

extern "C" void init(v8::Handle<v8::Object> target) {
  node::Fs::Initialize(target);
}

