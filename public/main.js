$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box
  var $inputMessage1 = $('.inputMessage1'); // Input message input box
  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  var $scores = $('.scores'); // score area


  // Prompt for setting a username
  var username;
  var username_is_valid = false;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();
  var roll_permission = false;
  var socket = io();
  var rolling_timeout;
  var score;
  var length;

// Login Page
// Sets the client's username
function setUsername () {
  var raw_username = cleanInput($usernameInput.val().trim());
  socket.emit("check username",raw_username);
  CallbackVariable1(function(data){
    console.log('Username handler');
    console.log(data);
  })
}


//Chat Page
// Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }
//ScoreList part
  function addPlayerScore (data, options) {
    options = options || {};
    var usernames = Object.keys(data.scoreList)
    var score_r = $('.score')
    score_r.remove('.score')
    for (var i = 0 ; i < usernames.length;i++)
    {
      var username_tmp = usernames[i];
      var score_tmp = data.scoreList[usernames[i]];
      var $usernameDiv = $('<span class="username"/>')
        .text(username_tmp)
        .css('color', getUsernameColor(username_tmp));
      var $scoreBodyDiv = $('<span class="scoreBody">')
        .text(score_tmp+'/'+L);
      var $scoreDiv = $('<li class="score"/>')
        .data('username', score_tmp)
        .append($usernameDiv, $scoreBodyDiv);
      addScoreElement($scoreDiv, options);
    }
  }
  function addScoreElement (el, options) {
    var $el = $(el);
    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = false;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {

      $scores.prepend($el);
    } else {
        $scores.append($el);
      }

      $scores[0].scrollTop = $scores[0].scrollHeight;
  }
  function getRoomState(){
    socket.emit('request room state');

    CallbackVariable(function(data){
      console.log('Room state handler');
      console.log(data);
    })
  }
//Chat window
  // Add participant messages
  function addParticipantsMessage (data) {
  var message = '';
  if (data.numUsers === 1) {
    message += "there's 1 participant";
  } else {
    message += "there are " + data.numUsers + " participants";
  }
  log(message);
}
  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
      if(message === '/roll')
        socket.emit('roll the dice', username);
    }
  }
  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }
  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);


  }
  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }
  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }
  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = false;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);

    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }
  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).html();
  }
  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }
  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }
//Callback functions
  function CallbackVariable(callback){
    socket.on('response room state', function(data){
      var scoreList = data.scoreList;
      L = data.length;
      message = "ScoreList: " + JSON.stringify(scoreList) + " Length: " + L;
      addPlayerScore({
        scoreList: data.scoreList
      });
      callback(data);
    });
  }
  function CallbackVariable1(callback){
    socket.on('check username result', function(data){
      // If the username is valid
      if (data.valid && data.username) {
        // Tell the server your username
        username = data.username;
        socket.emit('add user', username);

        $loginPage.fadeOut();
        $chatPage.show();
        $loginPage.off('click');
        $currentInput = $inputMessage.focus();

        getRoomState();
      }
      else {

        alert("Invalid username");
      }
      callback(data);
    });
  }


// Keyboard events
  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });
  $inputMessage.on('input', function() {
    updateTyping();
  });
// Click events
  // trigger roll function when user click on Roll button
  $( "#Roll" ).click(function() {
    if(roll_permission)
    {
      //disable auto rolling
      clearTimeout(rolling_timeout)
      socket.emit('roll the dice',username)
      roll_permission= false;
    }
    else {
      alert("It's not your turn");
    }
  });
  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to Socket.IO Chat – ";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    socket.emit('request room state')
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  socket.on('disconnect', function () {
    log('you have been disconnected');
  });

  socket.on('reconnect', function () {
    log('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', function () {
    log('attempt to reconnect has failed');
  });

  socket.on('dice result', function (data) {
    var scoreList = data.scoreList;
    var player = data.username;
    var dice_value = data.value;
    message = " Player: " + player + " rolled " + dice_value;
    log(message);
    addPlayerScore({
      scoreList: data.scoreList
    });
  })
  socket.on('winner', function(data){
    message = " Player: " + data.username + " rolled " + data.value;
    log(message);
    addPlayerScore({
      scoreList: data.scoreList
    });
    log('Winner: '+ data.username);
  })

  socket.on('request roll',function(){
    roll_permission = true;
    log("your turn to roll")
    if(connected)
    {
      if(roll_permission)
      {
        //auto roll after 5 secs
        rolling_timeout = setTimeout(function () {
          log("Auto rolled")
          roll_permission = false
          socket.emit('roll the dice',username)
        }, 5000);
      }
    }

  });
  socket.on("room full",function(){
    alert("Room is full");
    return;
  });

  socket.on("game start",function(){
    alert("Game started")
  })
});
