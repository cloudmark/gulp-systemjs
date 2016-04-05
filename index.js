"use strict";

var gutil = require("gulp-util");
var through = require("through2");
var merge = require("merge");
var BufferStreams = require("bufferstreams");
var PLUGIN_NAME = "gulp-systemjs";
var DECORATE_STRING = `function(decorators, target, key, desc) {
    var c = arguments.length,
        r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
        d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if (d = decorators[i])
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
`;
var METADATA_STRING = `function(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
      return Reflect.metadata(k, v);
  };`;

function systemjsReduce(src) {
  var result = src;
  var decorations = src.split(DECORATE_STRING);
  if (decorations.length > 0){
    result = decorations.join("decorationFn;");
    result = `var decorationFn = ${DECORATE_STRING}\n` + result;
  }

  var metadatas = result.split(METADATA_STRING);
  if (metadatas.length > 0){
    result = metadatas.join("metadataFn;");
    result = `var metadataFn = ${METADATA_STRING}\n` + result;
  }
  return {src: result};
}


// Function which handle logic for both stream and buffer modes.
function transform(file, input, opts) {
  var res = systemjsReduce(input.toString(), opts);
  if (res.errors) {
    var filename = "";
    if (file.path) {
      filename = file.relative + ": ";
    }
    throw new gutil.PluginError(PLUGIN_NAME, filename + res.errors.join("\n"));
  }
  return new Buffer(res.src);
}

module.exports = function (options) {
  options = options || {};

  return through.obj(function (file, enc, done) {
    // When null just pass through.
    if (file.isNull()) {
      this.push(file);
      return done();
    }

    // Buffer input.
    if (file.isBuffer()) {
      try {
        file.contents = transform(file, file.contents, opts);
      } catch (e) {
        this.emit("error", e);
        return done();
      }
    // Dealing with stream input.
    } else {
      file.contents = file.contents.pipe(new BufferStreams(function(err, buf, cb) {
        if (err) return cb(new gutil.PluginError(PLUGIN_NAME, err));
        try {
          var transformed = transform(file, buf, opts)
        } catch (e) {
          return cb(e);
        }
        cb(null, transformed);
      }));
    }

    this.push(file);
    done();
  });
};
