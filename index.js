// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

//new var
var socketlist = {};
var score = {};
var N = 3;
var next_roller = 0;
var L = Math.floor(30*Math.random())+1;

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser || numUsers>= N) return;

    // we store the username in the socket session for this client
    socket.username = username;
    socketlist[numUsers] = socket;
    ++numUsers;
    score[username] = 0;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
    //if room is full start the game
    if (numUsers === N)
    {
      console.log("GAME START");
      socketlist[next_roller].emit('Request roll');
    }


  });

  socket.on('request room state',function(username){

    socket.emit('response room state', {
      score: score[username],
      length: L
    })
  })
  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  //dua ngua part =))
  // When the client emits 'roll the dice', we random 1->6 and broadcast to all clients
  socket.on('roll the dice', function(username){
    var dice_value = Math.floor(6*Math.random())+1;

    io.emit('dice result', {
      username: username,
      value: dice_value
    });

    if(next_roller === N)
    {
      next_roller=0;
    }
    else {
      next_roller++;
    }
    //Next player roll
    socketlist[next_roller].emit('Request roll');
  });
  //broadcast the winner
  socket.on('winner', function(username){
    socket.broadcast.emit('winner', username);
  })

  //END


  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });



});
