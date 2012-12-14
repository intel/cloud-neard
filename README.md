
cloud-neard
============

cloud-neard - neard for the Cloud - is a Web Application that demonstrates the Neard NFC APIs.


Requirements
------------

  * [neard](http://git.kernel.org?p=network/nfc/neard.git)
  * [Cloudeebus](https://github.com/01org/cloudeebus)


Running the server
------------------

The neard daemon and the Cloudeebus python server must be already installed. The neard daemon
must be launched before running Cloudeebus.

	cd js/lib/config
	./cloudeebus.sh


Acknowledgements
----------------

cloud-neard includes libraries from the following open-source projects:

  * [Cloudeebus](https://github.com/01org/cloudeebus) ([Apache 2.0](http://opensource.org/licenses/Apache-2.0) License)
  * [AutobahnJS](http://autobahn.ws/js) ([MIT](http://opensource.org/licenses/MIT) License)
