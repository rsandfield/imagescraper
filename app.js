var express = require('express');
var ejs = require('ejs');
var expressLayouts = require('express-ejs-layouts');
var path = require('path');

var app = express();

app.set('port', process.argv[2]);

app.use(express.static(path.join(__dirname, '/public')));

app.use(expressLayouts);
app.set('layout', './layouts/layout');
app.set('view engine', 'ejs');


app.use(require('./routes/index'));
app.use(require('./routes/results'));
//app.use(require('./routes/error'));


app.use(function(req,res){
    res.status(404);
    res.render('404', {title:"404"});
  });
  
  app.use(function(err, req, res, next){
    console.error(err.stack);
    res.status(500);
    res.render('500', {title: "500"});
  });

  app.listen(app.get('port'), function(){
    console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
  });  