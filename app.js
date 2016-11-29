var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var _ = require('lodash');
var async = require('async');

var index = require('./routes/index');
var users = require('./routes/users');

var corser = require("corser");
var app = express();
app.use(corser.create());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// set database
var mysqlConfig = require('./config/mysql_config.json');
var mysql = require('mysql');
var db = mysql.createPool(_.extend(
  {
    host: process.env.DB_HOST || mysqlConfig.host,
    user: process.env.DB_USER || mysqlConfig.user,
    password: process.env.DB_PASS || mysqlConfig.password,
    database: process.env.DB_NAME || mysqlConfig.database,
  }, mysqlConfig.opt)
);
global.db = db;

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

///////////////////////////////////////////////////////////
////////////////////テストコード/////////////////////////////
///////////////////////////////////////////////////////////
var FeedParser = require('feedparser');  
var request = require('request');  

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
		// とりあえずrss毎に処理を繰り返す想定。INSERTだかUPDATEだかはrss毎に１発で流したい。
		var feedparser = new FeedParser({});
		var req = request(rss.url);
		var items = [];
		req.on('response', function(res) {
			this.pipe(feedparser);
		});

		feedparser.on('readable', function() {  
		  while(item = this.read()) {
		    // console.log(item);
		    items.push(item);
		  }
		});
		// この後SQLを流すことになる。一旦比較は考えない
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
})

module.exports = app;
