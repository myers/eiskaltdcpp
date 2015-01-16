/***************************************************************************
 * copyright    : (C) 2008 Ian Monroe <ian@monroe.nu>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of
 * the License or (at your option) version 3 or any later version
 * accepted by the membership of KDE e.V. (or its successor approved
 * by the membership of KDE e.V.), which shall act as a proxy
 * defined in Section 14 of version 3 of the license.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 **************************************************************************/
 
Import("qt.core");
Import("qt.network");

QByteArray.prototype.toString = function()
{
   ts = new QTextStream( this, QIODevice.ReadOnly );
   return ts.readAll();
}

HttpServer = function(portNumber)
{
  QTcpServer.call( this, null );
  do {
    var connected = this.listen(new QHostAddress( QHostAddress.Any ), portNumber);
    portNumber++;
  } while( !connected && ((this.serverError() & QAbstractSocket.AddressInUseError) == 0 ) && portNumber < 9000 )
  if( !this.isListening() ) {
    printErr( "Unable to open a port for the web server" );
    return;
  }
  printErr("Web server started at port " + this.serverPort() );
  this.newConnection.connect( this, this.newIncomingConnection );
  this.registry = new Object();
}

HttpServer.prototype = new QTcpServer();

HttpServer.prototype.newIncomingConnection = function()
{
  var socket = this.nextPendingConnection();
  var request = new QByteArray();
  var self = this;
  socket.readyRead.connect( function() {
    request.append( socket.readAll() );
    var endOfRequest =  request.indexOf("\r\n\r\n");
    if ( endOfRequest > 0 ) {
      try {
        var headers = new QHttpRequestHeader( request.left( endOfRequest + 4 ).toString() );
        var body = request.mid( endOfRequest + 4 );
        self.sendResponse( socket, headers.path(), headers, body );
        socket.close();
      } catch( error ) {
        printErr( error)
      }
    }
  });
}

HttpServer.prototype.fourOhFour = function(path) {
  return {
    mimeType: 'text/html',
    status: '404 Not found',
    content: [
      '<html><head><title>File not found</title></head>\n', 
      '<body><h1>404 Error</h1>\n',
      path, 
      ' not found.</body></html>'
    ].join('')
  }
};

HttpServer.prototype.sendResponse = function( socket, path, headers, body ) {
  var userResponse = null;
  for( var registeredPath in this.registry ) {
    //printErr( path.indexOf( registeredPath ) + " for " + registeredPath + " in " + path );
    if( path.indexOf( registeredPath ) == 0 ) {
      userResponse = this.registry[registeredPath]( path.substring( registeredPath.length ), headers, body);
      break;
    }
  }
  if ( userResponse == null ) {
    userResponse = this.fourOhFour(path)
  }
  if (!userResponse.hasOwnProperty('status')) {
    userResponse.status = '200'
  }

  try {
     content = "HTTP/1.1 " + userResponse.status + "\n"
     content += "Content-Type: " + userResponse.mimeType + "\n";
     content += "Server: AmarokServer\n";
     //content += "Content-Length: " + userResponse.content.length + "\n";
     content += "\r\n";
     
     var writeMe = new QByteArray();
     writeMe.append( content );
     writeMe.append( userResponse.content );
     socket.write( writeMe );
  } catch( e ) {
    printErr( e );
  }
}

HttpServer.prototype.register = function( path, responseFn )
{
  this.registry[path] = responseFn;
}

function ApiFacade() {
}

ApiFacade.prototype.peers = function peers() {
  var nicks = []
  
  var hubManager = HubManager();
  var hubList = hubManager.getHubs();

  for (var ii = 0; ii < hubList.length; ii++) {
     var hub = hubList[ii];
     var hubUrl = hub.getHubUrl();
     var n = hub.getNicks();
     for (var jj = 0; jj < n.length; jj++) {
        nicks.push(n[jj] + "$" + hubUrl);
     }
  }
  return nicks;
}

ApiFacade.prototype.download = function download(destPath, size, tthRoot, user) {
  var queueManager = QueueManagerScript();
  return queueManager.add(destPath, size, tthRoot, user);
}

var httpServer = new HttpServer(8070);
var apiFacade = new ApiFacade();
httpServer.register("/api", function(path, headers, body) {
  var request = JSON.parse(body);
  var result = apiFacade[request.method].apply(apiFacade, request.params);
  return {
    mimeType: "application/json",
    content: JSON.stringify({jsonrpc: '2.0', id: request['id'], result: result})
  };
});
