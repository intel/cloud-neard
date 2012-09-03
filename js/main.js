	// HTML DOM elements
	var outLog, writeLog, recordContentText;
	
	// NFC global objects
	var adapter;
	
	// HTML page management
	function initPage() {
		// init HTML DOM elements
		outLog = document.getElementById("outLog");
		writeLog = document.getElementById("writeLog");
		recordContentText = document.getElementById("recordContentText");
		// init NFC global objects
		adapter = nfc.getDefaultAdapter();
		adapter.setPowered(true);
		// initial state with tag reading disabled
		readNFCTag(false);
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
		if (!nfcTag.isSupportedNDEF)
			return;
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
    	var record = new tizen.NDEFRecordURI(content);
		messageToWrite = new tizen.NDEFMessage([record]);
		adapter.setTagListener({onattach: writeOnAttach, ondetach: function(){outLog.innerHTML += "<br><b>URI was written, detached</b><br>";}});
    }
    function writeRecordText(content) {
    	readNFCTag(false);
    	var record = new tizen.NDEFRecordText(content,"en-US","UTF8");
		messageToWrite = new tizen.NDEFMessage([record]);
		adapter.setTagListener({onattach: writeOnAttach, ondetach: function(){outLog.innerHTML += "<br><b>Text was written, detached</b><br>";}});
    }

	//
	// Debug log function
	//

	function debugLog(msg) {
		alert(msg);
	}
	
	//
	// Main Init function
	//

	var init = function () {
		var cloudeebusURI = "ws://localhost:9000";
		nfc.init(cloudeebusURI, 
				initPage,
				debugLog);
	};
	// window.onload can work without <body onload="">
	window.onload = init;

