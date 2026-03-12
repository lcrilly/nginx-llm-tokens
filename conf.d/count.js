export default { getRequestTokens, getResponseTokens, countRequestTokens, countResponseTokens, metrics }

import fs from 'fs';
var reqTokens = 0;
var resTokens = 0;

function getRequestTokens() {
	return reqTokens;
}

function getResponseTokens() {
	return resTokens;
}

function countRequestTokens(r) {
	if (r.variables.request_method.startsWith('P')) {
		if (r.variables.request_body_file) {
			try {
				ngx.log(ngx.WARN, 'Counting tokens from $request_body_file');
				var body = fs.readFileSync(r.variables.request_body_file);
				reqTokens = estimateTokenCount(body, {});
			} catch (e) {
				ngx.log(ngx.ERR, 'Unable to read temporary client body file for tokens. ' + e + ', ' + r.variables.request_body_file);
				return -1;
			}
		} else {
			ngx.log(ngx.WARN, 'Counting request tokens from $request_body');
			reqTokens = estimateTokenCount(r.variables.request_body, {});
		}
    //add to shared_dict
    if (r.variables.token_metrics_key == '') {
      ngx.log(ngx.WARN, 'Please set $token_metrics_key to collect token metrics');
    } else {
      if (ngx.shared.token_metrics_req.get(r.variables.token_metrics_key) == undefined) {
        //ngx.log(ngx.WARN, 'METRICS INIT FOR ' + r.variables.token_metrics_key);
        ngx.shared.token_metrics_req.add(r.variables.token_metrics_key, reqTokens);
      } else {
        //ngx.log(ngx.WARN, 'METRICS INCR FOR ' + r.variables.token_metrics_key);
        ngx.shared.token_metrics_req.incr(r.variables.token_metrics_key, reqTokens);
      }
    }
    return reqTokens;
	} else {
		return '';
	}
}

function countResponseTokens(r, data, flags) {
	resTokens += estimateTokenCount(data, {});
	r.sendBuffer(data, flags);
  if (flags.last) {
    //add to shared_dict
    if (r.variables.token_metrics_key == '') {
      ngx.log(ngx.WARN, 'Please set $token_metrics_key to collect token metrics');
    } else {
      if (ngx.shared.token_metrics_res.get(r.variables.token_metrics_key) == undefined) {
        //ngx.log(ngx.WARN, 'METRICS INIT FOR ' + r.variables.token_metrics_key);
        ngx.shared.token_metrics_res.add(r.variables.token_metrics_key, resTokens);
      } else {
        //ngx.log(ngx.WARN, 'METRICS INCR FOR ' + r.variables.token_metrics_key);
        ngx.shared.token_metrics_res.incr(r.variables.token_metrics_key, resTokens);
      }
    }
  }
}

function metrics(r) {
  var prom, metrics = [];
  ngx.shared.token_metrics_req.keys().forEach(k => metrics.push(`nginx_tokens{request="${k}"} ${ngx.shared.token_metrics_req.get(k)}`));
  ngx.shared.token_metrics_res.keys().forEach(k => metrics.push(`nginx_tokens{response="${k}"} ${ngx.shared.token_metrics_res.get(k)}`));
  prom = metrics.join('\n') + '\n';
  r.status = 200;
  r.headersOut['Content-Type'] = 'text/plain';
  r.headersOut['Content-Length'] = prom.length;
  r.sendHeader()
  r.send(prom);
  r.finish();
}

/*
 * Simplified from https://github.com/johannschopplich/tokenx (MIT license)
 */
function estimateTokenCount(text, options) {
  if (typeof text !== 'string' || text.length === 0) {
    return 0;
  }

  options = options || {};

  var defaultCharsPerToken =
    typeof options.defaultCharsPerToken === 'number'
      ? options.defaultCharsPerToken
      : 4;

  // Simple language-specific rules
  var languageConfigs =
    options.languageConfigs ||
    [
      // Whitespace and common punctuation
      { pattern: /[\s\.\,\!\?\;\:\-\(\)]/g, averageCharsPerToken: 1 },
      // Some accented Latin characters
      { pattern: /[éèêëàâîïäöüßñ]/gi, averageCharsPerToken: 3 },
      // Chinese characters
      { pattern: /[\u4e00-\u9fff]/g, averageCharsPerToken: 1.5 },
      // Cyrillic
      { pattern: /[\u0400-\u04ff]/g, averageCharsPerToken: 2.5 }
    ];

  var remainingText = text;
  var estimatedTokens = 0;

  for (var i = 0; i < languageConfigs.length; i++) {
    var cfg = languageConfigs[i];
    var matches = remainingText.match(cfg.pattern) || [];
    var matchedCharsLength = matches.join('').length;

    estimatedTokens += matchedCharsLength / cfg.averageCharsPerToken;

    // Remove matched characters from remaining text
    remainingText = remainingText.replace(cfg.pattern, '');
  }

  // Fallback for what is left
  estimatedTokens += remainingText.length / defaultCharsPerToken;

  return Math.round(estimatedTokens);
}
