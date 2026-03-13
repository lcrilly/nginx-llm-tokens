export default { check, decrement }

var resetMillisecs = undefined;

function check(r) {
	if (r.variables.token_quota_key == '') {
		ngx.log(ngx.WARN, 'QUOTA KEY IS EMPTY');
		r.status = 401;
	} else {
    resetMillisecs = untilNext(r.variables.token_quota_period);
		if (ngx.shared.token_quotas.get(r.variables.token_quota_key) === undefined) {
			ngx.log(ngx.WARN, 'QUOTA INIT [' + r.variables.token_quota_key + '] TO ' + r.variables.token_quota_qty + ' EXPIRES ' + resetMillisecs);
			ngx.shared.token_quotas.add(r.variables.token_quota_key, Number(r.variables.token_quota_qty), resetMillisecs);
			r.status = 204;
		} else if (ngx.shared.token_quotas.get(r.variables.token_quota_key) < 1) {
			ngx.log(ngx.WARN, 'QUOTA EXHAUSTED FOR ' + r.variables.token_quota_key);
			r.status = 403;
//    } else if (ngx.shared.token_quotas.get(r.variables.token_quota_key) < count.getRequestTokens()) {
//			ngx.log(ngx.WARN, 'INSUFFICIENT QUOTA FOR REQUEST ' + r.variables.token_quota_key);
//      r.status = 421;
		} else {
      ngx.log(ngx.WARN, 'HAS QUOTA FOR ' + r.variables.token_quota_key);
			r.status = 204;
		}
	}
	r.finish();
}

function decrement(r) {
  // might need to check for undefined;
  if (resetMillisecs === undefined) {
    resetMillisecs = untilNext(r.variables.token_quota_period);
  }

  var incr = 0;
  incr -= count.getRequestTokens();
  incr -= count.getResponseTokens();
  ngx.log(ngx.WARN, 'DECREMENTING QUOTA (' + incr + ') FOR ' + r.variables.token_quota_key);
  ngx.shared.token_quotas.incr(r.variables.token_quota_key, incr, resetMillisecs);

  return 'r=' + ngx.shared.token_quotas.get(r.variables.token_quota_key) + ';t=' + Math.round(resetMillisecs / 1000);
}

function resetSecs(r) {
}

function untilNext(unit) {
  const now = new Date();

  if (unit === '2mins') {
    resetMillisecs = 120000;     // +2 mins
  } else if (unit === 'hour') {
    // next hour at hh:00
    const d = new Date(now);
    d.setHours(d.getHours() + 1, 0, 0, 0);       // +1 hour
    resetMillisecs = d.valueOf() - now.valueOf();
  } else if (unit === 'day') {
    // next day at midnight (tomorrow 00:00 local)
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);                      // today at midnight
    d.setDate(d.getDate() + 1);                  // +1 day
    resetMillisecs = d.valueOf() - now.valueOf();
  } else if (unit === 'week') {
    // next calendar week: Monday 00:00 of the next week
    const d = new Date(now);
    const day = d.getDay();                      // 0=Sun,...,1=Mon
    const daysUntilMonday = (8 - day) % 7 || 7;
    d.setHours(0, 0, 0, 0);                      // today at midnight
    d.setDate(d.getDate() + daysUntilMonday);    // move to next Monday
    resetMillisecs = d.valueOf() - now.valueOf();
  } else if (unit === 'month') {
    // first day of next month at midnight
    const year = now.getFullYear();
    const month = now.getMonth();                // 0-based month
    const d = new Date(year, month + 1, 1, 0, 0, 0, 0);
    resetMillisecs = d.valueOf() - now.valueOf();
  } else {
    var e = "unsupported quota period, '" + unit + "'";
    ngx.log(ngx.ERR, e);
    throw new Error(e);
  }

  return resetMillisecs;
}
