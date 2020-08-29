# create c2c oauth2 server certificate with unencrypted key.
# CN must match the host part in the URL

	(cd certificates; openssl req -x509 -sha256 -nodes -newkey rsa:2048 -keyout key.pem -out cert.pem -days 10000)
