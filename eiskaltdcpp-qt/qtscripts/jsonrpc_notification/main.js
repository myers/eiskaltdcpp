Import("qt.core");
Import("qt.network");

QByteArray.prototype.toString = function()
{
   ts = new QTextStream( this, QIODevice.ReadOnly );
   return ts.readAll();
}

function log(msg) {
  printErr((new Date()).toISOString() + " - jsonrpc_notification - " + msg);
}

function post(url, data, callback) {
  var manager = new QNetworkAccessManager();
  var req = new QNetworkRequest(new QUrl(url));
  req.setHeader(QNetworkRequest.ContentTypeHeader, "application/json");
  if (ENV.hasOwnProperty("JSONRPC_NOTIFICATION_KEY")) {
    req.setRawHeader(new QByteArray("Notification-Key"), new QByteArray(ENV["JSONRPC_NOTIFICATION_KEY"]));
  }
  var dataByteArray = new QByteArray(JSON.stringify(data));

  var onRequestFinished = function() {
    var body = null;
    log("post onRequestFinished");

    try {
      var result = this.readAll();
      var codec = QTextCodec.codecForName(new QByteArray("UTF-8"));
      var body = codec.toUnicode(result);
      callback(JSON.parse(body));
    } catch (e) {
      log("post error: " + e + " result = " + JSON.stringify(result.toString()));
    }
  }

  try {
    reply = manager.post(req, dataByteArray);
    reply.finished.connect(reply, onRequestFinished)
  } catch (e) {
    log("Error while posting " + e);
  }
}


function put(url, file, callback) {
  var manager = new QNetworkAccessManager();
  var req = new QNetworkRequest(new QUrl(url));
  req.setHeader(QNetworkRequest.ContentTypeHeader, "application/octet-stream");
  if (ENV.hasOwnProperty("JSONRPC_NOTIFICATION_KEY")) {
    req.setRawHeader(new QByteArray("Notification-Key"), new QByteArray(ENV["JSONRPC_NOTIFICATION_KEY"]));
  }

  var onRequestFinished = function() {
    file.close();
    var body = null;
    log("put onRequestFinished");

    try {
      var result = this.readAll();
      var codec = QTextCodec.codecForName(new QByteArray("UTF-8"));
      var body = codec.toUnicode(result);
      callback(JSON.parse(body));
    } catch (e) {
      log("put error: " + e + "\n\n" + body);
    }
  }

  var onError = function(code) {
    log("put onError code " + code);
    file.close();
  }

  try {
    file.open(QIODevice.ReadOnly)
    reply = manager.put(req, file);
    reply.finished.connect(reply, onRequestFinished)
    reply.error.connect(reply, onError)
  } catch (e) {
    log("Error while putting " + e);
  }
}



var ENV = {};
function getenv(varName, callback) {
  if (ENV.hasOwnProperty(varName)) {
    callback(ENV[varName]);
  }
  function shellDone(ok, msg) {
    log("shellDone ok = " + ok);
    ENV[varName] = msg;
    callback(msg);
  }
  var shell = new ShellCommandRunner("sh", "-c", "echo $" + varName);
  shell["finished(bool,QString)"].connect(shellDone);
  shell.run();
}



try {

  getenv("JSONRPC_NOTIFICATION_URL", function() {});
  getenv("JSONRPC_NOTIFICATION_KEY", function() {});

  function notify(method, params) {
    var url = ENV["JSONRPC_NOTIFICATION_URL"];
    log("posting to " + url + " " + method + " " + params);
    post(url, {"jsonrpc": "2.0", "method": method, "params": params}, function(res) {
      log("notification response: " + JSON.stringify(res));
    });
  }

  function setTimeout(milliseconds, callback) {
    var timer = new QTimer();
    timer.interval = milliseconds
    timer.singleShot = true; // in-case if setTimout and false in-case of setInterval
    timer.timeout.connect(this, callback);
    timer.start();
  }


  var queueManager = QueueManagerScript();

  function finishedDownload(filepath) {
    try {
      notify('finished_download', [filepath]);
    } catch(e) {
      log("Error while notifing about finishedDownload " + e);
    }
  }
  queueManager["finished(QString)"].connect(finishedDownload);

  function finishedFilelist(filepath, nick, hub) {
    log("finishedFilelist " + filepath + ", " + nick + ", " + hub);
    try {
      var file = new QFile(filepath);
      var url = ENV["JSONRPC_NOTIFICATION_URL"] + "?nick=" + nick + "&hub=" + hub;
      log("uploading file via HTTP PUT to " + url);
      put(url, file, function(res) {
        log("put response: " + JSON.stringify(res));
      });
    } catch(e) {
      log("Error while notifing about finishedFilelist " + e);
    }
  }
  queueManager["finishedFilelist(QString, QString, QString)"].connect(finishedFilelist);


  function sourcesUpdated(filetth, cidlist) {
    if (cidlist.length == 0) {
      return;
    }
    notify('bad_source', [filetth, cidlist]);
  }
  queueManager["sourcesUpdated(QString, QStringList)"].connect(sourcesUpdated);


  function userConnected(nick, hub) {
    notify("user_connected", [nick, hub]);
  }
  // setTimeout(60 * 5 * 1000, function() {
    log("setting up userConnected hook");
    var clientManager = ClientManagerScript();
    clientManager["userConnected(QString, QString)"].connect(userConnected);
  // });


  log("jsonrpc_notification installed");
} catch (e) {
  log("error " + e);
}
