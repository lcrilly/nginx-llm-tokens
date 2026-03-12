export default {echo}

function echo(r) {
    var headers = {};
    for (var h in r.headersIn) {
        headers[h] = r.headersIn[h];
    }

	var retStatus;
	if (r.variables.request_method == "POST") {
		retStatus = 201;
	} else if (r.variables.request_method == "DELETE") {
		retStatus = 204;
	} else {
		retStatus = 200;
	}

    var req = { "client": r.variables.remote_addr, "port": Number(r.variables.server_port), "host": r.variables.host, "method": r.variables.request_method, "uri": r.uri, "httpVersion": r.httpVersion, "headers": headers, "body": r.variables.request_body }
    var res = { "status": retStatus, "timestamp": r.variables.time_iso8601 }

    r.return(retStatus, JSON.stringify({ "request": req, "response": res }) + '\n');
}
