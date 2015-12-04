/*
* Set the stage for amaze.
*/
var express = require( 'express' ),
	app = express(),
	bodyParser = require( 'body-parser' ),
	config = require( './config' );

// Setup some Express stuff
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( express.static( 'public' ) );
app.set( 'view engine', 'jade' );
app.set('port', (process.env.PORT || 5000));

var BEARER_TOKEN = config.wpcom_token || process.env.WPCOM_TOKEN;

var wpcom = require( 'wpcom' )( BEARER_TOKEN ), // new wpcom instance with our bearer token
	Players = require( './players' ), // an object of our players github -> wpcom user mappings
	WpcomUsers = require( './wpcom-users' ), // wpcom user id -> username mappings meh
	site = wpcom.site( config.wpcom_site || process.env.WPCOM_SITE ), // shortcut to the wpcom site we are using for data storage
	async = require( 'async' ),
	strip = require( 'strip' ),
	forEach = require( 'lodash/collection/forEach' ),
	assign = require( 'lodash/object/assign' ),
	sortByOrder = require( 'lodash/collection/sortByOrder' ),
	githubLabel = config.github_label || process.env.GITHUB_LABEL;

/*
* Helper functions
*/

function sortLeaders( posts ) {
	var leaders = posts.map( function( post ) {
		return assign( {}, getScores( post ), { username: post.slug } );
	} );
	return sortByOrder( leaders, [ 'total' ], [ 'desc' ] );
}

function getScores( post ) {
	var scoreAttr = strip( post.content ).split( '|' ),
		posts = parseInt( scoreAttr[ 0 ] ),
		issues = parseInt( scoreAttr[ 1 ] );

	return {
		id: post.ID,
		posts: posts,
		issues: issues,
		total: posts + issues
	};
}

function updateScores( scores, cb ) {
	var newContent = scores.posts + '|' + scores.issues;
	site.post( scores.id ).update( { content: newContent }, function( error, data ) {
		cb( error, data );
	} );
}

// creates a new post for a wpcom user with their login as the title and slug
function createPost( username, cb ) {
	site.addPost( {
		title: username,
		slug: username,
		content: "0|0"
	}, function( error, data ) {
		cb( getScores( data ) );
	} );
}

// make sure we have a post for this user
function ensurePost( username, cb ) {
	site.post( { slug: username } ).getBySlug( function ( error, data ) {
		if ( error ) {
			createPost( username, cb );
		} else {
			cb( getScores( data ) );
		}
	} );
}

// grab all players
function fetchPostData( posts, page, callback ) {
	site.postsList( { number: 100, page: page }, function( error, data ) {
		posts = posts.concat( data.posts );
		if ( posts.length !== data.found ) {
			page++;
			fetchPostData( posts, page++, callback );
		} else {
			callback( posts );
		}
	} );
}

/*
* Routes
*/

// Grab all posts from wpcom site, and build the leaderboard
app.get( '/', function ( req, res ) {
	fetchPostData( [], 1, function( posts ) {
		var players = sortLeaders( posts ),
			totalPosts = 0,
			totalIssues = 0;

		players.forEach( function( player ) {
			totalPosts += player.posts;
			totalIssues += ( player.issues / 2 )
		} );

		res.render( 'index', {
			title: 'Doggfodd Leaderboard',
			totalPlayers: players.length,
			players: players,
			totalPosts: totalPosts,
			totalIssues: totalIssues
		} );
	} );
} );

// Github Issue Hook
app.post( '/github/issue', function( req, res ) {
	var data = req.body,
		label = data.label && data.label.name ? data.label.name : null;

	if ( data.action === 'labeled' && label === githubLabel ) {
		var user = data.sender.login.toLowerCase(),
			issueNumber = data.issue ? data.issue.number : null;
			username = Players[ user ];

		if ( ! username || ! issueNumber ) {
			res.send( 'nope' );
		} else {
			async.waterfall( [
				function( callback ) {
					ensurePost( username, function( scores ){
						callback( null, scores );
					} );
				},
				function( scores, callback ) {
					scores.issues += 2;
					updateScores( scores, callback );
				}
			], function() { res.send( 'OK' ) } );
		}
	} else {
		res.send( 'nothing to do here' );
	} 
} );

// Simple webhook from our blog POST's here, and the post author gets a point
app.post( '/webhook', function( req, res ) {
	var data = req.body,
    	username = WpcomUsers[ data.post_author ];

    if ( ! username ) {
    	res.send( 'omergersh i dunno you!' );
    }

    // We have a user, lets give them a point
	async.waterfall( [
		function( callback ) {
			ensurePost( username, function( scores ){
				callback( null, scores );
			} );
		},
		function( scores, callback ) {
			scores.posts += 1;
			updateScores( scores, callback );
		}
	], function() {
		res.send( 'mmm points.' );
	} );
} );

var server = app.listen( app.get( 'port' ), function () {
	console.log( "app is now listening on", app.get( 'port' ) );
} );