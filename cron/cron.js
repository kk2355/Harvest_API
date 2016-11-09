var cron = require('node-cron');
cron.schedule('* * * * * *', () => {
  //定期的に実行する
  console.log('good morning');
});