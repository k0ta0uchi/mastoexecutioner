require('date-utils');
const fs    = require('fs'),
      Masto = require('mastodon'),
      auth  = require('./auth');

const INTERVAL_SEC = 2;         // interval for accessing accounts' statuses.
const FOLLOWINGS_LIMIT = 80;    // number of following limit when retrieving accounts.
const GUILTY_PERIOD = 14        // in days
const EXECUTE_UNDEFINED = true  // unfollow who does not have toot (if remote account, we can't access to whole status that account has, so be careful enabling it.)

// get prefs from pref.json.
var pref;
try {
    pref = JSON.parse(fs.readFileSync('pref.json', 'utf-8'));
}
catch(e) {
    // auth process.
    auth();
    return;
}

// get whitelist from whitelist.txt
var whitelist;
try {
    whitelist = fs.readFileSync('whitelist.txt', 'utf8').split('\r');
}
catch(e) {
    whitelist = [];
}

// instance initialzation
let M = new Masto({
    access_token: pref.access_token,
    timeout_ms: 60 * 1000,
    api_url: 'https://' + pref.domain + '/api/v1/',
});

// get account's id to follow.
M.get('accounts/verify_credentials',{})
.then(res => {
    getFollowings(res.data.id, []);
});

/**
 * get all following accounts and put into an array.
 * @param {number} id      // account's id to follow.
 * @param {array} accounts // following accounts.
 * @param {number} max_id  // next page's max_id. (option)
 */
var getFollowings = (id, accounts, max_id) => {
    console.log('max_id: '+ max_id);

    if(max_id == undefined)
    {
        max_id = '';
    }
    // get following accounts by page
    M.get('accounts/' + id + '/following',{
        max_id: max_id,
        limit: FOLLOWINGS_LIMIT
    })
    .then(res => {
        accounts = accounts.concat(res.data);

        // scrape next page's max_id.
        /.*?max_id=(\d*)?>/.exec(res.resp.headers.link);
        var _max_id = RegExp.$1;

        // if max_id available, process getFollowings recursively.
        if(_max_id != 'https:')
        {
            getFollowings(id, accounts, _max_id);
        }
        else
        {
            console.log("Total accounts: " + accounts.length);

            // if all accounts obtained, proceed to next step, executing accounts.
            ExecuteAccounts(accounts);
        }
    });
};

/**
 * Execute(unfollow) account if GUILTY_PERIOD(days) has passed with latest toot.
 * @param {array} accounts 
 */
var ExecuteAccounts = (accounts) => {
    var q = new TimedQueue(INTERVAL_SEC * 1000);
    
    accounts.forEach(account => {
        if(whitelist.indexOf(account) === -1) {
            q.add(() => {
                M.get('accounts/' + account.id + '/statuses')
                .then(res => {
                    let status = res.data[0];
                    if (status !== undefined) {
                        let lastest_date = new Date(status.created_at);
                        let days_passed = lastest_date.getDaysBetween(new Date());
                        
                        console.log('account: ' + account.acct + ' id: ' + account.id);
                        console.log('tooted ' + days_passed + ' day(s) ago.');

                        if(days_passed >= GUILTY_PERIOD) {
                            ExecuteAccount(account);
                        }
                    } else {
                        console.log('status not found: ' + account.acct);
                        if(EXECUTE_UNDEFINED){
                            ExecuteAccount(account);
                        }
                    }
                    console.log("------------------------------");
                })
            })    
        }
    });
    q.run();
};

/**
 * Execute (unfollow) account
 * @param {object} account 
 */
var ExecuteAccount = (account) => {
    M.post('accounts/' + account.id + '/unfollow')
    .then(res => {
        console.log(res.data);
        console.log('unfollowed: ' + account.acct);
    });
}

class TimedQueue {
    constructor(defaultDelay) {
        this.queue = [];
        this.index = 0;
        this.defaultDelay = defaultDelay || 3000;
    }
    add(fn, delay) {
        this.queue.push({
            fn: fn,
            delay: delay
        })
    }
    run(index) {
        (index || index === 0) && (this.index = index);
        this.next();
    }
    next() {
        var self = this
        , i = this.index++
        , at = this.queue[i]
        , next = this.queue[this.index]
        if(!at) return;
        at.fn();
        next && setTimeout(() => {
            self.next();
        }, next.delay || this.defaultDelay);
    }
    reset() {
        this.index = 0;
    }
}
