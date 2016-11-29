var express = require('express');
var router = express.Router();
var _ = require('lodash');
var async = require('async');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/test', function(req, res, next) {
  res.render('index', { title: 'test' });
});

// サイト毎に表示するパターン
router.get("/harvest", function(req, res) {
	var linkCollection = [];
	async.waterfall([
		// feedテーブルより取得
		function(callback) {
			db.query('SELECT * FROM `rss`', function(err,rows,fields) {
				callback(err,rows);
			});
		},
		// rss毎にデータ整形
		function(rssList,callback) {
			var count = 0;
			_.chain(rssList)
			.each(function(rss) {
				db.query('SELECT `title`, `url`, `date` FROM `feed` WHERE `rss_id` = ? ORDER BY `date` DESC LIMIT 15', rss.id, function(err,rows,fields) {
					var link = {
						siteName: rss.name,
						feedList: rows
					};
					linkCollection.push(link);
					count += 1;
					if (rssList.length === count) {
						callback();
					}
				});
			})
			.value();
		}
	],function(err) {
		if(err) throw err;
		var response = {
			linkCollection: linkCollection
		}

		res.contentType("application/json");
    	res.end(JSON.stringify(response));
	});
});

module.exports = router;
