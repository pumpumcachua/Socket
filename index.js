// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var score = {};
var N = 3;
var next_roller = 0;
var L = Math.floor(30*Math.random())+1;
var regexEx = /^[a-zA-Z0-9- ]*$/
var stdin = process.openStdin();
console.log("enter the number of player:")
stdin.addListener("data", function(d) {
    // note:  d is an object, and when converted to a string it will
    // end with a linefeed.  so we (rather crudely) account for that
    // with toString() and then trim()

    N= parseInt(d.toString().trim());
    if(N > 8 || N < 2)
    {
        console.log("Number of players must be greater than 2 and less than 9!")
    }
    else {
      server.listen(port, function () {
        console.log('Server listening at port %d', port);
      });


      console.log("Number of players: ",N)
      console.log("Race length: ",L)


      // Routing
      app.use(express.static(path.join(__dirname, 'public')));

      // Chatroom

      var numUsers = 0;

      io.on('connection', function (socket) {
        var addedUser = false;
        if(numUsers>= N)
        {
          socket.emit("room full");
          return;
        }

        //check if the username is valid
        socket.on('check username', function(raw_username){
          //a-z A-z 0-9
          if(regexEx.test(raw_username) == false) {
            socket.emit("check username result",{
              username: raw_username,
              valid: false
            });
            return;
          }
          else{
            for (var i = 0; i <numUsers; i++)
            {
              if (Object.keys(score)[i] === raw_username)
              {
                console.log("Duplicate username")
                socket.emit("check username result",{
                  username: raw_username,
                  valid: false
                });
                return;
              }
            }
            socket.emit("check username result",{
              username: raw_username,
              valid: true
            });
          }
        });

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
          if (addedUser ) return;

          // we store the username in the socket session for this client
          socket.username = username;

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
            io.emit("game start");
            io.sockets.sockets[Object.keys(io.sockets.sockets)[next_roller]].emit('request roll');
          }
        });

        socket.on('request room state',function(){
          socket.emit('response room state', {
            scoreList: score,
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

          tmp_score = score[username] + dice_value;
          if (tmp_score == L)
          {
            console.log("GAME OVER")
            score[username] =tmp_score;
            io.emit("winner", {
              username: username,
              scoreList: score,
              value: dice_value,
            });
          }
          else {
            if(tmp_score < L)
            {
              score[username] =tmp_score;
            }
            io.emit('dice result', {
              username: username,
              value: dice_value,
              scoreList: score
            });
            //Next player roll
            if(next_roller >= numUsers-1)
            {
              next_roller=0;
            }
            else {
              next_roller++;
            }
            io.sockets.sockets[Object.keys(io.sockets.sockets)[next_roller]].emit('request roll');
          }

        });

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
    }
  });
