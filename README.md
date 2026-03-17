LLM Token Management with NGINX
===============================

This proof of concept demonstrates token obserability and implements token quotas for LLM clients and agents.


## Token Metrics

LLM tokens are counted separately in the request and the response. The metrics are exposed via a Prometheus endpoint at **/metrics**. Metrics can be keyed against any attribute of the request (configurable). By default counters are available per request URI.

A simple JavaScript function uses regular expressions and heuristics to estimate the number of tokens. More precise (per-model-accurate) counting can be performed by replacing the `estimateTokenCount()` function in [tokenx.js](conf.d/tokenx.js).

The number of tokens in the request is returned as a repsonse header, `Request-Tokens`. The number of tokens in the response is returned as a response _trailer_, `Response-Tokens` (as the count is not known until the last byte has been read and we don't want to delay sending the response to the client).


## Token Quotas

Clients, agents or authenticated **users** can be provided a maximum **quantity** of tokens that they can consume per given **time period**. Each of these parameters can be configured in [server.conf](conf.d/server.conf).

For each unique client, the quota starts at the maximum limit and is decremented by the number of tokens consumed. Both the request and response tokens are counted against the quota to simulate the true cost of processing them. The metrics logic is used to perform the token counting (so it only happens once).

In all cases, `RateLimit-Policy` and `RateLimit` response fields are returned to the client which describes the quota policy and the remaining quota per [draft-ietf-httpapi-ratelimit-headers-10](https://www.ietf.org/archive/id/draft-ietf-httpapi-ratelimit-headers-10.html). The `RateLimit` response field is either a header (when exhausted) or a trailer (when quota remains).

### Behavior

* The quota check is performed _before_ reading the body from the client. If the quota is exhausted a `429` response is returned to the client.
* Quotas are generous; so long as at least one token is remaining in the quota, any number of tokens can be consumed.
* Even if the tokens in the request body would be enough to exhaust the quota, the request is passed.
* The work to decrement the quota is performed after the last byte is sent to the client (when the trailer field is generated).

## Docker Container Demo

1. Start the demo container (it requires the `nginx:latest` Docker Official Image)
```
docker-compose up
```

2. Send a simple request to the **echo** endpoint
```
curl -id "is this thing working?" http://localhost:9001/echo
```
> Note the `Request-Tokens` header, `Response-Tokens` trailer, and `RateLimit` trailer.

3. Retrieve a large resource from the **books** endpoint.
```
curl -i http://localhost:9001/books/
```
> Note that token counting does not block/buffer the response and the `RateLimit` trailer is now a negative number.

4. Try the **echo** endpoint again, now that the quota is exhausted.
```
curl -i http://localhost:9001/echo
```
> Try again at the top of the hour when the quota has been reset

5. Request the Prometheus **metrics** endpoint
```
curl -i http://localhost:9001/metrics
```
> Note the separate request and response counters for each URI we accessed.
