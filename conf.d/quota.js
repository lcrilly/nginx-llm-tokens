export default { check, remaining, resetSecs }

function check(r) {
	if (r.variables.token_quota_key == '') {
		ngx.log(ngx.WARN, 'QUOTA KEY IS EMPTY');
		r.status = 401;
	} else {
		if (ngx.shared.token_quotas.get(r.variables.token_quota_key) == undefined) {
      const resetAt = getNext(r.variables.token_quota_period);
			ngx.log(ngx.WARN, 'QUOTA INIT [' + r.variables.token_quota_key + '] TO ' + r.variables.token_quota_qty + ' EXPIRES ' + resetAt.valueOf());
			ngx.shared.token_quotas.add(r.variables.token_quota_key, Number(r.variables.token_quota_qty), resetAt.valueOf());
			r.status = 204;
		} else if (ngx.shared.token_quotas.get(r.variables.token_quota_key) < 1) {
			ngx.log(ngx.WARN, 'QUOTA EXHAUSTED FOR ' + r.variables.token_quota_key);
			r.status = 403;
//    } else if (ngx.shared.token_quotas.get(r.variables.token_quota_key) < count.getRequestTokens()) {
//			ngx.log(ngx.WARN, 'INSUFFICIENT QUOTA FOR REQUEST ' + r.variables.token_quota_key);
//      r.status = 421;
		} else {
			r.status = 204;
		}
	}
	r.finish();
}

function remaining(r) {
  var incr = 0;
  incr -= count.getRequestTokens();
  incr -= count.getResponseTokens();
  ngx.shared.token_quotas.incr(r.variables.token_quota_key, incr);
  return ngx.shared.token_quotas.get(r.variables.token_quota_key);
}

function resetSecs(r) {
  var eop = getNext(r.variables.token_quota_period).valueOf();
  var now = new Date().valueOf();
  return Math.round((eop - now) / 1000);
}

function getNext(unit) {
  const now = new Date();

  if (unit === '2mins') {
    // next hour at hh:00
    const d = new Date(now);
    d.setHours(d.getHours(), d.getMinutes() + 2, 0, 0); // +2 mins
    return d;
  }

  if (unit === 'hour') {
    // next hour at hh:00
    const d = new Date(now);
    d.setHours(d.getHours() + 1, 0, 0, 0);       // +1 hour
    return d;
  }

  if (unit === 'day') {
    // next day at midnight (tomorrow 00:00 local)
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);                      // today at midnight
    d.setDate(d.getDate() + 1);                  // +1 day
    return d;
  }

  if (unit === 'week') {
    // next calendar week: Monday 00:00 of the next week
    const d = new Date(now);
    const day = d.getDay();                      // 0=Sun,...,1=Mon
    const daysUntilMonday = (8 - day) % 7 || 7;
    d.setHours(0, 0, 0, 0);                      // today at midnight
    d.setDate(d.getDate() + daysUntilMonday);    // move to next Monday
    return d;
  }

  if (unit === 'month') {
    // first day of next month at midnight
    const year = now.getFullYear();
    const month = now.getMonth();                // 0-based month
    return new Date(year, month + 1, 1, 0, 0, 0, 0); // first of next month 00:00
  }

  throw new Error("unit must be 'day', 'week' or 'month'");
}
