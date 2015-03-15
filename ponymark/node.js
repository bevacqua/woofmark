'use strict';

var contra = require('contra');
var path = require('path');
var fs = require('fs-extra');
var mkdirp = require('mkdirp');
var tmp = require('tmp');
var imgur = require('imgur-client');
var imgurClient;
var defaultLocal = path.resolve('./uploads');
var production = process.env.NODE_ENV === 'production';

function defaultLocalUrl (local, file) {
  return file.replace(local, '/img/uploads');
}

function imageUpload (options, done) {
  var o = {
    image: options.image,
    imgur: options.imgur,
    local: options.local || defaultLocal,
    localUrl: options.localUrl || defaultLocalUrl,
    production: options.production || production
  };
  if (o.imgur) {
    imgurClient = imgur(o.imgur);
  }
  if (!o.production) {
    mkdirp.sync(o.local);
  }

  if (!o.image) {
    done(new Error('No image received on the back-end'));
  } else if (imgurClient) {
    imgurUpload(o, done);
  } else if (!o.production) {
    fileUpload(o, done);
  } else {
    done(new Error('Misconfigured ponymark.imageUpload!'));
  }
}

function imgurUpload (o, done) {
  imgurClient.upload(o.image.path, function (err, data) {
    if (err) {
      done(err); return;
    }

    done(null, {
      alt: o.image.originalname,
      url: data.links.original
    });
  });
}

function fileUpload (o, done) {
  var template = path.join(o.local, 'XXXXXX' + o.image.extension);

  contra.waterfall([
    function (next) {
      tmp.tmpName({ template: template }, next);
    },
    function (temp, next) {
      fs.move(o.image.path, temp, function (err) {
        next(err, temp);
      });
    }
  ], function (err, temp) {
    if (err) {
      done(err); return;
    }
    done(null, {
      alt: o.image.originalname,
      url: o.localUrl(o.local, temp)
    });
  });
}

module.exports = {
  imageUpload: imageUpload
};
