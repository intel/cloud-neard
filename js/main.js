	// HTML DOM elements
	var outLog, writeLog, recordContentText;
		
	// HTML page management
	function initPage() {
		// init HTML DOM elements
		outLog = document.getElementById("outLog");
		writeLog = document.getElementById("writeLog");
		recordContentText = document.getElementById("recordContentText");
		// logging
		cloudeebus.log = function(str) {
			outLog.innerHTML += "<hr>[LOG]" + str + "<hr>";
		}
		// NFCManager event handlers
		nfc.onpollstart = function(event) {
			cloudeebus.log(JSON.stringify(event));
		};
		nfc.onpollstop = function(event) {
			cloudeebus.log(JSON.stringify(event));
		};
		// initial state with tag reading disabled
		nfcListen(false);
	}
	
	function clearResults() {
		outLog.innerHTML='';
		writeLog.innerHTML='';
		recordContentText.value='';		
	}

	// NDEF Message log
    function logRecord(rec) {
		if (rec.text)
			outLog.innerHTML += "<li>" + rec.text + " ("
			+ rec.encoding + " / "
			+ rec.languageCode + ")</li>";
		else if (rec.uri)
			outLog.innerHTML += "<li><a href='" + rec.uri + "'>"
					+ rec.uri + "</a></li>";
    }

    function logMessage(msg) {
		outLog.innerHTML +=  "<ul>";
		for (var index=0; index < msg.records.length; index++) {
			logRecord(msg.records[index]);
		}
		outLog.innerHTML += "</ul>";
	}
   
    // NFC Tag read callback
	function readOnAttach(nfcTag) {
		outLog.innerHTML += "<hr><b>Tag found</b><br>";
		outLog.innerHTML += "Tag type:" + nfcTag.type + "<br>";
		nfcTag.readNDEF().then(logMessage);
	}
	
    // NFC Peer read callback
    function peerOnAttach(peer) {
		outLog.innerHTML += "<br><b>Peer detected</b><br>";
		peer.setReceiveNDEFListener(logMessage);
	}

    // Manage NFC Tag / peer listening
	function nfcListen(enabled) {
		if (enabled) {
			nfc.ontagfound = function(event) {
				cloudeebus.log(JSON.stringify(event));
				readOnAttach(event.param);
			};
			nfc.ontaglost = function(event) {
				cloudeebus.log(JSON.stringify(event));
				outLog.innerHTML += "<br><b>Tag detached</b><hr>";
			};
			nfc.onpeerfound = function(event) {
				cloudeebus.log(JSON.stringify(event));
				peerOnAttach(event.param);
			};
			nfc.onpeerlost = function(event) {
				cloudeebus.log(JSON.stringify(event));
				outLog.innerHTML += "<br><b>Peer detached</b><hr>";
			};
			nfc.startPoll().then(function() {
				document.tagManagement.tagListener.selectedIndex=1;
			});
		}
		else {
			nfc.ontagfound = null;
			nfc.ontaglost = null;
			nfc.onpeerfound = null;
			nfc.onpeerlost = null;
			nfc.stopPoll().then(function() {
				document.tagManagement.tagListener.selectedIndex=0;
			});
		}
	}


    // NFC Tag write callback
    var messageToWrite;

    function writeSuccess() {
		if (messageToWrite.records[0].text)
			writeLog.innerHTML = "<b>Wrote text message:</b> " + 
								messageToWrite.records[0].text;
		else if (messageToWrite.records[0].uri)
			writeLog.innerHTML = "<b>Wrote URI:</b> " + 
								messageToWrite.records[0].uri;
		else
			writeLog.innerHTML = "<b>Wrote undefined content</b> ";
	}
	
	function writeError(err) {
		writeLog.innerHTML = "<b>Writing failed</b><br>";
		writeLog.innerHTML += err;
	}
    
	function tagWriteOnAttach(nfcTag) {
		if (!messageToWrite)
			alert("No message to write");
		nfcTag.writeNDEF(messageToWrite).then(writeSuccess, writeError);
	}    

	function peerWriteOnAttach(nfcPeer) {
		if (!messageToWrite)
			alert("No message to send");
		nfcPeer.sendNDEF(messageToWrite, writeSuccess, writeError);
	}    

	function writeOnDetach() {
		outLog.innerHTML += "<br><b>Tag / Peer detached</b><br>";
		nfcListen(true);
	}
	
    // Manage NDEF message writing

    function writeMessage() {
		nfc.ontagfound = function(event) {
			cloudeebus.log(JSON.stringify(event));
			tagWriteOnAttach(event.param);
		};
		nfc.ontaglost = writeOnDetach;
		nfc.onpeerfound = function(event) {
			cloudeebus.log(JSON.stringify(event));
			peerWriteOnAttach(event.param);
		};
		nfc.onpeerlost = writeOnDetach;
		nfc.startPoll();
    }

    function writeRecordURL(content) {
		nfcListen(false);
		writeLog.innerHTML = "Approach Tag / Peer to write URI...";
		var record = new NDEFRecordURI(content);
		messageToWrite = new NDEFMessage([record]);
		writeMessage();
    }

    function writeRecordText(content) {
		nfcListen(false);
		writeLog.innerHTML = "Approach Tag / Peer to write Text...";
		var record = new NDEFRecordText(content,"en-US","UTF-8");
		messageToWrite = new NDEFMessage([record]);
		writeMessage();
    }
    
	//
	// Debug log function
	//

	function debugLog(msg) {
		alert(msg);
	}
	
	//
	// Cloudeebus manifest
	//

	var manifest = {
			name: "cloud-neard",
			version: "development",
			key: "Neard",
			permissions: [
				"org.neard"
			]
	};
	
	//
	// Main Init function
	//

	var init = function () {
		var cloudeebusHost = "localhost";
		var cloudeebusPort = "9000";
		var queryString = window.location.toString().split("\?")[1];
		if (queryString) {
			var getVars = queryString.split("\&");
			for (var i=0; i<getVars.length; i++) {
				var varVal = getVars[i].split("\=");
				if (varVal.length == 2) {
					if (varVal[0] == "host")
						cloudeebusHost = varVal[1];
					else if (varVal[0] == "port")
						cloudeebusPort = varVal[1];
				}
			}
		}
		var cloudeebusURI = "ws://" + cloudeebusHost + ":" + cloudeebusPort;
		nfc._init(cloudeebusURI, manifest).then(initPage, debugLog);
	};
	// window.onload can work without <body onload="">
	window.onload = init;

