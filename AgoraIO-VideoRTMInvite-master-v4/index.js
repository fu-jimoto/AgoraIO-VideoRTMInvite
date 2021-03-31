var client = AgoraRTC.createClient({ mode: "live", codec: "vp8", role:"host" });

var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var remoteUsers = {};

// Agora client options
var options = {
  appid: "***",
  channel_rtm: "demo",
  channel: null,
  uid: null,
  token: null
};

var camera, microphone;
var clientRtm, channelRtm, currentMessage;
var random = Math.floor( Math.random() * 99999 ) + 1;
var uidRtm;

getDevices();

function refresh(){
  $('div#useradd').empty();
  var result = new Promise(function(resolve) {
    resolve(channelRtm.getMembers());
  })
  result.then( function(data){ 
    for(let i = 0; i < data.length; i++) {
	var txt;
        if (data[i]==options.uid){
          txt=data[i] + "(you)";
        }else{
          txt=data[i];
        }
        appendProc(data[i],txt);
    }
  } );
}

function appendProc(str1,str2){
$('div#useradd').append('<button class="ui-btn ui-icon-phone ui-btn-icon-right" onclick="call(\''+ str1 +'\')">'+ str2 +'</button>');
}

function reset(){
  $("#loginId").val("");
  $('div#useradd').empty();
  document.getElementById("leave").disabled = false;

}

function cancel(){
   console.log("Cancel start");
   logout();
   reset();
   $.mobile.changePage('#top', { transition: 'slidedown'});
   console.log("Cancel complete");
}


function call(memberId){
  var result = confirm('Do you invite ' + memberId + '?');
  if(result) {
    sendChannelMessage2(memberId);
    $.mobile.changePage('#sub2', { transition: 'slidedown'});
  }
}


function login(){
    //Create an Instance and Channel
    clientRtm = AgoraRTM.createInstance(options.appid);
    channelRtm = clientRtm.createChannel(options.channel_rtm);

    //Set a listener to the connection state change
    clientRtm.on("ConnectionStateChange", function (newState, reason) {
        console.log("on connection state changed to " + newState + " reason:" + reason);
    });
    //Log in the Agora RTM system
    if ($("#loginId").val() == ""){
	$("#loginId").val(random);
    }
    uidRtm=$("#loginId").val();
    //channelName=uidRtm;
    options.uid=$("#loginId").val();
    options.channel=$("#loginId").val();
    
    console.log("uidRtm:" + options.uid);
    clientRtm.login({uid: options.uid}).then(function(){
        console.log("AgoraRTM client login success");
	  channelRtm.join().then(function(){
	    console.log("AgoraRTM client join success");
            appendProc(options.uid,options.uid + "(you)");
	    receiveChannelMessage();
	  }).catch(function (err){
	    console.log("AgoraRTM client join failure, ", err);
	  });

    }).catch(function(err){
        console.log("AgoraRTM client login failure, ", err);
    });
   $.mobile.changePage('#sub1', { transition: 'slidedown'});


}

function logout(){
  console.log("RTM Logout start ");
  channelRtm.leave();
  clientRtm.logout();
  console.log("RTM Logout completed ");
}

async function join() {

  var token = null;

  $.mobile.changePage('#sub3', { transition: 'slidedown'});

  console.log("Init AgoraRTC client with App ID: " + options.appid);
  var uid = null;
  setUid = $("#loginId").val();

  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [ options.uid, localTracks.audioTrack, localTracks.videoTrack ] = await Promise.all([
    // join the channel
    client.join(options.appid, options.channel, options.token || null,options.uid),
    // create local tracks, using microphone and camera
    AgoraRTC.createMicrophoneAudioTrack(),
    AgoraRTC.createCameraVideoTrack()
  ]);
  
  // play local video track
  localTracks.videoTrack.play("agora_local");

  // publish local tracks to channel
  await client.publish(Object.values(localTracks));
  console.log("publish success");

}

async function leave() {

  document.getElementById("leave").disabled = true;

  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // remove remote users and player views
  remoteUsers = {};

  // leave the channel
  await client.leave();

  await logout();

  await reset();

  $.mobile.changePage('#top', { transition: 'slidedown'});
  console.log("client leaves channel success");

}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {

    if ($('div#video #agora_remote' + uid).length === 0) {
      $('div#video').append('<div id="agora_remote' + uid + '" style="float:left; width:810px;height:607px;display:inline-block;"></div>');
    }
    user.videoTrack.play('agora_remote' + uid);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }

}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
  const id = user.uid;
  delete remoteUsers[id];
  //$(`#player-wrapper-${id}`).remove();
  $('#agora_remote' + id).remove();
}



function getDevices() {

  AgoraRTC.getDevices().then(devices => {
    console.log("first device id", devices.length);
    var len= devices.length;
    var audioSelect = document.querySelector('select#audioSource');
    var videoSelect = document.querySelector('select#videoSource');

    for (var i = 0; i !== len; ++i) {
      var device = devices[i];
      var option = document.createElement('option');
      option.value = device.deviceId;
      if (device.kind === 'audioinput') {
        option.text = device.label || 'microphone ' + (audioSelect.length + 1);
        audioSelect.appendChild(option);
      } else if (device.kind === 'videoinput') {
        option.text = device.label || 'camera ' + (videoSelect.length + 1);
        videoSelect.appendChild(option);
      } else {
        console.log('Some other kind of source/device: ', device);
      }
    }

  }).catch(e => {
  console.log("get devices error!", e);
  });
}

function sendChannelMessage2(memberId){
    
    var localMessage = "RequestCall:" + memberId;
    $("#confirmMsg").text("You invited " + memberId + ".");
    sendChannelMessage(localMessage);
}

function sendChannelMessage(msg){

    var localMessage = msg;
    channelRtm.sendMessage({text:localMessage}).then(function(){
        console.log("AgoraRTM client succeed in sending channel message: " + localMessage);
    }).catch(function(err){
        console.log("AgoraRTM client failed to sending role" + err);
    });

}

function receiveChannelMessage(){

    channelRtm.on("MemberJoined", memberId => {
      console.log("MemberJoined: " + memberId);
      appendProc(memberId,memberId);
    });

    channelRtm.on("ChannelMessage", function (sentMessage, senderId) {
        console.log("AgoraRTM client got message: " + JSON.stringify(sentMessage) + " from " + senderId);
	var msgtxt = sentMessage.text
	var result = msgtxt.split(':');
	console.log("msg1 " + result[0]);
	console.log("msg2 " + result[1]);
	if (result[0]=="RequestCall"){
	  if (options.uid == result[1]){
            console.log(senderId + "invited you.");
            $("#confirmMsg").text(senderId + " invited you.");
            options.channel = senderId;
            $.mobile.changePage('#sub2', { transition: 'slidedown'});
	  }
	}


    });
}

