var server = require("./server");
var router = require("./router");
var requestHandlers = require("./requestHandlers");

var handle = {};
handle["/"] = requestHandlers.start;
handle["/start"] = requestHandlers.start;

handle["/upload"] = requestHandlers.upload;
handle["/gets"] = requestHandlers.gets;

handle["/subway"] = requestHandlers.subway;
handle["/interchange"] = requestHandlers.interchange;
handle["/stations"] = requestHandlers.stations;
handle["/beijing"] = requestHandlers.beijing;
handle["/api"] = requestHandlers.api;
handle["/env"] = requestHandlers.env;
handle["/jquerys"] = requestHandlers.jquerys;
handle["/mobile/js/weui.js"] = requestHandlers.weui;
handle["/mobile/css/jquery.css"] = requestHandlers.jquerysCss;
handle["/mobile/css/weui.css"] = requestHandlers.weuiCss;
handle["/mobile/img/aaa1.png"] = requestHandlers.aaa1Png;
// handle["/mobile/img/user68.jpg"] = requestHandlers.userJpg;





server.start(router.route, handle);

// 接口
var express=require('express');

var app =express();
 
//设置跨域访问
app.all('*', function(req, res, next) {
   res.header("Access-Control-Allow-Origin", "*");
   res.header("Access-Control-Allow-Headers", "X-Requested-With");
   res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
   res.header("X-Powered-By",' 3.2.1');
   res.header("Content-Type", "application/json;charset=utf-8");
   next();
});
 
var questions=[
{
    "user_info":"wangch"
},
{
    "user_info":"wangd"
}];
 
//写个接口123
app.get('/userInfo',function(req,res){
    res.status(200),
    res.json(questions)
});
 
//配置服务端口
 
var openServer = app.listen(3000, function () {
 
    var host = openServer.address().address;
 
    var port = openServer.address().port;
 
    console.log('Example app listening at http://%s:%s', host, port);
})
