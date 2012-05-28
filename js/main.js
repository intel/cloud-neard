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
		adapter = tizen.nfc.getDefaultAdapter();
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
		outLog.innerHTML += "</ul>";
		for (var index=0; index < msg.recordCount; index++) {
			logRecord(msg.records[index]);
		}
		outLog.innerHTML += "</ul>";
	}
   
    // NFC Tag read callback
	function readOnAttach(nfcTag) {
		outLog.innerHTML += "<hr><b>Tag found</b><br>";
		outLog.innerHTML += "Tag type:" + nfcTag.type + "<br>";
		if (!nfcTag.isSupportedNDEF)
			return;
		nfcTag.readNDEF(logMessage);
	}
	
    // Manage NFC Tag reading
    function readNFCTag(enabled) {
    	if (enabled) {
    		adapter.setTagListener(readOnAttach);
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
    	var record = new NDEFRecordURI(content);
		messageToWrite = new NDEFMessage([record]);
		adapter.setTagListener(writeOnAttach);
    }
    function writeRecordText(content) {
    	readNFCTag(false);
    	var record = new NDEFRecordText(content,"en-US","UTF8");
		messageToWrite = new NDEFMessage([record]);
		adapter.setTagListener(writeOnAttach);
    }

//Initialize function
var init = function () {
	initPage();
};
// window.onload can work without <body onload="">
window.onload = init;

