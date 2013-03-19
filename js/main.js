	// HTML DOM elements
	var outLog, writeLog, recordContentText, ndefLog;
	
	// NFC global objects
	var adapter;

	// NFC agent to manage NDEF raw data
	var ndefAgent;
	var ndefAgentTagType;
	
	// HTML page management
	function initPage(error) {
		// init HTML DOM elements
		outLog = document.getElementById("outLog");
		writeLog = document.getElementById("writeLog");
		recordContentText = document.getElementById("recordContentText");
		ndefLog = document.getElementById("ndefLog");
		// init NFC global objects
		if (error) {
			adapter = null;
			debugLog(error);
		} else {
			adapter = nfc.getDefaultAdapter();
			adapter.setPowered(true);
			// initial state with tag reading disabled
			readNFCTag(false);
		}
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
		nfcTag.readNDEF(logMessage);
	}
	

    // Manage NFC Tag reading
	function readNFCTag(enabled) {
		adapter.setPolling(enabled);
		if (enabled) {
			adapter.setTagListener({onattach: readOnAttach, ondetach: function(){outLog.innerHTML += "<br><b>Tag was read, detached</b><br>";}});
			document.tagManagement.tagListener[0].checked="true";
		}
		else {
			adapter.unsetTagListener();
			document.tagManagement.tagListener[1].checked="true";
		}
	}


    // NFC Tag write callback
    var messageToWrite;
	function writeOnAttach(nfcTag) {
		if (!messageToWrite)
			alert("No message to write");
		nfcTag.writeNDEF(messageToWrite);
		if (messageToWrite.records[0].text)
			writeLog.innerHTML = "<b>Wrote text message:</b> " + 
								messageToWrite.records[0].text;
		else if (messageToWrite.records[0].uri)
			writeLog.innerHTML = "<b>Wrote URI:</b> " + 
								messageToWrite.records[0].uri;
		else
			writeLog.innerHTML = "<b>Wrote undefined content</b> ";
	}    

    // Manage NFC Tag writing
    function writeRecordURL(content) {
		readNFCTag(false);
		var record = new NDEFRecordURI(content);
		messageToWrite = new NDEFMessage([record]);
		adapter.setTagListener({onattach: writeOnAttach, ondetach: function() {
			outLog.innerHTML += "<br><b>URI was written, detached</b><br>";
			adapter.unsetTagListener();
			}
		});
		adapter.setPolling(true);
    }
    function writeRecordText(content) {
		readNFCTag(false);
		var record = new NDEFRecordText(content,"en-US","UTF-8");
		messageToWrite = new NDEFMessage([record]);
		adapter.setTagListener({onattach: writeOnAttach, ondetach: function() {
			outLog.innerHTML += "<br><b>Text was written, detached</b><br>";
			adapter.unsetTagListener();
			}
		});
		adapter.setPolling(true);
    }

    // NDEF Agent Management
    function ndefLog_func(func_name, log_str) {
    	ndefLog.innerHTML += "<br>" + func_name + " : " + log_str;
   }
    
    function NdefAgentRegisteredSuccessCB(NDEFAgent) {
    	ndefLog.innerHTML += "<br>main: " + arguments.callee.name + "<br>";
    	ndefAgent = NDEFAgent;
    }
    
    function NdefAgentRegisteredErrorCB(error) {
    	if (error.desc == undefined) {
        	ndefLog.innerHTML += "<br>main: " + arguments.callee.name + "<b> >> " + error + "</b><br>";
    	} else {
        	ndefLog.innerHTML += "<br>main: " + arguments.callee.name + "<b> >> " + error.desc + "</b><br>";
    	}
    }
    
    function ServiceAddedSuccessCB(service) {
    	ndefLog.innerHTML += "<br>main: " + arguments.callee.name + "<br>";
    	nfc.registerNdefAgent(ndefAgentTagType, ndefLog_func, NdefAgentRegisteredSuccessCB, NdefAgentRegisteredErrorCB);
    }
    
    function ServiceAddedErrorCB(error) {
    	if (error.desc == undefined) {
        	ndefLog.innerHTML += "<br>main: " + arguments.callee.name + "<b> >> " + error + "</b><br>";
    	} else {
        	ndefLog.innerHTML += "<br>main: " + arguments.callee.name + "<b> >> " + error.desc + "</b><br>";
    	}
    }
    
    function registerNDEFAgent(tagType) {
    	nfc.registerNdefAgent(tagType, ndefLog_func, NdefAgentRegisterSuccessCB, NdefAgentRegisterErrorCB);
    }
    
    function NdefAgentUnregisterSuccessCB(NDEFAgent) {
    	ndefLog.innerHTML += "<br>main: " + arguments.callee.name + "<br>";
    	ndefAgent = null;
    }
    
    function NdefAgentUnregisterErrorCB(error) {
    	ndefLog.innerHTML += "<br>main: " + arguments.callee.name + "<b> >> " + error + "</b><br>";
    }
    
    function unregisterNDEFAgent(tagType) {
    	nfc.unregisterNdefAgent(tagType, NdefAgentUnregisterSuccessCB, NdefAgentUnregisterErrorCB);
    }
    
    function serviceReleaseSuccessCB(service) {
    	ndefLog.innerHTML += "<br>main: serviceReleaseSuccessCB<br>";
    }
    
    function serviceReleaseErrorCB(error) {
    	ndefLog.innerHTML += "<br>main: serviceReleaseErrorCB: <b>" + error + "</b>";
    }
    
    function unregisterService() {
    	nfc.unregisterService(serviceReleaseSuccessCB, serviceReleaseErrorCB);
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
		var cloudeebusURI = "ws://localhost:9000";
		nfc.init(cloudeebusURI, 
				manifest,
				initPage,
				initPage);
	};
	// window.onload can work without <body onload="">
	window.onload = init;

