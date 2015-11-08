doggfood
========

This is an example app of how to build a leaderboard using the WordPress.com API.

### How It Works

The app keeps track of user scores by their WordPress.com username, which is mapped from their Github username in `players.js`.  Post counts are summarized in `post-counts.js` and Github scores are incremented using a github issue webhook that `POST`s to `/github/issue`.

### Deploy & Hosting

You will need a WordPress.com site and associated bearer token to run the code.  Both of these should be configured in `config.js`.  You can then run the code locally or any host that supports node.js apps.

### TODO

- Look at caching the api responses that build the leaderboard, it is sloooow currently
- eat a steak with snoop lion
