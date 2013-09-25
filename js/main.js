	// HTML DOM elements
	var outLog, writeLog, recordContentText;
		
	// HTML page management
	function initPage() {
		// init HTML DOM elements
		outLog = document.getElementById("outLog");
		writeLog = document.getElementById("writeLog");
		recordContentText = document.getElementById("recordContentText");
		// NFCManager event handlers
		nfc.onpollstart = function(event) {
			document.tagManagement.tagListener.selectedIndex=1;
		};
		nfc.onpollstop = function(event) {
			document.tagManagement.tagListener.selectedIndex=0;
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
		outLog.innerHTML += "<dt>" + rec.recordType;
		if (rec.recordType == "text")
			outLog.innerHTML += "<dd>" + rec.text + " ("
			+ rec.encoding + " / "
			+ rec.languageCode + ")";
		else if (rec.recordType == "uri" || rec.recordType == "smartPoster")
			outLog.innerHTML += "<dd><a href='" + rec.uri + "'>"
					+ rec.uri + "</a>";
    }

    function logMessage(msg) {
		outLog.innerHTML +=  "<dl>";
		for (var index=0; index < msg.records.length; index++) {
			logRecord(msg.records[index]);
		}
		outLog.innerHTML += "</dl>";
	}
   
    // NFC Tag read callback
	function readOnAttach(nfcTag) {
		outLog.innerHTML += "<hr><b>Tag found</b><br>";
		nfcTag.readNDEF().then(logMessage);
	}
	
    // NFC Peer read callback
    function peerOnAttach(peer) {
		outLog.innerHTML += "<br><b>Peer detected</b><br>";
		peer.onmessageread = function(event) {
			logMessage(event.message);
		};
	}

    // Manage NFC Tag / peer listening
	function nfcListen(enabled) {
		if (enabled) {
			nfc.ontagfound = function(event) {
				readOnAttach(event.tag);
			};
			nfc.ontaglost = function(event) {
				outLog.innerHTML += "<br><b>Tag detached</b><hr>";
			};
			nfc.onpeerfound = function(event) {
				peerOnAttach(event.peer);
			};
			nfc.onpeerlost = function(event) {
				outLog.innerHTML += "<br><b>Peer detached</b><hr>";
			};
			nfc.startPoll().then(function() {
				outLog.innerHTML += "<hr><b>Tag / Peer read listeners registered</b><hr>";
			});
		}
		else {
			nfc.ontagfound = null;
			nfc.ontaglost = null;
			nfc.onpeerfound = null;
			nfc.onpeerlost = null;
			nfc.stopPoll().then(function() {
				outLog.innerHTML += "<hr><b>Tag / Peer read listeners removed</b><hr>";
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
		nfcPeer.sendNDEF(messageToWrite).then(writeSuccess, writeError);
	}    

	function writeOnDetach() {
		outLog.innerHTML += "<br><b>Tag / Peer detached</b><br>";
		nfcListen(true);
	}
	
    // Manage NDEF message writing

    function writeMessage() {
		nfc.ontagfound = function(event) {
			tagWriteOnAttach(event.tag);
		};
		nfc.ontaglost = writeOnDetach;
		nfc.onpeerfound = function(event) {
			peerWriteOnAttach(event.peer);
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

