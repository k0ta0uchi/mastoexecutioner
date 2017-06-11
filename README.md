# MastoExecutioner

An executioner of mastodon who unfollows not active tooter.

## How to use.
Install dependencies using `npm install`.

Exec `node app.js`.  
First time you launch, you'll be asked which instance to follow and instance that unfollow accounts.  
Follow the instruction provided.  

Exec `node app.js` and that's it!!

## Using whitelist
### Use whitelist to avoid executing your favorite accounts.
Create text file called `whitelist.txt`.

Add accounts. One account for each line.

__Example:__
```
xxxxx@xxxx.net
yyyyy@yyyy.com
zzzzz@zzzz.jp
````

