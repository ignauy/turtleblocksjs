//git clone -b couch https://github.com/ignauy/turtleblocksjs.git
//curl -H 'Content-Type: application/json' http://127.0.0.1:5985/_uuids
// also TODO: more resource attributes so that search is happy :)

var couchapp = require('couchapp'),
    path = require('path');

ddoc = {
  _id: '5cf42ee2d9906b74cb2032456f0055f3',
  kind: "Resource",
  title: "Turtle Blocks JS",
  author: "Sugarlabs",
  openWith: "HTML",
  appName: 'turtleblocksjs',
  subject: [
    "Technology"
  ],
  Level: [
    "Professional"
  ],
  rewrites: [{
    from: "/",
    to: 'index.html'
  }, {
    from: "/*",
    to: '*'
  }]
};

ddoc.views = {

}

ddoc.validate_doc_update = function(newDoc, oldDoc, userCtx) {
  if (newDoc._deleted === true && userCtx.roles.indexOf('_admin') === -1) {
    throw "Only admin can delete documents on this database.";
  }
}

couchapp.loadAttachments(ddoc, path.join(__dirname, 'turtleblocksjs'));

module.exports = ddoc;
