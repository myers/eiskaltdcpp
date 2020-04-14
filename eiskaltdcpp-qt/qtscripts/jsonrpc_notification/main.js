Import("qt.core");
Import("qt.network");

function log(msg) {
  printErr((new Date()).toISOString() + " - " + msg);
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
      log("post error: " + e);
    }
  }

  try {
    reply = manager.post(req, dataByteArray);
    reply.finished.connect(reply, onRequestFinished)
  } catch (e) {
    log("Error while posting " + e);
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
  getenv("JSONRPC_NOTIFICATION_FILELISTS", function() {});

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


  function copyIfNeeded(filepath) {
    try {
      if (filepath.indexOf(".local/share/eiskaltdc++/FileLists") !== -1) {
        // sample file list path
        // "/home/app/.local/share/eiskaltdc++/FileLists/KingDaubach.T4DMF5BOXXKU7A7XT36EMH5XFQQMU3YZMQEA5BQ"

        // the filepath for filelists is missing it's extension
        var file = new QFile(filepath + ".xml.bz2");

        var filename = filepath.split("/").slice(-1)[0];
        var newpath = ENV["JSONRPC_NOTIFICATION_FILELISTS"] + "/" + filename + ".xml.bz2";
        log("Copying file to " + newpath);
        var newFile = new QFile(newpath);
        if (newFile.exists()) {
          log("Removing old file");
          newFile.remove();
        }
        var res = file.copy(newpath);
        log("copy result: " + res);
        filepath = newpath;
      }
      return filepath;
    } catch(e) {
      log("copyIfNeeded error: " + e);
    }
  }

  var queueManager = QueueManagerScript();

  function finishedDownload(filepath) {
    var filepath = copyIfNeeded(filepath);
    notify('finished_download', [filepath]);
  }
  queueManager["finished(QString)"].connect(finishedDownload);

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
