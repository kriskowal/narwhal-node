srcdir = '.'
nodesrcdir = "/Users/kris/node/src"
blddir = 'build'
VERSION = '0.0.0'

def set_options(opt):
  opt.tool_options('compiler_cxx')

def configure(conf):
  conf.check_tool('compiler_cxx')
  conf.check_tool('node_addon')
  if conf.check(lib='iconv', libpath=['/usr/lib', '/usr/local/lib'], uselib_store='ICONV'):
    conf.env.append_value("LINKFLAGS_DL", "-liconv")

def build(bld):
  iconv = bld.new_task_gen('cxx', 'shlib', 'node_addon')
  iconv.includes = 'src ' + nodesrcdir
  iconv.target = 'iconv-embedding'
  iconv.source = 'src/narwhal_iconv.cc'
  iconv.uselib = "ICONV"

  os = bld.new_task_gen('cxx', 'shlib', 'node_addon')
  os.includes = 'src ' + nodesrcdir
  os.target = 'os-embedding'
  os.source = 'src/narwhal_os.cc'

  fs = bld.new_task_gen('cxx', 'shlib', 'node_addon')
  fs.includes = 'src ' + nodesrcdir
  fs.target = 'fs-embedding'
  fs.source = 'src/narwhal_fs.cc'

