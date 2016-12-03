var cron = require('node-cron');
var FeedParser = require('feedparser');
var request = require('request');
var async = require('async');
var _ = require('lodash');
var app = require('../app');

cron.schedule('0 0 6 * * *', () => {
  	//定期的に実行する
  	async.parallel([
		// rssテーブルとrss_categoryテーブルをJOINして抽出
		function(callback) {
			db.query('SELECT `rss`.id, `rss`.name, url, `rss_category`.name as category_name FROM `rss` LEFT JOIN `rss_category` ON `rss`.rss_category_id = `rss_category`.id', function(err,rows,fields) {
				callback(err,rows);
			});
		}
	],function(err,rssList) {
		if(err) throw err;
		_.chain(rssList)
		.first()
		.each(function(rss){
			// rss毎に処理を繰り返し。SQLはrss毎に１発で流す。
			var feedparser = new FeedParser({});
			var req = request(rss.url);
			var items = [];
			// 情報取得
			req.on('response', function(res) {
				this.pipe(feedparser);
			});
			// 配列に詰める
			feedparser.on('readable', function() {  
			  while(item = this.read()) {
			    items.push(item);
			  }
			});

			feedparser.on('end', function() {
				// 挿入するデータの整形
				var feeds = _.map(items, function(item) {
					return [rss.id,item.title,item.link,rss.category_name,item.date,new Date()];
				});
			 	// 同じurlのfeedがあれば更新を行い、なければ挿入する
			 	db.query('INSERT INTO `feed` (`rss_id`, `title`, `url`, `category`, `date`, `update_time`) VALUES' + db.escape(feeds) + 
			 		'ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `date` = VALUES(`date`), `update_time` = VALUES(`update_time`)',function(err,rows){
			      console.log(err,rows);
			    });
				console.log('-----');
			});
		})
		.value();
	});
});